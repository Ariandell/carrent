/**
 * PRISM SHADER v5 - Premium Apple-Style
 * Prism FAR RIGHT, premium glass look, no text overlap
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

const config = {
    speed: 0.5,
    intensity: 1.0
};

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
        
        // === PRISM POSITION: FAR RIGHT ===
        // Desktop: much further right to avoid text
        // Mobile: centered
        float prismScale = ar < 1.0 ? 3.0 : 2.5;
        vec2 prismOffset = ar < 1.0 ? vec2(0.0, 0.05) : vec2(ar * 0.35, 0.0);
        
        // Subtle parallax
        prismOffset.y += u_scroll * 0.3;
        
        vec2 prismUV = (uv - prismOffset) * prismScale;
        float d = sdTriangle(prismUV, 1.0);
        
        // === PREMIUM GLASS PRISM ===
        vec3 prismColor = vec3(0.0);
        float prismAlpha = 0.0;
        
        if (d < 0.0) {
            float edgeDist = abs(d);
            float depth = smoothstep(0.0, 0.35, edgeDist);
            
            // Multi-layer glass effect
            // Layer 1: Deep black base
            vec3 glassBase = vec3(0.008, 0.01, 0.015);
            
            // Layer 2: Faceted reflections (3D effect)
            float facetTop = smoothstep(0.2, 0.9, prismUV.y - prismUV.x * 0.5);
            float facetBottom = smoothstep(0.2, 0.9, -prismUV.y - prismUV.x * 0.5);
            float facetRight = smoothstep(-0.6, 0.3, prismUV.x);
            
            vec3 facetColor = vec3(0.0);
            facetColor += vec3(0.025, 0.03, 0.04) * facetTop * 0.5;      // Top face - lighter
            facetColor += vec3(0.015, 0.02, 0.025) * facetBottom * 0.4;  // Bottom face - darker
            facetColor += vec3(0.02, 0.025, 0.035) * facetRight * 0.35;  // Right face
            
            // Layer 3: Internal caustics/reflections
            float caustic = noise(prismUV * 5.0 + u_time * 0.08) * 0.03;
            caustic += noise(prismUV * 8.0 - u_time * 0.05) * 0.02;
            vec3 causticColor = vec3(0.04, 0.05, 0.07) * caustic;
            
            // Layer 4: Fresnel rim (edges glow more)
            float fresnel = pow(1.0 - depth, 4.0);
            vec3 fresnelColor = vec3(0.08, 0.1, 0.15) * fresnel;
            
            // Layer 5: Specular highlight (top-left light source)
            vec2 lightDir = normalize(vec2(-0.7, 0.7));
            float specular = pow(max(0.0, dot(normalize(prismUV), lightDir)), 48.0);
            vec3 specularColor = vec3(0.4, 0.45, 0.55) * specular * 0.5;
            
            // Layer 6: Edge highlight (premium glass rim)
            float edgeHighlight = smoothstep(0.05, 0.0, edgeDist);
            vec3 edgeColor = vec3(0.25, 0.3, 0.4) * edgeHighlight;
            
            // Combine all layers
            prismColor = glassBase + facetColor + causticColor + fresnelColor + specularColor + edgeColor;
            
            // Subtle rainbow at very edge (chromatic aberration)
            float chromatic = smoothstep(0.03, 0.0, edgeDist);
            prismColor += palette(prismUV.x * 0.3 + prismUV.y * 0.2 + u_time * 0.02) * chromatic * 0.05;
            
            prismAlpha = 0.95;
        }
        
        // Edge outline - clean and sharp
        float outerEdge = smoothstep(0.008, 0.0, abs(d));
        float midEdge = smoothstep(0.016, 0.008, abs(d));
        float innerEdge = smoothstep(0.025, 0.016, abs(d));
        
        vec3 edgeGlowColor = vec3(0.5, 0.55, 0.65) * outerEdge * 0.8;  // Bright outer
        edgeGlowColor += vec3(0.3, 0.35, 0.45) * midEdge * 0.5;        // Mid glow
        edgeGlowColor += vec3(0.15, 0.2, 0.28) * innerEdge * 0.3;      // Soft inner
        
        if (d >= 0.0) {
            prismColor = edgeGlowColor;
            prismAlpha = outerEdge * 0.9 + midEdge * 0.5 + innerEdge * 0.25;
        } else {
            prismColor += edgeGlowColor * 0.5;
        }
        
        // === ENTRY BEAM ===
        float beamCenterY = prismOffset.y;
        float beamY = abs(uv.y - beamCenterY);
        float entryMask = smoothstep(0.003, 0.0008, beamY);
        entryMask *= smoothstep(prismOffset.x - 0.15, prismOffset.x - 0.6, uv.x);
        entryMask *= smoothstep(-1.2, prismOffset.x - 0.5, uv.x);
        
        // === RAINBOW BEAM ===
        vec2 beamOrigin = prismOffset + vec2(0.05, 0.0);
        float angle = atan(uv.y - beamOrigin.y, uv.x - beamOrigin.x);
        float radius = length(uv - beamOrigin);
        
        float noiseVal = noise(uv * 3.5 + vec2(u_time * 0.12, 0.0));
        float colorIndex = (angle * 2.2) + (noiseVal * 0.35) - (u_time * 0.03);
        vec3 spectrum = palette(colorIndex);
        
        // Even narrower fan, exiting right
        float fanAngle = 0.35; // Narrow spread
        float fanMask = smoothstep(fanAngle, fanAngle * 0.3, abs(angle));
        fanMask *= smoothstep(prismOffset.x - 0.05, prismOffset.x + 0.2, uv.x);
        fanMask *= smoothstep(1.2, 0.3, radius);
        
        // God rays
        float streaks = smoothstep(0.35, 0.65, noise(vec2(angle * 15.0, radius * 1.5 - u_time * 0.6)));
        spectrum += streaks * 0.08;
        
        // Soften spectrum colors
        spectrum *= 0.85;

        // === FINAL COMPOSITION ===
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Entry beam (thin white line)
        col += vec3(1.0) * entryMask * 2.0;
        alpha += entryMask * 0.85;

        // Rainbow (only outside prism, softer)
        if (d >= 0.0) {
            col += spectrum * fanMask * 0.75;
            alpha += fanMask * 0.45;
        }

        // Prism on top
        col = mix(col, prismColor, prismAlpha);
        alpha = max(alpha, prismAlpha);
        
        // Scroll fade
        float scrollFade = 1.0 - smoothstep(0.25, 0.6, u_scroll);
        alpha *= scrollFade;
        
        // Vignette centered on prism
        alpha *= smoothstep(1.6, 0.6, length(uv - prismOffset));

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

canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none;';

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

window.addEventListener('scroll', () => {
    const heroHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    scrollProgress = Math.min(scrollTop / heroHeight, 1.0);
}, { passive: true });

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
