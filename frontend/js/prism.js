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

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        vec2 uv0 = uv;

        // --- PRISM SETUP ---
        // Shift prism to the right side (Variant 1: Minimalist Elegance)
        float ar = u_resolution.x / u_resolution.y;
        
        // Offset UV to move prism right
        vec2 prismUV = uv;
        prismUV.x -= ar * 0.35; // Move right (positive offset moves left in UV space, so negative moves right)
        
        float scale = 2.5;
        if (ar < 1.0) {
            scale = 4.0; // Make it appear smaller on mobile
            prismUV.x -= 0.0; // Center on mobile
        }

        float d = sdTriangle(prismUV * scale, 1.0);
        
        // --- 1. PREMIUM GLASS PRISM ---
        vec3 prismColor = vec3(0.0);
        float prismAlpha = 0.0;
        
        if (d < 0.0) {
            // Inside the prism - create 3D glass effect
            
            // Base glass color - DARK glass with subtle blue tint
            vec3 glassBase = vec3(0.02, 0.025, 0.035);
            
            // Calculate distance from edges for depth effect
            float edgeDist = abs(d);
            float depth = smoothstep(0.0, 0.3, edgeDist);
            
            // Create 3D facets - simulate light hitting different faces
            vec2 facetUV = prismUV * scale;
            float facet1 = smoothstep(0.3, 0.8, facetUV.y - facetUV.x * 0.5);
            float facet2 = smoothstep(0.3, 0.8, -facetUV.y - facetUV.x * 0.5);
            float facet3 = smoothstep(-0.5, 0.2, facetUV.x);
            
            // Combine facets for 3D appearance - DARKER values
            vec3 facetColor = vec3(0.0);
            facetColor += vec3(0.04, 0.05, 0.07) * facet1 * 0.4;
            facetColor += vec3(0.03, 0.04, 0.06) * facet2 * 0.3;
            facetColor += vec3(0.05, 0.06, 0.08) * facet3 * 0.3;
            
            // Add subtle internal reflections - reduced
            float internalReflection = noise(facetUV * 3.0 + u_time * 0.1) * 0.05;
            facetColor += internalReflection;
            
            // Fresnel effect - edges are more reflective but darker
            float fresnel = pow(1.0 - depth, 3.0);
            vec3 fresnelColor = vec3(0.08, 0.10, 0.14) * fresnel;
            
            // Specular highlights on glass surface - reduced intensity
            vec2 lightDir = normalize(vec2(-0.5, 0.8));
            float specular = pow(max(0.0, dot(normalize(facetUV), lightDir)), 32.0);
            vec3 specularColor = vec3(0.3, 0.35, 0.4) * specular * 0.4;
            
            // Edge highlights - subtle bright rims
            float edgeGlow = smoothstep(0.08, 0.0, edgeDist);
            vec3 edgeColor = vec3(0.2, 0.25, 0.3) * edgeGlow;
            
            // Combine all glass effects
            prismColor = glassBase + facetColor + fresnelColor + specularColor + edgeColor;
            
            // Add chromatic aberration hint at edges - reduced
            float chromaticEdge = smoothstep(0.05, 0.0, edgeDist);
            prismColor += palette(facetUV.x * 0.5 + facetUV.y * 0.3) * chromaticEdge * 0.08;
            
            prismAlpha = 0.95;
        }
        
        // Outer edge glow - subtle glass outline
        float outerEdge = smoothstep(0.015, 0.0, abs(d));
        float innerEdge = smoothstep(0.025, 0.015, abs(d));
        
        // Multi-layer edge for depth - DARKER
        vec3 edgeGlowColor = vec3(0.3, 0.35, 0.4) * outerEdge * 0.8;
        edgeGlowColor += vec3(0.2, 0.25, 0.3) * innerEdge * 0.5;
        
        if (d >= 0.0) {
            prismColor = edgeGlowColor;
            prismAlpha = outerEdge * 0.9 + innerEdge * 0.4;
        } else {
            prismColor += edgeGlowColor;
        }
        
        // --- 2. ENTRY BEAM (Laser) ---
        // Beam enters from LEFT, hits prism on RIGHT
        float beamY = abs(prismUV.y + prismUV.x * 0.35); 
        float entryMask = smoothstep(0.005, 0.001, beamY); 
        entryMask *= smoothstep(0.1, -0.4, prismUV.x); // Stop at prism
        entryMask *= smoothstep(-1.0, -0.5, prismUV.x); // Fade in from left
        
        // --- 3. LIQUID RAINBOW BEAM ---
        // Use prismUV for beam positioning
        float angle = atan(prismUV.y, prismUV.x);
        float radius = length(prismUV);
        
        // Domain Warping for "Liquid" look
        float noiseVal = noise(prismUV * 4.0 + vec2(u_time * 0.2, 0.0));
        float colorIndex = (angle * 2.0) + (noiseVal * 0.5) - (u_time * 0.05);
        vec3 spectrum = palette(colorIndex);
        
        // Beam Shape Mask (Cone)
        float fanMask = smoothstep(0.6, 0.1, abs(angle));
        fanMask *= smoothstep(0.0, 0.4, prismUV.x); // Fade in after prism
        
        // Add "God Ray" streaks
        float streaks = smoothstep(0.4, 0.6, noise(vec2(angle * 10.0, radius * 2.0 - u_time)));
        spectrum += streaks * 0.15;

        // --- FINAL COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Draw Entry Beam
        col += vec3(1.0) * entryMask * 3.0;
        alpha += entryMask;

        // Draw Spectrum (only outside prism)
        if (d >= 0.0) {
            col += spectrum * fanMask * 1.0; 
            alpha += fanMask * 0.6;
        }

        // Draw Prism (on top of everything behind it)
        col = mix(col, prismColor, prismAlpha);
        alpha = max(alpha, prismAlpha);
        
        // Vignette
        alpha *= smoothstep(1.8, 0.6, length(uv));

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

// Resolution Scale - Full resolution for smooth anti-aliased edges
const resolutionScale = 1.0;

function resize() {
    // Set internal resolution lower than screen
    canvas.width = window.innerWidth * resolutionScale;
    // Limit to hero height if possible, or full screen
    const rawHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    canvas.height = rawHeight * resolutionScale;

    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// FPS Throttling
const fps = 30; // Cap at 30 FPS for background effects
const frameInterval = 1000 / fps;
let lastDrawTime = 0;

function render(currentTime) {
    requestAnimationFrame(render);

    // Throttle FPS
    const elapsed = currentTime - lastDrawTime;
    if (elapsed < frameInterval) return;

    // Adjust lastDrawTime to snap to grid (keeps smooth cadence)
    lastDrawTime = currentTime - (elapsed % frameInterval);

    // Convert to seconds for shader
    const timeInSeconds = currentTime * 0.001;

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(timeUniformLocation, timeInSeconds * config.speed);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
requestAnimationFrame(render);
