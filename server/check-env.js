#!/usr/bin/env node
const path = require('path');
const { loadEnvFile } = require('./load-env');

const envPath = path.join(__dirname, '.env');
const result = loadEnvFile(envPath);

console.log('Env path :', result.path);
console.log('Exists   :', result.exists);
if (result.error) console.log('Error    :', result.error);

const keys = Object.keys(result.env);
console.log('Keys     :', keys.length ? keys.join(', ') : '(none)');
console.log('DB_USER  :', result.env.DB_USER || '(missing)');
console.log('DB_NAME  :', result.env.DB_NAME || '(missing)');
console.log('DB_HOST  :', result.env.DB_HOST || '(missing)');

if (!result.exists) {
    console.log('\nCreate file: cp .env.production.example .env && nano .env');
    process.exit(1);
}

if (!result.env.DB_USER) {
    console.log('\n.env exists but DB_USER missing — edit server/.env');
    process.exit(1);
}

console.log('\nOK — env file looks valid.');
