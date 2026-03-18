const fetch = require('node-fetch');

async function testProductionEndpoint() {
  try {
    console.log('🔍 Probando endpoint de producción corregido...');
    
    // Probar GET (listado de planes)
    console.log('1. Probando GET /api/produccion/plan?page=1&limit=10');
    const getResponse = await fetch('http://localhost:10000/api/produccion/plan?page=1&limit=10');
    const getData = await getResponse.json();
    console.log('Status:', getResponse.status);
    console.log('Planes encontrados:', getData.data ? getData.data.length : 0);
    console.log('---');
    
    // Si hay planes existentes, probar actualización
    if (getData.data && getData.data.length > 0) {
      const planToUpdate = getData.data[0];
      console.log('2. Probando actualización de plan existente (ID:', planToUpdate.id, ')');
      
      const updateData = {
        id: planToUpdate.id,
        cantidad_planificada: planToUpdate.cantidad_planificada + 100,
        maquina_asignada: planToUpdate.maquina_asignada || 'M1',
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado: planToUpdate.estado || 'Requiere producción',
        observaciones: 'Actualización de prueba',
        oee_aplicado: 0.85
      };
      
      const updateResponse = await fetch('http://localhost:10000/api/produccion/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      const updateResult = await updateResponse.json();
      console.log('Status:', updateResponse.status);
      console.log('Resultado:', updateResult);
      console.log('---');
    }
    
    // Probar creación de nuevo plan (si hay pedidos disponibles)
    console.log('3. Probando creación de nuevo plan');
    const createData = {
      alupak_pedido_id: 1, // ID de pedido existente
      cantidad_planificada: 500,
      maquina_asignada: 'M1',
      fecha_inicio: new Date().toISOString().split('T')[0],
      estado: 'Requiere producción',
      observaciones: 'Plan de prueba',
      oee_aplicado: 0.85
    };
    
    const createResponse = await fetch('http://localhost:10000/api/produccion/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData)
    });
    
    const createResult = await createResponse.json();
    console.log('Status:', createResponse.status);
    console.log('Resultado:', createResult);
    console.log('---');
    
    // Probar GET de plan específico
    if (createResult.success && createResult.plan) {
      console.log('4. Probando GET /api/produccion/plan/:id');
      const planId = createResult.plan.id;
      const getPlanResponse = await fetch(`http://localhost:10000/api/produccion/plan/${planId}`);
      const getPlanData = await getPlanResponse.json();
      console.log('Status:', getPlanResponse.status);
      console.log('Plan encontrado:', getPlanData.success);
      console.log('---');
    }
    
    console.log('✅ Prueba completa exitosa!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testProductionEndpoint();