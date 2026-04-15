#!/usr/bin/env node

/**
 * generate-splash.js
 *
 * Generates splash screen assets for iOS and Android.
 * Dawn sky gradient with a centered white paper airplane.
 * Uses sharp for image generation — no external assets needed.
 *
 * Usage: node scripts/generate-splash.js
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SPLASH_DIR = join(ROOT, 'resources', 'splash');

// Splash screen sizes for both platforms
const SPLASH_SIZES = [
  // iOS (portrait)
  { width: 1290, height: 2796, name: 'splash-1290x2796.png', desc: 'iPhone 15 Pro Max' },
  { width: 1284, height: 2778, name: 'splash-1284x2778.png', desc: 'iPhone 14 Plus' },
  { width: 1179, height: 2556, name: 'splash-1179x2556.png', desc: 'iPhone 14 Pro' },
  { width: 1170, height: 2532, name: 'splash-1170x2532.png', desc: 'iPhone 14' },
  { width: 1125, height: 2436, name: 'splash-1125x2436.png', desc: 'iPhone X/XS' },
  { width: 1242, height: 2208, name: 'splash-1242x2208.png', desc: 'iPhone 8 Plus' },
  { width: 750, height: 1334, name: 'splash-750x1334.png', desc: 'iPhone 8' },
  { width: 2048, height: 2732, name: 'splash-2048x2732.png', desc: 'iPad Pro 12.9"' },
  { width: 1668, height: 2388, name: 'splash-1668x2388.png', desc: 'iPad Pro 11"' },
  { width: 1620, height: 2160, name: 'splash-1620x2160.png', desc: 'iPad 10.2"' },
  { width: 1536, height: 2048, name: 'splash-1536x2048.png', desc: 'iPad Air/Mini' },

  // Android (portrait)
  { width: 480, height: 800, name: 'splash-480x800.png', desc: 'Android mdpi' },
  { width: 720, height: 1280, name: 'splash-720x1280.png', desc: 'Android hdpi' },
  { width: 1080, height: 1920, name: 'splash-1080x1920.png', desc: 'Android xhdpi' },
  { width: 1440, height: 2560, name: 'splash-1440x2560.png', desc: 'Android xxhdpi' },
  { width: 1440, height: 3200, name: 'splash-1440x3200.png', desc: 'Android xxxhdpi' },

  // Landscape variants (for iPad)
  { width: 2732, height: 2048, name: 'splash-2732x2048.png', desc: 'iPad Pro 12.9" landscape' },
  { width: 2388, height: 1668, name: 'splash-2388x1668.png', desc: 'iPad Pro 11" landscape' },
];

/**
 * Create SVG for a splash screen with dawn sky gradient and paper airplane.
 * @param {number} width
 * @param {number} height
 * @returns {Buffer} SVG buffer
 */
function createSplashSvg(width, height) {
  // Paper airplane scale relative to the smaller dimension
  const minDim = Math.min(width, height);
  const airplaneSize = minDim * 0.15;
  const cx = width / 2;
  const cy = height * 0.42; // Slightly above center

  const s = airplaneSize / 100;

  // Airplane points (same as icon, centered at cx, cy)
  const pts = (x, y) => `${cx + (x - 50) * s},${cy + (y - 50) * s}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7CAC9"/>
      <stop offset="50%" stop-color="#F9D5A7"/>
      <stop offset="100%" stop-color="#FDE8D0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${minDim * 0.003}"/>
    </filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${minDim * 0.005}" stdDeviation="${minDim * 0.008}" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Dawn sky gradient background -->
  <rect width="${width}" height="${height}" fill="url(#sky)"/>

  <!-- Subtle cloud wisps -->
  <ellipse cx="${width * 0.25}" cy="${height * 0.3}" rx="${width * 0.15}" ry="${height * 0.02}" fill="white" opacity="0.2"/>
  <ellipse cx="${width * 0.7}" cy="${height * 0.35}" rx="${width * 0.12}" ry="${height * 0.015}" fill="white" opacity="0.15"/>
  <ellipse cx="${width * 0.5}" cy="${height * 0.55}" rx="${width * 0.18}" ry="${height * 0.018}" fill="white" opacity="0.12"/>

  <!-- Paper airplane (centered, pointing up) -->
  <g filter="url(#shadow)">
    <polygon
      points="${pts(50, 12)} ${pts(10, 65)} ${pts(42, 55)} ${pts(50, 80)}"
      fill="#FFFFFF" opacity="0.95"/>
    <polygon
      points="${pts(50, 12)} ${pts(90, 65)} ${pts(58, 55)} ${pts(50, 80)}"
      fill="#EEF2F7" opacity="0.95"/>
    <line
      x1="${cx}" y1="${cy + (12 - 50) * s}" x2="${cx}" y2="${cy + (80 - 50) * s}"
      stroke="#C5D0DC" stroke-width="${Math.max(1, minDim * 0.004)}" opacity="0.5"/>
  </g>

  <!-- Soft glow behind airplane -->
  <circle cx="${cx}" cy="${cy}" r="${airplaneSize * 0.7}" fill="white" opacity="0.1" filter="url(#glow)"/>

  <!-- App name below airplane -->
  <text x="${cx}" y="${height * 0.62}" text-anchor="middle"
    font-family="'Segoe UI', system-ui, sans-serif" font-size="${minDim * 0.06}"
    font-weight="bold" fill="white" opacity="0.9"
    filter="url(#shadow)">Updraft</text>
</svg>`;

  return Buffer.from(svg);
}

/**
 * Generate all splash screen sizes.
 */
async function generateSplashScreens() {
  mkdirSync(SPLASH_DIR, { recursive: true });

  console.log('Generating splash screens...\n');

  for (const splash of SPLASH_SIZES) {
    const svg = createSplashSvg(splash.width, splash.height);
    const outPath = join(SPLASH_DIR, splash.name);

    await sharp(svg)
      .resize(splash.width, splash.height)
      .png()
      .toFile(outPath);

    console.log(`  ${splash.name.padEnd(30)} ${splash.width}x${splash.height}  (${splash.desc})`);
  }

  console.log(`\nGenerated ${SPLASH_SIZES.length} splash screens in ${SPLASH_DIR}`);

  // Copy to Capacitor platform directories if they exist
  copyToCapacitorIos();
  copyToCapacitorAndroid();
}

/**
 * Copy splash screens to iOS Capacitor project if it exists.
 */
function copyToCapacitorIos() {
  const iosDir = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
  if (!existsSync(iosDir)) {
    const altDir = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets');
    if (!existsSync(altDir)) {
      console.log('\niOS platform not found — skipping iOS splash copy.');
      console.log('Run "npx cap add ios" first, then re-run this script.');
      return;
    }
    // Capacitor uses LaunchImage or a storyboard; create Splash.imageset
    mkdirSync(iosDir, { recursive: true });
  }

  console.log('\nCopying splash screens to iOS project...');

  // iOS uses a single 2732x2732 splash or specific sizes based on storyboard
  // Copy the largest portrait and landscape variants
  const iosSplashes = [
    'splash-2048x2732.png',
    'splash-1290x2796.png',
    'splash-2732x2048.png',
  ];
  for (const name of iosSplashes) {
    const src = join(SPLASH_DIR, name);
    if (existsSync(src)) {
      cpSync(src, join(iosDir, name));
      console.log(`  Copied ${name} to iOS`);
    }
  }
}

/**
 * Copy splash screens to Android Capacitor project if it exists.
 */
function copyToCapacitorAndroid() {
  const androidResDir = join(ROOT, 'android', 'app', 'src', 'main', 'res');
  if (!existsSync(androidResDir)) {
    console.log('\nAndroid platform not found — skipping Android splash copy.');
    console.log('Run "npx cap add android" first, then re-run this script.');
    return;
  }

  const androidMap = [
    { dir: 'drawable', file: 'splash-480x800.png' },
    { dir: 'drawable-hdpi', file: 'splash-720x1280.png' },
    { dir: 'drawable-xhdpi', file: 'splash-1080x1920.png' },
    { dir: 'drawable-xxhdpi', file: 'splash-1440x2560.png' },
    { dir: 'drawable-xxxhdpi', file: 'splash-1440x3200.png' },
  ];

  console.log('\nCopying splash screens to Android project...');
  for (const { dir, file } of androidMap) {
    const destDir = join(androidResDir, dir);
    mkdirSync(destDir, { recursive: true });
    const src = join(SPLASH_DIR, file);
    if (existsSync(src)) {
      cpSync(src, join(destDir, 'splash.png'));
      console.log(`  Copied ${file} to ${dir}/splash.png`);
    }
  }
}

generateSplashScreens().catch((err) => {
  console.error('Error generating splash screens:', err);
  process.exit(1);
});
