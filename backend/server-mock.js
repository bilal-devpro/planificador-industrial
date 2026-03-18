require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS
app.use(cors({
  origin: [
    'https://bilal-devpro-planificador-i-git-a211f2-bilals-projects-c48fced9.vercel.app',
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
app.use('/api/produccion', require('./routes/produccion-mock'));
app.use('/api/lineas', require('./routes/lineas'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Mock funcionando' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Mock escuchando en puerto ${PORT}`);
});