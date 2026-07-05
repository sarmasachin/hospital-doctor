// ==================== API CONFIGURATION ====================
const API_URL = typeof getApiBase === 'function' ? getApiBase() : 'http://localhost:5006/api';

// ==================== VALIDATION HELPERS ====================
function trimVal(elId) {
    const el = document.getElementById(elId);
    return el && el.value ? el.value.trim() : '';
}
function showFieldError(msg) {
    if (typeof showAlert === 'function') showAlert(msg, 'error');
    else alert(msg);
}
function isValidContact(contact) {
    const digits = (contact || '').replace(/\D/g, '');
    return digits.length >= 10;
}

// ==================== PAGINATION CONFIG ====================
const ITEMS_PER_PAGE = 20;

// ==================== STATE ====================
let currentAdmin = null;
let hospitals = [];
let doctors = [];
let bloodRequests = [];
let admins = [];
let hospitalAdmins = [];
let bloodAdmins = [];
let cities = [];
let editingHospitalAdminId = null;
let editingBloodAdminId = null;
let editingCityButtonId = null;

// Pagination state
let currentPages = {
    hospitals: 1,
    doctors: 1,
    blood: 1,
    hospitalAdmins: 1,
    bloodAdmins: 1,
    admins: 1,
    'contact-messages': 1
};

// Filtered data for search
let filteredData = {
    hospitals: [],
    doctors: [],
    blood: [],
    hospitalAdmins: [],
    bloodAdmins: [],
    admins: []
};

// Contact messages data
let contactMessages = [];
let filteredContactMessages = [];

// Footer data
let footerData = {
    contact: [],
    important: [],
    quicklinks: [],
    follow: []
};

// Footer section settings
let footerSettings = {
    contact: { heading: 'Contact Us', subHeading: 'हमसे संपर्क करें', paragraph: 'हमसे जुड़ें और अपनी समस्याओं का समाधान पाएं' },
    important: { heading: 'Important', subHeading: 'महत्वपूर्ण लिंक्स', paragraph: 'हमारी महत्वपूर्ण जानकारी और नीतियां' },
    quicklinks: { heading: 'Quick Links', subHeading: 'त्वरित लिंक्स', paragraph: 'महत्वपूर्ण पेज और डैशबोर्ड के लिंक्स' },
    follow: { heading: 'Follow', subHeading: 'हमें फॉलो करें', paragraph: 'सोशल मीडिया पर हमसे जुड़ें और अपडेट्स पाएं' }
};

let editingFooterItem = null;
let currentFooterType = 'contact';

// ==================== LOGIN ====================

// Check if already logged in on page load
function checkLoginState() {
    const savedAdmin = localStorage.getItem('adminLoggedIn');
    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
    if (savedAdmin && token) {
        try {
            currentAdmin = JSON.parse(savedAdmin);
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('adminName').textContent = currentAdmin.username;
            loadAllData();
            return true;
        } catch (e) {
            localStorage.removeItem('adminLoggedIn');
        }
    }
    return false;
}

// Run on page load
document.addEventListener('DOMContentLoaded', function() {
    checkLoginState();
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = trimVal('loginUsername');
    const password = document.getElementById('loginPassword').value || '';
    if (!username) {
        showFieldError('Username is required');
        return;
    }
    if (!password) {
        showFieldError('Password is required');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentAdmin = data.admin;
            saveAuthSession(data.token, currentAdmin);
            
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('adminName').textContent = currentAdmin.username;
            
            // Load all data
            await loadAllData();
            showAlert('Login successful!', 'success');
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginError').textContent = 'Server connection failed!';
        document.getElementById('loginError').style.display = 'block';
    }
});

// ==================== LOGOUT ====================
function logout() {
    currentAdmin = null;
    clearAuthSession();
    
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

// ==================== PAGINATION FUNCTIONS ====================
function getPaginatedData(data, page) {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return data.slice(start, end);
}

function getTotalPages(totalItems) {
    return Math.ceil(totalItems / ITEMS_PER_PAGE);
}

function generatePagination(type, totalItems, currentPage) {
    const container = document.getElementById(`${type}Pagination`);
    if (!container) return;
    
    const totalPages = getTotalPages(totalItems);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button class="page-btn" onclick="changePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage('${type}', 1)">1</button>`;
        if (startPage > 2) html += '<span class="page-dots">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage('${type}', ${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
        html += `<button class="page-btn" onclick="changePage('${type}', ${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="page-btn" onclick="changePage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
    
    // Info
    html += `<span class="pagination-info">Page ${currentPage} of ${totalPages}</span>`;
    
    container.innerHTML = html;
}

function changePage(type, page) {
    const data = filteredData[type];
    const totalPages = getTotalPages(data.length);
    
    if (page < 1 || page > totalPages) return;
    
    currentPages[type] = page;
    
    // Re-render the specific table
    switch(type) {
        case 'hospitals':
            renderHospitalsTableWithPagination();
            break;
        case 'doctors':
            renderDoctorsTableWithPagination();
            break;
        case 'blood':
            renderBloodTableWithPagination();
            break;
        case 'hospitalAdmins':
            renderHospitalAdminsTableWithPagination();
            break;
        case 'bloodAdmins':
            renderBloodAdminsTableWithPagination();
            break;
        case 'admins':
            renderAdminsTableWithPagination();
            break;
    }
}

// ==================== SEARCH FUNCTION ====================
function searchTable(type) {
    const searchInputIds = {
        hospitals: 'searchHospitals',
        doctors: 'searchDoctors',
        blood: 'searchBlood',
        hospitalAdmins: 'searchHospitalAdmins',
        bloodAdmins: 'searchBloodAdmins',
        admins: 'searchAdmins'
    };
    
    const searchInput = document.getElementById(searchInputIds[type]);
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Get original data
    let originalData;
    switch(type) {
        case 'hospitals': originalData = hospitals; break;
        case 'doctors': originalData = doctors; break;
        case 'blood': originalData = bloodRequests; break;
        case 'hospitalAdmins': originalData = hospitalAdmins; break;
        case 'bloodAdmins': originalData = bloodAdmins; break;
        case 'admins': originalData = admins; break;
    }
    
    // Filter data
    if (query === '') {
        filteredData[type] = [...originalData];
    } else {
        filteredData[type] = originalData.filter(item => {
            const searchStr = JSON.stringify(item).toLowerCase();
            return searchStr.includes(query);
        });
    }
    
    // Reset to page 1 and re-render
    currentPages[type] = 1;
    changePage(type, 1);
}

// ==================== LOAD DATA ====================
async function loadAllData() {
    await Promise.all([
        loadHospitals(),
        loadDoctors(),
        loadBloodRequests(),
        loadAdmins(),
        loadHospitalAdmins(),
        loadBloodAdmins(),
        loadCities(),
        loadContactMessages(),
        loadFooterData(),
        loadStats()
    ]);
}

async function loadHospitals() {
    try {
        const response = await authFetch(`${API_URL}/hospitals`);
        hospitals = await response.json();
        renderHospitalsTable();
        populateHospitalDropdowns();
    } catch (error) {
        console.error('Error loading hospitals:', error);
    }
}

async function loadDoctors() {
    try {
        const response = await authFetch(`${API_URL}/doctors`);
        doctors = await response.json();
        renderDoctorsTable();
    } catch (error) {
        console.error('Error loading doctors:', error);
    }
}

async function loadBloodRequests() {
    try {
        const response = await authFetch(`${API_URL}/blood-requests`);
        bloodRequests = await response.json();
        renderBloodTable();
    } catch (error) {
        console.error('Error loading blood requests:', error);
    }
}

async function loadAdmins() {
    try {
        const response = await authFetch(`${API_URL}/admins`);
        admins = await response.json();
        renderAdminsTable();
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

async function loadHospitalAdmins() {
    try {
        const response = await authFetch(`${API_URL}/hospital-admins`);
        if (!response.ok) throw new Error('Failed to load hospital admins');
        hospitalAdmins = await response.json();
        renderHospitalAdminsTable();
    } catch (error) {
        console.error('Error loading hospital admins:', error);
        hospitalAdmins = [];
        renderHospitalAdminsTable();
    }
}

async function loadBloodAdmins() {
    try {
        const response = await authFetch(`${API_URL}/blood-admins`);
        if (!response.ok) throw new Error('Failed to load blood admins');
        bloodAdmins = await response.json();
        renderBloodAdminsTable();
    } catch (error) {
        console.error('Error loading blood admins:', error);
        bloodAdmins = [];
        renderBloodAdminsTable();
    }
}

const CITY_BUTTONS_KEY = 'cityButtons';

function loadCities() {
    try {
        const saved = localStorage.getItem(CITY_BUTTONS_KEY);
        cities = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(cities)) cities = [];
    } catch (_) {
        cities = [];
    }
    renderCitiesTable();
}

async function loadStats() {
    try {
        const response = await authFetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        document.getElementById('statHospitals').textContent = stats.hospitals || 0;
        document.getElementById('statDoctors').textContent = stats.doctors || 0;
        document.getElementById('statBlood').textContent = stats.blood_requests || 0;
        document.getElementById('statHospitalAdmins').textContent = hospitalAdmins.length || 0;
        document.getElementById('statBloodAdmins').textContent = bloodAdmins.length || 0;
        document.getElementById('statAdmins').textContent = admins.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function refreshData() {
    showAlert('Refreshing data...', 'success');
    await loadAllData();
}

// ==================== RENDER TABLES ====================
function renderHospitalsTable() {
    filteredData.hospitals = [...hospitals];
    renderHospitalsTableWithPagination();
}

function renderHospitalsTableWithPagination() {
    const tbody = document.getElementById('hospitalsTable');
    const data = filteredData.hospitals;
    const paginatedData = getPaginatedData(data, currentPages.hospitals);
    
    // Update info
    document.getElementById('hospitalsInfo').textContent = `Total: ${data.length} hospitals`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:30px;">कोई Hospital नहीं मिला</td></tr>';
        document.getElementById('hospitalsPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(h => `
        <tr>
            <td>${h.id}</td>
            <td>${h.name}</td>
            <td>${h.location}</td>
            <td><span class="type-badge ${h.type.toLowerCase()}">${h.type === 'GOV' ? 'सरकारी' : 'प्राइवेट'}</span></td>
            <td>${h.total_doctors || 0}</td>
            <td class="action-btns">
                <button class="btn-edit" onclick="editHospital(${h.id})">✏️</button>
                <button class="btn-delete" onclick="deleteHospital(${h.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    generatePagination('hospitals', data.length, currentPages.hospitals);
}

function renderDoctorsTable() {
    filteredData.doctors = [...doctors];
    renderDoctorsTableWithPagination();
}

function renderDoctorsTableWithPagination() {
    const tbody = document.getElementById('doctorsTable');
    const data = filteredData.doctors;
    const paginatedData = getPaginatedData(data, currentPages.doctors);
    
    // Update info
    document.getElementById('doctorsInfo').textContent = `Total: ${data.length} doctors`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:30px;">कोई Doctor नहीं मिला</td></tr>';
        document.getElementById('doctorsPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(d => {
        const hospital = hospitals.find(h => h.id === d.hospital_id);
        return `
            <tr>
                <td>${d.id}</td>
                <td>${d.name}</td>
                <td>${d.specialty}</td>
                <td>${hospital ? hospital.name : '-'}</td>
                <td><span class="status-badge ${d.status}">${getStatusLabel(d.status)}</span></td>
                <td class="action-btns">
                    <button class="btn-edit" onclick="editDoctor(${d.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteDoctor(${d.id})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    generatePagination('doctors', data.length, currentPages.doctors);
}

function renderBloodTable() {
    filteredData.blood = [...bloodRequests];
    renderBloodTableWithPagination();
}

function renderBloodTableWithPagination() {
    const tbody = document.getElementById('bloodTable');
    const data = filteredData.blood;
    const paginatedData = getPaginatedData(data, currentPages.blood);
    
    // Update info
    document.getElementById('bloodInfo').textContent = `Total: ${data.length} requests`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:30px;">कोई Blood Request नहीं मिला</td></tr>';
        document.getElementById('bloodPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(b => `
        <tr>
            <td>${b.id}</td>
            <td><strong style="color: #ef4444;">${b.blood_type}</strong></td>
            <td>${b.hospital_name || '-'}</td>
            <td>${b.patient_name || '-'}</td>
            <td>${b.contact || '-'}</td>
            <td class="action-btns">
                <button class="btn-delete" onclick="deleteBloodRequest(${b.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    generatePagination('blood', data.length, currentPages.blood);
}

function renderAdminsTable() {
    filteredData.admins = [...admins];
    renderAdminsTableWithPagination();
}

function renderAdminsTableWithPagination() {
    const tbody = document.getElementById('adminsTable');
    const data = filteredData.admins;
    const paginatedData = getPaginatedData(data, currentPages.admins);
    
    // Update info
    document.getElementById('adminsInfo').textContent = `Total: ${data.length} admins`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:30px;">कोई Admin नहीं मिला</td></tr>';
        document.getElementById('adminsPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(a => `
        <tr>
            <td>${a.id}</td>
            <td>${a.username}</td>
            <td><span class="type-badge ${a.role === 'superadmin' ? 'gov' : 'private'}">${a.role}</span></td>
            <td>${new Date(a.created_at).toLocaleDateString()}</td>
            <td class="action-btns">
                ${a.id !== 1 ? `<button class="btn-delete" onclick="deleteAdmin(${a.id})">🗑️</button>` : '<span style="color:#666">Protected</span>'}
            </td>
        </tr>
    `).join('');
    
    generatePagination('admins', data.length, currentPages.admins);
}

function renderHospitalAdminsTable() {
    filteredData.hospitalAdmins = [...hospitalAdmins];
    renderHospitalAdminsTableWithPagination();
}

function renderHospitalAdminsTableWithPagination() {
    const tbody = document.getElementById('hospitalAdminsTable');
    if (!tbody) return;
    
    const data = filteredData.hospitalAdmins;
    const paginatedData = getPaginatedData(data, currentPages.hospitalAdmins);
    
    // Update info
    const infoElement = document.getElementById('hospitalAdminsInfo');
    if (infoElement) infoElement.textContent = `Total: ${data.length} admins`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">कोई हॉस्पिटल एडमिन नहीं मिला। हॉस्पिटल एडमिन जोड़ें पर क्लिक करें।</td></tr>';
        document.getElementById('hospitalAdminsPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(a => {
        return `
            <tr>
                <td>${a.id}</td>
                <td><strong>${a.name}</strong></td>
                <td>${a.email}</td>
                <td>${a.hospital_name || '-'}</td>
                <td>${a.mobile || '-'}</td>
                <td><span class="status-badge ${a.status === 'active' ? 'available' : 'leave'}">${a.status === 'active' ? '✅ Active' : '❌ Inactive'}</span></td>
                <td class="action-btns">
                    <button class="btn-edit" onclick="editHospitalAdmin(${a.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteHospitalAdmin(${a.id})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    generatePagination('hospitalAdmins', data.length, currentPages.hospitalAdmins);
}

function renderBloodAdminsTable() {
    filteredData.bloodAdmins = [...bloodAdmins];
    renderBloodAdminsTableWithPagination();
}

function renderBloodAdminsTableWithPagination() {
    const tbody = document.getElementById('bloodAdminsTable');
    if (!tbody) return;
    
    const data = filteredData.bloodAdmins;
    const paginatedData = getPaginatedData(data, currentPages.bloodAdmins);
    
    // Update info
    const infoElement = document.getElementById('bloodAdminsInfo');
    if (infoElement) infoElement.textContent = `Total: ${data.length} admins`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">कोई ब्लड एडमिन नहीं मिला। ब्लड एडमिन जोड़ें पर क्लिक करें।</td></tr>';
        document.getElementById('bloodAdminsPagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = paginatedData.map(a => {
        return `
            <tr>
                <td>${a.id}</td>
                <td><strong>${a.name}</strong></td>
                <td>${a.email}</td>
                <td>${a.hospital_name || '-'}</td>
                <td>${a.mobile || '-'}</td>
                <td><span class="status-badge ${a.status === 'active' ? 'available' : 'leave'}">${a.status === 'active' ? '✅ Active' : '❌ Inactive'}</span></td>
                <td class="action-btns">
                    <button class="btn-edit" onclick="editBloodAdmin(${a.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteBloodAdmin(${a.id})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    generatePagination('bloodAdmins', data.length, currentPages.bloodAdmins);
}

function getStatusLabel(status) {
    const labels = {
        'available': 'उपलब्ध',
        'busy': 'व्यस्त',
        'leave': 'छुट्टी पर'
    };
    return labels[status] || status;
}

// ==================== POPULATE DROPDOWNS ====================
function populateHospitalDropdowns() {
    // All hospital fields are now text inputs with autocomplete
    // No dropdowns to populate
}

// ==================== MODALS ====================
function openModal(type) {
    document.getElementById(`${type}Modal`).classList.add('active');
}

function closeModal(type) {
    document.getElementById(`${type}Modal`).classList.remove('active');
    // Reset form
    document.getElementById(`${type}Form`).reset();
    
    // Clear hidden hospital ID fields
    if (type === 'doctor') {
        document.getElementById('doctorHospitalId').value = '';
    }
    if (type === 'blood') {
        document.getElementById('bloodHospitalId').value = '';
    }
    if (type === 'hospital') {
        document.getElementById('hospitalId').value = '';
        document.getElementById('hospitalModalTitle').textContent = '🏥 Add Hospital';
        document.getElementById('hospitalSubmitBtn').textContent = '💾 Save Hospital';
    }
    
    // Reset hospital admin modal state
    if (type === 'hospitalAdmin') {
        editingHospitalAdminId = null;
        document.getElementById('hospitalAdminModalTitle').textContent = '🏥👤 Add Hospital Admin';
        document.getElementById('hospitalAdminSubmitBtn').textContent = '💾 Add Hospital Admin';
    }
    
    // Reset blood admin modal state
    if (type === 'bloodAdmin') {
        editingBloodAdminId = null;
        document.getElementById('bloodAdminModalTitle').textContent = '🩸👤 Add Blood Admin';
        document.getElementById('bloodAdminSubmitBtn').textContent = '💾 Add Blood Admin';
    }
    // Reset city button modal state
    if (type === 'cityButton') {
        editingCityButtonId = null;
        document.getElementById('cityButtonModalTitle').textContent = '🏙️ Add City Button';
        document.getElementById('cityButtonSubmitBtn').textContent = '💾 Save';
    }
}

// Close modal on outside click (not when clicking inside modal-content)
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});
// Stop clicks/focus inside modal content from bubbling to overlay (fix: typing in city form no longer closes or clears)
document.querySelectorAll('.modal .modal-content').forEach(content => {
    content.addEventListener('click', function(e) { e.stopPropagation(); });
});

// ==================== SIDEBAR NAVIGATION ====================
document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.dataset.section) {
            e.preventDefault();
            showSection(this.dataset.section);
            
            // Update active state
            document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        }
    });
});

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    // Show selected section
    const target = document.getElementById(`section-${sectionId}`);
    if (!target) {
        console.warn('Unknown section:', sectionId);
        return;
    }
    target.classList.add('active');

    // Keep sidebar highlight in sync (works for quick-actions & direct calls, not only clicks)
    document.querySelectorAll('.sidebar-menu a[data-section]').forEach((l) => {
        l.classList.toggle('active', l.dataset.section === sectionId);
    });
    
    // Update title
    const titles = {
        'dashboard': '📊 Dashboard',
        'hospitals': '🏥 Hospitals',
        'doctors': '👨‍⚕️ Doctors',
        'blood': '🩸 Blood Requests',
        'contact-messages': '📩 Contact Messages',
        'hospital-admins': '🏥👤 Hospital Admins',
        'blood-admins': '🩸👤 Blood Admins',
        'cities': '🏙️ Cities',
        'site-settings': '⚙️ Site Settings (SEO, backup, caching)',
        'footer': '📋 Footer Settings',
        'hospital-card-label': '🏷️ हॉस्पिटल कार्ड लेबल',
        'page-content': '📄 Page Content',
        'admins': '👤 Super Admins'
    };
    
    // Load page content when switching to that section
    if (sectionId === 'page-content') {
        loadAllPageContent();
    }
    if (sectionId === 'hospital-card-label') {
        loadHospitalCardLabel();
    }
    if (sectionId === 'site-settings') {
        loadSiteSettingsAdmin();
    }
    document.getElementById('pageTitle').textContent = titles[sectionId] || 'Dashboard';
    
    closeSidebar();
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;
    const willOpen = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', willOpen);
    if (overlay) overlay.classList.toggle('show', willOpen);
}

// ==================== FORM SUBMISSIONS ====================

// Add/Edit Hospital
document.getElementById('hospitalForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = trimVal('hospitalName');
    const location = trimVal('hospitalLocation');
    const city = trimVal('hospitalCity');
    if (!name) {
        showFieldError('Hospital name is required');
        return;
    }
    if (!location) {
        showFieldError('Location is required');
        return;
    }
    if (!city) {
        showFieldError('City code is required');
        return;
    }
    
    const editId = document.getElementById('hospitalId').value;
    const data = {
        name,
        location,
        city,
        type: document.getElementById('hospitalType').value,
        total_doctors: parseInt(document.getElementById('hospitalDepts').value, 10) || 0,
        lat: parseFloat(document.getElementById('hospitalLat').value) || null,
        lng: parseFloat(document.getElementById('hospitalLng').value) || null,
        card_branding: trimVal('hospitalCardBranding') || null
    };
    
    try {
        const isEdit = editId && parseInt(editId, 10) > 0;
        const url = isEdit ? `${API_URL}/hospitals/${editId}` : `${API_URL}/hospitals`;
        const response = await authFetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert(isEdit ? 'Hospital updated successfully!' : 'Hospital added successfully!', 'success');
            closeModal('hospital');
            await loadHospitals();
            await loadStats();
        } else {
            showAlert(isEdit ? 'Failed to update hospital' : 'Failed to add hospital', 'error');
        }
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

// Add Doctor
document.getElementById('doctorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const hospitalId = document.getElementById('doctorHospitalId').value;
    if (!hospitalId) {
        showFieldError('कृपया list से Hospital select करें');
        return;
    }
    const name = trimVal('doctorName');
    const specialty = trimVal('doctorSpecialty');
    if (!name) {
        showFieldError('Doctor name is required');
        return;
    }
    if (!specialty) {
        showFieldError('Specialty is required');
        return;
    }
    
    const data = {
        name,
        specialty,
        experience: document.getElementById('doctorExperience').value,
        hospital_id: parseInt(hospitalId),
        status: document.getElementById('doctorStatus').value,
        fees: document.getElementById('doctorFees').value,
        timing: document.getElementById('doctorTiming').value,
        qualification: document.getElementById('doctorQualification').value.trim() || null,
        sub_specialization: document.getElementById('doctorSubSpecialization').value.trim() || null,
        room_no: document.getElementById('doctorRoom').value.trim() || null,
        floor: document.getElementById('doctorFloor').value.trim() || null,
        block: document.getElementById('doctorBlock').value.trim() || null
    };
    
    try {
        const response = await authFetch(`${API_URL}/doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert('Doctor added successfully!', 'success');
            closeModal('doctor');
            await loadDoctors();
            await loadStats();
        } else {
            showAlert('Failed to add doctor', 'error');
        }
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

// Add Blood Request
document.getElementById('bloodForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const bloodHospitalId = document.getElementById('bloodHospitalId').value;
    if (!bloodHospitalId) {
        showFieldError('कृपया list से Hospital select करें');
        return;
    }
    const patientName = trimVal('bloodPatient');
    const contact = document.getElementById('bloodContact').value ? document.getElementById('bloodContact').value.trim() : '';
    if (!patientName) {
        showFieldError('Patient name is required');
        return;
    }
    if (!isValidContact(contact)) {
        showFieldError('Valid contact number required (at least 10 digits)');
        return;
    }
    
    const data = {
        blood_type: document.getElementById('bloodType').value,
        hospital_id: parseInt(bloodHospitalId, 10),
        patient_name: patientName,
        contact: contact.replace(/\D/g, '') || contact,
        message: trimVal('bloodMessage'),
        urgent: true
    };
    
    try {
        const response = await authFetch(`${API_URL}/blood-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert('Blood request added successfully!', 'success');
            closeModal('blood');
            await loadBloodRequests();
            await loadStats();
        } else {
            showAlert('Failed to add blood request', 'error');
        }
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

// Add Admin
document.getElementById('adminForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const data = {
        username: document.getElementById('adminUsername').value,
        password: document.getElementById('adminPassword').value,
        role: document.getElementById('adminRole').value
    };
    
    try {
        const response = await authFetch(`${API_URL}/admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert('Admin added successfully!', 'success');
            closeModal('admin');
            await loadAdmins();
        } else {
            showAlert('Failed to add admin', 'error');
        }
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

// Add/Edit Hospital Admin
document.getElementById('hospitalAdminForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const data = {
        name: trimVal('hospitalAdminName'),
        email: trimVal('hospitalAdminEmail'),
        password: document.getElementById('hospitalAdminPassword').value || '',
        hospital_name: trimVal('hospitalAdminHospital'),
        mobile: trimVal('hospitalAdminMobile'),
        status: document.getElementById('hospitalAdminStatus').value
    };

    if (!data.name || !data.email || !data.hospital_name) {
        showFieldError('Name, email, and hospital are required');
        return;
    }
    if (!editingHospitalAdminId && (!data.password || data.password.length < 6)) {
        showFieldError('Password must be at least 6 characters');
        return;
    }

    const url = editingHospitalAdminId
        ? `${API_URL}/hospital-admins/${editingHospitalAdminId}`
        : `${API_URL}/hospital-admins`;
    const method = editingHospitalAdminId ? 'PUT' : 'POST';
    if (editingHospitalAdminId && !data.password) delete data.password;

    try {
        const response = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) {
            showAlert(result.error || 'Save failed', 'error');
            return;
        }
        showAlert(editingHospitalAdminId ? 'Hospital Admin updated successfully!' : 'Hospital Admin added successfully!', 'success');
        await loadHospitalAdmins();
        closeModal('hospitalAdmin');
        editingHospitalAdminId = null;
        renderHospitalAdminsTable();
        updateHospitalAdminStats();
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

// Add/Edit Blood Admin
document.getElementById('bloodAdminForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const data = {
        name: trimVal('bloodAdminName'),
        email: trimVal('bloodAdminEmail'),
        password: document.getElementById('bloodAdminPassword').value || '',
        hospital_name: trimVal('bloodAdminHospital'),
        mobile: trimVal('bloodAdminMobile'),
        status: document.getElementById('bloodAdminStatus').value
    };

    if (!data.name || !data.email || !data.hospital_name) {
        showFieldError('Name, email, and hospital are required');
        return;
    }
    if (!editingBloodAdminId && (!data.password || data.password.length < 6)) {
        showFieldError('Password must be at least 6 characters');
        return;
    }

    const url = editingBloodAdminId
        ? `${API_URL}/blood-admins/${editingBloodAdminId}`
        : `${API_URL}/blood-admins`;
    const method = editingBloodAdminId ? 'PUT' : 'POST';
    if (editingBloodAdminId && !data.password) delete data.password;

    try {
        const response = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) {
            showAlert(result.error || 'Save failed', 'error');
            return;
        }
        showAlert(editingBloodAdminId ? 'Blood Admin updated successfully!' : 'Blood Admin added successfully!', 'success');
        await loadBloodAdmins();
        closeModal('bloodAdmin');
        editingBloodAdminId = null;
        renderBloodAdminsTable();
        updateBloodAdminStats();
    } catch (error) {
        showAlert('Server error', 'error');
    }
});

document.getElementById('cityButtonForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = trimVal('cityButtonName');
    let value = trimVal('cityButtonValue');
    
    if (!name) {
        showFieldError('Name is required');
        return;
    }
    if (!value) {
        showFieldError('Link (value) is required');
        return;
    }
    value = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!value) {
        showFieldError('Link में सिर्फ अंग्रेज़ी अक्षर/नंबर (जैसे delhi)');
        return;
    }
    
    const index = editingCityButtonId !== null && editingCityButtonId !== undefined && editingCityButtonId >= 0
        ? parseInt(document.getElementById('cityButtonId').value, 10) : -1;
    
    if (index >= 0 && index < cities.length) {
        cities[index] = { name, value };
    } else {
        cities.push({ name, value });
    }
    localStorage.setItem(CITY_BUTTONS_KEY, JSON.stringify(cities));
    showAlert(index >= 0 ? 'Updated!' : 'City added!', 'success');
    closeModal('cityButton');
    editingCityButtonId = null;
    renderCitiesTable();
});

// ==================== DELETE FUNCTIONS ====================
async function deleteHospital(id) {
    if (!confirm('Are you sure you want to delete this hospital?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/hospitals/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Hospital deleted!', 'success');
            await loadHospitals();
            await loadStats();
        }
    } catch (error) {
        showAlert('Delete failed', 'error');
    }
}

async function deleteDoctor(id) {
    if (!confirm('Are you sure you want to delete this doctor?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/doctors/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Doctor deleted!', 'success');
            await loadDoctors();
            await loadStats();
        }
    } catch (error) {
        showAlert('Delete failed', 'error');
    }
}

async function deleteBloodRequest(id) {
    if (!confirm('Are you sure you want to delete this blood request?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/blood-requests/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Blood request deleted!', 'success');
            await loadBloodRequests();
            await loadStats();
        }
    } catch (error) {
        showAlert('Delete failed', 'error');
    }
}

async function deleteAdmin(id) {
    if (!confirm('Are you sure you want to delete this admin?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/admins/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Admin deleted!', 'success');
            await loadAdmins();
        }
    } catch (error) {
        showAlert('Delete failed', 'error');
    }
}

// Hospital Admin Functions
function editHospitalAdmin(id) {
    const admin = hospitalAdmins.find(a => a.id === id);
    if (!admin) return;
    
    editingHospitalAdminId = id;
    
    document.getElementById('hospitalAdminId').value = admin.id;
    document.getElementById('hospitalAdminName').value = admin.name;
    document.getElementById('hospitalAdminEmail').value = admin.email;
    document.getElementById('hospitalAdminPassword').value = ''; // Don't show password
    document.getElementById('hospitalAdminHospital').value = admin.hospital_name || '';
    document.getElementById('hospitalAdminMobile').value = admin.mobile || '';
    document.getElementById('hospitalAdminStatus').value = admin.status || 'active';
    
    document.getElementById('hospitalAdminModalTitle').textContent = '✏️ Edit Hospital Admin';
    document.getElementById('hospitalAdminSubmitBtn').textContent = '💾 Update Hospital Admin';
    
    openModal('hospitalAdmin');
}

async function deleteHospitalAdmin(id) {
    if (!confirm('क्या आप वाकई इस Hospital Admin को delete करना चाहते हैं?')) return;

    try {
        const response = await authFetch(`${API_URL}/hospital-admins/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const result = await response.json();
            showAlert(result.error || 'Delete failed', 'error');
            return;
        }
        await loadHospitalAdmins();
        updateHospitalAdminStats();
        showAlert('Hospital Admin deleted!', 'success');
    } catch (error) {
        showAlert('Server error', 'error');
    }
}

function updateHospitalAdminStats() {
    const statElement = document.getElementById('statHospitalAdmins');
    if (statElement) {
        statElement.textContent = hospitalAdmins.length;
    }
}

// Blood Admin Functions
function editBloodAdmin(id) {
    const admin = bloodAdmins.find(a => a.id === id);
    if (!admin) return;
    
    editingBloodAdminId = id;
    
    document.getElementById('bloodAdminId').value = admin.id;
    document.getElementById('bloodAdminName').value = admin.name;
    document.getElementById('bloodAdminEmail').value = admin.email;
    document.getElementById('bloodAdminPassword').value = ''; // Don't show password
    document.getElementById('bloodAdminHospital').value = admin.hospital_name || '';
    document.getElementById('bloodAdminMobile').value = admin.mobile || '';
    document.getElementById('bloodAdminStatus').value = admin.status || 'active';
    
    document.getElementById('bloodAdminModalTitle').textContent = '✏️ Edit Blood Admin';
    document.getElementById('bloodAdminSubmitBtn').textContent = '💾 Update Blood Admin';
    
    openModal('bloodAdmin');
}

async function deleteBloodAdmin(id) {
    if (!confirm('क्या आप वाकई इस Blood Admin को delete करना चाहते हैं?')) return;

    try {
        const response = await authFetch(`${API_URL}/blood-admins/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const result = await response.json();
            showAlert(result.error || 'Delete failed', 'error');
            return;
        }
        await loadBloodAdmins();
        updateBloodAdminStats();
        showAlert('Blood Admin deleted!', 'success');
    } catch (error) {
        showAlert('Server error', 'error');
    }
}

function updateBloodAdminStats() {
    const statElement = document.getElementById('statBloodAdmins');
    if (statElement) {
        statElement.textContent = bloodAdmins.length;
    }
}

// ==================== CITIES (City Buttons on Website - localStorage) ====================
function renderCitiesTable() {
    const tbody = document.getElementById('citiesTable');
    if (!tbody) return;
    const infoEl = document.getElementById('citiesInfo');
    if (infoEl) infoEl.textContent = `Total: ${cities.length} buttons`;
    
    if (cities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No city buttons. Add one below.</td></tr>';
        return;
    }
    
    tbody.innerHTML = cities.map((c, i) => `
        <tr>
            <td>${escapeHtml(c.name || '')}</td>
            <td>${escapeHtml(c.value || '')}</td>
            <td>
                <button class="btn-edit" onclick="editCityButton(${i})">✏️ Edit</button>
                <button class="btn-delete" onclick="deleteCityButton(${i})">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function openAddCityModal() {
    editingCityButtonId = null;
    document.getElementById('cityButtonId').value = '';
    document.getElementById('cityButtonName').value = '';
    document.getElementById('cityButtonValue').value = '';
    document.getElementById('cityButtonModalTitle').textContent = '🏙️ Add City Button';
    document.getElementById('cityButtonSubmitBtn').textContent = '💾 Save';
    openModal('cityButton');
}

function editCityButton(index) {
    const city = cities[index];
    if (!city) return;
    editingCityButtonId = index;
    document.getElementById('cityButtonId').value = index;
    document.getElementById('cityButtonName').value = city.name || '';
    document.getElementById('cityButtonValue').value = city.value || '';
    document.getElementById('cityButtonModalTitle').textContent = '✏️ Edit City Button';
    document.getElementById('cityButtonSubmitBtn').textContent = '💾 Update';
    openModal('cityButton');
}

function deleteCityButton(index) {
    if (!confirm('क्या आप इस City Button को delete करना चाहते हैं?')) return;
    cities.splice(index, 1);
    localStorage.setItem(CITY_BUTTONS_KEY, JSON.stringify(cities));
    showAlert('City deleted!', 'success');
    renderCitiesTable();
}

// ==================== FOOTER MANAGEMENT ====================

// Load footer data from localStorage
function loadFooterData() {
    const savedData = localStorage.getItem('footerData');
    if (savedData) {
        footerData = JSON.parse(savedData);
    } else {
        footerData = {
            contact: [
                { id: 1, icon: '📧', title: 'Email', value: 'support@livehospital.org' }
            ],
            important: [
                { id: 1, title: 'गोपनीयता नीति', value: '/privacy' },
                { id: 2, title: 'नियम और शर्तें', value: '/terms' },
                { id: 3, title: 'कुकी नीति', value: '/cookies' }
            ],
            quicklinks: [
                { id: 1, title: 'Contact', value: '/contact' }
            ],
            follow: []
        };
        saveFooterData();
    }
    
    // Load section settings
    const savedSettings = localStorage.getItem('footerSettings');
    if (savedSettings) {
        footerSettings = JSON.parse(savedSettings);
    }
    
    renderAllFooterTables();
}

// Save footer data to localStorage
function saveFooterData() {
    localStorage.setItem('footerData', JSON.stringify(footerData));
}

// Save footer settings to localStorage
function saveFooterSettings() {
    localStorage.setItem('footerSettings', JSON.stringify(footerSettings));
}

// Hospital card label (top line on public site card – per hospital, field card_branding)
function loadHospitalCardLabel() {
    const sel = document.getElementById('hospitalCardLabelSelect');
    const inp = document.getElementById('hospitalCardLabelInput');
    if (!sel || !inp) return;
    sel.innerHTML = '<option value="">-- हॉस्पिटल चुनें --</option>';
    hospitals.forEach(h => {
        sel.innerHTML += `<option value="${h.id}">${(h.name || '').replace(/"/g, '&quot;')}</option>`;
    });
    inp.value = '';
}
function onHospitalCardLabelHospitalChange() {
    const sel = document.getElementById('hospitalCardLabelSelect');
    const inp = document.getElementById('hospitalCardLabelInput');
    const id = sel && sel.value ? parseInt(sel.value, 10) : 0;
    const h = hospitals.find(x => x.id === id);
    if (inp) inp.value = (h && h.card_branding) ? h.card_branding : '';
}
async function saveHospitalCardLabel() {
    const sel = document.getElementById('hospitalCardLabelSelect');
    const inp = document.getElementById('hospitalCardLabelInput');
    const hospitalId = sel && sel.value ? parseInt(sel.value, 10) : 0;
    if (!hospitalId) {
        showAlert('पहले एक हॉस्पिटल चुनें', 'error');
        return;
    }
    const val = (inp && inp.value) ? inp.value.trim() : '';
    try {
        const res = await authFetch(`${API_URL}/hospitals/${hospitalId}/branding`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_branding: val || null })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showAlert((data.error || 'लेबल सेव नहीं हो सका'), 'error');
            return;
        }
        const h = hospitals.find(x => x.id === hospitalId);
        if (h) h.card_branding = val || null;
        showAlert(val ? 'लेबल सेव हो गया। कार्ड पर दिखेगा: ' + val : 'इस हॉस्पिटल का कार्ड लेबल हटा दिया गया', 'success');
    } catch (e) {
        showAlert('Network error. Is server running?', 'error');
    }
}

// Show footer tab
function showFooterTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.footer-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.footer-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`footer-tab-${tab}`).classList.add('active');
    
    currentFooterType = tab;
}

// Render all footer tables
function renderAllFooterTables() {
    renderContactTable();
    renderImportantTable();
    renderQuicklinksTable();
    renderFollowTable();
}

// Render Contact table
function renderContactTable() {
    const tbody = document.getElementById('contactTable');
    if (!tbody) return;
    
    if (footerData.contact.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:20px;">कोई item नहीं है</td></tr>';
        return;
    }
    
    tbody.innerHTML = footerData.contact.map(item => `
        <tr>
            <td style="font-size: 1.5rem;">${item.icon}</td>
            <td>${item.title}</td>
            <td>${item.value}</td>
            <td class="action-btns">
                <button class="btn-edit" onclick="editFooterItem('contact', ${item.id})">✏️</button>
                <button class="btn-delete" onclick="deleteFooterItem('contact', ${item.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Render Important table
function renderImportantTable() {
    const tbody = document.getElementById('importantTable');
    if (!tbody) return;
    
    if (footerData.important.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:20px;">कोई item नहीं है</td></tr>';
        return;
    }
    
    tbody.innerHTML = footerData.important.map(item => `
        <tr>
            <td>${item.title}</td>
            <td><a href="${item.value}" target="_blank" style="color:#1e88e5;">${item.value}</a></td>
            <td class="action-btns">
                <button class="btn-edit" onclick="editFooterItem('important', ${item.id})">✏️</button>
                <button class="btn-delete" onclick="deleteFooterItem('important', ${item.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Render Quick Links table
function renderQuicklinksTable() {
    const tbody = document.getElementById('quicklinksTable');
    if (!tbody) return;
    
    if (footerData.quicklinks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:20px;">कोई item नहीं है</td></tr>';
        return;
    }
    
    tbody.innerHTML = footerData.quicklinks.map(item => `
        <tr>
            <td>${item.title}</td>
            <td><a href="${item.value}" target="_blank" style="color:#1e88e5;">${item.value}</a></td>
            <td class="action-btns">
                <button class="btn-edit" onclick="editFooterItem('quicklinks', ${item.id})">✏️</button>
                <button class="btn-delete" onclick="deleteFooterItem('quicklinks', ${item.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Render Follow table
function renderFollowTable() {
    const tbody = document.getElementById('followTable');
    if (!tbody) return;
    
    if (footerData.follow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:20px;">कोई item नहीं है</td></tr>';
        return;
    }
    
    tbody.innerHTML = footerData.follow.map(item => `
        <tr>
            <td><span style="display:inline-flex;align-items:center;justify-content:center;width:35px;height:35px;background:#1e88e5;border-radius:50%;color:white;font-weight:bold;">${item.icon}</span></td>
            <td>${item.title}</td>
            <td><a href="${item.value}" target="_blank" style="color:#1e88e5;">${item.value}</a></td>
            <td class="action-btns">
                <button class="btn-edit" onclick="editFooterItem('follow', ${item.id})">✏️</button>
                <button class="btn-delete" onclick="deleteFooterItem('follow', ${item.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Open footer modal
function openFooterModal(type) {
    currentFooterType = type;
    editingFooterItem = null;
    
    document.getElementById('footerForm').reset();
    document.getElementById('footerItemId').value = '';
    document.getElementById('footerItemType').value = type;
    
    // Show/hide icon field based on type
    const iconGroup = document.getElementById('footerIconGroup');
    if (type === 'contact' || type === 'follow') {
        iconGroup.style.display = 'block';
    } else {
        iconGroup.style.display = 'none';
    }
    
    // Update modal title
    const titles = {
        contact: '📞 Add Contact Info',
        important: '⭐ Add Important Link',
        quicklinks: '🔗 Add Quick Link',
        follow: '📱 Add Social Link'
    };
    document.getElementById('footerModalTitle').textContent = titles[type];
    document.getElementById('footerSubmitBtn').textContent = '💾 Save';
    
    document.getElementById('footerModal').classList.add('active');
}

// Close footer modal
function closeFooterModal() {
    document.getElementById('footerModal').classList.remove('active');
    editingFooterItem = null;
}

// Edit footer item
function editFooterItem(type, id) {
    const item = footerData[type].find(i => i.id === id);
    if (!item) return;
    
    currentFooterType = type;
    editingFooterItem = id;
    
    document.getElementById('footerItemId').value = id;
    document.getElementById('footerItemType').value = type;
    document.getElementById('footerTitle').value = item.title;
    document.getElementById('footerValue').value = item.value;
    
    // Show/hide icon field based on type
    const iconGroup = document.getElementById('footerIconGroup');
    if (type === 'contact' || type === 'follow') {
        iconGroup.style.display = 'block';
        document.getElementById('footerIcon').value = item.icon || '';
    } else {
        iconGroup.style.display = 'none';
    }
    
    // Update modal title
    const titles = {
        contact: '✏️ Edit Contact Info',
        important: '✏️ Edit Important Link',
        quicklinks: '✏️ Edit Quick Link',
        follow: '✏️ Edit Social Link'
    };
    document.getElementById('footerModalTitle').textContent = titles[type];
    document.getElementById('footerSubmitBtn').textContent = '💾 Update';
    
    document.getElementById('footerModal').classList.add('active');
}

// Delete footer item
function deleteFooterItem(type, id) {
    if (!confirm('क्या आप इसे delete करना चाहते हैं?')) return;
    
    footerData[type] = footerData[type].filter(item => item.id !== id);
    saveFooterData();
    renderAllFooterTables();
    showAlert('Item deleted successfully!', 'success');
}

// Footer form submission
document.getElementById('footerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const type = document.getElementById('footerItemType').value;
    const title = document.getElementById('footerTitle').value;
    const value = document.getElementById('footerValue').value;
    const icon = document.getElementById('footerIcon').value;
    
    if (editingFooterItem) {
        // Update existing
        const index = footerData[type].findIndex(i => i.id === editingFooterItem);
        if (index !== -1) {
            footerData[type][index].title = title;
            footerData[type][index].value = value;
            if (type === 'contact' || type === 'follow') {
                footerData[type][index].icon = icon;
            }
        }
        showAlert('Item updated successfully!', 'success');
    } else {
        // Add new
        const newId = footerData[type].length > 0 ? Math.max(...footerData[type].map(i => i.id)) + 1 : 1;
        const newItem = { id: newId, title, value };
        if (type === 'contact' || type === 'follow') {
            newItem.icon = icon;
        }
        footerData[type].push(newItem);
        showAlert('Item added successfully!', 'success');
    }
    
    saveFooterData();
    closeFooterModal();
    renderAllFooterTables();
});

// ==================== EDIT FUNCTIONS ====================
function editHospital(id) {
    const hospital = hospitals.find(h => h.id === id);
    if (!hospital) return;
    
    document.getElementById('hospitalId').value = hospital.id;
    document.getElementById('hospitalName').value = hospital.name;
    document.getElementById('hospitalLocation').value = hospital.location;
    document.getElementById('hospitalCity').value = hospital.city;
    document.getElementById('hospitalType').value = hospital.type || 'GOV';
    document.getElementById('hospitalDepts').value = hospital.departments || hospital.total_doctors || 10;
    document.getElementById('hospitalLat').value = hospital.lat || '';
    document.getElementById('hospitalLng').value = hospital.lng || '';
    document.getElementById('hospitalCardBranding').value = hospital.card_branding || '';
    
    document.getElementById('hospitalModalTitle').textContent = '✏️ Edit Hospital';
    document.getElementById('hospitalSubmitBtn').textContent = '💾 Update Hospital';
    openModal('hospital');
}

function editDoctor(id) {
    const doctor = doctors.find(d => d.id === id);
    if (!doctor) return;
    
    // Find hospital name from hospital_id
    const hospital = hospitals.find(h => h.id === doctor.hospital_id);
    
    document.getElementById('doctorName').value = doctor.name;
    document.getElementById('doctorSpecialty').value = doctor.specialty;
    document.getElementById('doctorExperience').value = doctor.experience || '';
    document.getElementById('doctorHospital').value = hospital ? hospital.name : '';
    document.getElementById('doctorHospitalId').value = doctor.hospital_id || '';
    document.getElementById('doctorStatus').value = doctor.status;
    document.getElementById('doctorFees').value = doctor.fees || '';
    document.getElementById('doctorTiming').value = doctor.timing || '';
    document.getElementById('doctorQualification').value = doctor.qualification || '';
    document.getElementById('doctorSubSpecialization').value = doctor.sub_specialization || '';
    document.getElementById('doctorRoom').value = doctor.room_no || '';
    document.getElementById('doctorFloor').value = doctor.floor || '';
    document.getElementById('doctorBlock').value = doctor.block || '';
    
    openModal('doctor');
}

// ==================== ALERT ====================
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert ${type} show`;
    
    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 3000);
}

// ==================== ACTIVITY LOG ====================
function addActivity(action, details) {
    const tbody = document.getElementById('activityLog');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${new Date().toLocaleTimeString()}</td>
        <td>${action}</td>
        <td>${details}</td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
    
    // Keep only last 10 activities
    while (tbody.children.length > 10) {
        tbody.removeChild(tbody.lastChild);
    }
}

// ==================== CONTACT MESSAGES MANAGEMENT ====================

// Load contact messages
function loadContactMessages() {
    contactMessages = JSON.parse(localStorage.getItem('contactMessages') || '[]');
    filteredContactMessages = [...contactMessages];
    renderContactMessagesTable();
    updateContactMessageStats();
}

// Refresh contact messages
function refreshContactMessages() {
    loadContactMessages();
    showAlert('Messages refreshed!', 'success');
}

// Update contact message stats
function updateContactMessageStats() {
    const pendingCount = contactMessages.filter(m => m.status === 'pending').length;
    
    // Update stat card
    const statElement = document.getElementById('statContactMessages');
    if (statElement) statElement.textContent = contactMessages.length;
    
    // Update pending badge
    const pendingBadge = document.getElementById('pendingCount');
    if (pendingBadge) pendingBadge.textContent = `${pendingCount} Pending`;
    
    // Update info text
    const infoElement = document.getElementById('contactMessagesInfo');
    if (infoElement) infoElement.textContent = `Total: ${filteredContactMessages.length} messages`;
}

// Search contact messages
function searchContactMessages() {
    const query = document.getElementById('searchContactMessages').value.toLowerCase().trim();
    
    if (query === '') {
        filteredContactMessages = [...contactMessages];
    } else {
        filteredContactMessages = contactMessages.filter(m => 
            m.name.toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query) ||
            m.subject.toLowerCase().includes(query) ||
            m.message.toLowerCase().includes(query)
        );
    }
    
    currentPages['contact-messages'] = 1;
    renderContactMessagesTable();
    updateContactMessageStats();
}

// Render contact messages table with pagination
function renderContactMessagesTable() {
    const tbody = document.getElementById('contactMessagesTable');
    if (!tbody) return;
    
    if (filteredContactMessages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">कोई message नहीं है</td></tr>';
        document.getElementById('contactMessagesPagination').innerHTML = '';
        return;
    }
    
    // Sort by date (newest first)
    const sortedMessages = [...filteredContactMessages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const currentPage = currentPages['contact-messages'] || 1;
    const totalPages = Math.ceil(sortedMessages.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
    
    tbody.innerHTML = paginatedMessages.map(m => `
        <tr>
            <td>${m.id}</td>
            <td><strong>${m.name}</strong></td>
            <td>${m.email}</td>
            <td>${m.subjectText || m.subject}</td>
            <td><span class="status-${m.status}">${m.status === 'pending' ? '⏳ Pending' : '✅ Replied'}</span></td>
            <td>${new Date(m.createdAt).toLocaleDateString('hi-IN')}</td>
            <td class="action-btns">
                <button class="btn-edit" onclick="viewContactMessage(${m.id})" title="View & Reply">👁️</button>
                <button class="btn-delete" onclick="deleteContactMessage(${m.id})" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    // Generate pagination
    renderContactMessagesPagination(totalPages, currentPage);
}

// Render contact messages pagination
function renderContactMessagesPagination(totalPages, currentPage) {
    const container = document.getElementById('contactMessagesPagination');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination-container">';
    
    // Previous button
    paginationHTML += `<button class="page-btn" onclick="changeContactMessagesPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>« Prev</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changeContactMessagesPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += '<span class="page-dots">...</span>';
        }
    }
    
    // Next button
    paginationHTML += `<button class="page-btn" onclick="changeContactMessagesPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next »</button>`;
    
    paginationHTML += `<span class="pagination-info">Page ${currentPage} of ${totalPages}</span>`;
    paginationHTML += '</div>';
    
    container.innerHTML = paginationHTML;
}

// Change contact messages page
function changeContactMessagesPage(page) {
    const totalPages = Math.ceil(filteredContactMessages.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    
    currentPages['contact-messages'] = page;
    renderContactMessagesTable();
}

// View contact message
function viewContactMessage(id) {
    const message = contactMessages.find(m => m.id === id);
    if (!message) return;
    
    const detailContent = document.getElementById('messageDetailContent');
    detailContent.innerHTML = `
        <div class="message-detail">
            <h4>👤 User Details</h4>
            <p><span class="label">Name:</span> <strong>${message.name}</strong></p>
            <p><span class="label">Email:</span> <strong style="color:#1e88e5;">${message.email}</strong></p>
            <p><span class="label">Mobile:</span> ${message.mobile}</p>
            <p><span class="label">Subject:</span> ${message.subjectText || message.subject}</p>
            <p><span class="label">Date:</span> ${new Date(message.createdAt).toLocaleString('hi-IN')}</p>
        </div>
        <div class="message-detail">
            <h4>💬 Message</h4>
            <div class="message-content">${message.message}</div>
        </div>
    `;
    
    // Show previous reply if exists
    const previousReplySection = document.getElementById('previousReplySection');
    if (message.reply && message.status === 'replied') {
        previousReplySection.innerHTML = `
            <div class="previous-reply">
                <strong>📧 Previous Reply:</strong>
                <div class="message-content" style="margin-top:10px;">${message.reply}</div>
                <div class="reply-date">Replied on: ${new Date(message.repliedAt).toLocaleString('hi-IN')}</div>
            </div>
        `;
    } else {
        previousReplySection.innerHTML = '';
    }
    
    document.getElementById('replyMessageId').value = id;
    document.getElementById('replyText').value = '';
    document.getElementById('contactMessageModal').classList.add('active');
}

// Close contact message modal
function closeContactMessageModal() {
    document.getElementById('contactMessageModal').classList.remove('active');
}

// Delete contact message
function deleteContactMessage(id) {
    if (!confirm('क्या आप इस message को delete करना चाहते हैं?')) return;
    
    contactMessages = contactMessages.filter(m => m.id !== id);
    localStorage.setItem('contactMessages', JSON.stringify(contactMessages));
    
    filteredContactMessages = filteredContactMessages.filter(m => m.id !== id);
    renderContactMessagesTable();
    updateContactMessageStats();
    showAlert('Message deleted!', 'success');
}

// Reply form submission
document.getElementById('replyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const messageId = parseInt(document.getElementById('replyMessageId').value);
    const replyText = document.getElementById('replyText').value.trim();
    
    if (!replyText) {
        showAlert('Please write a reply message', 'error');
        return;
    }
    
    // Find and update the message
    const messageIndex = contactMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const message = contactMessages[messageIndex];
    
    // Update message status
    contactMessages[messageIndex].status = 'replied';
    contactMessages[messageIndex].reply = replyText;
    contactMessages[messageIndex].repliedAt = new Date().toISOString();
    
    // Save to localStorage
    localStorage.setItem('contactMessages', JSON.stringify(contactMessages));
    
    // Open Gmail compose window with pre-filled data
    const subject = encodeURIComponent(`Re: ${message.subjectText || message.subject} - LiveHospital Support`);
    const body = encodeURIComponent(`प्रिय ${message.name},\n\n${replyText}\n\n---\nआपका मूल संदेश:\n"${message.message}"\n\n---\nधन्यवाद,\nLiveHospital Support Team`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${message.email}&su=${subject}&body=${body}`;
    
    // Open Gmail in new tab
    window.open(gmailUrl, '_blank');
    
    // Update UI
    closeContactMessageModal();
    filteredContactMessages = [...contactMessages];
    renderContactMessagesTable();
    updateContactMessageStats();
    showAlert('Reply sent! Gmail opened in new tab.', 'success');
});

// ==================== PAGE CONTENT MANAGEMENT ====================

// Current active editor
let currentEditor = null;

// Show page tab
function showPageTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.page-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.page-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`page-tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
    
    // Focus on editor
    currentEditor = document.getElementById(`editor-${tabName}`);
}

// Load all page content from localStorage
function loadAllPageContent() {
    const pages = ['privacy', 'terms', 'cookies'];
    pages.forEach(page => {
        const savedContent = localStorage.getItem(`pageContent_${page}`);
        const editor = document.getElementById(`editor-${page}`);
        if (savedContent && editor) {
            editor.innerHTML = savedContent;
        }
    });
}

// Format text using execCommand
function formatText(command, value = null) {
    document.execCommand(command, false, value);
}

// Format heading
function formatHeading(page, tag) {
    if (!tag) return;
    document.execCommand('formatBlock', false, tag);
    // Reset dropdown
    event.target.value = '';
}

// Insert link
function insertLink() {
    const url = prompt('Enter URL (with https://):');
    if (url) {
        const text = document.getSelection().toString() || prompt('Enter link text:') || url;
        document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`);
    }
}

// Insert blockquote
function insertQuote() {
    document.execCommand('formatBlock', false, 'blockquote');
}

// Insert horizontal rule
function insertHR() {
    document.execCommand('insertHTML', false, '<hr style="border: 1px solid #252d38; margin: 20px 0;">');
}

// Auto save page content (debounced)
let autoSaveTimeout = {};
function autoSavePageContent(page) {
    clearTimeout(autoSaveTimeout[page]);
    autoSaveTimeout[page] = setTimeout(() => {
        const editor = document.getElementById(`editor-${page}`);
        if (editor) {
            localStorage.setItem(`pageContent_${page}`, editor.innerHTML);
        }
    }, 1000);
}

// Save page content
function savePageContent(page) {
    const editor = document.getElementById(`editor-${page}`);
    if (!editor) return;
    
    const content = editor.innerHTML;
    localStorage.setItem(`pageContent_${page}`, content);
    
    // Update the actual page file (in real app, this would be an API call)
    updatePageFile(page, content);
    
    showAlert(`${page.charAt(0).toUpperCase() + page.slice(1)} page saved successfully!`, 'success');
}

// Update page file content
function updatePageFile(page, content) {
    // Store in localStorage for the frontend pages to read
    localStorage.setItem(`pageContent_${page}_html`, content);
}

// Preview page content
function previewPageContent(page) {
    const editor = document.getElementById(`editor-${page}`);
    if (!editor) return;
    
    const pageUrls = {
        'privacy': 'privacy.html',
        'terms': 'terms.html',
        'cookies': 'cookies.html'
    };
    
    // Save before preview
    savePageContent(page);
    
    // Open page in new tab
    window.open(pageUrls[page], '_blank');
}

// Keyboard shortcuts for editor
document.addEventListener('keydown', function(e) {
    if (!e.target.classList.contains('rich-editor')) return;
    
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                formatText('bold');
                break;
            case 'i':
                e.preventDefault();
                formatText('italic');
                break;
            case 'u':
                e.preventDefault();
                formatText('underline');
                break;
            case 'k':
                e.preventDefault();
                insertLink();
                break;
        }
    }
});

// ==================== HOSPITAL AUTOCOMPLETE ====================

// Show hospital suggestions
function showHospitalSuggestions(query) {
    const suggestionsDiv = document.getElementById('hospitalSuggestions');
    if (!suggestionsDiv) return;
    
    query = query.trim().toLowerCase();
    
    // Hide if empty query
    if (query.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
    }
    
    // Filter hospitals based on query
    const matchingHospitals = hospitals.filter(h => 
        h.name.toLowerCase().includes(query) || 
        (h.location && h.location.toLowerCase().includes(query))
    ).slice(0, 10); // Show max 10 results
    
    // Build suggestions HTML
    if (matchingHospitals.length === 0) {
        suggestionsDiv.innerHTML = '<div class="no-results">कोई hospital नहीं मिला</div>';
    } else {
        suggestionsDiv.innerHTML = matchingHospitals.map(h => `
            <div class="autocomplete-item" onclick="selectHospital('${h.name.replace(/'/g, "\\'")}')">
                <div><strong>${h.name}</strong></div>
                <div class="hospital-location">📍 ${h.location || ''} ${h.type === 'GOV' ? '(सरकारी)' : '(प्राइवेट)'}</div>
            </div>
        `).join('');
    }
    
    suggestionsDiv.classList.add('show');
}

// Select hospital from suggestions
function selectHospital(hospitalName) {
    document.getElementById('hospitalAdminHospital').value = hospitalName;
    document.getElementById('hospitalSuggestions').classList.remove('show');
}

// Hide suggestions when clicking outside
document.addEventListener('click', function(e) {
    // Hospital Admin suggestions
    const suggestionsDiv = document.getElementById('hospitalSuggestions');
    const hospitalInput = document.getElementById('hospitalAdminHospital');
    if (suggestionsDiv && hospitalInput) {
        if (!hospitalInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.remove('show');
        }
    }
    
    // Doctor Hospital suggestions
    const doctorSuggestions = document.getElementById('doctorHospitalSuggestions');
    const doctorInput = document.getElementById('doctorHospital');
    if (doctorSuggestions && doctorInput) {
        if (!doctorInput.contains(e.target) && !doctorSuggestions.contains(e.target)) {
            doctorSuggestions.classList.remove('show');
        }
    }
    
    // Blood Hospital suggestions
    const bloodSuggestions = document.getElementById('bloodHospitalSuggestions');
    const bloodInput = document.getElementById('bloodHospital');
    if (bloodSuggestions && bloodInput) {
        if (!bloodInput.contains(e.target) && !bloodSuggestions.contains(e.target)) {
            bloodSuggestions.classList.remove('show');
        }
    }
    
    // Blood Admin Hospital suggestions
    const bloodAdminSuggestions = document.getElementById('bloodAdminHospitalSuggestions');
    const bloodAdminInput = document.getElementById('bloodAdminHospital');
    if (bloodAdminSuggestions && bloodAdminInput) {
        if (!bloodAdminInput.contains(e.target) && !bloodAdminSuggestions.contains(e.target)) {
            bloodAdminSuggestions.classList.remove('show');
        }
    }
});

// ==================== DOCTOR HOSPITAL AUTOCOMPLETE ====================

function showDoctorHospitalSuggestions(query) {
    const suggestionsDiv = document.getElementById('doctorHospitalSuggestions');
    if (!suggestionsDiv) return;
    
    query = query.trim().toLowerCase();
    
    if (query.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
    }
    
    const matchingHospitals = hospitals.filter(h => 
        h.name.toLowerCase().includes(query) || 
        (h.location && h.location.toLowerCase().includes(query))
    ).slice(0, 10);
    
    if (matchingHospitals.length === 0) {
        suggestionsDiv.innerHTML = '<div class="no-results">कोई hospital नहीं मिला</div>';
    } else {
        suggestionsDiv.innerHTML = matchingHospitals.map(h => `
            <div class="autocomplete-item" onclick="selectDoctorHospital(${h.id}, '${h.name.replace(/'/g, "\\'")}')">
                <div><strong>${h.name}</strong></div>
                <div class="hospital-location">📍 ${h.location || ''} ${h.type === 'GOV' ? '(सरकारी)' : '(प्राइवेट)'}</div>
            </div>
        `).join('');
    }
    
    suggestionsDiv.classList.add('show');
}

function selectDoctorHospital(hospitalId, hospitalName) {
    document.getElementById('doctorHospital').value = hospitalName;
    document.getElementById('doctorHospitalId').value = hospitalId;
    document.getElementById('doctorHospitalSuggestions').classList.remove('show');
}

// ==================== BLOOD HOSPITAL AUTOCOMPLETE ====================

function showBloodHospitalSuggestions(query) {
    const suggestionsDiv = document.getElementById('bloodHospitalSuggestions');
    if (!suggestionsDiv) return;
    
    query = query.trim().toLowerCase();
    
    if (query.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
    }
    
    const matchingHospitals = hospitals.filter(h => 
        h.name.toLowerCase().includes(query) || 
        (h.location && h.location.toLowerCase().includes(query))
    ).slice(0, 10);
    
    if (matchingHospitals.length === 0) {
        suggestionsDiv.innerHTML = '<div class="no-results">कोई hospital नहीं मिला</div>';
    } else {
        suggestionsDiv.innerHTML = matchingHospitals.map(h => `
            <div class="autocomplete-item" onclick="selectBloodHospital(${h.id}, '${h.name.replace(/'/g, "\\'")}')">
                <div><strong>${h.name}</strong></div>
                <div class="hospital-location">📍 ${h.location || ''} ${h.type === 'GOV' ? '(सरकारी)' : '(प्राइवेट)'}</div>
            </div>
        `).join('');
    }
    
    suggestionsDiv.classList.add('show');
}

function selectBloodHospital(hospitalId, hospitalName) {
    document.getElementById('bloodHospital').value = hospitalName;
    document.getElementById('bloodHospitalId').value = hospitalId;
    document.getElementById('bloodHospitalSuggestions').classList.remove('show');
}

// ==================== BLOOD ADMIN HOSPITAL AUTOCOMPLETE ====================

function showBloodAdminHospitalSuggestions(query) {
    const suggestionsDiv = document.getElementById('bloodAdminHospitalSuggestions');
    if (!suggestionsDiv) return;
    
    query = query.trim().toLowerCase();
    
    if (query.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
    }
    
    const matchingHospitals = hospitals.filter(h => 
        h.name.toLowerCase().includes(query) || 
        (h.location && h.location.toLowerCase().includes(query))
    ).slice(0, 10);
    
    if (matchingHospitals.length === 0) {
        suggestionsDiv.innerHTML = '<div class="no-results">कोई hospital नहीं मिला</div>';
    } else {
        suggestionsDiv.innerHTML = matchingHospitals.map(h => `
            <div class="autocomplete-item" onclick="selectBloodAdminHospital('${h.name.replace(/'/g, "\\'")}')">
                <div><strong>${h.name}</strong></div>
                <div class="hospital-location">📍 ${h.location || ''} ${h.type === 'GOV' ? '(सरकारी)' : '(प्राइवेट)'}</div>
            </div>
        `).join('');
    }
    
    suggestionsDiv.classList.add('show');
}

function selectBloodAdminHospital(hospitalName) {
    document.getElementById('bloodAdminHospital').value = hospitalName;
    document.getElementById('bloodAdminHospitalSuggestions').classList.remove('show');
}

// ==================== SITE SETTINGS (SEO, sitemap, robots, full backup, caching) ====================
/** Same host as admin page (fixes wrong hardcoded API port); file:// falls back to API_URL */
function sameOriginApiBase() {
    if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        return `${window.location.origin}/api`;
    }
    return API_URL.replace(/\/$/, '');
}
function siteSettingsApiUrl() {
    return `${sameOriginApiBase()}/site-settings`;
}

const SITE_SEO_PAGE_LABELS = {
    home: 'होम (/)',
    privacy: 'गोपनीयता (/privacy)',
    terms: 'नियम व शर्तें (/terms)',
    cookies: 'कुकीज़ (/cookies)',
    contact: 'संपर्क (/contact)'
};

function escapeSiteSettingsHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeSiteSettingsAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function showSiteSettingsTab(tab, btn) {
    document.querySelectorAll('.site-settings-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.site-settings-tab-content').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.querySelector(`.site-settings-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`site-settings-tab-${tab}`)?.classList.add('active');
}

function renderSiteSeoPagesForm(pages) {
    const container = document.getElementById('siteSeoPagesForm');
    if (!container) return;
    const keys = Object.keys(pages || {}).length
        ? Object.keys(pages)
        : Object.keys(SITE_SEO_PAGE_LABELS);
    container.innerHTML = keys.map((key) => {
        const p = (pages && pages[key]) || { title: '', description: '' };
        const label = SITE_SEO_PAGE_LABELS[key] || key;
        return `
            <div style="border:1px solid #252d38;border-radius:10px;padding:14px;background:#111827;">
                <strong style="color:#e5e7eb;">${escapeSiteSettingsHtml(label)}</strong>
                <label style="color:#9ca3af;display:block;margin-top:10px;">Title</label>
                <input type="text" class="site-seo-title" data-page="${escapeSiteSettingsAttr(key)}" value="${escapeSiteSettingsAttr(p.title)}" style="width:100%;margin-top:4px;padding:10px;background:#0d1117;border:1px solid #252d38;border-radius:8px;color:#fff;">
                <label style="color:#9ca3af;display:block;margin-top:10px;">Description</label>
                <textarea class="site-seo-desc" data-page="${escapeSiteSettingsAttr(key)}" rows="2" style="width:100%;margin-top:4px;padding:10px;background:#0d1117;border:1px solid #252d38;border-radius:8px;color:#fff;">${escapeSiteSettingsHtml(p.description || '')}</textarea>
            </div>`;
    }).join('');
}

async function loadSiteSettingsAdmin() {
    try {
        const r = await authFetch(siteSettingsApiUrl());
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const b = data.basic || {};
        const st = document.getElementById('siteBasicSiteTitle');
        if (st) st.value = b.siteTitle || '';
        const tg = document.getElementById('siteBasicTagline');
        if (tg) tg.value = b.tagline || '';
        const baseEl = document.getElementById('sitePublicBaseUrl');
        if (baseEl) baseEl.value = data.publicBaseUrl || '';
        const mm = document.getElementById('siteMaintenanceMode');
        if (mm) mm.checked = !!(b.maintenanceMode);
        const msm = document.getElementById('siteMaintenanceMessage');
        if (msm) msm.value = b.maintenanceMessage || '';
        const integ = data.integrations || {};
        const ga = document.getElementById('siteGA4Id');
        if (ga) ga.value = integ.googleAnalyticsMeasurementId || '';
        const gtm = document.getElementById('siteGTMId');
        if (gtm) gtm.value = integ.googleTagManagerId || '';
        const inotes = document.getElementById('siteIntegrationsNotes');
        if (inotes) inotes.value = integ.notes || '';
        const contact = data.contact || {};
        const cp = document.getElementById('siteContactPhone');
        if (cp) cp.value = contact.phone || '';
        const cw = document.getElementById('siteContactWhatsapp');
        if (cw) cw.value = contact.whatsapp || '';
        const cse = document.getElementById('siteContactSupportEmail');
        if (cse) cse.value = contact.supportEmail || '';
        const cpe = document.getElementById('siteContactPrivacyEmail');
        if (cpe) cpe.value = contact.privacyEmail || '';
        const ch = document.getElementById('siteContactHours');
        if (ch) ch.value = contact.hours || '';
        const coe = document.getElementById('siteContactOwnerEmail');
        if (coe) coe.value = contact.ownerEmail || '';
        const social = data.social || {};
        const sf = document.getElementById('siteSocialFacebook');
        if (sf) sf.value = social.facebook || '';
        const stg = document.getElementById('siteSocialTelegram');
        if (stg) stg.value = social.telegram || '';
        const si = document.getElementById('siteSocialInstagram');
        if (si) si.value = social.instagram || '';
        const sy = document.getElementById('siteSocialYoutube');
        if (sy) sy.value = social.youtube || '';
        const stw = document.getElementById('siteSocialTwitter');
        if (stw) stw.value = social.twitter || '';
        const sw = document.getElementById('siteSocialWhatsapp');
        if (sw) sw.value = social.whatsapp || '';
        const pages = (data.seo && data.seo.pages) || {};
        renderSiteSeoPagesForm(pages);
        const sm = document.getElementById('siteSitemapExtra');
        if (sm) sm.value = (data.sitemap && data.sitemap.extraPaths || []).join('\n');
        const ra = document.getElementById('siteRobotsAllowAll');
        if (ra) ra.checked = !(data.robots && data.robots.allowAll === false);
        const rd = document.getElementById('siteRobotsDisallow');
        if (rd) rd.value = (data.robots && data.robots.disallowPaths || []).join('\n');
        const la = document.getElementById('siteLogoAlt');
        if (la) la.value = (data.images && data.images.logoAlt) || '';
        const ig = document.getElementById('siteImageGuidelines');
        if (ig) ig.value = (data.images && data.images.guidelines) || '';
        const ce = document.getElementById('siteCachingEnabled');
        if (ce) ce.checked = !!(data.caching && data.caching.enabled !== false);
        const cm = document.getElementById('siteCachingMaxAge');
        if (cm) cm.value = (data.caching && data.caching.staticMaxAge != null) ? data.caching.staticMaxAge : 86400;
        const cn = document.getElementById('siteCachingNotes');
        if (cn) cn.value = (data.caching && data.caching.notes) || '';
    } catch (e) {
        renderSiteSeoPagesForm({});
        showFieldError('Site settings लोड नहीं हो सके (सर्वर चालू करके इसी पते से /admin खोलें): ' + (e.message || String(e)));
    }
}

async function saveSiteSettingsAdmin() {
    const pages = {};
    document.querySelectorAll('.site-seo-title').forEach((inp) => {
        const key = inp.dataset.page;
        if (!key) return;
        const wrap = inp.closest('div');
        const desc = wrap && wrap.querySelector('textarea.site-seo-desc');
        pages[key] = {
            title: inp.value.trim(),
            description: desc ? desc.value.trim() : ''
        };
    });

    const disallowRaw = document.getElementById('siteRobotsDisallow');
    const disallowLines = (disallowRaw && disallowRaw.value || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const extraRaw = document.getElementById('siteSitemapExtra');
    const extraPaths = (extraRaw && extraRaw.value || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const body = {
        publicBaseUrl: trimVal('sitePublicBaseUrl'),
        basic: {
            siteTitle: trimVal('siteBasicSiteTitle'),
            tagline: trimVal('siteBasicTagline'),
            maintenanceMode: !!(document.getElementById('siteMaintenanceMode') && document.getElementById('siteMaintenanceMode').checked),
            maintenanceMessage: (document.getElementById('siteMaintenanceMessage') && document.getElementById('siteMaintenanceMessage').value.trim()) || ''
        },
        integrations: {
            googleAnalyticsMeasurementId: trimVal('siteGA4Id'),
            googleTagManagerId: trimVal('siteGTMId'),
            notes: (document.getElementById('siteIntegrationsNotes') && document.getElementById('siteIntegrationsNotes').value.trim()) || ''
        },
        contact: {
            phone: trimVal('siteContactPhone'),
            whatsapp: trimVal('siteContactWhatsapp'),
            supportEmail: trimVal('siteContactSupportEmail') || 'support@livehospital.org',
            privacyEmail: trimVal('siteContactPrivacyEmail') || 'privacy@livehospital.org',
            ownerEmail: trimVal('siteContactOwnerEmail'),
            hours: trimVal('siteContactHours') || 'सोमवार - शनिवार (9AM - 6PM)'
        },
        social: {
            facebook: trimVal('siteSocialFacebook'),
            telegram: trimVal('siteSocialTelegram'),
            instagram: trimVal('siteSocialInstagram'),
            youtube: trimVal('siteSocialYoutube'),
            twitter: trimVal('siteSocialTwitter'),
            whatsapp: trimVal('siteSocialWhatsapp')
        },
        seo: { pages },
        robots: {
            allowAll: !!(document.getElementById('siteRobotsAllowAll') && document.getElementById('siteRobotsAllowAll').checked),
            disallowPaths: disallowLines
        },
        sitemap: { extraPaths },
        images: {
            logoAlt: trimVal('siteLogoAlt'),
            guidelines: (document.getElementById('siteImageGuidelines') && document.getElementById('siteImageGuidelines').value.trim()) || ''
        },
        caching: {
            enabled: !!(document.getElementById('siteCachingEnabled') && document.getElementById('siteCachingEnabled').checked),
            staticMaxAge: parseInt(document.getElementById('siteCachingMaxAge').value, 10) || 0,
            notes: (document.getElementById('siteCachingNotes') && document.getElementById('siteCachingNotes').value.trim()) || ''
        }
    };

    if (Object.keys(pages).length === 0) {
        delete body.seo;
    }

    try {
        const r = await authFetch(siteSettingsApiUrl(), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error(await r.text());
        const out = await r.json();
        if (out.settings) renderSiteSeoPagesForm((out.settings.seo && out.settings.seo.pages) || {});
        showAlert('Site settings सेव हो गईं।', 'success');
    } catch (e) {
        showFieldError('सेव नहीं हो सका: ' + (e.message || String(e)));
    }
}

async function clearDemoDataFromDatabase() {
    if (!window.confirm('सभी hospitals, doctors, blood requests और cities DELETE होंगे। Admin accounts safe रहेंगे। जारी रखें?')) return;
    try {
        const r = await authFetch(`${sameOriginApiBase()}/clear-demo-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'CLEAR_DEMO_DATA' })
        });
        let out = {};
        try {
            out = await r.json();
        } catch (e) { /* ignore */ }
        if (!r.ok) throw new Error(out.error || r.statusText || 'Clear failed');
        showAlert(out.message || 'Demo data clear हो गया।', 'success');
        if (typeof loadAllData === 'function') await loadAllData();
    } catch (e) {
        showFieldError('Demo data clear नहीं हो सका: ' + (e.message || String(e)));
    }
}

async function downloadFullSiteBackup() {
    try {
        const r = await authFetch(`${sameOriginApiBase()}/full-backup/export`);
        if (!r.ok) {
            if (r.status === 404) {
                throw new Error('API नहीं मिली (404)। `server` में `node server.js` चालू करें, कोड सेव के बाद सर्वर रीस्टार्ट करें, और /admin उसी होस्ट से खोलें — Live Server या पुराना Node नहीं।');
            }
            let msg = await r.text();
            try {
                const j = JSON.parse(msg);
                if (j.error) msg = j.error;
            } catch (e) { /* keep text */ }
            throw new Error(msg || r.statusText);
        }
        const blob = await r.blob();
        const cd = r.headers.get('Content-Disposition');
        let name = `medichek-full-backup-${Date.now()}.json`;
        const m = cd && cd.match(/filename\*?=(?:UTF-8'')?["']?([^";\n]+)["']?/i);
        if (m) name = decodeURIComponent(m[1].trim());
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        showAlert('बैकअप डाउनलोड शुरू हो गया।', 'success');
    } catch (e) {
        showFieldError('डाउनलोड नहीं हो सका: ' + (e.message || String(e)));
    }
}

async function uploadFullSiteBackup() {
    const inp = document.getElementById('fullBackupFileInput');
    if (!inp || !inp.files || !inp.files[0]) {
        showFieldError('पहले .json बैकअप फाइल चुनें।');
        return;
    }
    if (!window.confirm('मौजूदा MySQL डेटा इस बैकअप से पूरी तरह बदल दिया जाएगा। जारी रखें?')) return;
    try {
        const raw = await inp.files[0].text();
        JSON.parse(raw);
        const r = await authFetch(`${sameOriginApiBase()}/full-backup/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: raw
        });
        let out = {};
        try {
            out = await r.json();
        } catch (e) { /* ignore */ }
        if (!r.ok) throw new Error(out.error || r.statusText || 'Import failed');
        showAlert(out.message || 'रिस्टोर पूरा हुआ।', 'success');
        if (typeof loadAllData === 'function') await loadAllData();
    } catch (e) {
        showFieldError('अपलोड / रिस्टोर नहीं हो सका: ' + (e.message || String(e)));
    }
}
