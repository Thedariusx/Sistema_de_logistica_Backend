const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ✅ HU7: Generar reportes básicos
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { type, start_date, end_date } = req.query;

    let reportData = {};
    let reportTitle = '';

    switch (type) {
      case 'envios-por-estado':
        reportTitle = 'Envíos por Estado';
        const statusResult = await pool.query(
          `SELECT 
            status,
            COUNT(*) as count
           FROM packages 
           WHERE created_at BETWEEN COALESCE($1, '1900-01-01') AND COALESCE($2, CURRENT_DATE + INTERVAL '1 day')
           GROUP BY status 
           ORDER BY count DESC`,
          [start_date, end_date]
        );
        reportData = statusResult.rows.reduce((acc, row) => {
          const estadoTraducido = traducirEstado(row.status);
          acc[estadoTraducido] = parseInt(row.count);
          return acc;
        }, {});
        break;

      case 'envios-por-mensajero':
        reportTitle = 'Envíos por Mensajero';
        const messengerResult = await pool.query(
          `SELECT 
            u.first_name || ' ' || u.last_name as messenger_name,
            COUNT(*) as count
           FROM packages p
           JOIN users u ON p.assigned_messenger_id = u.id
           WHERE p.created_at BETWEEN COALESCE($1, '1900-01-01') AND COALESCE($2, CURRENT_DATE + INTERVAL '1 day')
           GROUP BY u.first_name, u.last_name 
           ORDER BY count DESC`,
          [start_date, end_date]
        );
        reportData = messengerResult.rows.reduce((acc, row) => {
          acc[row.messenger_name || 'No asignado'] = parseInt(row.count);
          return acc;
        }, {});
        break;

      case 'envios-por-ciudad':
        reportTitle = 'Envíos por Ciudad';
        const cityResult = await pool.query(
          `SELECT 
            SUBSTRING(tracking_code FROM 1 FOR 5) as ciudad,
            COUNT(*) as count
           FROM packages 
           WHERE created_at BETWEEN COALESCE($1, '1900-01-01') AND COALESCE($2, CURRENT_DATE + INTERVAL '1 day')
           GROUP BY SUBSTRING(tracking_code FROM 1 FOR 5) 
           ORDER BY count DESC`,
          [start_date, end_date]
        );
        reportData = cityResult.rows.reduce((acc, row) => {
          acc[row.ciudad] = parseInt(row.count);
          return acc;
        }, {});
        break;

      default:
        return res.status(400).json({ 
          error: 'Tipo de reporte no válido' 
        });
    }

    // Estadísticas generales
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as entregados,
        COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as en_transito,
        COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END) as en_entrega
       FROM packages 
       WHERE created_at BETWEEN COALESCE($1, '1900-01-01') AND COALESCE($2, CURRENT_DATE + INTERVAL '1 day')`,
      [start_date, end_date]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      report: {
        title: reportTitle,
        type: type,
        data: reportData,
        statistics: {
          total: parseInt(stats.total),
          entregados: parseInt(stats.entregados),
          en_transito: parseInt(stats.en_transito),
          en_entrega: parseInt(stats.en_entrega)
        },
        date_range: {
          start_date: start_date || 'Todo el tiempo',
          end_date: end_date || 'Hasta hoy'
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener métricas del dashboard
router.get('/dashboard-metrics', authenticateToken, async (req, res) => {
  try {
    // Métricas para el dashboard
    const metricsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM packages) as total_packages,
        (SELECT COUNT(*) FROM packages WHERE status = 'registered') as pending_packages,
        (SELECT COUNT(*) FROM packages WHERE status = 'in_transit') as in_transit_packages,
        (SELECT COUNT(*) FROM packages WHERE status = 'out_for_delivery') as out_for_delivery_packages,
        (SELECT COUNT(*) FROM packages WHERE status = 'delivered') as delivered_packages,
        (SELECT COUNT(*) FROM users WHERE role = 'messenger') as total_messengers,
        (SELECT COUNT(*) FROM users WHERE role = 'client') as total_clients,
        (SELECT COUNT(*) FROM users WHERE role = 'operator') as total_operators
    `);

    // Envíos recientes
    const recentPackages = await pool.query(`
      SELECT tracking_code, status, created_at 
      FROM packages 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    // Actividad de mensajeros
    const messengerActivity = await pool.query(`
      SELECT 
        u.first_name,
        u.last_name,
        COUNT(p.id) as assigned_packages,
        COUNT(CASE WHEN p.status = 'delivered' THEN 1 END) as delivered_packages
      FROM users u
      LEFT JOIN packages p ON u.id = p.assigned_messenger_id
      WHERE u.role = 'messenger'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY assigned_packages DESC
      LIMIT 5
    `);

    const metrics = metricsResult.rows[0];

    res.json({
      success: true,
      metrics: {
        packages: {
          total: parseInt(metrics.total_packages),
          pending: parseInt(metrics.pending_packages),
          in_transit: parseInt(metrics.in_transit_packages),
          out_for_delivery: parseInt(metrics.out_for_delivery_packages),
          delivered: parseInt(metrics.delivered_packages)
        },
        users: {
          messengers: parseInt(metrics.total_messengers),
          clients: parseInt(metrics.total_clients),
          operators: parseInt(metrics.total_operators)
        }
      },
      recent_activity: {
        recent_packages: recentPackages.rows,
        top_messengers: messengerActivity.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HU9 y HU10: Escanear QR para recolección y entrega
router.post('/scan-qr', authenticateToken, async (req, res) => {
  try {
    const { qr_data, action } = req.body; // action: 'pickup' o 'delivery'
    const messengerId = req.user.userId;

    if (!qr_data || !action) {
      return res.status(400).json({ 
        error: 'Datos QR y acción son requeridos' 
      });
    }

    // Buscar envío por código de tracking
    const packageResult = await pool.query(
      `SELECT * FROM packages 
       WHERE tracking_code = $1 OR id = $2`,
      [qr_data.tracking_code, qr_data.package_id]
    );

    if (packageResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Envío no encontrado' 
      });
    }

    const package = packageResult.rows[0];

    let newStatus = '';
    let message = '';

    if (action === 'pickup') {
      // Verificar que el mensajero esté asignado
      if (package.assigned_messenger_id !== messengerId) {
        return res.status(403).json({ 
          error: 'No estás asignado a este envío' 
        });
      }
      newStatus = 'in_transit';
      message = '✅ Paquete recolectado exitosamente';
    
    } else if (action === 'delivery') {
      // Verificar que el mensajero esté asignado
      if (package.assigned_messenger_id !== messengerId) {
        return res.status(403).json({ 
          error: 'No estás asignado a este envío' 
        });
      }
      newStatus = 'delivered';
      message = '✅ Paquete entregado exitosamente';
    
    } else {
      return res.status(400).json({ 
        error: 'Acción no válida' 
      });
    }

    // Actualizar estado y registrar ubicación
    const updateResult = await pool.query(
      `UPDATE packages 
       SET status = $1,
           current_location = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 
       RETURNING *`,
      [newStatus, 'Ubicación registrada por GPS', package.id]
    );

    // Registrar en el historial
    await pool.query(
      `INSERT INTO package_history 
       (package_id, status, location, messenger_id, notes) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        package.id,
        newStatus,
        'Ubicación registrada por GPS',
        messengerId,
        `${action === 'pickup' ? 'Recolección' : 'Entrega'} mediante QR`
      ]
    );

    res.json({
      success: true,
      message: message,
      package: updateResult.rows[0],
      action: action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error escaneando QR:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Obtener historial de un envío
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const historyResult = await pool.query(
      `SELECT 
        ph.*,
        u.first_name as messenger_name,
        u.last_name as messenger_last_name
       FROM package_history ph
       LEFT JOIN users u ON ph.messenger_id = u.id
       WHERE ph.package_id = $1 
       ORDER BY ph.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      history: historyResult.rows
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para traducir estados
function traducirEstado(estado) {
  const estados = {
    'registered': 'Registrado',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'in_transit': 'En Tránsito',
    'out_for_delivery': 'En Entrega',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado'
  };
  return estados[estado] || estado;
}

module.exports = router;