/**
 * Applies site-settings from GET /api/site-settings (server/data/site-settings.json):
 * brand title/tagline, per-page title + meta description, GA4 / GTM, contact details, social links.
 */
(function () {
    function pageKey() {
        var path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
        if (path === '/' || /index\.html$/i.test(path)) return 'home';
        if (/\/privacy$/i.test(path) || /privacy\.html$/i.test(path)) return 'privacy';
        if (/\/terms$/i.test(path) || /terms\.html$/i.test(path)) return 'terms';
        if (/\/cookies$/i.test(path) || /cookies\.html$/i.test(path)) return 'cookies';
        if (/\/contact$/i.test(path) || /contact\.html$/i.test(path)) return 'contact';
        return null;
    }

    var key = pageKey();

    function trim(s) {
        return s != null ? String(s).trim() : '';
    }

    function applyIntegrations(integ) {
        if (!integ || typeof integ !== 'object') return;
        var gtm = (integ.googleTagManagerId || '').trim();
        var ga4 = (integ.googleAnalyticsMeasurementId || '').trim();
        if (gtm && /^GTM-[A-Z0-9]+$/i.test(gtm)) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtm);
            document.head.appendChild(s);
            return;
        }
        if (ga4 && /^G-[A-Z0-9]+$/i.test(ga4)) {
            var gscr = document.createElement('script');
            gscr.async = true;
            gscr.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4);
            document.head.appendChild(gscr);
            gscr.onload = function () {
                window.dataLayer = window.dataLayer || [];
                function gtag() { window.dataLayer.push(arguments); }
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', ga4);
            };
        }
    }

    function normalizeSocialUrl(network, url, contact) {
        url = trim(url);
        if (!url && network === 'whatsapp') {
            var waNum = trim(contact.whatsapp || contact.phone || '');
            if (waNum) url = 'https://wa.me/' + waNum.replace(/\D/g, '');
        }
        if (!url) return '';
        if (network === 'whatsapp') {
            var digits = url.replace(/\D/g, '');
            if (digits.length >= 10 && !/^https?:\/\//i.test(url)) {
                return 'https://wa.me/' + digits;
            }
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
        return url;
    }

    function applySocial(social, contact) {
        social = social && typeof social === 'object' ? social : {};
        contact = contact && typeof contact === 'object' ? contact : {};
        var networks = {
            facebook: trim(social.facebook),
            instagram: trim(social.instagram),
            youtube: trim(social.youtube),
            twitter: trim(social.twitter),
            telegram: trim(social.telegram),
            whatsapp: trim(social.whatsapp)
        };

        Object.keys(networks).forEach(function (network) {
            var url = normalizeSocialUrl(network, networks[network], contact);
            var valid = !!url;
            document.querySelectorAll('[data-social-' + network + ']').forEach(function (el) {
                var isPrimary = el.classList.contains('social-icon-primary');
                if (valid) {
                    el.setAttribute('href', url);
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                    el.classList.remove('social-icon-inactive');
                    el.removeAttribute('aria-disabled');
                    el.style.display = '';
                } else if (isPrimary) {
                    el.setAttribute('href', '#');
                    el.removeAttribute('target');
                    el.classList.add('social-icon-inactive');
                    el.setAttribute('aria-disabled', 'true');
                    el.style.display = '';
                } else {
                    el.style.display = 'none';
                }
            });
        });

        document.querySelectorAll('.footer-col-connect').forEach(function (col) {
            col.style.display = '';
        });
    }

    fetch('/api/site-settings', { credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok) throw new Error('settings');
            return r.json();
        })
        .then(function (data) {
            var basic = data.basic;
            if (basic) {
                var bt = document.querySelector('[data-site-brand-title]');
                var tg = document.querySelector('[data-site-brand-tagline]');
                if (bt && basic.siteTitle) bt.textContent = basic.siteTitle;
                if (tg && basic.tagline) tg.textContent = basic.tagline;
            }

            if (key) {
                var pages = data.seo && data.seo.pages;
                var p = pages && pages[key];
                if (p) {
                    if (p.title) document.title = p.title;
                    if (p.description) {
                        var meta = document.querySelector('meta[name="description"]');
                        if (!meta) {
                            meta = document.createElement('meta');
                            meta.setAttribute('name', 'description');
                            document.head.appendChild(meta);
                        }
                        meta.setAttribute('content', p.description);
                    }
                }
            }

            applyIntegrations(data.integrations);
            applySocial(data.social, data.contact);
            if (typeof window.applySiteContact === 'function') {
                window.applySiteContact(data.contact);
            }
        })
        .catch(function () {
            if (typeof window.applySiteContact === 'function') {
                window.applySiteContact(window.DEFAULT_CONTACT);
            }
        });
})();

