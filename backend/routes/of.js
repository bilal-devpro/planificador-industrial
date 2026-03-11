const express = require('express');
const router = express.Router();

router.get('/estadisticas', (req, res) => {
  res.json({ success: true, data: [] });
});

router.post('/guardar', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
