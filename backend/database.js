require('dotenv').config();
const { Pool } = require('pg');

// Configurar pool de conexiones PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// Inicializar base de datos
async function initDatabase() {
  try {
    console.log('🔧 Inicializando base de datos PostgreSQL...');

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

      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        codigo TEXT NOT NULL,
        nombre TEXT NOT NULL
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

      CREATE INDEX IF NOT EXISTS idx_alupak_usuario_fecha 
        ON alupak_pedidos(usuario_carga, fecha_carga);

      CREATE INDEX IF NOT EXISTS idx_inventario_usuario_fecha 
        ON inventario_fisico(usuario_carga, fecha_carga);

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

// Función auxiliar OF/Lote
function extraerInfoOFLote(valor) {
  if (!valor || typeof valor !== 'string')
    return { tipo: 'Desconocido', ofNumero: null, loteNumero: null };

  const v = valor.trim();
  if (v.startsWith('Y')) return { tipo: 'Papel', ofNumero: null, loteNumero: v };
  if (/^\d{1,10}$/.test(v)) return { tipo: 'OF', ofNumero: v, loteNumero: null };

  const m = v.match(/^(\d{6})/);
  if (m) return { tipo: 'Lote', ofNumero: m[1], loteNumero: v };

  return { tipo: 'Desconocido', ofNumero: null, loteNumero: v };
}

// Guardar ALUPAK
async function guardarAlupakPedidos(pedidos, usuario = 'system') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM alupak_pedidos WHERE usuario_carga = $1', [usuario]);

    let guardados = 0;
    for (const p of pedidos) {
      try {
        await client.query(`
          INSERT INTO alupak_pedidos 
          (customer_name, no_sales_line, qty_pending, archivo_original, usuario_carga)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          p.CustomerName,
          p.No_SalesLine,
          p.Qty_pending || 0,
          p.archivo_original || 'desconocido',
          usuario
        ]);
        guardados++;
      } catch (e) {}
    }

    await client.query(`
      INSERT INTO historial_importaciones 
      (tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'alupak',
      pedidos[0]?.archivo_original || 'alupak.xlsx',
      pedidos.length,
      guardados,
      usuario
    ]);

    await client.query('COMMIT');
    return { success: true, guardados };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}

// Guardar inventario
async function guardarInventarioFisico(inventario, usuario = 'system') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM inventario_fisico WHERE usuario_carga = $1', [usuario]);

    let guardados = 0;
    for (const r of inventario) {
      try {
        const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(
          r.ReservEntryBufferLotNo || r.lot_no
        );

        await client.query(`
          INSERT INTO inventario_fisico (
            item_no, bin_code, lot_no, qty_base, archivo_original,
            tipo_registro, of_numero, lote_numero, usuario_carga
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          r.ItemNo_ItemJournalLine || r.item_no || '',
          r.BinCode_ItemJournalLine || r.bin_code || 'SIN_UBICACION',
          r.ReservEntryBufferLotNo || r.lot_no || null,
          r.ReservEntryBufferQtyBase || r.qty_base || 0,
          r.archivo_original || 'desconocido',
          tipo,
          ofNumero,
          loteNumero || r.ReservEntryBufferLotNo || null,
          usuario
        ]);

        guardados++;
      } catch (e) {}
    }

    await client.query(`
      INSERT INTO historial_importaciones 
      (tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'inventario',
      inventario[0]?.archivo_original || 'inventario.xlsx',
      inventario.length,
      guardados,
      usuario
    ]);

    await client.query('COMMIT');
    return { success: true, guardados };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}

async function obtenerHistorialImportaciones(limit = 10) {
  const r = await pool.query(`
    SELECT id, tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario, fecha_importacion
    FROM historial_importaciones
    ORDER BY fecha_importacion DESC
    LIMIT $1
  `, [limit]);

  return r.rows;
}

async function obtenerDatosGuardados(usuario = null) {
  const where = usuario ? 'WHERE usuario_carga = $1' : '';
  const params = usuario ? [usuario] : [];

  const [pedidos, inventario] = await Promise.all([
    pool.query(`SELECT * FROM alupak_pedidos ${where} ORDER BY fecha_carga DESC`, params),
    pool.query(`SELECT * FROM inventario_fisico ${where} ORDER BY fecha_carga DESC`, params)
  ]);

  return {
    pedidos: pedidos.rows,
    inventario: inventario.rows
  };
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
