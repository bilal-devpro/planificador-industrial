const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { pool, guardarInventarioFisico } = require('../database');

const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
   📌 IMPORTAR INVENTARIO
   ============================================================ */
router.post('/importar', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se envió archivo' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        const nombreArchivo = req.file.originalname || 'inventario.xlsx';

        // Normalización de datos
        const inventario = rows.map(r => ({
            item_no: r.ItemNo_ItemJournalLine || r.ItemNo || '',
            bin_code: r.BinCode_ItemJournalLine || r.BinCode || 'SIN_UBICACION',
            lot_no: r.ReservEntryBufferLotNo || r.LotNo || null,
            qty_base: Number(
                (r.ReservEntryBufferQtyBase && r.ReservEntryBufferQtyBase !== "NULL")
                    ? r.ReservEntryBufferQtyBase
                    : (r.QtyBase && r.QtyBase !== "NULL")
                        ? r.QtyBase
                        : 0
            ),
        }));

        res.json({
            success: true,
            inventario
        });

    } catch (error) {
        console.error("❌ Error procesando inventario:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/* ============================================================
   📌 GUARDAR INVENTARIO
   ============================================================ */
router.post('/guardar', async (req, res) => {
    try {
        const { inventario, nombreArchivo, usuario = 'system' } = req.body;

        if (!inventario || !Array.isArray(inventario)) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos: se requiere array de inventario'
            });
        }

        const inventarioLimpio = inventario.map(r => ({
            ...r,
            qty_base: Number(r.qty_base) || 0,
            archivo_original: nombreArchivo
        }));

        const resultado = await guardarInventarioFisico(inventarioLimpio, usuario);

        res.json({
            success: true,
            mensaje: `Guardados ${resultado.guardados} registros`,
            estadisticas: resultado
        });

    } catch (error) {
        console.error("❌ Error guardando inventario:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/* ============================================================
   📌 ÚLTIMOS REGISTROS DE INVENTARIO
   ============================================================ */
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

/* ============================================================
   📌 LIMPIAR INVENTARIO
   ============================================================ */
router.delete('/limpiar', async (req, res) => {
  try {
    await pool.query('DELETE FROM inventario_fisico');
    await pool.query('DELETE FROM historial_importaciones WHERE tipo = $1', ['inventario']);
    res.json({ success: true, message: 'Datos de inventario eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error limpiando inventario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
