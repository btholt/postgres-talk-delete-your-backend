import React from 'react';
import { renderToString } from 'react-legacy-server';
import App from './App.jsx';
import { ResourceContext } from './api.js';

export function render(bootstrap) {
  return renderToString(
    <ResourceContext.Provider value={bootstrap.resources}>
      <App initialRoute={bootstrap.route} />
    </ResourceContext.Provider>);
}
