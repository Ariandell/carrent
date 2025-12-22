// Physics-based Sparks Engine - Virtual Scroll Edition
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Fixed canvas covers viewport, but we render relative to scroll
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-2;';
    document.body.prepend(canvas);

    let particles = [];
    let width, height; // Viewport dimensions
    let worldHeight;   // Full document height
    let scrollY = 0;

    // Mouse in WORLD coordinates
    let mouse = { x: null, y: null, radius: 250 };

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        // Calculate total scrollable height
        worldHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.body.clientHeight,
            document.documentElement.clientHeight
        );

        canvas.width = width;
        canvas.height = height;

        initParticles();
    }

    // Update scroll position for render loop
    function updateScroll() {
        scrollY = window.scrollY || window.pageYOffset;
    }

    window.addEventListener('resize', resize);
    window.addEventListener('scroll', updateScroll);

    window.addEventListener('mousemove', (e) => {
        // e.pageX/Y includes scroll, so they are World Coordinates
        mouse.x = e.pageX;
        mouse.y = e.pageY;
    });

    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    function getThemeColor() {
        const style = getComputedStyle(document.documentElement);
        const color = style.getPropertyValue('--primary').trim();
        return color || '#3b82f6';
    }

    class Particle {
        constructor() {
            this.init(true);
        }

        init(randomY = false) {
            this.x = Math.random() * width;

            // Spawn anywhere in WORLD height
            this.y = randomY ? Math.random() * worldHeight : worldHeight + 10;

            this.size = Math.random() < 0.9 ? Math.random() * 2 + 0.5 : Math.random() * 4 + 2;

            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = -(Math.random() * 0.5 + 0.2);

            this.originalVx = this.vx;
            this.originalVy = this.vy;

            this.friction = 0.96;
            this.color = getThemeColor();
            this.alpha = this.size > 2 ? 0.1 + Math.random() * 0.2 : 0.3 + Math.random() * 0.5;
        }

        draw() {
            // Virtual Scroll Translation
            const screenY = this.y - scrollY;

            // Optimization: Don't draw if off-screen
            if (screenY < -50 || screenY > height + 50) return;

            ctx.beginPath();
            ctx.arc(this.x, screenY, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.alpha;

            if (this.size > 2) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.color;
            }
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        update() {
            // Physics calculated in WORLD space

            // Mouse Repulsion (World Space Check)
            if (mouse.x != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    // Drastically reduced strength for "barely noticeable" effect
                    const strength = 0.05;

                    this.vx -= forceDirectionX * force * strength;
                    this.vy -= forceDirectionY * force * strength;
                }
            }

            this.x += this.vx;
            this.y += this.vy;

            this.vx += (this.originalVx - this.vx) * 0.02;
            this.vy += (this.originalVy - this.vy) * 0.02;

            // Screen Wrapping in WORLD space
            if (this.y < -50) this.init(false); // Respawn at very bottom of document? 
            // Better: Respawn at bottom of WORLD

            // Correction: If particles float UP, they will eventually leave the top of the DOCUMENT (y < 0).
            // We want them to circle back to the bottom of the DOCUMENT.
            if (this.y < 0) {
                this.y = worldHeight;
                this.x = Math.random() * width;
            }
            if (this.x > width + 50) this.x = -50;
            if (this.x < -50) this.x = width + 50;

            this.draw();
        }
    }

    function initParticles() {
        particles = [];
        // Density based on WORLD area
        // (width * worldHeight)
        // INCREASED divisor to reduce count (was ~12000-15000)
        const densityDivisor = window.innerWidth < 768 ? 25000 : 20000;
        const particleCount = (width * worldHeight) / densityDivisor;

        // Cap max particles for performance on very long pages
        const safeCount = Math.min(particleCount, 200);

        for (let i = 0; i < safeCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
        }
        requestAnimationFrame(animate);
    }

    // Helper: Update particles if document height changes significantly (e.g. content load)
    const observer = new ResizeObserver(() => {
        let newWorldHeight = document.body.scrollHeight;
        if (Math.abs(newWorldHeight - worldHeight) > 100) {
            // Only resize if significantly different to avoid jitter
            // Or update worldHeight var without re-initing particles (but density changes)
            // Simple approach: just update var limits of wrapping
            worldHeight = newWorldHeight;
        }
    });
    observer.observe(document.body);

    window.addEventListener('themeChanged', () => {
        const newColor = getThemeColor();
        particles.forEach(p => p.color = newColor);
    });

    // Start
    updateScroll();
    resize();
    animate();

})();
