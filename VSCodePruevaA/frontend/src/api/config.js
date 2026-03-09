// frontend/src/api/config.js
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://tu-backend-production.up.railway.app'  // ⚠️ CAMBIA ESTO POR TU URL REAL DE RAILWAY
    : 'http://localhost:3000');

console.log('🔧 API Base URL:', API_BASE_URL);