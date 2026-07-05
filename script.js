// ==================== API CONFIGURATION ====================
const API_URL = (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:'))
    ? `${window.location.origin}/api`
    : 'http://localhost:5006/api';

// Contact details — applied by contact-config.js from /api/site-settings

// ==================== SECURITY FUNCTIONS ====================

// Sanitize HTML to prevent XSS
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Sanitize input for search
function sanitizeInput(input) {
    if (!input) return '';
    return input
        .replace(/[<>\"\'&]/g, '')
        .trim()
        .substring(0, 100); // Limit length
}

// Validate ID (must be number)
function validateId(id) {
    const parsed = parseInt(id, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// Rate limiting for search
let lastSearchTime = 0;
const SEARCH_COOLDOWN = 300; // 300ms between searches

function canSearch() {
    const now = Date.now();
    if (now - lastSearchTime < SEARCH_COOLDOWN) {
        return false;
    }
    lastSearchTime = now;
    return true;
}

// Escape regex special characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Escape HTML for safe display in card text
function escapeHtml(s) {
    if (s == null || s === '') return '';
    const t = String(s);
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== STATE VARIABLES ====================

// User Location State
let userLocation = null;
let locationEnabled = false;

// Pagination State
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let currentPaginationType = 'hospitals'; // hospitals, doctors, blood

// Data Loading State
let isLoading = false;


// ==================== TOAST/MESSAGE SYSTEM ====================

// Create toast container if not exists
function createToastContainer() {
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return document.getElementById('toastContainer');
}

// Show toast message
function showToast(type, title, message, duration = 4000) {
    const container = createToastContainer();
    
    const icons = {
        'error': '❌',
        'success': '✅',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="closeToast(this)">✕</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }
    
    return toast;
}

// Close toast
function closeToast(button) {
    const toast = button.closest('.toast');
    removeToast(toast);
}

// Remove toast with animation
function removeToast(toast) {
    if (toast && toast.parentNode) {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Shortcut functions
function showError(title, message, duration) {
    return showToast('error', title, message, duration);
}

function showSuccess(title, message, duration) {
    return showToast('success', title, message, duration);
}

function showWarning(title, message, duration) {
    return showToast('warning', title, message, duration);
}

function showInfo(title, message, duration) {
    return showToast('info', title, message, duration);
}

// ==================== DATA VARIABLES (Loaded from API) ====================
let hospitalsData = [];
let bloodRequests = [];

// ==================== DOCTOR OPD SCHEDULE (auto छुट्टी outside hours) ====================
const OPD_DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const OPD_DAY_INDEX = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6
};

function parseTimeToMinutes(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase().replace(/\./g, '');
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
        const h = parseInt(m24[1], 10);
        const m = parseInt(m24[2], 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
    }
    const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const m = m12[2] ? parseInt(m12[2], 10) : 0;
        const ampm = m12[3];
        if (h < 1 || h > 12 || m < 0 || m >= 60) return null;
        if (ampm === 'pm' && h !== 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        return h * 60 + m;
    }
    return null;
}

function parseTimingRange(timing) {
    if (!timing || !String(timing).trim()) return null;
    const parts = String(timing).trim().split(/\s*(?:-|–|—|\bto\b)\s*/i);
    if (parts.length < 2) return null;
    const start = parseTimeToMinutes(parts[0]);
    const end = parseTimeToMinutes(parts[1]);
    if (start == null || end == null) return null;
    return { start, end };
}

function parseOpdDays(opdDays) {
    if (!opdDays || !String(opdDays).trim()) return null;
    const days = new Set();
    String(opdDays).toLowerCase().split(/[,;]+/).map(t => t.trim()).filter(Boolean).forEach(token => {
        const range = token.match(/^(sun|mon|tue|wed|thu|fri|sat)\s*[-–]\s*(sun|mon|tue|wed|thu|fri|sat)$/);
        if (range) {
            const startIdx = OPD_DAY_ORDER.indexOf(range[1]);
            const endIdx = OPD_DAY_ORDER.indexOf(range[2]);
            if (startIdx === -1 || endIdx === -1) return;
            if (startIdx <= endIdx) {
                for (let i = startIdx; i <= endIdx; i++) days.add(i);
            } else {
                for (let i = startIdx; i < 7; i++) days.add(i);
                for (let i = 0; i <= endIdx; i++) days.add(i);
            }
            return;
        }
        const key = token.replace(/[^a-z]/g, '');
        if (OPD_DAY_INDEX[key] !== undefined) {
            days.add(OPD_DAY_INDEX[key]);
            return;
        }
        const short = OPD_DAY_ORDER.find(d => key === d || key.startsWith(d));
        if (short) days.add(OPD_DAY_ORDER.indexOf(short));
    });
    return days.size ? days : null;
}

function isTimeInOpdRange(nowMinutes, start, end) {
    if (start === end) return true;
    if (start < end) return nowMinutes >= start && nowMinutes < end;
    return nowMinutes >= start || nowMinutes < end;
}

function isDoctorWithinOpdSchedule(doctor, now = new Date()) {
    const opdDays = parseOpdDays(doctor.opd_days ?? doctor.opd);
    if (opdDays && !opdDays.has(now.getDay())) return false;
    const range = parseTimingRange(doctor.timing);
    if (!range) return true;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return isTimeInOpdRange(nowMinutes, range.start, range.end);
}

function doctorHasSchedule(doctor) {
    return !!(parseTimingRange(doctor.timing) || parseOpdDays(doctor.opd_days ?? doctor.opd));
}

function getEffectiveDoctorStatus(doctor, now = new Date()) {
    const base = String(doctor.db_status || doctor.status || 'available').toLowerCase();
    if (!doctorHasSchedule(doctor)) return base;
    if (!isDoctorWithinOpdSchedule(doctor, now)) return 'leave';
    return base;
}

function snapshotDoctorDbStatuses(hospitals) {
    (hospitals || []).forEach(h => {
        (h.doctors || []).forEach(d => {
            if (d.db_status == null) d.db_status = d.status;
        });
    });
}

function applyEffectiveDoctorStatuses(hospitals, now = new Date()) {
    let changed = false;
    (hospitals || hospitalsData).forEach(h => {
        (h.doctors || []).forEach(d => {
            if (d.db_status == null) d.db_status = d.status;
            const effective = getEffectiveDoctorStatus(d, now);
            if (d.status !== effective) changed = true;
            d.status = effective;
        });
    });
    return changed;
}

// ==================== API FUNCTIONS ====================

// Fetch all hospitals with their doctors
async function fetchHospitals() {
    try {
        const response = await fetch(`${API_URL}/hospitals`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        const hospitals = await response.json();
        
        // Fetch doctors for each hospital
        for (let hospital of hospitals) {
            const doctorsResponse = await fetch(`${API_URL}/hospitals/${hospital.id}/doctors`);
            hospital.doctors = doctorsResponse.ok ? await doctorsResponse.json() : [];
        }
        
        return hospitals;
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        showError('Connection Error', 'Server से connect नहीं हो पा रहा');
        return [];
    }
}

// Fetch blood requests
async function fetchBloodRequests() {
    try {
        const response = await fetch(`${API_URL}/blood-requests`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        const data = await response.json();
        
        // Convert API data to frontend format
        return data.map(req => ({
            id: req.id,
            hospitalId: req.hospital_id,
            bloodType: req.blood_type,
            hospital: req.hospital_name,
            message: req.message,
            createdAt: new Date(req.created_at).getTime(),
            urgent: req.urgent,
            patientName: req.patient_name,
            contact: req.contact
        }));
    } catch (error) {
        console.error('Error fetching blood requests:', error);
        showToast('warning', 'Blood Requests', 'ब्लड रिक्वेस्ट डेटा लोड नहीं हो पाया। बाद में refresh करें।');
        return [];
    }
}

// Load all data from API
async function loadDataFromAPI() {
    isLoading = true;
    showLoadingState();
    
    try {
        // Fetch hospitals and blood requests
        const [hospitals, blood] = await Promise.all([
            fetchHospitals(),
            fetchBloodRequests()
        ]);
        
        hospitalsData = hospitals;
        bloodRequests = blood;
        snapshotDoctorDbStatuses(hospitalsData);
        applyEffectiveDoctorStatuses(hospitalsData);
        lastDataRefreshTime = Date.now();
        
        console.log('Data loaded from API:', {
            hospitals: hospitalsData.length,
            bloodRequests: bloodRequests.length
        });
        
        isLoading = false;
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        isLoading = false;
        showError('Data Load Error', 'डेटा लोड करने में समस्या आई। कृपया बाद में फिर से try करें।');
        return false;
    }
}

// Show loading state
function showLoadingState() {
    const grid = document.getElementById('hospitalsGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading data...</p>
            </div>
        `;
    }
}

// Refresh data from API
async function refreshData() {
    showInfo('Refreshing', 'Data refresh हो रहा है...');
    await loadDataFromAPI();
    renderPage();
    showSuccess('Updated', 'Data successfully updated!');
}

// 24 hours in milliseconds
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// Get active blood requests (less than 24 hours old)
function getActiveBloodRequests() {
    const now = new Date().getTime();
    return bloodRequests.filter(request => {
        const timeDiff = now - request.createdAt;
        return timeDiff < TWENTY_FOUR_HOURS;
    });
}

// Format date for display
function formatBloodDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Get remaining time for blood request
function getRemainingTime(createdAt) {
    const now = new Date().getTime();
    const expiresAt = createdAt + TWENTY_FOUR_HOURS;
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m बाकी`;
}

// Auto cleanup expired blood requests
function cleanupExpiredBloodRequests() {
    const now = new Date().getTime();
    bloodRequests = bloodRequests.filter(request => {
        const timeDiff = now - request.createdAt;
        return timeDiff < TWENTY_FOUR_HOURS;
    });
}

// Run cleanup every hour
setInterval(cleanupExpiredBloodRequests, 60 * 60 * 1000);

// Re-check OPD timing every minute — auto छुट्टी after hours
setInterval(() => {
    if (!hospitalsData.length) return;
    const changed = applyEffectiveDoctorStatuses(hospitalsData);
    if (changed) rerenderCurrentView();
}, 60 * 1000);

// ==================== LOCATION FUNCTIONS ====================

// Calculate distance between two coordinates (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Get user's location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation not supported');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                locationEnabled = true;
                resolve(userLocation);
            },
            (error) => {
                locationEnabled = false;
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}

// City fallback coordinates (when hospital has no lat/lng in DB) - approximate center
const cityFallbackCoords = {
    'bilaspur': { lat: 22.0796, lng: 82.1394 },
    'raipur': { lat: 21.2514, lng: 81.6296 },
    'durg': { lat: 21.1900, lng: 81.2800 },
    'bhilai': { lat: 21.2167, lng: 81.4333 },
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'lucknow': { lat: 26.8467, lng: 80.9462 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 }
};

function getHospitalCoords(hospital) {
    const hasDbCoords = hospital.lat != null && hospital.lng != null &&
        !isNaN(Number(hospital.lat)) && !isNaN(Number(hospital.lng));
    if (hasDbCoords) return { lat: Number(hospital.lat), lng: Number(hospital.lng) };
    const cityKey = (hospital.city || hospital.location || '').toString().toLowerCase().trim();
    const fallback = cityFallbackCoords[cityKey];
    return fallback || null;
}

// Get hospitals sorted by distance
function getHospitalsByDistance() {
    if (!locationEnabled || !userLocation) {
        return hospitalsData;
    }
    
    return hospitalsData.map(hospital => {
        const coords = getHospitalCoords(hospital);
        const distance = coords
            ? calculateDistance(
                userLocation.lat, userLocation.lng,
                coords.lat, coords.lng
            )
            : null;
        return { ...hospital, distance };
    }).sort((a, b) => {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
    });
}

// Format distance for display
function formatDistance(distance) {
    if (distance < 1) {
        return `${Math.round(distance * 1000)} मीटर`;
    }
    return `${distance.toFixed(1)} km`;
}

// Don't auto-request location on load (mobile browsers block it without user gesture)
// User taps 📍 in search bar to trigger requestLocation()
function initializeLocation() {
    locationEnabled = false;
    userLocation = null;
}

function setSearchLocationActive(active) {
    const locBtn = document.getElementById('searchLocationBtn');
    if (!locBtn) return;
    locBtn.classList.toggle('active', !!active);
    const label = active
        ? 'Location चालू है — नज़दीकी हॉस्पिटल दिख रहे हैं'
        : 'नज़दीकी हॉस्पिटल — Location चालू करें';
    locBtn.title = label;
    locBtn.setAttribute('aria-label', label);
}

async function tryRestoreLocation() {
    let mayUseLocation = sessionStorage.getItem('locationGranted') === '1';
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'granted') mayUseLocation = true;
            if (status.state === 'denied') mayUseLocation = false;
        } catch (_) { /* Safari / older browsers */ }
    }
    if (!mayUseLocation) return;
    try {
        await getUserLocation();
        setSearchLocationActive(true);
        rerenderCurrentView();
    } catch (_) {
        sessionStorage.removeItem('locationGranted');
        setSearchLocationActive(false);
    }
}

function parseSavedView() {
    const raw = localStorage.getItem('currentView');
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && data.type) return data;
    } catch (_) {
        /* legacy plain strings like cityType — ignore */
    }
    localStorage.removeItem('currentView');
    return null;
}

function applySavedView(view) {
    if (!view || !view.type) {
        renderPage();
        return;
    }
    switch (view.type) {
        case 'doctors':
            showDoctorsByStatus(view.hospitalId, view.status);
            break;
        case 'blood':
            showBloodUpdates(view.hospitalId);
            break;
        case 'hospital':
            showHospitalOverview(view.hospitalId);
            break;
        case 'specialty':
            filterBySpecialty(view.specialty);
            break;
        case 'city':
            showCitySearch();
            break;
        case 'cityFilter':
            filterByCity(view.cityId);
            break;
        default:
            renderPage();
    }
}

function restoreSavedView() {
    currentPage = 1;
    applySavedView(parseSavedView());
}

function rerenderCurrentView() {
    applySavedView(parseSavedView());
}

// Format last update time for display
function formatLastUpdate(updatedAt) {
    if (!updatedAt) return '';
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return 'अंतिम अपडेट: आज ' + d.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
    return 'अंतिम अपडेट: ' + d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
}

// One-time rating: localStorage flag so user can rate only once per device
const RATED_FLAG_KEY = 'hospital_user_has_rated';

function hasUserRated() {
    try {
        return localStorage.getItem(RATED_FLAG_KEY) === 'true';
    } catch (e) { return false; }
}

// Submit hospital rating (1-5) and update card display
async function submitHospitalRating(hospitalId, rating) {
    try {
        const res = await fetch(`${API_URL}/hospitals/${hospitalId}/rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: rating })
        });
        let data;
        try {
            data = await res.json();
        } catch (_) {
            showToast('error', 'Error', 'सर्वर से जवाब नहीं मिला। बाद में कोशिश करें।');
            return;
        }
        if (!res.ok) {
            const msg = (data && data.error) || 'रेटिंग सबमिट नहीं हो पाई।';
            showToast('error', 'Error', msg);
            return;
        }
        const avg = data.avg_rating != null ? parseFloat(data.avg_rating) : rating;
        const count = data.rating_count != null ? Number(data.rating_count) : 1;
        updateCardRatingDisplay(hospitalId, avg, count);
        localStorage.setItem(RATED_FLAG_KEY, 'true');
        hideRatingInputsOnAllCards();
        showToast('success', 'धन्यवाद!', 'आपकी रेटिंग सबमिट हो गई।');
    } catch (e) {
        showToast('error', 'Error', 'नेटवर्क एरर। सर्वर चल रहा है? पोर्ट ' + (API_URL.match(/[\d]+/) || ['5006'])[0] + ' चेक करें।');
    }
}

// Hide "रेट करें" inputs on all cards (after one-time rating)
function hideRatingInputsOnAllCards() {
    document.querySelectorAll('.rating-rate-wrap').forEach(el => { el.style.display = 'none'; });
}

// Update rating stars/count in the card without full re-render
function updateCardRatingDisplay(hospitalId, avgRating, ratingCount) {
    const container = document.querySelector(`.card-rating-row[data-hospital-id="${hospitalId}"]`);
    if (!container) return;
    const starsWrap = container.querySelector('.rating-stars-display');
    const countWrap = container.querySelector('.rating-count');
    const avgWrap = container.querySelector('.rating-avg');
    if (starsWrap) starsWrap.innerHTML = getRatingStarsHTML(avgRating, false);
    if (countWrap) countWrap.textContent = `(${ratingCount} रेटिंग)`;
    if (avgWrap) avgWrap.textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';
}

// Stars HTML: filled vs empty (for display only, no click)
function getRatingStarsHTML(avg, interactive) {
    const full = Math.floor(avg);
    const half = avg - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    let html = '';
    for (let i = 0; i < full; i++) html += '<span class="star filled">★</span>';
    if (half) html += '<span class="star half">★</span>';
    for (let i = 0; i < empty; i++) html += '<span class="star">☆</span>';
    return html;
}

// Validate search input
function validateSearch(query) {
    if (query.length < 2) {
        showWarning('Search', 'कृपया कम से कम 2 अक्षर लिखें');
        return false;
    }
    return true;
}

// Featured doctors shown in search (admin/API only — no hardcoded demo rows)
let featuredDoctors = [];

// Maximum hospitals to show
const MAX_HOSPITALS = 5;

// Current filter state
let currentFilter = 'all';
let currentCity = '';
let currentSearch = '';

const THEME_STORAGE_KEY = 'medicheck-theme';

function applyMedicheckTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch (e) { /* private mode etc. */ }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', t === 'light' ? '#f8fafc' : '#000000');
    }

    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.textContent = t === 'dark' ? '☀️' : '🌙';
        btn.title = t === 'dark' ? 'हल्की थीम पर जाएँ' : 'गहरी थीम पर जाएँ';
        btn.setAttribute('aria-label', t === 'dark' ? 'हल्की थीम चालू करें' : 'गहरी थीम चालू करें');
    }
}

function initMedicheckTheme() {
    let stored = null;
    try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) { /* ignore */ }
    if (stored === 'light' || stored === 'dark') {
        applyMedicheckTheme(stored);
    } else {
        applyMedicheckTheme('light');
    }

    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.addEventListener('click', function () {
            const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            applyMedicheckTheme(cur === 'dark' ? 'light' : 'dark');
        });
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    if (!window.location.hash) {
        window.scrollTo(0, 0);
    }

    initMedicheckTheme();

    // Load data from API first
    await loadDataFromAPI();

    const from404 = sessionStorage.getItem('lh404Search');
    if (from404) {
        sessionStorage.removeItem('lh404Search');
        const searchInput404 = document.getElementById('searchInput');
        if (searchInput404) {
            searchInput404.value = from404;
            searchHospitals();
        }
    }
    
    restoreSavedView();
    
    // Initialize location (async) — restore if user allowed earlier
    initializeLocation();
    await tryRestoreLocation();
    
    // Add event listeners for smart search
    const searchInput = document.getElementById('searchInput');
    const suggestionsDiv = document.getElementById('searchSuggestions');
    if (!searchInput || !suggestionsDiv) return;
    
    searchInput.addEventListener('input', function(e) {
        const value = e.target.value.trim();
        
        if (value.length >= 1) {
            showSmartSuggestions(value);
        } else {
            hideSuggestions();
            hideSearchError();
            renderPage();
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-container')) {
            hideSuggestions();
        }
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchHospitals();
            hideSuggestions();
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });
});

// Render full page - only hospital cards on home
// ==================== PAGINATION SYSTEM ====================

// Generate pagination HTML
function generatePaginationHTML(totalItems, currentPage, paginationType) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    if (totalPages <= 1) return '';
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
             onclick="changePage(${currentPage - 1}, '${paginationType}')" 
             ${currentPage === 1 ? 'disabled' : ''}>
             ◀ पिछला
             </button>`;
    
    // Page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage(1, '${paginationType}')">1</button>`;
        if (startPage > 2) html += '<span class="page-dots">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                 onclick="changePage(${i}, '${paginationType}')">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
        html += `<button class="page-btn" onclick="changePage(${totalPages}, '${paginationType}')">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
             onclick="changePage(${currentPage + 1}, '${paginationType}')" 
             ${currentPage === totalPages ? 'disabled' : ''}>
             अगला ▶
             </button>`;
    
    html += '</div>';
    
    // Page info
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
    html += `<div class="pagination-info">${startItem}-${endItem} of ${totalItems}</div>`;
    
    return html;
}

// Change page function
function changePage(page, paginationType) {
    currentPage = page;
    currentPaginationType = paginationType;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Re-render based on type
    const view = parseSavedView();
    
    if (paginationType === 'hospitals') {
        renderPage();
    } else if (paginationType === 'doctors') {
        if (view && view.type === 'doctors') {
            showDoctorsByStatus(view.hospitalId, view.status);
        }
    } else if (paginationType === 'specialty') {
        if (view && view.type === 'specialty') {
            filterBySpecialty(view.specialty);
        }
    } else if (paginationType === 'blood') {
        if (view && view.type === 'blood') {
            showBloodUpdates(view.hospitalId);
        }
    } else if (paginationType === 'city') {
        const cityFilter = localStorage.getItem('cityFilter');
        if (cityFilter) {
            filterByCity(cityFilter);
        }
    }
}

// Get paginated items
function getPaginatedItems(items, page) {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
}

function renderPage() {
    const grid = document.getElementById('hospitalsGrid');
    currentPaginationType = 'hospitals';
    
    let html = '';
    
    // Specialty filter buttons (fixed)
    html += getSpecialtyButtonsHTML(true);
    
    // Get hospitals (sorted by distance if location enabled)
    const hospitals = getHospitalsByDistance();
    const totalHospitals = hospitals.length;
    const paginatedHospitals = getPaginatedItems(hospitals, currentPage);
    
    // Render Hospital Cards
    html += '<div class="hospitals-list">';
    if (totalHospitals === 0) {
        html += `
            <div class="no-results">
                <p>अभी कोई हॉस्पिटल दर्ज नहीं है। Admin panel से अस्पताल जोड़ें।</p>
            </div>
        `;
    } else {
        html += paginatedHospitals.map(hospital => renderHospitalCard(hospital)).join('');
    }
    html += '</div>';
    
    // Add pagination
    html += generatePaginationHTML(totalHospitals, currentPage, 'hospitals');
    
    grid.innerHTML = html;
}

// Request location permission (called on search bar 📍 tap = user gesture, so mobile shows prompt)
async function requestLocation() {
    const locBtn = document.getElementById('searchLocationBtn');
    if (locBtn) {
        locBtn.disabled = true;
        locBtn.classList.add('loading');
        locBtn.setAttribute('aria-busy', 'true');
    }
    try {
        await getUserLocation();
        sessionStorage.setItem('locationGranted', '1');
        setSearchLocationActive(true);
        showSuccess('Location Enabled', 'आपकी location से नज़दीकी हॉस्पिटल दिख रहे हैं');
        renderPage();
    } catch (error) {
        sessionStorage.removeItem('locationGranted');
        setSearchLocationActive(false);
        showError('Location Error', 'कृपया browser settings में location permission दें या बाद में दोबारा try करें।');
    } finally {
        if (locBtn) {
            locBtn.disabled = false;
            locBtn.classList.remove('loading');
            locBtn.removeAttribute('aria-busy');
        }
    }
}

// Specialty mapping (English to Hindi keywords)
const specialtyMapping = {
    'orthopedic': ['ऑर्थोपेडिक', 'हड्डी', 'orthopedic', 'bone'],
    'heart': ['कार्डियोलॉजी', 'कार्डियक', 'हृदय', 'heart', 'cardio'],
    'child': ['पीडियाट्रिक्स', 'बाल', 'child', 'pediatric'],
    'skin': ['डर्मेटोलॉजी', 'त्वचा', 'skin', 'derma'],
    'eye': ['ऑप्थल्मोलॉजी', 'आंख', 'eye', 'ophthal']
};

// Specialty labels in Hindi
const specialtyLabels = {
    'orthopedic': '🦴 हड्डी का डॉक्टर',
    'heart': '❤️ हृदय रोग विशेषज्ञ',
    'child': '👶 बाल रोग विशेषज्ञ',
    'skin': '🧴 त्वचा रोग विशेषज्ञ',
    'eye': '👁️ आंख का डॉक्टर'
};

// Filter by specialty
function filterBySpecialty(specialty) {
    // Save current view to localStorage
    localStorage.setItem('currentView', JSON.stringify({
        type: 'specialty',
        specialty: specialty
    }));
    
    currentPaginationType = 'specialty';
    
    const keywords = specialtyMapping[specialty] || [];
    
    // Find all doctors matching specialty from all hospitals
    let matchingDoctors = [];
    
    hospitalsData.forEach(hospital => {
        hospital.doctors.forEach(doctor => {
            const specialtyLower = doctor.specialty.toLowerCase();
            const isMatch = keywords.some(keyword => 
                specialtyLower.includes(keyword.toLowerCase())
            );
            
            if (isMatch) {
                matchingDoctors.push({
                    ...doctor,
                    hospitalName: hospital.name,
                    hospitalId: hospital.id
                });
            }
        });
    });
    
    const totalDoctors = matchingDoctors.length;
    const paginatedDoctors = getPaginatedItems(matchingDoctors, currentPage);
    
    const statusLabels = {
        'available': 'उपलब्ध',
        'busy': 'व्यस्त',
        'leave': 'छुट्टी पर'
    };
    
    const statusColors = {
        'available': 'green',
        'busy': 'orange',
        'leave': 'red'
    };
    
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <!-- Specialty Header -->
        <div class="specialty-header">
            <h2>${specialtyLabels[specialty] || specialty}</h2>
            <p>कुल ${totalDoctors} डॉक्टर मिले</p>
        </div>
        
        <!-- Doctor Cards Grid -->
        <div class="doctor-cards-grid">
    `;
    
    if (paginatedDoctors.length > 0) {
        html += paginatedDoctors.map(doctor =>
            getDoctorCardFullHTML(doctor, doctor.hospitalName, doctor.hospitalId || doctor.hospital_id, statusLabels, statusColors)
        ).join('');
    } else {
        html += `
            <div class="no-doctors-found">
                <p>इस विशेषज्ञता के कोई डॉक्टर नहीं मिले</p>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add pagination
    html += generatePaginationHTML(totalDoctors, currentPage, 'specialty');
    
    grid.innerHTML = html;
}

function getCityButtons() {
    try {
        const saved = localStorage.getItem('cityButtons');
        if (!saved) return [];
        const arr = JSON.parse(saved);
        return Array.isArray(arr) ? arr : [];
    } catch (_) {
        return [];
    }
}

// Show City Search (simple buttons from localStorage)
function showCitySearch() {
    localStorage.setItem('currentView', JSON.stringify({ type: 'city' }));
    const grid = document.getElementById('hospitalsGrid');
    const list = getCityButtons();
    if (!list.length) {
        grid.innerHTML = `
            ${getSpecialtyButtonsHTML()}
            <div class="no-results">
                <p>अभी कोई शहर बटन सेट नहीं है। Admin panel → Cities से जोड़ें।</p>
            </div>
        `;
        return;
    }
    grid.innerHTML = `
        ${getSpecialtyButtonsHTML()}
        <div class="city-search-header">
            <h2>🏙️ शहर के अनुसार खोजें</h2>
            <p>अपना शहर चुनें और हॉस्पिटल देखें</p>
        </div>
        <div class="city-buttons-grid">
            ${list.map(city => `
                <button class="city-btn" onclick="filterByCity('${sanitizeHTML(city.value || '')}')">
                    📍 ${sanitizeHTML(city.name || '')}
                </button>
            `).join('')}
        </div>
    `;
}

// Filter by City
function filterByCity(cityValue) {
    localStorage.setItem('currentView', JSON.stringify({ type: 'cityFilter', cityId: cityValue }));
    localStorage.setItem('cityFilter', cityValue);
    currentPaginationType = 'city';
    
    const list = getCityButtons();
    const city = list.find(c => (c.value || '') === cityValue);
    const filteredHospitals = hospitalsData.filter(h => h.city === cityValue);
    const totalHospitals = filteredHospitals.length;
    const paginatedHospitals = getPaginatedItems(filteredHospitals, currentPage);
    
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <!-- City Header -->
        <div class="city-search-header">
            <h2>📍 ${city ? sanitizeHTML(city.name) : cityValue} के हॉस्पिटल</h2>
            <p>कुल ${totalHospitals} हॉस्पिटल मिले</p>
        </div>
        
        <!-- Hospital Cards -->
        <div class="hospitals-list">
    `;
    
    if (paginatedHospitals.length > 0) {
        html += paginatedHospitals.map(hospital => renderHospitalCard(hospital)).join('');
    } else {
        html += `
            <div class="no-results">
                <p>इस शहर में कोई हॉस्पिटल नहीं मिला</p>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add pagination
    html += generatePaginationHTML(totalHospitals, currentPage, 'city');
    
    grid.innerHTML = html;
}

// Get specialty buttons HTML (fixed buttons above hospitals)
function getSpecialtyButtonsHTML(activeFirst) {
    return `
        <div class="specialty-filters">
            <button class="specialty-btn${activeFirst ? ' active' : ''}" onclick="goBackToHospitals()">🏠 Home</button>
            <button class="specialty-btn" onclick="filterBySpecialty('orthopedic')">🦴 हड्डी का डॉ</button>
            <button class="specialty-btn" onclick="filterBySpecialty('heart')">❤️ हृदय रोग</button>
            <button class="specialty-btn" onclick="filterBySpecialty('child')">👶 बाल रोग</button>
            <button class="specialty-btn" onclick="filterBySpecialty('skin')">🧴 त्वचा रोग</button>
            <button class="specialty-btn" onclick="showCitySearch()">🏙️ City</button>
        </div>
    `;
}

// Show Blood Updates for specific hospital
function showHospitalOverview(hospitalId) {
    const hospital = hospitalsData.find(h => h.id === hospitalId);
    if (!hospital) return;

    localStorage.setItem('currentView', JSON.stringify({
        type: 'hospital',
        hospitalId: hospitalId
    }));

    currentPaginationType = 'hospital';

    const typeLabel = hospital.type === 'GOV' ? 'सरकारी हॉस्पिटल' : 'प्राइवेट हॉस्पिटल';
    const availableCount = hospital.doctors.filter(d => d.status === 'available').length;
    const busyCount = hospital.doctors.filter(d => d.status === 'busy').length;
    const leaveCount = hospital.doctors.filter(d => d.status === 'leave').length;
    const totalDoctors = hospital.doctors.length;
    const distanceHTML = (hospital.distance != null && !isNaN(hospital.distance))
        ? `<p class="hospital-overview-line">📍 दूरी: ${formatDistance(hospital.distance)}</p>`
        : '';
    const lastUpdateText = formatLastUpdate(hospital.updated_at);
    const lastUpdateHTML = lastUpdateText ? `<p class="hospital-overview-meta">${lastUpdateText}</p>` : '';

    const grid = document.getElementById('hospitalsGrid');
    grid.innerHTML = getSpecialtyButtonsHTML() + `
        <div class="hospital-overview-card">
            <button type="button" class="btn-back" onclick="goBackToHospitals()">← वापस</button>
            <div class="hospital-overview-header">
                <h2>🏥 ${escapeHtml(hospital.name)}</h2>
                <p class="hospital-overview-line">📍 ${escapeHtml(hospital.location)}</p>
                <p class="hospital-overview-line">🏢 ${typeLabel}</p>
                ${distanceHTML}
                <p class="hospital-overview-line">👨‍⚕️ कुल डॉक्टर: <strong>${totalDoctors}</strong></p>
                ${lastUpdateHTML}
            </div>
            <div class="hospital-overview-stats">
                <div class="hospital-overview-stat available">
                    <span class="dot green"></span>
                    <span>उपलब्ध</span>
                    <strong>${availableCount}</strong>
                </div>
                <div class="hospital-overview-stat busy">
                    <span class="dot orange"></span>
                    <span>व्यस्त</span>
                    <strong>${busyCount}</strong>
                </div>
                <div class="hospital-overview-stat leave">
                    <span class="dot red"></span>
                    <span>छुट्टी</span>
                    <strong>${leaveCount}</strong>
                </div>
            </div>
            <div class="hospital-overview-actions">
                <button type="button" class="card-cta" onclick="showDoctorsByStatus(${hospital.id}, 'available')">
                    <span class="cta-icon">👨‍⚕️</span>
                    <span class="cta-text">डॉक्टर देखें</span>
                </button>
                <button type="button" class="card-dept-btn card-dept-blood hospital-overview-blood" onclick="showBloodUpdates(${hospital.id})">
                    <span class="dept-btn-icon" aria-hidden="true">🩸</span>
                    <span class="dept-btn-text">Blood Dept</span>
                </button>
            </div>
        </div>
    `;
}

function showBloodUpdates(hospitalId) {
    // Save current view to localStorage
    localStorage.setItem('currentView', JSON.stringify({
        type: 'blood',
        hospitalId: hospitalId
    }));
    
    currentPaginationType = 'blood';
    
    // Cleanup expired requests first
    cleanupExpiredBloodRequests();
    
    // Get hospital info
    const hospital = hospitalsData.find(h => h.id === hospitalId);
    
    // Filter blood requests for this hospital only
    const activeRequests = getActiveBloodRequests().filter(r => r.hospitalId === hospitalId);
    const totalRequests = activeRequests.length;
    const paginatedRequests = getPaginatedItems(activeRequests, currentPage);
    
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <!-- Blood Header Card -->
        <div class="blood-department-card">
            <div class="blood-header">
                <div class="blood-header-left">
                    <h2>🩸 Blood Department Updates (${totalRequests})</h2>
                    <p>🏥 <span>${hospital.name}</span></p>
                    <p class="urgent-text">Urgent Blood Requests</p>
                </div>
                <span class="alert-badge">ALERT</span>
            </div>
        </div>
        
        <!-- Blood Request Cards Grid -->
        <div class="blood-requests-grid">
    `;
    
    if (paginatedRequests.length > 0) {
        html += paginatedRequests.map(request => `
            <div class="blood-request-card">
                <div class="blood-request-top">
                    <div class="blood-request-header">
                        <div class="blood-type">
                            <span class="blood-icon">🩸</span>
                            <span class="blood-group">${request.bloodType}</span>
                        </div>
                        <div class="blood-date">⏱ ${formatBloodDate(request.createdAt)}</div>
                    </div>
                    <p class="blood-hospital">🏥 ${request.hospital}</p>
                </div>
                <div class="blood-request-body">
                    <p class="blood-message">📋 ${request.urgent ? 'Urgent' : ''} ${request.message}</p>
                    <p class="blood-remaining-time">⏳ ${getRemainingTime(request.createdAt)}</p>
                    <button class="btn-whatsapp-blood">WhatsApp Share</button>
                </div>
            </div>
        `).join('');
    } else {
        html += `
            <div class="no-blood-requests">
                <p>🩸 इस हॉस्पिटल में कोई active blood request नहीं है</p>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add pagination
    html += generatePaginationHTML(totalRequests, currentPage, 'blood');
    
    grid.innerHTML = html;
}

// Department/specialty icon for doctor avatar (professional look)
function getDoctorIcon(specialty) {
    if (!specialty) return '👨‍⚕️';
    const s = (specialty + '').toLowerCase();
    if (s.includes('हृदय') || s.includes('heart') || s.includes('cardio')) return '❤️';
    if (s.includes('हड्डी') || s.includes('bone') || s.includes('ortho')) return '🦴';
    if (s.includes('बाल') || s.includes('child') || s.includes('pediatr')) return '👶';
    if (s.includes('त्वचा') || s.includes('skin') || s.includes('derma')) return '🧴';
    if (s.includes('आंख') || s.includes('eye') || s.includes('ophthal')) return '👁️';
    if (s.includes('स्त्री') || s.includes('gyn')) return '🩺';
    return '👨‍⚕️';
}

// Experience badge above avatar – e.g. "15Y" from "15 वर्ष"
function getDoctorExperienceBadgeHTML(doctor) {
    if (!doctor || !doctor.experience) return '';
    const exp = String(doctor.experience).trim();
    const num = exp.replace(/\D/g, '');
    if (!num) return '';
    return `<span class="doctor-exp-badge">${escapeHtml(num)}Y</span>`;
}

// Qualification tags (MBBS, MD, Senior Resident etc.) – comma-separated from doctor.qualification
function getDoctorQualificationTagsHTML(doctor) {
    if (!doctor || typeof doctor !== 'object') return '';
    const qual = (doctor.qualification ?? doctor.Qualification ?? '').toString().trim();
    const tags = [];
    if (qual) {
        qual.split(',').forEach(t => {
            const v = t.trim();
            if (v) tags.push(`<span class="doctor-tag">${escapeHtml(v)}</span>`);
        });
    }
    /* Experience shown as badge on avatar (15Y), not here */
    if (tags.length === 0) return '<div class="doctor-tags doctor-tags-empty"><span class="doctor-tag-placeholder">योग्यता जोड़ी नहीं गई</span></div>';
    return `<div class="doctor-tags">${tags.join('')}</div>`;
}

// Room & floor text for card: रूम नं. X | मंजिल Y, ब्लॉक Z
function getDoctorRoomFloorHTML(doctor) {
    if (!doctor || typeof doctor !== 'object') return '';
    const roomNo = (doctor.room_no ?? doctor.roomNo ?? '').toString().trim();
    const floor = (doctor.floor ?? doctor.Floor ?? '').toString().trim();
    const block = (doctor.block ?? doctor.Block ?? '').toString().trim();
    const parts = [];
    if (roomNo) parts.push('रूम नं. ' + escapeHtml(roomNo));
    const floorBlock = [];
    if (floor) floorBlock.push(escapeHtml(floor) + ' मंजिल');
    if (block) floorBlock.push('ब्लॉक-' + escapeHtml(block));
    if (floorBlock.length) parts.push(floorBlock.join(', '));
    if (parts.length === 0) return '<p class="doctor-room-floor doctor-room-floor-empty">📍 रूम/मंजिल: जानकारी उपलब्ध नहीं</p>';
    return `<p class="doctor-room-floor">📍 ${parts.join(' | ')}</p>`;
}

// Specialization as pills – specialty + sub_specialization (responsive, flex-wrap)
function getDoctorSpecialtyPillsHTML(doctor) {
    if (!doctor || typeof doctor !== 'object') return '';
    const pills = [];
    const specialty = (doctor.specialty ?? '').toString().trim();
    const subSpec = (doctor.sub_specialization ?? doctor.subSpecialization ?? '').toString().trim();
    if (specialty) pills.push(`<span class="doctor-specialty-pill">${escapeHtml(specialty)}</span>`);
    if (subSpec) pills.push(`<span class="doctor-specialty-pill doctor-specialty-pill-sub">${escapeHtml(subSpec)}</span>`);
    if (pills.length === 0) return '<div class="doctor-specialty-pills"><span class="doctor-specialty-pill doctor-specialty-pill-empty">विशेषज्ञता: जानकारी उपलब्ध नहीं</span></div>';
    return `<div class="doctor-specialty-pills">${pills.join('')}</div>`;
}

// OPD box – structured layout (OPD days, block/floor | OPD time, room)
function getDoctorOPDBoxHTML(doctor) {
    const opdDays = (doctor.opd_days ?? doctor.opd ?? 'Mon,Tue,Wed,Thu,Fri,Sat').toString().trim();
    const timing = (doctor.timing ?? '—').toString().trim();
    const roomNo = (doctor.room_no ?? doctor.roomNo ?? '').toString().trim();
    const floor = (doctor.floor ?? doctor.Floor ?? '').toString().trim();
    const block = (doctor.block ?? doctor.Block ?? '').toString().trim();
    const blockFloor = [block, floor].filter(Boolean).map(escapeHtml).join(', ') || '—';
    return `
        <div class="doctor-opd-box">
            <div class="doctor-opd-box-col">
                <span class="doctor-opd-label">OPD के दिन</span>
                <span class="doctor-opd-value">${escapeHtml(opdDays)}</span>
                <span class="doctor-opd-label">ब्लॉक/फ्लोर</span>
                <span class="doctor-opd-value">${blockFloor}</span>
            </div>
            <div class="doctor-opd-box-col">
                <span class="doctor-opd-label">OPD समय</span>
                <span class="doctor-opd-value">${escapeHtml(timing)}</span>
                <span class="doctor-opd-label">कमरा नंबर</span>
                <span class="doctor-opd-value">${roomNo ? 'कक्ष संख्या ' + escapeHtml(roomNo) : '—'}</span>
            </div>
        </div>
    `;
}

// Action buttons for doctor card (Ayushman, View Details)
function getDoctorCardButtonsHTML(doctor, hospitalId) {
    const hid = hospitalId || doctor.hospital_id || doctor.hospitalId;
    if (!hid) return '';
    return `
        <div class="doctor-card-buttons">
            <button type="button" class="btn-ayushman" onclick="event.stopPropagation();">आयुष्मान कार्ड</button>
            <button type="button" class="btn-detail btn-detail-primary" onclick="event.stopPropagation(); showDoctorDetails(${hid}, ${doctor.id})">पूरी जानकारी देखें</button>
        </div>
    `;
}

// Desktop – पहले जैसा doctor card (>= 768px)
function getDoctorCardDesktopHTML(doctor, hospitalName, hospitalId, statusLabels, statusColors) {
    const feedback = getDoctorFeedback(doctor.id);
    return `
        <div class="doctor-card doctor-card-desktop" data-doctor-id="${doctor.id}">
            <div class="doctor-feedback" aria-label="उपलब्ध है?">
                <div class="doctor-feedback-thumbs">
                    <button type="button" class="thumb-btn ${feedback === 'up' ? 'active' : ''}" data-thumb="up" onclick="submitDoctorFeedback(${doctor.id}, 'up')" title="सटीक था">👍</button>
                    <button type="button" class="thumb-btn ${feedback === 'down' ? 'active' : ''}" data-thumb="down" onclick="submitDoctorFeedback(${doctor.id}, 'down')" title="सटीक नहीं था">👎</button>
                </div>
                <span class="doctor-feedback-label">उपलब्ध है?</span>
            </div>
            <div class="doctor-card-inner">
                <div class="doctor-card-main">
                    <div class="doctor-name-row">
                        <div class="doctor-avatar-wrap">
                            ${getDoctorExperienceBadgeHTML(doctor)}
                            <span class="doctor-avatar" aria-hidden="true">${getDoctorIcon(doctor.specialty)}</span>
                        </div>
                        <h3 class="doctor-name">${doctor.name}</h3>
                    </div>
                    ${getDoctorQualificationTagsHTML(doctor)}
                    ${getDoctorSpecialtyPillsHTML(doctor)}
                </div>
                <div class="doctor-card-side">
                    <span class="doctor-status-badge ${statusColors[doctor.status]}">
                        <span class="dot ${statusColors[doctor.status]}"></span> ${statusLabels[doctor.status]}
                    </span>
                    <p class="doctor-hospital">🏥 ${escapeHtml(hospitalName || '')}</p>
                    ${getDoctorRoomFloorHTML(doctor)}
                </div>
            </div>
            <div class="doctor-card-divider"></div>
            ${getDoctorOPDBoxHTML(doctor)}
            ${getDoctorCardButtonsHTML(doctor, hospitalId)}
        </div>
    `;
}

// Mobile – dh-card design (< 768px)
function getDoctorDhCardHTML(doctor, hospitalName, hospitalId, statusLabels, statusColors) {
    const status = doctor.status || 'available';
    const liveLabel = (statusLabels && statusLabels[status]) || 'उपलब्ध';
    const liveClass = status === 'available' ? '' : (status === 'busy' ? ' busy' : ' leave');
    const opdDays = (doctor.opd_days ?? doctor.opd ?? 'Mon,Tue,Wed,Thu,Fri,Sat').toString().trim();
    const timing = (doctor.timing ?? '—').toString().trim();
    const roomNo = (doctor.room_no ?? doctor.roomNo ?? '').toString().trim();
    const floor = (doctor.floor ?? doctor.Floor ?? '').toString().trim();
    const block = (doctor.block ?? doctor.Block ?? '').toString().trim();
    const blockFloor = [block, floor].filter(Boolean).map(escapeHtml).join(', ') || '—';
    const qual = (doctor.qualification ?? doctor.Qualification ?? '').toString().trim() || '—';
    const specialty = (doctor.specialty ?? '').toString().trim() || 'विशेषज्ञता उपलब्ध नहीं';
    const hid = hospitalId || doctor.hospital_id || doctor.hospitalId;
    const detailsOnClick = hid ? `onclick="event.stopPropagation(); showDoctorDetails(${hid}, ${doctor.id})"` : '';
    return `
        <div class="doctor-card dh-card doctor-card-mobile" data-doctor-id="${doctor.id}">
            <div class="dh-header">
                <span class="dh-hospital">🏥 ${escapeHtml(hospitalName || doctor.hospitalName || 'हॉस्पिटल')}</span>
                <span class="dh-live${liveClass}">${status === 'available' ? 'आज उपलब्ध है' : liveLabel}</span>
            </div>
            <div class="dh-body">
                <div class="dh-dr-name-row">
                    <h2 class="dh-dr-name">${escapeHtml(doctor.name)}</h2>
                    <span class="doctor-status-badge doctor-status-badge-mobile ${statusColors[doctor.status]} ${status === 'available' ? 'mobile-status-blink' : ''}">
                        <span class="dot ${statusColors[doctor.status]}"></span> ${status === 'available' ? 'उपलब्ध' : liveLabel}
                    </span>
                </div>
                <span class="dh-dr-qual">${escapeHtml(qual)}</span>
                <span class="dh-dept">${escapeHtml(specialty)}</span>
                <div class="dh-grid">
                    <div class="dh-item">
                        <span class="dh-label">OPD के दिन</span>
                        <span class="dh-value">${escapeHtml(opdDays)}</span>
                    </div>
                    <div class="dh-item">
                        <span class="dh-label">OPD समय</span>
                        <span class="dh-value">${escapeHtml(timing)}</span>
                    </div>
                    <div class="dh-item">
                        <span class="dh-label">ब्लॉक/फ्लोर</span>
                        <span class="dh-value">${escapeHtml(blockFloor)}</span>
                    </div>
                    <div class="dh-item">
                        <span class="dh-label">कमरा नंबर</span>
                        <span class="dh-value">${roomNo ? 'कक्ष संख्या ' + escapeHtml(roomNo) : '—'}</span>
                    </div>
                </div>
            </div>
            <div class="dh-actions">
                <button type="button" class="dh-btn btn-ayushman" onclick="event.stopPropagation();">आयुष्मान कार्ड</button>
                <button type="button" class="dh-btn btn-details" ${detailsOnClick}>पूरी जानकारी देखें</button>
            </div>
        </div>
    `;
}

// Full doctor card – Desktop (पहले जैसा) + Mobile (dh-card)
function getDoctorCardFullHTML(doctor, hospitalName, hospitalId, statusLabels, statusColors) {
    return `
        <div class="doctor-card-wrapper" data-doctor-id="${doctor.id}">
            ${getDoctorCardDesktopHTML(doctor, hospitalName, hospitalId, statusLabels, statusColors)}
            ${getDoctorDhCardHTML(doctor, hospitalName, hospitalId, statusLabels, statusColors)}
        </div>
    `;
}

// Quick feedback: thumbs up/down (localStorage, one per doctor)
const DOCTOR_FEEDBACK_KEY = 'doctor_feedback';

function getDoctorFeedback(doctorId) {
    try {
        const raw = localStorage.getItem(DOCTOR_FEEDBACK_KEY);
        const map = raw ? JSON.parse(raw) : {};
        return map[doctorId] || null;
    } catch (e) { return null; }
}

function setDoctorFeedback(doctorId, value) {
    try {
        const raw = localStorage.getItem(DOCTOR_FEEDBACK_KEY) || '{}';
        const map = JSON.parse(raw);
        map[doctorId] = value;
        localStorage.setItem(DOCTOR_FEEDBACK_KEY, JSON.stringify(map));
    } catch (e) {}
}

async function submitDoctorFeedback(doctorId, type) {
    setDoctorFeedback(doctorId, type);
    showToast('success', 'धन्यवाद!', 'आपका फीडबैक रिकॉर्ड हो गया।');
    updateDoctorCardFeedbackUI(doctorId, type);

    try {
        const res = await fetch(`${API_URL}/doctors/${doctorId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: type })
        });
        const data = await res.json().catch(() => ({}));
        if (data.updated && data.newStatus) {
            updateDoctorInData(doctorId, data.newStatus);
            const effective = getEffectiveDoctorStatus(
                hospitalsData.flatMap(h => h.doctors || []).find(d => d.id === doctorId) || { status: data.newStatus, db_status: data.newStatus }
            );
            updateDoctorCardStatusBadge(doctorId, effective);
            showToast('success', 'स्टेटस अपडेट', 'मरीजों के फीडबैक के आधार पर डॉक्टर का स्टेटस अपडेट हो गया।');
        }
    } catch (e) {
        showToast('info', 'Offline', 'फीडबैक स्थानीय रूप से सेव हो गया। ऑनलाइन होने पर सिंक हो जाएगा।');
    }
}

function updateDoctorInData(doctorId, newStatus) {
    hospitalsData.forEach(h => {
        const d = h.doctors && h.doctors.find(doc => doc.id === doctorId);
        if (d) {
            d.db_status = newStatus;
            d.status = getEffectiveDoctorStatus(d);
        }
    });
}

function updateDoctorCardStatusBadge(doctorId, newStatus) {
    const wrapper = document.querySelector(`.doctor-card-wrapper[data-doctor-id="${doctorId}"]`);
    const card = wrapper || document.querySelector(`.doctor-card[data-doctor-id="${doctorId}"]`);
    if (!card) return;
    const labels = { available: 'उपलब्ध', busy: 'व्यस्त', leave: 'छुट्टी पर' };
    const labelsMobile = { available: 'उपलब्ध', busy: 'व्यस्त', leave: 'छुट्टी पर' };
    const colors = { available: 'green', busy: 'orange', leave: 'red' };
    card.querySelectorAll('.doctor-status-badge').forEach(badge => {
        const isMobile = badge.closest('.doctor-card-mobile');
        const txt = isMobile ? (labelsMobile[newStatus] || newStatus) : (labels[newStatus] || newStatus);
        badge.textContent = '';
        badge.className = 'doctor-status-badge ' + (colors[newStatus] || 'green') + (newStatus === 'available' && isMobile ? ' mobile-status-blink' : '');
        badge.innerHTML = `<span class="dot ${colors[newStatus] || 'green'}"></span> ${txt}`;
    });
    const dhLive = card.querySelector('.dh-live');
    if (dhLive) {
        dhLive.textContent = labels[newStatus] || newStatus;
        dhLive.className = 'dh-live' + (newStatus === 'available' ? '' : newStatus === 'busy' ? ' busy' : ' leave');
    }
}

function updateDoctorCardFeedbackUI(doctorId, type) {
    const wrapper = document.querySelector(`.doctor-card-wrapper[data-doctor-id="${doctorId}"]`);
    const card = wrapper || document.querySelector(`.doctor-card[data-doctor-id="${doctorId}"]`);
    if (!card) return;
    const wrap = card.querySelector('.doctor-feedback');
    if (!wrap) return;
    wrap.querySelectorAll('.thumb-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((type === 'up' && btn.dataset.thumb === 'up') || (type === 'down' && btn.dataset.thumb === 'down')) btn.classList.add('active');
    });
}

// Render single featured doctor card
function renderFeaturedDoctorCard(doctor) {
    const statusLabels = { available: 'उपलब्ध', busy: 'व्यस्त', leave: 'छुट्टी पर' };
    const statusColors = { available: 'green', busy: 'orange', leave: 'red' };
    return getDoctorCardFullHTML(doctor, doctor.hospitalName, doctor.hospitalId || doctor.hospital_id, statusLabels, statusColors);
}

// Render single hospital card
function renderHospitalCard(hospital) {
    const availableCount = hospital.doctors.filter(d => d.status === 'available').length;
    const busyCount = hospital.doctors.filter(d => d.status === 'busy').length;
    const leaveCount = hospital.doctors.filter(d => d.status === 'leave').length;
    const totalDoctors = hospital.doctors.length; // Actual count from doctors array
    
    // Convert type to Hindi
    const typeLabel = hospital.type === 'GOV' ? 'सरकारी हॉस्पिटल' : 'प्राइवेट हॉस्पिटल';
    
    // Distance display (only when we have valid lat/lng and user location)
    const distanceHTML = (hospital.distance != null && !isNaN(hospital.distance))
        ? `<span class="distance-badge">📍 ${formatDistance(hospital.distance)}</span>` 
        : '';
    
    // Last update (from API updated_at)
    const lastUpdateText = formatLastUpdate(hospital.updated_at);
    const lastUpdateHTML = lastUpdateText ? `<p class="card-last-update">${lastUpdateText}</p>` : '';
    
    // Rating: avg_rating & rating_count from API (or 0). One-time: if user already rated, don't show "रेट करें" inputs
    const avgRating = parseFloat(hospital.avg_rating) || 0;
    const ratingCount = parseInt(hospital.rating_count, 10) || 0;
    const starsDisplay = getRatingStarsHTML(avgRating, false);
    const alreadyRated = hasUserRated();
    const rateInputHTML = alreadyRated ? '' : `
            <div class="rating-rate-wrap">
                <span class="rating-label">रेट करें:</span>
                <div class="rating-stars-input">
                    ${[1,2,3,4,5].map(s => `<button type="button" class="star-btn" onclick="submitHospitalRating(${hospital.id}, ${s})" title="${s} स्टार" aria-label="${s} स्टार">★</button>`).join('')}
                </div>
            </div>`;
    const ratingRow = `
        <div class="card-rating-row" data-hospital-id="${hospital.id}">
            <div class="rating-stars-display">${starsDisplay}</div>
            <span class="rating-avg">${avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            <span class="rating-count">(${ratingCount} रेटिंग)</span>
            ${rateInputHTML}
        </div>
    `;
    
    const branding = (hospital.card_branding && String(hospital.card_branding).trim()) ? escapeHtml(hospital.card_branding.trim()) : '';
    const brandingHTML = branding ? `<div class="card-branding">${branding}</div>` : '';
    return `
        <article class="hospital-card" role="article">
            ${brandingHTML}
            <div class="card-header-row">
                <div class="card-info">
                    <div class="card-title">
                        <span class="hospital-icon" aria-hidden="true">🏥</span>
                        <h3>${hospital.name}</h3>
                        ${distanceHTML}
                    </div>
                    <p class="info-line">📍 ${hospital.location}</p>
                    <p class="info-line">🏢 ${typeLabel}</p>
                    <p class="total-docs">कुल डॉक्टर: <span>${totalDoctors}</span></p>
                    ${lastUpdateHTML}
                </div>
                <span class="available-badge"><span class="dot green"></span> उपलब्ध</span>
            </div>
            
            ${ratingRow}
            
            <div class="status-boxes" role="group" aria-label="डॉक्टर स्टेटस">
                <div class="status-box">
                    <div class="box-header"><span class="dot green"></span> उपलब्ध</div>
                    <div class="box-count">${availableCount}</div>
                </div>
                <div class="status-box">
                    <div class="box-header"><span class="dot orange"></span> व्यस्त</div>
                    <div class="box-count">${busyCount}</div>
                </div>
                <div class="status-box">
                    <div class="box-header"><span class="dot red"></span> छुट्टी</div>
                    <div class="box-count">${leaveCount}</div>
                </div>
            </div>
            
            <div class="card-actions">
                <button type="button" class="card-cta" onclick="showDoctorsByStatus(${hospital.id}, 'available')">
                    <span class="cta-icon">👨‍⚕️</span>
                    <span class="cta-text">डॉक्टर देखें</span>
                </button>
                <div class="card-quick-actions">
                    <button type="button" class="quick-action quick-blood" onclick="showBloodUpdates(${hospital.id})" title="Blood Updates" aria-label="Blood Updates">
                        <span aria-hidden="true">🩸</span>
                    </button>
                </div>
                <div class="card-mobile-dept-btns">
                    <button type="button" class="card-dept-btn card-dept-hospital" onclick="showHospitalOverview(${hospital.id})" aria-label="Hospital">
                        <span class="dept-btn-icon" aria-hidden="true">🏥</span>
                        <span class="dept-btn-text">Hospital</span>
                    </button>
                    <button type="button" class="card-dept-btn card-dept-blood" onclick="showBloodUpdates(${hospital.id})" aria-label="Blood Dept">
                        <span class="dept-btn-icon" aria-hidden="true">🩸</span>
                        <span class="dept-btn-text">Blood Dept</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

// Filter and render
function filterAndRender() {
    if (currentSearch === '') {
        renderPage();
        return;
    }
    
    // Filter featured doctors
    const filteredDoctors = featuredDoctors.filter(d => 
        d.name.toLowerCase().includes(currentSearch) ||
        d.specialty.toLowerCase().includes(currentSearch) ||
        d.hospitalName.toLowerCase().includes(currentSearch)
    );
    
    // Filter hospitals
    const filteredHospitals = hospitalsData.filter(h => 
        h.name.toLowerCase().includes(currentSearch) ||
        h.location.toLowerCase().includes(currentSearch)
    ).slice(0, MAX_HOSPITALS);
    
    const grid = document.getElementById('hospitalsGrid');
    let html = '';
    
    if (filteredDoctors.length > 0) {
        html += '<div class="section-title-bar"><h3>👨‍⚕️ उपलब्ध डॉक्टर</h3></div>';
        html += '<div class="featured-doctors-grid">';
        html += filteredDoctors.map(doctor => renderFeaturedDoctorCard(doctor)).join('');
        html += '</div>';
    }
    
    if (filteredHospitals.length > 0) {
        html += '<div class="section-title-bar"><h3>🏥 नज़दीकी हॉस्पिटल</h3></div>';
        html += '<div class="hospitals-list">';
        html += filteredHospitals.map(hospital => renderHospitalCard(hospital)).join('');
        html += '</div>';
    }
    
    if (filteredDoctors.length === 0 && filteredHospitals.length === 0) {
        html = `
            <div class="no-results">
                <p>कोई परिणाम नहीं मिला</p>
            </div>
        `;
        showSearchError(`"${currentSearch}" के लिए कोई डॉक्टर या हॉस्पिटल नहीं मिला`);
    } else {
        // Results found - hide error
        hideSearchError();
    }
    
    grid.innerHTML = html;
}

// Show featured doctor details on screen
function showFeaturedDoctorDetails(doctorId) {
    const doctor = featuredDoctors.find(d => d.id === doctorId);
    if (!doctor) return;
    
    const statusLabels = { 'available': 'उपलब्ध', 'busy': 'व्यस्त', 'leave': 'छुट्टी पर' };
    const statusColors = { 'available': 'green', 'busy': 'orange', 'leave': 'red' };
    
    const grid = document.getElementById('hospitalsGrid');
    grid.innerHTML = getSpecialtyButtonsHTML() + `
        <div class="doctor-detail-wrapper">
            <div class="doctor-detail-desktop">
                <div class="doctor-detail-card">
                    <div class="detail-header">
                        <span class="detail-icon">👨‍⚕️</span>
                        <div class="detail-header-info">
                            <h3>${doctor.name}</h3>
                            <p>${doctor.specialty} | ${doctor.location}</p>
                        </div>
                    </div>
                    <div class="detail-main-card">
                        <div class="detail-main-header">
                            <div class="detail-main-info">
                                <h4>👨‍⚕️ ${doctor.name}</h4>
                                <p class="detail-specialty">${doctor.specialty} • ${doctor.location}</p>
                                <p class="detail-hospital">🏥 ${doctor.hospitalName}</p>
                            </div>
                            <span class="detail-status-badge ${statusColors[doctor.status]}">
                                <span class="dot ${statusColors[doctor.status]}"></span> ${statusLabels[doctor.status]}
                            </span>
                        </div>
                        <div class="detail-info-row">
                            <div class="info-box"><p class="info-label">📅 Experience</p><p class="info-value">${doctor.experience || 'N/A'}</p></div>
                            <div class="info-box"><p class="info-label">💰 Fees</p><p class="info-value">${doctor.fees || 'N/A'}</p></div>
                        </div>
                        <div class="detail-opd-row">
                            <div class="opd-box"><p class="opd-label">📅 OPD Days</p><p class="opd-value">${doctor.opd_days || doctor.opd || 'Mon-Sat'}</p></div>
                            <div class="opd-box"><p class="opd-label">🕐 OPD Time</p><p class="opd-value">${doctor.timing || 'N/A'}</p></div>
                        </div>
                        <div class="detail-location">
                            <p class="location-title">📍 OPD Location</p>
                            <div class="location-boxes">
                                <div class="loc-box"><p class="loc-label">Block</p><p class="loc-value">${doctor.block || 'N/A'}</p></div>
                                <div class="loc-box"><p class="loc-label">Room</p><p class="loc-value">${doctor.room_no || 'N/A'}</p></div>
                                <div class="loc-box"><p class="loc-label">Floor</p><p class="loc-value">${doctor.floor || 'N/A'}</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add new doctor (Admin function)
function addFeaturedDoctor(doctor) {
    featuredDoctors.push(doctor);
    renderPage();
}

// Render hospital cards (legacy function for compatibility)
function renderHospitals(hospitals) {
    renderPage();
}

// Filter doctors by current status filter
function filterDoctorsByStatus(doctors) {
    if (currentFilter === 'all') return doctors;
    return doctors.filter(doc => doc.status === currentFilter);
}

// Get status text in Hindi
function getStatusText(status) {
    switch(status) {
        case 'available': return 'उपलब्ध';
        case 'busy': return 'व्यस्त';
        case 'leave': return 'छुट्टी पर';
        default: return status;
    }
}

// ==================== SMART SEARCH FUNCTIONS ====================

// Typo correction: common misspellings
const TYPO_MAP = {
    'punne': 'pune', 'pnue': 'pune', 'puen': 'pune',
    'hopital': 'hospital', 'hospitle': 'hospital', 'hospitel': 'hospital',
    'delhi': 'delhi', 'delli': 'delhi', 'dilhi': 'delhi',
    'mumbai': 'mumbai', 'mumbi': 'mumbai', 'bombay': 'mumbai',
    'docter': 'doctor', 'dactor': 'doctor'
};

// City aliases: Hindi/similar -> canonical
const CITY_ALIASES = {
    'पुणे': 'pune', 'पुना': 'pune', 'दिल्ली': 'delhi', 'मुंबई': 'mumbai', 'बॉम्बे': 'mumbai',
    'लखनऊ': 'lucknow', 'जयपुर': 'jaipur', 'मोहाली': 'mohali', 'गुड़गांव': 'gurugram',
    'रायपुर': 'raipur', 'भिलाई': 'bhilai', 'दुर्ग': 'durg', 'बैंगलोर': 'bangalore',
    'चेन्नई': 'chennai', 'हैदराबाद': 'hyderabad', 'कोलकाता': 'kolkata'
};

// Normalize query: fix typos + expand city aliases for matching
function normalizeQuery(q) {
    let out = q.toLowerCase().trim();
    for (const [wrong, right] of Object.entries(TYPO_MAP)) {
        out = out.replace(new RegExp('\\b' + wrong + '\\b', 'gi'), right);
    }
    for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
        if (out.includes(alias)) out = out.replace(alias, canonical);
    }
    return out;
}

// Parse natural language query: "best hospital in pune", "heart doctor mumbai", etc.
function parseSmartSearch(query) {
    const q = normalizeQuery(query);
    const result = { city: null, intent: null, specialty: null, hospitalType: null, rawQuery: q };

    // City: from city buttons + unique hospital cities + aliases
    const cityButtons = getCityButtons();
    const hospitalCities = [...new Set(hospitalsData.map(h => (h.city || '').toLowerCase()))];
    const allCityValues = [
        ...cityButtons.map(c => (c.value || '').toLowerCase()),
        ...hospitalCities,
        ...Object.values(CITY_ALIASES)
    ].filter(Boolean);

    for (const city of cityButtons) {
        const name = (city.name || '').toLowerCase();
        const val = (city.value || '').toLowerCase();
        if (q.includes(val) || (name && q.includes(name))) {
            result.city = city.value || val;
            break;
        }
    }
    if (!result.city) {
        for (const hc of hospitalCities) {
            if (hc && q.includes(hc)) {
                result.city = hc;
                break;
            }
        }
    }
    if (!result.city) {
        for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
            if (q.includes(alias) || q.includes(canonical)) {
                result.city = canonical;
                break;
            }
        }
    }

    // Hospital type: private / government
    const privateWords = ['private', 'प्राइवेट', 'pvt'];
    const govWords = ['government', 'gov', 'govt', 'सरकारी', 'sarkari', 'govt'];
    if (privateWords.some(w => q.includes(w))) result.hospitalType = 'PRIVATE';
    else if (govWords.some(w => q.includes(w))) result.hospitalType = 'GOV';

    // Intent: best, top, अच्छा, available, उपलब्ध
    const bestWords = ['best', 'top', 'good', 'achha', 'अच्छा', 'बेहतर', 'सर्वश्रेष्ठ', 'अच्छे'];
    const availableWords = ['available', 'उपलब्ध', 'free', 'abhi', 'today', 'आज'];
    if (bestWords.some(w => q.includes(w))) result.intent = 'best';
    else if (availableWords.some(w => q.includes(w))) result.intent = 'available';

    // Specialty: heart, orthopedic, eye, etc.
    const specialtyMap = [
        { keys: ['heart', 'cardio', 'हृदय', 'दिल'], value: 'heart' },
        { keys: ['ortho', 'bone', 'हड्डी', 'joint'], value: 'orthopedic' },
        { keys: ['eye', 'आंख', 'ophthal', 'नेत्र'], value: 'eye' },
        { keys: ['skin', 'त्वचा', 'derma'], value: 'skin' },
        { keys: ['child', 'बाल', 'pediatr', 'kid', 'बच्चे'], value: 'pediatric' },
        { keys: ['gyn', 'स्त्री', 'woman'], value: 'gyn' }
    ];
    for (const s of specialtyMap) {
        if (s.keys.some(k => q.includes(k))) {
            result.specialty = s.value;
            break;
        }
    }

    return result;
}

// Execute smart search and return filtered + sorted hospitals
function executeSmartSearch(parsed) {
    let list = hospitalsData;

    if (parsed.city) {
        list = list.filter(h => (h.city || '').toLowerCase() === parsed.city.toLowerCase());
    }
    if (parsed.hospitalType) {
        list = list.filter(h => (h.type || 'GOV') === parsed.hospitalType);
    }
    if (parsed.specialty) {
        const keys = { heart: ['heart', 'cardio', 'हृदय'], orthopedic: ['ortho', 'bone', 'हड्डी'], eye: ['eye', 'आंख'], skin: ['skin', 'त्वचा'], pediatric: ['child', 'बाल', 'pediatr'], gyn: ['gyn', 'स्त्री'] };
        const terms = keys[parsed.specialty] || [parsed.specialty];
        list = list.filter(h => h.doctors && h.doctors.some(d => terms.some(t => (d.specialty || '').toLowerCase().includes(t))));
    }
    if (parsed.intent === 'available') {
        list = list.filter(h => h.doctors && h.doctors.some(d => d.status === 'available'));
    }

    if (parsed.intent === 'best') {
        list = [...list].sort((a, b) => (parseFloat(b.avg_rating) || 0) - (parseFloat(a.avg_rating) || 0));
    } else if (parsed.intent === 'available') {
        list = [...list].sort((a, b) => {
            const aCount = (a.doctors || []).filter(d => d.status === 'available').length;
            const bCount = (b.doctors || []).filter(d => d.status === 'available').length;
            return bCount - aCount;
        });
    } else if (locationEnabled) {
        list = getHospitalsByDistance().filter(h => list.some(l => l.id === h.id));
    }

    return list;
}

// Show smart suggestions
function showSmartSuggestions(query) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    const queryLower = query.toLowerCase();
    
    let suggestions = [];
    
    // Get hospitals sorted by location
    const sortedHospitals = getHospitalsByDistance();
    
    // Check if query matches a city
    let matchedCity = null;
    getCityButtons().forEach(city => {
        const name = (city.name || '').toLowerCase();
        const val = (city.value || '').toLowerCase();
        if (name.includes(queryLower) || val.includes(queryLower)) {
            matchedCity = city;
        }
    });
    
    // If city matched, add smart city-based suggestions
    if (matchedCity) {
        const cityVal = matchedCity.value || '';
        // City + Sarkari Hospital
        const cityName = matchedCity.name || cityVal;
        suggestions.push({
            type: 'city-gov',
            id: cityVal,
            text: `${cityName} के सरकारी हॉस्पिटल`,
            distance: null
        });
        
        suggestions.push({
            type: 'city-private',
            id: cityVal,
            text: `${cityName} के प्राइवेट हॉस्पिटल`,
            distance: null
        });
        
        suggestions.push({
            type: 'city',
            id: cityVal,
            text: cityName,
            distance: null
        });
        
        suggestions.push({
            type: 'city-blood',
            id: cityVal,
            text: `${cityName} में Blood Updates`,
            distance: null
        });
    }
    
    // Search in hospitals (sorted by distance)
    sortedHospitals.forEach(hospital => {
        const nameMatch = hospital.name.toLowerCase().includes(queryLower);
        const locationMatch = hospital.location.toLowerCase().includes(queryLower);
        
        if (nameMatch || locationMatch) {
            const distanceText = (locationEnabled && hospital.distance) ? 
                ` (${formatDistance(hospital.distance)} दूर)` : '';
            
            suggestions.push({
                type: 'hospital',
                id: hospital.id,
                hospitalId: null,
                text: hospital.name,
                distanceText: distanceText,
                distance: hospital.distance || 9999
            });
        }
        
        // Search in doctors of this hospital
        hospital.doctors.forEach(doctor => {
            if (doctor.name.toLowerCase().includes(queryLower)) {
                const distanceText = (locationEnabled && hospital.distance) ? 
                    ` (${formatDistance(hospital.distance)} दूर)` : '';
                
                suggestions.push({
                    type: 'doctor',
                    id: doctor.id,
                    hospitalId: hospital.id,
                    text: doctor.name,
                    subText: hospital.name,
                    distanceText: distanceText,
                    distance: hospital.distance || 9999
                });
            }
        });
    });
    
    // Blood group search
    if (queryLower.includes('blood') || queryLower.includes('ब्लड') || queryLower.includes('खून')) {
        suggestions.push({
            type: 'blood-all',
            id: null,
            text: 'Blood Updates देखें',
            distance: null
        });
    }
    
    // Sort suggestions by distance (nearby first) - only for hospitals and doctors
    suggestions.sort((a, b) => {
        // City suggestions stay at top
        if (a.type.startsWith('city') && !b.type.startsWith('city')) return -1;
        if (!a.type.startsWith('city') && b.type.startsWith('city')) return 1;
        
        // Then sort by distance
        const distA = a.distance || 9999;
        const distB = b.distance || 9999;
        return distA - distB;
    });
    
    // Limit suggestions
    suggestions = suggestions.slice(0, 10);
    
    // Render Google-style suggestions with distance (data-attrs for reliable mobile/desktop click)
    if (suggestions.length > 0) {
        suggestionsDiv.innerHTML = suggestions.map(item => {
            let displayText = highlightMatch(item.text, query);
            if (item.distanceText) {
                displayText += `<span class="suggestion-distance">${item.distanceText}</span>`;
            }
            if (item.subText) {
                displayText += `<span class="suggestion-subtext"> - ${item.subText}</span>`;
            }
            const idStr = item.id != null ? String(item.id) : '';
            const hidStr = item.hospitalId != null ? String(item.hospitalId) : '';
            return `
                <div class="suggestion-item" data-type="${escapeHtml(item.type)}" data-id="${escapeHtml(idStr)}" data-hospital-id="${escapeHtml(hidStr)}" role="button" tabindex="0">
                    <span class="search-icon">🔍</span>
                    <span>${displayText}</span>
                </div>
            `;
        }).join('');
        suggestionsDiv.classList.add('show');
        // Attach click handlers (works on mobile touch + desktop)
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach(el => {
            const handleSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const type = el.dataset.type || '';
                const id = el.dataset.id || '';
                const hid = el.dataset.hospitalId || '';
                selectSmartSuggestion(type, id || null, hid || null);
            };
            el.addEventListener('click', handleSelect);
            el.addEventListener('touchend', function(e) {
                e.preventDefault();
                handleSelect(e);
            }, { passive: false });
        });
    } else {
        hideSuggestions();
    }
}

// Handle smart suggestion selection
function selectSmartSuggestion(type, id, hospitalId) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    hideSuggestions();
    hideSearchError();
    
    const idNum = id != null && id !== '' ? parseInt(id, 10) : null;
    
    if (type === 'city') {
        filterByCity(id || '');
    } else if (type === 'city-gov') {
        filterByCityAndType(id || '', 'GOV');
    } else if (type === 'city-private') {
        filterByCityAndType(id || '', 'PRIVATE');
    } else if (type === 'city-blood') {
        filterByCityBlood(id || '');
    } else if (type === 'hospital' && idNum) {
        showDoctorsByStatus(idNum, 'all');
    } else if (type === 'doctor' && idNum && hospitalId) {
        const hid = parseInt(String(hospitalId), 10);
        if (!isNaN(hid)) showDoctorDetails(hid, idNum);
    } else if (type === 'blood-all') {
        showAllBloodUpdates();
    }
}

// Filter by city and hospital type (GOV/PRIVATE)
function filterByCityAndType(cityValue, hospitalType) {
    const city = getCityButtons().find(c => (c.value || '') === cityValue);
    if (!city) return;
    
    const filteredHospitals = hospitalsData.filter(h => 
        h.city === cityValue && h.type === hospitalType
    );
    
    const grid = document.getElementById('hospitalsGrid');
    const typeLabel = hospitalType === 'GOV' ? 'सरकारी' : 'प्राइवेट';
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <div class="search-results-header">
            <h3>🏙️ ${city.name} के ${typeLabel} हॉस्पिटल (${filteredHospitals.length})</h3>
        </div>
    `;
    
    if (filteredHospitals.length > 0) {
        html += '<div class="hospitals-list">';
        html += filteredHospitals.map(hospital => renderHospitalCard(hospital)).join('');
        html += '</div>';
    } else {
        html += `<div class="no-doctors-found"><p>कोई ${typeLabel} हॉस्पिटल नहीं मिला</p></div>`;
    }
    
    grid.innerHTML = html;
    
    localStorage.setItem('currentView', 'cityType');
    localStorage.setItem('cityFilter', cityValue);
    localStorage.setItem('hospitalType', hospitalType);
}

// Filter blood updates by city
function filterByCityBlood(cityValue) {
    const city = getCityButtons().find(c => (c.value || '') === cityValue);
    if (!city) return;
    
    const cityHospitals = hospitalsData.filter(h => h.city === cityValue);
    const hospitalIds = cityHospitals.map(h => h.id);
    
    const cityBloodRequests = getActiveBloodRequests().filter(br => hospitalIds.includes(br.hospitalId));
    
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <div class="blood-department-card">
            <div class="blood-header">
                <div class="blood-header-info">
                    <h3>🩸 ${city.name} - Blood Updates</h3>
                    <p>Active requests: ${cityBloodRequests.length}</p>
                </div>
                <span class="alert-badge">ALERT</span>
            </div>
        </div>
    `;
    
    if (cityBloodRequests.length > 0) {
        html += '<div class="blood-requests-grid">';
        html += cityBloodRequests.map(request => {
            const hospital = hospitalsData.find(h => h.id === request.hospitalId);
            return `
                <div class="blood-request-card">
                    <div class="blood-request-top">
                        <span class="blood-group">${request.bloodGroup}</span>
                        <span class="blood-remaining-time">⏰ ${getRemainingTime(request.createdAt)}</span>
                    </div>
                    <div class="blood-request-body">
                        <p class="patient-name">👤 ${request.patientName}</p>
                        <p class="hospital-name">🏥 ${hospital ? hospital.name : 'Unknown'}</p>
                        <p class="contact">📞 ${request.contact}</p>
                        <p class="blood-date">📅 ${formatBloodDate(request.createdAt)}</p>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    } else {
        html += `<div class="no-blood-requests"><p>🩸 ${city.name} में कोई active blood request नहीं है</p></div>`;
    }
    
    grid.innerHTML = html;
    
    localStorage.setItem('currentView', 'cityBlood');
    localStorage.setItem('cityFilter', cityId);
}

// Show all blood updates
function showAllBloodUpdates() {
    const allBloodRequests = getActiveBloodRequests();
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += `
        <div class="blood-department-card">
            <div class="blood-header">
                <div class="blood-header-info">
                    <h3>🩸 सभी Blood Updates</h3>
                    <p>Active requests: ${allBloodRequests.length}</p>
                </div>
                <span class="alert-badge">ALERT</span>
            </div>
        </div>
    `;
    
    if (allBloodRequests.length > 0) {
        html += '<div class="blood-requests-grid">';
        html += allBloodRequests.map(request => {
            const hospital = hospitalsData.find(h => h.id === request.hospitalId);
            return `
                <div class="blood-request-card">
                    <div class="blood-request-top">
                        <span class="blood-group">${request.bloodGroup}</span>
                        <span class="blood-remaining-time">⏰ ${getRemainingTime(request.createdAt)}</span>
                    </div>
                    <div class="blood-request-body">
                        <p class="patient-name">👤 ${request.patientName}</p>
                        <p class="hospital-name">🏥 ${hospital ? hospital.name : 'Unknown'}</p>
                        <p class="contact">📞 ${request.contact}</p>
                        <p class="blood-date">📅 ${formatBloodDate(request.createdAt)}</p>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    } else {
        html += `<div class="no-blood-requests"><p>🩸 कोई active blood request नहीं है</p></div>`;
    }
    
    grid.innerHTML = html;
    
    localStorage.setItem('currentView', 'bloodAll');
}

// Highlight matching text
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Hide suggestions
function hideSuggestions() {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    if (suggestionsDiv) {
        suggestionsDiv.classList.remove('show');
    }
}

// Select suggestion
function selectSuggestion(type, id, hospitalId) {
    hideSuggestions();
    hideSearchError();
    
    if (type === 'hospital') {
        // Show this hospital's doctors
        showDoctorsByStatus(id, 'available');
    } else if (type === 'doctor') {
        // Show doctor details
        showDoctorDetails(hospitalId, id);
    } else if (type === 'city') {
        // Filter by city
        filterByCity(id);
    }
    
    // Clear search input
    document.getElementById('searchInput').value = '';
}

// Show search error above search bar
function showSearchError(message) {
    const errorDiv = document.getElementById('searchError');
    if (errorDiv) {
        errorDiv.textContent = '⚠️ ' + message;
        errorDiv.classList.add('show');
    }
}

// Hide search error
function hideSearchError() {
    const errorDiv = document.getElementById('searchError');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

// Search hospitals (smart + simple fallback)
function searchHospitals() {
    if (!canSearch()) return;

    const searchInput = document.getElementById('searchInput');
    const rawValue = searchInput.value;
    const searchValue = sanitizeInput(rawValue);

    if (!searchValue || searchValue.trim().length === 0) {
        showSearchError('कृपया हॉस्पिटल का नाम या जानकारी टाइप करें!');
        return;
    }

    hideSuggestions();

    // 1. Try smart search first (best hospital in pune, heart doctor mumbai, etc.)
    const parsed = parseSmartSearch(searchValue);
    if (parsed.city || parsed.intent || parsed.specialty || parsed.hospitalType) {
        const smartResults = executeSmartSearch(parsed);
        if (smartResults.length > 0) {
            hideSearchError();
            showSmartSearchResults(smartResults, searchValue, parsed);
            return;
        }
    }

    // 2. Fallback: simple name/location match
    const normalized = normalizeQuery(searchValue);
    const query = escapeRegex(normalized);
    let matchedHospitals = hospitalsData.filter(h =>
        h.name.toLowerCase().includes(query) ||
        h.location.toLowerCase().includes(query) ||
        (h.city && h.city.toLowerCase().includes(query))
    );

    // 3. Doctor name search if no hospital match
    if (matchedHospitals.length === 0) {
        const doctorHospitals = [];
        hospitalsData.forEach(h => {
            (h.doctors || []).forEach(d => {
                if ((d.name || '').toLowerCase().includes(normalized) || (d.specialty || '').toLowerCase().includes(normalized)) {
                    if (!doctorHospitals.includes(h)) doctorHospitals.push(h);
                }
            });
        });
        matchedHospitals = doctorHospitals;
    }

    if (matchedHospitals.length === 0) {
        showSearchError(`"${sanitizeHTML(searchValue)}" के लिए कोई हॉस्पिटल या डॉक्टर नहीं मिला`);
        return;
    }

    hideSearchError();
    if (matchedHospitals.length === 1) {
        showDoctorsByStatus(matchedHospitals[0].id, 'available');
        searchInput.value = '';
        return;
    }

    const grid = document.getElementById('hospitalsGrid');
    grid.innerHTML = `
        ${getSpecialtyButtonsHTML()}
        <div class="search-results-header">
            <h3>🔍 "${sanitizeHTML(searchValue)}" के लिए ${matchedHospitals.length} हॉस्पिटल मिले</h3>
        </div>
        <div class="hospitals-list">
            ${matchedHospitals.map(h => renderHospitalCard(h)).join('')}
        </div>
    `;
}

// Show smart search results with descriptive header
function showSmartSearchResults(hospitals, searchValue, parsed) {
    const grid = document.getElementById('hospitalsGrid');
    let headerText = '🔍 ';
    if (parsed.hospitalType === 'PRIVATE') headerText += 'प्राइवेट ';
    else if (parsed.hospitalType === 'GOV') headerText += 'सरकारी ';
    if (parsed.intent === 'best') headerText += 'सर्वश्रेष्ठ ';
    if (parsed.intent === 'available') headerText += 'उपलब्ध डॉक्टर वाले ';
    if (parsed.specialty) {
        const labels = { heart: 'हृदय रोग', orthopedic: 'हड्डी', eye: 'आंख', skin: 'त्वचा', pediatric: 'बाल रोग', gyn: 'स्त्री रोग' };
        headerText += (labels[parsed.specialty] || parsed.specialty) + ' विशेषज्ञता वाले ';
    }
    headerText += 'हॉस्पिटल';
    if (parsed.city) {
        const cityObj = getCityButtons().find(c => (c.value || '').toLowerCase() === (parsed.city || '').toLowerCase());
        const cityName = cityObj ? cityObj.name : Object.entries(CITY_ALIASES).find(([k, v]) => v === parsed.city)?.[0] || parsed.city;
        headerText += ' - ' + cityName;
    }
    headerText += ` (${hospitals.length})`;

    grid.innerHTML = `
        ${getSpecialtyButtonsHTML()}
        <div class="search-results-header">
            <h3>${headerText}</h3>
        </div>
        <div class="hospitals-list">
            ${hospitals.map(h => renderHospitalCard(h)).join('')}
        </div>
    `;
}

// Filter hospitals based on all criteria
function filterHospitals() {
    let filtered = hospitalsData;
    
    // Filter by city
    if (currentCity) {
        filtered = filtered.filter(h => h.city === currentCity);
    }
    
    // Filter by search term
    if (currentSearch) {
        filtered = filtered.filter(h => {
            const hospitalMatch = h.name.toLowerCase().includes(currentSearch) || 
                                  h.location.toLowerCase().includes(currentSearch);
            const doctorMatch = h.doctors.some(d => 
                d.name.toLowerCase().includes(currentSearch) || 
                d.specialty.toLowerCase().includes(currentSearch)
            );
            return hospitalMatch || doctorMatch;
        });
    }
    
    // Filter by doctor status if not 'all'
    if (currentFilter !== 'all') {
        filtered = filtered.filter(h => 
            h.doctors.some(d => d.status === currentFilter)
        );
    }
    
    renderHospitals(filtered);
}

// Filter by status
function filterByStatus(status) {
    currentFilter = status;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    filterHospitals();
}

// Show doctor details on screen (no modal/tab)
function showDoctorDetails(hospitalId, doctorId) {
    const hospital = hospitalsData.find(h => h.id === hospitalId);
    if (!hospital) return;
    const doctor = hospital.doctors.find(d => d.id === doctorId);
    if (!doctor) return;
    
    const statusLabels = {
        'available': 'उपलब्ध',
        'busy': 'व्यस्त',
        'leave': 'छुट्टी पर'
    };
    
    const statusColors = {
        'available': 'green',
        'busy': 'orange',
        'leave': 'red'
    };
    
    const blockFloor = [doctor.block, doctor.floor].filter(Boolean).map(escapeHtml).join(', ') || '—';
    const mobileDetailHTML = `
        <div class="dr-profile-container doctor-detail-mobile">
            <div class="profile-header">
                <div class="profile-img">👨‍⚕️</div>
                <div class="profile-header-info">
                    <h2 class="profile-dr-name">${escapeHtml(doctor.name)}</h2>
                    <p class="profile-dr-qual">${escapeHtml(doctor.qualification || 'MBBS, MD (General Medicine)')}</p>
                </div>
            </div>
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-value">${escapeHtml(doctor.experience || '—')}</span>
                    <span class="stat-label">अनुभव</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${(hospital.avg_rating && parseFloat(hospital.avg_rating) > 0) ? parseFloat(hospital.avg_rating).toFixed(1) + ' ⭐' : '—'}</span>
                    <span class="stat-label">रेटिंग</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">—</span>
                    <span class="stat-label">मरीज</span>
                </div>
            </div>
            <div class="details-section">
                <div class="details-title">अस्पताल की लोकेशन और समय</div>
                <table class="info-table">
                    <tr><td class="td-label">अस्पताल</td><td class="td-value">${escapeHtml(hospital.name)}</td></tr>
                    <tr><td class="td-label">ब्लॉक & फ्लोर</td><td class="td-value">${blockFloor}</td></tr>
                    <tr><td class="td-label">कमरा नंबर</td><td class="td-value">${doctor.room_no ? 'OPD कक्ष - ' + escapeHtml(doctor.room_no) : '—'}</td></tr>
                    <tr><td class="td-label">ओपीडी दिन</td><td class="td-value">${escapeHtml(doctor.opd_days || doctor.opd || 'Mon-Sat')}</td></tr>
                    <tr><td class="td-label">समय</td><td class="td-value">${escapeHtml(doctor.timing || '—')}</td></tr>
                </table>
                <div class="details-title details-title-spaced">विशेषज्ञता (Expertise)</div>
                <div class="about-dr">${escapeHtml(doctor.sub_specialization || doctor.specialty || 'विशेषज्ञता की जानकारी उपलब्ध नहीं।')}</div>
            </div>
        </div>
    `;
    
    const statusLabelsList = { 'available': 'उपलब्ध', 'busy': 'व्यस्त', 'leave': 'छुट्टी पर' };
    const statusColorsList = { 'available': 'green', 'busy': 'orange', 'leave': 'red' };
    const otherDoctorsHTML = hospital.doctors.length > 0 ? `
        <div class="same-hospital-doctors">
            <h3 class="same-hospital-doctors-title">इस अस्पताल के अन्य डॉक्टर</h3>
            <div class="doctor-cards-list same-hospital-doctor-cards">
                ${hospital.doctors.map(d => getDoctorCardFullHTML(d, hospital.name, hospital.id, statusLabelsList, statusColorsList)).join('')}
            </div>
        </div>
    ` : '';
    
    const grid = document.getElementById('hospitalsGrid');
    grid.innerHTML = getSpecialtyButtonsHTML() + `
        <div class="doctor-detail-wrapper">
            <div class="doctor-detail-desktop">
        <div class="doctor-detail-card">
            <div class="detail-header">
                <span class="detail-icon">👨‍⚕️</span>
                <div class="detail-header-info">
                    <h3>${doctor.name}</h3>
                    <p>${doctor.specialty} | ${hospital.location}</p>
                </div>
            </div>
            
            <div class="detail-main-card">
                <div class="detail-main-header">
                    <div class="detail-main-info">
                        <h4><span class="doc-icon">👨‍⚕️</span> ${doctor.name}</h4>
                        <p class="detail-specialty">${doctor.specialty} • ${hospital.location}</p>
                        <p class="detail-hospital"><span>🏥</span> ${hospital.name}</p>
                    </div>
                    <span class="detail-status-badge ${statusColors[doctor.status]}">
                        <span class="dot ${statusColors[doctor.status]}"></span> ${statusLabels[doctor.status]}
                    </span>
                </div>
                
                <div class="detail-info-row">
                    <div class="info-box">
                        <p class="info-label">📅 Experience</p>
                        <p class="info-value">${doctor.experience || 'N/A'}</p>
                    </div>
                    <div class="info-box">
                        <p class="info-label">💰 Fees</p>
                        <p class="info-value">${doctor.fees || 'N/A'}</p>
                    </div>
                </div>
                
                <div class="detail-opd-row">
                    <div class="opd-box">
                        <p class="opd-label">📅 OPD Days</p>
                        <p class="opd-value">${doctor.opd_days || doctor.opd || 'Mon-Sat'}</p>
                    </div>
                    <div class="opd-box">
                        <p class="opd-label">🕐 OPD Time</p>
                        <p class="opd-value">${doctor.timing || 'N/A'}</p>
                    </div>
                </div>
                
                <div class="detail-location">
                    <p class="location-title">📍 OPD Location (Inside Hospital)</p>
                    <div class="location-boxes">
                        <div class="loc-box">
                            <p class="loc-label">Block</p>
                            <p class="loc-value">${doctor.block || 'N/A'}</p>
                        </div>
                        <div class="loc-box">
                            <p class="loc-label">Room</p>
                            <p class="loc-value">${doctor.room_no || 'N/A'}</p>
                        </div>
                        <div class="loc-box">
                            <p class="loc-label">Floor</p>
                            <p class="loc-value">${doctor.floor || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
            </div>
            ${mobileDetailHTML}
        </div>
        ${otherDoctorsHTML}
    `;
}

// Show all doctors of a hospital (on screen)
function showAllDoctors(hospitalId) {
    const hospital = hospitalsData.find(h => h.id === hospitalId);
    if (!hospital) return;
    const filteredDoctors = filterDoctorsByStatus(hospital.doctors);
    const grid = document.getElementById('hospitalsGrid');
    grid.innerHTML = getSpecialtyButtonsHTML() + `
        <h2 class="hospital-doctors-title">${hospital.name}</h2>
        <p class="hospital-doctors-subtitle">
            <i class="fas fa-map-marker-alt"></i> ${hospital.location}
        </p>
        <div class="doctor-list-scroll">
            ${filteredDoctors.map(doctor => `
                <div class="doctor-item" onclick="showDoctorDetails(${hospital.id}, ${doctor.id})">
                    <div class="doctor-info">
                        <div class="doctor-avatar">${doctor.name.charAt(4)}</div>
                        <div class="doctor-details">
                            <h5>${doctor.name}</h5>
                            <p>${doctor.specialty}</p>
                        </div>
                    </div>
                    <span class="doctor-status ${doctor.status}">
                        ${getStatusText(doctor.status)}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

// Show doctors by specific status (replaces hospital cards with doctor cards)
function showDoctorsByStatus(hospitalId, status) {
    // Save current view to localStorage
    localStorage.setItem('currentView', JSON.stringify({
        type: 'doctors',
        hospitalId: hospitalId,
        status: status
    }));
    
    currentPaginationType = 'doctors';
    
    const hospital = hospitalsData.find(h => h.id === hospitalId);
    const doctorsByStatus = status === 'all'
        ? hospital.doctors
        : hospital.doctors.filter(d => d.status === status);
    const totalDoctors = doctorsByStatus.length;
    const paginatedDoctors = getPaginatedItems(doctorsByStatus, currentPage);
    
    const statusLabels = {
        'available': 'उपलब्ध',
        'busy': 'व्यस्त',
        'leave': 'छुट्टी पर'
    };
    
    const statusColors = {
        'available': 'green',
        'busy': 'orange',
        'leave': 'red'
    };
    
    const grid = document.getElementById('hospitalsGrid');
    
    let html = getSpecialtyButtonsHTML();
    
    html += '<div class="doctor-cards-list">';
    
    if (paginatedDoctors.length > 0) {
        html += paginatedDoctors.map(doctor =>
            getDoctorCardFullHTML(doctor, hospital.name, hospital.id, statusLabels, statusColors)
        ).join('');
    } else {
        html += `
            <div class="no-doctors">
                <p>इस श्रेणी में कोई डॉक्टर नहीं है</p>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add pagination
    html += generatePaginationHTML(totalDoctors, currentPage, 'doctors');
    
    grid.innerHTML = html;
}

// Scroll page to top (for footer Go Top / Home)
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Go back to hospital cards (Home)
function goBackToHospitals() {
    // Clear saved view and reset page
    localStorage.removeItem('currentView');
    currentPage = 1;
    renderPage();
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#top' || !href) {
            e.preventDefault();
            scrollToTop();
            return;
        }
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Footer Go Top & Home - explicit handlers (reliable on mobile)
document.getElementById('footerGoTop')?.addEventListener('click', function(e) {
    e.preventDefault();
    scrollToTop();
});
document.getElementById('footerHome')?.addEventListener('click', function(e) {
    e.preventDefault();
    scrollToTop();
    goBackToHospitals();
});
