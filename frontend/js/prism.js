/**
 * FLUID PRISM SHADER
 * A WebGL experiment rendering a dark refractive object with spectral fluid dispersion.
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');

// Config
const config = {
    speed: 0.5,
    intensity: 1.5,
    size: 1.0
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
    uniform vec2 u_mouse;

    // Fluid Color Palette
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263,0.416,0.557);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    // SDF for Triangle/Prism
    float sdEquilateralTriangle( in vec2 p, in float r ) {
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
        
        // Dynamic rotation
        float angle = u_time * 0.1;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        uv = uv * rot;

        vec3 finalColor = vec3(0.0);
        
        // Fluid Spectral Beams
        for(float i = 0.0; i < 3.0; i++) {
            // Space warping
            uv = fract(uv * 1.5) - 0.5;

            float d = length(uv) * exp(-length(uv0));

            vec3 col = palette(length(uv0) + i*.4 + u_time*.4);

            d = sin(d*8. + u_time)/8.;
            d = abs(d);

            // Glow / Beam
            d = pow(0.01 / d, 1.2);

            finalColor += col * d;
        }

        // Masking with a central dark Prism shape to anchor it
        float prism = sdEquilateralTriangle(uv0 * 2.0, 0.5); // Use unrotated UV0 for stable shape
        // Soften edges
        float mask = smoothstep(0.0, 0.1, prism); 
        
        // Invert mask to make center dark? No, we want rays COMING from it.
        // Actually the fractal above fills screen. Let's effectively vignette it.
        
        // Vignette
        float vignette = 1.0 - length(uv0 * 0.5);
        finalColor *= vignette;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Initialization
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

// Setup
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

// DOM Insertion
canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -2; opacity: 0.6; mix-blend-mode: screen; pointer-events: none;';
// We want this ONLY in the Hero section.
const heroSection = document.querySelector('section'); // Assuming first section is Hero
if (heroSection) {
    heroSection.style.position = 'relative';
    heroSection.style.overflow = 'hidden';
    heroSection.insertBefore(canvas, heroSection.firstChild);
}

// Render Loop
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight; // Or hero height
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function render(time) {
    time *= 0.001; // convert to seconds

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(timeUniformLocation, time * config.speed);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
