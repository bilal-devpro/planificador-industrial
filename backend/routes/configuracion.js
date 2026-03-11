const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /api/configuracion
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion ORDER BY clave');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error GET /configuracion:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/configuracion
router.put('/', async (req, res) => {
  const { clave, valor } = req.body;
  if (!clave) return res.status(400).json({ success: false, error: 'Falta clave' });

  try {
    await pool.query(
      `INSERT INTO configuracion (clave, valor, actualizado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
      [clave, valor]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error PUT /configuracion:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
