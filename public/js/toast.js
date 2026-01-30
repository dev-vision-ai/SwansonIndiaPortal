// Shared toast helper for consistent notifications across the app
let toastStylesInjected = false;

// Check for pending toast after page reload
function displayPendingToast() {
    try {
        const pendingToast = sessionStorage.getItem('pendingToast');
        if (pendingToast) {
            const { message, type } = JSON.parse(pendingToast);
            sessionStorage.removeItem('pendingToast');
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                showToast(message, type);
            }, 100);
        }
    } catch (err) {
        console.error('Error displaying pending toast:', err);
    }
}

// Auto-display pending toast on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayPendingToast);
} else {
    displayPendingToast();
}

function injectToastStyles() {
    if (toastStylesInjected) return;
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes toast-slide-in {
            0% { transform: translateY(-24px) scale(0.98); opacity: 0; }
            60% { transform: translateY(4px) scale(1.01); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes toast-slide-out {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-24px) scale(0.96); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    toastStylesInjected = true;
}

function getToastColors(type) {
    if (type === 'error') {
        return { base: '#fee2e2', text: '#7f1d1d', border: '#fecaca' };
    }
    if (type === 'success') {
        return { base: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    }
    if (type === 'warning') {
        return { base: '#fffbeb', text: '#92400e', border: '#fde68a' };
    }
    return { base: '#eff6ff', text: '#1e3a8a', border: '#bfdbfe' };
}

export function showToast(message, type = 'info') {
    try {
        injectToastStyles();

        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 4rem;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: center;
                width: min(420px, 90vw);
                padding: 0 1rem;
            `;
            document.body.appendChild(toastContainer);
        }

        const { base, text, border } = getToastColors(type);

        // Create toast element
        const toast = document.createElement('div');
        toast.style.cssText = `
            width: 100%;
            background: ${base};
            color: ${text};
            border: 1px solid ${border};
            border-radius: 1rem;
            padding: 0.75rem 1rem;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
            font-size: 0.95rem;
            font-weight: 600;
            line-height: 1.3;
            word-wrap: break-word;
            pointer-events: auto;
            cursor: pointer;
            animation: toast-slide-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
            transition: transform 180ms ease, opacity 180ms ease;
            text-align: center;
        `;

        toast.textContent = message;
        toastContainer.appendChild(toast);

        const removeToast = () => {
            toast.style.animation = 'toast-slide-out 260ms ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (toastContainer && !toastContainer.childElementCount) {
                    toastContainer.remove();
                }
            }, 250);
        };

        // Auto-remove after 4 seconds
        const autoRemoveTimeout = setTimeout(removeToast, 4000);

        // Click to dismiss immediately
        toast.addEventListener('click', () => {
            clearTimeout(autoRemoveTimeout);
            removeToast();
        });

    } catch (err) {
        console.error('showToast error:', err);
        // Fallback to alert
        alert(message);
    }
}

export function storePendingToast(message, type = 'info') {
    try {
        sessionStorage.setItem('pendingToast', JSON.stringify({ message, type }));
    } catch (err) {
        console.error('Error storing pending toast:', err);
    }
}
