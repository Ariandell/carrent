class StarParticle {
    constructor(canvas, w, h, theme) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;

        this.x = Math.random() * w;
        this.y = Math.random() * h;

        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;

        this.size = Math.random() * 1.5 + 1.0;

        this.setTheme(theme);
    }

    setTheme(theme) {
        if (theme === 'dark') {
            // Brighter Blue/Cyan on Dark
            this.color = '#60a5fa';
        } else {
            // Google Blue on White
            this.color = '#4285F4';
        }
    }

    update(w, h, mouse) {
        this.x += this.vx;
        this.y += this.vy;

        // Mouse Repulsion
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
            const force = (150 - dist) / 150;
            const angle = Math.atan2(dy, dx);
            this.x -= Math.cos(angle) * force * 1.0;
            this.y -= Math.sin(angle) * force * 1.0;
        }

        // Wrap
        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.globalAlpha = 1.0;
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

class AntigravityEngine {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'antigravity-canvas';
        this.ctx = this.canvas.getContext('2d');

        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none';

        document.body.appendChild(this.canvas);

        this.mouse = { x: -1000, y: -1000 };
        this.particles = [];

        // Determine initial theme
        this.currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

        // Listen for theme toggle events (dispatched by theme.js)
        window.addEventListener('themeChanged', (e) => {
            this.currentTheme = e.detail;
            this.updateTheme();
        });

        // Also check if we need to poll or observe attribute changes in case event is missed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    if (this.currentTheme !== newTheme) {
                        this.currentTheme = newTheme;
                        this.updateTheme();
                    }
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });

        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        this.animate();
    }

    updateTheme() {
        this.particles.forEach(p => p.setTheme(this.currentTheme));
    }

    resize() {
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        this.init();
    }

    init() {
        this.particles = [];
        const count = Math.floor((this.w * this.h) / 8000);
        for (let i = 0; i < count; i++) {
            this.particles.push(new StarParticle(this.canvas, this.w, this.h, this.currentTheme));
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.w, this.h);

        this.particles.forEach(p => {
            p.update(this.w, this.h, this.mouse);
            p.draw();
        });

        // Draw Lines
        this.ctx.lineWidth = 0.5;
        // Line color depends on theme
        this.ctx.strokeStyle = this.currentTheme === 'dark' ? '#60a5fa' : '#4285F4';

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 120) {
                    this.ctx.globalAlpha = 1 - (dist / 120);
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const old = document.getElementById('antigravity-canvas');
    if (old) old.remove();
    new AntigravityEngine();
});
