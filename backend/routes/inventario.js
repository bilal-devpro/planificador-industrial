const express = require('express');
const router = express.Router();

router.post('/guardar', async (req, res) => {
  res.json({ success: true, message: 'Inventario guardado' });
});

module.exports = router;
