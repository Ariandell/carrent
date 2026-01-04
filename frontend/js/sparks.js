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

    // --- MOUSE TRAIL ("Fluid Pearl" Effect) ---
    const mouse = { x: -1000, y: -1000, lastX: -1000, lastY: -1000 };
    let trail = [];

    window.addEventListener('mousemove', e => {
        // Init logic
        if (mouse.x === -1000) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.lastX = e.clientX;
            mouse.lastY = e.clientY;
        }

        mouse.lastX = mouse.x;
        mouse.lastY = mouse.y;
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        // INTERPOLATION: Fill gaps between frames for smooth line
        const dx = mouse.x - mouse.lastX;
        const dy = mouse.y - mouse.lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Spawn particles along the path
        const steps = Math.max(1, Math.floor(dist / 5)); // Every 5px

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const x = mouse.lastX + dx * t;
            const y = mouse.lastY + dy * t;

            // Add momentum spread
            const spreadX = (Math.random() - 0.5) * 2;
            const spreadY = (Math.random() - 0.5) * 2;

            trail.push(new PearlParticle(x, y, spreadX, spreadY));
        }
    });

    class PearlParticle {
        constructor(x, y, vx, vy) {
            this.x = x;
            this.y = y;
            // Physics: Very slow drift, mostly stays in place (air drag)
            this.vx = vx * 0.2;
            this.vy = vy * 0.2;

            this.age = 0;
            this.life = 120; // 2 seconds (lingers)
            this.size = 15; // Start small-ish
            this.maxSize = 50; // Expand huge

            // Initial Phase for color cycle
            this.phase = Math.random() * Math.PI * 2;
        }

        update() {
            this.age++;

            // Drift
            this.x += this.vx;
            this.y += this.vy;
            // Drag
            this.vx *= 0.98;
            this.vy *= 0.98;

            // Buoyancy (very slight up)
            this.y -= 0.1;

            // Expansion (Fluid diffusion)
            this.size += (this.maxSize - this.size) * 0.02;
        }

        draw(ctx) {
            const progress = this.age / this.life;
            if (progress >= 1) return;

            // Smooth fade out
            const alpha = (1 - Math.pow(progress, 3)) * 0.12; // Start at 0.12 opacity, cubic fade

            // iridescent Color Calculation
            // We want that "Oil on Water" look: Cyan -> Pink -> Gold -> Blue
            // Map progress to color spectrum

            // Pearl Palette
            // 0.0 - 0.3: Cyan/Blue
            // 0.3 - 0.6: Pink/Magenta
            // 0.6 - 1.0: Gold/Orange

            // We can use sine waves for smooth transitions
            // H: Soft shift from 200 (Blue) to 340 (Pink) to 40 (Gold)
            // Or just a cycling hue based on Phase + Age

            const hue = 200 + (progress * 200); // 200->400 (Blue -> Pink -> Gold)
            const sat = 80;
            const light = 85;

            ctx.beginPath();

            // Soft Radial Gradient for "Puff" look
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, `hsla(${hue}, ${sat}%, 95%, ${alpha})`); // Core is white-ish
            grad.addColorStop(0.5, `hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.5})`);
            grad.addColorStop(1, `hsla(${hue + 30}, ${sat}%, ${light}%, 0)`); // Edge fades out

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
