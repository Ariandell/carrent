/**
 * Kinetic Typography & Scroll Reveal Engine
 * "Anti-Gravity" Effect: Text assembles from chaos, stabilizes, then floats away.
 */

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initGravityTypography();
});

// --- STANDARD REVEAL (Legacy/Simple) ---
function initScrollReveal() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-text, .reveal-up, .reveal-fade');
    revealElements.forEach(el => revealObserver.observe(el));
}

// --- GRAVITY TYPOGRAPHY ENGINE ---
function initGravityTypography() {
    let gravityElements = [];

    class GravityText {
        constructor(el) {
            this.el = el;
            this.chars = [];
            this.splitText();
        }

        splitText() {
            // 1. Get raw text validation
            // If the element has children (like translation replacements), we need to be careful.
            // But we assume .gravity-text is a leaf node container for text.
            const rawText = this.el.textContent;
            this.el.innerHTML = '';
            this.chars = [];

            // 2. Wrap each char
            // Using Array.from to handle unicode properly
            const charsArray = Array.from(rawText);

            charsArray.forEach((char, i) => {
                const span = document.createElement('span');
                span.textContent = char;
                span.style.display = 'inline-block';
                span.style.transition = 'transform 0.1s linear, opacity 0.1s linear';
                span.style.willChange = 'transform, opacity';

                if (char === ' ') {
                    span.innerHTML = '&nbsp;';
                }

                // Random seed for this char (consistent for this instance)
                span.dataset.seed = Math.random();

                this.el.appendChild(span);
                this.chars.push(span);
            });
        }

        update() {
            const rect = this.el.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            const center = viewHeight / 2;

            // Normalized position: 0 = center, 1 = bottom edge, -1 = top edge
            // Actually let's do:
            // 0 = top of screen
            // 1 = bottom of screen
            // 0.5 = center

            // Calculate center of element relative to screen
            const elCenter = rect.top + rect.height / 2;
            const normPos = elCenter / viewHeight;

            this.chars.forEach((char, i) => {
                const seed = parseFloat(char.dataset.seed);

                // LOGIC:
                // > 0.8 (Entering from bottom): Scattered, transparent
                // 0.4 - 0.6 (Center): Clean
                // < 0.2 (Leaving to top): Floating up

                let x = 0;
                let y = 0;
                let r = 0;
                let opacity = 1;
                let blur = 0;

                // 1. ENTERING (Bottom)
                if (normPos > 0.6) {
                    const t = (normPos - 0.6) / 0.4; // 0 to 1

                    // Scatter downwards and outwards
                    x = (seed - 0.5) * 100 * t;
                    y = t * 200; // Fly in from below
                    r = (seed - 0.5) * 90 * t;
                    opacity = 1 - t;
                    blur = t * 10;
                }
                // 2. LEAVING (Top)
                else if (normPos < 0.4) {
                    const t = (0.4 - normPos) / 0.4; // 0 to 1 as it goes up

                    // Float up (Anti-gravity)
                    y = -t * 300 * (0.8 + seed); // Different speeds
                    x = (seed - 0.5) * 50 * t; // Slight drift
                    opacity = 1 - (t * 1.5); // Fade out
                    r = (seed - 0.5) * 20 * t;
                    blur = t * 5;
                }

                // Apply
                char.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`;
                char.style.opacity = Math.max(0, Math.min(1, opacity));
                char.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
            });
        }
    }

    // Initialize logic
    function setup() {
        gravityElements = [];
        document.querySelectorAll('.gravity-text').forEach(el => {
            gravityElements.push(new GravityText(el));
        });
    }

    // Run setup initially
    setup();

    // Re-run on language change
    window.addEventListener('langChanged', () => {
        // Wait for config.js/lang.js to replace innerHTML with new string
        setTimeout(() => {
            setup();
        }, 50);
    });

    // Animation Loop
    function loop() {
        gravityElements.forEach(el => el.update());
        requestAnimationFrame(loop);
    }

    // Start loop
    loop();
}
