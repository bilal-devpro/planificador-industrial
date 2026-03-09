const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuración
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'planificador.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Conexión a la base de datos
const db = new Database(DB_PATH, { verbose: console.log });

// Función para inicializar la base de datos
function initDatabase() {
  console.log('🔧 Inicializando base de datos...');
  
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error('❌ Archivo schema.sql no encontrado');
    process.exit(1);
  }
  
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  
  console.log('✅ Base de datos inicializada correctamente');
  return db;
}

// ========================================
// FUNCIONES MEJORADAS PARA EVITAR DUPLICADOS
// ========================================

// Limpiar y guardar datos de  (evita duplicados)
function guardarAlupakPedidos(pedidos, usuario = 'system') {
  try {
    // Iniciar transacción
    const stmt = db.prepare('BEGIN');
    stmt.run();
    
    // Eliminar datos anteriores del mismo usuario (evita duplicados)
    db.prepare('DELETE FROM alupak_pedidos WHERE usuario_carga = ?').run(usuario);
    
    // Insertar nuevos datos
    const insertStmt = db.prepare(`
      INSERT INTO alupak_pedidos (
        customer_name, no_sales_line, qty_pending, archivo_original, usuario_carga, fecha_carga
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    let guardados = 0;
    const errores = [];
    
    for (const pedido of pedidos) {
      try {
        insertStmt.run(
          pedido.CustomerName,
          pedido.No_SalesLine,
          pedido.Qty_pending || 0,
          pedido.archivo_original || 'desconocido',
          usuario
        );
        guardados++;
      } catch (error) {
        errores.push({
          pedido: pedido,
          error: error.message
        });
      }
    }
    
    // Confirmar transacción
    db.prepare('COMMIT').run();
    
    // Registrar en historial
    db.prepare(`
      INSERT INTO historial_importaciones (
        tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      'alupak',
      pedidos[0]?.archivo_original || 'alupak.xlsx',
      pedidos.length,
      guardados,
      usuario
    );
    
    console.log(`✅ Guardados ${guardados} pedidos de ALUPAK`);
    
    return {
      success: true,
      guardados,
      errores: errores.length,
      mensaje: `Guardados ${guardados} pedidos exitosamente`
    };
    
  } catch (error) {
    // Revertir transacción en caso de error
    db.prepare('ROLLBACK').run();
    console.error('Error guardando ALUPAK:', error);
    throw error;
  }
}

// Limpiar y guardar datos de Inventario (evita duplicados)
function guardarInventarioFisico(inventario, usuario = 'system') {
  try {
    // Iniciar transacción
    const stmt = db.prepare('BEGIN');
    stmt.run();
    
    // Eliminar datos anteriores del mismo usuario
    db.prepare('DELETE FROM inventario_fisico WHERE usuario_carga = ?').run(usuario);
    
    // Insertar nuevos datos
    const insertStmt = db.prepare(`
      INSERT INTO inventario_fisico (
        item_no, bin_code, lot_no, qty_base, archivo_original, 
        tipo_registro, of_numero, lote_numero, usuario_carga, fecha_carga
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    let guardados = 0;
    const errores = [];
    
    for (const registro of inventario) {
      try {
        // Extraer información de OF/Lote
        const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(registro.ReservEntryBufferLotNo || registro.lot_no);
        
        insertStmt.run(
          registro.ItemNo_ItemJournalLine || registro.item_no || '',
          registro.BinCode_ItemJournalLine || registro.bin_code || 'SIN_UBICACION',
          registro.ReservEntryBufferLotNo || registro.lot_no || null,
          registro.ReservEntryBufferQtyBase || registro.qty_base || 0,
          registro.archivo_original || 'desconocido',
          tipo || 'Lote',
          ofNumero || null,
          loteNumero || registro.ReservEntryBufferLotNo || null,
          usuario
        );
        guardados++;
      } catch (error) {
        errores.push({
          item_no: registro.ItemNo_ItemJournalLine || 'desconocido',
          error: error.message
        });
      }
    }
    
    // Confirmar transacción
    db.prepare('COMMIT').run();
    
    // Registrar en historial
    db.prepare(`
      INSERT INTO historial_importaciones (
        tipo, nombre_archivo, filas_procesadas, filas_guardadas, usuario
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      'inventario',
      inventario[0]?.archivo_original || 'inventario.xlsx',
      inventario.length,
      guardados,
      usuario
    );
    
    console.log(`✅ Guardados ${guardados} registros de inventario`);
    
    return {
      success: true,
      guardados,
      errores: errores.length,
      mensaje: `Guardados ${guardados} registros exitosamente`
    };
    
  } catch (error) {
    // Revertir transacción en caso de error
    db.prepare('ROLLBACK').run();
    console.error('Error guardando inventario:', error);
    throw error;
  }
}

// Extraer información de OF/Lote
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
  
  // Caso 3: Formato desconocido
  return {
    tipo: 'Desconocido',
    ofNumero: null,
    loteNumero: valorLimpio
  };
}

// Obtener último historial de importaciones
function obtenerHistorialImportaciones(limit = 10) {
  return db.prepare(`
    SELECT 
      id, tipo, nombre_archivo, filas_procesadas, filas_guardadas, 
      usuario, fecha_importacion,
      (SELECT COUNT(*) FROM alupak_pedidos WHERE usuario_carga = hi.usuario AND fecha_carga > hi.fecha_importacion) as pedidos_nuevos,
      (SELECT COUNT(*) FROM inventario_fisico WHERE usuario_carga = hi.usuario AND fecha_carga > hi.fecha_importacion) as inventario_nuevo
    FROM historial_importaciones hi
    ORDER BY fecha_importacion DESC
    LIMIT ?
  `).all(limit);
}

// Obtener datos guardados por usuario
function obtenerDatosGuardados(usuario = null) {
  const params = usuario ? [usuario] : [];
  const whereClause = usuario ? 'WHERE usuario_carga = ?' : '';
  
  const pedidos = db.prepare(`
    SELECT id, customer_name, no_sales_line, qty_pending, fecha_carga, archivo_original
    FROM alupak_pedidos
    ${whereClause}
    ORDER BY fecha_carga DESC
  `).all(...params);
  
  const inventario = db.prepare(`
    SELECT id, item_no, bin_code, lot_no, qty_base, fecha_carga, archivo_original
    FROM inventario_fisico
    ${whereClause}
    ORDER BY fecha_carga DESC
  `).all(...params);
  
  return { pedidos, inventario };
}

// ========================================
// FUNCIONES DE AUDITORÍA Y LOGS
// ========================================

function registrarLog(tabla, accion, datosAnteriores, datosNuevos, usuario = 'system') {
  try {
    const descripcion = `${accion.toUpperCase()} en ${tabla}`;
    db.prepare(`
      INSERT INTO logs_cambios (tabla, accion, datos_anteriores, datos_nuevos, usuario, descripcion)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tabla,
      accion,
      JSON.stringify(datosAnteriores || {}),
      JSON.stringify(datosNuevos || {}),
      usuario,
      descripcion
    );
  } catch (error) {
    console.error('Error registrando log:', error);
  }
}

// Exportar funciones
module.exports = {
  db,
  initDatabase,
  guardarAlupakPedidos,
  guardarInventarioFisico,
  obtenerHistorialImportaciones,
  obtenerDatosGuardados,
  registrarLog,
  extraerInfoOFLote
};