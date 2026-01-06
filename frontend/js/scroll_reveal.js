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
            // 1. Clear content
            const rawText = this.el.textContent;
            this.el.innerHTML = '';
            this.chars = [];

            // 2. Split by spaces to preserve words
            // We use a regex to capture spaces so we can reconstruct the layout
            const words = rawText.split(/(\s+)/);

            words.forEach(wordStr => {
                if (wordStr.trim().length === 0) {
                    // It's whitespace
                    const space = document.createElement('span');
                    space.innerHTML = '&nbsp;';
                    // Spaces don't need physics usually, or they can just sit there
                    this.el.appendChild(space);
                    return;
                }

                // Create a wrapper for the word to keep it together
                const wordSpan = document.createElement('span');
                wordSpan.style.display = 'inline-block';
                wordSpan.style.whiteSpace = 'nowrap'; // Prevent breaking inside the word

                // Now split the word into chars
                const charsInWord = Array.from(wordStr);

                charsInWord.forEach(char => {
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.style.display = 'inline-block';
                    span.style.transition = 'transform 0.1s linear, opacity 0.1s linear';
                    span.style.willChange = 'transform, opacity';

                    // Random seed for this char
                    span.dataset.seed = Math.random();

                    wordSpan.appendChild(span);
                    this.chars.push(span);
                });

                this.el.appendChild(wordSpan);
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
                // > 0.85 (Enters from bottom): Scattered, transparent.
                // 0.25 - 0.75 (Wide Readability Zone): Perfectly static.
                // < 0.25 (Leaving top): Floats up into space.

                let x = 0;
                let y = 0;
                let r = 0;
                let opacity = 1;
                let blur = 0;

                // 1. ENTERING (Bottom)
                if (normPos > 0.75) {
                    const t = (normPos - 0.75) / 0.25; // 0 to 1

                    // Scatter downwards and outwards
                    // Reduced X scatter on mobile to prevent overflow (was 150)
                    const xMult = isMobile ? 40 : 150;
                    x = (seed - 0.5) * xMult * t;
                    y = t * 150; // Fly in from below
                    r = (seed - 0.5) * 60 * t;
                    opacity = 1 - t; // Fade in
                    blur = t * 12;
                }
                // 2. LEAVING (Top)
                else if (normPos < 0.25) {
                    const t = (0.25 - normPos) / 0.25; // 0 to 1 as it goes up

                    // Float up (Anti-gravity) - Stronger lift off
                    // Non-linear easeIn for "detachment" feel
                    const easeT = t * t;

                    y = -easeT * 400 * (0.5 + seed); // Fly UP fast
                    const xMult = isMobile ? 30 : 100; // Drift sideways (reduced on mobile)
                    x = (seed - 0.5) * xMult * easeT;
                    opacity = 1 - (t * 0.8); // Fade out slowly
                    r = (seed - 0.5) * 45 * easeT; // Gentle spin
                    blur = t * 4; // Slight blur
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
        // Run full FPS on all devices for maximum smoothness
        // Since Fluid effect is disabled on mobile, we have GPU budget for this
        gravityElements.forEach(el => el.update());
        requestAnimationFrame(loop);
    }

    // Start loop
    loop();
}
