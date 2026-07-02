/**
 * Single source for public-site contact details (from /api/site-settings).
 * Loaded before other page scripts; seo-bootstrap calls applySiteContact after its fetch.
 */
(function (global) {
    var DEFAULT_CONTACT = {
        phone: '',
        whatsapp: '',
        supportEmail: 'support@livehospital.org',
        privacyEmail: 'privacy@livehospital.org',
        hours: 'सोमवार - शनिवार (9AM - 6PM)'
    };

    function trim(s) {
        return s != null ? String(s).trim() : '';
    }

    function applySiteContact(contact) {
        var c = contact && typeof contact === 'object' ? contact : {};
        var phone = trim(c.phone);
        var whatsapp = trim(c.whatsapp) || phone;
        var supportEmail = trim(c.supportEmail) || DEFAULT_CONTACT.supportEmail;
        var privacyEmail = trim(c.privacyEmail) || DEFAULT_CONTACT.privacyEmail;
        var hours = trim(c.hours) || DEFAULT_CONTACT.hours;

        global.CONTACT_CONFIG = {
            phone: phone,
            whatsapp: whatsapp,
            email: supportEmail,
            privacyEmail: privacyEmail,
            hours: hours
        };

        global.document.querySelectorAll('[data-contact-hours]').forEach(function (el) {
            el.textContent = hours;
        });

        global.document.querySelectorAll('[data-contact-support-email]').forEach(function (el) {
            el.textContent = supportEmail;
            if (el.tagName === 'A') {
                el.setAttribute('href', 'mailto:' + supportEmail);
            }
        });

        global.document.querySelectorAll('[data-contact-privacy-email]').forEach(function (el) {
            el.textContent = privacyEmail;
            if (el.tagName === 'A') {
                el.setAttribute('href', 'mailto:' + privacyEmail);
            }
        });

        global.document.querySelectorAll('[data-contact-footer-email]').forEach(function (el) {
            el.textContent = '📧 ' + supportEmail;
        });

        global.document.querySelectorAll('[data-contact-footer-phone]').forEach(function (el) {
            if (phone) {
                el.textContent = '📞 ' + phone;
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        global.document.querySelectorAll('[data-contact-phone]').forEach(function (el) {
            if (phone) {
                el.textContent = phone;
                if (el.tagName === 'A') {
                    el.setAttribute('href', 'tel:' + phone.replace(/\s/g, ''));
                }
            } else {
                el.textContent = '';
            }
        });

        global.document.querySelectorAll('[data-contact-phone-row]').forEach(function (el) {
            el.style.display = phone ? '' : 'none';
            var span = el.querySelector('[data-contact-phone]');
            if (span && phone) span.textContent = phone;
        });

        global.document.querySelectorAll('[data-contact-phone-card]').forEach(function (card) {
            var link = card.querySelector('[data-contact-phone]');
            var fallback = card.querySelector('[data-contact-phone-fallback]');
            if (phone) {
                if (link) {
                    link.textContent = phone;
                    if (link.tagName === 'A') link.setAttribute('href', 'tel:' + phone.replace(/\s/g, ''));
                    link.style.display = '';
                }
                if (fallback) fallback.style.display = 'none';
            } else {
                if (link) link.style.display = 'none';
                if (fallback) {
                    fallback.style.display = '';
                    var fbEmail = fallback.querySelector('[data-contact-support-email]');
                    if (fbEmail) {
                        fbEmail.textContent = supportEmail;
                        if (fbEmail.tagName === 'A') fbEmail.setAttribute('href', 'mailto:' + supportEmail);
                    }
                }
            }
        });

        global.document.querySelectorAll('[data-contact-whatsapp]').forEach(function (el) {
            if (whatsapp) {
                el.textContent = whatsapp;
                var waNum = whatsapp.replace(/\D/g, '');
                if (el.tagName === 'A') {
                    el.setAttribute('href', 'https://wa.me/' + waNum);
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            } else {
                el.textContent = '';
            }
        });

        global.document.querySelectorAll('[data-contact-whatsapp-card]').forEach(function (card) {
            var link = card.querySelector('[data-contact-whatsapp]');
            var fallback = card.querySelector('[data-contact-whatsapp-fallback]');
            if (whatsapp) {
                if (link) {
                    link.textContent = whatsapp;
                    if (link.tagName === 'A') {
                        var waNum = whatsapp.replace(/\D/g, '');
                        link.setAttribute('href', 'https://wa.me/' + waNum);
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener noreferrer');
                    }
                    link.style.display = '';
                }
                if (fallback) fallback.style.display = 'none';
            } else {
                if (link) link.style.display = 'none';
                if (fallback) {
                    fallback.style.display = '';
                    var fbEmail = fallback.querySelector('[data-contact-support-email]');
                    if (fbEmail) {
                        fbEmail.textContent = supportEmail;
                        if (fbEmail.tagName === 'A') fbEmail.setAttribute('href', 'mailto:' + supportEmail);
                    }
                }
            }
        });

        global.dispatchEvent(new CustomEvent('contactconfigready', { detail: global.CONTACT_CONFIG }));
    }

    global.applySiteContact = applySiteContact;
    global.DEFAULT_CONTACT = DEFAULT_CONTACT;

    applySiteContact(DEFAULT_CONTACT);
})();
