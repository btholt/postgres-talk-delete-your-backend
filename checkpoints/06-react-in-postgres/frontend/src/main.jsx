import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { ResourceContext } from './api.js';
import './styles.css';

const data = document.getElementById('kickstopper-data');
if (import.meta.env.DEV && !data) {
  createRoot(document.getElementById('root')).render(<App initialRoute={location.pathname.startsWith('/project/') ? location.pathname.slice(1) : 'explore'} />);
} else {
  if (!data) throw new Error('The server-rendered page is missing its bootstrap data.');
  const bootstrap = JSON.parse(data.textContent);
  hydrateRoot(document.getElementById('root'),
    <ResourceContext.Provider value={bootstrap.resources}>
      <App initialRoute={bootstrap.route} />
    </ResourceContext.Provider>);
}
