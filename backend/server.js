require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// ✅ 1. CREAR app ANTES de usarlo (¡ESTE ES EL ERROR CRÍTICO!)
const app = express();
const PORT = process.env.PORT || 10000;

// ✅ 2. CONFIGURACIÓN CORS CORRECTA (después de crear app)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Permitir solicitudes sin origen
    
    const allowedOrigins = [
      'https://planificador-industrialverdader.vercel.app',
      'https://planificador-industrial.vercel.app',
      'https://planificador-industrialverd-git-*.bilals-projects.vercel.app',
      'http://localhost:5173'
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp(allowed.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      return origin === allowed;
    });
    
    callback(isAllowed ? null : new Error('CORS bloqueado'), isAllowed);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ 3. MIDDLEWARES
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ✅ 4. CONEXIÓN POSTGRESQL (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ✅ 5. ENDPOINT DE SALUD (para diagnóstico)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente', timestamp: new Date().toISOString() });
});

// ✅ 6. ENDPOINT MÍNIMO PARA IMPORTAR ALUPAK (solo procesa, no guarda en BD aún)
app.post('/api/importar/alupak-pedidos', (req, res) => {
  try {
    // Simular procesamiento mínimo (en producción usar XLSX)
    const pedidos = [
      { fila: 2, CustomerName: 'Cliente Ejemplo', No_SalesLine: 'AL123456', Qty_pending: 10000 }
    ];
    
    res.json({
      success: true,
      message: 'Archivo procesado exitosamente',
      estadisticas: { total_filas: 1, pedidos_extraidos: 1 },
      pedidos: pedidos
    });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando archivo', detalle: error.message });
  }
});

// ✅ 7. INICIAR SERVIDOR (BIND A 0.0.0.0 - OBLIGATORIO PARA RENDER)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`✅ Backend listo para recibir peticiones desde Vercel`);
});