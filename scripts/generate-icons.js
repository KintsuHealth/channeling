// Run this script to generate PNG icons from the SVG
// Usage: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple canvas-based PNG generator for the icon
// This creates a basic coffee-themed icon

function createPNG(size) {
  // Create a simple PNG with the channeling design
  // Using a minimal approach - brown background with cream streams

  const { createCanvas } = require('canvas');
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - rounded rectangle (we'll do full for simplicity)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6B4423');
  gradient.addColorStop(1, '#5C2D0E');

  // Draw rounded rect background
  const radius = size * 0.1875; // 96/512
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw the three streams
  ctx.strokeStyle = '#F5F0EB';
  ctx.lineWidth = size * 0.055; // 28/512
  ctx.lineCap = 'round';

  const scale = size / 512;

  // Left stream
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(156 * scale, 140 * scale);
  ctx.quadraticCurveTo(156 * scale, 256 * scale, 180 * scale, 320 * scale);
  ctx.quadraticCurveTo(204 * scale, 384 * scale, 180 * scale, 440 * scale);
  ctx.stroke();

  // Center stream
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(256 * scale, 100 * scale);
  ctx.quadraticCurveTo(256 * scale, 220 * scale, 256 * scale, 300 * scale);
  ctx.quadraticCurveTo(256 * scale, 380 * scale, 256 * scale, 440 * scale);
  ctx.stroke();

  // Right stream
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(356 * scale, 140 * scale);
  ctx.quadraticCurveTo(356 * scale, 256 * scale, 332 * scale, 320 * scale);
  ctx.quadraticCurveTo(308 * scale, 384 * scale, 332 * scale, 440 * scale);
  ctx.stroke();

  // Bottom ellipse glow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#F5F0EB';
  ctx.beginPath();
  ctx.ellipse(256 * scale, 456 * scale, 120 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// Try to use canvas, fall back to instructions
try {
  require.resolve('canvas');

  const icon192 = createPNG(192);
  const icon512 = createPNG(512);

  fs.writeFileSync(path.join(__dirname, '../public/icon-192.png'), icon192);
  fs.writeFileSync(path.join(__dirname, '../public/icon-512.png'), icon512);

  console.log('Icons generated successfully!');
  console.log('  - public/icon-192.png');
  console.log('  - public/icon-512.png');
} catch (e) {
  console.log('Canvas module not installed. Install it with:');
  console.log('  npm install canvas');
  console.log('');
  console.log('Or generate icons manually:');
  console.log('  1. Open public/icon.svg in a browser');
  console.log('  2. Take a screenshot or use an online SVG to PNG converter');
  console.log('  3. Save as icon-192.png (192x192) and icon-512.png (512x512)');
  console.log('');
  console.log('Online tool: https://svgtopng.com/');
}
