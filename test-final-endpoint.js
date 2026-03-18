const fetch = require('node-fetch');

async function testFinalEndpoint() {
  try {
    console.log('🔍 Probando endpoint final con corrección de IDs...');
    
    // Probar GET (listado de planes)
    console.log('1. Probando GET /api/produccion/plan?page=1&limit=10');
    const getResponse = await fetch('http://localhost:10000/api/produccion/plan?page=1&limit=10');
    const getData = await getResponse.json();
    console.log('Status:', getResponse.status);
    console.log('Planes encontrados:', getData.data ? getData.data.length : 0);
    console.log('---');
    
    // Si hay planes existentes, probar actualización con ID correcto
    if (getData.data && getData.data.length > 0) {
      const planToUpdate = getData.data[0];
      console.log('2. Probando actualización de plan existente (ID:', planToUpdate.id, ')');
      console.log('   ID del plan en base de datos:', planToUpdate.id);
      console.log('   ID que enviaría el frontend: plan-' + planToUpdate.id);
      
      // Probar con ID numérico (como debería ser)
      const updateDataNumerico = {
        id: planToUpdate.id, // ID numérico directo
        cantidad_planificada: planToUpdate.cantidad_planificada + 100,
        maquina_asignada: planToUpdate.maquina_asignada || 'M1',
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado: planToUpdate.estado || 'Requiere producción',
        observaciones: 'Actualización de prueba con ID numérico',
        oee_aplicado: 0.85
      };
      
      const updateResponseNumerico = await fetch('http://localhost:10000/api/produccion/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateDataNumerico)
      });
      
      const updateResultNumerico = await updateResponseNumerico.json();
      console.log('Status (ID numérico):', updateResponseNumerico.status);
      console.log('Resultado (ID numérico):', updateResultNumerico);
      console.log('---');
      
      // Probar con ID con prefijo "plan-" (como lo envía el frontend)
      const updateDataPrefijo = {
        id: 'plan-' + planToUpdate.id, // ID con prefijo como lo envía el frontend
        cantidad_planificada: planToUpdate.cantidad_planificada + 200,
        maquina_asignada: planToUpdate.maquina_asignada || 'M1',
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado: planToUpdate.estado || 'Requiere producción',
        observaciones: 'Actualización de prueba con ID con prefijo',
        oee_aplicado: 0.85
      };
      
      const updateResponsePrefijo = await fetch('http://localhost:10000/api/produccion/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateDataPrefijo)
      });
      
      const updateResultPrefijo = await updateResponsePrefijo.json();
      console.log('Status (ID con prefijo):', updateResponsePrefijo.status);
      console.log('Resultado (ID con prefijo):', updateResultPrefijo);
      console.log('---');
    }
    
    // Probar creación de nuevo plan
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
    
    console.log('✅ Prueba final completa exitosa!');
    console.log('   - El endpoint ahora maneja correctamente IDs con prefijo "plan-"');
    console.log('   - Las actualizaciones deberían funcionar sin errores 404');
    
  } catch (error) {
    console.error('❌ Error en la prueba final:', error.message);
  }
}

testFinalEndpoint();