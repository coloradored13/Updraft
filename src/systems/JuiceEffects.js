import { UI, VISUAL } from '../utils/constants.js';

/**
 * JuiceEffects - Manages all visual feedback and polish effects.
 *
 * All effects are gentle and dreamy to match the watercolor aesthetic:
 * - Current catch: subtle zoom pulse + paint spatter particles
 * - Streak milestones: soft light ring expanding from airplane
 * - Bird collision: smooth screen sway + painted feathers
 * - Stall/game over: gentle tumble spiral with fading trail
 * - Direction change: smooth bank with brief paint-streak trail
 * - Phase transition: subtle color wash sweep
 */
export default class JuiceEffects {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    /** @private */
    this.scene = scene;
    /** @private Camera sway state for bird collision */
    this._swayActive = false;
    /** @private */
    this._swayAmplitude = 0;
    /** @private */
    this._swayDecay = 0.95;
    /** @private */
    this._swayTime = 0;
    /** @private Previous phase for transition detection */
    this._prevPhase = null;
  }

  /**
   * Call every frame to update continuous effects.
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    this._updateSway(time, delta);
  }

  // ── Current Catch ───────────────────────────────────────────────────────

  /**
   * Subtle zoom pulse (2-3% scale for ~200ms) + paint spatter particle burst.
   * @param {number} x - World X
   * @param {number} y - World Y
   */
  catchPulse(x, y) {
    const cam = this.scene.cameras.main;

    // Subtle zoom pulse
    this.scene.tweens.add({
      targets: cam,
      zoom: 1.025,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // Paint spatter particle burst
    if (this.scene.textures.exists('spatter')) {
      const burst = this.scene.add.particles(x, y, 'spatter', {
        speed: { min: 30, max: 80 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        quantity: 8,
        blendMode: 'ADD',
        tint: [0xFFFFFF, 0xFFD700, 0xAED6F1],
      });
      burst.explode(8);
      this.scene.time.delayedCall(500, () => burst.destroy());
    }
  }

  // ── Streak Milestone ────────────────────────────────────────────────────

  /**
   * Soft light ring expanding from airplane and fading.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {string} type - 'small' or 'large'
   */
  streakRing(x, y, type) {
    const g = this.scene.add.graphics();
    g.setDepth(50);

    const maxRadius = type === 'large' ? 80 : 50;
    const duration = type === 'large' ? 800 : 600;
    const lineWidth = type === 'large' ? 3 : 2;
    const color = type === 'large' ? 0xFFD700 : 0xFFFFFF;

    let progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration,
      ease: 'Power2',
      onUpdate: () => {
        g.clear();
        const radius = maxRadius * progress.t;
        const alpha = 1 - progress.t;
        g.lineStyle(lineWidth, color, alpha * 0.6);
        g.strokeCircle(x, y, radius);
        // Secondary outer ring for large
        if (type === 'large') {
          g.lineStyle(1, color, alpha * 0.3);
          g.strokeCircle(x, y, radius * 1.3);
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  // ── Bird Collision ──────────────────────────────────────────────────────

  /**
   * Smooth screen sway oscillation (NOT shake) + feather drift.
   * @param {number} x - World X of collision
   * @param {number} y - World Y of collision
   */
  birdHitSway(x, y) {
    // Start smooth sine-wave camera offset that decays
    this._swayActive = true;
    this._swayAmplitude = 6;
    this._swayTime = 0;

    // Painted feathers drift away
    if (this.scene.textures.exists('feather')) {
      const feathers = this.scene.add.particles(x, y, 'feather', {
        speed: { min: 10, max: 40 },
        angle: { min: 200, max: 340 },
        rotate: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 800, max: 1500 },
        gravityY: 20,
        quantity: 5,
        tint: [0xDDDDDD, 0xCCBBAA, 0xEEDDCC],
      });
      feathers.explode(5);
      this.scene.time.delayedCall(1600, () => feathers.destroy());
    }
  }

  /**
   * Update camera sway each frame.
   * @private
   */
  _updateSway(time, delta) {
    if (!this._swayActive) return;

    this._swayTime += delta * 0.008;
    this._swayAmplitude *= this._swayDecay;

    if (this._swayAmplitude < 0.1) {
      this._swayActive = false;
      this.scene.cameras.main.setFollowOffset(0, 0);
      return;
    }

    const offset = Math.sin(this._swayTime * 8) * this._swayAmplitude;
    this.scene.cameras.main.setFollowOffset(offset, 0);
  }

  // ── Stall / Game Over ───────────────────────────────────────────────────

  /**
   * Airplane gently tumbles and spirals with fading watercolor trail.
   * Called from GameScene when game over starts.
   * @param {Phaser.GameObjects.Container} airplane
   */
  stallSpiral(airplane) {
    // Create a fading trail behind the airplane as it spirals
    if (this.scene.textures.exists('trail_particle')) {
      const trail = this.scene.add.particles(0, 0, 'trail_particle', {
        follow: airplane,
        lifespan: 1000,
        speed: { min: 2, max: 8 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.5, end: 0 },
        frequency: 30,
        blendMode: 'ADD',
        tint: [0xFFFFFF, 0xDDCCBB],
      });

      // Stop after a while
      this.scene.time.delayedCall(1500, () => {
        trail.stop();
        this.scene.time.delayedCall(1100, () => trail.destroy());
      });
    }
  }

  // ── Direction Change ────────────────────────────────────────────────────

  /**
   * Brief paint-streak trail in turn direction.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} direction - -1 (left) or 1 (right)
   */
  directionStreak(x, y, direction) {
    if (!this.scene.textures.exists('trail_particle')) return;

    const streak = this.scene.add.particles(x, y, 'trail_particle', {
      speedX: { min: -20 * direction, max: -50 * direction },
      speedY: { min: -5, max: 5 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 300,
      quantity: 4,
      blendMode: 'ADD',
    });
    streak.explode(4);
    this.scene.time.delayedCall(400, () => streak.destroy());
  }

  // ── Level Up ────────────────────────────────────────────────────────────

  /**
   * Dramatic level-up visual effect: expanding rings + screen flash.
   * @param {number} x - World X (airplane position)
   * @param {number} y - World Y (airplane position)
   * @param {number} color - Level theme color as 0xRRGGBB
   */
  levelUpEffect(x, y, color) {
    // Double expanding ring burst
    for (let i = 0; i < 2; i++) {
      const g = this.scene.add.graphics().setDepth(50);
      const maxRadius = 100 + i * 40;
      const delay = i * 150;
      const progress = { t: 0 };

      this.scene.tweens.add({
        targets: progress,
        t: 1,
        duration: 900,
        delay,
        ease: 'Power2',
        onUpdate: () => {
          g.clear();
          const radius = maxRadius * progress.t;
          const alpha = 1 - progress.t;
          g.lineStyle(3 - i, color, alpha * 0.7);
          g.strokeCircle(x, y, radius);
        },
        onComplete: () => g.destroy(),
      });
    }

    // Full-screen color flash at 0.3 alpha, fading over 500ms
    const { width, height } = this.scene.scale;
    const flash = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(96).setAlpha(0);
    flash.fillStyle(color, 1.0);
    flash.fillRect(0, 0, width, height);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0.3,
      duration: 100,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 500,
          ease: 'Sine.easeIn',
          onComplete: () => flash.destroy(),
        });
      },
    });

    // Zoom pulse (slightly larger than catch pulse)
    const cam = this.scene.cameras.main;
    this.scene.tweens.add({
      targets: cam,
      zoom: 1.04,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // Paint spatter burst in level color
    if (this.scene.textures.exists('spatter')) {
      const burst = this.scene.add.particles(x, y, 'spatter', {
        speed: { min: 40, max: 120 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 600,
        quantity: 14,
        blendMode: 'ADD',
        tint: [color, 0xFFFFFF, color],
      });
      burst.explode(14);
      this.scene.time.delayedCall(700, () => burst.destroy());
    }
  }

  // ── Phase Transition ────────────────────────────────────────────────────

  /**
   * Subtle color wash sweep across screen when crossing to a new phase.
   * @param {string} phaseName - The new phase name
   */
  phaseTransitionWash(phaseName) {
    const { width, height } = this.scene.scale;
    const phase = VISUAL.SKY_PHASES.find(p => p.name === phaseName);
    if (!phase) return;

    const g = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(95).setAlpha(0);

    g.fillStyle(phase.midColor, 0.15);
    g.fillRect(0, 0, width, height);

    this.scene.tweens.add({
      targets: g,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => g.destroy(),
    });
  }

  /**
   * Storm cloud audio muffling integration.
   * Call when entering a storm cloud.
   */
  stormEnter() {
    if (this.scene.audioManager) {
      this.scene.audioManager.setMuffled(true);
      this.scene.audioManager.playSFX('stormEnter');
    }
  }

  /**
   * Call when exiting a storm cloud.
   */
  stormExit() {
    if (this.scene.audioManager) {
      this.scene.audioManager.setMuffled(false);
      this.scene.audioManager.playSFX('stormExit');
    }
  }
}
