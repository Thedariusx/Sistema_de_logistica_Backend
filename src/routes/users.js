const express = require('express');
const router = express.Router();
const pool = require('../database');



// HU1: Registro de clientes
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
            phone
        } = req.body;

        // Validación básica
        if (!first_name || !last_name || !document_number || !email || !address || !phone) {
            return res.status(400).json({
                error: 'Faltan campos obligatorios: nombre, apellido, documento, email, dirección, teléfono'
            });
        }

        // Insertar en la base de datos
        const result = await pool.query(
            `INSERT INTO users 
             (first_name, second_name, last_name, second_last_name, document_number, email, address, phone, role) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING id, first_name, last_name, email, document_number, role`,
            [first_name, second_name, last_name, second_last_name, document_number, email, address, phone, 'client']
        );

        res.status(201).json({
            message: 'Cliente registrado exitosamente',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error registrando usuario:', error);
        
        if (error.code === '23505') { // Violación de unique constraint
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