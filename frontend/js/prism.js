/**
 * RECURSIVE PRISM SHADER v3 (Depth + Parallax)
 * Multiple nested prisms with scroll-based parallax effect
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

// Config
const config = {
    speed: 0.8,
    intensity: 1.2
};

// Scroll tracking for parallax
let scrollProgress = 0;

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
    uniform float u_scroll; // 0.0 to 1.0 scroll progress

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

    // Draw a single PREMIUM prism layer with elegant glass effect
    // Returns: vec4(color.rgb, alpha)
    vec4 drawPrism(vec2 uv, vec2 offset, float scale, float darkness, float edgeBrightness, vec3 tintColor) {
        vec2 prismUV = (uv - offset) * scale;
        float d = sdTriangle(prismUV, 1.0);
        
        vec3 prismColor = vec3(0.0);
        float prismAlpha = 0.0;
        
        if (d < 0.0) {
            // Inside prism - premium transparent glass
            float edgeDist = abs(d);
            float depth = smoothstep(0.0, 0.5, edgeDist);
            
            // Very subtle glass tint - almost invisible in center
            float centerTransparency = smoothstep(0.0, 0.4, edgeDist);
            vec3 glassBase = tintColor * 0.02 * (1.0 - centerTransparency * 0.8);
            
            // Soft facet lighting - subtle highlights
            float facet1 = smoothstep(0.4, 0.9, prismUV.y - prismUV.x * 0.5);
            float facet2 = smoothstep(0.4, 0.9, -prismUV.y - prismUV.x * 0.5);
            float facet3 = smoothstep(-0.4, 0.3, prismUV.x);
            
            vec3 facetColor = vec3(0.0);
            facetColor += tintColor * 0.025 * facet1 * 0.15;
            facetColor += tintColor * 0.02 * facet2 * 0.1;
            facetColor += tintColor * 0.03 * facet3 * 0.1;
            
            // Elegant Fresnel effect - bright edges
            float fresnel = pow(1.0 - depth, 4.0);
            vec3 fresnelColor = tintColor * 0.15 * fresnel * edgeBrightness;
            
            // Premium edge glow
            float edgeGlow = smoothstep(0.08, 0.0, edgeDist);
            vec3 edgeColor = tintColor * edgeBrightness * 0.4 * edgeGlow;
            
            prismColor = glassBase + facetColor + fresnelColor + edgeColor;
            // Much lower alpha in center for readability
            prismAlpha = 0.15 + fresnel * 0.35 * darkness;
        }
        
        // Sharp premium edge outline
        float outerEdge = smoothstep(0.012, 0.0, abs(d));
        float innerEdge = smoothstep(0.025, 0.012, abs(d));
        
        vec3 edgeGlowColor = tintColor * edgeBrightness * 0.6 * outerEdge;
        edgeGlowColor += tintColor * edgeBrightness * 0.2 * innerEdge;
        
        if (d >= 0.0) {
            prismColor = edgeGlowColor;
            prismAlpha = outerEdge * 0.9 + innerEdge * 0.4;
        } else {
            prismColor += edgeGlowColor;
            prismAlpha = max(prismAlpha, outerEdge * 0.8);
        }
        
        return vec4(prismColor, prismAlpha);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        vec2 uv0 = uv;

        float ar = u_resolution.x / u_resolution.y;
        float baseScale = ar < 1.0 ? 1.8 : 1.2;
        
        // Parallax offset based on scroll
        float parallaxStrength = 0.4;
        
        // Premium color gradient: Cyan -> Electric Blue -> Violet (luxury feel)
        vec3 colorFront = vec3(0.3, 0.85, 1.0);   // Electric Cyan
        vec3 colorBack = vec3(0.6, 0.2, 0.95);    // Deep Violet
        
        // --- RECURSIVE PRISMS (8 layers for elegant depth) ---
        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;
        
        const int NUM_LAYERS = 8;
        
        // Draw from back to front
        for (int i = NUM_LAYERS - 1; i >= 0; i--) {
            float t = float(i) / float(NUM_LAYERS - 1); // 0 = front, 1 = back
            float invT = 1.0 - t; // 1 = front, 0 = back
            
            // Scale: smaller as we go deeper
            float layerScale = baseScale * (1.0 + t * 3.5);
            
            // Offset: more offset for deeper layers (parallax)
            float offsetX = 0.02 + t * 0.12;
            float offsetY = -t * 0.025;
            float parallaxX = u_scroll * parallaxStrength * (0.1 + t * 1.5);
            float parallaxY = u_scroll * parallaxStrength * (0.02 + t * 0.3);
            vec2 layerOffset = vec2(offsetX + parallaxX, offsetY + parallaxY);
            
            // Brightness increases towards front
            float darkness = 0.3 + invT * 0.7;
            
            // Edge brightness: bright edges on all layers
            float edgeBright = 0.5 + invT * 0.5;
            
            // Color: smooth gradient from front to back
            vec3 layerColor = mix(colorBack, colorFront, invT);
            
            // Draw layer
            vec4 layer = drawPrism(uv, layerOffset, layerScale, darkness, edgeBright, layerColor);
            
            // Blend with depth-based alpha - more transparent layers
            float layerAlphaMultiplier = 0.15 + invT * 0.5;
            finalColor = mix(finalColor, layer.rgb, layer.a * layerAlphaMultiplier);
            finalAlpha = max(finalAlpha, layer.a * layerAlphaMultiplier * 0.7);
        }
        
        // --- ENTRY BEAM (Laser) ---
        float beamY = abs(uv.y + uv.x * 0.35); 
        float entryMask = smoothstep(0.004, 0.001, beamY); 
        entryMask *= smoothstep(0.05, -0.5, uv.x);
        entryMask *= smoothstep(-1.0, -0.5, uv.x);
        
        // --- RAINBOW BEAM ---
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        float noiseVal = noise(uv * 4.0 + vec2(u_time * 0.2, 0.0));
        float colorIndex = (angle * 2.0) + (noiseVal * 0.5) - (u_time * 0.05);
        vec3 spectrum = palette(colorIndex);
        
        float fanMask = smoothstep(0.6, 0.1, abs(angle));
        fanMask *= smoothstep(-0.05, 0.35, uv.x);
        
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 10.0, radius * 2.0 - u_time)));
        spectrum += streaks * 0.12;

        // --- FINAL COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Entry Beam
        col += vec3(1.0) * entryMask * 2.5;
        alpha += entryMask;

        // Spectrum (behind all prisms)
        col += spectrum * fanMask * 0.8; 
        alpha += fanMask * 0.5;

        // Prisms on top
        col = mix(col, finalColor, finalAlpha);
        alpha = max(alpha, finalAlpha);
        
        // Vignette
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
const scrollUniformLocation = gl.getUniformLocation(program, "u_scroll");

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

// Canvas Styles
canvas.id = 'prism-canvas';
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 1.0; pointer-events: none;';

// Inject
const heroSection = document.querySelector('section');
if (heroSection) {
    if (getComputedStyle(heroSection).position === 'static') {
        heroSection.style.position = 'relative';
    }
    heroSection.style.overflow = 'hidden';
    heroSection.insertBefore(canvas, heroSection.firstChild);
}

// Resolution Scale
const resolutionScale = 1.0;

function resize() {
    canvas.width = window.innerWidth * resolutionScale;
    const rawHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    canvas.height = rawHeight * resolutionScale;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Scroll listener for parallax
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1.0) : 0;
}, { passive: true });

// FPS Throttling
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
