/**
 * WebGL Fluid Simulation
 * Optimized for Cross-Platform Performance (PC/Mobile)
 * v5: Fixed Android Half-Float + Smart Resolution
 */

(function () {
    // (Debug console removed)

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100lvh;pointer-events:none;z-index:9999;mix-blend-mode:screen;';
    document.body.appendChild(canvas);

    // Try WebGL2 first (better float texture support on mobile), fallback to WebGL1
    let gl = canvas.getContext('webgl2');
    let isWebGL2 = !!gl;
    if (!gl) {
        gl = canvas.getContext('webgl');
        isWebGL2 = false;
    }
    if (!gl) return;

    console.log('WebGL version:', isWebGL2 ? '2.0' : '1.0');

    // --- SMART CONFIG ---
    const isMobile = window.innerWidth < 768;
    const config = {
        TEXTURE_DOWNSAMPLE: 1,
        DENSITY_DISSIPATION: 0.8, // Faster fade (was 0.9)
        VELOCITY_DISSIPATION: 0.99,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 10,
        CURL: 20,
        SPLAT_RADIUS: isMobile ? 0.0004 : 0.0005, // Slightly thicker for better blending
        SPLAT_FORCE: isMobile ? 2000 : 4000,      // Less explosive (was 3000/6000)
        RESOLUTION_SCALE: 0.5,
        FPS_LIMIT: 60
    };

    let pointers = [];
    let splatStack = [];
    let inputQueue = []; // Queue for coalesced input events
    let lastX = 0;
    let lastY = 0;
    let brushVx = 0;
    let brushVy = 0;

    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // --- EXTENSIONS & SUPPORT ---
    const extHalfFloat = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float');
    const extFloat = gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('WEBGL_color_buffer_float');

    // Test if a texture type actually works for FBO rendering
    function testFBORenderable(internalFormat, format, type) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
        } catch (e) {
            gl.deleteTexture(tex);
            return false;
        }
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
        return status === gl.FRAMEBUFFER_COMPLETE;
    }

    // Select best working texture type
    let texType = gl.UNSIGNED_BYTE;
    let texInternalFormat = gl.RGBA;
    let texFormat = gl.RGBA;
    let isLowPrecision = true;

    if (isWebGL2) {
        // WebGL2: Try RGBA16F (best for fluid sim)
        gl.getExtension('EXT_color_buffer_float'); // Enable float FBO in WebGL2
        if (testFBORenderable(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)) {
            texType = gl.HALF_FLOAT;
            texInternalFormat = gl.RGBA16F;
            isLowPrecision = false;
            console.log('Texture: WebGL2 RGBA16F (HDR)');
        } else if (testFBORenderable(gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE)) {
            console.log('Texture: WebGL2 RGBA8 (LDR)');
        }
    } else {
        // WebGL1: Try extensions
        if (extHalfFloat && testFBORenderable(gl.RGBA, gl.RGBA, extHalfFloat.HALF_FLOAT_OES)) {
            texType = extHalfFloat.HALF_FLOAT_OES;
            isLowPrecision = false;
            console.log('Texture: WebGL1 HALF_FLOAT (HDR)');
        } else if (extFloat && testFBORenderable(gl.RGBA, gl.RGBA, gl.FLOAT)) {
            texType = gl.FLOAT;
            isLowPrecision = false;
            console.log('Texture: WebGL1 FLOAT (HDR)');
        } else {
            console.log('Texture: WebGL1 UNSIGNED_BYTE (LDR)');
        }
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
        return {
            x: pointer.clientX * config.RESOLUTION_SCALE,
            y: pointer.clientY * config.RESOLUTION_SCALE
        };
    }

    // Input Listeners (Unified Pointer Events for Coalesced Support)
    function updatePointer(x, y) {
        pointers[0].moved = pointers[0].down = true;
        pointers[0].dx = (x - pointers[0].x) * 5.0;
        pointers[0].dy = (y - pointers[0].y) * 5.0;
        pointers[0].x = x;
        pointers[0].y = y;

        // Color Cycle
        const t = Date.now() / 1000;
        const colorScale = isLowPrecision ? 0.3 : 1.0;
        pointers[0].color = [
            (Math.sin(t) + 1.5) * colorScale,
            (Math.sin(t + 2) + 1.5) * colorScale,
            (Math.sin(t + 4) + 1.5) * colorScale
        ];
    }

    // Mouse support via Pointer Events (Ignore touch to avoid duplicates)
    window.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        const pos = getPointerPos(e);
        updatePointer(pos.x, pos.y);
        lastX = pos.x;
        lastY = pos.y;
        pointers[0].moved = false;
    });

    window.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        const pos = getPointerPos(e);
        updatePointer(pos.x, pos.y);
    });

    window.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // Explicit Touch support (Survives scrolling on Android)
    window.addEventListener('touchstart', e => {
        const pos = getPointerPos(e);
        updatePointer(pos.x, pos.y);
        lastX = pos.x;
        lastY = pos.y;
        pointers[0].moved = false;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
        // Just take the first changed touch for target (Simple Chasing)
        if (e.changedTouches.length > 0) {
            const pos = getPointerPos(e.changedTouches[0]);
            updatePointer(pos.x, pos.y);
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // --- SHADERS ---
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
            console.error(`Shader compile error (${typeName}):`, gl.getShaderInfoLog(shader));
            return null;
        }
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

    // Vertex shader for physics shaders that need neighbor UV coordinates
    // CRITICAL: precision qualifiers MUST match fragment shaders (highp for varyings)
    const neighborVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        uniform vec2 texelSize;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    console.log('Vertex shaders:', baseVertexShader ? 'OK' : 'FAIL', neighborVertexShader ? 'OK' : 'FAIL');

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
    function createProgram(fragmentShader, vertexShader = baseVertexShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
        }
        const uniforms = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < count; i++) {
            const name = gl.getActiveUniform(program, i).name;
            uniforms[name] = gl.getUniformLocation(program, name);
        }
        return { program, uniforms };
    }

    // Basic programs (use baseVertexShader)
    const splatProgram = createProgram(splatShader);
    const advectionProgram = createProgram(advectionShader);
    const copyProgram = createProgram(copyShader);

    // Physics programs (use neighborVertexShader for vL/vR/vT/vB)
    const divergenceProgram = createProgram(divergenceShader, neighborVertexShader);
    const curlProgram = createProgram(curlShader, neighborVertexShader);
    const vorticityProgram = createProgram(vorticityShader, neighborVertexShader);
    const pressureProgram = createProgram(pressureShader, neighborVertexShader);
    const gradSubtractProgram = createProgram(gradientSubtractShader, neighborVertexShader);

    console.log('Physics programs:',
        'div:', !!divergenceProgram.program,
        'curl:', !!curlProgram.program,
        'vort:', !!vorticityProgram.program,
        'pres:', !!pressureProgram.program,
        'grad:', !!gradSubtractProgram.program
    );

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
    // --- FBOs ---
    function createFBO(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        // Auto-detect filtering: Prioritize LINEAR for smooth quality
        let filter = gl.LINEAR;

        // For float/half-float types, verify if linear filtering is actually supported
        // In WebGL2, we might need OES_texture_float_linear even for HALF_FLOAT
        if (texType === gl.FLOAT || texType === gl.HALF_FLOAT ||
            (gl.getExtension('OES_texture_half_float') && texType === gl.getExtension('OES_texture_half_float').HALF_FLOAT_OES)) {

            const hasLinear = gl.getExtension('OES_texture_float_linear') || gl.getExtension('OES_texture_half_float_linear');
            if (!hasLinear) {
                filter = gl.NEAREST;
                console.warn('Linear float filtering not supported, falling back to NEAREST');
            }
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Use global formats detected at startup
        gl.texImage2D(gl.TEXTURE_2D, 0, texInternalFormat, w, h, 0, texFormat, texType, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        // Debug FBO status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO incomplete:', status);
        }

        return { tex, fbo, width: w, height: h };
    }

    let density, velocity, divergence, curl, pressure;

    function createDoubleFBO(w, h) {
        let fbo1 = createFBO(w, h); // No need to pass type
        let fbo2 = createFBO(w, h);
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

    // lastX/lastY moved to top
    let lastTime = 0;
    const frameInterval = 1000 / config.FPS_LIMIT;

    function update(currentTime) {
        requestAnimationFrame(update);

        if (!currentTime) currentTime = performance.now();

        // Physics Delta Time (Normalized to 60FPS) across refresh rates
        const rawDt = (currentTime - lastTime) || 16.6;
        lastTime = currentTime;
        const physDt = Math.min(rawDt / 16.6, 4.0);

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
        /* OLD INPUT QUEUE LOGIC
        if (inputQueue.length > 0) {
            // Process all coalesced events
            for (let i = 0; i < inputQueue.length; i++) {
                const pos = inputQueue[i];
                const dx = pos.x - lastX;
                const dy = pos.y - lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Interpolate if moved significantly to prevent "dots"
                if (dist > 0) {
                    const steps = Math.ceil(dist / 2); // Step every 2 pixels for smoothness
                    for (let j = 0; j < steps; j++) {
                        const t = (j + 1) / steps;
                        const x = lastX + dx * t;
                        const y = lastY + dy * t;
                        splat(x, y, dx * 5.0, dy * 5.0, pointers[0].color);
                    }
                }
                lastX = pos.x;
                lastY = pos.y;
                updatePointer(pos.x, pos.y);
            }
            inputQueue = []; // Clear queue
        } else if (pointers[0].down && pointers[0].moved) {
            // Fallback for single-frame moves (e.g. initial down)
            const dx = pointers[0].x - lastX;
            const dy = pointers[0].y - lastY;
            splat(pointers[0].x, pointers[0].y, dx * 5.0, dy * 5.0, pointers[0].color);
            lastX = pointers[0].x;
            lastY = pointers[0].y;
            pointers[0].moved = false;
        }

        */

        // Splats (Smoothed "Chasing" Cursor)
        if (pointers[0].down) {
            const targetX = pointers[0].x;
            const targetY = pointers[0].y;

            // Spring Physics (Momentum)
            const tension = isMobile ? 0.2 : 0.5;
            const friction = isMobile ? 0.9 : 0.65;

            brushVx += (targetX - lastX) * tension;
            brushVy += (targetY - lastY) * tension;

            brushVx *= friction;
            brushVy *= friction;

            const x = lastX + brushVx;
            const y = lastY + brushVy;

            // Calculate distance moved this frame
            const dx = x - lastX;
            const dy = y - lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Sub-step drawing to fill gaps (prevent dotted lines)
            // Draw a splat every 2 pixels (approx)
            if (dist > 0) {
                const steps = Math.ceil(dist / 2);
                for (let i = 0; i < steps; i++) {
                    const t = (i + 1) / steps;
                    const drawX = lastX + dx * t;
                    const drawY = lastY + dy * t;
                    const velX = dx * 5.0; // Velocity is constant for this frame step
                    const velY = dy * 5.0;
                    splat(drawX, drawY, velX, velY, pointers[0].color);
                }
            }

            lastX = x;
            lastY = y;
        } else {
            // Snap brush and reset momentum
            lastX = pointers[0].x;
            lastY = pointers[0].y;
            brushVx = 0;
            brushVy = 0;
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

    let lastWidth = 0;
    function resize() {
        // On mobile, prevent reset on vertical resize (URL bar) OR minor width shifts
        if (isMobile && Math.abs(window.innerWidth - lastWidth) < 50) return;
        lastWidth = window.innerWidth;

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
