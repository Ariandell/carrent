/**
 * WebGL Fluid Simulation - DEBUG VERSION
 * Extensive logging to diagnose Android performance issues
 */

(function () {
    console.log('=== FluidJS Debug Start ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);
    console.log('Device Pixel Ratio:', window.devicePixelRatio);
    console.log('Screen:', window.screen.width, 'x', window.screen.height);
    console.log('Inner:', window.innerWidth, 'x', window.innerHeight);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;mix-blend-mode:screen;';
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('FluidJS: WebGL not supported!');
        return;
    }

    // === GPU INFO ===
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
        console.log('GPU Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        console.log('GPU Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
    } else {
        console.log('GPU Info: Not available (WEBGL_debug_renderer_info not supported)');
    }

    // === WebGL Limits ===
    console.log('Max Texture Size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
    console.log('Max Viewport Dims:', gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    console.log('Max Renderbuffer Size:', gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));

    // === Extension Support ===
    const extHalfFloat = gl.getExtension('OES_texture_half_float');
    const extHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
    const extFloat = gl.getExtension('OES_texture_float');
    const extFloatLinear = gl.getExtension('OES_texture_float_linear');
    const extColorBufferFloat = gl.getExtension('WEBGL_color_buffer_float');
    const extColorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');

    console.log('=== Extension Support ===');
    console.log('OES_texture_half_float:', !!extHalfFloat);
    console.log('OES_texture_half_float_linear:', !!extHalfFloatLinear);
    console.log('OES_texture_float:', !!extFloat);
    console.log('OES_texture_float_linear:', !!extFloatLinear);
    console.log('WEBGL_color_buffer_float:', !!extColorBufferFloat);
    console.log('EXT_color_buffer_half_float:', !!extColorBufferHalfFloat);

    // Configuration
    const config = {
        DENSITY_DISSIPATION: 0.9,
        VELOCITY_DISSIPATION: 0.99,
        PRESSURE_ITERATIONS: 10,
        CURL: 20,
        SPLAT_RADIUS: 0.0005,
        RESOLUTION_SCALE: 0.5,
        FPS_LIMIT: 60
    };

    console.log('=== Config ===');
    console.log('Resolution Scale:', config.RESOLUTION_SCALE);
    console.log('FPS Limit:', config.FPS_LIMIT);

    // Determine texture type
    let texType = gl.UNSIGNED_BYTE;
    let texTypeName = 'UNSIGNED_BYTE';
    let useNearestFiltering = false;

    if (extHalfFloat && extHalfFloatLinear) {
        texType = extHalfFloat.HALF_FLOAT_OES;
        texTypeName = 'HALF_FLOAT + LINEAR';
    } else if (extHalfFloat) {
        texType = extHalfFloat.HALF_FLOAT_OES;
        texTypeName = 'HALF_FLOAT + NEAREST';
        useNearestFiltering = true;
    } else if (extFloat && extFloatLinear) {
        texType = gl.FLOAT;
        texTypeName = 'FLOAT + LINEAR';
    } else if (extFloat) {
        texType = gl.FLOAT;
        texTypeName = 'FLOAT + NEAREST';
        useNearestFiltering = true;
    }

    console.log('Selected Texture Type:', texTypeName);
    console.log('Using NEAREST filtering:', useNearestFiltering);

    // Test FBO creation
    function testFBOSupport(type, typeName) {
        const testTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, testTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, type, null);
        } catch (e) {
            console.log(`FBO Test ${typeName}: texImage2D FAILED -`, e.message);
            gl.deleteTexture(testTex);
            return false;
        }

        const testFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, testFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, testTex, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        const statusName = {
            [gl.FRAMEBUFFER_COMPLETE]: 'COMPLETE',
            [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'INCOMPLETE_ATTACHMENT',
            [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'MISSING_ATTACHMENT',
            [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'INCOMPLETE_DIMENSIONS',
            [gl.FRAMEBUFFER_UNSUPPORTED]: 'UNSUPPORTED'
        }[status] || status;

        console.log(`FBO Test ${typeName}: ${statusName}`);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(testFBO);
        gl.deleteTexture(testTex);

        return status === gl.FRAMEBUFFER_COMPLETE;
    }

    console.log('=== FBO Compatibility Tests ===');
    const supportsUnsignedByte = testFBOSupport(gl.UNSIGNED_BYTE, 'UNSIGNED_BYTE');
    const supportsHalfFloat = extHalfFloat ? testFBOSupport(extHalfFloat.HALF_FLOAT_OES, 'HALF_FLOAT') : false;
    const supportsFloat = extFloat ? testFBOSupport(gl.FLOAT, 'FLOAT') : false;

    // Choose best working type
    let finalTexType = gl.UNSIGNED_BYTE;
    let finalTypeName = 'UNSIGNED_BYTE (Fallback)';

    if (supportsHalfFloat) {
        finalTexType = extHalfFloat.HALF_FLOAT_OES;
        finalTypeName = 'HALF_FLOAT';
        useNearestFiltering = !extHalfFloatLinear;
    } else if (supportsFloat) {
        finalTexType = gl.FLOAT;
        finalTypeName = 'FLOAT';
        useNearestFiltering = !extFloatLinear;
    }

    console.log('=== Final Decision ===');
    console.log('Using:', finalTypeName);
    console.log('NEAREST filtering:', useNearestFiltering);

    // Pointers
    let pointers = [{ x: 0, y: 0, dx: 0, dy: 0, moved: false, down: false, color: [1.5, 1.5, 1.5] }];

    function getPointerPos(event) {
        const rect = canvas.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    window.addEventListener('mousemove', e => {
        const pos = getPointerPos(e);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        const t = Date.now() / 1000;
        pointers[0].color = [Math.sin(t) + 1.5, Math.sin(t + 2) + 1.5, Math.sin(t + 4) + 1.5];
    });

    window.addEventListener('touchstart', e => {
        const pos = getPointerPos(e);
        pointers[0].down = true;
        pointers[0].moved = false;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
        lastX = pointers[0].x;
        lastY = pointers[0].y;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
        const pos = getPointerPos(e);
        pointers[0].moved = pointers[0].down = true;
        pointers[0].x = pos.x;
        pointers[0].y = pos.y;
    }, { passive: true });

    window.addEventListener('touchend', () => {
        pointers[0].down = false;
        pointers[0].moved = false;
    });

    // Shaders
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
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

    const copyShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        varying vec2 vUv;
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
        varying vec2 vUv;
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

    console.log('Shaders compiled:', !!baseVertexShader, !!copyShader, !!splatShader, !!advectionShader);

    // GL Setup
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    function blit(destination) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function createProgram(fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, baseVertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
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
    const copyProgram = createProgram(copyShader);

    console.log('Programs created:', !!splatProgram, !!advectionProgram, !!copyProgram);

    // FBOs
    function createFBO(w, h, type, forceNearest) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const filterMode = forceNearest ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO creation failed! Status:', status);
        }

        return { tex, fbo, width: w, height: h };
    }

    function createDoubleFBO(w, h) {
        let fbo1 = createFBO(w, h, finalTexType, useNearestFiltering);
        let fbo2 = createFBO(w, h, finalTexType, useNearestFiltering);
        return {
            get read() { return fbo1; },
            get write() { return fbo2; },
            swap() { let temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
        };
    }

    let density, velocity;

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
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let lastFrameTime = 0;
    const frameInterval = 1000 / config.FPS_LIMIT;

    function update(currentTime) {
        requestAnimationFrame(update);

        if (!currentTime) currentTime = performance.now();
        const elapsed = currentTime - lastFrameTime;
        if (elapsed < frameInterval) return;
        lastFrameTime = currentTime - (elapsed % frameInterval);

        // FPS counter
        frameCount++;
        if (currentTime - lastFpsTime >= 2000) {
            const fps = (frameCount / ((currentTime - lastFpsTime) / 1000)).toFixed(1);
            console.log('FluidJS FPS:', fps);
            frameCount = 0;
            lastFpsTime = currentTime;
        }

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
            console.log('Canvas resized to:', targetWidth, 'x', targetHeight);
            density = createDoubleFBO(canvas.width, canvas.height);
            velocity = createDoubleFBO(canvas.width, canvas.height);
        }
    }
    window.addEventListener('resize', resize);

    console.log('=== Starting FluidJS ===');
    setTimeout(() => {
        resize();
        update();
        console.log('FluidJS initialized successfully!');
    }, 100);

})();
