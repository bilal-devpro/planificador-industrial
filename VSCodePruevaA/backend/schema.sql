-- ========================================
-- ESQUEMA DE BASE DE DATOS - PLANIFICADOR INDUSTRIAL
-- ========================================

-- ========================================
-- TABLAS MAESTRAS
-- ========================================

-- Productos/SKUs
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  familia TEXT,
  formato TEXT,
  tiempo_estandar_min REAL,
  stock_seguridad INTEGER DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Líneas de producción
CREATE TABLE IF NOT EXISTS lineas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad_hora INTEGER NOT NULL,
  turno_manana BOOLEAN DEFAULT 1,
  turno_tarde BOOLEAN DEFAULT 1,
  turno_noche BOOLEAN DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  contacto TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  prioridad INTEGER DEFAULT 3,
  activo BOOLEAN DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Materiales
CREATE TABLE IF NOT EXISTS materiales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad_medida TEXT DEFAULT 'kg',
  stock_actual REAL DEFAULT 0,
  stock_seguridad REAL DEFAULT 0,
  proveedor TEXT,
  costo_unitario REAL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Empleados
CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT UNIQUE,
  email TEXT,
  telefono TEXT,
  puesto TEXT,
  linea_id INTEGER,
  turno_habitual TEXT,
  fecha_ingreso DATE,
  activo BOOLEAN DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linea_id) REFERENCES lineas(id)
);

-- ========================================
-- TABLAS OPERACIONALES
-- ========================================

-- Pedidos de clientes
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_pedido TEXT UNIQUE NOT NULL,
  cliente_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  fecha_pedido DATE DEFAULT CURRENT_DATE,
  fecha_requerida DATE NOT NULL,
  fecha_entrega DATE,
  estado TEXT DEFAULT 'pendiente',
  prioridad INTEGER DEFAULT 3,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Stock por almacén
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  almacen TEXT DEFAULT 'principal',
  cantidad INTEGER DEFAULT 0,
  stock_seguridad INTEGER DEFAULT 0,
  ubicacion TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  UNIQUE(producto_id, almacen)
);

-- Movimientos de stock
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_item_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- entrada, salida, ajuste, produccion
  cantidad INTEGER NOT NULL,
  referencia TEXT, -- pedido_id, plan_id, etc.
  observaciones TEXT,
  realizado_por TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
);

-- Bill of Materials (Lista de materiales)
CREATE TABLE IF NOT EXISTS bom (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (material_id) REFERENCES materiales(id),
  UNIQUE(producto_id, material_id)
);

-- Ausencias de empleados
CREATE TABLE IF NOT EXISTS ausencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- vacaciones, enfermedad, permiso
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  aprobado BOOLEAN DEFAULT 0,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
);

-- ========================================
-- TABLAS DE PLANIFICACIÓN
-- ========================================

-- Versiones de plan
CREATE TABLE IF NOT EXISTS plan_versiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'borrador', -- borrador, aprobado, ejecutado, cancelado
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion DATETIME,
  creado_por TEXT,
  aprobado_por TEXT
);

-- Plan de producción
CREATE TABLE IF NOT EXISTS plan_produccion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER,
  pedido_id INTEGER,
  producto_id INTEGER NOT NULL,
  linea_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  turno TEXT,
  estado TEXT DEFAULT 'pendiente', -- pendiente, en_produccion, completado, cancelado
  cantidad_producida INTEGER DEFAULT 0,
  merma INTEGER DEFAULT 0,
  oee REAL,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES plan_versiones(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (linea_id) REFERENCES lineas(id)
);

-- Calendario de eventos
CREATE TABLE IF NOT EXISTS calendario_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL, -- festivo, paro, mantenimiento, reunion
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  linea_id INTEGER,
  impacto_capacidad REAL DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linea_id) REFERENCES lineas(id)
);

-- Mantenimientos programados
CREATE TABLE IF NOT EXISTS mantenimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL, -- preventivo, correctivo, mejora
  linea_id INTEGER NOT NULL,
  fecha_programada DATETIME NOT NULL,
  duracion_horas REAL NOT NULL,
  responsable TEXT,
  estado TEXT DEFAULT 'programado', -- programado, en_progreso, completado, cancelado
  impacto_disponibilidad REAL,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linea_id) REFERENCES lineas(id)
);

-- ========================================
-- TABLAS PARA DATOS IMPORTADOS DE EXCEL
-- ========================================

-- Datos de  Pedidos venta pendiente
CREATE TABLE IF NOT EXISTS alupak_pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  no_sales_line TEXT NOT NULL,
  qty_pending INTEGER NOT NULL DEFAULT 0,
  fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  archivo_original TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Datos de Lista del inventario físico (CON COLUMNAS DE OF/LOTE)
CREATE TABLE IF NOT EXISTS inventario_fisico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_no TEXT NOT NULL,
  bin_code TEXT NOT NULL,
  lot_no TEXT,
  qty_base REAL NOT NULL DEFAULT 0,
  fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  archivo_original TEXT,
  -- Nuevas columnas para OF/Lotes
  tipo_registro TEXT DEFAULT 'Lote',
  of_numero TEXT,
  lote_numero TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historial de importaciones
CREATE TABLE IF NOT EXISTS historial_importaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL, -- 'alupak' o 'inventario'
  nombre_archivo TEXT NOT NULL,
  filas_procesadas INTEGER DEFAULT 0,
  filas_guardadas INTEGER DEFAULT 0,
  fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario TEXT DEFAULT 'system'
);

-- ========================================
-- TABLAS PARA GESTIÓN DE OFs Y LOTES
-- ========================================

-- Órdenes de Fabricación (OF)
CREATE TABLE IF NOT EXISTS ordenes_fabricacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  of_numero TEXT UNIQUE NOT NULL,
  producto_id INTEGER,
  producto_codigo TEXT,
  producto_nombre TEXT,
  cantidad_planificada INTEGER DEFAULT 0,
  cantidad_producida INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'planificada', -- planificada, en_produccion, completada, cancelada
  fecha_planificada DATETIME,
  fecha_inicio DATETIME,
  fecha_fin DATETIME,
  maquina_asignada TEXT,
  linea_asignada TEXT,
  prioridad INTEGER DEFAULT 3,
  observaciones TEXT,
  alupak_pedido_id INTEGER,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (alupak_pedido_id) REFERENCES alupak_pedidos(id)
);

-- Relación OF-Lotes
CREATE TABLE IF NOT EXISTS of_lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  of_id INTEGER NOT NULL,
  lote_numero TEXT NOT NULL,
  cantidad INTEGER DEFAULT 0,
  fecha_produccion DATETIME,
  calidad_aprobada BOOLEAN DEFAULT 1,
  observaciones TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (of_id) REFERENCES ordenes_fabricacion(id)
);

-- ========================================
-- TABLA DE AUDITORÍA
-- ========================================

CREATE TABLE IF NOT EXISTS logs_cambios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tabla TEXT NOT NULL,
  accion TEXT NOT NULL, -- insert, update, delete
  registro_id INTEGER,
  datos_anteriores TEXT,
  datos_nuevos TEXT,
  usuario TEXT DEFAULT 'system',
  descripcion TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ÍNDICES PARA RENDIMIENTO
-- ========================================

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_requerida ON pedidos(fecha_requerida);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_linea_fecha ON plan_produccion(linea_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_estado ON plan_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_stock_items_producto ON stock_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_logs_cambios_tabla ON logs_cambios(tabla);
CREATE INDEX IF NOT EXISTS idx_calendario_eventos_fecha ON calendario_eventos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_alupak_pedidos ON alupak_pedidos(customer_name, no_sales_line);
CREATE INDEX IF NOT EXISTS idx_inventario_fisico ON inventario_fisico(item_no, bin_code);
CREATE INDEX IF NOT EXISTS idx_inventario_of ON inventario_fisico(of_numero);
CREATE INDEX IF NOT EXISTS idx_inventario_tipo ON inventario_fisico(tipo_registro);
CREATE INDEX IF NOT EXISTS idx_of_numero ON ordenes_fabricacion(of_numero);
CREATE INDEX IF NOT EXISTS idx_of_estado ON ordenes_fabricacion(estado);

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista de pedidos con información completa
CREATE VIEW IF NOT EXISTS v_pedidos_completos AS
SELECT 
  p.id,
  p.numero_pedido,
  c.codigo as cliente_codigo,
  c.nombre as cliente_nombre,
  pr.codigo as producto_codigo,
  pr.nombre as producto_nombre,
  p.cantidad,
  p.fecha_pedido,
  p.fecha_requerida,
  p.fecha_entrega,
  p.estado,
  p.prioridad,
  p.observaciones,
  p.creado_en,
  p.actualizado_en,
  CASE 
    WHEN p.estado = 'pendiente' AND p.fecha_requerida < date('now') THEN 'atrasado'
    WHEN p.estado = 'pendiente' AND p.fecha_requerida <= date('now', '+3 days') THEN 'proximo'
    ELSE p.estado
  END as estado_calculado
FROM pedidos p
JOIN clientes c ON p.cliente_id = c.id
JOIN productos pr ON p.producto_id = pr.id;

-- Vista de stock con producto
CREATE VIEW IF NOT EXISTS v_stock_completo AS
SELECT 
  s.id,
  p.codigo as producto_codigo,
  p.nombre as producto_nombre,
  p.familia,
  s.almacen,
  s.cantidad,
  s.stock_seguridad,
  s.ubicacion,
  CASE 
    WHEN s.cantidad < s.stock_seguridad THEN 'critico'
    WHEN s.cantidad < s.stock_seguridad * 1.5 THEN 'bajo'
    ELSE 'normal'
  END as nivel_stock
FROM stock_items s
JOIN productos p ON s.producto_id = p.id;

-- Vista de plan de producción con detalles
CREATE VIEW IF NOT EXISTS v_plan_produccion_completo AS
SELECT 
  pp.id,
  pv.nombre as version_nombre,
  p.numero_pedido,
  pr.codigo as producto_codigo,
  pr.nombre as producto_nombre,
  l.codigo as linea_codigo,
  l.nombre as linea_nombre,
  pp.cantidad,
  pp.cantidad_producida,
  pp.merma,
  pp.oee,
  pp.observaciones
FROM plan_produccion pp
LEFT JOIN plan_versiones pv ON pp.version_id = pv.id
LEFT JOIN pedidos p ON pp.pedido_id = p.id
JOIN productos pr ON pp.producto_id = pr.id
JOIN lineas l ON pp.linea_id = l.id;

-- ========================================
-- CONFIGURACIÓN DEL SISTEMA
-- ========================================

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT,
  descripcion TEXT,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Valores por defecto
-- Valores por defecto ACTUALIZADOS para 24/7 con 2 turnos de 12h
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('dias_laborables', '7', 'Días laborables por semana (24/7)'),
  ('turnos_dia', '2', 'Turnos por día (mañana y noche)'),
  ('horas_turno', '12', 'Horas por turno (12 horas cada turno)'),
  ('oee_objetivo', '0.85', 'OEE objetivo'),
  ('version_sistema', '1.0.0', 'Versión del sistema'),
  ('oee_maquina_M1', '0.85', 'OEE para máquina M1'),
  ('oee_maquina_M2', '0.85', 'OEE para máquina M2'),
  ('oee_maquina_M3', '0.85', 'OEE para máquina M3'),
  ('oee_maquina_M4', '0.85', 'OEE para máquina M4');

-- Mensaje de confirmación
SELECT '✅ Esquema de base de datos creado exitosamente' as mensaje;