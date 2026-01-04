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

    function initParticles() {
        particles = [];
        // Much lower density for "classy" look
        // 1 particle per 25000 pixels
        const densityDivisor = 25000;
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

    // Init
    resize();
    animate();

})();
