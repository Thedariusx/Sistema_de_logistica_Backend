const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'logistica_uraba',
    user: 'postgres', 
    password: '123456',
});

async function fixAllPasswords() {
    try {
        await client.connect();
        console.log('✅ Conectado a PostgreSQL');

        // Obtener TODOS los usuarios
        const users = await client.query('SELECT id, document_number, email FROM users');
        console.log(`📊 Encontrados ${users.rows.length} usuarios`);
        
        for (const user of users.rows) {
            // Usar el documento como contraseña
            const passwordHash = await bcrypt.hash(user.document_number, 12);
            
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [passwordHash, user.id]
            );
            
            console.log(`✅ ${user.email} → Contraseña: ${user.document_number}`);
        }

        console.log('🎉 TODAS las contraseñas configuradas!');
        console.log('💡 Los usuarios usan su NÚMERO DE DOCUMENTO como contraseña');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixAllPasswords();