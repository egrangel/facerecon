import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
}

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Pessoas',
      href: '/dashboard/pessoas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      name: 'Câmeras',
      href: '/dashboard/cameras',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Eventos',
      href: '/dashboard/eventos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Detecções',
      href: '/dashboard/deteccoes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      name: 'Relatórios',
      href: '/dashboard/relatorios',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Configurações',
      href: '/dashboard/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  // Add current property to navigation items
  const navWithCurrent = navigation.map(item => ({
    ...item,
    current: location.pathname === item.href || location.pathname.startsWith(item.href + '/'),
  }));

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--color-background-primary)]">
      {/* Sidebar for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 lg:hidden">
          <div className="fixed inset-0 bg-[var(--color-text-primary)] bg-opacity-20" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[var(--color-background-secondary)]">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SidebarContent navigation={navWithCurrent} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent navigation={navWithCurrent} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="lg:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-primary-500)]"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Top header */}
        <header className="w-full">
          <div className="relative z-10 flex-shrink-0 flex h-16 bg-[var(--color-background-secondary)] shadow-[var(--shadow-sm)] border-b border-[var(--color-border-light)]">
            <div className="flex-1 px-4 flex justify-between">
              <div className="flex-1 flex">
                <div className="w-full flex lg:ml-0">
                  <div className="relative w-full text-[var(--color-text-muted)] focus-within:text-[var(--color-text-secondary)]">
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    </div>
                  </div>
                </div>
              </div>
              <div className="ml-4 flex items-center lg:ml-6">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] mr-4">
                    {user?.name}
                  </span>
                  <Button variant="outline" onClick={handleLogout}>
                    Sair
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-[var(--color-background-primary)]">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

interface SidebarContentProps {
  navigation: NavItem[];
  onNavigate?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ navigation, onNavigate }) => {
  return (
    <div className="flex flex-col h-0 flex-1 border-r border-[var(--color-border-light)] bg-[var(--color-background-secondary)]">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="h-8 w-8 bg-[var(--color-primary-500)] rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-[var(--color-text-inverse)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {/* Church building base */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20h16V10l-8-6-8 6v10z" />
              {/* Church bell tower */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 4V2h4v2" />
              {/* Cross on top */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2V1M11 1.5h2" />
              {/* Church door */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
              {/* Eye in the center - pupil */}
              <circle cx="12" cy="12" r="2.5" strokeWidth={1.5} fill="currentColor" />
              {/* Eye in the center - iris */}
              <circle cx="12" cy="12" r="1.2" strokeWidth={0} fill="var(--color-primary-500)" />
              {/* Eye highlight */}
              <circle cx="12.5" cy="11.5" r="0.3" strokeWidth={0} fill="currentColor" />
              {/* Church windows */}
              {/* <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v-1.5M16 14v-1.5" /> */}
            </svg>
          </div>
          <h1 className="ml-3 text-xl font-semibold text-[var(--color-text-primary)]">
            PastorIA
          </h1>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${item.current
                  ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              <span className={`mr-3 ${item.current ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'}`}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default DashboardLayout;