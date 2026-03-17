/**
 * Migration v2: Add completion tracking & audit trail to planes_produccion
 * - estado_finalizado: Boolean flag to mark completed orders (separate from status string)
 * - fecha_finalizado: Timestamp of actual completion
 * - created_at: When plan was created
 * - updated_at: Last modification time
 * - usuario_creador: Audit trail - who created the plan
 * - notas_auditoría: Audit trail - what changed
 * - Index for efficient pagination of completed orders
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Ejecutando Migration v2...');
    await client.query('BEGIN');

    // Check if columns already exist (idempotent)
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'planes_produccion' AND column_name = 'estado_finalizado'
    `);

    if (checkColumns.rows.length === 0) {
      console.log('📝 Añadiendo columnas a planes_produccion...');
      
      await client.query(`
        ALTER TABLE planes_produccion
        ADD COLUMN estado_finalizado BOOLEAN DEFAULT FALSE,
        ADD COLUMN fecha_finalizado TIMESTAMP NULL,
        ADD COLUMN usuario_creador VARCHAR(50) DEFAULT 'sistema',
        ADD COLUMN notas_auditoría TEXT NULL;
      `);

      console.log('✅ Columnas añadidas correctamente');
    } else {
      console.log('ℹ️  Columnas ya existen, omitiendo ALTER TABLE');
    }

    // Check if index exists
    const checkIndex = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'planes_produccion' 
      AND indexname = 'idx_planes_estado_finalizado_fecha'
    `);

    if (checkIndex.rows.length === 0) {
      console.log('📑 Creando índice para paginación...');
      
      await client.query(`
        CREATE INDEX idx_planes_estado_finalizado_fecha 
        ON planes_produccion(estado_finalizado DESC, fecha_finalizado DESC)
        WHERE estado_finalizado = TRUE;
      `);

      console.log('✅ Índice creado correctamente');
    } else {
      console.log('ℹ️  Índice ya existe, omitiendo CREATE INDEX');
    }

    // Set created_at for existing records if NULL
    await client.query(`
      UPDATE planes_produccion 
      SET created_at = COALESCE(created_at, creado_en, CURRENT_TIMESTAMP)
      WHERE created_at IS NULL OR created_at = '1970-01-01'::timestamp;
    `);

    console.log('✅ Valores de created_at actualizados');

    await client.query('COMMIT');
    console.log('🎉 Migration v2 completada exitosamente');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✨ Migration v2 finalizada');
    process.exit(0);
  })
  .catch(error => {
    console.error('🔥 Migration v2 falló:', error);
    process.exit(1);
  });
