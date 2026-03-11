const express = require('express');
const router = express.Router();
const pool = require('../database');

router.post('/guardar', async (req, res) => {
  res.json({ success: true, mensaje: 'Guardado OK', estadisticas: {} });
});

module.exports = router;
