# Updraft - Screenshot Generation Guide

## Overview

This document describes how to capture App Store and Google Play screenshots for Updraft. Since the game uses Phaser primitives (no sprite assets), screenshots must be captured from a running instance of the game.

## Required Screenshot Sizes

### Apple App Store
| Device | Size (px) | Required |
|--------|-----------|----------|
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 | Yes |
| iPhone 6.5" (14 Plus) | 1284 x 2778 | Yes |
| iPhone 5.5" (8 Plus) | 1242 x 2208 | Yes |
| iPad Pro 12.9" (6th gen) | 2048 x 2732 | Yes |
| iPad Pro 11" | 1668 x 2388 | Recommended |

### Google Play Store
| Type | Size (px) | Required |
|------|-----------|----------|
| Phone screenshots | 1080 x 1920 (min) | Yes |
| 7" tablet | 1200 x 1920 | Recommended |
| 10" tablet | 1800 x 2560 | Recommended |
| Feature graphic | 1024 x 500 | Yes |

## Screenshot Scenes (6 required)

### 1. Title Screen
- **What:** The title screen with dawn-to-night gradient, "Updraft" text, and subtitle
- **How to capture:** Launch the game and screenshot the TitleScene before tapping
- **Key elements:** Full sky gradient, "Updraft" title, "a paper airplane journey" subtitle, floating airplane preview

### 2. Early Gameplay - Dawn
- **What:** Paper airplane in the dawn phase catching a wind current
- **How to capture:** Start a game, play until you catch the first few wind currents
- **Key elements:** Dawn colors (soft pink/peach), paper airplane with trail, wind current sparkles, altitude HUD showing ~200m
- **Ideal moment:** Right as the airplane passes through a wind current (catch pulse visible)

### 3. Day Phase with Streak
- **What:** Active gameplay showing the streak system
- **How to capture:** Play into the day phase (2000m+) and build a streak of 3+
- **Key elements:** Blue sky, streak counter ("3x streak!"), altitude around 2000-3000m, wind currents visible ahead

### 4. Golden Hour with Obstacles
- **What:** Navigating obstacles during the golden phase
- **How to capture:** Play to 4000m+ where storms and crosswinds appear
- **Key elements:** Amber/violet sky colors, storm cloud or birds visible, paper airplane banking, progress bar showing ~40% journey

### 5. Night Sky
- **What:** The deep night sky with stars and moon
- **How to capture:** Play to 8000m+ or modify `VISUAL.SKY_PHASES` altitudes temporarily to reach night faster
- **Key elements:** Deep indigo/dark sky, visible stars, moon, altitude showing 8000m+, progress bar nearly full

### 6. Victory Constellation
- **What:** The paper airplane constellation from the VictoryScene
- **How to capture:** Reach 10,000m or modify `LEVELS.VICTORY_ALTITUDE` temporarily to trigger victory sooner
- **Key elements:** Night sky, golden constellation lines forming airplane shape, glowing star dots, "You became the stars." text
- **Best timing:** After constellation is fully drawn (~5s into the scene)

## Capture Methods

### Method A: Browser DevTools (Recommended for development)

1. Run `npm run dev` to start the dev server
2. Open Chrome and navigate to the game
3. Open DevTools (F12) and toggle device toolbar (Ctrl+Shift+M)
4. Set custom dimensions matching the target screenshot size
5. Set device pixel ratio to match (e.g., 3x for iPhone 15 Pro Max)
6. Play to the desired scene
7. Use Ctrl+Shift+P > "Capture full size screenshot" or use the screenshot button in the device toolbar

### Method B: Automated capture script

Create a Playwright or Puppeteer script that:

```js
// scripts/capture-screenshots.js
// Requires: npm install -D playwright

import { chromium } from 'playwright';

const SCREENSHOTS = [
  { name: '01-title', waitFor: 2000, action: null },
  { name: '02-dawn-gameplay', waitFor: 8000, action: 'play-early' },
  // ... etc
];

const SIZES = [
  { name: 'iphone-6.7', width: 430, height: 932, scale: 3 },
  { name: 'iphone-6.5', width: 428, height: 926, scale: 3 },
  { name: 'android-phone', width: 360, height: 640, scale: 3 },
];

async function capture() {
  const browser = await chromium.launch();

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5173');

    // Title screen
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `screenshots/${size.name}-title.png`,
    });

    // Tap to start
    await page.click('canvas');
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: `screenshots/${size.name}-gameplay.png`,
    });

    await context.close();
  }

  await browser.close();
}

capture();
```

This is a starting point. Full automation of specific game states requires either:
- Modifying constants temporarily to fast-forward to specific phases
- Adding a debug/screenshot mode that teleports to specific altitudes

### Method C: Debug mode for specific states

Add a temporary debug helper to `GameScene.js` to teleport to specific altitudes:

```js
// Add to GameScene.create() temporarily for screenshot capture
if (window.__SCREENSHOT_MODE) {
  this.input.keyboard.on('keydown-ONE', () => this._teleportTo(0));     // Dawn
  this.input.keyboard.on('keydown-TWO', () => this._teleportTo(2500));  // Day
  this.input.keyboard.on('keydown-THREE', () => this._teleportTo(4500)); // Golden
  this.input.keyboard.on('keydown-FOUR', () => this._teleportTo(6500)); // Twilight
  this.input.keyboard.on('keydown-FIVE', () => this._teleportTo(8500)); // Night
  this.input.keyboard.on('keydown-SIX', () => this._teleportTo(9900)); // Near victory
}

_teleportTo(targetAltitude) {
  const targetPixels = targetAltitude / SCORING.METERS_PER_PIXEL;
  const pixelDiff = targetPixels - this.airplane.totalPixelsRisen;
  this.airplane.totalPixelsRisen += pixelDiff;
  this.airplane.y -= pixelDiff;
  this.altitudeMeters = targetAltitude;
}
```

Activate by setting `window.__SCREENSHOT_MODE = true` in the browser console before tapping to start.

## Feature Graphic (Google Play)

The feature graphic (1024x500) should be a horizontal representation of the sky journey:

- **Layout:** Horizontal gradient from dawn (left) to night (right)
- **Colors:** #F7CAC9 -> #5DADE2 -> #D4A76A -> #1A237E -> #0A0A2A
- **Foreground:** White paper airplane silhouette at center, slightly angled upward
- **Text:** "Updraft" in clean white, center-aligned
- **Subtitle:** "A Paper Airplane Journey" smaller, below

This can be generated with the icon generation script (see scripts/generate-icons.js) or created in any image editor.

## Screenshot Best Practices

- Ensure the HUD is visible but not dominant
- Capture during moments of visual interest (catching wind, streak active, phase transition)
- Avoid capturing during screen transitions (fade-in/fade-out)
- The paper airplane should be clearly visible in every screenshot
- Show progression: screenshots should tell a story from dawn to night to victory
- Do not include device frames in the raw screenshots (stores add these automatically)

## File Organization

```
screenshots/
  iphone-6.7/
    01-title.png
    02-dawn-gameplay.png
    03-day-streak.png
    04-golden-obstacles.png
    05-night-sky.png
    06-victory.png
  iphone-6.5/
    ...
  android-phone/
    ...
  feature-graphic.png
```
