const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { guardarAlupakPedidos } = require('../database');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/importar', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se envió archivo' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        const nombreArchivo = req.file.originalname || 'alupak.xlsx';

        // 🔥 Normalización obligatoria
        const pedidos = rows.map(r => ({
            // Campos para mostrar en frontend
            customer_name: r.CompanyName || '',
            no_sales_line: r.No_SalesLine || '',
            qty_pending: r.Quantity_SalesLine || 0,

            // Campos que la BD necesita
            CustomerName: r.CompanyName || '',
            No_SalesLine: r.No_SalesLine || '',
            Qty_pending: r.Quantity_SalesLine || 0,

            archivo_original: nombreArchivo
        }));

        res.json({
            success: true,
            pedidos
        });

    } catch (error) {
        console.error("❌ Error procesando Excel:", error);
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

        // 🔥 Normalizar valores peligrosos
        const pedidosLimpios = pedidos.map(p => ({
            ...p,
            CustomerName: p.CustomerName === "NULL" ? "" : p.CustomerName,
            No_SalesLine: p.No_SalesLine === "NULL" ? "" : p.No_SalesLine,
            Qty_pending:
                p.Qty_pending === "NULL" || p.Qty_pending === "" || p.Qty_pending == null
                    ? 0
                    : Number(p.Qty_pending),

            archivo_original: nombreArchivo
        }));

        const resultado = await guardarAlupakPedidos(pedidosLimpios, usuario);

        res.json({
            success: true,
            mensaje: `Guardados ${resultado.guardados} pedidos`,
            estadisticas: resultado
        });

    } catch (error) {
        console.error('❌ Error guardando ALUPAK:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
//alupak ultimos pedidos
router.get('/ultimos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        id,
        customer_name,
        no_sales_line,
        qty_pending,
        archivo_original,
        usuario_carga,
        fecha_importacion
      FROM alupak_pedidos
      ORDER BY fecha_importacion DESC
      LIMIT 200
    `);

    res.json({
      success: true,
      pedidos: resultado.rows
    });

  } catch (error) {
    console.error("❌ Error obteniendo últimos pedidos ALUPAK:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
//pi/inventario/ultimos
router.get('/ultimos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        id,
        customer_name,
        no_sales_line,
        qty_pending,
        archivo_original,
        usuario_carga,
        fecha_importacion
      FROM alupak_pedidos
      ORDER BY fecha_importacion DESC
      LIMIT 200
    `);

    res.json({
      success: true,
      pedidos: resultado.rows
    });

  } catch (error) {
    console.error("❌ Error obteniendo últimos pedidos ALUPAK:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
