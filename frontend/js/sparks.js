// Physics-based Sparks Engine - Deep Space / Data Flow Edition
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Fixed canvas covers viewport
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;background:transparent;';
    document.body.prepend(canvas);

    let particles = [];
    let width, height;

    // Mouse tracking
    let mouse = { x: null, y: null, radius: 300 };

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initParticles();
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });

    // Theme awareness
    let particleColor = "rgba(255, 255, 255, ";
    let shadowColor = "white";

    function updateThemeColors() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            particleColor = "rgba(0, 0, 0, "; // Black particles
            shadowColor = "rgba(0,0,0,0.2)";
        } else {
            particleColor = "rgba(255, 255, 255, "; // White particles
            shadowColor = "white";
        }
    }

    window.addEventListener('themeChanged', () => {
        updateThemeColors();
    });

    // Initial check
    updateThemeColors();

    class Particle {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;

            // "Endel" style: Slightly more visible now
            this.size = Math.random() < 0.95 ? Math.random() * 2 + 1 : Math.random() * 3 + 2;

            // Movement
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;

            this.originalVx = this.vx;
            this.originalVy = this.vy;

            // Higher Alpha for visibility
            this.alpha = Math.random() * 0.6 + 0.3;
            this.targetAlpha = this.alpha;

            // Pulsing effect
            this.pulseSpeed = Math.random() * 0.02 + 0.005;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            // Use global theme color
            ctx.fillStyle = particleColor + this.alpha + ")";

            // Only shadow in dark mode for glow, light mode cleaner
            if (shadowColor === "white") {
                ctx.shadowBlur = 10;
                ctx.shadowColor = shadowColor;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            ctx.shadowBlur = 0;
        }

        update() {
            // Ambient Pulse
            this.pulseOffset += this.pulseSpeed;
            // Base alpha + Sine wave modification
            this.alpha = Math.max(0, Math.min(1, this.targetAlpha + Math.sin(this.pulseOffset) * 0.15));

            // Mouse Interaction: Subtle "Magnetic" drift, not strong repulsion
            if (mouse.x != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    // Invert force for "Attraction" or keep positive for "Repulsion"
                    // Endel feels like "flow around". Let's do subtle repulsion.
                    const force = (mouse.radius - distance) / mouse.radius;
                    const strength = 0.5; // Stronger local effect, but smooth return

                    this.vx -= forceDirectionX * force * strength * 0.05;
                    this.vy -= forceDirectionY * force * strength * 0.05;
                }
            }

            this.x += this.vx;
            this.y += this.vy;

            // Damping (Return to ambient speed)
            this.vx += (this.originalVx - this.vx) * 0.05;
            this.vy += (this.originalVy - this.vy) * 0.05;

            // Screen Wrapping
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;

            this.draw();
        }
    }

    function initParticles() {
        particles = [];
        // Higher density (was 15000)
        const densityDivisor = 8000;
        const particleCount = (width * height) / densityDivisor;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => p.update());
        requestAnimationFrame(animate);
    }

    resize();
    animate();

})();
