/**
 * Offline detection + page notices (public site).
 * Loaded on homepage, legal pages, contact, 404, 500.
 */
(function (global) {
    'use strict';

    if (global.__lhOfflineStatusInstalled) return;
    global.__lhOfflineStatusInstalled = true;

    var OFFLINE_MSG = 'इंटरनेट कनेक्शन नहीं है। कुछ सुविधाएँ काम नहीं कर सकतीं।';
    var ONLINE_MSG = 'कनेक्शन वापस आ गया।';

    function ensureStyles() {
        if (document.getElementById('lh-offline-status-styles')) return;
        var style = document.createElement('style');
        style.id = 'lh-offline-status-styles';
        style.textContent = [
            '#lhOfflineBanner,#lhPageNotice{position:fixed;top:0;left:0;right:0;z-index:100000;',
            'display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 44px 10px 16px;',
            'font-family:system-ui,sans-serif;font-size:.9rem;line-height:1.4;text-align:center;}',
            '#lhOfflineBanner{background:linear-gradient(135deg,#b45309,#92400e);color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.2);}',
            '#lhPageNotice{background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.15);}',
            '#lhOfflineBanner button,#lhPageNotice button{position:absolute;right:12px;top:50%;transform:translateY(-50%);',
            'background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:1rem;}',
            'body.lh-has-top-banner{padding-top:44px;}',
            '@media (max-width:480px){#lhOfflineBanner,#lhPageNotice{font-size:.82rem;padding:10px 40px 10px 12px;}}'
        ].join('');
        (document.head || document.documentElement).appendChild(style);
    }

    function setBodyBannerClass(hasBanner) {
        if (!document.body) return;
        if (hasBanner) document.body.classList.add('lh-has-top-banner');
        else document.body.classList.remove('lh-has-top-banner');
    }

    function createBanner(id, message, dismissible) {
        ensureStyles();
        var existing = document.getElementById(id);
        if (existing) {
            existing.querySelector('.lh-banner-text').textContent = message;
            existing.style.display = 'flex';
            setBodyBannerClass(true);
            return existing;
        }

        var bar = document.createElement('div');
        bar.id = id;
        bar.setAttribute('role', 'status');
        bar.innerHTML = '<span class="lh-banner-text"></span>';
        bar.querySelector('.lh-banner-text').textContent = message;

        if (dismissible) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'बंद करें');
            btn.textContent = '✕';
            btn.addEventListener('click', function () {
                bar.style.display = 'none';
                if (!document.getElementById('lhOfflineBanner') || document.getElementById('lhOfflineBanner').style.display === 'none') {
                    setBodyBannerClass(false);
                }
            });
            bar.appendChild(btn);
        }

        var mount = function () {
            if (!document.body) return;
            document.body.insertBefore(bar, document.body.firstChild);
            setBodyBannerClass(true);
        };
        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount, { once: true });

        return bar;
    }

    function updateOfflineBanner() {
        if (!global.navigator || global.navigator.onLine !== false) {
            var bar = document.getElementById('lhOfflineBanner');
            if (bar) bar.style.display = 'none';
            var notice = document.getElementById('lhPageNotice');
            if (!notice || notice.style.display === 'none') setBodyBannerClass(false);
            return;
        }
        createBanner('lhOfflineBanner', '📡 ' + OFFLINE_MSG, false);
    }

    function showPageNotice(message, options) {
        options = options || {};
        var msg = message || 'कुछ सेटिंग लोड नहीं हो पाईं। डिफ़ॉल्ट जानकारी दिख रही है।';
        createBanner('lhPageNotice', (options.icon || 'ℹ️ ') + msg, options.dismissible !== false);
    }

    function notifyOnline() {
        if (typeof global.showToast === 'function') {
            global.showToast('success', 'ऑनलाइन', ONLINE_MSG, 3000);
            return;
        }
        if (typeof global.showSuccess === 'function') {
            global.showSuccess('ऑनलाइन', ONLINE_MSG, 3000);
            return;
        }
    }

    function initOfflineBanner() {
        updateOfflineBanner();
        global.addEventListener('offline', updateOfflineBanner);
        global.addEventListener('online', function () {
            updateOfflineBanner();
            notifyOnline();
        });
    }

    global.showPageNotice = showPageNotice;
    global.initOfflineBanner = initOfflineBanner;
    global.isBrowserOffline = function () {
        return !!(global.navigator && global.navigator.onLine === false);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOfflineBanner, { once: true });
    } else {
        initOfflineBanner();
    }
})(typeof window !== 'undefined' ? window : this);
