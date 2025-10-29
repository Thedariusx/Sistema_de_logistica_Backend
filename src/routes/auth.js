const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const router = express.Router();

// HU3: Inicio de sesión
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('=== DEBUG LOGIN INICIO ===');
        console.log('Email recibido:', email);
        console.log('Password recibida:', password);

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email y contraseña son obligatorios'
            });
        }

        // Buscar usuario por email
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        console.log('Usuarios encontrados:', userResult.rows.length);
        
        if (userResult.rows.length === 0) {
            console.log('❌ No se encontró usuario con email:', email);
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        const user = userResult.rows[0];
        console.log('Usuario encontrado:', user.email);
        console.log('Password_hash en BD:', user.password_hash);
        console.log('Document_number:', user.document_number);

        // Verificar contraseña
        let passwordValid = false;
        
        if (user.password_hash) {
            console.log('🔍 Comparando con bcrypt...');
            console.log('Password input:', password);
            console.log('Hash en BD:', user.password_hash);
            
            passwordValid = await bcrypt.compare(password, user.password_hash);
            console.log('Resultado bcrypt.compare:', passwordValid);
            
            // Debug adicional - verificar el hash manualmente
            const testHash = await bcrypt.hash(password, 10);
            console.log('Hash generado con input:', testHash);
            console.log('¿Coinciden los hashes?', user.password_hash === testHash);
            
        } else if (user.document_number) {
            console.log('📄 Usando document_number como fallback');
            passwordValid = password === user.document_number;
            console.log('Document comparison:', password, '===', user.document_number, '=', passwordValid);
        }

        console.log('¿Password válida?', passwordValid);

        if (!passwordValid) {
            console.log('❌ Falló la validación de contraseña');
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        console.log('✅ Login exitoso para:', user.email);

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('=== DEBUG LOGIN FIN ===');

        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('💥 Error en login:', error);
        res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
});

// Registrar usuario con contraseña (HU1 mejorada)
router.post('/register', async (req, res) => {
    try {
        const {
            first_name,
            second_name,
            last_name,
            second_last_name,
            document_number,
            email,
            address,
            phone,
            password
        } = req.body;

        // Validación básica
        if (!first_name || !last_name || !document_number || !email || !address || !phone) {
            return res.status(400).json({
                error: 'Faltan campos obligatorios'
            });
        }

        // Hash de contraseña (usar documento como default)
        const passwordHash = password 
            ? await bcrypt.hash(password, 12)
            : await bcrypt.hash(document_number, 12); // Documento como contraseña temporal

        // Insertar en la base de datos
        const result = await pool.query(
            `INSERT INTO users 
             (first_name, second_name, last_name, second_last_name, document_number, email, address, phone, role, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id, first_name, last_name, email, document_number, role`,
            [first_name, second_name, last_name, second_last_name, document_number, email, address, phone, 'client', passwordHash]
        );

        res.status(201).json({
            message: 'Cliente registrado exitosamente',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error registrando usuario:', error);
        
        if (error.code === '23505') {
            res.status(400).json({
                error: 'El número de documento o correo ya está registrado'
            });
        } else {
            res.status(500).json({
                error: 'Error interno del servidor: ' + error.message
            });
        }
    }
});

// Verificar token (para frontend)
router.get('/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Token no proporcionado' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'Usuario no encontrado' 
            });
        }

        res.json({
            valid: true,
            user: userResult.rows[0]
        });
    } catch (error) {
        res.status(403).json({ 
            error: 'Token inválido' 
        });
    }
});

// Cerrar sesión (frontend elimina el token)
router.post('/logout', (req, res) => {
    res.json({
        message: 'Sesión cerrada exitosamente'
    });
});

module.exports = router;