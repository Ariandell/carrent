/**
 * FLUID PRISM SHADER v3 - Hybrid
 * Uses PNG image for prism + shader for liquid rainbow beams
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

const config = {
    speed: 0.8,
    intensity: 1.2
};

// Shader Source
const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    // Full Spectral Palette (Rainbow)
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // Simple noise
    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float noise(in vec2 x) {
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = p.x + p.y*57.0;
        return mix(mix(hash(n+0.0), hash(n+1.0),f.x),
                   mix(hash(n+57.0), hash(n+58.0),f.x),f.y);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        
        // Prism center position (right side)
        float ar = u_resolution.x / u_resolution.y;
        vec2 prismCenter = vec2(ar * 0.3, 0.0);
        
        // On mobile, center it
        if (ar < 1.0) {
            prismCenter = vec2(0.0, -0.1);
        }
        
        // UV relative to prism center
        vec2 beamUV = uv - prismCenter;
        
        // --- LIQUID RAINBOW BEAM ---
        float angle = atan(beamUV.y, beamUV.x);
        float radius = length(beamUV);
        
        // Domain Warping for "Liquid" look
        float noiseVal = noise(beamUV * 4.0 + vec2(u_time * 0.2, 0.0));
        
        // Color depends on Angle + Noise - Time
        float colorIndex = (angle * 2.0) + (noiseVal * 0.5) - (u_time * 0.05);
        vec3 spectrum = palette(colorIndex);
        
        // Beam Shape Mask (Cone) - only to the RIGHT of prism
        float fanMask = smoothstep(0.6, 0.1, abs(angle));
        fanMask *= smoothstep(0.0, 0.3, beamUV.x); // Fade in after prism position
        fanMask *= smoothstep(2.0, 0.3, beamUV.x); // Fade out at distance
        
        // Add "God Ray" streaks for texture
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 10.0, radius * 2.0 - u_time)));
        spectrum += streaks * 0.15;

        // --- ENTRY BEAM (thin white line from left) ---
        float beamY = abs(beamUV.y + beamUV.x * 0.1);
        float entryMask = smoothstep(0.008, 0.002, beamY);
        entryMask *= smoothstep(0.0, -0.3, beamUV.x); // Only to left of prism
        entryMask *= smoothstep(-1.5, -0.4, beamUV.x); // Fade in from far left

        // --- COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Draw Entry Beam (white)
        col += vec3(1.0) * entryMask * 2.0;
        alpha += entryMask * 0.8;

        // Draw Rainbow Spectrum
        col += spectrum * fanMask * 1.0; 
        alpha += fanMask * 0.5;
        
        // Vignette
        alpha *= smoothstep(2.0, 0.8, length(uv));

        gl_FragColor = vec4(col, alpha);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
const timeUniformLocation = gl.getUniformLocation(program, "u_time");

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
]), gl.STATIC_DRAW);

// Canvas Styles - BEHIND CONTENT
canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 1.0; pointer-events: none;';

// Create Prism Image Element
const prismImg = document.createElement('img');
prismImg.src = 'img/crystal_prism.png';
prismImg.alt = 'Crystal Prism';
prismImg.id = 'prism-image';
prismImg.style.cssText = `
    position: absolute;
    z-index: 2;
    pointer-events: none;
    width: 280px;
    height: auto;
    top: 50%;
    right: 15%;
    transform: translateY(-50%);
    filter: drop-shadow(0 0 30px rgba(255,255,255,0.1));
`;

// Inject
const heroSection = document.querySelector('section');
if (heroSection) {
    if (getComputedStyle(heroSection).position === 'static') {
        heroSection.style.position = 'relative';
    }
    heroSection.style.overflow = 'hidden';

    heroSection.insertBefore(canvas, heroSection.firstChild);
    heroSection.appendChild(prismImg);

    // Adjust prism position on mobile
    function adjustPrismPosition() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            prismImg.style.right = '50%';
            prismImg.style.transform = 'translateX(50%) translateY(-50%)';
            prismImg.style.width = '200px';
            prismImg.style.top = '60%';
        } else {
            prismImg.style.right = '15%';
            prismImg.style.transform = 'translateY(-50%)';
            prismImg.style.width = '280px';
            prismImg.style.top = '50%';
        }
    }
    adjustPrismPosition();
    window.addEventListener('resize', adjustPrismPosition);
}

// Resolution Scale
const resolutionScale = 1.0;

function resize() {
    canvas.width = window.innerWidth * resolutionScale;
    const rawHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    canvas.height = rawHeight * resolutionScale;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// FPS Throttling
const fps = 60;
const frameInterval = 1000 / fps;
let lastDrawTime = 0;

function render(currentTime) {
    requestAnimationFrame(render);

    const elapsed = currentTime - lastDrawTime;
    if (elapsed < frameInterval) return;
    lastDrawTime = currentTime - (elapsed % frameInterval);

    const timeInSeconds = currentTime * 0.001;

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(timeUniformLocation, timeInSeconds * config.speed);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
requestAnimationFrame(render);
