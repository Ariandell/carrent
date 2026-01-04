// Physics-based Sparks Engine - Deep Space / Data Flow Edition
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Fixed canvas covers viewport
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-2;background:transparent;';
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

    class Particle {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;

            // "Endel" style: Very small, sharp dots
            this.size = Math.random() < 0.95 ? Math.random() * 1.5 + 0.5 : Math.random() * 2 + 1;

            // Very slow, ambient movement
            this.vx = (Math.random() - 0.5) * 0.2;
            this.vy = (Math.random() - 0.5) * 0.2;

            this.originalVx = this.vx;
            this.originalVy = this.vy;

            this.alpha = Math.random() * 0.5 + 0.1;
            this.targetAlpha = this.alpha;

            // Pulsing effect
            this.pulseSpeed = Math.random() * 0.02 + 0.005;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            // White/Grey particles for high contrast on black
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.fill();
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
        // Sparse density (Minimalist)
        const particleCount = (width * height) / 15000;
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
