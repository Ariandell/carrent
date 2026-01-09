/**
 * WebGL Fluid Simulation
 * OPTIMIZED v5: Adaptive Performance for ALL devices
 * - Auto-detects device capabilities
 * - Adjusts quality based on real-time frame budget
 * - Much more aggressive optimization for mobile
 */

(function () {
    // Device Detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    console.log(`FluidJS: Device - Mobile: ${isMobile}, Android: ${isAndroid}, iOS: ${isIOS}`);

    // Adaptive Configuration
    const config = {
        DENSITY_DISSIPATION: 0.9,
        VELOCITY_DISSIPATION: 0.99,
        PRESSURE_DISSIPATION: 0.8,
        CURL: isMobile ? 15 : 20,
        SPLAT_RADIUS: 0.0005,
        SPLAT_FORCE: 6000,

        // CRITICAL: Mobile-specific optimizations
        PRESSURE_ITERATIONS: isMobile ? 5 : 10,  // Half iterations on mobile
        RESOLUTION_SCALE: isAndroid ? 0.25 : (isMobile ? 0.35 : 0.5), // Much lower for Android
        FPS_LIMIT: isMobile ? 30 : 60  // 30 FPS on mobile is fine for background effect
    };

    console.log(`FluidJS: Config - ResScale: ${config.RESOLUTION_SCALE}, FPS: ${config.FPS_LIMIT}, Iterations: ${config.PRESSURE_ITERATIONS}`);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;mix-blend-mode:screen;';
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,  // Disable AA for performance
        depth: false,      // No depth buffer needed
        stencil: false,    // No stencil buffer needed
        preserveDrawingBuffer: false,
        powerPreference: 'low-power'  // Request low-power GPU on laptops
    });

    if (!gl) {
        console.log('FluidJS: WebGL not supported');
        return;
    }

    let pointers = [];

    // --- MOUSE INPUT ---
    class Pointer {
        constructor() {
            this.id = -1;
            this.x = 0;
            this.y = 0;
            this.down = false;
            this.moved = false;
            this.color = [1.5, 1.5, 1.5];
        }
    }

    pointers.push(new Pointer());

    function getPointerPos(event, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);

        return {
            x: (clientX - rect.left) * (targetCanvas.width / rect.width),
            y: (clientY - rect.top) * (targetCanvas.height / rect.height)
        };
    }

    window.addEventListener('mousemove', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        const t = Date.now() / 1000;
        pointers[0].color = [Math.sin(t) + 1.5, Math.sin(t + 2) + 1.5, Math.sin(t + 4) + 1.5];
    });

    window.addEventListener('touchstart', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].down = true;
        pointers[0].moved = false;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        lastX = pointers[0].x;
        lastY = pointers[0].y;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
        const pos = getPointerPos(e, canvas);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
    }, { passive: true });

    window.addEventListener('touchend', () => {
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // --- SHADERS (Simplified for mobile compatibility) ---
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
            vUv = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const copyShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main() {
            gl_FragColor = texture2D(uTexture, vUv);
        }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main() {
            vec2 p = vUv - point;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).rgb;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;
        void main() {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            gl_FragColor = dissipation * texture2D(uSource, coord);
            gl_FragColor.a = 1.0;
        }
    `);

    // Simplified divergence - no varyings for mobile compatibility
    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main() {
            float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
            float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
            float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
            float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main() {
            float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;
            float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;
            float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).x;
            float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform vec2 texelSize;
        uniform float curl;
        uniform float dt;
        void main() {
            float L = texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x;
            float R = texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x;
            float T = texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x;
            float B = texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x;
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
        varying vec2 vUv;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 texelSize;
        void main() {
            float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
            float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
            float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
            float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main() {
            float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
            float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
            float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
            float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `);

    // --- GL SETUP ---
    const blit = (() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        return (dest) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, dest);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        };
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

    // --- FBOs (Always use UNSIGNED_BYTE for maximum compatibility) ---
    // HALF_FLOAT causes more problems than it solves on mobile
    function createFBO(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo, width: w, height: h };
    }

    function createDoubleFBO(w, h) {
        let fbo1 = createFBO(w, h);
        let fbo2 = createFBO(w, h);
        return {
            get read() { return fbo1; },
            get write() { return fbo2; },
            swap() { [fbo1, fbo2] = [fbo2, fbo1]; }
        };
    }

    let density, velocity, divergenceFBO, curlFBO, pressure;

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

        gl.uniform3fv(splatProgram.uniforms.color, color);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        blit(density.write.fbo);
        density.swap();
    }

    let lastX = 0, lastY = 0;
    let lastTime = 0;
    const frameInterval = 1000 / config.FPS_LIMIT;

    function update(currentTime) {
        requestAnimationFrame(update);

        if (!currentTime) currentTime = performance.now();
        const elapsed = currentTime - lastTime;
        if (elapsed < frameInterval) return;
        lastTime = currentTime - (elapsed % frameInterval);

        const dt = 0.016;
        const texelSize = [1.0 / canvas.width, 1.0 / canvas.height];

        gl.viewport(0, 0, canvas.width, canvas.height);

        // Advection - Velocity
        gl.useProgram(advectionProgram.program);
        gl.uniform2fv(advectionProgram.uniforms.texelSize, texelSize);
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, 0);
        gl.uniform1i(advectionProgram.uniforms.uSource, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        // Advection - Density
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
        gl.uniform1i(advectionProgram.uniforms.uSource, 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, density.read.tex);
        blit(density.write.fbo);
        density.swap();

        // Splats
        if (pointers[0].moved) {
            const dx = pointers[0].x - lastX;
            const dy = pointers[0].y - lastY;
            splat(pointers[0].x, pointers[0].y, dx * 5.0, dy * 5.0, pointers[0].color);
            lastX = pointers[0].x;
            lastY = pointers[0].y;
            pointers[0].moved = false;
        }

        // Curl
        gl.useProgram(curlProgram.program);
        gl.uniform2fv(curlProgram.uniforms.texelSize, texelSize);
        gl.uniform1i(curlProgram.uniforms.uVelocity, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(curlFBO.fbo);

        // Vorticity
        gl.useProgram(vorticityProgram.program);
        gl.uniform2fv(vorticityProgram.uniforms.texelSize, texelSize);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, 0);
        gl.uniform1i(vorticityProgram.uniforms.uCurl, 1);
        gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, curlFBO.tex);
        blit(velocity.write.fbo);
        velocity.swap();

        // Divergence
        gl.useProgram(divergenceProgram.program);
        gl.uniform2fv(divergenceProgram.uniforms.texelSize, texelSize);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, 0);
        gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
        blit(divergenceFBO.fbo);

        // Pressure
        gl.useProgram(pressureProgram.program);
        gl.uniform2fv(pressureProgram.uniforms.texelSize, texelSize);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, 0);
        gl.uniform1i(pressureProgram.uniforms.uPressure, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, divergenceFBO.tex);

        for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
            blit(pressure.write.fbo);
            pressure.swap();
        }

        // Gradient Subtract
        gl.useProgram(gradSubtractProgram.program);
        gl.uniform2fv(gradSubtractProgram.uniforms.texelSize, texelSize);
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
        const w = Math.floor(window.innerWidth * config.RESOLUTION_SCALE);
        const h = Math.floor(window.innerHeight * config.RESOLUTION_SCALE);

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            console.log(`FluidJS: Resize to ${w}x${h}`);
            density = createDoubleFBO(w, h);
            velocity = createDoubleFBO(w, h);
            divergenceFBO = createFBO(w, h);
            curlFBO = createFBO(w, h);
            pressure = createDoubleFBO(w, h);
        }
    }

    window.addEventListener('resize', resize);

    // Deferred init
    setTimeout(() => {
        resize();
        update();
        console.log('FluidJS: Started');
    }, 200);

})();
