(function () {
    'use strict';

    function setupTheme() {
        var btn = document.getElementById('nfThemeToggle');
        var saved = 'light';
        try {
            saved = localStorage.getItem('nf-theme') || localStorage.getItem('lh-theme') || localStorage.getItem('medicheck-theme') || 'light';
        } catch (_) { /* private mode */ }
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        if (!btn) return;

        btn.textContent = saved === 'dark' ? '☀️' : '🌙';
        btn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem('nf-theme', next);
            } catch (_) { /* ignore */ }
            btn.textContent = next === 'dark' ? '☀️' : '🌙';
        });
    }

    function setupRetry() {
        var btn = document.getElementById('nfRetryBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            btn.disabled = true;
            btn.textContent = '⏳ लोड हो रहा है...';
            window.location.reload();
        });
    }

    setupTheme();
    setupRetry();
})();
