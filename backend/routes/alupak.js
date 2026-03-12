const express = require('express');
const router = express.Router();
const { guardarAlupakPedidos } = require('../database');

// ✅ RUTA PARA GUARDAR DATOS YA PROCESADOS (desde frontend)
router.post('/guardar', async (req, res) => {
  try {
    const { pedidos, nombreArchivo, usuario = 'system' } = req.body;
    
    if (!pedidos || !Array.isArray(pedidos)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos: se requiere array de pedidos' 
      });
    }

    // Guardar en PostgreSQL (evita duplicados por usuario)
    const resultado = await guardarAlupakPedidos(pedidos, usuario);

    res.json({
      success: true,
      message: `✅ Guardados ${resultado.guardados} pedidos`,
      estadisticas: {
        procesados: pedidos.length,
        guardados: resultado.guardados,
        errores: pedidos.length - resultado.guardados
      }
    });

  } catch (error) {
    console.error('❌ Error guardando ALUPAK:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al guardar los datos en la base de datos',
      detalle: error.message 
    });
  }
});

module.exports = router;