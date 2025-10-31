const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================
// 🔧 MIDDLEWARES GLOBALES
// ============================
app.use(cors());
app.use(express.json());

// ================================================
// 🔐 TOKEN DE AUTENTICACIÓN TEMPORAL (2FA)
// ================================================
const tokens = {}; // Guardará tokens temporales en memoria

// Generar token temporal
app.post('/api/send-token', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Falta el correo electrónico' });
  }

  const token = crypto.randomInt(100000, 999999).toString(); // Ejemplo: "482913"

  // Expira en 5 minutos
  tokens[email] = {
    token,
    expires: Date.now() + 2 * 60 * 1000
  };

  console.log(`🔐 Token generado para ${email}: ${token}`);

  res.json({
    message: '✅ Token generado correctamente. Revisa la consola del servidor para obtenerlo.'
  });
});

// Validar token
app.post('/api/verify-token', (req, res) => {
  const { email, token } = req.body;

  const record = tokens[email];
  if (!record) return res.status(400).json({ error: 'No se encontró token para este correo' });

  if (record.expires < Date.now()) {
    delete tokens[email];
    return res.status(400).json({ error: 'Token caducado' });
  }

  if (record.token !== token) return res.status(400).json({ error: 'Código inválido' });

  delete tokens[email];
  res.json({ message: 'Acceso concedido ✅' });
});

// ============================
// 📦 IMPORTAR RUTAS EXISTENTES
// ============================
const userRoutes = require('./routes/users');
const packageRoutes = require('./routes/packages');
const authRoutes = require('./routes/auth');

// ============================
// 🧭 USAR RUTAS
// ============================
app.use('/api/users', userRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/auth', authRoutes);

// ============================
// 🧪 RUTA DE PRUEBA
// ============================
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

// ============================
// ❤️ RUTA DE SALUD DEL SISTEMA
// ============================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: 'PostgreSQL con Docker',
    project: 'Logística Segura Urabá'
  });
});

// ============================
// ⚠️ MANEJO DE RUTAS NO ENCONTRADAS
// ============================
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
      'POST /api/packages/register',
      'POST /api/send-token',
      'POST /api/verify-token'
    ]
  });
});

// ============================
// 🚀 INICIAR SERVIDOR
// ============================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`👤 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`📝 Register: http://localhost:${PORT}/api/auth/register`);
  console.log(`👥 Users: http://localhost:${PORT}/api/users`);
  console.log(`📦 Packages: http://localhost:${PORT}/api/packages`);
  console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Token temporal: http://localhost:${PORT}/api/send-token`);
});
