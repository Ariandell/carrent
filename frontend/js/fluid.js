/**
 * WebGL Fluid Simulation
 * A high-performance Navier-Stokes solver for the cursor smoke effect.
 * Adapted for "Pearl Smoke" aesthetic (High precision, slow dissipation, iridescent colors).
 */

(function () {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;mix-blend-mode:screen;'; // Screen blend for transparency
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl');
    if (!gl) return; // WebGL not supported

    // Configuration
    const config = {
        TEXTURE_DOWNSAMPLE: 1,
        DENSITY_DISSIPATION: 0.9, // Fade faster to keep screen clean
        VELOCITY_DISSIPATION: 0.99,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 20,
        CURL: 25,
        SPLAT_RADIUS: 0.0005,
        SPLAT_FORCE: 6000
    };

    let pointers = [];
    let splatStack = [];

    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    console.log("FluidJS: Init", width, height);

    // --- MOUSE INPUT ---
    class Pointer {
        constructor() {
            this.id = -1;
            this.x = 0;
            this.y = 0;
            this.dx = 0;
            this.dy = 0;
            this.down = false;
            this.moved = false;
            this.color = [30, 0, 300]; // RGB
        }
    }

    pointers.push(new Pointer());

    canvas.addEventListener('mousemove', e => {
        // ... (This listener on canvas is blocked by pointer-events: none, so redundant but harmless)
        // Just update position, interpolation happens in update loop
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = e.offsetX;
        pointers[0].y = e.offsetY;

        // Iridescent Color Cycling
        // High Lightness (mostly white base), shifting hue
        const t = Date.now() / 1000;
        const r = Math.sin(t) * 0.5 + 0.5;
        const g = Math.sin(t + 2) * 0.5 + 0.5;
        const b = Math.sin(t + 4) * 0.5 + 0.5;
        // Boost for "Add" blend mode (Glow)
        pointers[0].color = [r * 2, g * 2, b * 2];
    });

    // Pass-through events hack:
    // Since this canvas is z-index 9999, we need to manually forward clicks?
    // CSS 'pointer-events: none' solves this. But then we can't listen to events ON the canvas.
    // Solution: Listen on WINDOW.
    // Color Update Logic
    function updatePointerColor(pointer) {
        const t = Date.now() / 500;
        const r = Math.sin(t) * 1.5 + 1.5;
        const g = Math.sin(t + 2.0) * 1.5 + 1.5;
        const b = Math.sin(t + 4.0) * 1.5 + 1.5;
        pointer.color = [r, g, b];
    }

    // Helper to get canvas relative coordinates
    function getPointerPos(event, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Mouse Support
    window.addEventListener('mousemove', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        updatePointerColor(pointers[0]);
    });

    // Touch Support (Mobile)
    window.addEventListener('touchstart', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].down = true;
        pointers[0].moved = false; // Reset interpolation
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        // Also reset last positions to prevent jump from previous touch
        lastX = pointers[0].x;
        lastY = pointers[0].y;
        updatePointerColor(pointers[0]);
    }, { passive: true });

    window.addEventListener('touchmove', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        updatePointerColor(pointers[0]);
    }, { passive: true });

    window.addEventListener('touchend', e => {
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // --- SHADERS ---
    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const copyShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;
        void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            gl_FragColor = dissipation * texture2D(uSource, coord);
            gl_FragColor.a = 1.0;
        }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;
        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;
            
            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `);

    // --- GL SETUP & PROGRAMS ---
    const blit = (() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        return (destination) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
    })();

    function createProgram(fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, baseVertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        const uniforms = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < count; i++) {
            const name = gl.getActiveUniform(program, i).name;
            uniforms[name] = gl.getUniformLocation(program, name);
        }
        return { program, uniforms };
    }

    const splatProgram = createProgram(splatShader);
    const advectionProgram = createProgram(advectionShader);
    const divergenceProgram = createProgram(divergenceShader);
    const curlProgram = createProgram(curlShader);
    const vorticityProgram = createProgram(vorticityShader);
    const pressureProgram = createProgram(pressureShader);
    const gradSubtractProgram = createProgram(gradientSubtractShader);
    const copyProgram = createProgram(copyShader);

    // --- FBOs ---
    function createFBO(w, h, type = gl.FLOAT) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null); // Use dynamic type

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo, width: w, height: h };
    }

    // Check Float Support
    let texType = gl.FLOAT;
    const extFloat = gl.getExtension('OES_texture_float');
    const extFloatLinear = gl.getExtension('OES_texture_float_linear');
    const extHalfFloat = gl.getExtension('OES_texture_half_float');
    const extHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');

    if (!extFloat || !extFloatLinear) {
        if (extHalfFloat && extHalfFloatLinear) {
            texType = extHalfFloat.HALF_FLOAT_OES;
            console.log("FluidJS: Using HALF_FLOAT");
        } else {
            console.warn("FluidJS: Floating point textures not supported");
            // Fallback to UNSIGNED_BYTE? It won't work well for fluid physics (precision loss) but better than nothing
            texType = gl.UNSIGNED_BYTE;
        }
    } else {
        console.log("FluidJS: Using FLOAT");
    }

    let density = createDoubleFBO(canvas.width, canvas.height);
    let velocity = createDoubleFBO(canvas.width, canvas.height);
    let divergence = createFBO(canvas.width, canvas.height);
    let curl = createFBO(canvas.width, canvas.height);
    let pressure = createDoubleFBO(canvas.width, canvas.height);

    function createDoubleFBO(w, h) {
        let fbo1 = createFBO(w, h, texType);
        let fbo2 = createFBO(w, h, texType);
        return {
            get read() { return fbo1; },
            set read(value) { fbo1 = value; },
            get write() { return fbo2; },
            set write(value) { fbo2 = value; },
            swap() {
                let temp = fbo1;
                fbo1 = fbo2;
                fbo2 = temp;
            }
        }
    }

    function multipleSplats(amount) {
        for (let i = 0; i < amount; i++) {
            const color = [Math.random() * 10, Math.random() * 10, Math.random() * 10];
            const x = canvas.width * Math.random();
            const y = canvas.height * Math.random();
            const dx = 1000 * (Math.random() - 0.5);
            const dy = 1000 * (Math.random() - 0.5);
            splat(x, y, dx, dy, color);
        }
    }

    function splat(x, y, dx, dy, color) {
        gl.useProgram(splatProgram.program);
        gl.uniform1i(splatProgram.uniforms.uTarget, 0);
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
        gl.uniform3f(splatProgram.uniforms.color, dx, dy, 1.0);
        gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        gl.uniform1i(splatProgram.uniforms.uTarget, 0);
        gl.uniform3fv(splatProgram.uniforms.color, color);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        blit(density.write.fbo);
        density.swap();
    }

    let lastX = 0;
    let lastY = 0;

    // --- MAIN LOOP ---
    function update() {
        const dt = 0.025; // 40% faster physics (was 0.016)

        gl.viewport(0, 0, canvas.width, canvas.height);

        // Advection
        gl.useProgram(advectionProgram.program);
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, 0);
        gl.uniform1i(advectionProgram.uniforms.uSource, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        gl.uniform1i(advectionProgram.uniforms.uVelocity, 0);
        gl.uniform1i(advectionProgram.uniforms.uSource, 1);
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);



        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        blit(density.write.fbo);
        density.swap();

        // Splats (Interpolated)
        if (pointers[0].moved) {
            const dx = pointers[0].x - lastX;
            const dy = pointers[0].y - lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Only interpolate if distance is reasonable (avoid jumps on init/tab switch)
            if (dist < 800 && dist > 0) {
                const steps = Math.ceil(dist / 5); // Splat every 5 pixels
                for (let i = 0; i < steps; i++) {
                    const t = (i + 1) / steps;
                    const x = lastX + dx * t;
                    const y = lastY + dy * t;

                    // Linear interpolation without noise for smoothness
                    splat(x, y, dx * 5.0, dy * 5.0, pointers[0].color);
                }
            } else {
                // Single splat (first move or jump)
                splat(pointers[0].x, pointers[0].y, dx * 5.0, dy * 5.0, pointers[0].color);
            }

            lastX = pointers[0].x;
            lastY = pointers[0].y;
            pointers[0].moved = false;
        } else {
            // Keep last pos updated even if not technically 'moved' (for subtle idle drift if implemented later)
            // But here we just relying on the flag.
        }

        // Curl
        gl.useProgram(curlProgram.program);
        gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1i(curlProgram.uniforms.uVelocity, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(curl.fbo);

        // Vorticity
        gl.useProgram(vorticityProgram.program);
        gl.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, 0);
        gl.uniform1i(vorticityProgram.uniforms.uCurl, 1);
        gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, curl.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        // Divergence
        gl.useProgram(divergenceProgram.program);
        gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(divergence.fbo);

        // Pressure Solver
        gl.useProgram(pressureProgram.program);
        gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, divergence.tex);
        gl.uniform1i(pressureProgram.uniforms.uPressure, 1);

        for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
            blit(pressure.write.fbo);
            pressure.swap();
        }

        // Gradient Subtract
        gl.useProgram(gradSubtractProgram.program);
        gl.uniform2f(gradSubtractProgram.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
        gl.uniform1i(gradSubtractProgram.uniforms.uPressure, 0);
        gl.uniform1i(gradSubtractProgram.uniforms.uVelocity, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        // DISPLAY
        gl.useProgram(copyProgram.program);
        gl.uniform1i(copyProgram.uniforms.uTexture, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        // Blit to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(update);
    }

    // Helper
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    // Resize
    function resize() {
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Re-init FBOs
            density = createDoubleFBO(canvas.width, canvas.height);
            velocity = createDoubleFBO(canvas.width, canvas.height);
            divergence = createFBO(canvas.width, canvas.height);
            curl = createFBO(canvas.width, canvas.height);
            pressure = createDoubleFBO(canvas.width, canvas.height);
        }
    }
    window.addEventListener('resize', resize);

    // Init
    resize();
    update();

})();
