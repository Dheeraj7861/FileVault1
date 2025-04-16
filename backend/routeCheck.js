const express = require('express');
const projectRoutes = require('./routes/project.routes');

// Create a simple Express app
const app = express();

// Register the project routes
app.use('/api/projects', projectRoutes);

// Print all registered routes
console.log('Registered Routes:');
console.log('=================');

// Function to extract and print routes from a router
function printRoutes(router, basePath = '') {
  if (!router || !router.stack) {
    console.log('No router or router stack found');
    return;
  }

  router.stack.forEach(layer => {
    if (layer.route) {
      // Routes registered directly on this router
      const path = basePath + (layer.route.path || '');
      const methods = Object.keys(layer.route.methods)
        .filter(method => layer.route.methods[method])
        .join(', ')
        .toUpperCase();
      console.log(`${methods} ${path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      // Router middleware
      const path = layer.regexp.toString().replace('/^', '').replace('\\/?(?=\\/|$)/i', '').replace(/\\\//g, '/');
      printRoutes(layer.handle, basePath + path);
    }
  });
}

// Try to print the routes from the app
try {
  const routers = app._router.stack.filter(layer => layer.name === 'router');
  routers.forEach(router => {
    const path = router.regexp.toString().replace('/^', '').replace('\\/?(?=\\/|$)/i', '').replace(/\\\//g, '/');
    console.log(`\nRouter Base Path: ${path}`);
    printRoutes(router.handle, path);
  });
} catch (error) {
  console.error('Error printing routes:', error);
}

// Check if we have the fix-visibility route
const hasFixVisibilityRoute = app._router.stack.some(layer => {
  if (layer.name === 'router' && layer.handle.stack) {
    return layer.handle.stack.some(subLayer => {
      return subLayer.route && subLayer.route.path === '/fix-visibility';
    });
  }
  return false;
});

console.log('\nFix-visibility route check:');
console.log('=========================');
console.log(`Has fix-visibility route: ${hasFixVisibilityRoute ? 'YES' : 'NO'}`);

// List route paths for debugging
console.log('\nAll route paths:');
console.log('==============');
try {
  const routePaths = [];
  app._router.stack.forEach(layer => {
    if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(subLayer => {
        if (subLayer.route) {
          routePaths.push(subLayer.route.path);
        }
      });
    }
  });
  console.log(routePaths.join('\n'));
} catch (error) {
  console.error('Error listing paths:', error);
}

console.log('\nEnd of report'); 