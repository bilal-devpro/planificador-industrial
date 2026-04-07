/**
 * Script de migración para la tabla planes_produccion
 * Se ejecuta automáticamente al iniciar el backend
 */

const { pool } = require('../database');

async function migratePlanesProduccion() {
  try {
    console.log('🔧 Ejecutando migración de planes_produccion...');

    // Eliminar tabla si existe (para empezar desde cero)
    await pool.query('DROP TABLE IF EXISTS planes_produccion CASCADE');
    console.log('🗑️  Tabla planes_produccion eliminada (si existía)');

    // Crear nueva tabla con estructura correcta
    await pool.query(`
      CREATE TABLE planes_produccion (
        id SERIAL PRIMARY KEY,
        alupak_pedido_id INTEGER NOT NULL,
        cantidad_planificada INTEGER NOT NULL DEFAULT 0,
        maquina_asignada VARCHAR(10) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE,
        estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
        oee_aplicado DECIMAL(3,2) DEFAULT 0.85,
        observaciones TEXT,
        tiempo_estimado_min INTEGER DEFAULT 0,
        generacion VARCHAR(5) DEFAULT 'G1',
        prioridad VARCHAR(2) DEFAULT '3',
        es_manual BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla planes_produccion creada correctamente');

    // Crear índices para búsquedas rápidas
    await pool.query('CREATE INDEX idx_planes_pedido ON planes_produccion(alupak_pedido_id)');
    await pool.query('CREATE INDEX idx_planes_estado ON planes_produccion(estado)');
    await pool.query('CREATE INDEX idx_planes_maquina ON planes_produccion(maquina_asignada)');
    console.log('✅ Índices creados correctamente');

    console.log('🎉 Migración de planes_produccion completada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error en migración de planes_produccion:', error.message);
    return false;
  }
}

module.exports = { migratePlanesProduccion };