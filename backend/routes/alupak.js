const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { pool, guardarAlupakPedidos } = require('../database');

// Configurar multer para recibir archivos
const upload = multer({ storage: multer.memoryStorage() });

// TEST: comprobar que la ruta carga
router.get('/', (req, res) => {
  res.json({ ok: true, ruta: "ALUPAK cargada correctamente" });
});

// Ruta para importar pedidos ALUPAK
router.post('/importar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const resultado = await guardarAlupakPedidos(rows, 'usuario_web');

    res.json({
      success: true,
      mensaje: 'Archivo procesado correctamente',
      estadisticas: resultado
    });

  } catch (error) {
    console.error('❌ Error importando ALUPAK:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
