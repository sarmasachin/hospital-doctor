(function () {
    const API_URL = `${window.location.origin}/api`;
    const path = (window.location.pathname || '/').toLowerCase();
    const isPanel = window.location.hostname === 'panel.livehospital.org';

    const PAGES = {
        home: { href: '/', icon: '🏠', title: 'होम पेज', desc: 'डॉक्टर उपलब्धता और हॉस्पिटल सूची' },
        contact: { href: '/contact', icon: '📞', title: 'संपर्क करें', desc: 'सपोर्ट और सहायता' },
        privacy: { href: '/privacy', icon: '🔒', title: 'गोपनीयता नीति', desc: 'Privacy Policy पढ़ें' },
        terms: { href: '/terms', icon: '📄', title: 'नियम और शर्तें', desc: 'Terms & Conditions' },
        cookies: { href: '/cookies', icon: '🍪', title: 'कुकी नीति', desc: 'Cookie Policy' },
        admin: { href: '/admin', icon: '🔐', title: 'Super Admin', desc: 'एडमिन लॉगिन' },
        hospitalAdmin: { href: '/hospital-admin', icon: '🏥', title: 'Hospital Admin', desc: 'हॉस्पिटल एडमिन पैनल' },
        bloodAdmin: { href: '/blood-admin', icon: '🩸', title: 'Blood Admin', desc: 'ब्लड विभाग एडमिन' },
        doctorAdmin: { href: '/doctor-admin', icon: '🩺', title: 'Doctor Panel', desc: 'डॉक्टर स्टेटस पैनल' }
    };

    function getRelatedPages() {
        const picks = [];
        const add = (page) => {
            if (!page || picks.some((p) => p.href === page.href)) return;
            picks.push(page);
        };

        if (isPanel || /admin|login|dashboard|panel/.test(path)) {
            add(PAGES.admin);
            if (/hospital/.test(path)) add(PAGES.hospitalAdmin);
            if (/blood/.test(path)) add(PAGES.bloodAdmin);
            add(PAGES.home);
            return picks.slice(0, 6);
        }

        if (/hospital|aiims|clinic|medical|gov|private/.test(path)) add(PAGES.home);
        if (/doctor|dr-|specialist|cardio|ortho|pediatr|surgeon/.test(path)) add(PAGES.home);
        if (/blood|donat|plasma|platelet/.test(path)) add(PAGES.home);
        if (/privacy|policy|gdpr|data/.test(path)) add(PAGES.privacy);
        if (/term|condition|rules/.test(path)) add(PAGES.terms);
        if (/cookie/.test(path)) add(PAGES.cookies);
        if (/contact|support|help|mail/.test(path)) add(PAGES.contact);

        add(PAGES.home);
        add(PAGES.contact);
        if (!/privacy/.test(path)) add(PAGES.privacy);

        return picks.slice(0, 6);
    }

    function renderLinks() {
        const grid = document.getElementById('relatedLinks');
        if (!grid) return;

        const pages = getRelatedPages();
        grid.innerHTML = pages.map((page) => `
            <a class="nf-card" href="${page.href}">
                <div class="nf-card-icon">${page.icon}</div>
                <h4>${page.title}</h4>
                <p>${page.desc}</p>
            </a>
        `).join('');
    }

    function renderHospitals(hospitals) {
        const grid = document.getElementById('hospitalCards');
        if (!grid) return;

        if (!hospitals.length) {
            grid.innerHTML = '<p class="nf-empty">अभी हॉस्पिटल लोड नहीं हो पाए। होम पेज से खोजें।</p>';
            return;
        }

        const list = hospitals.slice(0, 4);
        grid.innerHTML = list.map((h) => {
            const typeLabel = h.type === 'GOV' ? 'सरकारी' : 'प्राइवेट';
            const doctors = h.total_doctors || 0;
            return `
                <a class="nf-card nf-hospital-card" href="/#hospitals">
                    <div class="nf-card-icon">🏥</div>
                    <h4>${escapeHtml(h.name || 'Hospital')}</h4>
                    <p>${escapeHtml(h.location || h.city || 'India')}</p>
                    <div class="nf-meta">
                        <span class="nf-tag">${typeLabel}</span>
                        <span>👨‍⚕️ ${doctors} Doctors</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setupTheme() {
        const btn = document.getElementById('nfThemeToggle');
        const saved = localStorage.getItem('nf-theme') || localStorage.getItem('lh-theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        if (!btn) return;

        btn.textContent = saved === 'dark' ? '☀️' : '🌙';
        btn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('nf-theme', next);
            btn.textContent = next === 'dark' ? '☀️' : '🌙';
        });
    }

    function setupSearch() {
        const form = document.getElementById('nfSearchForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = (document.getElementById('nfSearchInput') || {}).value || '';
            const target = q.trim() ? `/#hospitals` : '/';
            if (q.trim()) sessionStorage.setItem('lh404Search', q.trim());
            window.location.href = target;
        });
    }

    function showAttemptedPath() {
        const el = document.getElementById('attemptedPath');
        if (!el) return;
        const shown = window.location.pathname + window.location.search;
        el.textContent = shown || '/unknown';
    }

    async function loadHospitals() {
        try {
            const res = await fetch(`${API_URL}/hospitals`);
            if (!res.ok) throw new Error('fetch failed');
            const data = await res.json();
            renderHospitals(Array.isArray(data) ? data : []);
        } catch (_) {
            renderHospitals([]);
        }
    }

    showAttemptedPath();
    setupTheme();
    setupSearch();
    renderLinks();
    loadHospitals();
})();
