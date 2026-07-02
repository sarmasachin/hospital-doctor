(function () {
    function getApiUrl() {
        if (typeof getApiBase === 'function') return getApiBase();
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            return window.location.origin + '/api';
        }
        return 'http://localhost:5006/api';
    }

    function showForgotMessage(text, type) {
        const el = document.getElementById('forgotMessage');
        if (!el) return;
        el.textContent = text;
        el.className = 'forgot-message ' + (type || 'info');
    }

    function clearForgotMessage() {
        const el = document.getElementById('forgotMessage');
        if (!el) return;
        el.textContent = '';
        el.className = 'forgot-message';
    }

    function showForgotStep(step) {
        const step1 = document.getElementById('forgotStep1');
        const step2 = document.getElementById('forgotStep2');
        if (step1) step1.style.display = step === 1 ? 'block' : 'none';
        if (step2) step2.style.display = step === 2 ? 'block' : 'none';
    }

    function openForgotPanel() {
        const loginForm = document.getElementById('loginForm');
        const forgotPanel = document.getElementById('forgotPasswordPanel');
        const forgotLinkWrap = document.getElementById('forgotPasswordLinkWrap');
        if (loginForm) loginForm.style.display = 'none';
        if (forgotLinkWrap) forgotLinkWrap.style.display = 'none';
        if (forgotPanel) {
            forgotPanel.classList.add('active');
            forgotPanel.style.display = 'block';
        }
        showForgotStep(1);
        clearForgotMessage();
        const emailInput = document.getElementById('forgotEmail');
        if (emailInput) emailInput.focus();
    }

    function closeForgotPanel() {
        const loginForm = document.getElementById('loginForm');
        const forgotPanel = document.getElementById('forgotPasswordPanel');
        const forgotLinkWrap = document.getElementById('forgotPasswordLinkWrap');
        if (loginForm) loginForm.style.display = '';
        if (forgotLinkWrap) forgotLinkWrap.style.display = '';
        if (forgotPanel) {
            forgotPanel.classList.remove('active');
            forgotPanel.style.display = 'none';
        }
        ['forgotEmail', 'forgotOtp', 'forgotNewPassword', 'forgotConfirmPassword'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        showForgotStep(1);
        clearForgotMessage();
    }

    async function sendOtp() {
        const email = (document.getElementById('forgotEmail')?.value || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showForgotMessage('कृपया सही Gmail / Email डालें', 'error');
            return;
        }

        const btn = document.getElementById('btnSendOtp');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'भेजा जा रहा है...';
        }
        clearForgotMessage();

        try {
            const res = await fetch(getApiUrl() + '/admin/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            const data = await res.json();

            if (!res.ok) {
                showForgotMessage(data.error || 'OTP भेजने में समस्या हुई', 'error');
                return;
            }

            let msg = 'OTP आपके email पर भेज दिया गया है। कृपया inbox जाँचें।';
            if (data.devOtp) {
                msg += ' (Dev OTP: ' + data.devOtp + ')';
            }
            showForgotMessage(msg, 'success');
            showForgotStep(2);
            document.getElementById('forgotOtp')?.focus();
        } catch (e) {
            showForgotMessage('सर्वर कनेक्शन विफल!', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📧 OTP भेजें';
            }
        }
    }

    async function resetPassword() {
        const email = (document.getElementById('forgotEmail')?.value || '').trim().toLowerCase();
        const otp = (document.getElementById('forgotOtp')?.value || '').trim();
        const newPassword = document.getElementById('forgotNewPassword')?.value || '';
        const confirmPassword = document.getElementById('forgotConfirmPassword')?.value || '';

        if (!otp || otp.length !== 6) {
            showForgotMessage('कृपया 6 अंकों का OTP डालें', 'error');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            showForgotMessage('नया पासवर्ड कम से कम 6 अक्षर का होना चाहिए', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showForgotMessage('पासवर्ड मेल नहीं खा रहे', 'error');
            return;
        }

        const btn = document.getElementById('btnResetPassword');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'अपडेट हो रहा है...';
        }
        clearForgotMessage();

        try {
            const res = await fetch(getApiUrl() + '/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, otp: otp, newPassword: newPassword })
            });
            const data = await res.json();

            if (!res.ok) {
                showForgotMessage(data.error || 'पासवर्ड बदलने में समस्या हुई', 'error');
                return;
            }

            showForgotMessage('✅ पासवर्ड सफलतापूर्वक बदल गया! अब लॉगिन करें।', 'success');
            setTimeout(closeForgotPanel, 2500);
        } catch (e) {
            showForgotMessage('सर्वर कनेक्शन विफल!', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔐 नया पासवर्ड सेट करें';
            }
        }
    }

    function initForgotPassword() {
        const openBtn = document.getElementById('openForgotPassword');
        const backBtn = document.getElementById('backToLogin');
        const sendBtn = document.getElementById('btnSendOtp');
        const resetBtn = document.getElementById('btnResetPassword');

        if (openBtn) {
            openBtn.addEventListener('click', function (e) {
                e.preventDefault();
                openForgotPanel();
            });
        }
        if (backBtn) {
            backBtn.addEventListener('click', function (e) {
                e.preventDefault();
                closeForgotPanel();
            });
        }
        if (sendBtn) sendBtn.addEventListener('click', sendOtp);
        if (resetBtn) resetBtn.addEventListener('click', resetPassword);
    }

    document.addEventListener('DOMContentLoaded', initForgotPassword);
})();
