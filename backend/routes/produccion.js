const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { validarPlan, puedeEditarse, normalizarFecha, validarActualizacion, normalizarError } = require('../services/validacion');

/**
 * POST /api/produccion/plan
 * Crear o actualizar un plan de producción
 * Body: { id (opcional), alupak_pedido_id, cantidad_planificada, maquina_asignada, fecha_inicio, fecha_fin, estado, observaciones, oee_aplicado }
 */
router.post('/plan', async (req, res) => {
  try {
    const { id, alupak_pedido_id, cantidad_planificada, maquina_asignada, fecha_inicio, fecha_fin, estado, observaciones, oee_aplicado } = req.body;

    // Validar datos básicos
    if (!alupak_pedido_id || !cantidad_planificada || !maquina_asignada || !fecha_inicio) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Faltan campos requeridos: alupak_pedido_id, cantidad_planificada, maquina_asignada, fecha_inicio'
      });
    }

    // Normalizar fechas
    const fechaInicio = normalizarFecha(fecha_inicio);
    const fechaFin = fecha_fin ? normalizarFecha(fecha_fin) : null;

    if (!fechaInicio) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Formato de fecha_inicio inválido',
        campo_afectado: 'fecha_inicio'
      });
    }

    // Verificar si el pedido existe
    const pedidoResult = await pool.query('SELECT id FROM alupak_pedidos WHERE id = $1', [alupak_pedido_id]);
    if (pedidoResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Pedido no encontrado',
        campo_afectado: 'alupak_pedido_id'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let plan;
      let mensaje;

      if (id) {
        // Actualizar plan existente
        const currentResult = await client.query('SELECT * FROM planes_produccion WHERE id = $1', [id]);
        if (currentResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error_type: 'NOT_FOUND',
            mensaje: 'Plan no encontrado'
          });
        }

        const planActual = currentResult.rows[0];
        if (!puedeEditarse(planActual)) {
          return res.status(400).json({
            success: false,
            error_type: 'VALIDATION_ERROR',
            mensaje: 'No se puede editar un plan completado'
          });
        }

        const updateResult = await client.query(`
          UPDATE planes_produccion
          SET cantidad_planificada = $1, maquina_asignada = $2, fecha_inicio = $3, fecha_fin = $4,
              estado = $5, observaciones = $6, oee_aplicado = $7, updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
          RETURNING *
        `, [cantidad_planificada, maquina_asignada, fechaInicio, fechaFin, estado, observaciones, oee_aplicado, id]);

        plan = updateResult.rows[0];
        mensaje = 'Plan actualizado exitosamente';
      } else {
        // Crear nuevo plan
        const insertResult = await client.query(`
          INSERT INTO planes_produccion (
            alupak_pedido_id, cantidad_planificada, maquina_asignada,
            fecha_inicio, fecha_fin, estado, oee_aplicado, observaciones,
            tiempo_estimado_min, usuario_creador, generacion, prioridad,
            es_manual, estado_finalizado, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `, [
          alupak_pedido_id,
          cantidad_planificada,
          maquina_asignada,
          fechaInicio,
          fechaFin,
          estado || 'Requiere producción',
          oee_aplicado || 0.85,
          observaciones || '',
          0, // tiempo_estimado_min - se calcularía según lógica de negocio
          'sistema',
          'G1', // generacion - se determinaría según el producto
          '3', // prioridad
          true, // es_manual
          false // estado_finalizado
        ]);

        plan = insertResult.rows[0];
        mensaje = 'Plan creado exitosamente';
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        mensaje: mensaje,
        plan: plan
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error en /api/produccion/plan:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/produccion/plan/:id
 * Obtener un plan de producción por ID
 */
router.get('/plan/:id', async (req, res) => {
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
        error_type: 'NOT_FOUND',
        mensaje: 'Plan no encontrado'
      });
    }

    res.json({
      success: true,
      plan: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo plan:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

module.exports = router;