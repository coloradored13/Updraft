import Phaser from 'phaser';
import { WIND_CURRENT } from '../utils/constants.js';

/**
 * WindCurrent - A horizontal band of rising air that the airplane can catch.
 *
 * Visual: A series of softly animated particles flowing upward within a defined zone.
 * Gameplay: If the airplane passes through, it gets a speed boost and streak increment.
 *           If the airplane misses (passes the Y threshold without touching), it loses speed.
 */
export default class WindCurrent extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Y position
   * @param {number} width - Width of the wind current zone
   */
  constructor(scene, x, y, width) {
    super(scene, x, y);

    /** @type {number} Width of the catchable zone */
    this.currentWidth = width;

    /** @type {boolean} Whether this current has been caught by the player */
    this.caught = false;

    /** @type {boolean} Whether the player has passed this current (for miss detection) */
    this.passed = false;

    /** @type {boolean} Whether this current is active (not yet resolved) */
    this.active = true;

    // Use watercolor particle if available
    const particleKey = scene.textures.exists('wc_wind_particle') ? 'wc_wind_particle' : 'wind_particle';

    // Visual representation - flowing particles with soft blue-white coloring
    this.particles = scene.add.particles(0, 0, particleKey, {
      x: { min: -width / 2, max: width / 2 },
      y: { min: -10, max: 10 },
      lifespan: 1200,
      speedY: { min: -30, max: -60 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.7, end: 0 },
      frequency: 80,
      blendMode: 'ADD',
      tint: [0xCCE8FF, 0xE0F0FF, 0xFFFFFF],
      maxParticles: WIND_CURRENT.PARTICLE_COUNT + 4,
    });
    this.add(this.particles);

    // Sparkle particles — small bright dots that twinkle along the current
    this.sparkles = scene.add.particles(0, 0, particleKey, {
      x: { min: -width / 2, max: width / 2 },
      y: { min: -4, max: 4 },
      lifespan: 800,
      speedY: { min: -15, max: -35 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.4, end: 0.05 },
      alpha: { start: 1, end: 0 },
      frequency: 150,
      blendMode: 'ADD',
      tint: [0xFFFFFF, 0xFFEECC, 0xDDEEFF],
      maxParticles: 8,
    });
    this.add(this.sparkles);

    // Watercolor-style indicator band with halo glow
    this.indicator = scene.add.graphics();
    // Outer halo — wide and soft
    this.indicator.fillStyle(0x88CCFF, 0.10);
    this.indicator.fillRoundedRect(-width / 2 - 12, -16, width + 24, 32, 16);
    // Mid halo glow
    this.indicator.fillStyle(0xAADDFF, 0.12);
    this.indicator.fillRoundedRect(-width / 2 - 4, -10, width + 8, 20, 10);
    // Inner glow band
    this.indicator.fillStyle(0xCCEEFF, 0.15);
    this.indicator.fillRoundedRect(-width / 2, -6, width, 12, 6);
    // Main indicator line — brighter
    this.indicator.lineStyle(3, 0xBBEEFF, 0.55);
    this.indicator.beginPath();
    this.indicator.moveTo(-width / 2, 0);
    this.indicator.lineTo(width / 2, 0);
    this.indicator.strokePath();
    // Outer glow line — wider
    this.indicator.lineStyle(16, 0x88CCFF, 0.15);
    this.indicator.beginPath();
    this.indicator.moveTo(-width / 2, 0);
    this.indicator.lineTo(width / 2, 0);
    this.indicator.strokePath();
    // Edge sparkle dots at the ends
    this.indicator.fillStyle(0xFFFFFF, 0.6);
    this.indicator.fillCircle(-width / 2, 0, 3);
    this.indicator.fillCircle(width / 2, 0, 3);
    this.indicator.fillStyle(0xBBEEFF, 0.3);
    this.indicator.fillCircle(-width / 2, 0, 6);
    this.indicator.fillCircle(width / 2, 0, 6);
    this.add(this.indicator);

    scene.add.existing(this);
  }

  /**
   * Mark this wind current as caught.
   * Plays a visual feedback animation.
   */
  catch() {
    if (!this.active) return;
    this.caught = true;
    this.active = false;

    // Flash and fade out
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false);
      },
    });

    // Stop particle emitters
    if (this.particles) this.particles.stop();
    if (this.sparkles) this.sparkles.stop();
  }

  /**
   * Mark this wind current as missed.
   */
  miss() {
    if (!this.active) return;
    this.passed = true;
    this.active = false;

    // Dim and fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0.1,
      duration: 500,
    });
  }

  /**
   * Check if a given Y position has passed below this wind current.
   * @param {number} airplaneY - The airplane's world Y
   * @returns {boolean}
   */
  hasBeenPassedBy(airplaneY) {
    // In Phaser, Y increases downward. Airplane rises (Y decreases).
    // Wind current is "missed" when airplane is significantly above it.
    return airplaneY < this.y - 50;
  }

  /**
   * Clean up.
   */
  destroy() {
    // Kill any active tweens targeting this container
    if (this.scene && this.scene.tweens) this.scene.tweens.killTweensOf(this);
    // Remove children before super.destroy() to avoid double-destroy
    if (this.particles) { this.remove(this.particles); this.particles.destroy(); this.particles = null; }
    if (this.sparkles) { this.remove(this.sparkles); this.sparkles.destroy(); this.sparkles = null; }
    if (this.indicator) { this.remove(this.indicator); this.indicator.destroy(); this.indicator = null; }
    super.destroy();
  }
}
