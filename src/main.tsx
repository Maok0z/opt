import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OptProvider } from './state/OptContext';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <OptProvider>
      <App />
    </OptProvider>
  </StrictMode>,
);
