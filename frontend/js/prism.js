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

    // Draw a single SIMPLE & BEAUTIFUL prism layer
    // Returns: vec4(color.rgb, alpha)
    vec4 drawPrism(vec2 uv, vec2 offset, float scale, float darkness, float edgeBrightness, vec3 tintColor) {
        vec2 prismUV = (uv - offset) * scale;
        float d = sdTriangle(prismUV, 1.0);
        
        vec3 prismColor = vec3(0.0);
        float prismAlpha = 0.0;
        
        if (d < 0.0) {
            // Inside prism - soft, clean, transparent
            float edgeDist = abs(d);
            
            // Very subtle fill
            prismColor = tintColor * 0.1 * darkness;
            
            // Soft edge glow inside
            float innerGlow = smoothstep(0.0, 0.4, edgeDist);
            prismColor += tintColor * 0.2 * innerGlow * edgeBrightness;
            
            // Low alpha for readability
            prismAlpha = 0.1 + innerGlow * 0.2 * darkness;
        }
        
        // Clean, sharp edge
        float edge = smoothstep(0.015, 0.0, abs(d));
        vec3 edgeColor = tintColor * edgeBrightness * 0.8 * edge;
        
        if (d >= 0.0) {
            prismColor = edgeColor;
            prismAlpha = edge * 0.8;
        } else {
            prismColor += edgeColor;
            prismAlpha = max(prismAlpha, edge * 0.8);
        }
        
        return vec4(prismColor, prismAlpha);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        vec2 uv0 = uv;

        float ar = u_resolution.x / u_resolution.y;
        float baseScale = ar < 1.0 ? 1.8 : 1.2;
        
        // --- SINGLE MINIMALIST PRISM ---
        // Just one perfect triangle, no recursion, no depth tunnel
        
        // --- THIN PRISM WITH SUBTLE DEPTH ---
        
        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;
        
        // Configuration
        float prismWidth = 1.3; // Make it thinner (> 1.0 compresses X)
        vec2 center = vec2(0.0, -0.05);
        float mainScale = baseScale * 1.6;
        
        // 1. BACK FACE (Depth)
        // Drawn slightly opaque and offset
        vec2 backOffset = vec2(0.04, 0.02); // Shifted right/up
        vec2 backUV = (uv - center - backOffset) * mainScale;
        backUV.x *= prismWidth;
        float dBack = sdTriangle(backUV, 1.0);
        
        if (dBack < 0.0) {
            float backAlpha = 0.15;
            vec3 backCol = vec3(0.6, 0.7, 0.8) * 0.2; // Darker, bluish
            
            // Edge of back face
            float backEdge = smoothstep(0.02, 0.0, abs(dBack));
            backCol += vec3(0.5, 0.6, 0.9) * backEdge * 0.5;
            
            finalColor = backCol;
            finalAlpha = backAlpha;
        }
        
        // 2. FRONT FACE (The Main Prism)
        vec2 frontUV = (uv - center) * mainScale;
        frontUV.x *= prismWidth;
        float dFront = sdTriangle(frontUV, 1.0);
        
        if (dFront < 0.0) {
            // Glass body
            float glassAlpha = 0.08;
            // Vertical gradient
            float gradient = smoothstep(-1.0, 1.2, frontUV.y); 
            vec3 glassCol = vec3(0.95, 0.98, 1.0) * (0.1 + gradient * 0.2);
            
            // Interaction with back face (fake refraction look where they overlap)
            if (finalAlpha > 0.0) {
                 glassCol += vec3(0.1, 0.2, 0.3); // Additive darkening?
            }
            
            finalColor = mix(finalColor, glassCol, 0.6);
            finalAlpha = max(finalAlpha, glassAlpha);
        }
        
        // 3. FRONT EDGES (Bright White)
        float outlineWidth = 0.02;
        float frontEdge = smoothstep(outlineWidth + 0.005, outlineWidth, abs(dFront));
        
        // Make the corners glow more
        // Vertices of the equilateral triangle in UV space are approx:
        // Top: (0, 1), Bottom Right: (0.866, -0.5), Bottom Left: (-0.866, -0.5)
        // But we scaled X, so actual coords differ. 
        // We just use the SDF edge.
        
        vec3 edgeCol = vec3(1.0);
        finalColor = mix(finalColor, edgeCol, frontEdge);
        finalAlpha = max(finalAlpha, frontEdge);
        
        // 4. CONNECTION LINES (Depth wires)
        // Connect corners of front and back? Too complex for loopless.
        // We leave the visual separation to imply depth.
        
        // --- BEAM ALIGNMENT ---
        // We want the beam to hit the LEFT RIB (Left Edge)
        // Triangle Left Edge is roughly at x = -0.5 (scaled)
        // Let's adjust beam origin to hit that specific area.
        
        // Left side contact point approx:
        vec2 hitPoint = center + vec2(-0.35 / prismWidth, 0.0); 
        
        // Beam Line: Shifted to pass through hitPoint
        // y = k(x - hitX) + hitY
        float beamSlope = -0.35;
        float beamYVal = hitPoint.y + beamSlope * (uv.x - hitPoint.x);
        float beamDist = abs(uv.y - beamYVal);
        
        float entryMask = smoothstep(0.004, 0.001, beamDist); 
        
        // Mask the beam so it stops AT the prism (somewhat)
        // or fades into it.
        float beamFade = smoothstep(hitPoint.x + 0.1, hitPoint.x - 0.2, uv.x);
        entryMask *= beamFade;
        entryMask *= smoothstep(-1.2, -0.5, uv.x); // Fade in from far left 
        // --- SPECTRUM ORIGIN ---
        // Exit from RIGHT RIB (Right Edge)
        vec2 exitPoint = center + vec2(0.35 / prismWidth, 0.0);
        
        // Move coordinate system to exit point for the fan
        vec2 spectrumUV = uv - exitPoint;
        
        float angle = atan(spectrumUV.y, spectrumUV.x);
        float radius = length(spectrumUV);
        
        // Fix: Restore spectrum color calculation
        float noiseVal = noise(uv * 4.0 + vec2(u_time * 0.2, 0.0));
        // Use local angle for color distribution
        float colorIndex = (angle * 3.0) + (noiseVal * 0.5) - (u_time * 0.1);
        vec3 spectrum = palette(colorIndex);
        
        float baseAngle = -0.25; // Slightly more downward
        float spread = 0.6; // Much Wider fan for dramatic effect
        
        // Softer edges for a voluminous look
        float fanMask = smoothstep(baseAngle - spread - 0.2, baseAngle, angle);
        fanMask *= smoothstep(baseAngle + spread + 0.2, baseAngle, angle);
        
        // Smooth start from the prism edge
        fanMask *= smoothstep(0.0, 0.3, spectrumUV.x); 
        
        // Thicker, softer streaks instead of thin noise
        float streaks = smoothstep(0.3, 0.8, noise(vec2(angle * 5.0, radius * 1.5 - u_time * 0.8)));
        
        // Boost color vibrancy
        spectrum *= 1.5; 
        
        // Add glow core
        spectrum += vec3(0.2, 0.2, 0.4) * fanMask * 0.5;
        spectrum += streaks * 0.3; // Add streaks additively

        // --- FINAL COMPOSITION ---
        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // Entry Beam
        col += vec3(1.0) * entryMask * 2.5;
        alpha += entryMask;

        // Spectrum (behind all prisms) - Make it pop
        // Distance fade to make it look like light dissipating
        float distFade = smoothstep(3.0, 0.5, radius); 
        
        col += spectrum * fanMask * distFade * 1.2; 
        alpha += fanMask * distFade * 0.8;

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
