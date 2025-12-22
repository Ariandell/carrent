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

    setLanguage(lang) {
        if (!window.TRANSLATIONS[lang]) return;
        CONFIG.DEFAULT_LANG = lang;
        localStorage.setItem('app_lang', lang); // Fix storage key
        localStorage.setItem('lang', lang);     // Keep both for compatibility

        // Update <html> lang attribute
        document.documentElement.lang = lang;

        // Refresh text
        this.updatePage();

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('langChanged', { detail: lang }));
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
