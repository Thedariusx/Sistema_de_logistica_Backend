const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'logistica_uraba',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
});

// Probar la conexión
pool.on('connect', () => {
    console.log('✅ Conectado a PostgreSQL correctamente');
});

pool.on('error', (err) => {
    console.error('❌ Error en la conexión de PostgreSQL:', err);
});

module.exports = pool;