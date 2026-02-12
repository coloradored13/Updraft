import Phaser from 'phaser';
import { OBSTACLES } from '../utils/constants.js';

/**
 * Kite - Colorful watercolor kite with trailing string on a sine-wave bob.
 * Tier 4 obstacle, appears at 5000m+.
 * Dodge-based collision — the kite sways on a tether, player must navigate around.
 */
export default class Kite extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Anchor X (tether point)
   * @param {number} y - Anchor Y (tether point)
   */
  constructor(scene, x, y) {
    const texKey = scene.textures.exists('wc_kite') ? 'wc_kite' : 'kite';
    super(scene, x, y, texKey);

    /** @type {number} X position of the tether anchor */
    this.anchorX = x;

    /** @type {number} Time accumulator for sway */
    this.elapsed = Math.random() * Math.PI * 2;

    /** @type {boolean} Whether this kite has been hit */
    this._hit = false;

    /** @type {number} Vertical bob phase */
    this._bobPhase = Math.random() * Math.PI * 2;

    /** @type {number} Base Y position */
    this._baseY = y;

    scene.add.existing(this);

    // String visual (line from kite down to anchor)
    this.stringGraphics = scene.add.graphics();
  }

  /**
   * Update kite sway, bob, and string visual.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    const dt = delta / 1000;
    this.elapsed += dt;
    this._bobPhase += dt * 2;

    // Sway horizontally around anchor
    this.x = this.anchorX + Math.sin(this.elapsed * OBSTACLES.KITE.SWAY_FREQUENCY) * OBSTACLES.KITE.SWAY_AMPLITUDE;

    // Vertical bob
    this.y = this._baseY + Math.sin(this._bobPhase) * 10;

    // Slight tilt based on sway direction
    const swayVel = Math.cos(this.elapsed * OBSTACLES.KITE.SWAY_FREQUENCY);
    this.setAngle(swayVel * 15);

    // Draw string from kite down to anchor — slightly curved (catenary approximation)
    this.stringGraphics.clear();
    this.stringGraphics.lineStyle(1, 0xCCCCCC, 0.4);
    this.stringGraphics.beginPath();
    this.stringGraphics.moveTo(this.x, this.y + 16);
    const midX = (this.x + this.anchorX) / 2;
    const midY = this.y + OBSTACLES.KITE.STRING_LENGTH * 0.6;
    // Quadratic bezier approximation with line segments
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = (1 - t) * (1 - t) * this.x + 2 * (1 - t) * t * midX + t * t * this.anchorX;
      const py = (1 - t) * (1 - t) * (this.y + 16) + 2 * (1 - t) * t * midY + t * t * (this.y + OBSTACLES.KITE.STRING_LENGTH);
      this.stringGraphics.lineTo(px, py);
    }
    this.stringGraphics.strokePath();
  }

  /**
   * Clean up.
   */
  destroy() {
    if (this.stringGraphics) this.stringGraphics.destroy();
    super.destroy();
  }
}
