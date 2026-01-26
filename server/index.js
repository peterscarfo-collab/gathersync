// Server entry point - imports and starts the compiled server
import express from 'express';
import session from 'express-session';

// Create Express app for session middleware
const app = express();

// Add this as the VERY FIRST line of middleware
app.set('trust proxy', 1);

// Update your session config to this EXACT version
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Crucial for Fly.io
  cookie: {
    secure: true,      // Must be true for HTTPS
    httpOnly: true,
    sameSite: 'none',  // This allows the cookie to survive the Google redirect
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Import compiled server code from dist
import('../dist/index.js').then(({ default: startServer }) => {
  if (typeof startServer === 'function') {
    // startServer creates its own Express app, but we've already set up session middleware
    // Pass the app instance if startServer accepts it, otherwise it will create its own
    startServer();
  } else {
    console.error('startServer is not a function:', typeof startServer);
    process.exit(1);
  }
}).catch((err) => {
  console.error('Failed to start server from dist:', err);
  process.exit(1);
});

