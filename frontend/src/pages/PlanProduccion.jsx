import React, { useState, useEffect } from 'react';
import { History, Settings, Plus, RefreshCw, Factory } from 'lucide-react';

// Import utilities
import { MAQUINAS, ESTADOS_PLAN } from './PlanProduccion/utils/constantes';
import { formatearFecha } from './PlanProduccion/utils/formateo';
import { normalizarErrorAPI } from './PlanProduccion/utils/erroresHandler';

// Import context
import { PlanProvider, usePlanContext } from './PlanProduccion/context/PlanContext';

// Import hooks
import { usePlanesProduccion } from './PlanProduccion/hooks/usePlanesProduccion';

// Import components
import FormularioNuevoPlan from './PlanProduccion/components/FormularioNuevoPlan';
import AlertasValidacion from './PlanProduccion/components/AlertasValidacion';
import TablaPlanesProduccion from './PlanProduccion/components/TablaPlanesProduccion';
import HistorialPaginado from './PlanProduccion/components/HistorialPaginado';
import ConfiguracionOEE from './PlanProduccion/components/ConfiguracionOEE';

/**
 * Componente de contenido principal de Planificación de Producción
 * Orquesta: formulario, tabla de planes, historial, configuración de OEE
 * Estados gestionados por context (PlanContext)
 * Llamadas API vía custom hooks (usePlanesProduccion)
 */
function PlanProduccionContent() {
  const {
    planes,
    máquinas,
    loading,
    errores,
    filtros,
    pagination,
    setFiltros,
    setLoading,
    addPlan,
    updatePlan,
    deletePlan
  } = usePlanContext();

  const {
    fetchPlanesActuales,
    fetchPlanesHistorial,
    crearPlanDesdeFormulario,
    editarPlan,
    marcarCompleto,
    eliminarPlan
  } = usePlanesProduccion();

  const [activeTab, setActiveTab] = useState('planes');
  const [showFormulario, setShowFormulario] = useState(false);
  const [showConfigOEE, setShowConfigOEE] = useState(false);

  // Cargar planes al montar
  useEffect(() => {
    fetchPlanesActuales();
  }, [fetchPlanesActuales]);

  // Cargar historial cuando cambia de tab
  useEffect(() => {
    if (activeTab === 'historial') {
      fetchPlanesHistorial(1);
    }
  }, [activeTab, fetchPlanesHistorial]);

  // Manejo de error crítico
  if (errores?.critico) {
    return (
      <div className="alert alert-error p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-2">Error crítico en aplicación</h2>
        <p className="text-sm mb-4">{errores.critico}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Recargar aplicación
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto px-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Factory size={32} className="text-purple-400" />
            Plan de Producción
          </h1>
          <p className="text-secondary mt-1 max-w-xl">
            Gestión inteligente de órdenes con cálculo backend, horario 24/7 y OEE personalizado
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => activeTab === 'planes' ? fetchPlanesActuales() : fetchPlanesHistorial(1)}
            className="btn btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => setShowConfigOEE(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Settings size={16} />
            OEE
          </button>
          <button
            onClick={() => setShowFormulario(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Nueva Orden
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color">
        <button
          className={`px-4 py-3 font-medium transition-all ${
            activeTab === 'planes'
              ? 'border-b-2 border-accent-purple text-accent-purple'
              : 'text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('planes')}
        >
          Planes Actuales ({planes?.length || 0})
        </button>
        <button
          className={`px-4 py-3 font-medium transition-all flex items-center gap-2 ${
            activeTab === 'historial'
              ? 'border-b-2 border-accent-purple text-accent-purple'
              : 'text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('historial')}
        >
          <History size={16} />
          Historial
        </button>
      </div>

      {/* Filtros (solo en tab de planes) */}
      {activeTab === 'planes' && (
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            className="form-control flex-1 min-w-[200px]"
            value={filtros.search || ''}
            onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
          />
          <select
            className="form-control"
            value={filtros.estado || ''}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="requiere_produccion">Requiere Producción</option>
            <option value="en_produccion">En Producción</option>
            <option value="completado">Completado</option>
          </select>
          <select
            className="form-control"
            value={filtros.maquina || ''}
            onChange={(e) => setFiltros({ ...filtros, maquina: e.target.value })}
          >
            <option value="">Todas las máquinas</option>
            {MAQUINAS.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Contenido por tab */}
      {activeTab === 'planes' ? (
        <TablaPlanesProduccion
          planes={planes}
          loading={loading}
          onEdit={editarPlan}
          onDelete={eliminarPlan}
          onComplete={marcarCompleto}
        />
      ) : (
        <HistorialPaginado
          planes={planes}
          pagination={pagination}
          loading={loading}
          onPageChange={(page) => fetchPlanesHistorial(page)}
        />
      )}

      {/* Alertas */}
      <AlertasValidacion />

      {/* Modales */}
      {showFormulario && (
        <FormularioNuevoPlan
          onClose={() => setShowFormulario(false)}
          onCreate={crearPlanDesdeFormulario}
        />
      )}

      {showConfigOEE && (
        <ConfiguracionOEE onClose={() => setShowConfigOEE(false)} />
      )}
    </div>
  );
}

/**
 * Componente wrappeado con Provider de Context
 */
export default function PlanProduccion() {
  return (
    <PlanProvider>
      <PlanProduccionContent />
    </PlanProvider>
  );
}
