import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ⚠️ StrictMode desativado para produção
// Em dev: StrictMode duplicava useEffects (comportamento esperado para testar cleanup)
// Em prod: Não há duplicação, site é leve e rápido
createRoot(document.getElementById('root')!).render(<App />);
