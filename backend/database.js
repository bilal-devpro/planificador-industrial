require('dotenv').config();
const { Pool } = require('pg');

// Configurar pool de conexiones PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Inicializar base de datos
async function initDatabase() {
  try {
    console.log('🔧 Inicializando base de datos PostgreSQL...');
    
    await pool.query(`
      -- TABLA alupak_pedidos
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
      
      -- TABLA inventario_fisico
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
      
      -- TABLA historial_importaciones
      CREATE TABLE IF NOT EXISTS historial_importaciones (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL,
        nombre_archivo TEXT NOT NULL,
        filas_procesadas INTEGER DEFAULT 0,
        filas_guardadas INTEGER DEFAULT 0,
        fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario TEXT DEFAULT 'system'
      );
      
      -- TABLA configuracion
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        descripcion TEXT,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Índices
      CREATE INDEX IF NOT EXISTS idx_alupak_usuario_fecha ON alupak_pedidos(usuario_carga, fecha_carga);
      CREATE INDEX IF NOT EXISTS idx_inventario_usuario_fecha ON inventario_fisico(usuario_carga, fecha_carga);
      CREATE INDEX IF NOT EXISTS idx_alupak_customer ON alupak_pedidos(customer_name);
      CREATE INDEX IF NOT EXISTS idx_inventario_item ON inventario_fisico(item_no);
      CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_importaciones(fecha_importacion DESC);
      
      -- Valores por defecto
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
    `);
    
    console.log('✅ Base de datos PostgreSQL inicializada');
    return pool;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

// Extraer información de OF/Lote (¡SOLO UNA VEZ!)
function extraerInfoOFLote(valor) {
  if (!valor || typeof valor !== 'string') {
    return { tipo: 'Desconocido', ofNumero: null, loteNumero: null };
  }
  
  const valorLimpio = valor.trim();
  
  // Detectar papel (empieza con Y)
  if (valorLimpio.startsWith('Y')) {
    return { tipo: 'Papel', ofNumero: null, loteNumero: valorLimpio };
  }
  
  // Caso 1: Es una OF (número corto ≤ 10 dígitos)
  if (/^\d{1,10}$/.test(valorLimpio)) {
    return {
      tipo: 'OF',
      ofNumero: valorLimpio,
      loteNumero: null
    };
  }
  
  // Caso 2: Es un lote (extraer primeros 6 dígitos como OF)
  const match = valorLimpio.match(/^(\d{6})/);
  if (match) {
    return {
      tipo: 'Lote',
      ofNumero: match[1],
      loteNumero: valorLimpio
    };
  }
  
  return {
    tipo: 'Desconocido',
    ofNumero: null,
    loteNumero: valorLimpio
  };
}

// Guardar datos de ALUPAK (evita duplicados por usuario)
async function guardarAlupakPedidos(pedidos, usuario = 'system') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM alupak_pedidos WHERE usuario_carga = $1', [usuario]);
    
    let guardados = 0;
    const errores = [];
    
    for (const pedido of pedidos) {
      try {
        await client.query(`
          INSERT INTO alupak_pedidos (
            customer_name, no_sales_line, qty_pending, archivo_original, usuario_carga
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          pedido.CustomerName,
          pedido.No_SalesLine,
          pedido.Qty_pending || 0,
          pedido.archivo_original || 'desconocido',
          usuario
        ]);
        guardados++;
      } catch (error) {
        errores.push({ pedido: pedido, error: error.message });
      }
    }
    
    await client.query(`
      INSERT INTO historial_importaciones (
        tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'alupak',
      pedidos[0]?.archivo_original || 'alupak.xlsx',
      pedidos.length,
      guardados,
      usuario
    ]);
    
    await client.query('COMMIT');
    console.log(`✅ Guardados ${guardados} pedidos de ALUPAK`);
    
    return {
      success: true,
      guardados,
      errores: errores.length,
      mensaje: `Guardados ${guardados} pedidos exitosamente`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error guardando ALUPAK:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Guardar datos de Inventario Físico
async function guardarInventarioFisico(inventario, usuario = 'system') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM inventario_fisico WHERE usuario_carga = $1', [usuario]);
    
    let guardados = 0;
    const errores = [];
    
    for (const registro of inventario) {
      try {
        const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(registro.ReservEntryBufferLotNo || registro.lot_no);
        
        await client.query(`
          INSERT INTO inventario_fisico (
            item_no, bin_code, lot_no, qty_base, archivo_original,
            tipo_registro, of_numero, lote_numero, usuario_carga
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          registro.ItemNo_ItemJournalLine || registro.item_no || '',
          registro.BinCode_ItemJournalLine || registro.bin_code || 'SIN_UBICACION',
          registro.ReservEntryBufferLotNo || registro.lot_no || null,
          registro.ReservEntryBufferQtyBase || registro.qty_base || 0,
          registro.archivo_original || 'desconocido',
          tipo || 'Lote',
          ofNumero || null,
          loteNumero || registro.ReservEntryBufferLotNo || null,
          usuario
        ]);
        guardados++;
      } catch (error) {
        errores.push({
          item_no: registro.ItemNo_ItemJournalLine || 'desconocido',
          error: error.message
        });
      }
    }
    
    await client.query(`
      INSERT INTO historial_importaciones (
        tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'inventario',
      inventario[0]?.archivo_original || 'inventario.xlsx',
      inventario.length,
      guardados,
      usuario
    ]);
    
    await client.query('COMMIT');
    console.log(`✅ Guardados ${guardados} registros de inventario`);
    
    return {
      success: true,
      guardados,
      errores: errores.length,
      mensaje: `Guardados ${guardados} registros exitosamente`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error guardando inventario:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Obtener historial de importaciones
async function obtenerHistorialImportaciones(limit = 10) {
  const result = await pool.query(`
    SELECT id, tipo, nombre_archivo, filas_procesadas, filas_guardadas, 
           usuario, fecha_importacion
    FROM historial_importaciones
    ORDER BY fecha_importacion DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

// Obtener datos guardados
async function obtenerDatosGuardados(usuario = null) {
  const whereClause = usuario ? 'WHERE usuario_carga = $1' : '';
  const params = usuario ? [usuario] : [];
  
  const [pedidos, inventario] = await Promise.all([
    pool.query(`
      SELECT id, customer_name, no_sales_line, qty_pending, fecha_carga, archivo_original
      FROM alupak_pedidos
      ${whereClause}
      ORDER BY fecha_carga DESC
    `, params),
    
    pool.query(`
      SELECT id, item_no, bin_code, lot_no, qty_base, fecha_carga, archivo_original
      FROM inventario_fisico
      ${whereClause}
      ORDER BY fecha_carga DESC
    `, params)
  ]);
  
  return { pedidos: pedidos.rows, inventario: inventario.rows };
}

module.exports = {
  pool,
  initDatabase,
  guardarAlupakPedidos,
  guardarInventarioFisico,
  obtenerHistorialImportaciones,
  obtenerDatosGuardados,
  extraerInfoOFLote
};