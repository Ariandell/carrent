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

    // Consts
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

    // Noise functions for fluid effect
    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float noise(in vec2 x) {
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = p.x + p.y*57.0;
        return mix(mix(hash(n+0.0), hash(n+1.0),f.x),
                   mix(hash(n+57.0), hash(n+58.0),f.x),f.y);
    }

    float fbm(vec2 p) {
        float f = 0.0;
        f += 0.5000*noise(p); p*=2.02;
        f += 0.2500*noise(p); p*=2.03;
        f += 0.1250*noise(p); p*=2.01;
        return f;
    }

    // Draw a beam segment
    // start: start point, dir: direction, w: width, uv: current coord
    float beam(vec2 uv, vec2 start, vec2 dir, float width, float flowSpeed) {
        vec2 p = uv - start;
        float proj = dot(p, dir);
        float dist = length(p - dir * proj);
        
        // Fluid distortion
        float fluid = fbm(uv * 10.0 - vec2(u_time * flowSpeed, 0.0));
        float warp = (fluid - 0.5) * 0.05;
        
        // Only draw forward
        float beamMask = smoothstep(0.0, 0.1, proj);
        
        // Core width
        float core = smoothstep(width + warp, width * 0.2 + warp, dist);
        
        return core * beamMask;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        float scale = 1.3; // Zoom out to fit everything
        uv *= scale;

        // --- PRISM GEOMETRY ---
        float triSize = 0.8;
        float d = sdTriangle(uv, triSize);
        
        // --- BEAM CALCS ---
        // Input Beam (White) - Incoming from Left (-1.0, -0.2) to Prism Face
        vec2 inputStart = vec2(-2.0, -0.4);
        vec2 inputHit = vec2(-0.35, -0.15); // Approximate hit point on left face
        vec2 inputDir = normalize(inputHit - inputStart);
        
        // Refraction (Fake) - Inside Beam
        vec2 innerStart = inputHit;
        vec2 innerEnd = vec2(0.35, -0.15); // Approximate exit point on right face
        vec2 innerDir = normalize(innerEnd - innerStart);
        
        // Output Beam (Rainbow) - Exiting Right
        vec2 outputStart = innerEnd;
        vec2 outputDir = vec2(0.9, -0.3); // Down-right
        
        // --- RENDERING ---
        vec3 finalColor = vec3(0.0);
        float alpha = 0.0;

        // 1. Input Beam (White) - Stops at prism face roughly
        float inBeam = beam(uv, inputStart, inputDir, 0.015, 2.0);
        // Cut off input beam inside prism logic roughly
        float hitDist = length(uv - inputHit);
        float inMask = 1.0 - smoothstep(0.0, 0.1, uv.x + 0.35); // Hard cutoff near face
        
        finalColor += vec3(1.2) * inBeam * clamp(inMask, 0.0, 1.0);
        
        // 2. Output Beam (Rainbow Spectrum)
        // We create multiple slightly offset beams for the spectrum
        vec2 p = uv - outputStart;
        float proj = dot(p, normalize(outputDir));
        
        if (proj > 0.0) {
            float distToBeam = dot(p, vec2(-outputDir.y, outputDir.x)); // Perpendicular distance
            
            // Spread factor increases with distance
            float spread = 0.1 + proj * 0.3;
            
            // Normalized position within the spread (-1 to 1)
            float t = distToBeam / spread;
            
            // Fluid warp for the rainbow
            float rainbowFluid = fbm(uv * 4.0 - vec2(u_time * 1.5, u_time * 0.2));
            float warp = (rainbowFluid - 0.5) * 0.1 * proj; // Warp increases with distance
            
            t += warp * 5.0; // Apply warp
            
            if (abs(t) < 1.0) {
                // Color palette based on position in beam
                vec3 specColor = palette(t * 0.5 + 0.5);
                
                // Intensity fade out
                float intensity = smoothstep(1.0, 0.0, abs(t));
                intensity *= smoothstep(0.0, 1.0, proj); // Fade in at start
                
                finalColor += specColor * intensity * 2.0;
            }
        }

        // 3. Prism Drawing
        // Edge Glow
        float edge = smoothstep(0.02, 0.0, abs(d));
        vec3 edgeColor = vec3(0.9, 0.95, 1.0) * edge * 2.5;
        
        // Inner Glass Fill (Subtle)
        float inner = smoothstep(0.0, -0.2, d);
        vec3 glassColor = vec3(1.0, 1.0, 1.0) * 0.05 * inner;
        
        if (d < 0.0) {
            // Inside Prism
            finalColor += glassColor;
            finalColor += edgeColor;
            
            // Internal light shaft (simple white line connecting hit points)
            float internalBeam = beam(uv, inputHit, normalize(innerEnd - inputHit), 0.02, 0.0);
            finalColor += vec3(1.0) * internalBeam * 0.5; // Faint internal beam
            
            alpha = max(alpha, 0.1); 
        } else {
            // Outside
            finalColor += edgeColor;
        }

        // Add Vignette
        float vignette = smoothstep(2.0, 0.5, length(uv * vec2(1.0, 0.8)));
        finalColor *= vignette;
        
        alpha += length(finalColor) * 0.5;

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
