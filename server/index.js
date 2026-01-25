// Server entry point - imports the compiled server code from dist
// IMPORTANT: trust proxy is set in server/_core/index.ts as the FIRST line after Express initialization
// This ensures cookies work correctly with Fly.io reverse proxy
import '../dist/index.js';
