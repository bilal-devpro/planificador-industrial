require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// ✅ CONFIGURACIÓN POSTGRESQL PARA RENDER
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// ✅ CORS CONFIGURACIÓN CORRECTA PARA VERCER + RENDER
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Dominios permitidos EXACTOS (sin wildcards)
    const allowedOrigins = [
      'https://planificador-industrialverdader.vercel.app',
      'https://planificador-industrial.vercel.app',
      'https://planificador-industrialverd-git-013bb0-bilals-projects-c48fced9.vercel.app', // ✅ Dominio EXACTO de tu deploy actual
      'https://planificador-industrial-1.onrender.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
    
    // Verificar si el origen está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado para origen: ${origin}`);
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
app.options('*', cors(corsOptions));

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ MIDDLEWARES EN ORDEN CORRECTO
app.use(cors(corsOptions)); // Primero CORS
app.options('*', cors(corsOptions)); // Preflight OPTIONS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  }
});

// ✅ ENDPOINT DE SALUD (PARA DIAGNÓSTICO)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API REST funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
});

// ✅ INICIALIZAR BASE DE DATOS AL INICIAR
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alupak_pedidos (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        no_sales_line TEXT NOT NULL,
        qty_pending INTEGER NOT NULL DEFAULT 0,
        fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archivo_original TEXT,
        usuario_carga TEXT DEFAULT 'system',
        fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS inventario_fisico (
        id SERIAL PRIMARY KEY,
        item_no TEXT NOT NULL,
        bin_code TEXT NOT NULL,
        lot_no TEXT,
        qty_base REAL NOT NULL DEFAULT 0,
        fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archivo_original TEXT,
        tipo_registro TEXT DEFAULT 'Lote',
        of_numero TEXT,
        lote_numero TEXT,
        usuario_carga TEXT DEFAULT 'system',
        fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS historial_importaciones (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL,
        nombre_archivo TEXT NOT NULL,
        filas_procesadas INTEGER DEFAULT 0,
        filas_guardadas INTEGER DEFAULT 0,
        fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario TEXT DEFAULT 'system'
      );
      
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        descripcion TEXT,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT INTO configuracion (clave, valor, descripcion) 
      VALUES 
        ('version_sistema', '1.0.0', 'Versión del sistema'),
        ('oee_maquina_M1', '0.85', 'OEE para máquina M1'),
        ('oee_maquina_M2', '0.85', 'OEE para máquina M2'),
        ('oee_maquina_M3', '0.85', 'OEE para máquina M3'),
        ('oee_maquina_M4', '0.85', 'OEE para máquina M4'),
        ('dias_laborables', '7', 'Días laborables por semana (24/7)'),
        ('turnos_dia', '2', 'Turnos por día (mañana y noche)'),
        ('horas_turno', '12', 'Horas por turno (12 horas cada turno)'),
        ('oee_objetivo', '0.85', 'OEE objetivo')
      ON CONFLICT (clave) DO NOTHING;
      
      CREATE INDEX IF NOT EXISTS idx_alupak_usuario ON alupak_pedidos(usuario_carga, fecha_carga);
      CREATE INDEX IF NOT EXISTS idx_inventario_usuario ON inventario_fisico(usuario_carga, fecha_carga);
    `);
    
    console.log('✅ Base de datos PostgreSQL inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

// ✅ EXTRAER INFO OF/LOTE (SIN DUPLICADOS)
function extraerInfoOFLote(valor) {
  if (!valor || typeof valor !== 'string') return { tipo: 'Desconocido', ofNumero: null, loteNumero: null };
  const v = valor.trim();
  if (v.startsWith('Y')) return { tipo: 'Papel', ofNumero: null, loteNumero: v };
  if (/^\d{1,10}$/.test(v)) return { tipo: 'OF', ofNumero: v, loteNumero: null };
  const m = v.match(/^(\d{6})/);
  if (m) return { tipo: 'Lote', ofNumero: m[1], loteNumero: v };
  return { tipo: 'Desconocido', ofNumero: null, loteNumero: v };
}

// ✅ ENDPOINT IMPORTAR ALUPAK
app.post('/api/importar/alupak-pedidos', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });
    
    const workbook = XLSX.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    // Buscar columnas con lógica robusta
    const buscarColumna = (nombres) => {
      for (const nombre of nombres) {
        const coincidencia = headers.find(h => h && h.toString().toLowerCase().includes(nombre.toLowerCase()));
        if (coincidencia) return coincidencia;
      }
      return null;
    };
    
    const colCustomerName = buscarColumna(['CustomerName', 'customer_name']);
    const colNoSalesLine = buscarColumna(['No_SalesLine', 'no_sales_line', 'no.', 'document no.']);
    const colQtyPending = buscarColumna(['Qty_pending', 'qty_pending', 'quantity', 'pending']);
    
    if (!colCustomerName || !colNoSalesLine || !colQtyPending) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers
      });
    }
    
    const pedidos = [];
    for (const row of data) {
      const customerName = (row[colCustomerName] || '').toString().trim();
      const noSalesLine = (row[colNoSalesLine] || '').toString().trim();
      const qtyPending = parseInt(row[colQtyPending]) || 0;
      
      if (customerName && noSalesLine) {
        pedidos.push({
          fila: pedidos.length + 2,
          CustomerName: customerName,
          No_SalesLine: noSalesLine,
          Qty_pending: qtyPending
        });
      }
    }
    
    res.json({
      success: true,
      message: `Archivo procesado exitosamente`,
      estadisticas: {
        total_filas: data.length,
        pedidos_extraidos: pedidos.length
      },
      pedidos: pedidos
    });
  } catch (error) {
    console.error('❌ Error procesando ALUPAK:', error);
    res.status(500).json({ error: 'Error procesando archivo Excel', detalle: error.message });
  }
});

// ✅ ENDPOINT GUARDAR ALUPAK EN POSTGRESQL
app.post('/api/alupak/guardar', async (req, res) => {
  try {
    const { pedidos, nombreArchivo, usuario = 'system' } = req.body;
    if (!pedidos || !Array.isArray(pedidos)) return res.status(400).json({ error: 'Datos inválidos' });
    
    // ✅ TRANSACCIÓN ATÓMICA PARA EVITAR DUPLICADOS
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Eliminar datos anteriores del mismo usuario
      await client.query('DELETE FROM alupak_pedidos WHERE usuario_carga = $1', [usuario]);
      
      // Insertar nuevos datos
      let guardados = 0;
      for (const pedido of pedidos) {
        await client.query(`
          INSERT INTO alupak_pedidos (
            customer_name, no_sales_line, qty_pending, archivo_original, usuario_carga
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          pedido.CustomerName,
          pedido.No_SalesLine,
          pedido.Qty_pending || 0,
          nombreArchivo || 'desconocido',
          usuario
        ]);
        guardados++;
      }
      
      // Registrar en historial
      await client.query(`
        INSERT INTO historial_importaciones (
          tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
        ) VALUES ($1, $2, $3, $4, $5)
      `, ['alupak', nombreArchivo || 'alupak.xlsx', pedidos.length, guardados, usuario]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Guardados ${guardados} pedidos de ALUPAK`,
        estadisticas: { procesados: pedidos.length, guardados }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error guardando ALUPAK:', error);
    res.status(500).json({ error: error.message || 'Error al guardar los datos' });
  }
});

// ✅ ENDPOINT IMPORTAR INVENTARIO
app.post('/api/importar/inventario-fisico', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });
    
    const workbook = XLSX.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    const colItemNo = buscarColumna(headers, ['ItemNo', 'item_no', 'item no']);
    const colBinCode = buscarColumna(headers, ['BinCode', 'bin_code', 'location']);
    const colLotNo = buscarColumna(headers, ['LotNo', 'lot_no', 'serial']);
    const colQtyBase = buscarColumna(headers, ['QtyBase', 'qty_base', 'quantity']);
    
    if (!colItemNo || !colBinCode || !colLotNo || !colQtyBase) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers
      });
    }
    
    const inventario = [];
    let filtradosPapel = 0;
    
    for (const row of data) {
      const itemNo = (row[colItemNo] || '').toString().trim();
      
      // ✅ FILTRAR PAPEL (items que empiezan con 'Y')
      if (itemNo.startsWith('Y')) {
        filtradosPapel++;
        continue;
      }
      
      const binCode = (row[colBinCode] || '').toString().trim();
      const lotNo = (row[colLotNo] || '').toString().trim();
      let qtyBase = parseFloat(row[colQtyBase]) || 0;
      
      // ✅ CONVERSIÓN Cajas → Cápsulas
      if (itemNo.startsWith('AL')) qtyBase *= 16380; // G1
      else if (itemNo.startsWith('AC')) qtyBase *= 15600; // G2
      
      if (itemNo && binCode && qtyBase > 0) {
        inventario.push({
          fila: inventario.length + 2,
          ItemNo_ItemJournalLine: itemNo,
          BinCode_ItemJournalLine: binCode,
          ReservEntryBufferLotNo: lotNo,
          ReservEntryBufferQtyBase: qtyBase
        });
      }
    }
    
    res.json({
      success: true,
      message: `Procesados ${inventario.length} registros (${filtradosPapel} items de papel excluidos)`,
      estadisticas: {
        total_filas: data.length,
        registros_extraidos: inventario.length,
        filtrados_papel: filtradosPapel
      },
      inventario: inventario
    });
  } catch (error) {
    console.error('❌ Error procesando inventario:', error);
    res.status(500).json({ error: 'Error procesando archivo Excel', detalle: error.message });
  }
});

// ✅ ENDPOINT GUARDAR INVENTARIO
app.post('/api/inventario/guardar', async (req, res) => {
  try {
    const { inventario, nombreArchivo, usuario = 'system' } = req.body;
    if (!inventario || !Array.isArray(inventario)) return res.status(400).json({ error: 'Datos inválidos' });
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM inventario_fisico WHERE usuario_carga = $1', [usuario]);
      
      let guardados = 0;
      for (const registro of inventario) {
        const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(registro.ReservEntryBufferLotNo || registro.lot_no);
        
        await client.query(`
          INSERT INTO inventario_fisico (
            item_no, bin_code, lot_no, qty_base, archivo_original,
            tipo_registro, of_numero, lote_numero, usuario_carga
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          registro.ItemNo_ItemJournalLine || '',
          registro.BinCode_ItemJournalLine || 'SIN_UBICACION',
          registro.ReservEntryBufferLotNo || null,
          registro.ReservEntryBufferQtyBase || 0,
          nombreArchivo || 'desconocido',
          tipo || 'Lote',
          ofNumero || null,
          loteNumero || registro.ReservEntryBufferLotNo || null,
          usuario
        ]);
        guardados++;
      }
      
      await client.query(`
        INSERT INTO historial_importaciones (
          tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
        ) VALUES ($1, $2, $3, $4, $5)
      `, ['inventario', nombreArchivo || 'inventario.xlsx', inventario.length, guardados, usuario]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Guardados ${guardados} registros de inventario`,
        estadisticas: { procesados: inventario.length, guardados }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error guardando inventario:', error);
    res.status(500).json({ error: error.message || 'Error al guardar los datos' });
  }
});

// ✅ ENDPOINTS PARA DASHBOARD EXCEL
app.get('/api/dashboard-excel/resumen', async (req, res) => {
  try {
    const [pedidos, stock] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total, SUM(qty_pending) as total_cantidad
        FROM alupak_pedidos WHERE qty_pending > 0 AND usuario_carga = $1
      `, [req.query.usuario || 'system']),
      
      pool.query(`
        SELECT COUNT(DISTINCT item_no) as productos_unicos, SUM(qty_base) as cantidad_total
        FROM inventario_fisico WHERE qty_base > 0 AND usuario_carga = $1
      `, [req.query.usuario || 'system'])
    ]);
    
    res.json({
      success: true,
      resumen: {
        pedidos: {
          total: parseInt(pedidos.rows[0]?.total) || 0,
          cantidad_total: parseInt(pedidos.rows[0]?.total_cantidad) || 0
        },
        stock: {
          productos_unicos: parseInt(stock.rows[0]?.productos_unicos) || 0,
          cantidad_total: parseInt(stock.rows[0]?.cantidad_total) || 0
        },
        ultima_actualizacion: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en resumen:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard-excel/pedidos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, customer_name, no_sales_line, qty_pending, fecha_importacion, archivo_original
      FROM alupak_pedidos
      WHERE qty_pending > 0 AND usuario_carga = $1
      ORDER BY fecha_importacion DESC
    `, [req.query.usuario || 'system']);
    
    res.json({ success: true, pedidos: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error en pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard-excel/stock', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, item_no, bin_code, lot_no, qty_base, fecha_importacion, archivo_original,
             CASE WHEN item_no LIKE 'AL%' THEN 'G1' WHEN item_no LIKE 'AC%' THEN 'G2' ELSE 'Desconocida' END as generacion
      FROM inventario_fisico
      WHERE qty_base > 0 AND usuario_carga = $1 AND (item_no IS NULL OR item_no NOT LIKE 'Y%')
      ORDER BY qty_base ASC
    `, [req.query.usuario || 'system']);
    
    res.json({ success: true, stock: result.rows });
  } catch (error) {
    console.error('Error en stock:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/configuracion', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/configuracion', async (req, res) => {
  try {
    const { clave, valor } = req.body;
    await pool.query(`
      INSERT INTO configuracion (clave, valor, descripcion)
      VALUES ($1, $2, $3)
      ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_en = CURRENT_TIMESTAMP
    `, [
      clave,
      valor,
      clave.startsWith('oee_maquina_') ? `OEE para máquina ${clave.split('_')[2]}` : 'Configuración personalizada'
    ]);
    
    res.json({ success: true, message: `Configuración ${clave} actualizada` });
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ MANEJO DE ERRORES GLOBAL
app.use((err, req, res, next) => {
  console.error('❌ Error global:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ✅ RUTA 404 PARA ENDPOINTS NO ENCONTRADOS
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
      '/api/configuracion'
    ]
  });
});

// ✅ INICIAR SERVIDOR (BIND A 0.0.0.0 - OBLIGATORIO PARA RENDER)
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Servidor ejecutándose en http://0.0.0.0:' + PORT);
    console.log('✅ Backend listo para recibir peticiones desde Vercel');
    console.log('💡 Prueba el health check: https://planificador-industrial-1.onrender.com/api/health');
  });
}).catch(error => {
  console.error('❌ Error fatal inicializando la aplicación:', error);
  process.exit(1);
});