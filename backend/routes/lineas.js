const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    lineas: [
      { id: 1, codigo: 'M1' },
      { id: 2, codigo: 'M2' },
      { id: 3, codigo: 'M3' },
      { id: 4, codigo: 'M4' }
    ]
  });
});

module.exports = router;
