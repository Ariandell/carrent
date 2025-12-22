// Theme Logic
(function () {
    let mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function getSystemTheme() {
        return mediaQuery.matches ? 'dark' : 'light';
    }

    function applyTheme(mode) {
        let targetTheme = mode;

        if (mode === 'system') {
            targetTheme = getSystemTheme();
            // Add listener if system
            mediaQuery.addEventListener('change', handleSystemChange);
        } else {
            // Remove listener if explicit
            mediaQuery.removeEventListener('change', handleSystemChange);
        }

        if (targetTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.setAttribute('data-theme', targetTheme);
            document.documentElement.classList.add('dark');
        }
        localStorage.setItem('theme_preference', mode);

        // Notify UI
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { mode, resolved: targetTheme } }));
    }

    function handleSystemChange(e) {
        // Only trigger if current preference is system
        if (localStorage.getItem('theme_preference') === 'system') {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
    }

    // Init
    const savedMode = localStorage.getItem('theme_preference') || 'light';
    applyTheme(savedMode);

    // Expose Global API
    window.setTheme = function (mode) {
        applyTheme(mode);
    };

    // Legacy toggle support (cycles Light -> Dark -> System -> Light?) or just Light/Dark
    window.toggleTheme = function () {
        const current = localStorage.getItem('theme_preference') || 'system';
        const next = current === 'light' ? 'dark' : 'light'; // Simple toggle ignores system
        applyTheme(next);
    }

})();
