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
    res.json({ resumen: r.rows[0] || {} });
  } catch (err) {
    console.error('Error /dashboard-excel/resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-excel/graficos
router.get('/graficos', async (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
