const http = require('http');

function testEndpoint() {
  const data = JSON.stringify({
    alupak_pedido_id: 1,
    cantidad_planificada: 1000,
    maquina_asignada: 'M1',
    fecha_inicio: '2024-01-01'
  });

  const options = {
    hostname: 'localhost',
    port: 10000,
    path: '/api/produccion/plan',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Respuesta:', responseData);
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.write(data);
  req.end();
}

testEndpoint();
