import Phaser from 'phaser';
import { AIRPLANE, PHYSICS, GAME } from '../utils/constants.js';
import { clamp, lerp } from '../utils/helpers.js';

/**
 * Airplane - The player-controlled paper airplane entity.
 *
 * Behavior:
 * - Auto-rises at a speed determined by momentum
 * - Drifts left or right based on tap input
 * - Banks visually when drifting
 * - Leaves a trail of particles
 * - Loses speed over time; catching wind currents restores speed
 * - Speed never drops below a minimum floor — no stall death
 */
export default class Airplane extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   */
  constructor(scene, x, y) {
    super(scene, x, y);

    /** @type {number} Current upward speed in px/s */
    this.riseSpeed = AIRPLANE.BASE_RISE_SPEED;

    /** @type {number} Current drift direction: -1 (left), 0 (none), 1 (right) */
    this.driftDirection = 1;

    /** @type {number} Current horizontal velocity in px/s */
    this.horizontalVelocity = 0;

    /** @type {number} Current drift speed (scaled by difficulty) */
    this.currentDriftSpeed = AIRPLANE.BASE_DRIFT_SPEED;

    /** @type {number} Current speed decay rate (set by DifficultyManager each frame) */
    this.speedDecayRate = PHYSICS.SPEED_DECAY_RATE;

    /** @type {number} Current visual banking angle in degrees (-90 = pointing up) */
    this.currentBankAngle = -90;

    /** @type {number} Minimum rise speed floor — airplane always climbs */
    this.minRiseSpeed = PHYSICS.MIN_RISE_SPEED;

    /** @type {number} Total pixels risen (for altitude tracking) */
    this.totalPixelsRisen = 0;

    /** @type {boolean} Whether currently boosted from a wind current */
    this.isBoosted = false;

    // Create the airplane sprite
    this.sprite = scene.add.image(0, 0, 'airplane');
    this.add(this.sprite);

    // Trail particle emitter
    this.trailParticles = scene.add.particles(0, 0, 'trail_particle', {
      follow: this,
      followOffset: { x: 0, y: 14 },
      lifespan: 600,
      speed: { min: 5, max: 15 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: AIRPLANE.TRAIL_ALPHA_START, end: AIRPLANE.TRAIL_ALPHA_END },
      frequency: 50,
      blendMode: 'ADD',
      maxParticles: AIRPLANE.TRAIL_LENGTH,
    });

    scene.add.existing(this);
  }

  /**
   * Toggle drift direction. Called on each tap.
   */
  toggleDirection() {
    this.driftDirection *= -1;
  }

  /**
   * Set the drift speed (called by difficulty manager).
   * @param {number} speed - New drift speed in px/s
   */
  setDriftSpeed(speed) {
    this.currentDriftSpeed = speed;
  }

  /**
   * Apply a speed boost (from catching a wind current).
   * @param {number} amount - Speed to add
   * @param {number} durationMs - Duration of boost visual feedback
   */
  applyBoost(amount, durationMs) {
    this.riseSpeed = Math.min(this.riseSpeed + amount, PHYSICS.MAX_RISE_SPEED);
    this.isBoosted = true;

    this.scene.time.delayedCall(durationMs, () => {
      this.isBoosted = false;
    });
  }

  /**
   * Apply a speed penalty (from missing a wind current or hitting an obstacle).
   * @param {number} amount - Speed to subtract
   */
  applyPenalty(amount) {
    this.riseSpeed = Math.max(this.riseSpeed - amount, this.minRiseSpeed);
  }

  /**
   * Main update loop. Called each frame.
   * @param {number} delta - Frame delta in ms
   * @returns {{ pixelsRisen: number }} Distance risen this frame
   */
  update(delta) {
    const dt = delta / 1000;

    // Natural speed decay (dynamic, set by DifficultyManager)
    this.riseSpeed -= this.speedDecayRate * dt;
    this.riseSpeed = Math.max(this.riseSpeed, this.minRiseSpeed);

    // Vertical movement (airplane rises; camera follows, so we move Y upward)
    const pixelsRisen = this.riseSpeed * dt;
    this.y -= pixelsRisen;
    this.totalPixelsRisen += pixelsRisen;

    // Horizontal drift
    const targetHVel = this.driftDirection * this.currentDriftSpeed;
    this.horizontalVelocity = lerp(this.horizontalVelocity, targetHVel, 1 - Math.pow(PHYSICS.LATERAL_DAMPING, dt * 60));
    this.x += this.horizontalVelocity * dt;

    // Screen wrapping
    const halfW = GAME.WIDTH / 2;
    const margin = AIRPLANE.WIDTH;
    if (this.x < -margin) {
      this.x = GAME.WIDTH + margin;
    } else if (this.x > GAME.WIDTH + margin) {
      this.x = -margin;
    }

    // Banking visual — base angle -90 so nose points UP, bank left/right from vertical
    const targetAngle = -90 + this.driftDirection * AIRPLANE.BANKING_ANGLE;
    this.currentBankAngle = lerp(this.currentBankAngle, targetAngle, AIRPLANE.BANKING_LERP);
    this.sprite.setAngle(this.currentBankAngle);
    this.sprite.x = 0;

    return { pixelsRisen };
  }

  /**
   * Clean up resources.
   */
  destroy() {
    if (this.trailParticles) {
      this.trailParticles.destroy();
    }
    super.destroy();
  }
}
