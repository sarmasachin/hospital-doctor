const AUTH_TOKEN_KEY = 'medichek_auth_token';
const AUTH_ADMIN_KEY = 'medichek_admin';

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

function authFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
}
