/**
 * Admin Sidebar Component
 * Dynamically generates the admin navigation sidebar
 */

(function () {
    const navItems = [
        { href: 'index.html', icon: 'dashboard', label: 'Головна' },
        { href: 'cars.html', icon: 'cars', label: 'Автопарк' },
        { href: 'rentals.html', icon: 'rentals', label: 'Оренди' },
        { href: 'users.html', icon: 'users', label: 'Користувачі' },
        { href: 'transactions.html', icon: 'transactions', label: 'Транзакції' },
        { href: 'support.html', icon: 'support', label: 'Підтримка' }
    ];

    const icons = {
        dashboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`,
        cars: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>`,
        rentals: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
        users: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>`,
        transactions: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>`,
        support: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 4h.01"></path>`
    };

    function getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page;
    }

    function renderSidebar() {
        const container = document.getElementById('admin-sidebar');
        if (!container) return;

        const currentPage = getCurrentPage();

        let navHTML = '';
        navItems.forEach(item => {
            const isActive = item.href === currentPage;
            const classes = isActive
                ? 'flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-500 font-medium'
                : 'flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors';

            navHTML += `
                <a href="${item.href}" class="${classes}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${icons[item.icon]}
                    </svg>
                    ${item.label}
                </a>
            `;
        });

        container.innerHTML = `
            <aside class="w-64 nav-glass border-r border-white/10 flex flex-col">
                <div class="h-16 flex items-center px-6 border-b border-white/10">
                    <a href="../index.html" class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </div>
                        <span class="font-bold">Адмін</span>
                    </a>
                </div>
                <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    ${navHTML}
                </nav>
                <div class="p-4 border-t border-white/10">
                    <a href="../dashboard.html" class="btn-secondary w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        На Головну
                    </a>
                </div>
            </aside>
        `;
    }

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSidebar);
    } else {
        renderSidebar();
    }

    // Expose globally
    window.renderAdminSidebar = renderSidebar;
})();
