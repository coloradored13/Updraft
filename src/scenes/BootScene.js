import Phaser from 'phaser';
import { UI, VISUAL } from '../utils/constants.js';
import { drawBrushStroke, drawCloudBlotch, drawSplatter } from '../utils/helpers.js';

/**
 * BootScene - Handles asset preloading and displays a watercolor-themed loading bar.
 * Generates all procedural textures then transitions to TitleScene.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this._createLoadingBar();
    // Assets will be loaded here as they are created.
    // For now, we generate all graphics procedurally.
  }

  create() {
    this._generatePlaceholderTextures();
    this._generateWatercolorTextures();

    // Brief pause to let loading bar be visible, then transition
    this.time.delayedCall(200, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TitleScene');
      });
    });
  }

  /**
   * Create a watercolor-styled loading progress bar.
   * @private
   */
  _createLoadingBar() {
    const { width, height } = this.scale;

    // Warm dawn gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      VISUAL.SKY_PHASES[0].topColor, VISUAL.SKY_PHASES[0].topColor,
      VISUAL.SKY_PHASES[0].bottomColor, VISUAL.SKY_PHASES[0].bottomColor, 1
    );
    bg.fillRect(0, 0, width, height);

    // "Updraft" text above bar
    this.add.text(width / 2, height * 0.44, 'Updraft', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '24px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000033', blur: 2, fill: true },
    }).setOrigin(0.5).setAlpha(0.6);

    // Loading bar
    const barWidth = width * 0.5;
    const barHeight = 4;
    const x = (width - barWidth) / 2;
    const y = height * 0.52;

    // Bar background
    const barBg = this.add.graphics();
    barBg.fillStyle(0xFFFFFF, 0.15);
    barBg.fillRoundedRect(x, y, barWidth, barHeight, 2);

    // Bar fill
    const bar = this.add.graphics();

    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0xFFFFFF, 0.6);
      bar.fillRoundedRect(x, y, barWidth * value, barHeight, 2);
    });

    this.load.on('complete', () => {
      // Fill the bar fully
      bar.clear();
      bar.fillStyle(0xFFFFFF, 0.6);
      bar.fillRoundedRect(x, y, barWidth, barHeight, 2);
    });
  }

  /**
   * Generate procedural placeholder textures for all game entities.
   * These can be replaced with real art assets later.
   * @private
   */
  _generatePlaceholderTextures() {
    // Paper airplane - simple triangle shape
    this._makeTexture('airplane', 32, 20, (g) => {
      g.fillStyle(0xFFFFFF, 1);
      g.beginPath();
      g.moveTo(32, 10);
      g.lineTo(0, 0);
      g.lineTo(6, 10);
      g.lineTo(0, 20);
      g.closePath();
      g.fillPath();
      g.lineStyle(1, 0xCCCCCC, 0.6);
      g.strokePath();
    });

    // Wind current particle
    this._makeTexture('wind_particle', 8, 8, (g) => {
      g.fillStyle(0xFFFFFF, 0.7);
      g.fillCircle(4, 4, 4);
    });

    // Trail particle
    this._makeTexture('trail_particle', 6, 6, (g) => {
      g.fillStyle(0xFFFFFF, 0.5);
      g.fillCircle(3, 3, 3);
    });

    // Bird
    this._makeTexture('bird', 28, 20, (g) => {
      g.lineStyle(2, 0x333333, 1);
      g.beginPath();
      g.moveTo(0, 14);
      g.lineTo(8, 6);
      g.lineTo(14, 10);
      g.lineTo(20, 6);
      g.lineTo(28, 14);
      g.strokePath();
    });

    // Storm cloud
    this._makeTexture('storm_cloud', 120, 80, (g) => {
      g.fillStyle(0x555566, 0.7);
      g.fillCircle(40, 50, 30);
      g.fillCircle(70, 40, 35);
      g.fillCircle(90, 55, 25);
      g.fillCircle(55, 35, 25);
    });

    // Crosswind indicator
    this._makeTexture('crosswind', 200, 60, (g) => {
      g.fillStyle(0xAABBCC, 0.3);
      g.fillRect(0, 0, 200, 60);
      // Arrow indicators
      g.lineStyle(2, 0xCCDDEE, 0.6);
      for (let i = 0; i < 4; i++) {
        const x = 30 + i * 45;
        g.beginPath();
        g.moveTo(x, 30);
        g.lineTo(x + 20, 30);
        g.moveTo(x + 15, 22);
        g.lineTo(x + 20, 30);
        g.lineTo(x + 15, 38);
        g.strokePath();
      }
    });

    // Kite
    this._makeTexture('kite', 24, 36, (g) => {
      g.fillStyle(0xFF6B6B, 1);
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(24, 14);
      g.lineTo(12, 36);
      g.lineTo(0, 14);
      g.closePath();
      g.fillPath();
      g.lineStyle(1, 0xCC5555, 1);
      g.strokePath();
    });

    // Generic circle for ambient particles
    this._makeTexture('circle_soft', 16, 16, (g) => {
      g.fillStyle(0xFFFFFF, 0.4);
      g.fillCircle(8, 8, 8);
    });

    // Feather particle (for bird collision juice)
    this._makeTexture('feather', 10, 6, (g) => {
      g.fillStyle(0xDDDDDD, 0.7);
      g.beginPath();
      g.moveTo(0, 3);
      g.lineTo(5, 0);
      g.lineTo(10, 3);
      g.lineTo(5, 6);
      g.closePath();
      g.fillPath();
    });

    // Paint spatter for catch effects
    this._makeTexture('spatter', 12, 12, (g) => {
      g.fillStyle(0xFFFFFF, 0.6);
      g.fillCircle(6, 6, 5);
      g.fillCircle(3, 3, 2);
      g.fillCircle(9, 4, 2);
    });
  }

  /**
   * Helper to create a texture from graphics drawing commands.
   * @private
   * @param {string} key - Texture key
   * @param {number} w - Width
   * @param {number} h - Height
   * @param {function(Phaser.GameObjects.Graphics): void} drawFn - Drawing function
   */
  _makeTexture(key, w, h, drawFn) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generate watercolor-style textures using Canvas API.
   * Upgrades placeholders with softer, painterly versions.
   * @private
   */
  _generateWatercolorTextures() {
    // Watercolor bird silhouette — dark warm gray, soft-edged
    this._makeCanvasTexture('wc_bird', 32, 24, (ctx) => {
      // Body
      drawBrushStroke(ctx, 16, 14, 8, 5, 0x4A3F3F, 0.75);
      // Left wing
      drawBrushStroke(ctx, 7, 9, 8, 4, 0x5A4A4A, 0.6, -0.4);
      // Right wing
      drawBrushStroke(ctx, 25, 9, 8, 4, 0x5A4A4A, 0.6, 0.4);
      // Head
      drawBrushStroke(ctx, 16, 10, 4, 3, 0x3A2F2F, 0.7);
    });

    // Watercolor storm cloud — dark blotchy
    this._makeCanvasTexture('wc_storm', 140, 100, (ctx) => {
      drawCloudBlotch(ctx, 70, 50, 130, 80, 0x3A3A50, 0.6);
      drawCloudBlotch(ctx, 60, 45, 100, 70, 0x2A2A40, 0.4);
      // Lightning hint
      drawBrushStroke(ctx, 75, 70, 3, 15, 0xFFFFAA, 0.15);
    });

    // Watercolor crosswind — amber streaky brush strokes
    this._makeCanvasTexture('wc_crosswind', 220, 70, (ctx) => {
      for (let i = 0; i < 6; i++) {
        const y = 15 + Math.random() * 40;
        const x = 20 + Math.random() * 180;
        drawBrushStroke(ctx, x, y, 50 + Math.random() * 40, 6 + Math.random() * 6, 0xCC7722, 0.2 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2);
      }
      // Subtle arrow hints
      for (let i = 0; i < 3; i++) {
        drawBrushStroke(ctx, 50 + i * 60, 35, 15, 4, 0xDD9944, 0.25, 0);
      }
    });

    // Watercolor kite — colorful diamond
    this._makeCanvasTexture('wc_kite', 28, 40, (ctx) => {
      // Diamond body with color sections
      drawBrushStroke(ctx, 14, 14, 12, 8, 0xE84040, 0.7, 0.78);
      drawBrushStroke(ctx, 14, 14, 10, 7, 0xFF7070, 0.5, 0.78);
      drawBrushStroke(ctx, 14, 22, 10, 7, 0x4488DD, 0.6, 0.78);
      drawBrushStroke(ctx, 14, 22, 8, 6, 0x66AAFF, 0.4, 0.78);
      // Center cross
      drawBrushStroke(ctx, 14, 18, 2, 14, 0x333333, 0.2);
      drawBrushStroke(ctx, 14, 14, 10, 1, 0x333333, 0.15);
    });

    // Watercolor paper airplane — white with fold lines
    this._makeCanvasTexture('wc_airplane', 36, 24, (ctx) => {
      // Main body
      drawBrushStroke(ctx, 20, 12, 14, 6, 0xFFFFFF, 0.85, 0.1);
      drawBrushStroke(ctx, 18, 12, 12, 5, 0xF8F0E8, 0.6, 0.1);
      // Nose point
      drawBrushStroke(ctx, 33, 12, 4, 3, 0xFFFFFF, 0.9);
      // Fold line
      ctx.strokeStyle = 'rgba(180,170,160,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(5, 12);
      ctx.lineTo(34, 12);
      ctx.stroke();
      // Subtle wing shadow
      drawBrushStroke(ctx, 16, 8, 10, 3, 0xE8E0D8, 0.3, -0.15);
      drawBrushStroke(ctx, 16, 16, 10, 3, 0xE8E0D8, 0.3, 0.15);
    });

    // Watercolor wind current particle — soft glowing dot
    this._makeCanvasTexture('wc_wind_particle', 10, 10, (ctx) => {
      drawBrushStroke(ctx, 5, 5, 5, 5, 0xCCE8FF, 0.5);
      drawBrushStroke(ctx, 5, 5, 3, 3, 0xFFFFFF, 0.3);
    });
  }

  /**
   * Helper to create a texture from Canvas 2D drawing.
   * @private
   * @param {string} key - Texture key
   * @param {number} w - Width
   * @param {number} h - Height
   * @param {function(CanvasRenderingContext2D): void} drawFn - Drawing function
   */
  _makeCanvasTexture(key, w, h, drawFn) {
    if (this.textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    drawFn(canvas.getContext('2d'));
    this.textures.addCanvas(key, canvas);
  }
}
