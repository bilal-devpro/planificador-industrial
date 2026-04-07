/**
 * Routes para gestión de planes de producción
 * Endpoints simples y limpios
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

/**
 * POST /api/planes/guardar
 * Guarda múltiples planes de producción
 */
router.post('/guardar', async (req, res) => {
  try {
    const { planes } = req.body;

    if (!planes || !Array.isArray(planes) || planes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de planes no vacío'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const idsGuardados = [];

      for (const plan of planes) {
        const result = await client.query(`
          INSERT INTO planes_produccion (
            alupak_pedido_id, cantidad_planificada, maquina_asignada,
            fecha_inicio, fecha_fin, estado, oee_aplicado, observaciones,
            tiempo_estimado_min, generacion, prioridad, es_manual
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          plan.alupak_pedido_id,
          plan.cantidad_planificada || 0,
          plan.maquina_asignada || 'M1',
          plan.fecha_inicio,
          plan.fecha_fin || null,
          plan.estado || 'pendiente',
          plan.oee_aplicado || 0.85,
          plan.observaciones || '',
          plan.tiempo_estimado_min || 0,
          plan.generacion || 'G1',
          plan.prioridad || '3',
          plan.es_manual !== undefined ? plan.es_manual : true
        ]);

        idsGuardados.push(result.rows[0].id);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        ids_guardados: idsGuardados,
        mensaje: `${idsGuardados.length} planes guardados exitosamente`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error guardando planes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/planes
 * Obtiene todos los planes activos
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             a.customer_name, a.no_sales_line, a.qty_pending
      FROM planes_produccion p
      LEFT JOIN alupak_pedidos a ON p.alupak_pedido_id = a.id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      planes: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo planes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/planes/:id
 * Obtiene un plan específico
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT p.*, 
             a.customer_name, a.no_sales_line, a.qty_pending
      FROM planes_produccion p
      LEFT JOIN alupak_pedidos a ON p.alupak_pedido_id = a.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado'
      });
    }

    res.json({
      success: true,
      plan: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/planes/:id
 * Actualiza un plan existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verificar que el plan existe
    const checkResult = await pool.query(
      'SELECT * FROM planes_produccion WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado'
      });
    }

    // Construir actualización dinámica
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      // Solo permitir campos válidos
      const validFields = [
        'cantidad_planificada', 'maquina_asignada', 'fecha_inicio',
        'fecha_fin', 'estado', 'oee_aplicado', 'observaciones',
        'tiempo_estimado_min', 'generacion', 'prioridad'
      ];

      if (validFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.json({
        success: true,
        mensaje: 'No hay cambios para aplicar',
        plan: checkResult.rows[0]
      });
    }

    // Agregar updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);

    const updateQuery = `
      UPDATE planes_produccion
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      mensaje: 'Plan actualizado exitosamente',
      plan: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error actualizando plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/planes/:id
 * Elimina un plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM planes_produccion WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado'
      });
    }

    res.json({
      success: true,
      mensaje: 'Plan eliminado exitosamente',
      id_eliminado: id
    });

  } catch (error) {
    console.error('❌ Error eliminando plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;