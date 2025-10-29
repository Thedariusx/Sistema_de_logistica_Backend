const { Client } = require('pg');

const config = {
    host: 'localhost',
    port: 5432,
    database: 'logistica_uraba',
    user: 'postgres',
    password: 'admin',
};

async function testConnection() {
    const client = new Client(config);
    
    try {
        await client.connect();
        console.log('✅ Conexión a PostgreSQL exitosa');
        
        // Verificar usuarios
        const users = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`📊 Usuarios en la base de datos: ${users.rows[0].count}`);
        
        // Verificar passwords
        const passwords = await client.query('SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL');
        console.log(`🔐 Usuarios con password: ${passwords.rows[0].count}`);
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    } finally {
        await client.end();
    }
}

testConnection();