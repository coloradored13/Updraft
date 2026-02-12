import Phaser from 'phaser';
import ScoreManager from '../systems/ScoreManager.js';
import { UI, VISUAL } from '../utils/constants.js';

const CLOSING_LINES = [
  'Not bad for a paper airplane.',
  'The wind remembers.',
  'See you next flight.',
  'Higher next time.',
  'Every flight counts.',
];

// Yeti-specific lines (Ski Free easter egg)
const YETI_LINES = [
  'You can\'t coast to the summit.',
  'The yeti always catches the lazy ones.',
  'Try catching more wind currents next time.',
  'No shortcuts to the stars.',
];

// Gentle guidance for players struggling at low altitude — not tutorials, just quiet hints
const STRUGGLE_HINTS = [
  'Watch for the sparkles \u2014 they mark the wind.',
  'Tap to change direction. Catch the currents.',
  'The wind is always close. Follow the glow.',
];

/**
 * GameOverScene - Displays final results with warm, encouraging messaging.
 * Leads with the level/phase name as hero text, numbers are secondary.
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  /**
   * @param {{ score: number, altitude: number, streak: number, isNewHighScore: boolean, personalBest: number, level: number, levelName: string, flightCount: number, yetiCaught?: boolean }} data
   */
  create(data) {
    const { width, height } = this.scale;
    const score = data?.score ?? 0;
    const altitude = data?.altitude ?? 0;
    const streak = data?.streak ?? 0;
    const isNewHighScore = data?.isNewHighScore ?? false;
    const personalBest = data?.personalBest ?? 0;
    const level = data?.level ?? 1;
    const levelName = data?.levelName ?? 'Dawn';
    const flightCount = data?.flightCount ?? ScoreManager.getFlightCount();
    const yetiCaught = data?.yetiCaught ?? false;

    // Sky journey gradient background — shows all phases from dawn (bottom) to night (top)
    const bg = this.add.graphics();
    const phases = VISUAL.SKY_PHASES;
    const bandCount = phases.length;
    const bandHeight = height / bandCount;
    for (let i = 0; i < bandCount; i++) {
      const topPhase = phases[bandCount - 1 - i];
      const bottomPhase = phases[Math.max(bandCount - 2 - i, 0)];
      const topColor = topPhase.topColor;
      const bottomColor = i < bandCount - 1 ? bottomPhase.topColor : topPhase.bottomColor;
      bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
      bg.fillRect(0, i * bandHeight, width, bandHeight + 1);
    }

    // Semi-transparent dark overlay for readability
    bg.fillStyle(0x1A1A2E, 0.55);
    bg.fillRect(0, 0, width, height);

    // Soft white rounded panel behind the content
    const panelY = height * 0.15;
    const panelH = height * 0.65;
    bg.fillStyle(0xFFFFFF, 0.08);
    bg.fillRoundedRect(width * 0.08, panelY, width * 0.84, panelH, 16);

    // Fade in
    this.cameras.main.fadeIn(UI.SCENE_FADE_DURATION_MS);

    // Hero text: level/phase name as the big headline (or yeti message)
    const heroMessage = yetiCaught
      ? 'The Yeti got you!'
      : `You reached the ${levelName}`;
    const heroText = this.add.text(width / 2, height * 0.22, heroMessage, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: `${UI.GAME_OVER_FONT_SIZE}px`,
      color: yetiCaught ? '#CCDDFF' : UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.8 },
      shadow: { offsetX: 2, offsetY: 2, color: '#00000066', blur: 4, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: heroText,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
    });

    // Altitude reached (smaller, secondary)
    const altText = this.add.text(width / 2, height * 0.38, `${altitude}m`, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: `${UI.SCORE_FONT_SIZE}px`,
      color: UI.COLORS.ACCENT,
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: altText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      delay: 200,
      ease: 'Back.easeOut',
    });

    this.add.text(width / 2, height * 0.43, 'altitude reached', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '13px',
      color: UI.COLORS.TEXT_PRIMARY,
    }).setOrigin(0.5).setAlpha(0.5);

    // Streak - smaller, below
    if (streak > 0) {
      this.add.text(width / 2, height * 0.49, `Best Streak: ${streak}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: `${UI.HUD_FONT_SIZE - 4}px`,
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0.6);
    }

    // Personal best / New high score - warmer phrasing
    const bestY = height * 0.58;
    if (isNewHighScore) {
      const newLabel = this.add.text(width / 2, bestY, 'A new personal best!', {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '20px',
        color: UI.COLORS.ACCENT,
        fontStyle: 'bold',
        shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
      }).setOrigin(0.5);

      this.tweens.add({
        targets: newLabel,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (personalBest > 0) {
      this.add.text(width / 2, bestY, `Your best: ${personalBest}m`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '15px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0.5);
    }

    // Flight number - subtle
    if (flightCount > 0) {
      this.add.text(width / 2, height * 0.63, `Flight #${flightCount}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '13px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0.4);
    }

    // Choose closing lines pool based on context
    let linesPool;
    let firstLine;
    if (yetiCaught) {
      linesPool = YETI_LINES;
      firstLine = Phaser.Math.RND.pick(YETI_LINES);
    } else {
      const struggles = ScoreManager.getRecentStruggles();
      const useHints = altitude < 800 && struggles >= 2;
      linesPool = useHints
        ? [...STRUGGLE_HINTS, ...CLOSING_LINES]
        : CLOSING_LINES;
      firstLine = useHints ? Phaser.Math.RND.pick(STRUGGLE_HINTS) : Phaser.Math.RND.pick(CLOSING_LINES);
    }

    // Rotating gentle closing line
    const closingText = this.add.text(
      width / 2,
      height * 0.70,
      firstLine,
      {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '15px',
        color: UI.COLORS.TEXT_PRIMARY,
        fontStyle: 'italic',
      }
    ).setOrigin(0.5).setAlpha(0);

    // Fade in closing line
    this.tweens.add({
      targets: closingText,
      alpha: 0.7,
      duration: 800,
      delay: 400,
      ease: 'Sine.easeIn',
    });

    // Rotate closing lines every 5 seconds
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: closingText,
          alpha: 0,
          duration: 600,
          ease: 'Sine.easeOut',
          onComplete: () => {
            closingText.setText(Phaser.Math.RND.pick(linesPool));
            this.tweens.add({
              targets: closingText,
              alpha: 0.7,
              duration: 600,
              ease: 'Sine.easeIn',
            });
          },
        });
      },
    });

    // Restart prompt - pulsing
    const restartText = this.add.text(width / 2, height * 0.78, 'Tap to Fly Again', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '22px',
      color: UI.COLORS.TEXT_PRIMARY,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: { from: 1, to: 0.4 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Delay tap registration to prevent accidental immediate restart
    this.time.delayedCall(800, () => {
      this.input.once('pointerdown', () => {
        this.cameras.main.fadeOut(UI.SCENE_FADE_DURATION_MS, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
      });
    });
  }
}
