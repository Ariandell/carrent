/**
 * Admin Access Guard
 * Checks if current user has admin privileges
 * Redirects to appropriate page if not
 */

(function () {
    /**
     * Check if current user has admin access
     * @returns {Promise<boolean>} - true if admin, false otherwise
     */
    async function checkAdminAccess() {
        try {
            const user = await api.get('/api/users/profile');

            // Check for 'admin' role value
            if (!user || user.role !== 'admin') {
                showToast('Доступ заборонено. Потрібні права адміністратора.', 'error');
                setTimeout(() => {
                    window.location.href = '../dashboard.html';
                }, 1500);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Admin check failed:', e);
            window.location.href = '../auth.html';
            return false;
        }
    }

    /**
     * Initialize admin page - check access and run callback if authorized
     * @param {Function} callback - Function to run if admin access verified
     */
    async function initAdminPage(callback) {
        const isAdmin = await checkAdminAccess();
        if (isAdmin && typeof callback === 'function') {
            callback();
        }
    }

    // Expose globally
    window.checkAdminAccess = checkAdminAccess;
    window.initAdminPage = initAdminPage;
})();
