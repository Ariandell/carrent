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

    // Spectral Palette (Apple-like / Endel-like fluid colors)
    vec3 palette( in float t ) {
        // High saturation, fluid brightness
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67); // RGB shift
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // SDF for Equilateral Triangle
    float sdTriangle( in vec2 p, in float r ) {
        const float k = sqrt(3.0);
        p.x = abs(p.x) - 1.0;
        p.y = p.y + 1.0/k;
        if( p.x+k*p.y > 0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
        p.x -= clamp( p.x, -2.0, 0.0 );
        return -length(p)*sign(p.y);
    }

    // 2D Rotation
    mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
    }

    void main() {
        // Normalize UV
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        vec2 uv0 = uv;

        // --- PRISM GEOMETRY ---
        // Slowly rotating prism in center
        vec2 prismUV = uv * rot(u_time * 0.1);
        float d = sdTriangle(prismUV * 2.5, 1.0); // Scale up triangle
        
        // Define the Prism Appearance (Dark, Glassy edges)
        float prismAlpha = smoothstep(0.01, 0.0, d); // 1.0 inside triangle, 0.0 outside
        float edgeGlow = smoothstep(0.02, 0.01, abs(d)) * 0.5; // Thin glow on edge
        
        // --- BEAM GEOMETRY ---
        // Beam originates from center, spreads to the right
        // Log-polar coords for "fan" shape
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        // Restrict beam to right side (-PI/6 to +PI/6 approx)
        // Add "fluid" waviness to the angle calculation
        float wave = sin(radius * 3.0 - u_time * 2.0) * 0.1;
        float beamWidth = 0.5; // Spread of the beam
        
        // Mask for the beam cone
        float beamMask = smoothstep(beamWidth, 0.0, abs(angle + wave * 0.5));
        
        // Only show beam strictly to the right (x > 0 roughly) with soft fade near center
        beamMask *= smoothstep(0.1, 0.5, uv.x);

        // --- SPECTRAL COLOR ---
        // Map color to the angle within the beam + time
        float colorPos = (angle / beamWidth) + u_time * 0.2;
        vec3 beamColor = palette(colorPos);
        
        // Add "God ray" streaks (noise lines)
        float streaks = sin(angle * 40.0 + u_time) * 0.5 + 0.5;
        beamColor += streaks * 0.2;

        // --- COMPOSITION ---
        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;

        // 1. Draw Beam
        finalColor += beamColor;
        finalAlpha += beamMask * 1.5; // Intensity
        
        // 2. Draw Prism (subtract/occlude beam behind it, or tint it?)
        // Let's make the prism dark (blocking the beam where it overlaps)
        // But add the edge glow
        
        // If pixel is inside prism...
        if (d < 0.0) {
           finalColor = vec3(0.05); // Dark glass
           finalAlpha = 0.9;        // High opacity
           finalColor += vec3(1.0) * edgeGlow; // White edges
        } else {
           // Outside prism: Just the beam
           finalAlpha *= smoothstep(1.5, 0.0, radius); // Vignette fade out
        }

        gl_FragColor = vec4(finalColor, finalAlpha);
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
