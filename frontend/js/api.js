const API_URL = ""; // Relative path to support any port/domain

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('access_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('access_token', token);
    }

    getToken() {
        return this.token;
    }

    logout() {
        localStorage.removeItem('access_token');
        window.location.href = '/frontend/auth.html';
    }

    async request(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Bypass ngrok warning page for API calls
        headers['ngrok-skip-browser-warning'] = 'true';


        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, config);

            if (response.status === 401) {
                // Token expired or invalid
                console.warn("Unauthorized, redirecting to login...");
                this.logout();
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'API Error');
            }

            return data;
        } catch (error) {
            console.error("API Request Failed:", error);
            throw error;
        }
    }

    async get(endpoint) { return this.request(endpoint, 'GET'); }
    async post(endpoint, body) { return this.request(endpoint, 'POST', body); }
    async put(endpoint, body) { return this.request(endpoint, 'PUT', body); }
    async delete(endpoint) { return this.request(endpoint, 'DELETE'); }
}

const api = new ApiClient();
// Toast Notification System - Using CSS classes for theme support
window.showToast = function (message, type = 'info') {
    // Get or create container
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element with CSS classes
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icons based on type
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || icons.info;

    // Message
    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        dismissToast(toast);
    };

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);

    // Click to dismiss
    toast.onclick = () => dismissToast(toast);

    container.appendChild(toast);

    // Auto dismiss after 4s
    setTimeout(() => dismissToast(toast), 4000);

    function dismissToast(t) {
        if (!t.isConnected) return;
        t.classList.add('hiding');
        setTimeout(() => t.remove(), 300);
    }
};
