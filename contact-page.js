/**
 * Contact form — validation, API submit, offline/local fallback.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'contactMessages';
    var API_BASE = (typeof window !== 'undefined' && window.location.protocol.match(/^https?:/))
        ? window.location.origin + '/api'
        : 'http://localhost:5006/api';

    function trim(s) {
        return s != null ? String(s).trim() : '';
    }

    function getNetworkErrorMessage() {
        return 'इंटरनेट या सर्वर उपलब्ध नहीं है। कनेक्शन चेक करके दोबारा कोशिश करें।';
    }

    function formatSubmitError(status, data) {
        if (data && data.error) return String(data.error);
        if (status === 429) return 'बहुत ज़्यादा संदेश भेजे गए। 15 मिनट बाद कोशिश करें।';
        if (status >= 500) return 'सर्वर पर समस्या है। कुछ देर बाद दोबारा कोशिश करें।';
        if (status >= 400) return 'संदेश भेजा नहीं जा सका। फॉर्म जाँच करें।';
        return getNetworkErrorMessage();
    }

    function saveMessageLocally(payload) {
        var list = [];
        try {
            list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(list)) list = [];
        } catch (_) {
            list = [];
        }
        var nextId = list.length > 0 ? Math.max.apply(null, list.map(function (m) { return m.id || 0; })) + 1 : 1;
        list.push({
            id: nextId,
            name: payload.name,
            mobile: payload.mobile,
            email: payload.email,
            subject: payload.subject,
            subjectText: payload.subjectText,
            message: payload.message,
            status: 'pending',
            reply: '',
            createdAt: new Date().toISOString(),
            repliedAt: null,
            _localOnly: true
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function initContactForm() {
        var form = document.getElementById('contactForm');
        if (!form) return;

        var formAlert = document.getElementById('formAlert');
        var submitBtn = form.querySelector('.btn-submit');

        var nameInput = document.getElementById('nameInput');
        var mobileInput = document.getElementById('mobileInput');
        var emailInput = document.getElementById('emailInput');
        var subjectInput = document.getElementById('subjectInput');
        var messageInput = document.getElementById('messageInput');

        var nameGroup = document.getElementById('nameGroup');
        var mobileGroup = document.getElementById('mobileGroup');
        var emailGroup = document.getElementById('emailGroup');
        var subjectGroup = document.getElementById('subjectGroup');
        var messageGroup = document.getElementById('messageGroup');

        function validateName() {
            var value = trim(nameInput.value);
            if (value.length < 3) {
                nameGroup.classList.add('error');
                nameGroup.classList.remove('success');
                return false;
            }
            nameGroup.classList.remove('error');
            nameGroup.classList.add('success');
            return true;
        }

        function validateMobile() {
            var value = trim(mobileInput.value).replace(/\D/g, '');
            if (value.length !== 10) {
                mobileGroup.classList.add('error');
                mobileGroup.classList.remove('success');
                return false;
            }
            mobileGroup.classList.remove('error');
            mobileGroup.classList.add('success');
            return true;
        }

        function validateEmail() {
            var value = trim(emailInput.value);
            if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                emailGroup.classList.add('error');
                emailGroup.classList.remove('success');
                return false;
            }
            emailGroup.classList.remove('error');
            emailGroup.classList.add('success');
            return true;
        }

        function validateSubject() {
            if (!subjectInput.value) {
                subjectGroup.classList.add('error');
                subjectGroup.classList.remove('success');
                return false;
            }
            subjectGroup.classList.remove('error');
            subjectGroup.classList.add('success');
            return true;
        }

        function validateMessage() {
            var value = trim(messageInput.value);
            if (value.length < 10) {
                messageGroup.classList.add('error');
                messageGroup.classList.remove('success');
                return false;
            }
            messageGroup.classList.remove('error');
            messageGroup.classList.add('success');
            return true;
        }

        function showFormAlert(type, message) {
            formAlert.textContent = message;
            formAlert.className = 'form-alert ' + type;
        }

        function hideFormAlert() {
            formAlert.className = 'form-alert';
        }

        function clearSuccessClasses() {
            [nameGroup, mobileGroup, emailGroup, subjectGroup, messageGroup].forEach(function (g) {
                g.classList.remove('success');
            });
        }

        function setSubmitting(busy) {
            if (!submitBtn) return;
            submitBtn.disabled = busy;
            submitBtn.textContent = busy ? '⏳ भेजा जा रहा है...' : '📤 संदेश भेजें';
        }

        nameInput.addEventListener('input', validateName);
        mobileInput.addEventListener('input', validateMobile);
        emailInput.addEventListener('input', validateEmail);
        subjectInput.addEventListener('change', validateSubject);
        messageInput.addEventListener('input', validateMessage);

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var valid = validateName() && validateMobile() && validateEmail() && validateSubject() && validateMessage();
            if (!valid) {
                showFormAlert('error', '⚠️ कृपया सभी आवश्यक फ़ील्ड सही से भरें');
                return;
            }

            var payload = {
                name: trim(nameInput.value),
                mobile: trim(mobileInput.value).replace(/\D/g, ''),
                email: trim(emailInput.value),
                subject: subjectInput.value,
                subjectText: subjectInput.options[subjectInput.selectedIndex].text,
                message: trim(messageInput.value)
            };

            if (typeof window.isBrowserOffline === 'function' && window.isBrowserOffline()) {
                saveMessageLocally(payload);
                showFormAlert('info', '📡 आप ऑफलाइन हैं — संदेश स्थानीय रूप से सेव हो गया। ऑनलाइन होने पर दोबारा भेजें या ईमेल करें: support@livehospital.org');
                form.reset();
                clearSuccessClasses();
                setTimeout(hideFormAlert, 8000);
                return;
            }

            setSubmitting(true);
            hideFormAlert();

            fetch(API_BASE + '/contact-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            })
                .then(function (response) {
                    return response.json().catch(function () { return {}; }).then(function (data) {
                        return { response: response, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.response.ok) {
                        showFormAlert('error', '⚠️ ' + formatSubmitError(result.response.status, result.data));
                        return;
                    }
                    showFormAlert('success', '✅ धन्यवाद! आपका संदेश भेज दिया गया है। हम जल्द ही संपर्क करेंगे।');
                    form.reset();
                    clearSuccessClasses();
                    setTimeout(hideFormAlert, 5000);
                })
                .catch(function () {
                    saveMessageLocally(payload);
                    showFormAlert('info', '📡 सर्वर तक नहीं पहुँचा — संदेश स्थानीय रूप से सेव हो गया। बाद में दोबारा भेजें या ईमेल: support@livehospital.org');
                    form.reset();
                    clearSuccessClasses();
                    setTimeout(hideFormAlert, 8000);
                })
                .finally(function () {
                    setSubmitting(false);
                });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContactForm, { once: true });
    } else {
        initContactForm();
    }
})();
