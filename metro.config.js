const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure resolver for web platform - simplified for static exports
config.resolver = {
  ...config.resolver,
  // Block node-specific modules from being resolved on web
  blockList: [
    ...(config.resolver?.blockList || []),
    /node_modules\/expo-router\/node\/.*/,
  ],
};

module.exports = config;
