/**
 * FLUID PRISM SHADER v2 (Realism)
 * Renders a dark suspended prism with a directed spectral dispersion beam.
 */

const canvas = document.createElement('canvas');
// Enable alpha for true transparency (no mix-blend-mode needed)
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

// Config
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

    float sdTriangle( in vec2 p, in float r ) {
        const float k = sqrt(3.0);
        p.x = abs(p.x) - 1.0;
        p.y = p.y + 1.0/k;
        if( p.x+k*p.y > 0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
        p.x -= clamp( p.x, -2.0, 0.0 );
        return -length(p)*sign(p.y);
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
        vec2 uv0 = uv;

        // --- 1. DARK GLASS PRISM ---
        // Pass UV * 2.5 is okay, but we want it aspect-ratio aware so it doesn't stretch
        vec2 prismUV = uv;
        prismUV.x *= u_resolution.x / u_resolution.y; // Correct aspect ratio for shape calculation?
        // Actually, uv is already corrected by dividing by u_resolution.y in main() line 59:
        // vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        // This makes Y range [-1, 1] and X range [-ratio, ratio].
        // So a triangle defined in this space is already isotropic (not stretched).
        
        // HOWEVER, if the screen is very tall (mobile), X range is small (e.g. [-0.5, 0.5]).
        // The triangle might be clipped if it's too wide.
        
        // Let's scale the prism down on mobile (if Aspect Ratio < 1)
        float ar = u_resolution.x / u_resolution.y;
        float scale = 2.5;
        if (ar < 1.0) {
            scale = 4.0; // Make it appear smaller (inverse scale)
        }

        float d = sdTriangle(uv * scale, 1.0);
        
        // Edge: Thin, sharp white line
        float edge = smoothstep(0.04, 0.0, abs(d)); 
        
        // Interior: Dark, but not fully black (glass hint)
        // Add a subtle reflection gradient
        float reflection = smoothstep(0.5, -0.5, uv.y + uv.x) * 0.1;
        
        // --- 2. ENTRY BEAM (Laser) ---
        // Thin white line from left
        float beamY = abs(uv.y + uv.x * 0.35); 
        float entryMask = smoothstep(0.005, 0.001, beamY); 
        entryMask *= smoothstep(0.1, -0.4, uv.x); // Stop at prism
        entryMask *= smoothstep(-1.0, -0.5, uv.x); // Fade in from left
        
        // --- 3. LIQUID RAINBOW BEAM ---
        // Fan geometry
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        // Domain Warping for "Liquid" look:
        // Instead of distorting the shape, we distort the COORDINATES used for color
        // This keeps the beam shape clean but makes the inside look like oil.
        float noiseVal = noise(uv * 4.0 + vec2(u_time * 0.2, 0.0)); // Slower noise
        
        // Color depends on Angle + Noise - Time
        // This moves the colors outward and swirls them
        // SLOWED DOWN: u_time * 0.05 (was 0.2)
        float colorIndex = (angle * 2.0) + (noiseVal * 0.5) - (u_time * 0.05);
        
        vec3 spectrum = palette(colorIndex);
        
        // Beam Shape Mask (Cone)
        float fanMask = smoothstep(0.6, 0.1, abs(angle)); // Soft edges 
        fanMask *= smoothstep(0.0, 0.4, uv.x); // Fade in after prism
        
        // Add "God Ray" streaks for texture
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 10.0, radius * 2.0 - u_time)));
        spectrum += streaks * 0.15;

        // --- COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Draw Entry
        col += vec3(1.0) * entryMask * 3.0; // Hot white
        alpha += entryMask;

        // Draw Spectrum
        if (d >= 0.0) {
            col += spectrum * fanMask * 1.0; 
            alpha += fanMask * 0.6; // Semi-transparent beam
        }

        // Draw Prism Body (Occlusion)
        if (d < 0.0) {
            // Dark Glass
            col = vec3(0.02) + reflection; // Almost black + reflection
            alpha = 0.95; // Solid
             
            // Add the glowing edge ON TOP
            col += vec3(1.0) * edge;
        } else {
            // Add faint edge glow outside too
           alpha += edge * 0.1;
           col += vec3(1.0) * edge * 0.1;
        }
        
        // Vignette
        alpha *= smoothstep(1.8, 0.6, length(uv));

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
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 1.0; pointer-events: none;';

// Inject
const heroSection = document.querySelector('section');
if (heroSection) {
    // Ensure parent has logic context
    if (getComputedStyle(heroSection).position === 'static') {
        heroSection.style.position = 'relative';
    }
    heroSection.style.overflow = 'hidden';

    // Insert as FIRST child to settle behind other content (z-index -1 works relative to stacking context)
    heroSection.insertBefore(canvas, heroSection.firstChild);
}

function resize() {
    canvas.width = window.innerWidth;
    // Limit to hero height if possible, or full screen
    // Let's match the parent section height if possible, else window
    canvas.height = heroSection ? heroSection.offsetHeight : window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function render(time) {
    time *= 0.001;

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(timeUniformLocation, time * config.speed);

    // Blending is handled by pre-multiplied alpha or standard composite
    // We used alpha:true context

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
