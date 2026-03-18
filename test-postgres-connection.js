const database = require('./backend/database-prod');

async function testPostgresConnection() {
  try {
    console.log('🔍 Probando conexión PostgreSQL profesional...');
    
    // Probar conexión
    const connected = await database.testConnection();
    if (!connected) {
      console.log('❌ Conexión fallida');
      return;
    }
    
    // Inicializar base de datos
    await database.initDatabase();
    console.log('✅ Base de datos inicializada correctamente');
    
    // Probar endpoint de producción
    console.log('🔍 Probando endpoint de producción...');
    const response = await fetch('http://localhost:10000/api/produccion/plan?page=1&limit=10');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Respuesta:', JSON.stringify(data, null, 2));
    
    // Probar creación de plan
    const newPlan = {
      customer_name: 'Test Customer',
      no_sales_line: 'TEST-001',
      producto_nombre: 'Test Product',
      cantidad_a_producir: 1000,
      linea_asignada: 'L1',
      maquina_asignada: 'M1',
      generacion: 'G1'
    };
    
    const postResponse = await fetch('http://localhost:10000/api/produccion/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newPlan)
    });
    
    const postData = await postResponse.json();
    console.log('POST Status:', postResponse.status);
    console.log('POST Respuesta:', JSON.stringify(postData, null, 2));
    
    console.log('✅ Prueba completa exitosa!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testPostgresConnection();