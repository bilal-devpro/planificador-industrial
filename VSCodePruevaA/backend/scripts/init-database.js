#!/usr/bin/env node

const { initDatabase, db } = require('../database');

console.log('🚀 Inicializando base de datos para Planificador Industrial v1.0...\n');

try {
  // Inicializar base de datos
  initDatabase();
  
  // Verificar tablas creadas
  console.log('\n📋 Verificando tablas...');
  const tablas = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  tablas.forEach(tabla => {
    console.log(`  ✅ ${tabla.name}`);
  });
  
  // Verificar índices
  console.log('\n📊 Verificando índices...');
  const indices = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' 
    ORDER BY name
  `).all();
  
  indices.forEach(indice => {
    console.log(`  ✅ ${indice.name}`);
  });
  
  // Insertar configuración inicial
  console.log('\n⚙️  Configurando valores iniciales...');
  
  const configuraciones = [
    { clave: 'version_sistema', valor: '1.0.0', descripcion: 'Versión del sistema' },
    { clave: 'oee_objetivo', valor: '0.85', descripcion: 'OEE objetivo general' },
    { clave: 'oee_maquina_M1', valor: '0.85', descripcion: 'OEE para máquina M1' },
    { clave: 'oee_maquina_M2', valor: '0.85', descripcion: 'OEE para máquina M2' },
    { clave: 'oee_maquina_M3', valor: '0.85', descripcion: 'OEE para máquina M3' },
    { clave: 'oee_maquina_M4', valor: '0.85', descripcion: 'OEE para máquina M4' },
    { clave: 'horario_operativo', valor: '24/7', descripcion: 'Horario operativo' },
    { clave: 'cierre_fin_semana', valor: 'sabado_14_domingo_20', descripcion: 'Horario de cierre fin de semana' }
  ];
  
  configuraciones.forEach(config => {
    db.prepare(`
      INSERT OR REPLACE INTO configuracion (clave, valor, descripcion)
      VALUES (?, ?, ?)
    `).run(config.clave, config.valor, config.descripcion);
    console.log(`  ✅ ${config.clave}: ${config.valor}`);
  });
  
  console.log('\n✅ Base de datos inicializada correctamente!');
  console.log('📊 Base de datos lista para producción.');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Error durante la inicialización:', error.message);
  process.exit(1);
}