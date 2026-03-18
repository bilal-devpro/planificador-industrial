const { Pool } = require('pg');

const dbConfig = {
  host: 'dpg-d6ntf495pdvs73ftn54g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'planificador_db_j33z',
  user: 'planificador_db_j33z_user',
  password: 'scNosIHVNoqalO6JGeF2pZJz36C5gPdt',
  ssl: { rejectUnauthorized: false }
};

async function testConnection() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Probando conexión a la base de datos...');
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a PostgreSQL');
    client.release();
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();