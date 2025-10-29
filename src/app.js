const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Importar rutas
const userRoutes = require('./routes/users');
const packageRoutes = require('./routes/packages');
const authRoutes = require('./routes/auth');

// Usar rutas
app.use('/api/users', userRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/auth', authRoutes);

// Ruta de prueba mejorada
app.get('/', (req, res) => {
    res.json({ 
        message: '¡Backend de Logística Urabá funcionando!',
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            packages: '/api/packages',
            login: '/api/auth/login',
            register: '/api/auth/register',
            health: '/api/health'
        }
    });
});

// Ruta de salud del sistema
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        database: 'PostgreSQL con Docker',
        project: 'Logística Segura Urabá'
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        available_endpoints: [
            'GET /',
            'GET /api/health', 
            'GET /api/users',
            'GET /api/packages',
            'GET /api/auth',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'POST /api/users/register',
            'POST /api/packages/register'
        ]
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`👤 Login: http://localhost:${PORT}/api/auth/login`);
    console.log(`📝 Register: http://localhost:${PORT}/api/auth/register`);
    console.log(`👥 Users: http://localhost:${PORT}/api/users`);
    console.log(`📦 Packages: http://localhost:${PORT}/api/packages`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
});
    console.log(`👤 Ruta de usuarios: http://localhost:${PORT}/api/users`);
    console.log(`📦 Ruta de paquetes: http://localhost:${PORT}/api/packages`);
    console.log(`📝 Registrar usuario: http://localhost:${PORT}/api/users/register`);
    console.log(`🚚 Registrar envío: http://localhost:${PORT}/api/packages/register`);
    console.log(`❤️  Salud del sistema: http://localhost:${PORT}/api/health`);
;