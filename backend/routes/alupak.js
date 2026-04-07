const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
//nst { guardarAlupakPedidos } = require('../database');
const { pool, guardarAlupakPedidos } = require('../database');

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

        // 🔥 Normalización obligatoria - ACEPTA MÚLTIPLES VARIANTES DE NOMBRES
        const pedidos = rows.map(r => {
            // Buscar columnas con nombres similares (case-insensitive)
            const keys = Object.keys(r);
            
            // Cliente: CustomerName, customer_name, CLIENTE, Cliente, etc.
            const customerKey = keys.find(k => k.toLowerCase().includes('customer') || k.toLowerCase().includes('cliente'));
            
            // Producto: No_SalesLine, no_sales_line, PRODUCTO, Producto, etc.
            const productKey = keys.find(k => k.toLowerCase().includes('sales') || k.toLowerCase().includes('producto') || k.toLowerCase().includes('no_'));
            
            // Cantidad: Qty_pending, qty_pending, CANTIDAD, Cantidad, PENDIENTE, etc.
            const qtyKey = keys.find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('cantidad') || k.toLowerCase().includes('pending') || k.toLowerCase().includes('pendiente'));

            const customerName = customerKey ? (r[customerKey] || '') : '';
            const noSalesLine = productKey ? (r[productKey] || '') : '';
            const qtyPending = qtyKey ? (r[qtyKey] || 0) : 0;

            return {
                // Campos para mostrar en frontend
                customer_name: customerName,
                no_sales_line: noSalesLine,
                qty_pending: Number(qtyPending) || 0,

                // Campos que la BD necesita
                CustomerName: customerName,
                No_SalesLine: noSalesLine,
                Qty_pending: Number(qtyPending) || 0,

                archivo_original: nombreArchivo
            };
        });

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
// Últimos pedidos ALUPAK
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

// Limpiar todos los datos de ALUPAK
router.delete('/limpiar', async (req, res) => {
  try {
    console.log('🧹 Iniciando limpieza de ALUPAK...');
    
    // Verificar conexión
    if (!pool) {
      throw new Error('Pool de conexiones no disponible');
    }

    // Contar registros antes de eliminar
    const countResult = await pool.query('SELECT COUNT(*) as total FROM alupak_pedidos');
    const totalRegistros = parseInt(countResult.rows[0].total);
    
    console.log(`📦 Registros a eliminar: ${totalRegistros}`);

    // Eliminar datos en orden correcto para evitar conflictos de claves foráneas
    // 1. Eliminar planes de producción que referencian a ALUPAK
    await pool.query('DELETE FROM planes_produccion WHERE alupak_pedido_id IS NOT NULL');
    
    // 2. Eliminar pedidos ALUPAK
    await pool.query('DELETE FROM alupak_pedidos');
    
    // 3. Eliminar historial de importaciones
    await pool.query('DELETE FROM historial_importaciones WHERE tipo = $1', ['alupak']);
    
    console.log('✅ Limpieza completada exitosamente');
    
    res.json({ 
      success: true, 
      message: `Datos de ALUPAK eliminados correctamente (${totalRegistros} registros)` 
    });
    
  } catch (error) {
    console.error('❌ Error limpiando ALUPAK:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Error al intentar eliminar datos de ALUPAK'
    });
  }
});

// Endpoint para frontend - Limpiar ALUPAK (ruta completa)
router.delete('/api/alupak/limpiar', async (req, res) => {
  try {
    console.log('🧹 Iniciando limpieza de ALUPAK desde frontend...');
    
    // Verificar conexión
    if (!pool) {
      throw new Error('Pool de conexiones no disponible');
    }

    // Contar registros antes de eliminar
    const countResult = await pool.query('SELECT COUNT(*) as total FROM alupak_pedidos');
    const totalRegistros = parseInt(countResult.rows[0].total);
    
    console.log(`📦 Registros a eliminar: ${totalRegistros}`);

    // Eliminar datos en orden correcto para evitar conflictos de claves foráneas
    // 1. Eliminar planes de producción que referencian a ALUPAK
    await pool.query('DELETE FROM planes_produccion WHERE alupak_pedido_id IS NOT NULL');
    
    // 2. Eliminar pedidos ALUPAK
    await pool.query('DELETE FROM alupak_pedidos');
    
    // 3. Eliminar historial de importaciones
    await pool.query('DELETE FROM historial_importaciones WHERE tipo = $1', ['alupak']);
    
    console.log('✅ Limpieza completada exitosamente');
    
    res.json({ 
      success: true, 
      message: `Datos de ALUPAK eliminados correctamente (${totalRegistros} registros)` 
    });
    
  } catch (error) {
    console.error('❌ Error limpiando ALUPAK desde frontend:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Error al intentar eliminar datos de ALUPAK'
    });
  }
});

module.exports = router;
