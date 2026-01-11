/**
 * 3D CRYSTAL PYRAMID SHADER
 * Realistic glass pyramid with rainbow dispersion
 * Based on Apple-style mockup
 */

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

const config = {
    speed: 0.3,
    intensity: 1.0
};

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

    // Rainbow palette
    vec3 rainbow(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
    }

    // Signed distance for 2D triangle (front face of pyramid)
    float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
        vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
        vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        float s = sign(e0.x * e2.y - e0.y * e2.x);
        vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                         vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                         vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
        return -sqrt(d.x) * sign(d.y);
    }

    // Simple noise
    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
        float ar = u_resolution.x / u_resolution.y;
        
        // Position pyramid to the right
        vec2 pyramidCenter = vec2(ar * 0.25, -0.1);
        vec2 p = uv - pyramidCenter;
        
        // Scale
        float scale = 0.7;
        if (ar < 1.0) {
            scale = 0.5;
            pyramidCenter = vec2(0.0, -0.15);
            p = uv - pyramidCenter;
        }
        p /= scale;
        
        // 3D Pyramid vertices (perspective projection)
        // Front face triangle
        vec2 apex = vec2(0.0, 0.6);
        vec2 frontLeft = vec2(-0.5, -0.4);
        vec2 frontRight = vec2(0.5, -0.4);
        
        // Side faces (visible due to 3D perspective)
        vec2 backCenter = vec2(0.0, -0.2); // Base center shifted up for 3D effect
        
        // Left face triangle
        vec2 leftBack = vec2(-0.3, -0.55);
        
        // Right face triangle  
        vec2 rightBack = vec2(0.3, -0.55);
        
        // Signed distances
        float dFront = sdTriangle(p, apex, frontLeft, frontRight);
        float dLeft = sdTriangle(p, apex, leftBack, frontLeft);
        float dRight = sdTriangle(p, apex, frontRight, rightBack);
        float dBase = sdTriangle(p, frontLeft, rightBack, frontRight);
        float dBaseLeft = sdTriangle(p, frontLeft, leftBack, rightBack);
        
        // Combine all faces
        float dPyramid = min(dFront, min(min(dLeft, dRight), min(dBase, dBaseLeft)));
        
        // Output
        vec3 col = vec3(0.0);
        float alpha = 0.0;
        
        // --- PYRAMID RENDERING ---
        if (dPyramid < 0.0) {
            // Inside pyramid
            float edgeDist = abs(dPyramid);
            
            // Different shading for each face
            vec3 faceColor = vec3(0.0);
            
            // Front face - lighter (catches light)
            if (dFront < 0.0 && dFront > dLeft && dFront > dRight) {
                float gradient = smoothstep(-0.4, 0.6, p.y);
                faceColor = mix(vec3(0.15, 0.17, 0.2), vec3(0.4, 0.45, 0.5), gradient);
                // Add subtle vertical light stripe
                float stripe = smoothstep(0.15, 0.0, abs(p.x + 0.05));
                faceColor += vec3(0.15) * stripe * gradient;
            }
            // Left face - darker
            else if (dLeft < 0.0) {
                float gradient = smoothstep(-0.5, 0.6, p.y);
                faceColor = mix(vec3(0.08, 0.09, 0.11), vec3(0.2, 0.22, 0.25), gradient);
            }
            // Right face - medium 
            else if (dRight < 0.0) {
                float gradient = smoothstep(-0.5, 0.6, p.y);
                faceColor = mix(vec3(0.1, 0.11, 0.13), vec3(0.25, 0.28, 0.32), gradient);
                // Rainbow reflection on right face
                float rainbowStrength = smoothstep(0.2, -0.2, p.y) * smoothstep(-0.1, 0.3, p.x);
                faceColor += rainbow(p.y * 0.5 + 0.5) * rainbowStrength * 0.15;
            }
            // Base faces - darkest
            else {
                faceColor = vec3(0.05, 0.06, 0.07);
            }
            
            // Edge highlights
            float edgeGlow = smoothstep(0.02, 0.0, edgeDist);
            faceColor += vec3(0.5, 0.55, 0.6) * edgeGlow * 0.5;
            
            // Internal edge lines between faces
            float frontEdge = smoothstep(0.015, 0.005, abs(dFront));
            float leftEdge = smoothstep(0.015, 0.005, abs(dLeft));
            float rightEdge = smoothstep(0.015, 0.005, abs(dRight));
            float internalEdges = max(frontEdge, max(leftEdge, rightEdge));
            faceColor += vec3(0.3, 0.35, 0.4) * internalEdges * 0.3;
            
            // Apex highlight
            float apexDist = length(p - apex);
            float apexGlow = smoothstep(0.15, 0.0, apexDist);
            faceColor += vec3(0.4, 0.45, 0.5) * apexGlow * 0.3;
            
            col = faceColor;
            alpha = 0.95;
        }
        
        // Outer edge glow
        float outerGlow = smoothstep(0.03, 0.0, dPyramid) * smoothstep(-0.02, 0.0, dPyramid);
        col += vec3(0.3, 0.35, 0.4) * outerGlow * 0.5;
        alpha = max(alpha, outerGlow * 0.3);
        
        // --- RAINBOW BEAM ---
        // Horizontal beam exiting to the right from pyramid
        vec2 beamOrigin = pyramidCenter + vec2(0.35 * scale, -0.1 * scale);
        vec2 beamUV = uv - beamOrigin;
        
        // Only render beam to the right of origin
        if (beamUV.x > 0.0) {
            // Fan angle for rainbow spread
            float beamAngle = atan(beamUV.y, beamUV.x);
            float beamDist = length(beamUV);
            
            // Rainbow spread (narrow cone)
            float spread = 0.4;
            float beamMask = smoothstep(spread, 0.0, abs(beamAngle));
            
            // Fade with distance
            beamMask *= smoothstep(2.0, 0.0, beamDist);
            // Fade in from origin
            beamMask *= smoothstep(0.0, 0.15, beamUV.x);
            
            // Rainbow color based on vertical position in beam
            float rainbowT = (beamAngle / spread) * 0.5 + 0.5;
            vec3 beamColor = rainbow(rainbowT + u_time * 0.02);
            
            // Soft glow effect
            beamMask *= 0.6;
            
            col += beamColor * beamMask;
            alpha = max(alpha, beamMask * 0.7);
        }
        
        // Subtle light beam entering pyramid from left
        vec2 entryBeamUV = uv - pyramidCenter;
        float entryAngle = atan(entryBeamUV.y + 0.1, entryBeamUV.x);
        float entryMask = smoothstep(0.02, 0.005, abs(entryAngle + 0.1));
        entryMask *= smoothstep(-0.3 * scale, -0.05 * scale, entryBeamUV.x);
        entryMask *= smoothstep(-1.5, -0.4, entryBeamUV.x);
        col += vec3(0.8, 0.85, 0.9) * entryMask * 0.3;
        alpha = max(alpha, entryMask * 0.2);
        
        // Vignette
        alpha *= smoothstep(2.0, 0.8, length(uv));
        
        gl_FragColor = vec4(col, alpha);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Prism shader error:', gl.getShaderInfoLog(shader));
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

// Full resolution for quality
const resolutionScale = 1.0;

function resize() {
    canvas.width = window.innerWidth * resolutionScale;
    const rawHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
    canvas.height = rawHeight * resolutionScale;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Animation
const fps = 60;
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

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
requestAnimationFrame(render);
