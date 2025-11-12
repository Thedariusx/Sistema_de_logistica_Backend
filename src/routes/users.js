const express = require('express');
const router = express.Router();
const pool = require('../database');
const bcrypt = require('bcrypt');
const { generateVerificationToken } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/emailService');

/* ============================================================
   🧾 REGISTRAR USUARIO CON VERIFICACIÓN DE CORREO
============================================================ */
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
      return res.status(400).json({
        error: 'Faltan campos obligatorios: nombre, apellido, documento, email o contraseña'
      });
    }

    // Verificar duplicados
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR document_number = $2',
      [email, document_number]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe (email o documento duplicado)' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users 
        (first_name, second_name, last_name, second_last_name, document_number, 
         email, address, phone, role, password_hash, is_email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, first_name, last_name, email, role, is_email_verified`,
      [
        first_name, second_name, last_name, second_last_name,
        document_number, email, address, phone, role, password_hash, false
      ]
    );

    const newUser = result.rows[0];
    const verificationToken = generateVerificationToken(newUser.id, email);

    await pool.query('UPDATE users SET verification_token = $1 WHERE id = $2', [
      verificationToken, newUser.id
    ]);

    const emailSent = await sendVerificationEmail(email, verificationToken, `${first_name} ${last_name}`);

    res.status(201).json({
      message: '✅ Usuario registrado exitosamente. Verifica tu correo electrónico.',
      user: newUser,
      emailSent,
      nextStep: 'Revisa tu correo electrónico para activar tu cuenta.'
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

/* ============================================================
   📋 OBTENER TODOS LOS USUARIOS
============================================================ */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, address, phone, role, is_email_verified, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   👥 OBTENER USUARIOS POR ROL
============================================================ */
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, phone FROM users WHERE role = $1 AND is_email_verified = true',
      [role]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   ✏️ ACTUALIZAR USUARIO POR ID (CORREGIDO)
============================================================ */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

    // Verificar que el usuario exista
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar que document_number no esté vacío (porque es NOT NULL en BD)
    if (document_number !== undefined && document_number !== null && document_number.trim() === '') {
      return res.status(400).json({ error: 'El número de documento no puede estar vacío' });
    }

    // Si hay contraseña nueva, la actualizamos con hash
    if (password && password.trim() !== '') {
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      await pool.query(
        `UPDATE users SET
          first_name = COALESCE(NULLIF($1, ''), first_name),
          second_name = COALESCE(NULLIF($2, ''), second_name),
          last_name = COALESCE(NULLIF($3, ''), last_name),
          second_last_name = COALESCE(NULLIF($4, ''), second_last_name),
          document_number = COALESCE(NULLIF($5, ''), document_number),
          email = COALESCE(NULLIF($6, ''), email),
          address = COALESCE(NULLIF($7, ''), address),
          phone = COALESCE(NULLIF($8, ''), phone),
          role = COALESCE(NULLIF($9, ''), role),
          password_hash = $10,
          updated_at = NOW()
        WHERE id = $11`,
        [
          first_name, second_name, last_name, second_last_name,
          document_number, email, address, phone, role,
          password_hash, id
        ]
      );
    } else {
      // Si no hay contraseña nueva, no la tocamos
      await pool.query(
        `UPDATE users SET
          first_name = COALESCE(NULLIF($1, ''), first_name),
          second_name = COALESCE(NULLIF($2, ''), second_name),
          last_name = COALESCE(NULLIF($3, ''), last_name),
          second_last_name = COALESCE(NULLIF($4, ''), second_last_name),
          document_number = COALESCE(NULLIF($5, ''), document_number),
          email = COALESCE(NULLIF($6, ''), email),
          address = COALESCE(NULLIF($7, ''), address),
          phone = COALESCE(NULLIF($8, ''), phone),
          role = COALESCE(NULLIF($9, ''), role),
          updated_at = NOW()
        WHERE id = $10`,
        [
          first_name, second_name, last_name, second_last_name,
          document_number, email, address, phone, role, id
        ]
      );
    }

    const updated = await pool.query(
      `SELECT id, first_name, last_name, email, address, phone, role, is_email_verified, document_number
       FROM users WHERE id = $1`,
      [id]
    );

    res.status(200).json({
      message: '✅ Usuario actualizado correctamente',
      user: updated.rows[0]
    });

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

/* ============================================================
   🗑️ ELIMINAR USUARIO POR ID
============================================================ */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: '🗑️ Usuario eliminado correctamente',
      deletedId: id
    });

  } catch (error) {
    console.error('❌ Error eliminando usuario:', error);
    // Manejo específico para claves foráneas
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar el usuario porque tiene registros asociados (paquetes, etc.)'
      });
    }
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

module.exports = router;