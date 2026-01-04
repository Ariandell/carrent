/**
 * Kinetic Typography & Scroll Reveal Engine
 * Inspired by: Endel Manifesto
 */

document.addEventListener('DOMContentLoaded', () => {
    initSmoothMain();
    initScrollReveal();
});

function initSmoothMain() {
    // Optional: Add strict smooth scrolling to the html element via JS if CSS isn't enough
    // But CSS 'scroll-behavior: smooth' usually handles anchors. 
    // For the "heavy" feel, we might want custom lenis or similar later, but starting simple.
}

function initScrollReveal() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
                // Optional: Stop observing once revealed? 
                // For "manifesto" style, we often want re-trigger or just stay visible.
                // staying visible is safer for now.
            } else {
                // To get the "fade away" effect when scrolling past, remove class?
                // entry.target.classList.remove('reveal-active');
            }
        });
    }, observerOptions);

    // split-text allows for staggered character animations if we had a library
    // For now, we look for elements with '.reveal-text'
    const revealElements = document.querySelectorAll('.reveal-text, .reveal-up, .reveal-fade');
    revealElements.forEach(el => revealObserver.observe(el));
}
