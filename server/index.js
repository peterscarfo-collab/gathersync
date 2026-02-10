// Server entry point - imports and starts the compiled server
// All server configuration (Express app, session, CORS, etc.) is handled in server/_core/index.ts

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

// Get the directory of this file (server/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve dist/index.js relative to the project root (one level up from server/)
const distPath = join(__dirname, '..', 'dist', 'index.js');
const distUrl = pathToFileURL(distPath).href;

console.log('[Server] Starting server from:', distPath);

import(distUrl)
  .then(({ default: startServer }) => {
    if (typeof startServer === 'function') {
      console.log('[Server] startServer function found, calling...');
      startServer().catch((err) => {
        console.error('[Server] Error starting server:', err);
        process.exit(1);
      });
    } else {
      console.error('[Server] startServer is not a function:', typeof startServer);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('[Server] Failed to import server from dist:', err);
    console.error('[Server] Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      path: distPath,
    });
    process.exit(1);
  });
