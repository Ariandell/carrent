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

    // --- UTILS ---
    mat2 rotate2d(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // --- SDF GEOMETRY ---
    // Triangular Prism SDF
    // h.x = width, h.y = height/depth
    float sdTriPrism( vec3 p, vec2 h ) {
        vec3 q = abs(p);
        return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
    }

    // Scene Distance
    float map(vec3 p) {
        // Rotate the prism slowly
        vec3 q = p;
        q.xz *= rotate2d(u_time * 0.3); 
        q.xy *= rotate2d(0.3); // Slight tilt

        // Prism dimensions
        return sdTriPrism(q, vec2(1.0, 1.5)); // Width 1.0, Length 1.5
    }

    // Normal calculation
    vec3 calcNormal(vec3 p) {
        float e = 0.001;
        vec2 k = vec2(1.0, -1.0);
        return normalize(k.xyy * map(p + k.xyy * e) +
                         k.yyx * map(p + k.yyx * e) +
                         k.yxy * map(p + k.yxy * e) +
                         k.xxx * map(p + k.xxx * e));
    }

    // --- MAIN ---
    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        
        // --- 3D CAMERA SETUP ---
        vec3 ro = vec3(0.0, 0.0, -4.0); // Camera Origin (back)
        vec3 rd = normalize(vec3(uv, 1.5)); // Ray Direction (Field of View)

        // Light setup
        vec3 lightPos = vec3(-2.0, 2.0, -3.0);
        
        // Raymarching
        float t = 0.0;
        float d = 0.0;
        int steps = 0;
        for(int i = 0; i < 64; i++) {
            vec3 p = ro + rd * t;
            d = map(p);
            t += d;
            steps = i;
            if(d < 0.001 || t > 10.0) break;
        }

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // --- PRISM RENDER ---
        if(t < 10.0) {
            vec3 p = ro + rd * t;
            vec3 n = calcNormal(p);
            vec3 lightDir = normalize(lightPos - p);
            
            // Fresnel Effect (White edges)
            // Power determines sharpness
            float fresnel = pow(1.0 + dot(rd, n), 3.0);
            
            // Specular Reflection
            vec3 ref = reflect(rd, n);
            float spec = pow(max(dot(ref, lightDir), 0.0), 16.0);

            // Glass Base Color (Dark)
            vec3 glassCol = vec3(0.05, 0.05, 0.08); 

            // Combine
            col = glassCol + vec3(1.0) * fresnel * 0.8 + vec3(1.0) * spec * 0.5;
            alpha = 0.9; // Solid glass
        }

        // --- BEAM EFFECTS (Post-Process style) ---
        // 1. White Entry Beam (Left)
        float beamY = abs(uv.y - uv.x * 0.2); // Angled line
        float entryBeam = smoothstep(0.02, 0.005, beamY) * smoothstep(0.0, -0.5, uv.x);
        col += vec3(1.0) * entryBeam * 2.0;
        alpha += entryBeam;

        // 2. Rainbow Exit Beam (Right)
        // Fan out from near center
        vec2 fanUV = uv - vec2(0.3, 0.0); // Offset origin slightly right (where prism is)
        float angle = atan(fanUV.y, fanUV.x);
        float dist = length(fanUV);

        if (fanUV.x > 0.0) { // Only right side
            float noise = sin(dist * 10.0 - u_time * 2.0) * 0.02; // Waviness
            float beamSpread = abs(angle + noise);
            
            float rainbowMask = smoothstep(0.5, 0.0, beamSpread); // Cone shape
            rainbowMask *= smoothstep(0.0, 0.5, fanUV.x); // Fade in from source

            // Spectral Color
            // Map angle to 0-1 range roughly
            float hue = (angle + 0.5); 
            vec3 spectrum = palette(hue + u_time * 0.1);

            col += spectrum * rainbowMask * 1.5; // Additive glow
            alpha += rainbowMask * 0.5;
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
