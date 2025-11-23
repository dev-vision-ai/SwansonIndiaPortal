// Shared toast helper for consistent notifications across the app
export function showToast(message, type = 'info') {
    try {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            // Center the toast container in the viewport so notifications appear centrally
            toastContainer.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: auto;
                max-width: 80%;
                padding: 0 12px;
            `;
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#eff6ff'};
            color: ${type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af'};
            border: 1px solid ${type === 'error' ? '#fecaca' : type === 'success' ? '#a7f3d0' : '#bfdbfe'};
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 0px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            font-size: 14px;
            font-weight: 500;
            max-width: 360px;
            word-wrap: break-word;
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.3s ease;
        `;

        toast.textContent = message;
        toastContainer.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 4000);

        // Click to dismiss
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });

    } catch (err) {
        console.error('showToast error:', err);
        // Fallback to alert
        alert(message);
    }
}
