const path = require('path');
const { loadEnvFile } = require('../server/load-env');

const serverDir = path.resolve(__dirname, '..', 'server');
const fileEnv = loadEnvFile(path.join(serverDir, '.env')).env;

if (!fileEnv.DB_USER) {
    console.warn('[ecosystem] WARNING: server/.env missing or DB_USER empty at', path.join(serverDir, '.env'));
}

module.exports = {
    apps: [{
        name: 'livehospital',
        cwd: serverDir,
        script: 'server.js',
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        watch: false,
        min_uptime: '10s',
        max_restarts: 15,
        restart_delay: 5000,
        exp_backoff_restart_delay: 2000,
        max_memory_restart: '512M',
        env_production: {
            NODE_ENV: 'production',
            PORT: 5006,
            ...fileEnv
        }
    }]
};
