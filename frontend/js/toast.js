/**
 * Sci-Fi Toast Notification System v2.0
 * Apple-style Glassmorphism + Tech accents
 */

(function () {
    // Inject Styles Programmatically to keep it self-contained
    const style = document.createElement('style');
    style.innerHTML = `
        #toast-container {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none; /* Let clicks pass through gaps */
        }
        
        .sci-fi-toast {
            pointer-events: auto;
            min-width: 300px;
            max-width: 400px;
            padding: 16px 20px;
            background: rgba(5, 5, 5, 0.75);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px; /* Apple-ish rounded */
            color: #fff;
            font-family: 'JetBrains Mono', 'Menlo', 'Courier New', monospace; /* Tech feel */
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
            
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1); /* Expo ease */
            
            position: relative;
            overflow: hidden;
        }

        /* Tech Accents */
        .sci-fi-toast::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 3px;
            height: 100%;
            background: rgba(255, 255, 255, 0.2);
        }

        .sci-fi-toast.toast-success::before { background: #10b981; box-shadow: 0 0 15px #10b981; }
        .sci-fi-toast.toast-error::before { background: #ef4444; box-shadow: 0 0 15px #ef4444; }
        .sci-fi-toast.toast-info::before { background: #3b82f6; box-shadow: 0 0 15px #3b82f6; }

        .sci-fi-toast.showing {
            transform: translateX(0);
            opacity: 1;
        }
        
        .sci-fi-toast.hiding {
            transform: translateX(20px);
            opacity: 0;
        }

        .toast-icon {
            font-size: 14px;
        }
        
        .toast-content {
            display: flex;
            flex-direction: column;
        }
        
        .toast-title {
            font-weight: 700;
            opacity: 0.5;
            font-size: 9px;
            margin-bottom: 2px;
        }
        
        .toast-msg {
            font-weight: 500;
            line-height: 1.4;
        }

        .toast-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.3);
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
            transition: color 0.2s;
        }
        .toast-close:hover { color: #fff; }
    `;
    document.head.appendChild(style);

    function getContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    const icons = {
        success: '✓',
        error: '!',
        info: 'i'
    };

    /**
     * @param {string} message 
     * @param {string} type 'success' | 'error' | 'info'
     */
    function showToast(message, type = 'info', title = null) {
        const container = getContainer();

        // Auto determine title if missing
        if (!title) {
            if (type === 'success') title = 'SUCCESS';
            if (type === 'error') title = 'SYSTEM ERROR';
            if (type === 'info') title = 'NOTIFICATION';
        }

        const toast = document.createElement('div');
        toast.className = `sci-fi-toast toast-${type}`;

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Add to DOM
        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.add('showing');
        });

        // Click to dismiss
        toast.onclick = (e) => {
            if (e.target.classList.contains('toast-close')) return; // handled inline
            dismiss(toast);
        };

        // Auto dismiss
        setTimeout(() => dismiss(toast), 5000);
    }

    function dismiss(toast) {
        if (!toast.parentElement) return;
        toast.classList.remove('showing');
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 500);
    }

    window.showToast = showToast;
})();
