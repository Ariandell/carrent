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

    // Spectrum Palette
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // SDFs
    float sdTriangle( in vec2 p, in float r ) {
        const float k = sqrt(3.0);
        p.x = abs(p.x) - 1.0;
        p.y = p.y + 1.0/k;
        if( p.x+k*p.y > 0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
        p.x -= clamp( p.x, -2.0, 0.0 );
        return -length(p)*sign(p.y);
    }
    
    // Distance to line segment
    float sdSegment( in vec2 p, in vec2 a, in vec2 b ) {
        vec2 pa = p-a, ba = b-a;
        float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
        return length( pa - ba*h );
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

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        
        // --- 3D PYRAMID GEOMETRY ---
        // Rotated slightly
        vec2 p = uv * 2.0; // Scale up
        
        // Main Triangle Silhouette
        float d = sdTriangle(p, 1.0);
        
        // Internal Ridges (The "Y" shape of a tetrahedron)
        // Center point offset slightly to look 3D
        vec2 center = vec2(0.1, -0.1); 
        vec2 v1 = vec2(0.0, 1.0);   // Top
        vec2 v2 = vec2(0.866, -0.5); // Bottom Right
        vec2 v3 = vec2(-0.866, -0.5);// Bottom Left
        
        float ridge1 = sdSegment(p, center, v1);
        float ridge2 = sdSegment(p, center, v2);
        float ridge3 = sdSegment(p, center, v3);
        float ridges = min(min(ridge1, ridge2), ridge3);
        
        // --- COLORS & LIGHTING ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;
        
        // 1. ENTRY BEAM (Volumetric)
        float beamY = abs(uv.y - 0.05 + uv.x * 0.4); 
        float entryMask = smoothstep(0.02, 0.0, beamY) * smoothstep(0.2, -0.5, uv.x);
        // Add "fog" noise
        float fog = noise(uv * 10.0 + vec2(u_time, 0.0));
        col += vec3(0.9, 0.95, 1.0) * entryMask * (0.5 + 0.5*fog) * 1.5;
        alpha += entryMask * 0.8;

        // 2. PRISM BODY
        if (d < 0.0) {
            // Base Dark Glass
            vec3 bodyCol = vec3(0.01, 0.01, 0.02);
            
            // Facer Lighting (gradient based on ridges)
            // Determine which "sector" we are in roughly using angle
            float angle = atan(p.y - center.y, p.x - center.x);
            // Shade sectors differently to enhance 3D look
            float sector = sin(angle * 3.0);
            bodyCol += vec3(0.05) * sector; 

            // INTERNAL RAINBOW REFLECTIONS (The key request)
            // Glow near the ridges
            float ridgeGlow = smoothstep(0.1, 0.0, ridges);
            // Vary color along the ridge using distance or position
            vec3 ridgeCol = palette(length(p)*2.0 - u_time * 0.3);
            
            // Add vibrant rainbow to internal edges
            bodyCol += ridgeCol * ridgeGlow * 1.5; // High intensity
            
            col = mix(col, bodyCol, 0.98); // Solid object
            alpha = 0.98;
            
            // Edge Highlights (Outer White)
            float outerEdge = smoothstep(0.03, 0.00, abs(d));
            col += vec3(1.0) * outerEdge * 0.8;
            
            // "Caustic" bright spots inside (Reflections)
            float sparkle = smoothstep(0.98, 1.0, noise(p * 5.0 + u_time));
            col += vec3(1.0) * sparkle * 0.5 * ridgeGlow;
        }

        // 3. EXIT BEAM (Fluid Spectrum)
        if (d >= 0.0) {
            float angle = atan(uv.y, uv.x);
            float radius = length(uv);
            
            // Noise warping for liquid color
            float n = noise(uv * 3.0 + vec2(u_time * 0.1, 0.0));
            float colorMap = angle * 2.0 + n * 0.3 - u_time * 0.1;
            
            vec3 spectrum = palette(colorMap);
            
            // Cone shape
            float fan = smoothstep(0.6, 0.1, abs(angle));
            fan *= smoothstep(0.2, 0.5, uv.x); // Start after prism
            
            // Texture
            float rays = smoothstep(0.4, 0.6, noise(vec2(angle * 20.0, radius * 5.0 - u_time)));
            spectrum += rays * 0.2;
            
            col += spectrum * fan * 1.2;
            alpha += fan * 0.7;
        }
        
        // Global Vignette
        alpha *= smoothstep(1.6, 0.6, length(uv));

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
