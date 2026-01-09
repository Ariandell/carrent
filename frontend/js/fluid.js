/**
 * WebGL Fluid Simulation
 * Optimized for Cross-Platform Performance (PC/Mobile)
 * v5: Fixed Android Half-Float + Smart Resolution
 */

(function () {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;mix-blend-mode:screen;';
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // --- SMART CONFIG ---
    const isMobile = window.innerWidth < 768; // Simple check for mobile
    const config = {
        TEXTURE_DOWNSAMPLE: 1,
        DENSITY_DISSIPATION: 0.96, // Slower dissipation for "richer" feel
        VELOCITY_DISSIPATION: 0.99,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 10,
        CURL: 20,
        SPLAT_RADIUS: 0.0005,
        SPLAT_FORCE: 6000,
        // Resolution: Desktop gets 0.5x (enough for 1080p/4k), Mobile gets 1.0x (needed for small screens) check
        RESOLUTION_SCALE: isMobile ? 1.0 : 0.5,
        FPS_LIMIT: 60
    };

    let pointers = [];
    let splatStack = [];

    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // --- EXTENSIONS & SUPPORT ---
    // Critical for Android High Quality: Enable color buffer extensions!
    const extHalfFloat = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float'); // <--- CRITICAL for rendering to FBO on Android

    // Fallbacks
    const extFloat = gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('WEBGL_color_buffer_float');

    // Texture Type Selection
    let texType = gl.UNSIGNED_BYTE;
    if (extHalfFloat) {
        texType = extHalfFloat.HALF_FLOAT_OES;
        // console.log("Using HALF_FLOAT");
    } else if (extFloat) {
        texType = gl.FLOAT;
        // console.log("Using FLOAT");
    } else {
        // console.log("Using UNSIGNED_BYTE");
    }

    // --- MOUSE/TOUCH INPUT ---
    class Pointer {
        constructor() {
            this.id = -1;
            this.x = 0;
            this.y = 0;
            this.dx = 0;
            this.dy = 0;
            this.down = false;
            this.moved = false;
            this.color = [30, 0, 300];
        }
    }

    pointers.push(new Pointer());

    function getPointerPos(event) {
        // Use the first changed touch for simplicity, or mouse event
        const pointer = event.targetTouches ? event.targetTouches[0] : event;
        const rect = canvas.getBoundingClientRect();

        // Scale input coordinates to match internal canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (pointer.clientX - rect.left) * scaleX,
            y: (pointer.clientY - rect.top) * scaleY
        };
    }

    // Input Listeners
    window.addEventListener('mousemove', e => {
        const pos = getPointerPos(e);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;

        // Color Cycle
        const t = Date.now() / 1000;
        pointers[0].color = [Math.sin(t) + 1.5, Math.sin(t + 2) + 1.5, Math.sin(t + 4) + 1.5];
    });

    // Touch support with better smoothness
    window.addEventListener('touchstart', e => {
        // e.preventDefault(); // Optional: prevents scroll if desired, but we want scroll
        const pos = getPointerPos(e);
        pointers[0].down = true;
        pointers[0].moved = false;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        lastX = pointers[0].x;
        lastY = pointers[0].y;
    }, { passive: false }); // Passive true causes issues sometimes with high-freq updates

    window.addEventListener('touchmove', e => {
        const pos = getPointerPos(e);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
    }, { passive: false });

    window.addEventListener('touchend', () => {
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // --- SHADERS ---
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
        return shader;
    }

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

    // --- PROGRAMS ---
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

    // --- FBOs ---
    function createFBO(w, h, type = gl.FLOAT) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        // Auto-detect filtering support: LINEAR if possible, NEAREST fallback
        let filter = gl.LINEAR;
        // Strict check: if HalfFloat and NO Linear extension, force Nearest
        // (Simplified check logic without global flags)
        if (type === (gl.getExtension('OES_texture_half_float')?.HALF_FLOAT_OES) && !gl.getExtension('OES_texture_half_float_linear')) {
            filter = gl.NEAREST;
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo, width: w, height: h };
    }

    let density, velocity, divergence, curl, pressure;

    function createDoubleFBO(w, h) {
        let fbo1 = createFBO(w, h, texType);
        let fbo2 = createFBO(w, h, texType);
        return {
            get read() { return fbo1; },
            set read(value) { fbo1 = value; },
            get write() { return fbo2; },
            set write(value) { fbo2 = value; },
            swap() { let temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
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
    let lastTime = 0;
    const frameInterval = 1000 / config.FPS_LIMIT;

    function update(currentTime) {
        requestAnimationFrame(update);

        if (!currentTime) currentTime = performance.now();
        const elapsed = currentTime - lastTime;
        if (elapsed < frameInterval) return;
        lastTime = currentTime - (elapsed % frameInterval);

        const dt = 0.025;
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

        // Splats
        if (pointers[0].moved) {
            const dx = pointers[0].x - lastX;
            const dy = pointers[0].y - lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Interpolate if moved significantly to prevent "dots"
            if (dist > 0) {
                const steps = Math.ceil(dist / 2); // Step every 2 pixels for smoothness
                for (let i = 0; i < steps; i++) {
                    const t = (i + 1) / steps;
                    const x = lastX + dx * t;
                    const y = lastY + dy * t;
                    splat(x, y, dx * 5.0, dy * 5.0, pointers[0].color);
                }
            }

            lastX = pointers[0].x;
            lastY = pointers[0].y;
            pointers[0].moved = false;
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

        // Pressure
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

        // Display
        gl.useProgram(copyProgram.program);
        gl.uniform1i(copyProgram.uniforms.uTexture, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function resize() {
        const targetWidth = Math.floor(window.innerWidth * config.RESOLUTION_SCALE);
        const targetHeight = Math.floor(window.innerHeight * config.RESOLUTION_SCALE);

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            density = createDoubleFBO(canvas.width, canvas.height);
            velocity = createDoubleFBO(canvas.width, canvas.height);
            divergence = createFBO(canvas.width, canvas.height);
            curl = createFBO(canvas.width, canvas.height);
            pressure = createDoubleFBO(canvas.width, canvas.height);
        }
    }
    window.addEventListener('resize', resize);

    // Initial load
    setTimeout(() => {
        resize();
        update();
    }, 100);

})();
