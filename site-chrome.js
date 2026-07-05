/**
 * Shared header (logo + nav) and footer for all public pages.
 * Mount: #lh-site-header, #lh-site-footer
 * Active nav: body[data-active-page] = home|privacy|terms|cookies|contact
 */
(function () {
    'use strict';

    var NAV_ITEMS = [
        { id: 'home', href: '/', label: '🏠 Home' },
        { id: 'privacy', href: '/privacy', label: '🔒 गोपनीयता नीति' },
        { id: 'terms', href: '/terms', label: '📄 नियम और शर्तें' },
        { id: 'cookies', href: '/cookies', label: '🍪 कुकी नीति' },
        { id: 'contact', href: '/contact', label: '📞 संपर्क करें' }
    ];

    var SOCIAL_SVGS = {
        whatsapp: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
        telegram: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
        facebook: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        twitter: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
    };

    function getActivePage() {
        return (document.body && document.body.getAttribute('data-active-page')) || '';
    }

    function buildNavHtml(active) {
        return NAV_ITEMS.map(function (item) {
            var cls = 'lh-menu-btn' + (item.id === active ? ' active' : '');
            return '<a href="' + item.href + '" class="' + cls + '">' + item.label + '</a>';
        }).join('');
    }

    function buildHeaderHtml(active) {
        return (
            '<header class="lh-top-header">' +
                '<div class="lh-chrome-container">' +
                    '<a href="/" class="lh-logo-home-link" aria-label="LiveHospital Home">' +
                        '<div class="lh-logo-section">' +
                            '<div class="lh-logo"><img src="/favicon.svg" alt="LiveHospital" width="36" height="36"></div>' +
                            '<div class="lh-site-title">' +
                                '<h1 data-site-brand-title>LiveHospital</h1>' +
                                '<p data-site-brand-tagline>Doctor Availability System</p>' +
                            '</div>' +
                        '</div>' +
                    '</a>' +
                    '<button type="button" class="lh-theme-toggle" id="lhThemeToggle" aria-label="थीम बदलें">🌙</button>' +
                '</div>' +
            '</header>' +
            '<nav class="lh-top-menu" aria-label="मुख्य मेनू">' +
                '<div class="lh-chrome-container">' + buildNavHtml(active) + '</div>' +
            '</nav>'
        );
    }

    function buildFooterHtml() {
        return (
            '<footer class="footer" id="site-footer">' +
                '<div class="lh-chrome-container">' +
                    '<div class="footer-grid">' +
                        '<div class="footer-col">' +
                            '<h4>Contact Us</h4>' +
                            '<p>आप किसी भी जानकारी / अपडेट के लिए हमसे संपर्क कर सकते हैं।</p>' +
                            '<div class="contact-info">' +
                                '<p data-contact-footer-phone style="display:none"></p>' +
                                '<p data-contact-footer-email>📧 support@livehospital.org</p>' +
                            '</div>' +
                        '</div>' +
                        '<div class="footer-col">' +
                            '<h4>Important</h4>' +
                            '<p>सुरक्षा और पारदर्शिता के लिए नीचे दिए पेज देखें।</p>' +
                            '<ul>' +
                                '<li><a href="/privacy">🔒 गोपनीयता नीति</a></li>' +
                                '<li><a href="/terms">📄 नियम और शर्तें</a></li>' +
                                '<li><a href="/cookies">🍪 कुकी नीति</a></li>' +
                                '<li><a href="/contact">📞 संपर्क करें</a></li>' +
                            '</ul>' +
                        '</div>' +
                        '<div class="footer-col">' +
                            '<h4>Quick Links</h4>' +
                            '<ul>' +
                                '<li><a href="#" id="lhFooterGoTop">🔝 Go Top</a></li>' +
                                '<li><a href="/" id="lhFooterHome">🏠 Home</a></li>' +
                            '</ul>' +
                        '</div>' +
                        '<div class="footer-col footer-col-connect">' +
                            '<h4 class="footer-connect-title">CONNECT</h4>' +
                            '<div class="social-icons social-icons-connect">' +
                                '<a href="#" data-social-whatsapp class="social-icon social-icon-primary" aria-label="WhatsApp" title="WhatsApp">' + SOCIAL_SVGS.whatsapp + '</a>' +
                                '<a href="#" data-social-telegram class="social-icon social-icon-primary" aria-label="Telegram" title="Telegram">' + SOCIAL_SVGS.telegram + '</a>' +
                                '<a href="#" data-social-facebook class="social-icon social-icon-primary" aria-label="Facebook" title="Facebook">' + SOCIAL_SVGS.facebook + '</a>' +
                                '<a href="#" data-social-twitter class="social-icon social-icon-primary" aria-label="X" title="X">' + SOCIAL_SVGS.twitter + '</a>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</footer>' +
            '<div class="sub-footer">' +
                '<div class="lh-chrome-container">' +
                    '<div class="sub-footer-content">' +
                        '<p>&copy; 2026 <a href="/" class="sub-footer-home-link">LiveHospital</a>. सभी अधिकार सुरक्षित।</p>' +
                        '<div class="sub-footer-links">' +
                            '<a href="/privacy">गोपनीयता नीति</a>' +
                            '<a href="/terms">नियम और शर्तें</a>' +
                            '<a href="/cookies">कुकी नीति</a>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function isHomePath() {
        var path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
        return path === '/' || /index\.html$/i.test(path);
    }

    function bindFooterActions() {
        var goTop = document.getElementById('lhFooterGoTop');
        if (goTop) {
            goTop.addEventListener('click', function (e) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        var home = document.getElementById('lhFooterHome');
        if (home) {
            home.addEventListener('click', function (e) {
                if (!isHomePath()) return;
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (typeof window.goBackToHospitals === 'function') {
                    window.goBackToHospitals();
                }
            });
        }
    }

    function setupThemeToggle() {
        var btn = document.getElementById('lhThemeToggle');
        if (!btn) return;

        if (isHomePath()) return;

        var saved = localStorage.getItem('lh-theme') || localStorage.getItem('nf-theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        btn.textContent = saved === 'dark' ? '☀️' : '🌙';

        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            var next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('lh-theme', next);
            localStorage.setItem('nf-theme', next);
            btn.textContent = next === 'dark' ? '☀️' : '🌙';
            var legacy = document.getElementById('themeToggle') || document.getElementById('nfThemeToggle');
            if (legacy) legacy.textContent = btn.textContent;
        });
    }

    function renderSiteChrome() {
        var headerMount = document.getElementById('lh-site-header');
        var footerMount = document.getElementById('lh-site-footer');
        var active = getActivePage();

        if (headerMount) {
            headerMount.innerHTML = buildHeaderHtml(active);
            setupThemeToggle();
        }

        if (footerMount) {
            footerMount.className = 'lh-site-footer';
            footerMount.innerHTML = buildFooterHtml();
            bindFooterActions();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSiteChrome, { once: true });
    } else {
        renderSiteChrome();
    }

    window.renderSiteChrome = renderSiteChrome;
})();
