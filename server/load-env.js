const fs = require('fs');
const path = require('path');

function parseEnvContent(raw) {
    const env = {};
    const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return env;

    // Some editors save the whole .env on one line — split before KEY= tokens.
    const chunks = normalized.includes('\n')
        ? normalized.split(/\n/)
        : normalized.split(/\s+(?=[A-Z][A-Z0-9_]*=)/);

    chunks.forEach((chunk) => {
        let trimmed = chunk.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trim();
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
        if (!fs.existsSync(filePath)) return { env: {}, exists: false, path: filePath };
        const env = parseEnvContent(fs.readFileSync(filePath, 'utf8'));
        return { env, exists: true, path: filePath };
    } catch (err) {
        return { env: {}, exists: false, path: filePath, error: err.message };
    }
}

function applyEnv(env) {
    Object.entries(env).forEach(([key, value]) => {
        process.env[key] = value;
    });
}

function loadServerEnv(serverDir) {
    const envPath = path.join(serverDir, '.env');
    const loaded = loadEnvFile(envPath);
    applyEnv(loaded.env);
    return loaded;
}

module.exports = {
    loadEnvFile,
    applyEnv,
    loadServerEnv,
    parseEnvContent,
};
