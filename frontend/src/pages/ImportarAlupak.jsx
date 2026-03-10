import React from 'react';

export default function ImportarAlupak() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-primary mb-6">
        Importar Pedidos ALUPAK
      </h1>
      <div className="card bg-bg-secondary border-border-color p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <p className="text-secondary mb-4">
            Sube tu archivo Excel de pedidos ALUPAK para procesarlo
          </p>
        </div>
        
        <div className="border-2 border-dashed border-border-color rounded-xl p-12 max-w-md mx-auto">
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            className="hidden" 
            id="file-upload"
          />
          <label 
            htmlFor="file-upload" 
            className="cursor-pointer flex flex-col items-center"
          >
            <div className="bg-blue-500/20 p-4 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p className="font-medium text-text-primary mb-2">
              Arrastra tu archivo Excel aquí
            </p>
            <p className="text-sm text-secondary mb-4">
              o haz clic para buscar
            </p>
            <span className="text-xs bg-bg-secondary text-text-secondary px-3 py-1 rounded">
              Formatos: .xlsx, .xls
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}