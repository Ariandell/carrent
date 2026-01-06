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

    // --- ORIGINAL UTILS (Restored) ---
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

    // --- SDF GEOMETRY (3D Prism) ---
    float sdTriPrism( vec3 p, vec2 h ) {
        vec3 q = abs(p);
        return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
    }

    mat2 rotate2d(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    float map(vec3 p) {
        // STATIC ORIENTATION (Matches reference)
        p.xy *= rotate2d(0.0); // No Z rotation
        p.yz *= rotate2d(-0.3); // Tilt forward/back
        p.xz *= rotate2d(0.7); // Rotate to show side face
        return sdTriPrism(p, vec2(1.0, 0.8)); // Compact prism
    }

    vec3 calcNormal(vec3 p) {
        float e = 0.001;
        vec2 k = vec2(1.0, -1.0);
        return normalize(k.xyy * map(p + k.xyy * e) +
                         k.yyx * map(p + k.yyx * e) +
                         k.yxy * map(p + k.yxy * e) +
                         k.xxx * map(p + k.xxx * e));
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;

        // --- 1. RESTORED LIQUID BEAM (Background) ---
        // Fan geometry
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        // Domain Warping for "Liquid" look (Original logic):
        float noiseVal = noise(uv * 4.0 + vec2(u_time * 0.2, 0.0)); 
        
        // Color calculation
        float colorIndex = (angle * 2.0) + (noiseVal * 0.5) - (u_time * 0.05);
        vec3 spectrum = palette(colorIndex);
        
        // Beam Shape Mask
        float fanMask = smoothstep(0.6, 0.1, abs(angle)); 
        fanMask *= smoothstep(0.0, 0.4, uv.x); // Fade in after prism
        
        // God rays
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 10.0, radius * 2.0 - u_time)));
        spectrum += streaks * 0.15;

        // --- 2. 3D PRISM RENDER (Foreground Object) ---
        vec3 ro = vec3(0.0, 0.0, -3.5); // Camera close
        vec3 rd = normalize(vec3(uv, 1.8)); // Field of view

        // Light setup for Glass effect
        vec3 lightPos = vec3(-2.0, 3.0, -2.0);
        
        float t = 0.0;
        float d = 0.0;
        for(int i = 0; i < 64; i++) {
            vec3 p = ro + rd * t;
            d = map(p);
            t += d;
            if(d < 0.001 || t > 10.0) break;
        }

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Draw Beam first (Background)
        col += spectrum * fanMask * 1.0;
        alpha += fanMask * 0.6;

        // Draw Entry Beam (Simple white line)
        float beamY = abs(uv.y + uv.x * 0.35); // Matched angle to original
        float entryMask = smoothstep(0.005, 0.001, beamY);
        entryMask *= smoothstep(0.1, -0.4, uv.x);
        entryMask *= smoothstep(-1.0, -0.5, uv.x);
        col += vec3(1.0) * entryMask * 3.0;
        alpha += entryMask;

        // Draw Prism
        if(t < 10.0) {
            vec3 p = ro + rd * t;
            vec3 n = calcNormal(p);
            vec3 viewDir = -rd;
            
            // --- ENHANCED GLASS MATERIAL ---
            // 1. Fresnel (Edge Glow) - Stronger
            float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 2.0);
            
            // 2. Fake Reflection (Environment)
            // Map normal to simple gradient
            float refLight = smoothstep(0.3, 0.8, n.y) * 0.5; // Top light
            float refSide = smoothstep(0.3, 0.8, -n.x) * 0.3; // Side rim
            
            // 3. Specular Highlight (Sharp)
            vec3 halfDir = normalize(normalize(lightPos - p) + viewDir);
            float spec = pow(max(dot(n, halfDir), 0.0), 32.0) * 2.0;

            // 4. Internal Volume (Darkness)
            // Fake thickness based on normal facing
            float thickness = dot(viewDir, n); 
            vec3 darkGlass = vec3(0.01, 0.01, 0.03);

            // Combine
            vec3 glassColor = darkGlass + (vec3(1.0) * fresnel * 1.5) + (vec3(1.0) * spec);
            
            // Prism occlusion logic:
            // Improve transparency: Mix beam color with glass
            // But user wants "Solid 3D Glass" look usually
            col = mix(col, glassColor, 0.95); // High opacity to hide beam behind it
            col += vec3(1.0) * fresnel * 0.5; // Add extra glow on top
            
            alpha = max(alpha, 0.95);
        }

        // Vignette
        col *= 1.0 - length(uv) * 0.3;

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

// Mobile optimization - skip frames
let frameSkip = 0;
// Only throttle on Android for Prism effect. iOS handles WebGL fine.
const isAndroidPrism = window.isAndroid && window.isAndroid();
const skipFrames = isAndroidPrism ? 2 : 0; // Render every 3rd frame on Android

function render(time) {
    // Throttle on mobile - render every 3rd frame for better scroll performance
    if (skipFrames > 0 && ++frameSkip % (skipFrames + 1) !== 0) {
        requestAnimationFrame(render);
        return;
    }

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
