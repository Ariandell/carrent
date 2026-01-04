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

    // --- MOUSE TRAIL ("Petrol" Effect) ---
    const mouse = { x: -1000, y: -1000 };
    let trail = [];

    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        // Spawn trail point
        // Throttle slightly naturally by event firing rate? 
        // Actually typically it fires enough. We might want to add interpolation if it's too jerky.
        // For "subtle", just adding points is fine.
        trail.push(new TrailPoint(mouse.x, mouse.y));
    });

    class TrailPoint {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.age = 0;
            this.life = 60; // Frames to live (approx 1 sec)
            this.size = Math.random() * 20 + 10; // Soft large blob
            // Random start hue for that "oil" variety
            this.hue = (Date.now() / 10) % 360;
        }

        update() {
            this.age++;
            // Drift slightly?
            this.y -= 0.5;

            // Iridescence: Cycle hue rapidly as it ages
            this.hue += 5;
        }

        draw(ctx) {
            const progress = this.age / this.life;
            const opacity = (1 - progress) * 0.15; // VERY subtle (0.15 max)

            if (opacity <= 0) return;

            ctx.beginPath();
            // Petrol colors: Cyan, Magenta, Purple, Gold. 
            // Full HSL spectrum covers this if we have saturation.
            ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${opacity})`;
            ctx.arc(this.x, this.y, this.size * (1 - progress * 0.5), 0, Math.PI * 2);
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

        // Draw Petrol Trail
        // Filter out dead points
        trail = trail.filter(p => p.age < p.life);

        // Use blending for "glow" look
        ctx.save();
        // 'screen' or 'overlay' makes it look light and vibrant on dark bg
        // 'difference' or 'exclusion' makes it look weirdly oil-like on white.
        // Let's stick to normal or screen for safety across themes. 
        // Actually, user said "oil spilled on sun".
        ctx.globalCompositeOperation = 'screen';
        // We need blur for the "soft" feel
        ctx.filter = 'blur(8px)';

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
