const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { guardarAlupakPedidos } = require('../database');

const upload = multer({ storage: multer.memoryStorage() });

// PROCESAR EXCEL
router.post('/importar', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const pedidos = xlsx.utils.sheet_to_json(sheet);

    res.json({
      success: true,
      pedidos
    });

  } catch (error) {
    console.error("Error procesando Excel:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GUARDAR PEDIDOS
router.post('/guardar', async (req, res) => {
  try {
    const { pedidos, nombreArchivo, usuario = 'system' } = req.body;

    if (!pedidos || !Array.isArray(pedidos)) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos: se requiere array de pedidos'
      });
    }

    const resultado = await guardarAlupakPedidos(pedidos, usuario);

    res.json({
      success: true,
      mensaje: `Guardados ${resultado.guardados} pedidos`,
      estadisticas: resultado
    });

  } catch (error) {
    console.error('Error guardando ALUPAK:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
