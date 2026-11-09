import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { PresentationProvider } from './presentation/PresentationProvider';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Failed to initialize 3D Monopoly: Root element "#root" was not found in index.html.'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PresentationProvider><App /></PresentationProvider>
  </React.StrictMode>
);
