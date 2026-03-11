const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error en GET /productos:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


router.post('/', async (req, res) => {
  const { codigo, nombre } = req.body;
  await pool.query(
    'INSERT INTO productos (codigo, nombre) VALUES ($1, $2)',
    [codigo, nombre]
  );
  res.json({ success: true });
});

router.put('/:id', async (req, res) => {
  const { codigo, nombre } = req.body;
  await pool.query(
    'UPDATE productos SET codigo=$1, nombre=$2 WHERE id=$3',
    [codigo, nombre, req.params.id]
  );
  res.json({ success: true });
});

module.exports = router;
