const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'logistica_uraba',
    user: 'postgres', 
    password: 'admin',
});

async function fixMissingPasswords() {
    try {
        await client.connect();
        console.log('✅ Conectado a PostgreSQL');

        // Obtener SOLO usuarios sin password_hash
        const users = await client.query('SELECT id, document_number, email FROM users WHERE password_hash IS NULL');
        console.log(`📊 Usuarios sin password: ${users.rows.length}`);
        
        if (users.rows.length === 0) {
            console.log('🎉 Todos los usuarios ya tienen password_hash!');
            return;
        }
        
        for (const user of users.rows) {
            // Usar el documento como contraseña
            const passwordHash = await bcrypt.hash(user.document_number, 12);
            
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [passwordHash, user.id]
            );
            
            console.log(`✅ ${user.email} → Password: ${user.document_number}`);
        }

        console.log('🎉 Passwords configuradas para usuarios faltantes!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixMissingPasswords();