const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ✅ HU4: Registrar nuevo envío
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const {
      sender_name,
      recipient_name,
      delivery_address,
      weight,
      client_id,
      package_description
    } = req.body;

    // Validaciones
    if (!sender_name || !recipient_name || !delivery_address) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: remitente, destinatario, dirección'
      });
    }

    // Generar código de seguimiento único
    const trackingCode = `URABA-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Calcular costo basado en peso (ejemplo simple)
    const baseCost = 5000; // Costo base
    const weightCost = weight ? parseFloat(weight) * 1000 : 0;
    const totalCost = baseCost + weightCost;

    // Insertar envío en la base de datos
    const result = await pool.query(
      `INSERT INTO packages 
       (tracking_code, sender_name, recipient_name, delivery_address, 
        weight, cost, client_id, package_description, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        trackingCode,
        sender_name,
        recipient_name,
        delivery_address,
        weight || 0,
        totalCost,
        client_id || req.user.userId,
        package_description || '',
        'registered' // Estado inicial: registrado
      ]
    );

    const newPackage = result.rows[0];

    res.status(201).json({
      success: true,
      message: '✅ Envío registrado exitosamente',
      package: newPackage,
      tracking_code: trackingCode
    });

  } catch (error) {
    console.error('Error registrando envío:', error);
    res.status(500).json({
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// ✅ Obtener todos los envíos (para operarios/admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        u.first_name as client_name,
        u2.first_name as messenger_name,
        u2.last_name as messenger_last_name
       FROM packages p
       LEFT JOIN users u ON p.client_id = u.id
       LEFT JOIN users u2 ON p.assigned_messenger_id = u2.id
       ORDER BY 
         CASE 
           WHEN p.status = 'registered' THEN 1
           WHEN p.status = 'approved' THEN 2
           WHEN p.status = 'rejected' THEN 3
           WHEN p.status = 'in_transit' THEN 4
           WHEN p.status = 'out_for_delivery' THEN 5
           WHEN p.status = 'delivered' THEN 6
           ELSE 7
         END,
         p.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo envíos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HU5: Consultar envío por código de seguimiento
router.get('/tracking/:trackingCode', async (req, res) => {
  try {
    const { trackingCode } = req.params;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.first_name as client_name,
        u2.first_name as messenger_name,
        u2.last_name as messenger_last_name
       FROM packages p
       LEFT JOIN users u ON p.client_id = u.id
       LEFT JOIN users u2 ON p.assigned_messenger_id = u2.id
       WHERE p.tracking_code = $1`,
      [trackingCode.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error buscando envío:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener envíos del cliente actual
router.get('/client/my-packages', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        p.*,
        u2.first_name as messenger_name,
        u2.last_name as messenger_last_name
       FROM packages p
       LEFT JOIN users u2 ON p.assigned_messenger_id = u2.id
       WHERE p.client_id = $1 
       ORDER BY p.created_at DESC`,
      [clientId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo envíos del cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener entregas del mensajero actual
router.get('/messenger/my-deliveries', authenticateToken, async (req, res) => {
  try {
    const messengerId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.first_name as client_name,
        u.last_name as client_last_name
       FROM packages p
       LEFT JOIN users u ON p.client_id = u.id
       WHERE p.assigned_messenger_id = $1 
       ORDER BY p.created_at DESC`,
      [messengerId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo entregas del mensajero:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Aprobar envío
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE packages 
       SET status = 'approved', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: '✅ Envío aprobado exitosamente',
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error aprobando envío:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Rechazar envío
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE packages 
       SET status = 'rejected', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: '❌ Envío rechazado',
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error rechazando envío:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HU7: Asignar mensajero automáticamente
router.put('/:id/assign-automatic', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener mensajeros disponibles
    const messengersResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name,
              COUNT(p.id) as assigned_count
       FROM users u
       LEFT JOIN packages p ON u.id = p.assigned_messenger_id AND p.status IN ('in_transit', 'out_for_delivery')
       WHERE u.role = 'messenger' AND u.is_email_verified = true
       GROUP BY u.id, u.first_name, u.last_name
       ORDER BY assigned_count ASC
       LIMIT 1`
    );

    if (messengersResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No hay mensajeros disponibles' 
      });
    }

    const messenger = messengersResult.rows[0];

    // Asignar mensajero automáticamente
    const result = await pool.query(
      `UPDATE packages 
       SET assigned_messenger_id = $1, 
           status = 'in_transit',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [messenger.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: `✅ Mensajero ${messenger.first_name} ${messenger.last_name} asignado automáticamente`,
      package: result.rows[0],
      messenger: messenger
    });

  } catch (error) {
    console.error('Error asignando mensajero automáticamente:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HU7: Asignar mensajero manualmente
router.put('/:id/assign-messenger', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { messenger_id } = req.body;

    if (!messenger_id) {
      return res.status(400).json({ 
        error: 'ID del mensajero es requerido' 
      });
    }

    // Verificar que el mensajero existe y tiene rol correcto
    const messengerCheck = await pool.query(
      'SELECT id, first_name, last_name, role FROM users WHERE id = $1',
      [messenger_id]
    );

    if (messengerCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Mensajero no encontrado' 
      });
    }

    if (messengerCheck.rows[0].role !== 'messenger') {
      return res.status(400).json({ 
        error: 'El usuario seleccionado no es un mensajero' 
      });
    }

    const messenger = messengerCheck.rows[0];

    // Actualizar asignación
    const result = await pool.query(
      `UPDATE packages 
       SET assigned_messenger_id = $1, 
           status = 'in_transit',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [messenger_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: `✅ Mensajero ${messenger.first_name} ${messenger.last_name} asignado exitosamente`,
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error asignando mensajero:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Actualizar estado del envío
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['registered', 'approved', 'rejected', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido' 
      });
    }

    const result = await pool.query(
      `UPDATE packages 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: '✅ Estado actualizado exitosamente',
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HU6: Editar información del envío
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sender_name,
      recipient_name,
      delivery_address,
      package_description
    } = req.body;

    // Verificar que el envío existe
    const packageCheck = await pool.query(
      'SELECT * FROM packages WHERE id = $1',
      [id]
    );

    if (packageCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    // Actualizar envío
    const result = await pool.query(
      `UPDATE packages 
       SET sender_name = COALESCE($1, sender_name),
           recipient_name = COALESCE($2, recipient_name),
           delivery_address = COALESCE($3, delivery_address),
           package_description = COALESCE($4, package_description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 
       RETURNING *`,
      [sender_name, recipient_name, delivery_address, package_description, id]
    );

    res.json({
      success: true,
      message: '✅ Envío actualizado exitosamente',
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando envío:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Eliminar envío
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM packages WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    res.json({
      success: true,
      message: '✅ Envío eliminado exitosamente',
      package: result.rows[0]
    });

  } catch (error) {
    console.error('Error eliminando envío:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Generar código QR para envío
router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT tracking_code FROM packages WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    const trackingCode = result.rows[0].tracking_code;
    
    // Generar URL para QR (puedes integrar un servicio de QR después)
    const qrData = {
      tracking_code: trackingCode,
      package_id: id,
      type: 'package_tracking'
    };

    res.json({
      success: true,
      qr_data: qrData,
      tracking_code: trackingCode,
      message: '📱 Código QR generado (integrar servicio de QR)'
    });

  } catch (error) {
    console.error('Error generando QR:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;