/**
 * routes/plan.js - REBUILT VERSION
 * 
 * Production planning endpoints
 * - POST /api/plan/calcular - Calculate preview of production plans
 * - POST /api/plan/guardar - Save confirmed plans to database
 * - GET /api/plan - Get all active production plans
 * - GET /api/plan/historial - Get paginated completed orders
 * - GET /api/plan/:id - Get single plan details
 * - PUT /api/plan/:id/editar - Edit existing plan
 * - PUT /api/plan/:id/marcar-completado - Mark plan as completed
 * - DELETE /api/plan/:id - Delete plan
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { 
  validarPlan, 
  puedeEditarse, 
  normalizarFecha,
  validarActualizacion,
  normalizarError 
} = require('../services/validacion');
const { 
  calcularPlanesProduccion,
  obtenerMaquinasDisponibles
} = require('../services/calculoProduccion');

/**
 * POST /api/plan/calcular
 * Calculate production plans for given orders (PREVIEW - no DB save yet)
 * 
 * Body:
 * {
 *   "alupak_pedido_ids": [1, 2, 3],
 *   "maquinas_disponibles": ["M1", "M2", "M3", "M4"],
 *   "usar_stock_disponible": true,
 *   "fecha_inicio": "2026-03-18"
 * }
 * 
 * Returns: { planes: [...], carga_máquinas: {...}, validaciones: {...} }
 */
router.post('/calcular', async (req, res) => {
  try {
    let { alupak_pedido_ids, maquinas_disponibles, usar_stock_disponible, fecha_inicio } = req.body;

    // Validate input
    if (!alupak_pedido_ids || !Array.isArray(alupak_pedido_ids)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Se requiere array de alupak_pedido_ids',
        campo_afectado: 'alupak_pedido_ids'
      });
    }

    if (alupak_pedido_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Array de pedidos está vacío'
      });
    }

    // Default values
    maquinas_disponibles = maquinas_disponibles || ['M1', 'M2', 'M3', 'M4'];
    usar_stock_disponible = usar_stock_disponible !== false;

    // Parse fecha_inicio
    if (!fecha_inicio) {
      fecha_inicio = new Date();
    } else {
      const fNorm = normalizarFecha(fecha_inicio);
      if (!fNorm) {
        return res.status(400).json({
          success: false,
          error_type: 'VALIDATION_ERROR',
          mensaje: 'Formato de fecha_inicio inválido',
          campo_afectado: 'fecha_inicio'
        });
      }
      fecha_inicio = new Date(fNorm);
    }

    // Fetch orders
    const pedidosResult = await pool.query(`
      SELECT id, no_sales_line, qty_pending, customer_name
      FROM alupak_pedidos
      WHERE id = ANY($1)
      ORDER BY id DESC
      LIMIT 1000
    `, [alupak_pedido_ids]);

    if (pedidosResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'No se encontraron pedidos con los IDs proporcionados'
      });
    }

    // Fetch stock
    let stockResult;
    if (usar_stock_disponible) {
      stockResult = await pool.query(`
        SELECT item_no, SUM(qty_base) as qty_base
        FROM inventario_fisico
        GROUP BY item_no
      `);
    } else {
      stockResult = { rows: [] };
    }

    // Fetch OEE values
    const oeeResult = await pool.query(`
      SELECT clave, valor 
      FROM configuracion 
      WHERE clave LIKE 'oee_maquina_%'
    `);

    const oeeMaquinas = {
      M1: 0.85,
      M2: 0.85,
      M3: 0.85,
      M4: 0.85
    };

    for (const row of oeeResult.rows) {
      const maquina = row.clave.replace('oee_maquina_', '');
      oeeMaquinas[maquina] = parseFloat(row.valor) || 0.85;
    }

    // Calculate plans
    const calculoResult = calcularPlanesProduccion(
      pedidosResult.rows,
      stockResult.rows,
      oeeMaquinas,
      fecha_inicio
    );

    res.json({
      success: true,
      planes: calculoResult.planes,
      carga_máquinas: calculoResult.carga_máquinas,
      validaciones: calculoResult.validaciones
    });

  } catch (error) {
    console.error('❌ Error calculando planes:', error);
    res.status(500).json(normalizarError(error, 'CALCULATION_ERROR'));
  }
});

/**
 * POST /api/plan/guardar
 * Save confirmed production plans to database
 * 
 * Body:
 * {
 *   "planes": [
 *     {
 *       "alupak_pedido_id": 1,
 *       "cantidad_planificada": 5000,
 *       "maquina_asignada": "M1",
 *       "fecha_inicio": "2026-03-18",
 *       "fecha_fin": "2026-03-21",
 *       "estado": "Requiere producción",
 *       "oee_aplicado": 0.85,
 *       "observaciones": "Plan inicial"
 *     }
 *   ],
 *   "usuario_creador": "user@example.com"
 * }
 * 
 * Returns: { success: true, ids_guardados: [123, 124], mensaje: "..." }
 */
router.post('/guardar', async (req, res) => {
  try {
    let { planes, usuario_creador } = req.body;

    // Validate input
    if (!planes || !Array.isArray(planes) || planes.length === 0) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Se requiere array de planes no vacío'
      });
    }

    usuario_creador = usuario_creador || 'sistema';

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const idsGuardados = [];
      const erroresValidacion = [];

      for (let idx = 0; idx < planes.length; idx++) {
        const plan = planes[idx];

        // Validate each plan
        const validacion = validarPlan(plan, { checkDates: true, checkStock: false });
        if (!validacion.isValid) {
          erroresValidacion.push({
            index: idx,
            plan_id_temp: plan.id_temp,
            errores: validacion.errors
          });
          continue;
        }

        // Normalize dates
        const fechaInicio = normalizarFecha(plan.fecha_inicio);
        const fechaFin = plan.fecha_fin ? normalizarFecha(plan.fecha_fin) : null;

        // Insert plan
        const insertResult = await client.query(`
          INSERT INTO planes_produccion (
            alupak_pedido_id, cantidad_planificada, maquina_asignada,
            fecha_inicio, fecha_fin, estado, oee_aplicado, observaciones,
            tiempo_estimado_min, usuario_creador, generacion, prioridad,
            es_manual, estado_finalizado, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING id
        `, [
          plan.alupak_pedido_id,
          plan.cantidad_planificada,
          plan.maquina_asignada,
          fechaInicio,
          fechaFin,
          plan.estado || 'Requiere producción',
          plan.oee_aplicado || 0.85,
          plan.observaciones || '',
          plan.tiempo_estimado_minutos || 0,
          usuario_creador,
          plan.generacion || 'G1',
          plan.prioridad || '3',
          true, // es_manual = true for user-created plans
          false, // estado_finalizado = false initially
        ]);

        if (insertResult.rows[0]) {
          idsGuardados.push(insertResult.rows[0].id);
        }
      }

      await client.query('COMMIT');

      // Response
      const response = {
        success: erroresValidacion.length === 0,
        ids_guardados: idsGuardados,
        mensaje: `${idsGuardados.length} planes guardados exitosamente`,
        total_procesados: planes.length,
        usuario_creador: usuario_creador
      };

      if (erroresValidacion.length > 0) {
        response.errores_validacion = erroresValidacion;
      }

      res.json(response);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error guardando planes:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/plan
 * Get all active (non-completed) production plans
 * Query params: ?filtro_estado=&filtro_maquina=&orden=fecha_inicio
 */
router.get('/', async (req, res) => {
  try {
    const { filtro_estado, filtro_maquina, orden } = req.query;

    let query = 'SELECT * FROM planes_produccion WHERE estado_finalizado = FALSE';
    const params = [];

    if (filtro_estado) {
      query += ` AND estado = $${params.length + 1}`;
      params.push(filtro_estado);
    }

    if (filtro_maquina) {
      query += ` AND maquina_asignada = $${params.length + 1}`;
      params.push(filtro_maquina);
    }

    const ordenValido = orden || 'fecha_inicio ASC';
    query += ` ORDER BY ${ordenValido} LIMIT 10000`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      planes: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo planes:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/plan/historial
 * Get paginated history of completed production orders
 * Query params: ?pagina=1&limite=20&fecha_desde=&fecha_hasta=
 */
router.get('/historial', async (req, res) => {
  try {
    let { pagina, limite, fecha_desde, fecha_hasta } = req.query;

    // Validate pagination
    pagina = Math.max(1, parseInt(pagina) || 1);
    limite = Math.min(100, Math.max(10, parseInt(limite) || 20)); // Between 10-100

    const offset = (pagina - 1) * limite;

    // Build query
    let countQuery = 'SELECT COUNT(*) as total FROM planes_produccion WHERE estado_finalizado = TRUE';
    let dataQuery = `
      SELECT * FROM planes_produccion 
      WHERE estado_finalizado = TRUE
    `;
    const params = [];

    // Date filters
    if (fecha_desde) {
      const fDesde = normalizarFecha(fecha_desde);
      if (fDesde) {
        countQuery += ` AND fecha_finalizado >= $${params.length + 1}`;
        dataQuery += ` AND fecha_finalizado >= $${params.length + 1}`;
        params.push(`${fDesde}T00:00:00`);
      }
    }

    if (fecha_hasta) {
      const fHasta = normalizarFecha(fecha_hasta);
      if (fHasta) {
        countQuery += ` AND fecha_finalizado <= $${params.length + 1}`;
        dataQuery += ` AND fecha_finalizado <= $${params.length + 1}`;
        params.push(`${fHasta}T23:59:59`);
      }
    }

    // Get total count
    const countResult = await pool.query(countQuery, params);
    const totalRegistros = parseInt(countResult.rows[0].total) || 0;
    const totalPaginas = Math.ceil(totalRegistros / limite);

    // Get paginated data
    dataQuery += ` ORDER BY fecha_finalizado DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limite, offset);

    const dataResult = await pool.query(dataQuery, params);

    res.json({
      success: true,
      planes: dataResult.rows,
      pagina_actual: pagina,
      items_por_pagina: limite,
      total_registros: totalRegistros,
      total_paginas: totalPaginas,
      tiene_siguiente: pagina < totalPaginas,
      tiene_anterior: pagina > 1,
      offset: offset
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/plan/:id
 * Get single plan details with related order info
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

/**
 * PUT /api/plan/:id/editar
 * Edit existing production plan (only if not completed)
 * 
 * Body: { cantidad_planificada, maquina_asignada, fecha_inicio, fecha_fin, estado, observaciones }
 */
router.put('/:id/editar', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch current plan
    const currentResult = await pool.query(
      'SELECT * FROM planes_produccion WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error_type: 'NOT_FOUND',
        mensaje: 'Plan no encontrado'
      });
    }

    const planActual = currentResult.rows[0];

    // Check if can be edited
    if (!puedeEditarse(planActual)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'No se puede editar un plan completado'
      });
    }

    // Validate updates
    const validacion = validarActualizacion(updates);
    if (!validacion.isValid) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Validación de actualización falló',
        errores: validacion.errors,
        campo_afectado: Object.keys(validacion.errors)[0]
      });
    }

    // Build update query dynamically
    const setFields = [];
    const params = [id];

    for (const field in validacion.data) {
      setFields.push(`${field} = $${params.length + 1}`);
      params.push(validacion.data[field]);
    }

    if (setFields.length === 0) {
      return res.json({
        success: true,
        mensaje: 'No hay cambios para aplicar',
        plan: planActual
      });
    }

    setFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const updateQuery = `
      UPDATE planes_produccion
      SET ${setFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, params);

    res.json({
      success: true,
      mensaje: 'Plan actualizado exitosamente',
      plan: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error actualizando plan:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * PUT /api/plan/:id/marcar-completado
 * Mark production plan as completed
 * Sets estado_finalizado = true, fecha_finalizado = now()
 */
router.put('/:id/marcar-completado', async (req, res) => {
  try {
    const { id } = req.params;
    const { notas } = req.body || {};

    // Fetch plan
    const currentResult = await pool.query(
      'SELECT * FROM planes_produccion WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error_type: 'NOT_FOUND',
        mensaje: 'Plan no encontrado'
      });
    }

    // Update
    const updateResult = await pool.query(`
      UPDATE planes_produccion
      SET 
        estado_finalizado = TRUE,
        fecha_finalizado = CURRENT_TIMESTAMP,
        estado = 'Completado',
        updated_at = CURRENT_TIMESTAMP,
        notas_auditoría = COALESCE(notas_auditoría, '') || 'Marcado como completado en ' || NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    console.log(`✅ Plan ${id} marcado como completado`);

    res.json({
      success: true,
      mensaje: 'Plan marcado como completado',
      plan: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error marcando plan como completado:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * DELETE /api/plan/:id
 * Delete production plan (only if not completed)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch plan
    const currentResult = await pool.query(
      'SELECT * FROM planes_produccion WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error_type: 'NOT_FOUND',
        mensaje: 'Plan no encontrado'
      });
    }

    const plan = currentResult.rows[0];

    // Check if can be deleted
    if (plan.estado_finalizado === true) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'No se puede eliminar un plan completado'
      });
    }

    // Delete
    await pool.query('DELETE FROM planes_produccion WHERE id = $1', [id]);

    console.log(`✅ Plan ${id} eliminado`);

    res.json({
      success: true,
      mensaje: 'Plan eliminado exitosamente',
      id_eliminado: id
    });

  } catch (error) {
    console.error('❌ Error eliminando plan:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

module.exports = router;
