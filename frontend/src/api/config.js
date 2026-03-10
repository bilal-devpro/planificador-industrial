// frontend/src/api/config.js
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://planificador-industrial-1.onrender.com' 
    : 'http://localhost:3000');

console.log('🔧 API Base URL:', API_BASE_URL);