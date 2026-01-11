/**
 * RECURSIVE PRISM SHADER v3 (Depth + Parallax)
 * Multiple nested prisms with scroll-based parallax effect
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

// Config
const config = {
    speed: 0.8,
    intensity: 1.2
};

// Scroll tracking for parallax
let scrollProgress = 0;

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
    uniform float u_scroll;

    #define PI 3.14159265359

    // Spectral Palette
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // SDF Triangle
    float sdTriangle( in vec2 p, in float r ) {
        const float k = sqrt(3.0);
        p.x = abs(p.x) - r;
        p.y = p.y + r/k;
        if( p.x+k*p.y > 0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
        p.x -= clamp( p.x, -2.0*r, 0.0 );
        return -length(p)*sign(p.y);
    }

    // Noise
    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float noise(in vec2 x) {
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = p.x + p.y*57.0;
        return mix(mix(hash(n+0.0), hash(n+1.0),f.x),
                   mix(hash(n+57.0), hash(n+58.0),f.x),f.y);
    }

    // Simple Line Beam (for Input)
    float beam(vec2 uv, vec2 start, vec2 dir, float width) {
        vec2 p = uv - start;
        float proj = dot(p, dir);
        float dist = length(p - dir * proj);
        
        // Slight noise for consistency
        float warp = (noise(uv * 10.0 + u_time) - 0.5) * 0.01;
        
        float beamMask = smoothstep(0.0, 0.1, proj);
        float core = smoothstep(width + warp, width * 0.2 + warp, dist);
        return core * beamMask;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        float scale = 1.3;
        uv *= scale;

        // --- PRISM GEOMETRY ---
        float triSize = 0.8;
        float d = sdTriangle(uv, triSize);

        // --- INPUT BEAM (White Laser) ---
        // NEW: Aim for center/upper part of left edge for "aesthetic entry"
        // Previous hit: (-0.35, -0.15). Tri left edge is roughly x=-0.4 at y=0.
        
        vec2 inputStart = vec2(-2.5, -0.2); // Raised start
        vec2 inputHit = vec2(-0.41, 0.05);  // Hitting the "Rib" (Refined Edge)
        vec2 inputDir = normalize(inputHit - inputStart);
        
        float inBeam = beam(uv, inputStart, inputDir, 0.012);
        
        // Cut off beam when it hits/enters the prism
        float inMask = smoothstep(0.05, -0.05, d); 
        inMask *= step(uv.x, -0.38); // Clip at edge

        vec3 finalColor = vec3(0.0);
        float alpha = 0.0;

        finalColor += vec3(1.1) * inBeam * clamp(inMask, 0.0, 1.0);

        // --- OUTPUT BEAM (Hyper Fluid Horizontal) ---
        // Origin: Approx right face
        vec2 fanOrigin = vec2(0.38, -0.2); 
        vec2 fanUV = uv - fanOrigin;

        float angle = atan(fanUV.y, fanUV.x);
        float radius = length(fanUV);

        // "Hyperscale" Fluid Logic
        // Bigger, bolder flow
        float flowX = fanUV.x * 1.8 - u_time * 0.6; // Faster, larger waves
        float noiseVal = noise(vec2(flowX, fanUV.y * 2.0)); // Lower freq Y for "fatter" liquid
        
        // Intensity of color shifting
        float colorIndex = (angle * 2.0) + (noiseVal * 0.8) - (u_time * 0.25);
        vec3 spectrum = palette(colorIndex);

        // Masking: Strictly Horizontal
        float fanDir = 0.0; 
        float fanWidth = 0.28; // Slightly wider to show off the fluid
        
        float fanMask = smoothstep(fanWidth, 0.05, abs(angle - fanDir));
        fanMask *= smoothstep(0.0, 0.15, fanUV.x); 
        fanMask *= smoothstep(0.0, 0.4, radius);

        // "Thick" Streaks
        // Layering two noise patterns for complexity
        float broadStreaks = smoothstep(0.2, 0.8, noise(vec2(flowX * 1.5, fanUV.y * 4.0)));
        float fineStreaks = smoothstep(0.4, 0.6, noise(vec2(flowX * 3.0 + 5.0, fanUV.y * 10.0)));
        
        spectrum += broadStreaks * 0.5; // Big chunks of light
        spectrum += fineStreaks * 0.2;  // Detailed sparkles
        
        // Combine Output
        // Boost brightness for "Bigger" feel
        finalColor += spectrum * fanMask * 2.2;

        // --- PRISM RENDER (Glass Style) ---
        if (d < 0.0) {
            // INSIDE
            float dist = abs(d);
            
            // Subtle Fill
            finalColor += vec3(1.0) * 0.03 * smoothstep(0.0, 0.5, dist);
            
            alpha = 0.05; 
        }
        
        // --- THIN GLASS EDGE ---
        float edgeWidth = 0.008; 
        float edgeGlow = smoothstep(edgeWidth, 0.0, abs(d));
        float edgeBloom = smoothstep(0.04, 0.0, abs(d)) * 0.5;
        
        vec3 edgeCol = vec3(0.95, 0.98, 1.0);
        finalColor += edgeCol * (edgeGlow * 1.5 + edgeBloom * 0.3);

        // --- VIGNETTE ---
        float vignette = smoothstep(2.2, 0.8, length(uv));
        finalColor *= vignette;

        alpha += length(finalColor) * 0.4;
        
        gl_FragColor = vec4(finalColor, alpha);
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
const scrollUniformLocation = gl.getUniformLocation(program, "u_scroll");

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

// Canvas Styles
canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 1.0; pointer-events: none;';

// Inject
const heroSection = document.querySelector('section');
if (heroSection) {
    if (getComputedStyle(heroSection).position === 'static') {
        heroSection.style.position = 'relative';
    }
    heroSection.style.overflow = 'hidden';
    heroSection.insertBefore(canvas, heroSection.firstChild);
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

// Scroll listener for parallax
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1.0) : 0;
}, { passive: true });

// FPS Throttling
const fps = 30;
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
    gl.uniform1f(scrollUniformLocation, scrollProgress);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
requestAnimationFrame(render);
