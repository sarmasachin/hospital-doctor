const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
    const env = {};
    try {
        if (!fs.existsSync(filePath)) return env;
        const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
        raw.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const idx = trimmed.indexOf('=');
            if (idx < 1) return;
            const key = trimmed.slice(0, idx).trim();
            let value = trimmed.slice(idx + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"'))
                || (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        });
    } catch (_) {
        return env;
    }
    return env;
}

const serverDir = path.join(__dirname, '..', 'server');
const fileEnv = loadEnvFile(path.join(serverDir, '.env'));

module.exports = {
    apps: [{
        name: 'livehospital',
        cwd: serverDir,
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '300M',
        env_production: {
            NODE_ENV: 'production',
            PORT: 5006,
            ...fileEnv
        }
    }]
};
