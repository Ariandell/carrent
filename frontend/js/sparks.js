// Physics-based Sparks Engine - Deep Space / Data Flow Edition
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Fixed canvas covers viewport - STRICTLY BACKGROUND
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;background:transparent;';
    document.body.prepend(canvas);

    let particles = [];
    let width, height;

    // Theme awareness
    let particleColor = "255, 255, 255"; // RGB string for easy alpha manipulation

    function updateThemeColors() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            particleColor = "0, 0, 0";
        } else {
            particleColor = "255, 255, 255";
        }
    }

    // Listen for custom event from index.html
    window.addEventListener('themeChanged', updateThemeColors);

    // Resize & Init
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        updateThemeColors(); // Check theme on resize too
        initParticles();
    }
    window.addEventListener('resize', resize);

    class Particle {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;

            // Depth Simulation: Z-axis (0 to 1, where 1 is close, 0 is far)
            this.z = Math.random();

            // Size depends on Z (closer = bigger)
            // Range: 0.5px (far) to 2.5px (close)
            this.size = (this.z * 2) + 0.5;

            // Speed depends on Z (closer = faster parallax)
            const speedMultiplier = (this.z * 0.5) + 0.2;
            this.vx = (Math.random() - 0.5) * speedMultiplier;
            this.vy = (Math.random() - 0.5) * speedMultiplier;

            // Opacity depends on Z (closer = brighter)
            // Range: 0.1 (far) to 0.6 (close)
            this.baseAlpha = (this.z * 0.5) + 0.1;
            this.floatOffset = Math.random() * 100;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particleColor}, ${this.baseAlpha})`;
            ctx.fill();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Simple wrapping
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;

            this.draw();
        }
    }

    // --- MOUSE TRAIL ("Pearl Smoke" Effect) ---
    const mouse = { x: -1000, y: -1000, lastX: -1000, lastY: -1000 };
    let trail = [];

    window.addEventListener('mousemove', e => {
        mouse.lastX = mouse.x === -1000 ? e.clientX : mouse.x;
        mouse.lastY = mouse.y === -1000 ? e.clientY : mouse.y;
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        // Calculate velocity for "push" effect
        const dx = mouse.x - mouse.lastX;
        const dy = mouse.y - mouse.lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Only spawn if moving
        if (dist > 2) {
            // Spawn smoke
            trail.push(new SmokeParticle(mouse.x, mouse.y, dx * 0.1, dy * 0.1));
        }
    });

    class SmokeParticle {
        constructor(x, y, vx, vy) {
            this.x = x;
            this.y = y;
            this.vx = vx * 0.5; // Inertia
            this.vy = vy * 0.5;
            this.age = 0;
            this.life = 100; // Longer life (smoke lingers)
            this.size = Math.random() * 30 + 20; // Start large
            // Pearl Colors: High Lightness (85-95%), Low-Mid Saturation
            this.hue = (Date.now() / 20) % 360;
        }

        update() {
            this.age++;

            // Physics: Expand and Slow down
            this.x += this.vx;
            this.y += this.vy;

            this.vx *= 0.95; // Friction
            this.vy *= 0.95;

            this.size += 0.3; // Expand like smoke

            // Subtle drift up
            this.y -= 0.1;

            // Iridescence flow
            this.hue += 1.0;
        }

        draw(ctx) {
            const progress = this.age / this.life;
            const opacity = (1 - progress) * 0.08; // VERY faint (0.08 max)

            if (opacity <= 0) return;

            ctx.beginPath();
            // Gradient for soft smoke edge
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            // Core: White/Pearly
            grad.addColorStop(0, `hsla(${this.hue}, 60%, 95%, ${opacity})`);
            // Edge: Colored Tint (Petrol)
            grad.addColorStop(1, `hsla(${this.hue + 40}, 80%, 85%, 0)`);

            ctx.fillStyle = grad;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const densityDivisor = 25000;
        const particleCount = (width * height) / densityDivisor;

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw Ambient Dust
        particles.forEach(p => p.update());

        // Draw Pearl Smoke Trail
        trail = trail.filter(p => p.age < p.life);

        ctx.save();
        // Screen blending ensures it looks like light/smoke
        ctx.globalCompositeOperation = 'screen';
        // Blur to merge particles into fluid smoke
        ctx.filter = 'blur(12px)';

        trail.forEach(p => {
            p.update();
            p.draw(ctx);
        });

        ctx.restore();

        requestAnimationFrame(animate);
    }

    // Init
    resize();
    animate();

})();
