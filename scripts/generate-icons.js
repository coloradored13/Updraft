#!/usr/bin/env node

/**
 * generate-icons.js
 *
 * Programmatically generates app icons for iOS, Android, and PWA.
 * Draws a white paper airplane on a sky-blue gradient background.
 * Uses sharp for image generation — no external assets needed.
 *
 * Usage: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Output directories
const ICON_DIR = join(ROOT, 'resources', 'icons');

// All required icon sizes
const ICON_SIZES = [
  // iOS
  { size: 1024, name: 'icon-1024.png', platform: 'ios', desc: 'App Store' },
  { size: 180, name: 'icon-180.png', platform: 'ios', desc: 'iPhone @3x' },
  { size: 167, name: 'icon-167.png', platform: 'ios', desc: 'iPad Pro @2x' },
  { size: 152, name: 'icon-152.png', platform: 'ios', desc: 'iPad @2x' },
  { size: 120, name: 'icon-120.png', platform: 'ios', desc: 'iPhone @2x' },
  { size: 87, name: 'icon-87.png', platform: 'ios', desc: 'Spotlight @3x' },
  { size: 80, name: 'icon-80.png', platform: 'ios', desc: 'Spotlight @2x' },
  { size: 76, name: 'icon-76.png', platform: 'ios', desc: 'iPad @1x' },
  { size: 60, name: 'icon-60.png', platform: 'ios', desc: 'iPhone @1x' },
  { size: 58, name: 'icon-58.png', platform: 'ios', desc: 'Settings @2x' },
  { size: 40, name: 'icon-40.png', platform: 'ios', desc: 'Spotlight @1x' },
  { size: 29, name: 'icon-29.png', platform: 'ios', desc: 'Settings @1x' },
  { size: 20, name: 'icon-20.png', platform: 'ios', desc: 'Notification' },

  // Android (adaptive icon foreground — 108dp with 18dp safe zone)
  { size: 432, name: 'icon-432.png', platform: 'android', desc: 'xxxhdpi' },
  { size: 324, name: 'icon-324.png', platform: 'android', desc: 'xxhdpi' },
  { size: 216, name: 'icon-216.png', platform: 'android', desc: 'xhdpi' },
  { size: 162, name: 'icon-162.png', platform: 'android', desc: 'hdpi' },
  { size: 108, name: 'icon-108.png', platform: 'android', desc: 'mdpi' },

  // PWA
  { size: 512, name: 'icon-512.png', platform: 'pwa', desc: 'PWA large' },
  { size: 192, name: 'icon-192.png', platform: 'pwa', desc: 'PWA standard' },
  { size: 144, name: 'icon-144.png', platform: 'pwa', desc: 'PWA legacy' },
  { size: 96, name: 'icon-96.png', platform: 'pwa', desc: 'PWA small' },
  { size: 72, name: 'icon-72.png', platform: 'pwa', desc: 'PWA tiny' },
  { size: 48, name: 'icon-48.png', platform: 'pwa', desc: 'PWA minimum' },

  // Favicon
  { size: 32, name: 'favicon-32.png', platform: 'web', desc: 'Favicon' },
  { size: 16, name: 'favicon-16.png', platform: 'web', desc: 'Favicon small' },
  { size: 180, name: 'apple-touch-icon.png', platform: 'web', desc: 'Apple touch icon' },
];

/**
 * Create SVG for a paper airplane icon on a sky-blue gradient.
 * The airplane is a simple, recognizable white silhouette.
 * @param {number} size - Icon size in pixels
 * @returns {Buffer} SVG as a buffer
 */
function createIconSvg(size) {
  const padding = size * 0.15;
  const cx = size / 2;
  const cy = size / 2;

  // Paper airplane shape: a simple folded plane pointing upward-right
  // Scaled relative to the icon size, centered
  const s = (size - padding * 2) / 100; // scale factor (100 = design units)

  // Airplane points (design space 0-100, centered at 50,50)
  // Classic paper airplane silhouette: nose up, wings spread
  const nose = { x: 50, y: 12 };
  const leftWing = { x: 10, y: 65 };
  const leftBody = { x: 42, y: 55 };
  const tail = { x: 50, y: 80 };
  const rightBody = { x: 58, y: 55 };
  const rightWing = { x: 90, y: 65 };

  // Transform to icon coordinates
  const tx = (p) => padding + p.x * s;
  const ty = (p) => padding + p.y * s;

  // SVG with gradient background and paper airplane
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5DADE2"/>
      <stop offset="100%" stop-color="#87CEEB"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${size * 0.01}" stdDeviation="${size * 0.015}" flood-color="#000000" flood-opacity="0.2"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#sky)" rx="${size * 0.18}" ry="${size * 0.18}"/>

  <!-- Paper airplane -->
  <g filter="url(#shadow)">
    <!-- Main body / left fold -->
    <polygon
      points="${tx(nose)},${ty(nose)} ${tx(leftWing)},${ty(leftWing)} ${tx(leftBody)},${ty(leftBody)} ${tx(tail)},${ty(tail)}"
      fill="#FFFFFF" opacity="0.95"/>
    <!-- Right fold (slightly darker to show the fold) -->
    <polygon
      points="${tx(nose)},${ty(nose)} ${tx(rightWing)},${ty(rightWing)} ${tx(rightBody)},${ty(rightBody)} ${tx(tail)},${ty(tail)}"
      fill="#E8F0F8" opacity="0.95"/>
    <!-- Center fold line -->
    <line
      x1="${tx(nose)}" y1="${ty(nose)}" x2="${tx(tail)}" y2="${ty(tail)}"
      stroke="#B0C4DE" stroke-width="${Math.max(1, size * 0.008)}" opacity="0.6"/>
  </g>
</svg>`;

  return Buffer.from(svg);
}

/**
 * Generate all icon sizes from the SVG source.
 */
async function generateIcons() {
  // Ensure output directories exist
  mkdirSync(ICON_DIR, { recursive: true });

  console.log('Generating app icons...\n');

  // Generate the base 1024px icon SVG
  const baseSvg = createIconSvg(1024);

  // Generate base PNG at 1024px
  const basePng = await sharp(baseSvg)
    .resize(1024, 1024)
    .png()
    .toBuffer();

  for (const icon of ICON_SIZES) {
    const outPath = join(ICON_DIR, icon.name);
    await sharp(basePng)
      .resize(icon.size, icon.size, {
        fit: 'cover',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toFile(outPath);
    console.log(`  ${icon.name.padEnd(25)} ${icon.size}x${icon.size}  (${icon.platform} - ${icon.desc})`);
  }

  console.log(`\nGenerated ${ICON_SIZES.length} icons in ${ICON_DIR}`);

  // Copy PWA icons to public/
  const publicIconDir = join(ROOT, 'public', 'icons');
  mkdirSync(publicIconDir, { recursive: true });
  for (const icon of ICON_SIZES.filter(i => i.platform === 'pwa' || i.platform === 'web')) {
    const src = join(ICON_DIR, icon.name);
    const dest = join(publicIconDir, icon.name);
    cpSync(src, dest);
  }
  console.log(`Copied PWA/web icons to public/icons/`);

  // Copy to Capacitor platform directories if they exist
  copyToCapacitorIos();
  copyToCapacitorAndroid();
}

/**
 * Copy icons to iOS Capacitor project if it exists.
 */
function copyToCapacitorIos() {
  const iosIconDir = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (!existsSync(iosIconDir)) {
    console.log('\niOS platform not found — skipping iOS icon copy.');
    console.log('Run "npx cap add ios" first, then re-run this script.');
    return;
  }

  console.log('\nCopying icons to iOS project...');
  for (const icon of ICON_SIZES.filter(i => i.platform === 'ios')) {
    const src = join(ICON_DIR, icon.name);
    const dest = join(iosIconDir, icon.name);
    cpSync(src, dest);
    console.log(`  Copied ${icon.name} to iOS`);
  }
}

/**
 * Copy icons to Android Capacitor project if it exists.
 */
function copyToCapacitorAndroid() {
  const androidResDir = join(ROOT, 'android', 'app', 'src', 'main', 'res');
  if (!existsSync(androidResDir)) {
    console.log('\nAndroid platform not found — skipping Android icon copy.');
    console.log('Run "npx cap add android" first, then re-run this script.');
    return;
  }

  // Android adaptive icon mapping
  const androidDensities = [
    { density: 'mdpi', size: 108 },
    { density: 'hdpi', size: 162 },
    { density: 'xhdpi', size: 216 },
    { density: 'xxhdpi', size: 324 },
    { density: 'xxxhdpi', size: 432 },
  ];

  console.log('\nCopying icons to Android project...');
  for (const { density, size } of androidDensities) {
    const src = join(ICON_DIR, `icon-${size}.png`);
    const destDir = join(androidResDir, `mipmap-${density}`);
    if (existsSync(destDir)) {
      cpSync(src, join(destDir, 'ic_launcher_foreground.png'));
      cpSync(src, join(destDir, 'ic_launcher.png'));
      cpSync(src, join(destDir, 'ic_launcher_round.png'));
      console.log(`  Copied ${density} icons to Android`);
    }
  }
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
