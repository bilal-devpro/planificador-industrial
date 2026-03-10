require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

// ✅ IMPORTAR POSTGRESQL (NO better-sqlite3)
const { 
  pool, 
  initDatabase, 
  guardarAlupakPedidos, 
  guardarInventarioFisico,
  obtenerHistorialImportaciones,
  obtenerDatosGuardados,
  extraerInfoOFLote
} = require('./database');

// Inicializar base de datos
initDatabase().catch(console.error);

const app = express();
const PORT = process.env.PORT || 10000; // Render usa 10000 por defecto

// ✅ CONFIGURACIÓN CORS PARA PRODUCCIÓN (Vercel + Render)
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Dominios permitidos
    const allowedOrigins = [
      'https://planificador-industrialverdader.vercel.app', // Tu frontend en Vercel
      'https://planificador-industrial.vercel.app',         // Dominio alternativo
      'http://localhost:5173',                              // Desarrollo local
      'http://127.0.0.1:5173'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));

// ✅ Manejar preflight OPTIONS explícitamente
app.options('*', cors(corsOptions));

// Middleware para JSON y uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de Multer para subir archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  }
});

// ========================================
// ENDPOINT DE SALUD (PARA DIAGNÓSTICO)
// ========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API REST para Planificador Industrial funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========================================
// ENDPOINT DE IMPORTACIÓN ALUPAK - EXTRACCIÓN SELECTIVA MEJORADA
// ========================================
app.post('/api/importar/alupak-pedidos', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }
    console.log('📄 Procesando archivo ALUPAK...');

    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    console.log(`📋 Columnas encontradas: ${headers.join(', ')}`);
    console.log(`📊 Total de filas: ${data.length}`);

    // Función para buscar columnas con prioridad
    const buscarColumna = (nombresBusqueda, evitarSufijos = ['Lbl', 'Label', 'Caption']) => {
      for (const nombreBuscado of nombresBusqueda) {
        const coincidenciaExacta = headers.find(h => 
          h && h.toString().trim() === nombreBuscado
        );
        if (coincidenciaExacta) return coincidenciaExacta;
      }

      for (const nombreBuscado of nombresBusqueda) {
        const coincidencias = headers.filter(h => 
          h && h.toString().toLowerCase().includes(nombreBuscado.toLowerCase())
        );
        
        const coincidenciasLimpias = coincidencias.filter(h => {
          const headerStr = h.toString();
          return !evitarSufijos.some(sufijo => 
            headerStr.toLowerCase().endsWith(sufijo.toLowerCase())
          );
        });

        if (coincidenciasLimpias.length > 0) {
          return coincidenciasLimpias[0];
        }
        if (coincidencias.length > 0) {
          return coincidencias[0];
        }
      }
      return null;
    };

    const colCustomerName = buscarColumna(
      ['CustomerName', 'Customer Name', 'customer_name'],
      ['Lbl', 'Label', 'Caption']
    );
    const colNoSalesLine = buscarColumna(
      ['No_SalesLine', 'No SalesLine', 'No.', 'Document No.', 'No'],
      ['Lbl', 'Label', 'Caption']
    );
    const colQtyPending = buscarColumna(
      ['Qty_pending', 'Qty pending', 'Quantity Pending', 'Pending'],
      ['Lbl', 'Label', 'Caption']
    );

    if (!colCustomerName || !colNoSalesLine || !colQtyPending) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers,
        columnas_requeridas: {
          CustomerName: colCustomerName ? '✓' : '✗',
          No_SalesLine: colNoSalesLine ? '✓' : '✗',
          Qty_pending: colQtyPending ? '✓' : '✗'
        }
      });
    }

    const pedidos = [];
    let errores = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const customerName = (row[colCustomerName] || '').toString().trim();
        const noSalesLine = (row[colNoSalesLine] || '').toString().trim();
        const qtyPending = parseInt(row[colQtyPending]) || 0;

        if (customerName && noSalesLine) {
          pedidos.push({
            fila: i + 2,
            CustomerName: customerName,
            No_SalesLine: noSalesLine,
            Qty_pending: qtyPending
          });
        }
      } catch (error) {
        errores.push({ fila: i + 2, error: error.message });
      }
    }

    console.log(`✅ Procesados: ${pedidos.length} pedidos, ${errores.length} errores`);
    
    res.json({
      success: true,
      message: `Archivo procesado exitosamente`,
      estadisticas: {
        total_filas: data.length,
        pedidos_extraidos: pedidos.length,
        errores: errores.length,
        columnas_detectadas: {
          CustomerName: colCustomerName,
          No_SalesLine: colNoSalesLine,
          Qty_pending: colQtyPending
        }
      },
      pedidos: pedidos,
      detallesErrores: errores.slice(0, 10)
    });
  } catch (error) {
    console.error('❌ Error procesando Excel:', error);
    res.status(500).json({
      error: 'Error procesando archivo Excel',
      detalle: error.message
    });
  }
});

// ========================================
// GUARDAR DATOS DE ALUPAK EN BASE DE DATOS (EVITA DUPLICADOS)
// ========================================
app.post('/api/alupak/guardar', async (req, res) => {
  try {
    const { pedidos, nombreArchivo, usuario = 'system' } = req.body;
    
    if (!pedidos || !Array.isArray(pedidos)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // ✅ GUARDAR EN POSTGRESQL (evita duplicados por usuario)
    const resultado = await guardarAlupakPedidos(pedidos, usuario);

    res.json({
      success: true,
      message: resultado.mensaje,
      estadisticas: {
        procesados: pedidos.length,
        guardados: resultado.guardados,
        errores: resultado.errores || 0
      }
    });
  } catch (error) {
    console.error('Error guardando ALUPAK:', error);
    res.status(500).json({ 
      error: error.message || 'Error al guardar los datos',
      solucion: 'Verifica que la base de datos PostgreSQL esté funcionando correctamente'
    });
  }
});

// ========================================
// ENDPOINT DE IMPORTACIÓN INVENTARIO FÍSICO - CON FILTRO Y CONVERSIÓN
// ========================================
app.post('/api/importar/inventario-fisico', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }
    console.log('📦 Procesando archivo Inventario Físico...');

    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    console.log(`📋 Columnas encontradas: ${headers.join(', ')}`);
    console.log(`📊 Total de filas: ${data.length}`);

    const buscarColumna = (nombresBusqueda) => {
      for (const nombreBuscado of nombresBusqueda) {
        const coincidencia = headers.find(h => 
          h && h.toString().toLowerCase().includes(nombreBuscado.toLowerCase())
        );
        if (coincidencia) return coincidencia;
      }
      return null;
    };

    const colItemNo = buscarColumna(['ItemNo_ItemJournalLine', 'ItemNo', 'Item No', 'Item Number']);
    const colBinCode = buscarColumna(['BinCode_ItemJournalLine', 'BinCode', 'Bin Code', 'Location Code']);
    const colLotNo = buscarColumna(['ReservEntryBufferLotNo', 'LotNo', 'Lot No', 'Lot Number', 'Serial No']);
    const colQtyBase = buscarColumna(['ReservEntryBufferQtyBase', 'QtyBase', 'Quantity Base', 'Quantity', 'Qty']);

    if (!colItemNo || !colBinCode || !colLotNo || !colQtyBase) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers,
        columnas_requeridas: {
          ItemNo_ItemJournalLine: colItemNo ? '✓' : '✗',
          BinCode_ItemJournalLine: colBinCode ? '✓' : '✗',
          ReservEntryBufferLotNo: colLotNo ? '✓' : '✗',
          ReservEntryBufferQtyBase: colQtyBase ? '✓' : '✗'
        }
      });
    }

    const inventario = [];
    let errores = [];
    let filtradosPapel = 0;
    let conversionesRealizadas = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const itemNo = (row[colItemNo] || '').toString().trim();
        
        // ✅ FILTRO: Excluir items que empiezan por 'Y' (papel)
        if (itemNo.startsWith('Y')) {
          filtradosPapel++;
          continue;
        }

        const binCode = (row[colBinCode] || '').toString().trim();
        const lotNo = (row[colLotNo] || '').toString().trim();
        const qtyBaseCajas = parseFloat(row[colQtyBase]) || 0;

        // ✅ CONVERSIÓN: Cajas → Cápsulas según generación
        let qtyBaseCapsulas = qtyBaseCajas;
        let generacion = 'Desconocida';
        
        if (itemNo.startsWith('AL')) {
          // Generación 1: 16.380 cápsulas por caja
          qtyBaseCapsulas = qtyBaseCajas * 16380;
          generacion = 'G1';
          conversionesRealizadas++;
        } else if (itemNo.startsWith('AC')) {
          // Generación 2: 15.600 cápsulas por caja
          qtyBaseCapsulas = qtyBaseCajas * 15600;
          generacion = 'G2';
          conversionesRealizadas++;
        }

        if (itemNo && binCode && qtyBaseCapsulas > 0) {
          inventario.push({
            fila: i + 2,
            ItemNo_ItemJournalLine: itemNo,
            BinCode_ItemJournalLine: binCode,
            ReservEntryBufferLotNo: lotNo,
            ReservEntryBufferQtyBase: qtyBaseCapsulas,
            generacion: generacion
          });
        }
      } catch (error) {
        errores.push({
          fila: i + 2,
          error: error.message,
          datos: {
            ItemNo: row[colItemNo],
            BinCode: row[colBinCode],
            QtyBase: row[colQtyBase]
          }
        });
      }
    }

    console.log(`✅ Procesados: ${inventario.length} registros válidos`);
    console.log(`   - Filtrados (papel 'Y'): ${filtradosPapel}`);
    console.log(`   - Conversiones realizadas: ${conversionesRealizadas}`);
    console.log(`   - Errores: ${errores.length}`);

    res.json({
      success: true,
      message: `Archivo procesado exitosamente. ${filtradosPapel} items de papel excluidos. ${conversionesRealizadas} conversiones realizadas.`,
      estadisticas: {
        total_filas: data.length,
        registros_extraidos: inventario.length,
        filtrados_papel: filtradosPapel,
        conversiones_realizadas: conversionesRealizadas,
        errores: errores.length
      },
      inventario: inventario,
      detallesErrores: errores.slice(0, 10)
    });
  } catch (error) {
    console.error('❌ Error procesando Excel:', error);
    res.status(500).json({
      error: 'Error procesando archivo Excel',
      detalle: error.message
    });
  }
});

// ========================================
// GUARDAR DATOS DE INVENTARIO EN BASE DE DATOS (EVITA DUPLICADOS)
// ========================================
app.post('/api/inventario/guardar', async (req, res) => {
  try {
    const { inventario, nombreArchivo, usuario = 'system' } = req.body;
    
    if (!inventario || !Array.isArray(inventario)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // ✅ GUARDAR EN POSTGRESQL (evita duplicados por usuario)
    const resultado = await guardarInventarioFisico(inventario, usuario);

    res.json({
      success: true,
      message: resultado.mensaje,
      estadisticas: {
        procesados: inventario.length,
        guardados: resultado.guardados,
        errores: resultado.errores || 0,
        filtrados_papel: inventario.filter(i => (i.ItemNo_ItemJournalLine || '').startsWith('Y')).length
      }
    });
  } catch (error) {
    console.error('Error guardando inventario:', error);
    res.status(500).json({ 
      error: error.message || 'Error al guardar los datos',
      solucion: 'Verifica que la base de datos PostgreSQL esté funcionando correctamente'
    });
  }
});

// ========================================
// ENDPOINTS PARA DASHBOARD EXCEL
// ========================================
app.get('/api/dashboard-excel/resumen', async (req, res) => {
  try {
    const [pedidosPendientes, stockResumen] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total, SUM(qty_pending) as total_cantidad, COUNT(DISTINCT customer_name) as clientes_unicos
        FROM alupak_pedidos WHERE qty_pending > 0 AND usuario_carga = $1
      `, [req.query.usuario || 'system']),
      
      pool.query(`
        SELECT COUNT(DISTINCT item_no) as productos_unicos, SUM(qty_base) as cantidad_total, AVG(qty_base) as promedio_por_item
        FROM inventario_fisico WHERE qty_base > 0 AND usuario_carga = $1
      `, [req.query.usuario || 'system'])
    ]);

    res.json({
      success: true,
      resumen: {
        pedidos: {
          total: parseInt(pedidosPendientes.rows[0]?.total) || 0,
          cantidad_total: parseInt(pedidosPendientes.rows[0]?.total_cantidad) || 0,
          clientes_unicos: parseInt(pedidosPendientes.rows[0]?.clientes_unicos) || 0
        },
        stock: {
          productos_unicos: parseInt(stockResumen.rows[0]?.productos_unicos) || 0,
          cantidad_total: parseInt(stockResumen.rows[0]?.cantidad_total) || 0,
          promedio_por_item: parseFloat(stockResumen.rows[0]?.promedio_por_item) || 0
        },
        ultima_actualizacion: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en resumen dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard-excel/pedidos', async (req, res) => {
  try {
    const pedidos = await pool.query(`
      SELECT 
        a.id, a.customer_name, a.no_sales_line, a.qty_pending, a.fecha_importacion,
        a.archivo_original, a.usuario_carga,
        (SELECT COALESCE(SUM(qty_base), 0) FROM inventario_fisico i 
         WHERE i.item_no = a.no_sales_line AND i.usuario_carga = $1) as stock_disponible,
        CASE 
          WHEN (SELECT COALESCE(SUM(qty_base), 0) FROM inventario_fisico i 
                WHERE i.item_no = a.no_sales_line AND i.usuario_carga = $1) < a.qty_pending 
          THEN 'stock_insuficiente' 
          ELSE 'stock_suficiente' 
        END as estado_stock
      FROM alupak_pedidos a
      WHERE a.qty_pending > 0 AND a.usuario_carga = $1
      ORDER BY a.fecha_importacion DESC
    `, [req.query.usuario || 'system']);

    res.json({
      success: true,
      pedidos: pedidos.rows,
      total: pedidos.rows.length
    });
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard-excel/stock', async (req, res) => {
  try {
    const stock = await pool.query(`
      SELECT 
        i.id, i.item_no, i.bin_code, i.lot_no, i.qty_base, i.fecha_importacion,
        i.archivo_original, i.tipo_registro, i.of_numero, i.lote_numero, i.usuario_carga,
        CASE 
          WHEN i.item_no LIKE 'AL%' THEN 'G1'
          WHEN i.item_no LIKE 'AC%' THEN 'G2'
          ELSE 'Desconocida'
        END as generacion
      FROM inventario_fisico i
      WHERE i.qty_base > 0 
        AND (i.item_no IS NULL OR i.item_no NOT LIKE 'Y%')
        AND i.usuario_carga = $1
      ORDER BY i.qty_base ASC
    `, [req.query.usuario || 'system']);

    const totales = {
      total_items: stock.rows.length,
      total_cantidad: stock.rows.reduce((sum, item) => sum + (item.qty_base || 0), 0),
      g1_items: stock.rows.filter(s => s.generacion === 'G1').length,
      g2_items: stock.rows.filter(s => s.generacion === 'G2').length
    };

    res.json({
      success: true,
      stock: stock.rows,
      totales: totales
    });
  } catch (error) {
    console.error('Error obteniendo stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENDPOINT PARA OBTENER HISTORIAL DE IMPORTACIONES
// ========================================
app.get('/api/historial-importaciones', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const historial = await pool.query(`
      SELECT 
        id, tipo, nombre_archivo, filas_procesadas, filas_guardadas, 
        usuario, fecha_importacion
      FROM historial_importaciones
      WHERE usuario = $1
      ORDER BY fecha_importacion DESC
      LIMIT $2
    `, [req.query.usuario || 'system', parseInt(limit)]);

    res.json({
      success: true,
      historial: historial.rows
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// MANEJO DE ERRORES GLOBAL
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Error global:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========================================
// RUTA 404 PARA ENDPOINTS NO ENCONTRADOS
// ========================================
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl,
    available_endpoints: [
      '/api/health',
      '/api/importar/alupak-pedidos',
      '/api/alupak/guardar',
      '/api/importar/inventario-fisico',
      '/api/inventario/guardar',
      '/api/dashboard-excel/resumen',
      '/api/dashboard-excel/pedidos',
      '/api/dashboard-excel/stock',
      '/api/historial-importaciones'
    ]
  });
});

// ========================================
// INICIAR SERVIDOR (BIND A 0.0.0.0 - OBLIGATORIO PARA RENDER)
// ========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Servidor ejecutándose en http://0.0.0.0:' + PORT);
  console.log('✅ Backend listo para recibir peticiones desde Vercel');
  console.log('📊 API REST para Planificador Industrial v1.0');
  console.log('💡 Para probar: https://planificador-industrial-1.onrender.com/api/health');
});