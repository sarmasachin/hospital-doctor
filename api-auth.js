const AUTH_TOKEN_KEY = 'medichek_auth_token';
const AUTH_ADMIN_KEY = 'medichek_admin';
const SESSION_EXPIRED_KEY = 'lh_admin_session_expired';

function getApiBase() {
    if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        return `${window.location.origin}/api`;
    }
    return 'http://localhost:5006/api';
}

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function saveAuthSession(token, admin) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(admin));
    localStorage.setItem('adminLoggedIn', JSON.stringify(admin));
}

function clearAuthSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_ADMIN_KEY);
    localStorage.removeItem('adminLoggedIn');
}

function getNetworkErrorMessage() {
    return 'इंटरनेट या सर्वर उपलब्ध नहीं है। कनेक्शन चेक करें और सर्वर चालू हो तो दोबारा कोशिश करें।';
}

async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch (_) {
        return {};
    }
}

function formatApiErrorMessage(response, data, fallback) {
    const payload = data && typeof data === 'object' ? data : {};
    if (payload.error) return String(payload.error);
    const status = response && response.status ? response.status : 0;
    if (status === 401) return 'सेशन समाप्त हो गया। कृपया दोबारा लॉगिन करें।';
    if (status === 403) return 'आपके पास यह कार्य करने की अनुमति नहीं है।';
    if (status === 404) return 'अनुरोधित डेटा नहीं मिला।';
    if (status === 429) return 'बहुत ज़्यादा अनुरोध। थोड़ी देर बाद कोशिश करें।';
    if (status >= 500) return 'सर्वर पर समस्या है। कुछ देर बाद दोबारा कोशिश करें।';
    if (status >= 400) return fallback || 'अनुरोध अस्वीकार कर दिया गया।';
    return fallback || 'कुछ गलत हो गया।';
}

async function getApiFailureMessage(response, fallback) {
    const data = await parseJsonSafe(response);
    return formatApiErrorMessage(response, data, fallback);
}

function formatAdminError(err, fallback) {
    if (!err) return fallback || getNetworkErrorMessage();
    if (err.userMessage) return err.userMessage;
    if (err.isNetworkError || err.name === 'TypeError') return getNetworkErrorMessage();
    if (err.code === 'AUTH_EXPIRED' || err.status === 401) {
        return 'सेशन समाप्त हो गया। कृपया दोबारा लॉगिन करें।';
    }
    if (err.message && err.message !== 'Session expired') return err.message;
    return fallback || getNetworkErrorMessage();
}

function showAdminError(err, fallback) {
    if (err && (err.status === 401 || err.code === 'AUTH_EXPIRED')) return;
    const msg = formatAdminError(err, fallback);
    if (typeof showAlert === 'function') {
        showAlert(msg, 'error');
        return;
    }
    if (typeof showFieldError === 'function' && showFieldError.length <= 1) {
        showFieldError(msg);
        return;
    }
    alert(msg);
}

let sessionExpireHandled = false;

function handleSessionExpired(message) {
    if (sessionExpireHandled) return;
    sessionExpireHandled = true;
    const msg = message || 'सेशन समाप्त हो गया। कृपया दोबारा लॉगिन करें।';
    clearAuthSession();
    try {
        sessionStorage.setItem(SESSION_EXPIRED_KEY, msg);
    } catch (_) { /* private mode */ }
    window.setTimeout(function () {
        window.location.reload();
    }, 50);
}

function initAdminSessionExpiredNotice() {
    try {
        const msg = sessionStorage.getItem(SESSION_EXPIRED_KEY);
        if (!msg) return;
        sessionStorage.removeItem(SESSION_EXPIRED_KEY);
        window.setTimeout(function () {
            if (typeof showAlert === 'function') showAlert(msg, 'error');
            else alert(msg);
        }, 250);
    } catch (_) { /* ignore */ }
}

async function authFetch(url, options) {
    options = options || {};
    const token = getAuthToken();
    const headers = Object.assign({}, options.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    if (options.body && !headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(url, Object.assign({}, options, { headers: headers }));
    } catch (networkErr) {
        const err = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
        err.isNetworkError = true;
        err.userMessage = getNetworkErrorMessage();
        throw err;
    }

    if (response.status === 401 && token) {
        const data = await parseJsonSafe(response);
        handleSessionExpired(data.error || undefined);
        const err = new Error('Session expired');
        err.status = 401;
        err.code = 'AUTH_EXPIRED';
        err.userMessage = 'सेशन समाप्त हो गया। कृपया दोबारा लॉगिन करें।';
        throw err;
    }

    return response;
}
