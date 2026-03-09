const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const { format } = require('date-fns');

const { 
  db, 
  initDatabase, 
  registrarLog, 
  getKPIs, 
  getAlertas, 
  getCargaLineas,
  simularPlan 
} = require('./database');

// Inicializar base de datos
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));  // ✅ Aumentar límite a 5 MB
app.use(express.urlencoded({ extended: true, limit: '5mb' }));  // ✅ También aquí

// Configuración de Multer para subir archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  }
});

// ========================================
// ENDPOINTS - DASHBOARD
// ========================================

app.get('/api/dashboard/kpis', (req, res) => {
  try {
    const kpis = getKPIs();
    res.json({ data: kpis });
  } catch (error) {
    console.error('Error en KPIs:', error);
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
});

app.get('/api/dashboard/alertas', (req, res) => {
  try {
    const alertas = getAlertas();
    res.json({ data: alertas });
  } catch (error) {
    console.error('Error en alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

app.get('/api/dashboard/carga-lineas', (req, res) => {
  try {
    const carga = getCargaLineas();
    res.json({ data: carga });
  } catch (error) {
    console.error('Error en carga de líneas:', error);
    res.status(500).json({ error: 'Error al obtener carga de líneas' });
  }
});

// ========================================
// ENDPOINTS - PEDIDOS
// ========================================

app.get('/api/pedidos', (req, res) => {
  try {
    let query = `
      SELECT 
        p.id,
        p.numero_pedido,
        p.cantidad,
        p.fecha_pedido,
        p.fecha_requerida,
        p.fecha_entrega,
        p.estado,
        p.prioridad,
        p.observaciones,
        c.codigo as cliente_codigo,
        c.nombre as cliente_nombre,
        pr.codigo as producto_codigo,
        pr.nombre as producto_nombre,
        pr.familia as producto_familia
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN productos pr ON p.producto_id = pr.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtros
    if (req.query.estado) {
      query += ' AND p.estado = ?';
      params.push(req.query.estado);
    }
    
    if (req.query.cliente_id) {
      query += ' AND p.cliente_id = ?';
      params.push(req.query.cliente_id);
    }
    
    if (req.query.producto_id) {
      query += ' AND p.producto_id = ?';
      params.push(req.query.producto_id);
    }
    
    if (req.query.fecha_desde) {
      query += ' AND p.fecha_requerida >= ?';
      params.push(req.query.fecha_desde);
    }
    
    if (req.query.fecha_hasta) {
      query += ' AND p.fecha_requerida <= ?';
      params.push(req.query.fecha_hasta);
    }
    
    query += ' ORDER BY p.prioridad DESC, p.fecha_requerida ASC';
    
    const pedidos = db.prepare(query).all(...params);
    res.json({ data: pedidos });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

app.get('/api/pedidos/:id', (req, res) => {
  try {
    const pedido = db.prepare(`
      SELECT p.*, c.nombre as cliente_nombre, pr.nombre as producto_nombre
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN productos pr ON p.producto_id = pr.id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    res.json({ data: pedido });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

app.post('/api/pedidos', (req, res) => {
  try {
    const { cliente_id, producto_id, cantidad, fecha_requerida, prioridad, observaciones } = req.body;
    
    // Validaciones
    if (!cliente_id || !producto_id || !cantidad || !fecha_requerida) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    // Generar número de pedido único
    const ultimo = db.prepare('SELECT numero_pedido FROM pedidos ORDER BY id DESC LIMIT 1').get();
    const numeroPedido = ultimo 
      ? 'PED-' + (parseInt(ultimo.numero_pedido.split('-')[1]) + 1).toString().padStart(4, '0')
      : 'PED-0001';
    
    const result = db.prepare(`
      INSERT INTO pedidos (
        numero_pedido, cliente_id, producto_id, cantidad, 
        fecha_requerida, prioridad, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      numeroPedido,
      cliente_id,
      producto_id,
      cantidad,
      fecha_requerida,
      prioridad || 3,
      observaciones || ''
    );
    
    registrarLog('pedidos', 'insert', null, { numero_pedido: numeroPedido }, 'system');
    
    res.json({ 
      success: true, 
      message: 'Pedido creado exitosamente',
      data: { id: result.lastInsertRowid, numero_pedido: numeroPedido }
    });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido' });
  }
});

app.put('/api/pedidos/:id', (req, res) => {
  try {
    const { estado, cantidad, fecha_requerida, prioridad, observaciones } = req.body;
    
    const pedidoAnterior = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    
    const result = db.prepare(`
      UPDATE pedidos 
      SET estado = COALESCE(?, estado),
          cantidad = COALESCE(?, cantidad),
          fecha_requerida = COALESCE(?, fecha_requerida),
          prioridad = COALESCE(?, prioridad),
          observaciones = COALESCE(?, observaciones),
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(estado, cantidad, fecha_requerida, prioridad, observaciones, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    registrarLog('pedidos', 'update', pedidoAnterior, req.body, 'system');
    
    res.json({ success: true, message: 'Pedido actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
});

app.post('/api/pedidos/importar', upload.single('archivo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    // Leer archivo Excel
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importados = 0;
    let errores = [];
    const resultados = [];

    for (const row of data) {
      try {
        // Buscar cliente por código o nombre
        let cliente = null;
        if (row.cliente) {
          cliente = db.prepare('SELECT id FROM clientes WHERE codigo = ? OR nombre = ?').get(row.cliente, row.cliente);
        }
        
        // Buscar producto por código o nombre
        let producto = null;
        if (row.producto) {
          producto = db.prepare('SELECT id FROM productos WHERE codigo = ? OR nombre = ?').get(row.producto, row.producto);
        }

        if (!cliente) {
          throw new Error(`Cliente no encontrado: ${row.cliente}`);
        }
        
        if (!producto) {
          throw new Error(`Producto no encontrado: ${row.producto}`);
        }

        // Generar número de pedido
        const ultimo = db.prepare('SELECT numero_pedido FROM pedidos ORDER BY id DESC LIMIT 1').get();
        const numeroPedido = ultimo 
          ? 'PED-' + (parseInt(ultimo.numero_pedido.split('-')[1]) + 1).toString().padStart(4, '0')
          : 'PED-0001';

        // Insertar pedido
        db.prepare(`
          INSERT INTO pedidos (
            numero_pedido, cliente_id, producto_id, cantidad,
            fecha_pedido, fecha_requerida, prioridad, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numeroPedido,
          cliente.id,
          producto.id,
          row.cantidad || 0,
          row.fecha_pedido || format(new Date(), 'yyyy-MM-dd'),
          row.fecha_requerida,
          row.prioridad || 3,
          'pendiente'
        );

        importados++;
        resultados.push({
          fila: importados + errores.length,
          estado: 'exitoso',
          numero_pedido: numeroPedido,
          cliente: row.cliente,
          producto: row.producto
        });

      } catch (error) {
        errores.push({
          fila: importados + errores.length + 1,
          error: error.message,
          datos: row
        });
      }
    }

    res.json({
      success: true,
      message: `Importación completada: ${importados} pedidos importados, ${errores.length} errores`,
      estadisticas: {
        importados,
        errores: errores.length,
        total: data.length
      },
      resultados,
      detallesErrores: errores.slice(0, 10) // Máximo 10 errores detallados
    });

  } catch (error) {
    console.error('Error en importación:', error);
    res.status(500).json({ error: 'Error procesando archivo Excel', detalle: error.message });
  }
});

app.get('/api/pedidos/por-maquina', (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT 
        p.id,
        p.numero_pedido,
        p.cantidad,
        p.fecha_requerida,
        p.estado,
        pr.nombre as producto_nombre,
        l.nombre as linea_nombre,
        l.codigo as linea_codigo
      FROM pedidos p
      JOIN productos pr ON p.producto_id = pr.id
      LEFT JOIN plan_produccion pp ON p.id = pp.pedido_id
      LEFT JOIN lineas l ON pp.linea_id = l.id
      WHERE p.estado = 'pendiente'
      ORDER BY l.nombre, p.fecha_requerida
    `).all();

    res.json({ data: pedidos });
  } catch (error) {
    console.error('Error al obtener pedidos por máquina:', error);
    res.status(500).json({ error: 'Error al obtener pedidos por máquina' });
  }
});

// ========================================
// ENDPOINTS - PLAN DE PRODUCCIÓN
// ========================================

app.get('/api/plan/versiones', (req, res) => {
  try {
    const versiones = db.prepare(`
      SELECT *, 
        (SELECT COUNT(*) FROM plan_produccion WHERE version_id = pv.id) as ordenes_count
      FROM plan_versiones pv
      ORDER BY fecha_creacion DESC
    `).all();
    
    res.json({ data: versiones });
  } catch (error) {
    console.error('Error al obtener versiones:', error);
    res.status(500).json({ error: 'Error al obtener versiones' });
  }
});

app.post('/api/plan/versiones', (req, res) => {
  try {
    const { nombre, descripcion, creado_por } = req.body;
    
    const result = db.prepare(`
      INSERT INTO plan_versiones (nombre, descripcion, creado_por)
      VALUES (?, ?, ?)
    `).run(nombre, descripcion || '', creado_por || 'system');
    
    res.json({ 
      success: true, 
      message: 'Versión creada exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear versión:', error);
    res.status(500).json({ error: 'Error al crear versión' });
  }
});

app.put('/api/plan/versiones/:id/estado', (req, res) => {
  try {
    const { estado, aprobado_por } = req.body;
    
    const result = db.prepare(`
      UPDATE plan_versiones 
      SET estado = ?, 
          aprobado_por = COALESCE(?, aprobado_por),
          fecha_aprobacion = CASE WHEN ? = 'aprobado' THEN CURRENT_TIMESTAMP ELSE fecha_aprobacion END
      WHERE id = ?
    `).run(estado, aprobado_por, estado, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Versión no encontrada' });
    }
    
    res.json({ success: true, message: 'Estado actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

app.get('/api/plan/produccion', (req, res) => {
  try {
    let query = `
      SELECT 
        pp.id,
        pp.version_id,
        pp.pedido_id,
        pp.cantidad,
        pp.cantidad_producida,
        pp.merma,
        pp.fecha_inicio,
        pp.fecha_fin,
        pp.turno,
        pp.estado,
        pp.oee,
        pp.observaciones,
        pv.nombre as version_nombre,
        p.numero_pedido,
        pr.codigo as producto_codigo,
        pr.nombre as producto_nombre,
        l.codigo as linea_codigo,
        l.nombre as linea_nombre,
        l.capacidad_hora
      FROM plan_produccion pp
      LEFT JOIN plan_versiones pv ON pp.version_id = pv.id
      LEFT JOIN pedidos p ON pp.pedido_id = p.id
      JOIN productos pr ON pp.producto_id = pr.id
      JOIN lineas l ON pp.linea_id = l.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (req.query.version_id) {
      query += ' AND pp.version_id = ?';
      params.push(req.query.version_id);
    }
    
    if (req.query.linea_id) {
      query += ' AND pp.linea_id = ?';
      params.push(req.query.linea_id);
    }
    
    if (req.query.estado) {
      query += ' AND pp.estado = ?';
      params.push(req.query.estado);
    }
    
    if (req.query.fecha_desde) {
      query += ' AND pp.fecha_inicio >= ?';
      params.push(req.query.fecha_desde);
    }
    
    if (req.query.fecha_hasta) {
      query += ' AND pp.fecha_inicio <= ?';
      params.push(req.query.fecha_hasta);
    }
    
    query += ' ORDER BY pp.fecha_inicio, l.nombre';
    
    const ordenes = db.prepare(query).all(...params);
    res.json({ data: ordenes });
  } catch (error) {
    console.error('Error al obtener plan de producción:', error);
    res.status(500).json({ error: 'Error al obtener plan de producción' });
  }
});

app.post('/api/plan/produccion', (req, res) => {
  try {
    const { 
      version_id, 
      pedido_id, 
      producto_id, 
      linea_id, 
      cantidad, 
      fecha_inicio, 
      fecha_fin, 
      turno 
    } = req.body;
    
    const result = db.prepare(`
      INSERT INTO plan_produccion (
        version_id, pedido_id, producto_id, linea_id,
        cantidad, fecha_inicio, fecha_fin, turno
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      version_id || null,
      pedido_id || null,
      producto_id,
      linea_id,
      cantidad,
      fecha_inicio,
      fecha_fin,
      turno || 'mañana'
    );
    
    res.json({ 
      success: true, 
      message: 'Orden de producción creada exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({ error: 'Error al crear orden de producción' });
  }
});

app.put('/api/plan/produccion/:id', (req, res) => {
  try {
    const { 
      cantidad_producida, 
      merma, 
      estado, 
      oee, 
      observaciones 
    } = req.body;
    
    const result = db.prepare(`
      UPDATE plan_produccion 
      SET cantidad_producida = COALESCE(?, cantidad_producida),
          merma = COALESCE(?, merma),
          estado = COALESCE(?, estado),
          oee = COALESCE(?, oee),
          observaciones = COALESCE(?, observaciones),
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cantidad_producida, merma, estado, oee, observaciones, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json({ success: true, message: 'Orden actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar orden:', error);
    res.status(500).json({ error: 'Error al actualizar orden' });
  }
});

app.delete('/api/plan/produccion/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM plan_produccion WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json({ success: true, message: 'Orden eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    res.status(500).json({ error: 'Error al eliminar orden' });
  }
});

app.post('/api/plan/simular', (req, res) => {
  try {
    const resultado = simularPlan();
    res.json({ data: resultado });
  } catch (error) {
    console.error('Error en simulación:', error);
    res.status(500).json({ error: 'Error al simular plan' });
  }
});

// ========================================
// ENDPOINTS - STOCK
// ========================================

app.get('/api/stock', (req, res) => {
  try {
    const stock = db.prepare(`
      SELECT 
        s.id,
        s.producto_id,
        s.almacen,
        s.cantidad,
        s.stock_seguridad,
        s.ubicacion,
        p.codigo as producto_codigo,
        p.nombre as producto_nombre,
        p.familia,
        CASE 
          WHEN s.cantidad < s.stock_seguridad THEN 'critico'
          WHEN s.cantidad < s.stock_seguridad * 1.5 THEN 'bajo'
          ELSE 'normal'
        END as nivel_stock
      FROM stock_items s
      JOIN productos p ON s.producto_id = p.id
      ORDER BY nivel_stock DESC, p.nombre
    `).all();
    
    res.json({ data: stock });
  } catch (error) {
    console.error('Error al obtener stock:', error);
    res.status(500).json({ error: 'Error al obtener stock' });
  }
});

app.get('/api/stock/movimientos', (req, res) => {
  try {
    const movimientos = db.prepare(`
      SELECT 
        sm.*,
        p.codigo as producto_codigo,
        p.nombre as producto_nombre
      FROM stock_movimientos sm
      JOIN stock_items si ON sm.stock_item_id = si.id
      JOIN productos p ON si.producto_id = p.id
      ORDER BY sm.fecha DESC
      LIMIT 100
    `).all();
    
    res.json({ data: movimientos });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

app.post('/api/stock/movimiento', (req, res) => {
  try {
    const { stock_item_id, tipo, cantidad, referencia, observaciones, realizado_por } = req.body;
    
    // Validar stock_item_id
    const stockItem = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(stock_item_id);
    if (!stockItem) {
      return res.status(404).json({ error: 'Item de stock no encontrado' });
    }
    
    // Validar cantidad positiva
    if (cantidad <= 0) {
      return res.status(400).json({ error: 'Cantidad debe ser positiva' });
    }
    
    // Para salidas, validar que haya suficiente stock
    if (tipo === 'salida' && stockItem.cantidad < cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }
    
    // Calcular nueva cantidad
    const nuevaCantidad = tipo === 'entrada' 
      ? stockItem.cantidad + cantidad 
      : stockItem.cantidad - cantidad;
    
    // Actualizar stock
    db.prepare('UPDATE stock_items SET cantidad = ? WHERE id = ?').run(nuevaCantidad, stock_item_id);
    
    // Registrar movimiento
    db.prepare(`
      INSERT INTO stock_movimientos (
        stock_item_id, tipo, cantidad, referencia, observaciones, realizado_por
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(stock_item_id, tipo, cantidad, referencia || '', observaciones || '', realizado_por || 'system');
    
    res.json({ 
      success: true, 
      message: 'Movimiento registrado exitosamente',
      data: { nueva_cantidad: nuevaCantidad }
    });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ error: 'Error al registrar movimiento' });
  }
});

// ========================================
// ENDPOINTS - MATERIALES Y MRP
// ========================================

app.get('/api/materiales', (req, res) => {
  try {
    const materiales = db.prepare(`
      SELECT *,
        CASE 
          WHEN stock_actual < stock_seguridad THEN 'critico'
          WHEN stock_actual < stock_seguridad * 1.5 THEN 'bajo'
          ELSE 'normal'
        END as nivel_stock
      FROM materiales
      ORDER BY nivel_stock DESC, nombre
    `).all();
    
    res.json({ data: materiales });
  } catch (error) {
    console.error('Error al obtener materiales:', error);
    res.status(500).json({ error: 'Error al obtener materiales' });
  }
});

app.get('/api/materiales/necesidades', (req, res) => {
  try {
    // Obtener pedidos pendientes
    const pedidos = db.prepare(`
      SELECT p.producto_id, p.cantidad, pr.nombre as producto_nombre
      FROM pedidos p
      JOIN productos pr ON p.producto_id = pr.id
      WHERE p.estado = 'pendiente'
    `).all();
    
    // Obtener BOM (Bill of Materials)
    const bom = db.prepare(`
      SELECT b.producto_id, b.material_id, b.cantidad as cantidad_por_unidad,
             m.nombre as material_nombre, m.stock_actual, m.stock_seguridad
      FROM bom b
      JOIN materiales m ON b.material_id = m.id
    `).all();
    
    // Calcular necesidades
    const necesidades = {};
    
    pedidos.forEach(pedido => {
      const materialesProducto = bom.filter(b => b.producto_id === pedido.producto_id);
      
      materialesProducto.forEach(material => {
        const materialId = material.material_id;
        const cantidadNecesaria = pedido.cantidad * material.cantidad_por_unidad;
        
        if (!necesidades[materialId]) {
          necesidades[materialId] = {
            material_id: materialId,
            material_nombre: material.material_nombre,
            stock_actual: material.stock_actual,
            stock_seguridad: material.stock_seguridad,
            necesidad_total: 0,
            pedidos_que_lo_usan: []
          };
        }
        
        necesidades[materialId].necesidad_total += cantidadNecesaria;
        necesidades[materialId].pedidos_que_lo_usan.push({
          producto: pedido.producto_nombre,
          cantidad: pedido.cantidad
        });
      });
    });
    
    // Calcular faltante
    Object.values(necesidades).forEach(necesidad => {
      necesidad.faltante = Math.max(0, necesidad.necesidad_total - necesidad.stock_actual);
      necesidad.nivel = necesidad.faltante > 0 ? 'critico' : 'suficiente';
    });
    
    res.json({ data: Object.values(necesidades) });
  } catch (error) {
    console.error('Error al calcular necesidades:', error);
    res.status(500).json({ error: 'Error al calcular necesidades' });
  }
});

app.post('/api/materiales', (req, res) => {
  try {
    const { codigo, nombre, descripcion, unidad_medida, stock_seguridad, proveedor, costo_unitario } = req.body;
    
    const result = db.prepare(`
      INSERT INTO materiales (
        codigo, nombre, descripcion, unidad_medida, 
        stock_seguridad, proveedor, costo_unitario
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigo,
      nombre,
      descripcion || '',
      unidad_medida || 'kg',
      stock_seguridad || 0,
      proveedor || '',
      costo_unitario || 0
    );
    
    res.json({ 
      success: true, 
      message: 'Material creado exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear material:', error);
    res.status(500).json({ error: 'Error al crear material' });
  }
});

// ========================================
// ENDPOINTS - MAESTROS (Productos, Líneas, Clientes)
// ========================================

app.get('/api/productos', (req, res) => {
  try {
    const productos = db.prepare('SELECT * FROM productos ORDER BY codigo').all();
    res.json({ data: productos });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/productos', (req, res) => {
  try {
    const { codigo, nombre, descripcion, familia, formato, tiempo_estandar_min, stock_seguridad } = req.body;
    
    const result = db.prepare(`
      INSERT INTO productos (
        codigo, nombre, descripcion, familia, formato,
        tiempo_estandar_min, stock_seguridad
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigo,
      nombre,
      descripcion || '',
      familia || '',
      formato || '',
      tiempo_estandar_min || 0,
      stock_seguridad || 0
    );
    
    res.json({ 
      success: true, 
      message: 'Producto creado exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', (req, res) => {
  try {
    const { nombre, descripcion, familia, formato, tiempo_estandar_min, stock_seguridad } = req.body;
    
    const result = db.prepare(`
      UPDATE productos 
      SET nombre = COALESCE(?, nombre),
          descripcion = COALESCE(?, descripcion),
          familia = COALESCE(?, familia),
          formato = COALESCE(?, formato),
          tiempo_estandar_min = COALESCE(?, tiempo_estandar_min),
          stock_seguridad = COALESCE(?, stock_seguridad),
          actualizado_en = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nombre, descripcion, familia, formato, tiempo_estandar_min, stock_seguridad, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({ success: true, message: 'Producto actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.get('/api/lineas', (req, res) => {
  try {
    const lineas = db.prepare('SELECT * FROM lineas ORDER BY codigo').all();
    res.json({ data: lineas });
  } catch (error) {
    console.error('Error al obtener líneas:', error);
    res.status(500).json({ error: 'Error al obtener líneas' });
  }
});

app.get('/api/clientes', (req, res) => {
  try {
    const clientes = db.prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY codigo').all();
    res.json({ data: clientes });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ========================================
// ENDPOINTS - CALENDARIO Y MANTENIMIENTOS
// ========================================

app.get('/api/calendario/eventos', (req, res) => {
  try {
    let query = `
      SELECT 
        ce.*,
        l.nombre as linea_nombre
      FROM calendario_eventos ce
      LEFT JOIN lineas l ON ce.linea_id = l.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (req.query.fecha_desde) {
      query += ' AND ce.fecha_inicio >= ?';
      params.push(req.query.fecha_desde);
    }
    
    if (req.query.fecha_hasta) {
      query += ' AND ce.fecha_fin <= ?';
      params.push(req.query.fecha_hasta);
    }
    
    if (req.query.tipo) {
      query += ' AND ce.tipo = ?';
      params.push(req.query.tipo);
    }
    
    query += ' ORDER BY ce.fecha_inicio';
    
    const eventos = db.prepare(query).all(...params);
    res.json({ data: eventos });
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

app.post('/api/calendario/eventos', (req, res) => {
  try {
    const { titulo, descripcion, tipo, fecha_inicio, fecha_fin, linea_id, impacto_capacidad } = req.body;
    
    const result = db.prepare(`
      INSERT INTO calendario_eventos (
        titulo, descripcion, tipo, fecha_inicio, fecha_fin,
        linea_id, impacto_capacidad
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      titulo,
      descripcion || '',
      tipo,
      fecha_inicio,
      fecha_fin,
      linea_id || null,
      impacto_capacidad || 0
    );
    
    res.json({ 
      success: true, 
      message: 'Evento creado exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

app.get('/api/mantenimientos', (req, res) => {
  try {
    const mantenimientos = db.prepare(`
      SELECT 
        m.*,
        l.nombre as linea_nombre,
        l.codigo as linea_codigo
      FROM mantenimientos m
      JOIN lineas l ON m.linea_id = l.id
      ORDER BY m.fecha_programada
    `).all();
    
    res.json({ data: mantenimientos });
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    res.status(500).json({ error: 'Error al obtener mantenimientos' });
  }
});

app.post('/api/mantenimientos', (req, res) => {
  try {
    const { 
      codigo, 
      titulo, 
      descripcion, 
      tipo, 
      linea_id, 
      fecha_programada, 
      duracion_horas, 
      responsable 
    } = req.body;
    
    const result = db.prepare(`
      INSERT INTO mantenimientos (
        codigo, titulo, descripcion, tipo, linea_id,
        fecha_programada, duracion_horas, responsable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigo,
      titulo,
      descripcion || '',
      tipo,
      linea_id,
      fecha_programada,
      duracion_horas,
      responsable || ''
    );
    
    res.json({ 
      success: true, 
      message: 'Mantenimiento creado exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    res.status(500).json({ error: 'Error al crear mantenimiento' });
  }
});

// ========================================
// ENDPOINTS - EMPLEADOS
// ========================================

app.get('/api/empleados', (req, res) => {
  try {
    const empleados = db.prepare(`
      SELECT 
        e.*,
        l.nombre as linea_nombre
      FROM empleados e
      LEFT JOIN lineas l ON e.linea_id = l.id
      WHERE e.activo = 1
      ORDER BY e.apellido, e.nombre
    `).all();
    
    res.json({ data: empleados });
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

app.post('/api/empleados', (req, res) => {
  try {
    const { 
      codigo, 
      nombre, 
      apellido, 
      dni, 
      email, 
      telefono, 
      puesto, 
      linea_id, 
      turno_habitual 
    } = req.body;
    
    const result = db.prepare(`
      INSERT INTO empleados (
        codigo, nombre, apellido, dni, email, telefono,
        puesto, linea_id, turno_habitual, fecha_ingreso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
    `).run(
      codigo,
      nombre,
      apellido,
      dni || null,
      email || null,
      telefono || null,
      puesto || null,
      linea_id || null,
      turno_habitual || null
    );
    
    res.json({ 
      success: true, 
      message: 'Empleado creado exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

app.get('/api/ausencias', (req, res) => {
  try {
    const ausencias = db.prepare(`
      SELECT 
        a.*,
        e.nombre,
        e.apellido,
        e.codigo as empleado_codigo
      FROM ausencias a
      JOIN empleados e ON a.empleado_id = e.id
      ORDER BY a.fecha_inicio DESC
    `).all();
    
    res.json({ data: ausencias });
  } catch (error) {
    console.error('Error al obtener ausencias:', error);
    res.status(500).json({ error: 'Error al obtener ausencias' });
  }
});

app.post('/api/ausencias', (req, res) => {
  try {
    const { empleado_id, tipo, fecha_inicio, fecha_fin, observaciones } = req.body;
    
    const result = db.prepare(`
      INSERT INTO ausencias (
        empleado_id, tipo, fecha_inicio, fecha_fin, observaciones
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      empleado_id,
      tipo,
      fecha_inicio,
      fecha_fin,
      observaciones || ''
    );
    
    res.json({ 
      success: true, 
      message: 'Ausencia registrada exitosamente',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error al registrar ausencia:', error);
    res.status(500).json({ error: 'Error al registrar ausencia' });
  }
});

// ========================================
// ENDPOINTS - CONFIGURACIÓN
// ========================================

app.get('/api/configuracion', (req, res) => {
  try {
    const configuracion = db.prepare('SELECT * FROM configuracion').all();
    res.json({ data: configuracion });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// ========================================
// ENDPOINT DE SALUD
// ========================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API REST para Planificador Industrial funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// MANEJO DE ERRORES
// ========================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
// ========================================
// ENDPOINT DE IMPORTACIÓN  - EXTRACCIÓN SELECTIVA MEJORADA
// ========================================

app.post('/api/importar/alupak-pedidos', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('📄 Procesando archivo ...');
    
    // Leer archivo Excel
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Obtener los nombres de las columnas (primera fila)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    
    console.log('📋 Columnas encontradas en el Excel:', headers);

    // Leer todos los datos
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`📊 Total de filas: ${data.length}`);

    // Extraer SOLO las columnas que necesitamos
    const pedidos = [];
    let errores = [];

    // Función para buscar columnas con prioridad
    const buscarColumnaPrioritaria = (nombresBusqueda, evitarSufijos = ['Lbl', 'Label', 'Caption']) => {
      // Primero intentar coincidencia exacta
      for (const nombreBuscado of nombresBusqueda) {
        const coincidenciaExacta = headers.find(h => 
          h && h.toString().trim() === nombreBuscado
        );
        if (coincidenciaExacta) {
          console.log(`✓ Coincidencia exacta encontrada: ${nombreBuscado} -> ${coincidenciaExacta}`);
          return coincidenciaExacta;
        }
      }

      // Luego buscar coincidencias parciales sin sufijos no deseados
      for (const nombreBuscado of nombresBusqueda) {
        const coincidencias = headers.filter(h => 
          h && h.toString().toLowerCase().includes(nombreBuscado.toLowerCase())
        );

        // Filtrar para evitar sufijos no deseados
        const coincidenciasLimpias = coincidencias.filter(h => {
          const headerStr = h.toString();
          return !evitarSufijos.some(sufijo => 
            headerStr.toLowerCase().endsWith(sufijo.toLowerCase())
          );
        });

        if (coincidenciasLimpias.length > 0) {
          const mejorCoincidencia = coincidenciasLimpias[0];
          console.log(`✓ Coincidencia prioritaria encontrada: ${nombreBuscado} -> ${mejorCoincidencia}`);
          return mejorCoincidencia;
        }

        // Si no hay coincidencias limpias, tomar la primera coincidencia
        if (coincidencias.length > 0) {
          const fallback = coincidencias[0];
          console.log(`⚠️ Usando coincidencia con sufijo: ${nombreBuscado} -> ${fallback}`);
          return fallback;
        }
      }

      return null;
    };

    // Buscar las columnas específicas con prioridad
    const colCustomerName = buscarColumnaPrioritaria(
      ['CustomerName', 'Customer Name', 'customer_name'],
      ['Lbl', 'Label', 'Caption']
    );
    
    const colNoSalesLine = buscarColumnaPrioritaria(
      ['No_SalesLine', 'No SalesLine', 'No.', 'Document No.', 'No'],
      ['Lbl', 'Label', 'Caption']
    );
    
    const colQtyPending = buscarColumnaPrioritaria(
      ['Qty_pending', 'Qty pending', 'Quantity Pending', 'Pending'],
      ['Lbl', 'Label', 'Caption']
    );

    console.log('🔍 Columnas identificadas:');
    console.log(`   CustomerName: ${colCustomerName || 'NO ENCONTRADA'}`);
    console.log(`   No_SalesLine: ${colNoSalesLine || 'NO ENCONTRADA'}`);
    console.log(`   Qty_pending: ${colQtyPending || 'NO ENCONTRADA'}`);

    if (!colCustomerName || !colNoSalesLine || !colQtyPending) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers,
        columnas_requeridas: {
          CustomerName: colCustomerName ? '✓ Encontrada' : '✗ NO ENCONTRADA',
          No_SalesLine: colNoSalesLine ? '✓ Encontrada' : '✗ NO ENCONTRADA',
          Qty_pending: colQtyPending ? '✓ Encontrada' : '✗ NO ENCONTRADA'
        }
      });
    }

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extraer SOLO las columnas específicas
        const customerName = row[colCustomerName] || '';
        const noSalesLine = row[colNoSalesLine] || '';
        const qtyPending = row[colQtyPending] || 0;

        // Solo agregar si tenemos CustomerName y No_SalesLine
        if (customerName && noSalesLine) {
          pedidos.push({
            fila: i + 2, // +2 porque la primera fila es el header
            CustomerName: customerName.toString().trim(),
            No_SalesLine: noSalesLine.toString().trim(),
            Qty_pending: parseInt(qtyPending) || 0
          });
        }
      } catch (error) {
        errores.push({
          fila: i + 2,
          error: error.message
        });
      }
    }

    console.log(`✅ Procesados: ${pedidos.length} pedidos, ${errores.length} errores`);

    res.json({
      success: true,
      message: `Archivo procesado exitosamente`,
      estadisticas: {
        total_filas: data.length,
        pedidos_extraidos: pedidos.length,
        errores: errores.length,
        columnas_detectadas: {
          CustomerName: colCustomerName,
          No_SalesLine: colNoSalesLine,
          Qty_pending: colQtyPending
        }
      },
      pedidos: pedidos,
      detallesErrores: errores.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Error procesando Excel:', error);
    res.status(500).json({ 
      error: 'Error procesando archivo Excel', 
      detalle: error.message 
    });
  }
});
// ========================================
// ENDPOINTS PARA GUARDAR DATOS DE EXCEL
// ========================================

// Guardar datos
app.post('/api/alupak/guardar', async (req, res) => {
  try {
    const { pedidos, nombreArchivo } = req.body;

    if (!pedidos || !Array.isArray(pedidos)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    let guardados = 0;
    const errores = [];

    // Limpiar datos anteriores (opcional: puedes comentar esta línea si quieres mantener historial)
    await db.prepare('DELETE FROM alupak_pedidos').run();

    // Guardar cada pedido
    for (const pedido of pedidos) {
      try {
        await db.prepare(`
          INSERT INTO alupak_pedidos (
            customer_name, no_sales_line, qty_pending, archivo_original
          ) VALUES (?, ?, ?, ?)
        `).run(
          pedido.CustomerName,
          pedido.No_SalesLine,
          pedido.Qty_pending || 0,
          nombreArchivo || 'desconocido'
        );
        guardados++;
      } catch (error) {
        errores.push({
          pedido: pedido,
          error: error.message
        });
      }
    }

    // Registrar en historial
    await db.prepare(`
      INSERT INTO historial_importaciones (
        tipo, nombre_archivo, filas_procesadas, filas_guardadas
      ) VALUES (?, ?, ?, ?)
    `).run(
      'alupak',
      nombreArchivo || 'desconocido',
      pedidos.length,
      guardados
    );

    res.json({
      success: true,
      message: `Guardados ${guardados} pedidos de ALUPAK`,
      estadisticas: {
        procesados: pedidos.length,
        guardados: guardados,
        errores: errores.length
      }
    });

  } catch (error) {
    console.error('Error guardando ALUPAK:', error);
    res.status(500).json({ error: error.message });
  }
});

// Guardar datos de Inventario Físico
// Guardar datos de Inventario Físico - VERSIÓN CORREGIDA
// Guardar datos de Inventario Físico - VERSIÓN CORREGIDA
app.post('/api/inventario/guardar', async (req, res) => {
try {
const { inventario, nombreArchivo } = req.body;
if (!inventario || !Array.isArray(inventario)) {
  return res.status(400).json({ error: 'Datos inválidos' });
}

let guardados = 0;
const errores = [];

// Limpiar datos anteriores 
try {
  await db.prepare('DELETE FROM inventario_fisico').run();
} catch (error) {
  console.error('Advertencia: No se pudo limpiar inventario anterior:', error.message);
}

// Guardar cada registro con validación de columnas  // ✅ CORREGIDO
for (const registro of inventario) {
  try {
    // Extraer información de OF/Lote y generación
    const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(registro.ReservEntryBufferLotNo || registro.lot_no);
    
    // Determinar generación desde item_no
    const itemNo = registro.ItemNo_ItemJournalLine || registro.item_no || '';  // ✅ CORREGIDO
    
    const esG1 = itemNo.startsWith('AL');
    const esG2 = itemNo.startsWith('AC');
    
    // Preparar valores con fallbacks seguros
    const valores = [
      itemNo,
      registro.BinCode_ItemJournalLine || registro.bin_code || 'SIN_UBICACION',
      registro.ReservEntryBufferLotNo || registro.lot_no || null,
      registro.ReservEntryBufferQtyBase || registro.qty_base || 0,
      nombreArchivo || 'desconocido',
      tipo || 'Lote',
      ofNumero || null,
      loteNumero || registro.ReservEntryBufferLotNo || null
    ];

        // Verificar existencia de columnas antes de insertar
        const columnCheck = await db.prepare(`
          PRAGMA table_info(inventario_fisico)
        `).all();
        
        const hasNewColumns = columnCheck.some(col => 
          col.name === 'tipo_registro' || 
          col.name === 'of_numero' || 
          col.name === 'lote_numero'
        );

        if (hasNewColumns) {
          // Insert con columnas nuevas
          await db.prepare(`
            INSERT INTO inventario_fisico (
              item_no, bin_code, lot_no, qty_base, archivo_original,
              tipo_registro, of_numero, lote_numero
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(...valores);
        } else {
          // Insert compatible con esquema antiguo
          await db.prepare(`
            INSERT INTO inventario_fisico (
              item_no, bin_code, lot_no, qty_base, archivo_original
            ) VALUES (?, ?, ?, ?, ?)
          `).run(
            itemNo,
            registro.BinCode_ItemJournalLine || registro.bin_code || 'SIN_UBICACION',
            registro.ReservEntryBufferLotNo || registro.lot_no || null,
            registro.ReservEntryBufferQtyBase || registro.qty_base || 0,
            nombreArchivo || 'desconocido'
          );
        }
        
        guardados++;
      } catch (error) {
        errores.push({
          item_no: registro.ItemNo_ItemJournalLine || 'desconocido',
          error: error.message
        });
      }
    }

    // Registrar en historial (best effort)
    try {
      await db.prepare(`
        INSERT INTO historial_importaciones (
          tipo, nombre_archivo, filas_procesadas, filas_guardadas
        ) VALUES (?, ?, ?, ?)
      `).run('inventario', nombreArchivo || 'desconocido', inventario.length, guardados);
    } catch (error) {
      console.error('Advertencia: No se pudo registrar en historial:', error.message);
    }

    res.json({
      success: true,
      message: `✅ Guardados ${guardados} registros de inventario. ${errores.length > 0 ? errores.length + ' errores ignorados.' : ''}`,
      estadisticas: {
        procesados: inventario.length,
        guardados: guardados,
        errores: errores.length,
        filtrados_papel: inventario.filter(i => (i.ItemNo_ItemJournalLine || '').startsWith('Y')).length
      },
      detallesErrores: errores.slice(0, 5)
    });

  } catch (error) {
    console.error('❌ Error CRÍTICO guardando inventario:', error);
    res.status(500).json({ 
      error: 'Error al guardar inventario', 
      detalle: error.message,
      solucion: 'Verifica que la tabla inventario_fisico tenga las columnas necesarias. Ejecuta init-db nuevamente si el problema persiste.'
    });
  }
});

// Obtener datos guardados de Inventario
app.get('/api/inventario/ultimos', async (req, res) => {
  try {
    const inventario = await db.prepare(`
      SELECT 
        id,
        item_no,
        bin_code,
        lot_no,
        qty_base,
        fecha_importacion,
        archivo_original
      FROM inventario_fisico
      WHERE qty_base > 0
      ORDER BY fecha_importacion DESC
    `).all();

    // Calcular totales
    const totales = await db.prepare(`
      SELECT 
        COUNT(*) as total_registros,
        SUM(qty_base) as cantidad_total
      FROM inventario_fisico
      WHERE qty_base > 0
    `).get();

    // Obtener información de la última importación
    const ultimaImportacion = await db.prepare(`
      SELECT nombre_archivo, fecha_importacion, filas_guardadas
      FROM historial_importaciones
      WHERE tipo = 'inventario'
      ORDER BY fecha_importacion DESC
      LIMIT 1
    `).get();

    res.json({
      success: true,
      inventario: inventario,
      totales: totales,
      ultima_importacion: ultimaImportacion
    });

  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: error.message });
  }
});
// Obtener datos guardados de ALUPAK
app.get('/api/alupak/ultimos', async (req, res) => {
  try {
    const pedidos = await db.prepare(`
      SELECT id, customer_name, no_sales_line, qty_pending, fecha_importacion, archivo_original
      FROM alupak_pedidos
      WHERE qty_pending > 0
      ORDER BY fecha_importacion DESC
    `).all();
    
    // Calcular totales
    const totales = await db.prepare(`
      SELECT 
        COUNT(*) as total_registros,
        SUM(qty_pending) as cantidad_total
      FROM alupak_pedidos
      WHERE qty_pending > 0
    `).get();

    // Obtener información de la última importación
    const ultimaImportacion = await db.prepare(`
      SELECT nombre_archivo, fecha_importacion, filas_guardadas
      FROM historial_importaciones
      WHERE tipo = 'alupak'
      ORDER BY fecha_importacion DESC
      LIMIT 1
    `).get();

    res.json({
      success: true,
      pedidos: pedidos,
      totales: totales,
      ultima_importacion: ultimaImportacion
    });
  } catch (error) {
    console.error('Error obteniendo ALUPAK:', error);
    res.status(500).json({ error: error.message });
  }
});
// Obtener historial de importaciones
app.get('/api/importaciones/historial', async (req, res) => {
  try {
    const historial = await db.prepare(`
      SELECT 
        id,
        tipo,
        nombre_archivo,
        filas_procesadas,
        filas_guardadas,
        fecha_importacion,
        usuario
      FROM historial_importaciones
      ORDER BY fecha_importacion DESC
      LIMIT 20
    `).all();

    res.json({
      success: true,
      historial: historial
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});
// ========================================
// ENDPOINT DE IMPORTACIÓN INVENTARIO FÍSICO - CON FILTRO Y CONVERSIÓN
// ========================================

app.post('/api/importar/inventario-fisico', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('📄 Procesando archivo Inventario Físico con lógica mejorada...');
    
    // Leer archivo Excel
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Obtener los nombres de las columnas (primera fila)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
    
    console.log('📋 Columnas encontradas en el Excel:', headers);

    // Leer todos los datos
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`📊 Total de filas: ${data.length}`);

    // Extraer SOLO las columnas que necesitamos
    const inventario = [];
    let errores = [];
    let filtradosPapel = 0;
    let conversionesRealizadas = 0;

    // Función para buscar columnas con prioridad
    const buscarColumnaPrioritaria = (nombresBusqueda) => {
      for (const nombreBuscado of nombresBusqueda) {
        const coincidenciaExacta = headers.find(h => 
          h && h.toString().trim().toLowerCase() === nombreBuscado.toLowerCase()
        );
        if (coincidenciaExacta) {
          return coincidenciaExacta;
        }
      }

      for (const nombreBuscado of nombresBusqueda) {
        const coincidencias = headers.filter(h => 
          h && h.toString().toLowerCase().includes(nombreBuscado.toLowerCase())
        );
        if (coincidencias.length > 0) {
          return coincidencias[0];
        }
      }

      return null;
    };

    // Buscar las columnas específicas para inventario físico
    const colItemNo = buscarColumnaPrioritaria(['ItemNo_ItemJournalLine', 'ItemNo', 'Item No', 'Item Number']);
    const colBinCode = buscarColumnaPrioritaria(['BinCode_ItemJournalLine', 'BinCode', 'Bin Code', 'Location Code']);
    const colLotNo = buscarColumnaPrioritaria(['ReservEntryBufferLotNo', 'LotNo', 'Lot No', 'Lot Number', 'Serial No']);
    const colQtyBase = buscarColumnaPrioritaria(['ReservEntryBufferQtyBase', 'QtyBase', 'Quantity Base', 'Quantity', 'Qty']);

    console.log('🔍 Columnas identificadas:');
    console.log(`   ItemNo_ItemJournalLine: ${colItemNo || 'NO ENCONTRADA'}`);
    console.log(`   BinCode_ItemJournalLine: ${colBinCode || 'NO ENCONTRADA'}`);
    console.log(`   ReservEntryBufferLotNo: ${colLotNo || 'NO ENCONTRADA'}`);
    console.log(`   ReservEntryBufferQtyBase: ${colQtyBase || 'NO ENCONTRADA'}`);

    if (!colItemNo || !colBinCode || !colLotNo || !colQtyBase) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        columnas_encontradas: headers,
        columnas_requeridas: {
          ItemNo_ItemJournalLine: colItemNo ? '✓ Encontrada' : '✗ NO ENCONTRADA',
          BinCode_ItemJournalLine: colBinCode ? '✓ Encontrada' : '✗ NO ENCONTRADA',
          ReservEntryBufferLotNo: colLotNo ? '✓ Encontrada' : '✗ NO ENCONTRADA',
          ReservEntryBufferQtyBase: colQtyBase ? '✓ Encontrada' : '✗ NO ENCONTRADA'
        }
      });
    }

    // Procesar cada fila con lógica mejorada
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extraer y limpiar datos
        const itemNoRaw = row[colItemNo];
        const itemNo = (itemNoRaw || '').toString().trim();
        
        // ✅ FILTRO 1: Excluir items que empiezan por 'Y' (papel)
        if (itemNo.startsWith('Y')) {
          filtradosPapel++;
          continue;
        }
        
        const binCode = (row[colBinCode] || '').toString().trim();
        const lotNo = (row[colLotNo] || '').toString().trim();
        const qtyBaseCajas = parseFloat(row[colQtyBase]) || 0;

        // ✅ CONVERSIÓN: Cajas → Cápsulas según generación
        let qtyBaseCapsulas = qtyBaseCajas;
        let generacion = 'Desconocida';
        let capsulesPerBox = 1;
        
        if (itemNo.startsWith('AL')) {
          // Generación 1: 16.380 cápsulas por caja
          capsulesPerBox = 16380;
          generacion = 'G1';
          qtyBaseCapsulas = qtyBaseCajas * capsulesPerBox;
          conversionesRealizadas++;
        } else if (itemNo.startsWith('AC')) {
          // Generación 2: 15.600 cápsulas por caja
          capsulesPerBox = 15600;
          generacion = 'G2';
          qtyBaseCapsulas = qtyBaseCajas * capsulesPerBox;
          conversionesRealizadas++;
        }
        // Si no es AL ni AC, mantenemos el valor original (sin conversión)

        // Solo agregar si tenemos ItemNo y BinCode válidos
        if (itemNo && binCode && qtyBaseCapsulas > 0) {
          inventario.push({
            fila: i + 2,
            ItemNo_ItemJournalLine: itemNo,
            BinCode_ItemJournalLine: binCode,
            ReservEntryBufferLotNo: lotNo,
            ReservEntryBufferQtyBase: qtyBaseCapsulas, // ✅ AHORA EN CÁPSULAS
            generacion: generacion,
            capsulesPerBox: capsulesPerBox,
            qtyBaseOriginalCajas: qtyBaseCajas
          });
        }
      } catch (error) {
        errores.push({
          fila: i + 2,
          error: error.message,
          datos: {
            ItemNo: row[colItemNo],
            BinCode: row[colBinCode],
            QtyBase: row[colQtyBase]
          }
        });
      }
    }

    console.log(`✅ Procesados: ${inventario.length} registros válidos`);
    console.log(`   - Filtrados (papel 'Y'): ${filtradosPapel}`);
    console.log(`   - Conversiones realizadas: ${conversionesRealizadas}`);
    console.log(`   - Errores: ${errores.length}`);

    res.json({
      success: true,
      message: `Archivo procesado exitosamente. ${filtradosPapel} items de papel excluidos. ${conversionesRealizadas} conversiones de cajas a cápsulas realizadas.`,
      estadisticas: {
        total_filas: data.length,
        registros_extraidos: inventario.length,
        filtrados_papel: filtradosPapel,
        conversiones_realizadas: conversionesRealizadas,
        errores: errores.length
      },
      inventario: inventario,
      detallesErrores: errores.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Error procesando Excel:', error);
    res.status(500).json({ 
      error: 'Error procesando archivo Excel', 
      detalle: error.message 
    });
  }
});
// ========================================
// ENDPOINTS INTELIGENTES PARA DASHBOARD EXCEL
// ========================================

// Resumen completo para dashboard
app.get('/api/dashboard-excel/resumen', async (req, res) => {
  try {
    // Pedidos pendientes de ALUPAK
    const pedidosPendientes = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(qty_pending) as total_cantidad,
        COUNT(DISTINCT customer_name) as clientes_unicos
      FROM alupak_pedidos
      WHERE qty_pending > 0
    `).get();

    // Stock total e inventario valorizado (asumiendo costo promedio)
    const stockResumen = await db.prepare(`
      SELECT 
        COUNT(DISTINCT item_no) as productos_unicos,
        SUM(qty_base) as cantidad_total,
        AVG(qty_base) as promedio_por_item
      FROM inventario_fisico
      WHERE qty_base > 0
    `).get();

    // Alertas de stock bajo (comparando con stock_seguridad de productos)
    const stockBajo = await db.prepare(`
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          i.item_no,
          SUM(i.qty_base) as stock_actual,
          p.stock_seguridad
        FROM inventario_fisico i
        LEFT JOIN productos p ON i.item_no = p.codigo OR i.item_no = p.nombre
        WHERE i.qty_base > 0
        GROUP BY i.item_no, p.stock_seguridad
        HAVING stock_actual < COALESCE(p.stock_seguridad, 0)
      )
    `).get();

    // Productos sin stock
    const sinStock = await db.prepare(`
      SELECT COUNT(DISTINCT p.codigo) as total
      FROM productos p
      LEFT JOIN inventario_fisico i ON p.codigo = i.item_no OR p.nombre = i.item_no
      WHERE i.qty_base IS NULL OR i.qty_base = 0
    `).get();

    res.json({
      success: true,
      resumen: {
        pedidos: {
          total: pedidosPendientes.total || 0,
          cantidad_total: pedidosPendientes.total_cantidad || 0,
          clientes_unicos: pedidosPendientes.clientes_unicos || 0
        },
        stock: {
          productos_unicos: stockResumen.productos_unicos || 0,
          cantidad_total: stockResumen.cantidad_total || 0,
          promedio_por_item: stockResumen.promedio_por_item || 0
        },
        alertas: {
          stock_bajo: stockBajo.total || 0,
          sin_stock: sinStock.total || 0
        },
        ultima_actualizacion: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en resumen dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pedidos pendientes con información de producto
app.get('/api/dashboard-excel/pedidos', async (req, res) => {
  try {
    const pedidos = await db.prepare(`
      SELECT 
        a.id,
        a.customer_name,
        a.no_sales_line,
        a.qty_pending,
        a.fecha_importacion,
        p.id as producto_id,
        p.nombre as producto_nombre,
        p.familia as producto_familia,
        p.stock_seguridad,
        -- Calcular stock disponible para este producto
        (SELECT COALESCE(SUM(qty_base), 0) 
         FROM inventario_fisico i 
         WHERE i.item_no = a.no_sales_line OR i.item_no = p.codigo) as stock_disponible,
        -- Determinar estado
        CASE 
          WHEN (SELECT COALESCE(SUM(qty_base), 0) 
                FROM inventario_fisico i 
                WHERE i.item_no = a.no_sales_line OR i.item_no = p.codigo) < a.qty_pending 
          THEN 'stock_insuficiente'
          ELSE 'stock_suficiente'
        END as estado_stock
      FROM alupak_pedidos a
      LEFT JOIN productos p ON a.no_sales_line = p.codigo OR a.no_sales_line = p.nombre
      WHERE a.qty_pending > 0
      ORDER BY a.fecha_importacion DESC
    `).all();

    res.json({
      success: true,
      pedidos: pedidos,
      total: pedidos.length
    });
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stock actual con alertas y detalles de producto
app.get('/api/dashboard-excel/stock', async (req, res) => {
  try {
    const stock = await db.prepare(`
      SELECT 
        i.id,
        i.item_no,
        i.bin_code,
        i.lot_no,
        i.qty_base,
        i.fecha_importacion,
        i.tipo_registro,
        i.of_numero,
        i.lote_numero,
        p.id as producto_id,
        p.nombre as producto_nombre,
        p.familia as producto_familia,
        p.stock_seguridad,
        p.tiempo_estandar_min,
        -- Determinar nivel de stock
        CASE 
          WHEN p.stock_seguridad IS NULL THEN 'sin_definir'
          WHEN i.qty_base < p.stock_seguridad THEN 'critico'
          WHEN i.qty_base < p.stock_seguridad * 1.5 THEN 'bajo'
          ELSE 'normal'
        END as nivel_stock,
        -- Calcular días de cobertura (asumiendo 8 horas/día)
        CASE 
          WHEN p.tiempo_estandar_min > 0 AND p.stock_seguridad > 0 THEN
            ROUND((i.qty_base * p.tiempo_estandar_min) / (8 * 60), 1)
          ELSE NULL
        END as dias_cobertura,
        -- Determinar generación desde item_no
        CASE 
          WHEN i.item_no LIKE 'AL%' THEN 'G1'
          WHEN i.item_no LIKE 'AC%' THEN 'G2'
          ELSE 'Desconocida'
        END as generacion
      FROM inventario_fisico i
      LEFT JOIN productos p ON i.item_no = p.codigo OR i.item_no = p.nombre
      WHERE i.qty_base > 0
        AND (i.item_no IS NULL OR i.item_no NOT LIKE 'Y%')  -- ✅ EXCLUIR PAPEL
      ORDER BY 
        CASE 
          WHEN p.stock_seguridad IS NULL THEN 1
          WHEN i.qty_base < p.stock_seguridad THEN 0
          ELSE 2
        END,
        i.qty_base ASC
    `).all();

    // Calcular totales
    const totales = {
      total_items: stock.length,
      total_cantidad: stock.reduce((sum, item) => sum + item.qty_base, 0),
      criticos: stock.filter(s => s.nivel_stock === 'critico').length,
      bajos: stock.filter(s => s.nivel_stock === 'bajo').length,
      g1_items: stock.filter(s => s.generacion === 'G1').length,
      g2_items: stock.filter(s => s.generacion === 'G2').length
    };

    res.json({
      success: true,
      stock: stock,
      totales: totales
    });
  } catch (error) {
    console.error('Error obteniendo stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos a Excel
app.get('/api/dashboard-excel/exportar/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    let datos = [];
    let nombreArchivo = '';

    if (tipo === 'pedidos-atrasados') {
      datos = await db.prepare(`
        SELECT 
          customer_name as 'Cliente',
          no_sales_line as 'Producto',
          qty_pending as 'Cantidad Pendiente',
          fecha_importacion as 'Fecha Importación',
          CASE 
            WHEN (SELECT COALESCE(SUM(qty_base), 0) 
                  FROM inventario_fisico i 
                  WHERE i.item_no = a.no_sales_line) < a.qty_pending 
            THEN 'STOCK INSUFICIENTE'
            ELSE 'STOCK SUFICIENTE'
          END as 'Estado Stock'
        FROM alupak_pedidos a
        WHERE qty_pending > 0
        ORDER BY fecha_importacion DESC
      `).all();
      nombreArchivo = 'pedidos_pendientes.xlsx';
    } 
    else if (tipo === 'stock-critico') {
      datos = await db.prepare(`
        SELECT 
          i.item_no as 'Código Producto',
          p.nombre as 'Nombre Producto',
          i.bin_code as 'Ubicación',
          i.lot_no as 'Lote',
          i.qty_base as 'Cantidad Actual',
          p.stock_seguridad as 'Stock Mínimo',
          CASE 
            WHEN i.qty_base < p.stock_seguridad THEN 'CRÍTICO'
            WHEN i.qty_base < p.stock_seguridad * 1.5 THEN 'BAJO'
            ELSE 'NORMAL'
          END as 'Nivel Stock'
        FROM inventario_fisico i
        LEFT JOIN productos p ON i.item_no = p.codigo OR i.item_no = p.nombre
        WHERE i.qty_base > 0 AND (p.stock_seguridad IS NULL OR i.qty_base < p.stock_seguridad * 1.5)
        ORDER BY i.qty_base ASC
      `).all();
      nombreArchivo = 'stock_critico.xlsx';
    }
    else if (tipo === 'resumen-completo') {
      // Combinar ambos datasets
      const pedidos = await db.prepare(`
        SELECT 'PEDIDO' as tipo, customer_name as dato1, no_sales_line as dato2, qty_pending as cantidad
        FROM alupak_pedidos WHERE qty_pending > 0
      `).all();
      
      const stock = await db.prepare(`
        SELECT 'STOCK' as tipo, item_no as dato1, bin_code as dato2, qty_base as cantidad
        FROM inventario_fisico WHERE qty_base > 0
      `).all();
      
      datos = [...pedidos, ...stock];
      nombreArchivo = 'resumen_completo.xlsx';
    }

    // Crear workbook de Excel
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    
    // Enviar como descarga
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    
  } catch (error) {
    console.error('Error exportando datos:', error);
    res.status(500).json({ error: error.message });
  }
});
// Guardar configuración individual (incluyendo OEE por máquina)
app.put('/api/configuracion', async (req, res) => {
  try {
    const { clave, valor } = req.body;
    
    if (!clave || valor === undefined) {
      return res.status(400).json({ error: 'Clave y valor son requeridos' });
    }
    
    // Verificar si la configuración existe
    const existe = await db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get(clave);
    
    if (existe) {
      // Actualizar
      await db.prepare(`
        UPDATE configuracion 
        SET valor = ?, actualizado_en = CURRENT_TIMESTAMP 
        WHERE clave = ?
      `).run(valor, clave);
    } else {
      // Insertar nueva
      await db.prepare(`
        INSERT INTO configuracion (clave, valor, descripcion) 
        VALUES (?, ?, ?)
      `).run(
        clave, 
        valor,
        clave.startsWith('oee_maquina_') ? `OEE para máquina ${clave.split('_')[2]}` : 'Configuración personalizada'
      );
    }
    
    res.json({ 
      success: true, 
      message: `Configuración ${clave} actualizada correctamente`,
      clave,
      valor
    });
    
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// FUNCIONES DE GESTIÓN DE OFs Y LOTES
// ========================================

// Extraer información de OF/Lote desde ReservEntryBufferLotNo
function extraerInfoOFLote(valor) {
  if (!valor || typeof valor !== 'string') {
    return { tipo: 'Desconocido', ofNumero: null, loteNumero: null };
  }

  const valorLimpio = valor.trim();
  
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

// Procesar inventario y extraer OFs/Lotes
function procesarInventarioConOF(inventario) {
  const ofMap = new Map();
  
  inventario.forEach(item => {
    const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(item.ReservEntryBufferLotNo || item.lot_no);
    
    // Actualizar item con información extraída
    item.tipo_registro = tipo;
    item.of_numero = ofNumero;
    item.lote_numero = loteNumero || item.lot_no;
    
    // Agrupar por OF para estadísticas
    if (ofNumero) {
      if (!ofMap.has(ofNumero)) {
        ofMap.set(ofNumero, {
          of_numero: ofNumero,
          tipo: tipo,
          cantidad_total: 0,
          lotes: new Set(),
          productos: new Set()
        });
      }
      
      const ofData = ofMap.get(ofNumero);
      ofData.cantidad_total += item.qty_base || 0;
      if (loteNumero) ofData.lotes.add(loteNumero);
      if (item.item_no) ofData.productos.add(item.item_no);
    }
  });
  
  return {
    inventarioProcesado: inventario,
    estadisticasOF: Array.from(ofMap.values()).map(of => ({
      ...of,
      lotes: Array.from(of.lotes),
      productos: Array.from(of.productos),
      lotes_count: of.lotes.size,
      productos_count: of.productos.size
    }))
  };
}
// ========================================
// ENDPOINTS DE GESTIÓN DE OFs
// ========================================

// Obtener estadísticas de OFs desde inventario
app.get('/api/of/estadisticas', async (req, res) => {
  try {
    // Obtener inventario con OFs procesados
    const inventarioRes = await fetch('http://localhost:3000/api/dashboard-excel/stock');
    const inventarioData = await inventarioRes.json();
    
    const { estadisticasOF } = procesarInventarioConOF(inventarioData.stock || []);
    
    // Contar OFs por estado (simulado desde inventario)
    const ofCount = estadisticasOF.length;
    const ofActivas = estadisticasOF.filter(of => of.cantidad_total > 0).length;
    
    res.json({
      success: true,
      estadisticas: {
        total_ofs: ofCount,
        ofs_activas: ofActivas,
        ofs_sin_stock: ofCount - ofActivas,
        ofs_por_estado: {
          en_produccion: Math.floor(ofActivas * 0.6),
          pendientes: Math.floor(ofActivas * 0.3),
          completadas: Math.floor(ofActivas * 0.1)
        }
      },
      ofs: estadisticasOF
    });
  } catch (error) {
    console.error('Error en estadísticas OF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una OF específica
app.get('/api/of/:ofNumero', async (req, res) => {
  try {
    const { ofNumero } = req.params;
    
    // Buscar en inventario físico
    const inventario = await db.prepare(`
      SELECT 
        i.*,
        p.nombre as producto_nombre,
        p.codigo as producto_codigo
      FROM inventario_fisico i
      LEFT JOIN productos p ON i.item_no = p.codigo OR i.item_no = p.nombre
      WHERE i.of_numero = ?
      ORDER BY i.fecha_importacion DESC
    `).all(ofNumero);
    
    // Buscar en órdenes de fabricación (si existe la tabla)
    let ordenFabricacion = null;
    try {
      ordenFabricacion = await db.prepare(`
        SELECT * FROM ordenes_fabricacion WHERE of_numero = ?
      `).get(ofNumero);
    } catch (e) {
      // Tabla no existe aún, continuamos sin error
    }
    
    // Calcular estadísticas
    const cantidadTotal = inventario.reduce((sum, item) => sum + (item.qty_base || 0), 0);
    const lotesUnicos = [...new Set(inventario.map(i => i.lote_numero).filter(Boolean))];
    
    res.json({
      success: true,
      of: {
        numero: ofNumero,
        tipo: inventario[0]?.tipo_registro || 'Desconocido',
        cantidad_total: cantidadTotal,
        lotes_count: lotesUnicos.length,
        lotes: lotesUnicos,
        productos: [...new Set(inventario.map(i => i.producto_nombre).filter(Boolean))],
        items_inventario: inventario,
        orden_fabricacion: ordenFabricacion
      }
    });
  } catch (error) {
    console.error('Error obteniendo OF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear/Actualizar Orden de Fabricación
app.post('/api/of/guardar', async (req, res) => {
  try {
    const { of_numero, producto_codigo, cantidad_planificada, maquina_asignada, fecha_planificada } = req.body;
    
    if (!of_numero || !producto_codigo || !cantidad_planificada) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    // Verificar si ya existe
    const existe = await db.prepare('SELECT id FROM ordenes_fabricacion WHERE of_numero = ?').get(of_numero);
    
    let result;
    if (existe) {
      // Actualizar
      result = await db.prepare(`
        UPDATE ordenes_fabricacion 
        SET producto_codigo = ?, cantidad_planificada = ?, maquina_asignada = ?, 
            fecha_planificada = ?, actualizado_en = CURRENT_TIMESTAMP
        WHERE of_numero = ?
      `).run(producto_codigo, cantidad_planificada, maquina_asignada, fecha_planificada, of_numero);
    } else {
      // Insertar nueva
      result = await db.prepare(`
        INSERT INTO ordenes_fabricacion (
          of_numero, producto_codigo, cantidad_planificada, 
          maquina_asignada, fecha_planificada, estado
        ) VALUES (?, ?, ?, ?, ?, 'planificada')
      `).run(of_numero, producto_codigo, cantidad_planificada, maquina_asignada, fecha_planificada);
    }
    
    res.json({
      success: true,
      message: existe ? 'OF actualizada correctamente' : 'OF creada correctamente',
      of_id: existe ? existe.id : result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error guardando OF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de OF
app.put('/api/of/:ofNumero/estado', async (req, res) => {
  try {
    const { ofNumero } = req.params;
    const { estado, fecha_inicio, fecha_fin } = req.body;
    
    const updates = ['estado = ?'];
    const params = [estado];
    
    if (fecha_inicio) {
      updates.push('fecha_inicio = ?');
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      updates.push('fecha_fin = ?');
      params.push(fecha_fin);
    }
    
    params.push(ofNumero);
    
    await db.prepare(`
      UPDATE ordenes_fabricacion 
      SET ${updates.join(', ')}, actualizado_en = CURRENT_TIMESTAMP
      WHERE of_numero = ?
    `).run(...params);
    
    res.json({ success: true, message: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando estado OF:', error);
    res.status(500).json({ error: error.message });
  }
});
// ========================================
// ENDPOINT PARA GRÁFICOS DEL DASHBOARD
// ========================================

app.get('/api/dashboard-excel/graficos', async (req, res) => {
  try {
    // Pedidos por cliente (manejar tabla inexistente)
    let pedidosPorCliente = [];
    try {
      pedidosPorCliente = await db.prepare(`
        SELECT 
          customer_name as nombre,
          COUNT(*) as cantidad_pedidos,
          SUM(qty_pending) as total_cantidad
        FROM alupak_pedidos
        WHERE qty_pending > 0
        GROUP BY customer_name
        ORDER BY total_cantidad DESC
        LIMIT 10
      `).all();
    } catch (e) {
      console.log('Tabla alupak_pedidos no disponible para gráficos');
    }

    // Stock por familia (manejar tabla inexistente)
    let stockPorFamilia = [];
    try {
      stockPorFamilia = await db.prepare(`
        SELECT 
          COALESCE(p.familia, 'Sin Familia') as nombre,
          COUNT(DISTINCT i.item_no) as productos,
          SUM(i.qty_base) as cantidad_total
        FROM inventario_fisico i
        LEFT JOIN productos p ON i.item_no = p.codigo OR i.item_no = p.nombre
        WHERE i.qty_base > 0
        GROUP BY p.familia
        ORDER BY cantidad_total DESC
      `).all();
    } catch (e) {
      console.log('Tabla inventario_fisico no disponible para gráficos');
    }

    // Evolución de stock (manejar tabla inexistente)
    let evolucionStock = [];
    try {
      evolucionStock = await db.prepare(`
        SELECT 
          DATE(fecha_importacion) as fecha,
          SUM(qty_base) as cantidad_total
        FROM inventario_fisico
        WHERE qty_base > 0 AND fecha_importacion >= date('now', '-7 days')
        GROUP BY DATE(fecha_importacion)
        ORDER BY fecha
      `).all();
    } catch (e) {
      console.log('Datos históricos no disponibles para gráficos');
    }

    res.json({
      success: true,
      graficos: {
        pedidos_por_cliente: pedidosPorCliente,
        stock_por_familia: stockPorFamilia,
        evolucion_stock: evolucionStock
      }
    });
  } catch (error) {
    console.error('Error en endpoint de gráficos:', error);
    res.json({ // Siempre responder con JSON, nunca 404
      success: true,
      graficos: {
        pedidos_por_cliente: [],
        stock_por_familia: [],
        evolucion_stock: []
      },
      warning: 'Datos de gráficos no disponibles temporalmente'
    });
  }
});
// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {
  console.log('🚀 Servidor ejecutándose en http://localhost:' + PORT);
  console.log('📊 API REST para Planificador Industrial');
  console.log('✅ Base de datos: planificador.db');
});