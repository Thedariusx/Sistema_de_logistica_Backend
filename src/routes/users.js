const express = require('express');
const router = express.Router();
const pool = require('../database');

// =========================
// HU: Gestión de Usuarios
// =========================

// 🔹 Crear usuario (Cliente, Mensajero u Operario)
router.post('/create', async (req, res) => {
  try {
    const { first_name, last_name, email, role } = req.body;

    // Validación de datos obligatorios
    if (!first_name || !last_name || !email || !role) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: nombre, correo y rol'
      });
    }

    // Roles permitidos
    const validRoles = ['client', 'messenger', 'operator', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }

    // Validar duplicado de correo
    const checkEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Insertar usuario
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, role]
    );

    res.status(201).json({
      message: 'Usuario creado con éxito',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔹 Listar todos los usuarios
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, role FROM users ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Obtener usuario por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, role FROM users WHERE id = $1',
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

// 🔹 Actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, role } = req.body;

    if (!first_name || !last_name || !email || !role) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const validRoles = ['client', 'messenger', 'operator', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, email = $3, role = $4 
       WHERE id = $5
       RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado con éxito', user: result.rows[0] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado con éxito' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
