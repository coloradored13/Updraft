import Phaser from 'phaser';
import { OBSTACLES } from '../utils/constants.js';

/**
 * Crosswind - Amber/orange streaky brush stroke zone that pushes airplane sideways.
 * Tier 3 obstacle, appears at 3000m+.
 * Short bursts of lateral force with animated streaks.
 */
export default class Crosswind extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} pushDirection - 1 for right push, -1 for left push
   */
  constructor(scene, x, y, pushDirection = 1) {
    const texKey = scene.textures.exists('wc_crosswind') ? 'wc_crosswind' : 'crosswind';
    super(scene, x, y, texKey);

    /** @type {number} Push direction (-1 or 1) */
    this.pushDirection = pushDirection;

    /** @type {boolean} Whether the player is currently inside */
    this.playerInside = false;

    /** @type {number} Animation phase for streak movement */
    this._streakPhase = Math.random() * Math.PI * 2;

    this.setFlipX(pushDirection < 0);

    scene.add.existing(this);
  }

  /**
   * Get the push force to apply to the airplane.
   * @returns {number} Horizontal push speed in px/s
   */
  getPushForce() {
    return this.pushDirection * OBSTACLES.CROSSWIND.PUSH_SPEED;
  }

  /**
   * Update visual effects — pulsing alpha and slight horizontal shimmer.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    const dt = delta / 1000;
    this._streakPhase += dt * 3;

    // Pulsing alpha to suggest gusting wind
    const pulse = 0.25 + Math.sin(this._streakPhase) * 0.15;
    this.setAlpha(pulse);

    // Slight horizontal shimmer in push direction
    this.x += Math.sin(this._streakPhase * 2) * this.pushDirection * 0.3;
  }
}
