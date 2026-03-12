#!/usr/bin/env node

require('dotenv').config();
const { initDatabase, pool } = require('../database');

console.log('🚀 Inicializando base de datos PostgreSQL para Planificador Industrial...\n');

(async () => {
  try {
    // Ejecutar creación de tablas
    await initDatabase();

    console.log('\n📋 Verificando tablas existentes...');
    const tablas = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    tablas.rows.forEach(t => console.log(`  ✅ ${t.table_name}`));

    console.log('\n⚙️ Verificando configuración inicial...');
    const configuraciones = await pool.query(`
      SELECT clave, valor 
      FROM configuracion
      ORDER BY clave;
    `);

    configuraciones.rows.forEach(c => {
      console.log(`  🔧 ${c.clave}: ${c.valor}`);
    });

    console.log('\n🎉 Base de datos PostgreSQL inicializada correctamente.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error durante la inicialización:', error.message);
    process.exit(1);
  }
})();
