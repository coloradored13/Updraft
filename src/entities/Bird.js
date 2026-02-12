import Phaser from 'phaser';
import { OBSTACLES } from '../utils/constants.js';

/**
 * Bird - Watercolor silhouette obstacle that enters from one side in flocks.
 * Tier 1 obstacle, appears at 500m+.
 * Dark warm gray silhouette with procedural wing flap animation.
 */
export default class Bird extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   * @param {number} direction - 1 for right-to-left, -1 for left-to-right
   */
  constructor(scene, x, y, direction = 1) {
    // Use watercolor texture if available, fall back to placeholder
    const texKey = scene.textures.exists('wc_bird') ? 'wc_bird' : 'bird';
    super(scene, x, y, texKey);

    /** @type {number} Movement direction (-1 or 1) */
    this.direction = direction;

    /** @type {number} Base Y for weave calculation */
    this.baseY = y;

    /** @type {number} Time accumulator for sine weave */
    this.elapsed = Math.random() * Math.PI; // stagger phase

    /** @type {boolean} Whether this bird has been hit */
    this._hit = false;

    /** @type {number} Wing flap phase */
    this._flapPhase = Math.random() * Math.PI * 2;

    this.setFlipX(direction > 0);

    scene.add.existing(this);
  }

  /**
   * Update bird position and wing flap each frame.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    const dt = delta / 1000;
    this.elapsed += dt;
    this._flapPhase += dt * 8; // flap speed

    // Horizontal movement
    this.x -= this.direction * OBSTACLES.BIRD.SPEED * dt;

    // Vertical weave
    this.y = this.baseY + Math.sin(this.elapsed * OBSTACLES.BIRD.WEAVE_FREQUENCY) * OBSTACLES.BIRD.WEAVE_AMPLITUDE;

    // Procedural wing flap — scale Y to simulate flapping
    const flapAmount = 0.8 + Math.abs(Math.sin(this._flapPhase)) * 0.4;
    this.setScaleY(flapAmount);
  }

  /**
   * Check if the bird has left the screen.
   * @param {number} screenWidth
   * @returns {boolean}
   */
  isOffScreen(screenWidth) {
    return this.x < -50 || this.x > screenWidth + 50;
  }
}
