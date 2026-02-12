import Phaser from 'phaser';
import { GAME, VISUAL } from '../utils/constants.js';
import { lerpColor, lerp, clamp, hexToRgb, randomRange, drawBrushStroke, drawCloudBlotch, addNoiseTexture, drawGradientWash } from '../utils/helpers.js';

/**
 * SkyBackground - Layered sky system with watercolor-style altitude phase transitions.
 *
 * Phases:
 *   0-500m   : warm dawn — soft pinks, peach, pale gold
 *   500-1500m: daytime — cerulean, cobalt washes, wispy white clouds
 *   1500-3000m: golden hour — amber, burnt sienna, soft violet
 *   3000-5000m: twilight — deep indigo, prussian blue, emerging stars
 *   5000m+   : night — dark washes, watercolor moon, constellations
 *
 * Uses programmatically generated canvas textures for watercolor feel,
 * layered with parallax for depth. Stars, moon, and clouds are separate layers.
 */
export default class SkyBackground {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    /** @private */
    this.scene = scene;
    /** @private */
    this.width = scene.scale.width;
    /** @private */
    this.height = scene.scale.height;

    // ── Gradient background layer ───────────────────────────────────────
    this.bgGraphics = scene.add.graphics().setDepth(-20).setScrollFactor(0);

    // ── Watercolor wash overlay ─────────────────────────────────────────
    this._generateWashTexture();
    this.washImage = scene.add.image(this.width / 2, this.height / 2, 'sky_wash')
      .setDepth(-19)
      .setScrollFactor(0)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD);

    // ── Star field ──────────────────────────────────────────────────────
    this.stars = [];
    this._createStarField();
    this.starContainer = scene.add.container(0, 0, this.stars)
      .setDepth(-18)
      .setScrollFactor(0)
      .setAlpha(0);

    // ── Moon ─────────────────────────────────────────────────────────────
    this._generateMoonTexture();
    this.moon = scene.add.image(this.width * 0.78, this.height * 0.15, 'wc_moon')
      .setDepth(-17)
      .setScrollFactor(0)
      .setAlpha(0);

    // ── Cloud layers (parallax) ─────────────────────────────────────────
    this.cloudLayers = [];
    this._createCloudLayers();

    /** @private {number} Current phase blend target for smooth transitions */
    this._lastAltitude = 0;
  }

  /**
   * Generate a subtle watercolor wash texture using canvas.
   * @private
   */
  _generateWashTexture() {
    const w = this.width;
    const h = this.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Soft overlapping brush strokes for paper texture
    for (let i = 0; i < 12; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const rx = 60 + Math.random() * 120;
      const ry = 40 + Math.random() * 80;
      const color = Math.random() > 0.5 ? 0xFFFFFF : 0xFFF8E7;
      drawBrushStroke(ctx, cx, cy, rx, ry, color, 0.04 + Math.random() * 0.06);
    }

    addNoiseTexture(ctx, w, h, 0.02);

    if (!this.scene.textures.exists('sky_wash')) {
      this.scene.textures.addCanvas('sky_wash', canvas);
    }
  }

  /**
   * Generate a watercolor moon texture.
   * @private
   */
  _generateMoonTexture() {
    if (this.scene.textures.exists('wc_moon')) return;

    const size = VISUAL.MOON_RADIUS * 2 + 20;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const r = VISUAL.MOON_RADIUS;

    // Outer glow
    drawBrushStroke(ctx, cx, cy, r + 10, r + 10, 0xFFF8DC, 0.15);
    // Main moon body
    drawBrushStroke(ctx, cx, cy, r, r, 0xFFFACD, 0.7);
    drawBrushStroke(ctx, cx - 3, cy - 2, r * 0.85, r * 0.85, 0xFFF8DC, 0.5);
    // Craters as darker soft circles
    drawBrushStroke(ctx, cx + 5, cy - 4, 6, 5, 0xE8DDB5, 0.3);
    drawBrushStroke(ctx, cx - 7, cy + 6, 4, 4, 0xE8DDB5, 0.25);
    drawBrushStroke(ctx, cx + 2, cy + 8, 5, 3, 0xE8DDB5, 0.2);

    this.scene.textures.addCanvas('wc_moon', canvas);
  }

  /**
   * Create the star field (small dots with twinkling).
   * @private
   */
  _createStarField() {
    const count = VISUAL.STAR_COUNT;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height * 0.7; // Stars mostly in upper portion
      const size = 1 + Math.random() * 2;
      const star = this.scene.add.circle(x, y, size, 0xFFFFFF, 0.6 + Math.random() * 0.4);
      star._twinkleSpeed = 0.5 + Math.random() * 2;
      star._twinklePhase = Math.random() * Math.PI * 2;
      star._baseAlpha = star.alpha;
      this.stars.push(star);
    }
  }

  /**
   * Create parallax cloud layers.
   * @private
   */
  _createCloudLayers() {
    const parallaxFactors = VISUAL.CLOUD_PARALLAX;

    for (let layer = 0; layer < VISUAL.CLOUD_LAYER_COUNT; layer++) {
      const container = this.scene.add.container(0, 0)
        .setDepth(-15 + layer)
        .setScrollFactor(0, parallaxFactors[layer]);

      const cloudData = [];
      const count = VISUAL.CLOUDS_PER_LAYER;
      for (let i = 0; i < count; i++) {
        const texKey = `wc_cloud_${layer}_${i}`;
        this._generateCloudTexture(texKey, layer);
        const cx = randomRange(0, this.width);
        const cy = randomRange(this.height * 0.1, this.height * 0.9);
        const cloud = this.scene.add.image(cx, cy, texKey)
          .setAlpha(0.5 - layer * 0.1);
        cloud._driftSpeed = (0.2 + Math.random() * 0.3) * (layer + 1) * 0.5;
        cloud._baseX = cx;
        container.add(cloud);
        cloudData.push(cloud);
      }

      this.cloudLayers.push({ container, clouds: cloudData, parallax: parallaxFactors[layer] });
    }
  }

  /**
   * Generate a watercolor cloud texture on canvas.
   * @private
   * @param {string} key
   * @param {number} layer - 0=far, 1=mid, 2=near
   */
  _generateCloudTexture(key, layer) {
    if (this.scene.textures.exists(key)) return;

    const baseW = 100 + layer * 30;
    const baseH = 40 + layer * 15;
    const w = baseW + Math.floor(Math.random() * 60);
    const h = baseH + Math.floor(Math.random() * 20);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Cloud is white/cream blotches
    const color = [0xFFFFFF, 0xFFF8F0, 0xF0F0FF][layer] || 0xFFFFFF;
    drawCloudBlotch(ctx, w / 2, h / 2, w * 0.8, h * 0.8, color, 0.5 + Math.random() * 0.3);

    this.scene.textures.addCanvas(key, canvas);
  }

  /**
   * Update the sky background based on current altitude.
   * Called each frame from GameScene.update().
   * @param {number} altitudeMeters - Current altitude in meters
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Frame delta in ms
   */
  update(altitudeMeters, time, delta) {
    this._updateGradient(altitudeMeters);
    this._updateStars(altitudeMeters, time);
    this._updateMoon(altitudeMeters);
    this._updateClouds(altitudeMeters, time, delta);
    this._lastAltitude = altitudeMeters;
  }

  /**
   * Update the gradient background colors with smooth blending.
   * @private
   * @param {number} alt
   */
  _updateGradient(alt) {
    const phases = VISUAL.SKY_PHASES;
    let topColor, bottomColor;

    // Find the two phases to blend between
    if (alt <= phases[0].altitude) {
      topColor = phases[0].topColor;
      bottomColor = phases[0].bottomColor;
    } else if (alt >= phases[phases.length - 1].altitude) {
      topColor = phases[phases.length - 1].topColor;
      bottomColor = phases[phases.length - 1].bottomColor;
    } else {
      for (let i = 0; i < phases.length - 1; i++) {
        if (alt >= phases[i].altitude && alt < phases[i + 1].altitude) {
          const t = (alt - phases[i].altitude) / (phases[i + 1].altitude - phases[i].altitude);
          topColor = lerpColor(phases[i].topColor, phases[i + 1].topColor, t);
          bottomColor = lerpColor(phases[i].bottomColor, phases[i + 1].bottomColor, t);
          break;
        }
      }
    }

    this.bgGraphics.clear();
    this.bgGraphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    this.bgGraphics.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Update star visibility and twinkling.
   * @private
   * @param {number} alt
   * @param {number} time
   */
  _updateStars(alt, time) {
    const appearAlt = VISUAL.STAR_APPEAR_ALTITUDE;
    const fullAlt = VISUAL.STAR_FULL_ALTITUDE;

    if (alt < appearAlt) {
      if (this.starContainer.alpha > 0) this.starContainer.setAlpha(0);
      return;
    }

    const starAlpha = clamp((alt - appearAlt) / (fullAlt - appearAlt), 0, 1);
    this.starContainer.setAlpha(starAlpha);

    // Twinkle
    const t = time * 0.001;
    for (const star of this.stars) {
      const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * star._twinkleSpeed + star._twinklePhase));
      star.setAlpha(star._baseAlpha * twinkle);
    }
  }

  /**
   * Update moon visibility.
   * @private
   * @param {number} alt
   */
  _updateMoon(alt) {
    const appearAlt = VISUAL.MOON_APPEAR_ALTITUDE;
    if (alt < appearAlt - 500) {
      if (this.moon.alpha > 0) this.moon.setAlpha(0);
      return;
    }
    const moonAlpha = clamp((alt - (appearAlt - 500)) / 1000, 0, 0.85);
    this.moon.setAlpha(moonAlpha);
  }

  /**
   * Update cloud layers — drift and altitude-based visibility.
   * @private
   * @param {number} alt
   * @param {number} time
   * @param {number} delta
   */
  _updateClouds(alt, time, delta) {
    const dt = delta / 1000;

    for (const layer of this.cloudLayers) {
      // Cloud visibility: full in dawn/day, fade in twilight/night
      let cloudAlpha;
      if (alt < 500) {
        cloudAlpha = 0.35;
      } else if (alt < 1500) {
        cloudAlpha = 0.5;
      } else if (alt < 3000) {
        cloudAlpha = 0.3;
      } else if (alt < 5000) {
        cloudAlpha = lerp(0.3, 0.08, (alt - 3000) / 2000);
      } else {
        cloudAlpha = 0.08;
      }
      layer.container.setAlpha(cloudAlpha);

      // Tint clouds based on altitude phase
      let cloudTint = 0xFFFFFF;
      if (alt < 500) {
        cloudTint = lerpColor(0xFFF0E0, 0xFFFFFF, alt / 500);
      } else if (alt >= 1500 && alt < 3000) {
        cloudTint = lerpColor(0xFFFFFF, 0xFFD4A0, (alt - 1500) / 1500);
      } else if (alt >= 3000) {
        cloudTint = lerpColor(0xFFD4A0, 0x8888CC, clamp((alt - 3000) / 2000, 0, 1));
      }

      for (const cloud of layer.clouds) {
        // Gentle horizontal drift
        cloud._baseX += cloud._driftSpeed * dt;
        if (cloud._baseX > this.width + 80) {
          cloud._baseX = -80;
        }
        cloud.x = cloud._baseX;
        cloud.setTint(cloudTint);
      }
    }
  }

  /**
   * Clean up all resources.
   */
  destroy() {
    this.bgGraphics.destroy();
    this.washImage.destroy();
    this.starContainer.destroy();
    this.moon.destroy();
    for (const layer of this.cloudLayers) {
      layer.container.destroy();
    }
  }
}
