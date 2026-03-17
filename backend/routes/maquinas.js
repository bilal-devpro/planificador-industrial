/**
 * routes/maquinas.js
 * 
 * Machine management endpoints
 * - GET /api/maquinas - List all machines with current OEE
 * - GET /api/maquinas/:id/carga - Get machine workload
 * - PUT /api/maquinas/:id/oee - Update machine OEE
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { normalizarError } = require('../services/validacion');

/**
 * GET /api/maquinas
 * Returns list of all available machines with current OEE values
 */
router.get('/', async (req, res) => {
  try {
    // Fetch OEE values from configuracion table
    const result = await pool.query(`
      SELECT clave, valor 
      FROM configuracion 
      WHERE clave LIKE 'oee_maquina_%'
      ORDER BY clave ASC
    `);

    // Build machines list
    const machines = [
      {
        id: 'M1',
        nombre: 'Máquina 1',
        generaciones: ['G1', 'G2'],
        oee_actual: 0.85,
        tracks: 12
      },
      {
        id: 'M2',
        nombre: 'Máquina 2',
        generaciones: ['G1', 'G2'],
        oee_actual: 0.85,
        tracks: 12
      },
      {
        id: 'M3',
        nombre: 'Máquina 3',
        generaciones: ['G1', 'G2'],
        oee_actual: 0.85,
        tracks: 12
      },
      {
        id: 'M4',
        nombre: 'Máquina 4',
        generaciones: ['G1'],
        oee_actual: 0.85,
        tracks: 6
      }
    ];

    // Update OEE from DB
    for (const row of result.rows) {
      const machineId = row.clave.replace('oee_maquina_', '');
      const machine = machines.find(m => m.id === machineId);
      if (machine) {
        machine.oee_actual = parseFloat(row.valor) || 0.85;
      }
    }

    res.json({
      success: true,
      maquinas: machines
    });

  } catch (error) {
    console.error('❌ Error fetching machines:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/maquinas/:id
 * Get single machine details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!['M1', 'M2', 'M3', 'M4'].includes(id)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'ID de máquina inválido'
      });
    }

    // Fetch OEE
    const result = await pool.query(`
      SELECT valor 
      FROM configuracion 
      WHERE clave = $1
    `, [`oee_maquina_${id}`]);

    const machineConfig = {
      M1: { nombre: 'Máquina 1', generaciones: ['G1', 'G2'], tracks: 12 },
      M2: { nombre: 'Máquina 2', generaciones: ['G1', 'G2'], tracks: 12 },
      M3: { nombre: 'Máquina 3', generaciones: ['G1', 'G2'], tracks: 12 },
      M4: { nombre: 'Máquina 4', generaciones: ['G1'], tracks: 6 }
    };

    const config = machineConfig[id];
    const oee = result.rows[0] ? parseFloat(result.rows[0].valor) : 0.85;

    res.json({
      success: true,
      maquina: {
        id: id,
        ...config,
        oee_actual: oee
      }
    });

  } catch (error) {
    console.error('❌ Error fetching machine:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * GET /api/maquinas/:id/carga
 * Get current machine workload and active plans
 */
router.get('/:id/carga', async (req, res) => {
  try {
    const { id } = req.params;

    if (!['M1', 'M2', 'M3', 'M4'].includes(id)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'ID de máquina inválido'
      });
    }

    // Sum minutes for non-completed plans
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(tiempo_estimado_min), 0) as minutos_acumulados,
        COUNT(*) as planes_activos,
        MIN(fecha_fin) as proximo_fin
      FROM planes_produccion
      WHERE maquina_asignada = $1 
        AND estado_finalizado = FALSE
        AND estado != 'Cancelado'
    `, [id]);

    const row = result.rows[0];

    res.json({
      success: true,
      carga: {
        maquina: id,
        minutos_acumulados: parseInt(row.minutos_acumulados) || 0,
        horas_acumuladas: Math.round((parseInt(row.minutos_acumulados) || 0) / 60 * 100) / 100,
        planes_activos: parseInt(row.planes_activos) || 0,
        proximamente: row.proximo_fin || null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching machine load:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * PUT /api/maquinas/:id/oee
 * Update OEE value for a machine
 * Body: { oee: 0.82 }
 */
router.put('/:id/oee', async (req, res) => {
  try {
    const { id } = req.params;
    const { oee } = req.body;

    // Validate machine ID
    if (!['M1', 'M2', 'M3', 'M4'].includes(id)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'ID de máquina inválido'
      });
    }

    // Validate OEE value
    const oeeNum = parseFloat(oee);
    if (isNaN(oeeNum) || oeeNum < 0 || oeeNum > 1) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'OEE debe ser un número entre 0 y 1',
        campo_afectado: 'oee'
      });
    }

    // Update or insert OEE in configuracion table
    const clave = `oee_maquina_${id}`;
    const result = await pool.query(`
      INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (clave) DO UPDATE SET
        valor = EXCLUDED.valor,
        actualizado_en = CURRENT_TIMESTAMP
      RETURNING clave, valor, actualizado_en
    `, [clave, oeeNum.toString(), `OEE para máquina ${id}`]);

    console.log(`✅ OEE actualizado para ${id}: ${oeeNum}`);

    res.json({
      success: true,
      mensaje: `OEE para ${id} actualizado a ${oeeNum}`,
      maquina: id,
      oee_nuevo: oeeNum,
      actualizado_en: result.rows[0].actualizado_en
    });

  } catch (error) {
    console.error('❌ Error updating machine OEE:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

/**
 * PUT /api/maquinas/:id
 * Update machine configuration (general endpoint)
 * Can update nombre, tracks, generaciones (if needed in future)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tracks, generaciones } = req.body;

    if (!['M1', 'M2', 'M3', 'M4'].includes(id)) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'ID de máquina inválido'
      });
    }

    // Currently, machines are hardcoded and not editable via this endpoint
    // This is a placeholder for future extensibility
    res.json({
      success: false,
      mensaje: 'Edición de máquinas no permitida en esta versión',
      id: id
    });

  } catch (error) {
    console.error('❌ Error updating machine:', error);
    res.status(500).json(normalizarError(error, 'DATABASE_ERROR'));
  }
});

module.exports = router;
