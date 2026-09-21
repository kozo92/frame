import { StrictMode, Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erreur au chargement de la version standard:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4 text-xl">
              ⚠️
            </div>
            <h1 className="text-xl font-semibold mb-2 font-['Plus_Jakarta_Sans']">
              Affichage de la Version Standard
            </h1>
            <p className="text-sm text-stone-400 mb-6 leading-relaxed">
              Votre navigateur ou appareil nécessite peut-être la version optimisée et allégée (compatible Surface RT & Internet Explorer 10).
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/ie10"
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-sm transition-colors shadow-lg cursor-pointer"
              >
                Ouvrir la version Surface RT / IE10
              </a>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-sm transition-colors cursor-pointer"
              >
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
