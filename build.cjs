#!/usr/bin/env node

const esbuild = require('esbuild');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (fs.existsSync(path.join(__dirname, '.git'))) {
  console.log("Activating Husky's Git hooks...");
  execSync(path.join(__dirname, 'node_modules', '.bin', 'husky'), { stdio: 'inherit' });
}

const buildOptions = {
  entryPoints: ['src/index.ts'], // Entry point of your application
  bundle: true, // Bundle all dependencies into the output file
  outfile: 'dist/index.js', // Output file
  minify: false, // Minify the output
  sourcemap: true, // Generate source maps
  platform: 'node', // Platform target (e.g., 'node' or 'browser')
  target: ['node18'], // Target environment (e.g., 'esnext', 'node14', 'chrome58', etc.)
  external: [], // External dependencies to exclude from the bundle
};

const build = async () => {
  try {
    await esbuild.build(buildOptions);
  } catch (error) {
    console.error('Build failed:', error);
  }
};

// Initial build
build();

const watch = process.argv.includes('--watch');
if (watch) {
  console.log('Watching for changes...');
  chokidar.watch('src/**/*.{ts,js}', { ignoreInitial: true }).on('all', (event, path) => {
    console.log(`${event} detected at ${path}. Rebuilding...`);
    build();
  });
}
