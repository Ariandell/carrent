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

    // Fluid Color Palette (Slower, richer flow)
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.3, 0.2, 0.2); // Slower color shifts
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

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        vec2 uv0 = uv;

        // --- 1. PRISM (GLASS) ---
        float d = sdTriangle(uv * 2.5, 1.0);
        
        // Glass Body: Darker center, gradient edges
        float prismAlpha = smoothstep(0.01, 0.0, d); 
        
        // "Glass" Internal Gradient (fake depth)
        // Brighter near top-left (light source), darker bottom-right
        float depth = (uv.x + uv.y) * 0.5;
        
        // Specular Highlight on corner/edge
        // Sharp reflection
        float highlight = smoothstep(0.4, 0.42, 1.0 - length(uv - vec2(-0.35, 0.2)));
        
        // Internal Color Tint (Dark Blue/Black Glass)
        vec3 prismColor = vec3(0.05, 0.05, 0.08) - depth * 0.05;
        prismColor += highlight * 0.8; // Add gloss
        
        // Edges
        float edge = smoothstep(0.02, 0.01, abs(d));
        prismColor += edge * 0.3;

        // --- 2. ENTRY BEAM (Thin Laser) ---
        // Much thinner: 0.005
        float beamY = abs(uv.y + uv.x * 0.35); // Slight angle
        float entryMask = smoothstep(0.008, 0.002, beamY); 
        entryMask *= smoothstep(0.1, -0.4, uv.x); // Stop at prism
        entryMask *= smoothstep(-1.0, -0.5, uv.x); // Fade in from left
        
        // --- 3. EXIT SPECTRA (Flowing Liquid Colors) ---
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        // NO GEOMETRIC WAVES ("not wavy")
        // Instead, the COLOR itself flows
        
        // Map angle to color, but offset it with time ("flowing")
        // "Liquid" = The bands expand and contract slowly
        float flow = sin(u_time * 0.5 - radius * 2.0) * 0.1; 
        
        // The beam is straight, but the colors move
        float colorPos = (angle * 2.5) - u_time * 0.1 + flow;
        vec3 spectrum = palette(colorPos);
        
        // Beam Shape (Fan)
        // Straight cone, not wavy
        float fanMask = smoothstep(0.6, 0.0, abs(angle)); // Initial cone
        fanMask *= smoothstep(0.3, 0.5, uv.x); // Start after prism
        
        // "Caustics" texture to make it look like light interference, not just gradient
        float caustics = sin(angle * 50.0) * sin(radius * 10.0 - u_time);
        spectrum += caustics * 0.05;

        // --- COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Entry
        col += vec3(1.2) * entryMask; // Overbright white
        alpha += entryMask;

        // Prism
        if (d < 0.0) {
            col = mix(col, prismColor, 0.95);
            alpha = max(alpha, 0.95);
        }

        // Exit Spectrum (Additive)
        if (d >= 0.0) {
            col += spectrum * fanMask * 1.2; // Bright
            alpha += fanMask * 0.8;
        }

        // Vignette
        alpha *= smoothstep(1.5, 0.5, length(uv));

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
