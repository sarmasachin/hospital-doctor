const fs = require('fs');
const path = require('path');

function parseEnvContent(raw) {
    const env = {};
    raw.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
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
    return env;
}

function loadEnvFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return {};
    }
}

function applyEnv(env) {
    Object.entries(env).forEach(([key, value]) => {
        process.env[key] = value;
    });
}

function loadServerEnv(serverDir) {
    const envPath = path.join(serverDir, '.env');
    applyEnv(loadEnvFile(envPath));
    return envPath;
}

module.exports = {
    loadEnvFile,
    applyEnv,
    loadServerEnv,
    parseEnvContent,
};
