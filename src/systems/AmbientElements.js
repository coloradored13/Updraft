import Phaser from 'phaser';
import { GAME, VISUAL } from '../utils/constants.js';
import { randomRange, drawBrushStroke, hexToRgb } from '../utils/helpers.js';

/**
 * AmbientElements - Non-interactive decorative floating elements.
 * Leaves, butterflies, dandelion seeds that drift gently past camera.
 * Watercolor style, object pooled.
 */
export default class AmbientElements {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.width = scene.scale.width;
    this.height = scene.scale.height;

    /** @type {Phaser.GameObjects.Image[]} */
    this.pool = [];
    /** @type {Object[]} */
    this.activeElements = [];

    this._lastSpawnTime = 0;

    // Generate textures
    this._generateTextures();
  }

  /**
   * Generate watercolor-style ambient element textures.
   * @private
   */
  _generateTextures() {
    // Leaf
    if (!this.scene.textures.exists('ambient_leaf')) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      // Soft leaf shape
      drawBrushStroke(ctx, 8, 5, 7, 4, 0x88AA44, 0.6, 0.3);
      drawBrushStroke(ctx, 8, 5, 5, 3, 0x99BB55, 0.4);
      this.scene.textures.addCanvas('ambient_leaf', canvas);
    }

    // Butterfly
    if (!this.scene.textures.exists('ambient_butterfly')) {
      const canvas = document.createElement('canvas');
      canvas.width = 14;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      // Two wing blobs
      drawBrushStroke(ctx, 4, 5, 4, 3, 0xE8A0C0, 0.5);
      drawBrushStroke(ctx, 10, 5, 4, 3, 0xC8D0F0, 0.5);
      // Body
      ctx.fillStyle = 'rgba(80,60,50,0.6)';
      ctx.fillRect(6, 3, 2, 4);
      this.scene.textures.addCanvas('ambient_butterfly', canvas);
    }

    // Dandelion seed
    if (!this.scene.textures.exists('ambient_dandelion')) {
      const canvas = document.createElement('canvas');
      canvas.width = 12;
      canvas.height = 12;
      const ctx = canvas.getContext('2d');
      // Soft fluffy puff
      drawBrushStroke(ctx, 6, 4, 4, 3, 0xFFFFFF, 0.4);
      drawBrushStroke(ctx, 6, 5, 3, 3, 0xFFF8F0, 0.3);
      // Thin stem
      ctx.strokeStyle = 'rgba(180,160,140,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(6, 7);
      ctx.lineTo(6, 12);
      ctx.stroke();
      this.scene.textures.addCanvas('ambient_dandelion', canvas);
    }

    this._textureKeys = ['ambient_leaf', 'ambient_butterfly', 'ambient_dandelion'];
  }

  /**
   * Update ambient elements — spawn and drift.
   * @param {number} altitudeMeters
   * @param {number} time
   * @param {number} delta
   */
  update(altitudeMeters, time, delta) {
    const dt = delta / 1000;

    // Spawn check
    if (time - this._lastSpawnTime > VISUAL.AMBIENT_SPAWN_INTERVAL_MS &&
        this.activeElements.length < VISUAL.AMBIENT_MAX_ONSCREEN) {
      this._spawn(altitudeMeters);
      this._lastSpawnTime = time;
    }

    // Update active elements
    for (let i = this.activeElements.length - 1; i >= 0; i--) {
      const elem = this.activeElements[i];
      elem.image.x += elem.driftX * dt;
      elem.image.y += elem.driftY * dt;
      // Gentle wobble
      elem.phase += dt * elem.wobbleSpeed;
      elem.image.x += Math.sin(elem.phase) * 0.3;

      // Fade based on proximity to screen edges
      const camTop = this.scene.cameras.main.scrollY;
      const camBottom = camTop + this.height;
      const imgY = elem.image.y;

      if (imgY < camTop - 40 || imgY > camBottom + 40 ||
          elem.image.x < -40 || elem.image.x > this.width + 40) {
        this._recycle(i);
      }
    }
  }

  /**
   * Spawn a new ambient element.
   * @private
   * @param {number} altitudeMeters
   */
  _spawn(altitudeMeters) {
    const texKey = this._textureKeys[Math.floor(Math.random() * this._textureKeys.length)];

    // Don't show butterflies/leaves at high altitude (night sky)
    if (altitudeMeters > 4000 && texKey !== 'ambient_dandelion') return;

    const camTop = this.scene.cameras.main.scrollY;
    const side = Math.random() > 0.5;
    const x = side ? this.width + 20 : -20;
    const y = camTop + randomRange(0, this.height);

    const image = this.scene.add.image(x, y, texKey)
      .setDepth(5)
      .setAlpha(0.5 + Math.random() * 0.3)
      .setScale(0.8 + Math.random() * 0.6);

    // Altitude-based tinting
    if (altitudeMeters > 3000) {
      image.setTint(0x8888CC);
      image.setAlpha(image.alpha * 0.6);
    } else if (altitudeMeters > 1500) {
      image.setTint(0xFFDDA0);
    }

    this.activeElements.push({
      image,
      driftX: (side ? -1 : 1) * randomRange(10, 30),
      driftY: randomRange(-5, 8),
      phase: Math.random() * Math.PI * 2,
      wobbleSpeed: 1 + Math.random() * 2,
    });
  }

  /**
   * Recycle an element back to the pool.
   * @private
   * @param {number} index
   */
  _recycle(index) {
    const elem = this.activeElements[index];
    elem.image.destroy();
    this.activeElements.splice(index, 1);
  }

  /**
   * Clean up all resources.
   */
  destroy() {
    for (const elem of this.activeElements) {
      elem.image.destroy();
    }
    this.activeElements = [];
  }
}
