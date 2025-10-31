const express = require('express');
const router = express.Router();
const pool = require('../database');
const bcrypt = require('bcryptjs');


// ---------- Registro de usuario ----------
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
      role,
      password
    } = req.body;

    if (!first_name || !last_name || !document_number || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos. first_name, last_name, document_number, email y password son obligatorios.' });
    }

    const existingQuery = 'SELECT id, email, document_number FROM users WHERE email = $1 OR document_number = $2 LIMIT 1';
    const existingRes = await pool.query(existingQuery, [email, document_number]);

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (existing.email === email) {
        return res.status(409).json({ error: 'El correo ya está registrado.' });
      }
      if (existing.document_number === document_number) {
        return res.status(409).json({ error: 'El número de documento ya está registrado.' });
      }
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO users
      (first_name, second_name, last_name, second_last_name, document_number, email, address, phone, role, is_email_verified, created_at, updated_at, password_hash)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW(),$11)
      RETURNING id, first_name, second_name, last_name, second_last_name, document_number, email, address, phone, role, is_email_verified, created_at, updated_at;
    `;

    const insertValues = [
      first_name || null,
      second_name || null,
      last_name || null,
      second_last_name || null,
      document_number,
      email,
      address || null,
      phone || null,
      role || 'user',
      false,
      password_hash
    ];

    const insertRes = await pool.query(insertQuery, insertValues);
    const newUser = insertRes.rows[0];

    return res.status(201).json({ message: 'Usuario registrado correctamente', user: newUser });
  } catch (error) {
    console.error('Error en /api/users/register:', error);
    return res.status(500).json({ error: 'Error al registrar usuario', details: error.message });
  }
});

// Obtener todos los usuarios (para pruebas)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, role, document_number FROM users'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener usuario por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, role, document_number FROM users WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD completo para usuarios (solo admin/operario)


// En routes/users.js - AGREGAR ESTA RUTA:

// Obtener usuarios por rol (para mensajeros)
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    
    let query = 'SELECT id, first_name, last_name, email, role, document_number, phone FROM users';
    let params = [];
    
    if (role) {
      query += ' WHERE role = $1';
      params.push(role);
    }
    
    query += ' ORDER BY first_name, last_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;