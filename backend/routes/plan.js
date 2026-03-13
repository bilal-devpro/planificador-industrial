const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Guardar plan de producción
router.post('/produccion', async (req, res) => {
  try {
    const {
      version_id,
      pedido_id,
      producto_id,
      linea_id,
      cantidad,
      fecha_inicio,
      fecha_fin,
      turno,
      estado,
      oee,
      observaciones
    } = req.body;

    const result = await pool.query(`
      INSERT INTO planes_produccion (
        id, alupak_pedido_id, cantidad_planificada, fecha_inicio, fecha_fin,
        linea_asignada, estado, observaciones, tiempo_estimado_min, oee_aplicado,
        es_manual
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) ON CONFLICT (id) DO UPDATE SET
        cantidad_planificada = EXCLUDED.cantidad_planificada,
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_fin = EXCLUDED.fecha_fin,
        linea_asignada = EXCLUDED.linea_asignada,
        estado = EXCLUDED.estado,
        observaciones = EXCLUDED.observaciones,
        tiempo_estimado_min = EXCLUDED.tiempo_estimado_min,
        oee_aplicado = EXCLUDED.oee_aplicado,
        actualizado_en = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      `plan-${pedido_id}-${Date.now()}`,
      pedido_id,
      cantidad,
      fecha_inicio,
      fecha_fin,
      linea_id,
      estado || 'planificado',
      observaciones || '',
      0, // tiempo_estimado_min, calcular si es necesario
      oee || 0.85,
      true // es_manual
    ]);

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error guardando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener planes de producción
router.get('/produccion', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM planes_produccion
      ORDER BY fecha_inicio ASC, prioridad ASC
    `);

    res.json({ success: true, planes: result.rows });
  } catch (error) {
    console.error('Error obteniendo planes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Guardar múltiples planes (para planes calculados automáticamente)
router.post('/produccion/bulk', async (req, res) => {
  try {
    const { planes } = req.body;

    if (!planes || !Array.isArray(planes)) {
      return res.status(400).json({ success: false, error: 'Se requiere array de planes' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Limpiar planes no manuales (calculados automáticamente)
      await client.query('DELETE FROM planes_produccion WHERE es_manual = FALSE');

      let guardados = 0;
      for (const plan of planes) {
        await client.query(`
          INSERT INTO planes_produccion (
            id, alupak_pedido_id, customer_name, no_sales_line, producto_nombre,
            cantidad_pendiente, stock_disponible_original, stock_disponible_ajustado,
            cantidad_a_producir, cantidad_planificada, fecha_inicio, fecha_fin,
            linea_asignada, maquina_asignada, generacion, prioridad, estado,
            observaciones, tiempo_estimado_min, oee_aplicado, es_manual,
            unidades_por_caja, cajas_pendientes, cajas_a_producir, cajas_stock_disponible
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
          )
        `, [
          plan.id,
          plan.alupak_pedido_id,
          plan.customer_name,
          plan.no_sales_line,
          plan.producto_nombre,
          plan.cantidad_pendiente,
          plan.stock_disponible_original,
          plan.stock_disponible_ajustado,
          plan.cantidad_a_producir,
          plan.cantidad_planificada,
          plan.fecha_inicio,
          plan.fecha_fin,
          plan.linea_asignada,
          plan.maquina_asignada,
          plan.generacion,
          plan.prioridad,
          plan.estado,
          plan.observaciones,
          plan.tiempo_estimado_min,
          plan.oee_aplicado,
          plan.es_manual || false,
          plan.unidades_por_caja,
          plan.cajas_pendientes,
          plan.cajas_a_producir,
          plan.cajas_stock_disponible
        ]);
        guardados++;
      }

      await client.query('COMMIT');
      res.json({ success: true, guardados });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error guardando planes bulk:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar plan
router.delete('/produccion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM planes_produccion WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
