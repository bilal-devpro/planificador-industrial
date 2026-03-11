require('dotenv').config();
const express = require('express');
const cors = require('cors');

const {
  pool,
  initDatabase
} = require('./database');

// CORS
app.use(cors({
  origin: [
    'https://bilal-devpro-planificador-industria.vercel.app',
    'https://planificador-industrialverdader.vercel.app',
    'https://planificador-industrial.vercel.app',
    'http://localhost:5173'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/dashboard-excel', require('./routes/dashboardExcel'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/alupak', require('./routes/alupak'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/of', require('./routes/of'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/lineas', require('./routes/lineas'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando' });
});

// Inicio
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend escuchando en puerto ${PORT}`);
});
