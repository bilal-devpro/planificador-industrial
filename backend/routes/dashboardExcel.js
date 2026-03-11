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
    const pedidos = await pool.query(`
      SELECT COUNT(*) AS total, COALESCE(SUM(qty_pending), 0) AS cantidad_total
      FROM alupak_pedidos
    `);

    const stock = await pool.query(`
      SELECT 
        COUNT(DISTINCT item_no) AS productos_unicos,
        COALESCE(SUM(qty_base), 0) AS cantidad_total
      FROM inventario_fisico
    `);

    const resumen = {
      pedidos: {
        total: Number(pedidos.rows[0].total),
        cantidad_total: Number(pedidos.rows[0].cantidad_total)
      },
      stock: {
        productos_unicos: Number(stock.rows[0].productos_unicos),
        cantidad_total: Number(stock.rows[0].cantidad_total)
      },
      maquinas: {
        oee: 0.85 // o lo que uses en tu config
      }
    };

    res.json({ resumen });

  } catch (err) {
    console.error("Error en /resumen:", err);

    res.json({
      resumen: {
        pedidos: { total: 0, cantidad_total: 0 },
        stock: { productos_unicos: 0, cantidad_total: 0 },
        maquinas: { oee: 0 }
      }
    });
  }
});




// GET /api/dashboard-excel/graficos
router.get('/graficos', async (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
