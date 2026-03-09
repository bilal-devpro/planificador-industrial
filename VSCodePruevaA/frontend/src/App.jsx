import React, { useState } from 'react';
import GestionOFs from './pages/GestionOFs';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Calendar,
  Users,
  Settings,
  FileText,
  Factory,
  Wrench,
  HardHat,
  Menu,
  X,
  Upload,
  Database,
  Hash
} from 'lucide-react';

// Importar páginas
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import PlanProduccion from './pages/PlanProduccion';
import Stock from './pages/Stock';
import Productos from './pages/Productos';
import Configuracion from './pages/Configuracion';
import ImportarAlupak from './pages/ImportarAlupak';
import ImportarInventario from './pages/ImportarInventario';
import DatosGuardados from './pages/DatosGuardados';
import DashboardExcel from './pages/DashboardExcel';

const Navigation = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard-excel', icon: Database, label: 'Dashboard Excel', destacado: true },
    { path: '/pedidos', icon: Package, label: 'Pedidos' },
    { path: '/plan-produccion', icon: Factory, label: 'Plan Producción' },
    { path: '/stock', icon: FileText, label: 'Stock' },
    { path: '/productos', icon: Package, label: 'Productos' },
    { path: '/of', icon: Hash, label: 'Gestión OFs', destacado: true },
    { path: '/importar-alupak', icon: Upload, label: 'Importar ALUPAK', destacado: true },
    { path: '/importar-inventario', icon: Package, label: 'Importar Inventario', destacado: true },
    { path: '/datos-guardados', icon: Database, label: 'Datos Guardados', destacado: true },
    { path: '/configuracion', icon: Settings, label: 'Configuración' },
  ];

  return (
    <>
      {/* Botón mobile menu */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bg-secondary rounded-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar - Versión Mejorada Responsiva */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="flex items-center gap-2">
            <Factory size={24} />
            <span className="hidden xs:inline">Planificador Industrial</span>
          </h1>
        </div>

        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`${isActive ? 'active' : ''} ${item.destacado ? 'bg-blue-900/30' : ''}`}
                  onClick={() => setSidebarOpen(false)} // Cerrar sidebar al hacer clic en móvil
                >
                  <Icon size={20} />
                  <span className="hidden xs:inline">{item.label}</span>
                  {item.destacado && (
                    <span className="ml-auto hidden xs:inline text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      Nuevo
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main className="main-content">
          <Routes>
            {/* Redirección a Dashboard Excel como página principal */}
            <Route path="/" element={<Navigate to="/dashboard-excel" replace />} />

            {/* NUEVO Dashboard Excel - Página principal */}
            <Route path="/dashboard-excel" element={<DashboardExcel />} />

            {/* Dashboard original (opcional, para mantenerlo accesible) */}
            <Route path="/dashboard-original" element={<Dashboard />} />

            {/* Resto de rutas */}
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/plan-produccion" element={<PlanProduccion />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/of" element={<GestionOFs />} />
            <Route path="/importar-alupak" element={<ImportarAlupak />} />
            <Route path="/importar-inventario" element={<ImportarInventario />} />
            <Route path="/datos-guardados" element={<DatosGuardados />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;