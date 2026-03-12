const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { pool, guardarAlupakPedidos } = require('../database');
// Configurar multer para recibir archivos
const upload = multer({ storage: multer.memoryStorage() });

// Ruta para importar pedidos ALUPAK
router.post('/importar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo' });
    }

    // Leer Excel desde memoria
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    // Guardar en la base de datos
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

// Ruta existente
router.post('/guardar', async (req, res) => {
  res.json({ success: true, mensaje: 'Guardado OK', estadisticas: {} });
});

module.exports = router;
