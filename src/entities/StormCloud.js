import Phaser from 'phaser';

/**
 * StormCloud - Dark watercolor blotch hazard zone that slows the airplane.
 * Tier 2 obstacle, appears at 1500m+.
 * Features bleeding-edge watercolor shapes, occasional lightning flash,
 * and drift movement.
 */
export default class StormCloud extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X
   * @param {number} y - Center Y
   */
  constructor(scene, x, y) {
    const texKey = scene.textures.exists('wc_storm') ? 'wc_storm' : 'storm_cloud';
    super(scene, x, y, texKey);

    /** @type {boolean} Whether the player is currently inside this cloud */
    this.playerInside = false;

    /** @type {number} Slow horizontal drift speed */
    this._driftSpeed = (Math.random() - 0.5) * 8;

    /** @type {number} Timer for next lightning flash */
    this._lightningTimer = 3000 + Math.random() * 5000;

    this.setAlpha(0.8);

    scene.add.existing(this);
  }

  /**
   * Update visual effects — pulsing, drift, lightning.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    // Subtle pulsing effect
    const pulse = 0.7 + Math.sin(this.scene.time.now * 0.003) * 0.1;
    this.setAlpha(pulse);

    // Slow drift
    this.x += this._driftSpeed * (delta / 1000);

    // Occasional lightning flash
    this._lightningTimer -= delta;
    if (this._lightningTimer <= 0) {
      this._lightningFlash();
      this._lightningTimer = 3000 + Math.random() * 6000;
    }
  }

  /**
   * Brief white flash to simulate lightning.
   * @private
   */
  _lightningFlash() {
    this.setTint(0xFFFFFF);
    this.setAlpha(1);
    this.scene.time.delayedCall(80, () => {
      this.clearTint();
      this.setAlpha(0.8);
    });
  }
}
