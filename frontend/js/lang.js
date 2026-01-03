/**
 * Simple Localization Engine
 */

const lang = {
    init() {
        // Force default language since switcher is removed
        this.lang = window.CONFIG.DEFAULT_LANG;
        this.dict = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS['en'];
        this.applyConfig();
    },

    setLanguage(newLang) {
        if (!window.TRANSLATIONS[newLang]) return;

        this.lang = newLang;
        this.dict = window.TRANSLATIONS[newLang];
        CONFIG.DEFAULT_LANG = newLang;

        localStorage.setItem('app_lang', newLang);
        localStorage.setItem('lang', newLang);

        // Update <html> lang attribute
        document.documentElement.lang = newLang;

        // Refresh all text on page
        this.applyConfig();

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('langChanged', { detail: newLang }));

        // Visual feedback
        console.log('Language changed to:', newLang);
    },

    toggle() {
        const current = CONFIG.DEFAULT_LANG;
        const next = current === 'uk' ? 'en' : 'uk';
        this.setLanguage(next);
    },

    t(key) {
        const lang = CONFIG.DEFAULT_LANG;
        const dict = window.TRANSLATIONS[lang] || window.TRANSLATIONS['en'];
        return dict[key] || key;
    },

    updatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else {
                el.innerText = text;
            }
        });
    },

    updateConfigPlaceholders() {
        document.querySelectorAll('[data-config]').forEach(el => {
            const key = el.getAttribute('data-config');
            if (CONFIG[key]) {
                el.innerText = CONFIG[key];
            }
        });

    },

    applyConfig() {
        this.updatePage();
        this.updateConfigPlaceholders();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Load saved lang
    const saved = localStorage.getItem('lang');
    if (saved && window.TRANSLATIONS && window.TRANSLATIONS[saved]) {
        CONFIG.DEFAULT_LANG = saved;
    }
    window.lang = lang;
    window.t = (key) => lang.t(key); // Global translation function
    window.lang.init();
});
