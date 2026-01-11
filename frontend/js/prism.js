/**
 * PRISM SHADER v4 - Dynamic Interaction
 * Clean Apple-style design: prism on the RIGHT, text on the LEFT
 * Scroll-based parallax and opacity effects
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

// Config
const config = {
    speed: 0.6,
    intensity: 1.0
};

// Scroll tracking
let scrollProgress = 0;

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
        
        float ar = u_resolution.x / u_resolution.y;
        
        // --- PRISM POSITIONING: RIGHT SIDE OF SCREEN ---
        // On desktop: offset to the right
        // On mobile: centered but smaller
        float prismScale = ar < 1.0 ? 2.8 : 2.2;
        vec2 prismOffset = ar < 1.0 ? vec2(0.0, 0.0) : vec2(0.5, 0.0); // Right side on desktop
        
        // Parallax: prism moves UP as user scrolls DOWN
        float parallaxY = u_scroll * 0.5;
        prismOffset.y += parallaxY;
        
        // Scale gets slightly smaller as you scroll (zoom out effect)
        prismScale += u_scroll * 0.3;
        
        vec2 prismUV = (uv - prismOffset) * prismScale;
        float d = sdTriangle(prismUV, 1.0);
        
        // --- DARK GLASS PRISM ---
        vec3 prismColor = vec3(0.0);
        float prismAlpha = 0.0;
        
        if (d < 0.0) {
            // Very dark glass with subtle blue tint
            vec3 glassBase = vec3(0.015, 0.02, 0.03);
            
            float edgeDist = abs(d);
            float depth = smoothstep(0.0, 0.3, edgeDist);
            
            // Facet lighting
            float facet1 = smoothstep(0.3, 0.8, prismUV.y - prismUV.x * 0.5);
            float facet2 = smoothstep(0.3, 0.8, -prismUV.y - prismUV.x * 0.5);
            float facet3 = smoothstep(-0.5, 0.2, prismUV.x);
            
            vec3 facetColor = vec3(0.0);
            facetColor += vec3(0.03, 0.04, 0.06) * facet1 * 0.3;
            facetColor += vec3(0.025, 0.035, 0.05) * facet2 * 0.25;
            facetColor += vec3(0.035, 0.045, 0.065) * facet3 * 0.25;
            
            // Fresnel
            float fresnel = pow(1.0 - depth, 3.0);
            vec3 fresnelColor = vec3(0.06, 0.08, 0.12) * fresnel;
            
            // Edge glow - subtle cyan tint
            float edgeGlow = smoothstep(0.06, 0.0, edgeDist);
            vec3 edgeColor = vec3(0.15, 0.2, 0.25) * edgeGlow;
            
            prismColor = glassBase + facetColor + fresnelColor + edgeColor;
            prismAlpha = 0.92;
        }
        
        // Outer edge - clean white/cyan line
        float outerEdge = smoothstep(0.012, 0.0, abs(d));
        float innerEdge = smoothstep(0.022, 0.012, abs(d));
        
        vec3 edgeGlowColor = vec3(0.4, 0.5, 0.6) * outerEdge * 0.7;
        edgeGlowColor += vec3(0.25, 0.3, 0.4) * innerEdge * 0.4;
        
        if (d >= 0.0) {
            prismColor = edgeGlowColor;
            prismAlpha = outerEdge * 0.8 + innerEdge * 0.35;
        } else {
            prismColor += edgeGlowColor;
        }
        
        // --- ENTRY BEAM (from left, adjusted for new position) ---
        vec2 beamOrigin = prismOffset - vec2(0.4, 0.0);
        float beamAngle = 0.0;
        float beamY = abs(uv.y - beamOrigin.y - (uv.x - beamOrigin.x) * beamAngle);
        float entryMask = smoothstep(0.004, 0.001, beamY);
        entryMask *= smoothstep(prismOffset.x - 0.2, prismOffset.x - 0.8, uv.x);
        entryMask *= smoothstep(-1.5, prismOffset.x - 0.6, uv.x);
        
        // --- RAINBOW BEAM (exits to the right) ---
        vec2 beamCenter = prismOffset + vec2(0.1, 0.0);
        float angle = atan(uv.y - beamCenter.y, uv.x - beamCenter.x);
        float radius = length(uv - beamCenter);
        
        float noiseVal = noise(uv * 4.0 + vec2(u_time * 0.15, 0.0));
        float colorIndex = (angle * 2.5) + (noiseVal * 0.4) - (u_time * 0.04);
        vec3 spectrum = palette(colorIndex);
        
        // Narrower beam, exits to the right
        float fanMask = smoothstep(0.5, 0.15, abs(angle));
        fanMask *= smoothstep(prismOffset.x - 0.1, prismOffset.x + 0.3, uv.x);
        fanMask *= (1.0 - smoothstep(0.8, 1.5, radius)); // Fade out at distance
        
        // Streaks
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 12.0, radius * 2.0 - u_time * 0.8)));
        spectrum += streaks * 0.1;

        // --- COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Entry beam
        col += vec3(1.0) * entryMask * 2.5;
        alpha += entryMask * 0.9;

        // Rainbow (only outside prism)
        if (d >= 0.0) {
            col += spectrum * fanMask * 0.85;
            alpha += fanMask * 0.5;
        }

        // Prism on top
        col = mix(col, prismColor, prismAlpha);
        alpha = max(alpha, prismAlpha);
        
        // Fade out with scroll (prism fades as you scroll past hero)
        float scrollFade = 1.0 - smoothstep(0.3, 0.7, u_scroll);
        alpha *= scrollFade;
        
        // Vignette
        alpha *= smoothstep(2.0, 0.8, length(uv - prismOffset * 0.5));

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
const scrollUniformLocation = gl.getUniformLocation(program, "u_scroll");

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
]), gl.STATIC_DRAW);

// Canvas Styles
canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none;';

// Inject
const heroSection = document.querySelector('section');
if (heroSection) {
    if (getComputedStyle(heroSection).position === 'static') {
        heroSection.style.position = 'relative';
    }
    heroSection.style.overflow = 'hidden';
    heroSection.insertBefore(canvas, heroSection.firstChild);
}

const resolutionScale = 1.0;

function resize() {
    canvas.width = window.innerWidth * resolutionScale;
    const rawHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    canvas.height = rawHeight * resolutionScale;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Scroll tracking
window.addEventListener('scroll', () => {
    const heroHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    scrollProgress = Math.min(scrollTop / heroHeight, 1.0);
}, { passive: true });

// Render
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
