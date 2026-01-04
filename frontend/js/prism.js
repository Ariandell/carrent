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

    // Fluid Color Palette (Oil/Liquid style)
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
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

        // --- 1. PRISM (STATIC GLASS) ---
        // No rotation. Just a stable, dark glass triangle.
        float d = sdTriangle(uv * 2.5, 1.0);
        
        // Glass appearance: Dark body, bright edges
        float prismAlpha = smoothstep(0.01, 0.0, d); 
        float edgeGlow = smoothstep(0.03, 0.0, abs(d)) * 0.8; 
        
        // Interior Refraction hints (subtle brightness variation inside)
        float refraction = 0.0;
        if (d < 0.0) {
            refraction = sin(uv.x * 10.0 + uv.y * 10.0) * 0.05; 
        }

        // --- 2. ENTRY BEAM (Pure White) ---
        // Coming from left (-x) hitting center (0,0)
        // Thin line, slightly glowing
        float beamY = abs(uv.y - 0.05); // Offset slightly to hit side? No, pure center hit is classic
        // Actually, classic Pink Floyd is coming from mid-left, hitting left face.
        // Let's do simple: line from x=-2.0 to x=0.0
        float entryMask = smoothstep(0.02, 0.0, abs(uv.y + uv.x * 0.3)); // Angel entry
        entryMask *= smoothstep(0.1, 0.0, uv.x + 0.3); // Cut off at prism face approx
        
        // --- 3. FLUID SPECTRA (Liquid Exit) ---
        // Fan to the right
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        // Liquid Distortion
        // Instead of straight rays, we distort the 'angle' lookup with sine waves
        float liquid = sin(radius * 4.0 - u_time * 1.5) 
                     + sin(uv.y * 10.0 + u_time) 
                     + sin((uv.x + uv.y) * 5.0);
                     
        float spreadOpacity = smoothstep(0.0, 1.0, uv.x); // Only right side
        
        // The "Color" coord based on angle + liquid distortion
        float colorPos = angle * 2.0 + liquid * 0.1 - u_time * 0.2;
        vec3 spectrum = palette(colorPos);
        
        // Limits of the fan (Confinement)
        float fanMask = smoothstep(0.8, 0.0, abs(angle)); // Within ~45 degrees
        fanMask *= smoothstep(0.2, 0.5, uv.x); // Fade in after prism
        
        // Soften and fluidize the fan mask itself
        float flowMask = fanMask * (0.8 + 0.2 * sin(radius * 10.0 - u_time * 2.0));

        // --- COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Add Entry Beam
        col += vec3(1.0) * entryMask * 2.0; // Bright white
        alpha += entryMask;

        // Add Spectrum (Behind Prism mostly, but flows out)
        col += spectrum * flowMask * 1.5;
        alpha += flowMask;

        // Draw Prism on top
        if (d < 0.0) {
            // Inside glass
            vec3 glassColor = vec3(0.02) + edgeGlow;
            col = mix(col, glassColor, 0.95); // High opacity blocking
            alpha = max(alpha, 0.9); // Ensure physical presence
        } else {
            // Edge glow only outside
             col += vec3(1.0) * edgeGlow * 0.5;
             alpha += edgeGlow * 0.5;
        }

        // Vignette edges of screen
        alpha *= smoothstep(1.8, 0.5, length(uv));

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
