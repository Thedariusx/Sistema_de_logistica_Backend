const jwt = require('jsonwebtoken');
const pool = require('../database');


// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('=== DEBUG AUTH MIDDLEWARE ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Authorization Header:', req.headers['authorization']);
    console.log('Token extracted:', token ? token.substring(0, 20) + '...' : 'NULL');
    console.log('All headers:', JSON.stringify(req.headers, null, 2));

    if (!token) {
        console.log('❌ NO TOKEN FOUND');
        return res.status(401).json({ 
            error: 'Token de acceso requerido' 
        });
    }

    try {
        console.log('🔍 Verifying token with secret...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token decoded:', decoded);
        
        console.log('🔍 Searching user in database...');
        const userResult = await pool.query(
            'SELECT id, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        console.log('📊 User query result:', userResult.rows);

        if (userResult.rows.length === 0) {
            console.log('❌ USER NOT FOUND');
            return res.status(401).json({ 
                error: 'Usuario no válido' 
            });
        }

        req.user = userResult.rows[0];
        console.log('✅ User authenticated:', req.user);
        console.log('=== END DEBUG AUTH ===');
        next();
    } catch (error) {
        console.log('❌ TOKEN VERIFICATION FAILED:', error.message);
        console.log('JWT Secret exists:', !!process.env.JWT_SECRET);
        return res.status(403).json({ 
            error: 'Token inválido o expirado' 
        });
    }
};

// Middleware para verificar roles
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'No tienes permisos para esta acción',
                required_roles: roles,
                your_role: req.user.role
            });
        }
        next();
    };
};

module.exports = { authenticateToken, requireRole };
