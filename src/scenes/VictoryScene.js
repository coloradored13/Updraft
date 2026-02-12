import Phaser from 'phaser';
import ScoreManager from '../systems/ScoreManager.js';
import { UI } from '../utils/constants.js';

const VICTORY_LINES = [
  'You touched the stars.',
  'The sky was never the limit.',
  'A paper airplane that dreamed big.',
  'You made it all the way.',
  'Above the clouds, above it all.',
];

// Paper airplane constellation — 12 stars forming the silhouette
// Coordinates normalized to -1..1 range, centered on origin
const CONSTELLATION_STARS = [
  // Nose
  { x: 0, y: -0.48 },
  // Upper fuselage
  { x: -0.05, y: -0.22 },
  { x: 0.05, y: -0.22 },
  // Wing roots
  { x: -0.12, y: -0.05 },
  { x: 0.12, y: -0.05 },
  // Wingtips
  { x: -0.52, y: 0.10 },
  { x: 0.52, y: 0.10 },
  // Wing trailing edge
  { x: -0.25, y: 0.14 },
  { x: 0.25, y: 0.14 },
  // Lower fuselage
  { x: 0, y: 0.18 },
  // Tail tips
  { x: -0.14, y: 0.42 },
  { x: 0.14, y: 0.42 },
];

// Lines connecting stars to form the airplane shape (indices into CONSTELLATION_STARS)
const CONSTELLATION_LINES = [
  // Left wing
  [0, 1], [1, 3], [3, 5], [5, 7], [7, 3],
  // Right wing
  [0, 2], [2, 4], [4, 6], [6, 8], [8, 4],
  // Fuselage
  [1, 9], [2, 9],
  // Tail
  [9, 10], [9, 11],
  // Nose to wings
  [0, 5], [0, 6],
];

/**
 * VictoryScene - The paper airplane dissolves into light and becomes
 * a constellation in the night sky. A moment of awe for those who made it.
 */
export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  /**
   * @param {{ altitude: number, streak: number, personalBest: number, flightCount: number }} data
   */
  create(data) {
    const { width, height } = this.scale;
    const altitude = data?.altitude ?? 0;
    const streak = data?.streak ?? 0;
    const personalBest = data?.personalBest ?? 0;
    const flightCount = data?.flightCount ?? ScoreManager.getFlightCount();

    // ── Deep night sky background ──────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050515, 0x050515, 0x0A0A2A, 0x0A0A2A, 1);
    bg.fillRect(0, 0, width, height);

    // ── Scattered background stars (subtle) ────────────────────────────
    const bgStars = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const sr = Math.random() * 1.2 + 0.3;
      bgStars.fillStyle(0xFFFFFF, Math.random() * 0.3 + 0.05);
      bgStars.fillCircle(sx, sy, sr);
    }

    // Gentle background star twinkling
    this.tweens.add({
      targets: bgStars,
      alpha: { from: 1, to: 0.7 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Fade in from dark ──────────────────────────────────────────────
    this.cameras.main.fadeIn(1500, 0, 0, 15);

    // ── Constellation setup ────────────────────────────────────────────
    const cx = width / 2;
    const cy = height * 0.38;
    const scale = Math.min(width, height) * 0.42;

    // Create star dots (initially at center, invisible)
    const starDots = CONSTELLATION_STARS.map((star) => {
      const targetX = cx + star.x * scale;
      const targetY = cy + star.y * scale;
      const dot = this.add.graphics();
      dot.fillStyle(0xFFFFFF, 1);
      dot.fillCircle(0, 0, 3);
      dot.setPosition(cx, cy);
      dot.setAlpha(0);
      dot.setDepth(10);
      return { graphics: dot, targetX, targetY };
    });

    // ── Phase 1 (0-1.5s): Points of light burst from center ───────────
    starDots.forEach((star, i) => {
      const delay = 800 + i * 80;

      // Appear as a bright flash
      this.tweens.add({
        targets: star.graphics,
        alpha: 1,
        duration: 200,
        delay: delay,
      });

      // Drift to constellation position
      this.tweens.add({
        targets: star.graphics,
        x: star.targetX,
        y: star.targetY,
        duration: 1800,
        delay: delay,
        ease: 'Cubic.easeOut',
      });
    });

    // ── Phase 2 (3s): Lines trace between stars ────────────────────────
    const lineGraphics = this.add.graphics().setAlpha(0).setDepth(5);

    this.time.delayedCall(3000, () => {
      // Draw all constellation lines
      lineGraphics.lineStyle(1.5, 0xFFD700, 0.5);
      CONSTELLATION_LINES.forEach(([from, to]) => {
        const a = starDots[from];
        const b = starDots[to];
        lineGraphics.lineBetween(a.targetX, a.targetY, b.targetX, b.targetY);
      });

      // Fade lines in
      this.tweens.add({
        targets: lineGraphics,
        alpha: 1,
        duration: 1500,
        ease: 'Sine.easeIn',
      });
    });

    // ── Phase 2b (3.5s): Stars glow golden after lines connect ─────────
    this.time.delayedCall(3500, () => {
      starDots.forEach((star, i) => {
        // Add a golden glow ring around each star
        const glow = this.add.graphics();
        glow.fillStyle(0xFFD700, 0.6);
        glow.fillCircle(0, 0, 5);
        glow.fillStyle(0xFFFFFF, 1);
        glow.fillCircle(0, 0, 2.5);
        glow.setPosition(star.targetX, star.targetY);
        glow.setAlpha(0);
        glow.setDepth(11);

        this.tweens.add({
          targets: glow,
          alpha: 1,
          duration: 400,
          delay: i * 50,
        });

        // Gentle pulse
        this.tweens.add({
          targets: glow,
          scaleX: { from: 1, to: 1.3 },
          scaleY: { from: 1, to: 1.3 },
          alpha: { from: 1, to: 0.6 },
          duration: 2000,
          delay: 1000 + i * 50,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });
    });

    // ── Phase 3 (5s): Constellation name appears ───────────────────────
    const constellationName = this.add.text(cx, cy + scale * 0.58, '— Aeroplanum —', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'italic',
      align: 'center',
      shadow: { offsetX: 0, offsetY: 0, color: '#FFD70044', blur: 8, fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    this.tweens.add({
      targets: constellationName,
      alpha: 0.7,
      duration: 1000,
      delay: 5000,
    });

    // ── Phase 4 (6s): Hero text ────────────────────────────────────────
    const heroText = this.add.text(cx, height * 0.72, 'You became the stars.', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '28px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      align: 'center',
      shadow: { offsetX: 0, offsetY: 0, color: '#FFFFFF33', blur: 12, fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    this.tweens.add({
      targets: heroText,
      alpha: 1,
      duration: 1500,
      delay: 6000,
      ease: 'Power2',
    });

    // ── Phase 5 (8s): Stats and closing lines ──────────────────────────
    const statsY = height * 0.82;

    const altText = this.add.text(cx, statsY, `${altitude}m`, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '18px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    this.tweens.add({
      targets: altText,
      alpha: 0.8,
      duration: 800,
      delay: 8000,
    });

    if (streak > 0) {
      const streakText = this.add.text(cx, statsY + 22, `Best Streak: ${streak}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '13px',
        color: '#FFFFFF',
      }).setOrigin(0.5).setAlpha(0).setDepth(10);

      this.tweens.add({
        targets: streakText,
        alpha: 0.4,
        duration: 800,
        delay: 8400,
      });
    }

    if (flightCount > 0) {
      const flightText = this.add.text(cx, statsY + 42, `Flight #${flightCount}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '12px',
        color: '#FFFFFF',
      }).setOrigin(0.5).setAlpha(0).setDepth(10);

      this.tweens.add({
        targets: flightText,
        alpha: 0.3,
        duration: 800,
        delay: 8600,
      });
    }

    // ── Rotating closing line (below everything) ───────────────────────
    const closingText = this.add.text(
      cx, height * 0.93,
      Phaser.Math.RND.pick(VICTORY_LINES),
      {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '14px',
        color: '#FFFFFF',
        fontStyle: 'italic',
        shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
      }
    ).setOrigin(0.5).setAlpha(0).setDepth(10);

    this.tweens.add({
      targets: closingText,
      alpha: 0.6,
      duration: 800,
      delay: 9000,
    });

    this.time.addEvent({
      delay: 6000,
      loop: true,
      startAt: 3000,
      callback: () => {
        this.tweens.add({
          targets: closingText,
          alpha: 0,
          duration: 600,
          onComplete: () => {
            closingText.setText(Phaser.Math.RND.pick(VICTORY_LINES));
            this.tweens.add({ targets: closingText, alpha: 0.6, duration: 600 });
          },
        });
      },
    });

    // ── Restart prompt (appears last) ──────────────────────────────────
    const restartText = this.add.text(cx, height * 0.93, 'Tap to Fly Again', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '16px',
      color: UI.COLORS.TEXT_PRIMARY,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    this.time.delayedCall(10000, () => {
      // Move closing text up, show restart below
      this.tweens.add({
        targets: closingText,
        y: height * 0.88,
        duration: 500,
      });

      this.tweens.add({
        targets: restartText,
        alpha: 1,
        duration: 500,
      });

      this.tweens.add({
        targets: restartText,
        alpha: { from: 1, to: 0.4 },
        duration: 1000,
        delay: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Enable tap to restart
      this.input.once('pointerdown', () => {
        this.cameras.main.fadeOut(UI.SCENE_FADE_DURATION_MS, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
      });
    });
  }
}
