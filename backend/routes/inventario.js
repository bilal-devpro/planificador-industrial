const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// 🔥 Obtener últimos registros de inventario físico
router.get('/ultimos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id,
        item_no,
        bin_code,
        lot_no,
        qty_base,
        tipo_registro,
        of_numero,
        lote_numero,
        archivo_original,
        usuario_carga,
        fecha_importacion,
        fecha_carga
      FROM inventario_fisico
      ORDER BY fecha_importacion DESC
      LIMIT 200
    `);

    res.json({
      success: true,
      inventario: resultado.rows
    });

  } catch (error) {
    console.error("❌ Error obteniendo últimos registros de inventario:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
