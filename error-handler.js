/**
 * Global JS error handler (public site).
 * Catches unexpected runtime errors and unhandled promise rejections.
 */
(function (global) {
    'use strict';

    if (global.__lhErrorHandlerInstalled) return;
    global.__lhErrorHandlerInstalled = true;

    var DEBOUNCE_MS = 5000;
    var MAX_TOASTS = 4;
    var lastNotifyAt = 0;
    var notifyCount = 0;

    var USER_TITLE = 'कुछ गलत हो गया';
    var USER_MESSAGE = 'पेज रिफ्रेश करें या थोड़ी देर बाद दोबारा कोशिश करें।';

    function isBenignMessage(message) {
        var msg = String(message || '').toLowerCase().trim();
        if (!msg) return true;
        if (msg === 'script error.' || msg === 'script error') return true;
        if (msg.indexOf('resizeobserver') !== -1) return true;
        if (msg.indexOf('aborterror') !== -1) return true;
        if (msg.indexOf('the user aborted') !== -1) return true;
        if (msg.indexOf('cancelled') !== -1 && msg.indexOf('request') !== -1) return true;
        if (msg.indexOf('non-error promise rejection') !== -1) return true;
        return false;
    }

    function isExtensionSource(source) {
        return /^((chrome|moz|safari-web)-extension):/i.test(String(source || ''));
    }

    function logDetail(kind, detail) {
        try {
            console.error('[LiveHospital Error]', kind, detail);
        } catch (_) { /* ignore logging failures */ }
    }

    function ensureFallbackToastStyles() {
        if (document.getElementById('lh-error-handler-styles')) return;
        var style = document.createElement('style');
        style.id = 'lh-error-handler-styles';
        style.textContent = [
            '.toast-container{position:fixed;top:16px;right:16px;left:auto;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:calc(100vw - 32px);}',
            '.toast.error{background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);color:#fff;border-radius:10px;padding:14px 16px;',
            'box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:flex-start;gap:10px;font-family:system-ui,sans-serif;}',
            '.toast.error .toast-title{font-weight:700;font-size:.95rem;margin:0 0 4px;}',
            '.toast.error .toast-message{font-size:.85rem;margin:0;opacity:.95;line-height:1.4;}',
            '.toast.error .toast-close{background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer;opacity:.85;padding:0;margin-left:4px;}',
            '@media (max-width:480px){.toast-container{left:12px;right:12px;top:12px;}}'
        ].join('');
        (document.head || document.documentElement).appendChild(style);
    }

    function showFallbackToast(title, message) {
        ensureFallbackToastStyles();
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.setAttribute('role', 'region');
            container.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(container);
        }

        var toast = document.createElement('div');
        toast.className = 'toast error';
        toast.setAttribute('role', 'alert');
        toast.innerHTML =
            '<span class="toast-icon" aria-hidden="true">❌</span>' +
            '<div class="toast-content">' +
            '<p class="toast-title"></p>' +
            '<p class="toast-message"></p>' +
            '</div>' +
            '<button type="button" class="toast-close" aria-label="बंद करें">✕</button>';

        toast.querySelector('.toast-title').textContent = title;
        toast.querySelector('.toast-message').textContent = message;
        toast.querySelector('.toast-close').addEventListener('click', function () {
            toast.remove();
        });

        container.appendChild(toast);
        setTimeout(function () {
            if (toast.parentNode) toast.remove();
        }, 7000);
    }

    function notifyUser() {
        var now = Date.now();
        if (now - lastNotifyAt < DEBOUNCE_MS) return;
        if (notifyCount >= MAX_TOASTS) return;
        lastNotifyAt = now;
        notifyCount += 1;

        if (typeof global.showError === 'function') {
            global.showError(USER_TITLE, USER_MESSAGE, 7000);
            return;
        }
        if (typeof global.showToast === 'function') {
            global.showToast('error', USER_TITLE, USER_MESSAGE, 7000);
            return;
        }

        var run = function () {
            if (document.body) showFallbackToast(USER_TITLE, USER_MESSAGE);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }

    function onWindowError(event) {
        if (!event) return;

        var target = event.target;
        if (target && target !== global && target.tagName) {
            var tag = String(target.tagName).toUpperCase();
            var src = target.src || target.href || '';
            if (isExtensionSource(src)) return;
            if (tag === 'IMG' || tag === 'LINK') {
                logDetail('Resource load failed', { tag: tag, src: src });
                return;
            }
            if (tag === 'SCRIPT') {
                logDetail('Script load failed', { src: src });
                notifyUser();
            }
            return;
        }

        var message = event.message || (event.error && event.error.message) || '';
        var source = event.filename || '';
        if (isExtensionSource(source)) return;
        if (isBenignMessage(message)) return;

        logDetail('Uncaught error', {
            message: message,
            source: source,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
        notifyUser();
    }

    function onUnhandledRejection(event) {
        if (!event) return;
        var reason = event.reason;
        var message = '';
        if (reason && typeof reason === 'object' && reason.message) {
            message = reason.message;
        } else if (reason != null) {
            message = String(reason);
        }
        if (isBenignMessage(message)) return;

        logDetail('Unhandled promise rejection', reason);
        notifyUser();

        if (typeof event.preventDefault === 'function') {
            event.preventDefault();
        }
    }

    global.addEventListener('error', onWindowError, true);
    global.addEventListener('unhandledrejection', onUnhandledRejection);
})(typeof window !== 'undefined' ? window : this);
