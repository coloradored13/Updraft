import Phaser from 'phaser';
import ScoreManager from '../systems/ScoreManager.js';
import { UI, VISUAL } from '../utils/constants.js';

const CLOSING_LINES = [
  'Not bad for a paper airplane.',
  'The wind remembers.',
  'See you next flight.',
  'Higher next time.',
  'Every flight counts.',
  'Even the yeti cheered you on.',
];

// Gentle guidance for players struggling at low altitude — not tutorials, just quiet hints
const STRUGGLE_HINTS = [
  'Watch for the sparkles \u2014 they mark the wind.',
  'Tap to change direction. Catch the currents.',
  'The wind is always close. Follow the glow.',
];

/**
 * Flight personality categories — keyed by flight style.
 * Each maps to a set of possible lines.
 */
const PERSONALITY_LINES = {
  graceful: [
    'You read the wind like a love letter.',
    'Every current found you waiting.',
    'The sky opened up for you.',
  ],
  flow: [
    '{streak} currents in a row. You found the rhythm.',
    'You caught the flow and held on.',
    'That streak was something special.',
  ],
  wanderer: [
    'You took the scenic route. Nothing wrong with that.',
    'Not every path is a straight line.',
    'The view from the long way round is just as good.',
  ],
  adventurer: [
    'You zigged. You zagged. You climbed anyway.',
    'An unpredictable flight. The best kind.',
    'You kept the wind guessing.',
  ],
  newcomer: [
    'Your first flight. The sky will remember.',
    'Welcome to the wind.',
    'The first time is always the hardest.',
  ],
  regular: [
    'Flight #{count}. The wind knows your name.',
    'You keep coming back. The sky notices.',
    'Another flight, another story.',
  ],
  brief: [
    'A short flight is still a flight.',
    'Sometimes you just need a moment of sky.',
    'Brief, but the wind was there.',
  ],
  endurance: [
    'The twilight kept you, didn\'t it?',
    'You flew further than most dare.',
    'The thin air suits you.',
  ],
  softClose: [
    'You chose when to land. That\'s its own kind of grace.',
    'Landing on your own terms. Quietly perfect.',
    'The golden light was a good place to rest.',
  ],
};

/**
 * GameOverScene - Displays final results with warm, encouraging messaging.
 * Leads with the level/phase name as hero text, flight personality as secondary.
 * Numbers are de-emphasized. Pacing creates a breath moment.
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  /**
   * @param {{ score: number, altitude: number, streak: number, isNewHighScore: boolean, personalBest: number, level: number, levelName: string, flightCount: number, totalCatches?: number, totalMisses?: number, softClose?: boolean }} data
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
    const totalCatches = data?.totalCatches ?? 0;
    const totalMisses = data?.totalMisses ?? 0;
    const softClose = data?.softClose ?? false;

    // Sky journey gradient background
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

    // ── Pacing: 800ms silence → personality fades in → closing line → tap prompt ──

    // Hero text: level/phase name (always visible)
    const heroMessage = `You reached the ${levelName}`;
    const heroText = this.add.text(width / 2, height * 0.22, heroMessage, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: `${UI.GAME_OVER_FONT_SIZE}px`,
      color: UI.COLORS.TEXT_PRIMARY,
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

    // Flight personality line — the secondary hero text
    const personalityLine = this._getFlightPersonality({
      totalCatches, totalMisses, streak, altitude, flightCount, softClose,
    });

    const personalityText = this.add.text(width / 2, height * 0.34, personalityLine, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '17px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: width * 0.75 },
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 3, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // Personality line fades in after 800ms silence
    this.tweens.add({
      targets: personalityText,
      alpha: 0.85,
      duration: 600,
      delay: 800,
      ease: 'Sine.easeIn',
    });

    // Altitude and streak — smaller, lower-opacity, below personality
    const statsY = height * 0.44;
    const altStatText = this.add.text(width / 2, statsY, `${altitude}m reached`, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '14px',
      color: UI.COLORS.TEXT_PRIMARY,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: altStatText,
      alpha: 0.4,
      duration: 400,
      delay: 1200,
      ease: 'Sine.easeIn',
    });

    if (streak > 0) {
      const streakStatText = this.add.text(width / 2, statsY + 20, `Best Streak: ${streak}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '13px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: streakStatText,
        alpha: 0.35,
        duration: 400,
        delay: 1300,
        ease: 'Sine.easeIn',
      });
    }

    // Total altitude across all flights
    const totalAltitude = ScoreManager.getTotalAltitude();
    if (totalAltitude > 0) {
      const totalAltText = this.add.text(width / 2, statsY + 42, `${totalAltitude}m flown across all flights`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '12px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: totalAltText,
        alpha: 0.3,
        duration: 400,
        delay: 1400,
        ease: 'Sine.easeIn',
      });
    }

    // Personal best / New high score
    const bestY = height * 0.56;
    if (isNewHighScore) {
      const newLabel = this.add.text(width / 2, bestY, 'A new personal best!', {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '20px',
        color: UI.COLORS.ACCENT,
        fontStyle: 'bold',
        shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: newLabel,
        alpha: 1,
        duration: 500,
        delay: 1500,
        ease: 'Power2',
      });

      this.tweens.add({
        targets: newLabel,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 800,
        delay: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (personalBest > 0) {
      const bestLabel = this.add.text(width / 2, bestY, `Your best: ${personalBest}m`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '15px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: bestLabel,
        alpha: 0.5,
        duration: 400,
        delay: 1500,
        ease: 'Sine.easeIn',
      });
    }

    // Flight number - subtle
    if (flightCount > 0) {
      const flightLabel = this.add.text(width / 2, height * 0.62, `Flight #${flightCount}`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '13px',
        color: UI.COLORS.TEXT_PRIMARY,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: flightLabel,
        alpha: 0.4,
        duration: 400,
        delay: 1600,
        ease: 'Sine.easeIn',
      });
    }

    // Closing line — fades in after personality
    const struggles = ScoreManager.getRecentStruggles();
    const useHints = altitude < 800 && struggles >= 2;
    const linesPool = useHints
      ? [...STRUGGLE_HINTS, ...CLOSING_LINES]
      : CLOSING_LINES;
    const firstLine = useHints ? Phaser.Math.RND.pick(STRUGGLE_HINTS) : Phaser.Math.RND.pick(CLOSING_LINES);

    const closingText = this.add.text(width / 2, height * 0.69, firstLine, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '15px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);

    // Closing line fades in after personality line
    this.tweens.add({
      targets: closingText,
      alpha: 0.7,
      duration: 600,
      delay: 1500,
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

    // Restart prompt — appears after full content pacing (2000ms total)
    const restartText = this.add.text(width / 2, height * 0.78, 'Tap to Fly Again', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '22px',
      color: UI.COLORS.TEXT_PRIMARY,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: restartText,
      alpha: 1,
      duration: 500,
      delay: 2000,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.tweens.add({
          targets: restartText,
          alpha: { from: 1, to: 0.4 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // Delay tap registration — the breath moment comes from pacing, not raw delay
    this.time.delayedCall(2000, () => {
      this.input.once('pointerdown', () => {
        this.cameras.main.fadeOut(UI.SCENE_FADE_DURATION_MS, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
      });
    });
  }

  /**
   * Determine the flight personality based on play data.
   * Returns a single descriptive line about the flight style.
   * @private
   * @param {{ totalCatches: number, totalMisses: number, streak: number, altitude: number, flightCount: number, softClose: boolean }} data
   * @returns {string}
   */
  _getFlightPersonality(data) {
    const { totalCatches, totalMisses, streak, altitude, flightCount, softClose } = data;
    const totalGates = totalCatches + totalMisses;
    const ratio = totalGates > 0 ? totalCatches / totalGates : 0;

    // Priority order: most specific → most general

    // Soft close — player chose to land
    if (softClose) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.softClose);
    }

    // Newcomer — first flight
    if (flightCount <= 1) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.newcomer);
    }

    // Brief flight
    if (altitude < 800) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.brief);
    }

    // Endurance — very high altitude
    if (altitude > 7000) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.endurance);
    }

    // Flow — impressive streak
    if (streak > 10) {
      const line = Phaser.Math.RND.pick(PERSONALITY_LINES.flow);
      return line.replace('{streak}', streak);
    }

    // Graceful — high catch ratio
    if (ratio > 0.75 && totalGates >= 5) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.graceful);
    }

    // Regular — flight milestones
    if (flightCount === 10 || flightCount === 25 || flightCount === 50 || flightCount === 100) {
      const line = Phaser.Math.RND.pick(PERSONALITY_LINES.regular);
      return line.replace('{count}', flightCount);
    }

    // Adventurer — lots of both catches and misses
    if (totalCatches > 15 && totalMisses > 15) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.adventurer);
    }

    // Wanderer — low ratio but decent altitude
    if (ratio < 0.4 && altitude > 2000 && totalGates >= 5) {
      return Phaser.Math.RND.pick(PERSONALITY_LINES.wanderer);
    }

    // Default: pick from a mix
    const defaults = [
      ...PERSONALITY_LINES.adventurer,
      ...PERSONALITY_LINES.wanderer,
    ];
    return Phaser.Math.RND.pick(defaults);
  }
}
