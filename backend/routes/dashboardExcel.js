const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /api/dashboard-excel/pedidos
router.get('/pedidos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT *
      FROM alupak_pedidos
      ORDER BY fecha_carga DESC
    `);
    res.json({ pedidos: r.rows });
  } catch (err) {
    console.error('Error /dashboard-excel/pedidos:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-excel/stock
router.get('/stock', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT *
      FROM inventario_fisico
      ORDER BY fecha_carga DESC
    `);
    res.json({ stock: r.rows });
  } catch (err) {
    console.error('Error /dashboard-excel/stock:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-excel/resumen
router.get('/resumen', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM alupak_pedidos) AS total_pedidos,
        (SELECT COUNT(*) FROM inventario_fisico) AS total_inventario,
        (SELECT COUNT(*) FROM historial_importaciones) AS total_importaciones
    `);

    const raw = r.rows[0] || {};

    // 🔥 Transformación para que coincida con lo que el frontend espera
    const resumen = {
      total: Number(raw.total_pedidos || 0),
      criticos: 0,
      bajos: 0,
      normales: Number(raw.total_inventario || 0),
      importaciones: Number(raw.total_importaciones || 0)
    };

    res.json({ resumen });

  } catch (err) {
    console.error('Error /dashboard-excel/resumen:', err);

    res.json({
      resumen: {
        total: 0,
        criticos: 0,
        bajos: 0,
        normales: 0,
        importaciones: 0
      }
    });
  }
});



// GET /api/dashboard-excel/graficos
router.get('/graficos', async (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
