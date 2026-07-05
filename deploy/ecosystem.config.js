const path = require('path');
const { loadEnvFile } = require('../server/load-env');

const serverDir = path.join(__dirname, '..', 'server');
const fileEnv = loadEnvFile(path.join(serverDir, '.env'));

module.exports = {
    apps: [{
        name: 'livehospital',
        cwd: serverDir,
        script: 'server.js',
        exec_mode: 'fork',
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
