import Phaser from 'phaser';
import AudioManager from '../systems/AudioManager.js';
import ScoreManager from '../systems/ScoreManager.js';
import { UI, GAME, SCORING, VISUAL } from '../utils/constants.js';

const ENCOURAGEMENT_LINES = [
  'Take a breath.',
  'Ready when you are.',
  'The sky is waiting.',
  'No rush.',
];

const RETURN_LINES = [
  'Welcome back.',
  'The sky missed you.',
  'Ready for another flight?',
  'Good to see you again.',
];

/**
 * TitleScene - Displays the game title and a "tap to start" prompt.
 * Shows warm, personalized messaging for returning players.
 */
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.scale;
    const flightCount = ScoreManager.getFlightCount();
    const isReturning = flightCount > 0;

    // Sky journey gradient — shows all phases from dawn (bottom) to night (top)
    const bg = this.add.graphics();
    const phases = VISUAL.SKY_PHASES;
    const bandCount = phases.length;
    const bandHeight = height / bandCount;
    for (let i = 0; i < bandCount; i++) {
      // Top of screen = night (last phase), bottom = dawn (first phase)
      const topPhase = phases[bandCount - 1 - i];
      const bottomPhase = phases[Math.max(bandCount - 2 - i, 0)];
      const topColor = topPhase.topColor;
      const bottomColor = i < bandCount - 1 ? bottomPhase.topColor : topPhase.bottomColor;
      bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
      bg.fillRect(0, i * bandHeight, width, bandHeight + 1);
    }

    // Title text
    this.add.text(width / 2, height * 0.3, 'Updraft', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: `${UI.TITLE_FONT_SIZE}px`,
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#00000044', blur: 4, fill: true },
    }).setOrigin(0.5);

    // Subtitle - personalized for returning players
    const subtitleText = isReturning
      ? `Flight #${flightCount + 1}`
      : 'a paper airplane journey';
    this.add.text(width / 2, height * 0.38, subtitleText, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '16px',
      color: UI.COLORS.TEXT_PRIMARY,
      alpha: 0.7,
    }).setOrigin(0.5);

    // Small airplane preview floating gently
    if (this.textures.exists('airplane')) {
      const preview = this.add.image(width / 2, height * 0.48, 'airplane');
      this.tweens.add({
        targets: preview,
        y: preview.y - 10,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Personal best display - warm phrasing
    const personalBest = parseInt(localStorage.getItem('updraft_highScore') || '0', 10);
    if (personalBest > 0) {
      this.add.text(width / 2, height * 0.55, `Your highest flight: ${personalBest}m`, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '16px',
        color: UI.COLORS.ACCENT,
        shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
      }).setOrigin(0.5);
    }

    // Rotating gentle encouragement line with soft fade
    const lines = isReturning ? RETURN_LINES : ENCOURAGEMENT_LINES;
    const encourageText = this.add.text(
      width / 2,
      height * 0.60,
      Phaser.Math.RND.pick(lines),
      {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '15px',
        color: UI.COLORS.TEXT_PRIMARY,
      }
    ).setOrigin(0.5).setAlpha(0);

    // Fade in the first line
    this.tweens.add({
      targets: encourageText,
      alpha: 0.7,
      duration: 800,
      ease: 'Sine.easeIn',
    });

    // Rotate lines every 4 seconds with crossfade
    this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: encourageText,
          alpha: 0,
          duration: 600,
          ease: 'Sine.easeOut',
          onComplete: () => {
            encourageText.setText(Phaser.Math.RND.pick(lines));
            this.tweens.add({
              targets: encourageText,
              alpha: 0.7,
              duration: 600,
              ease: 'Sine.easeIn',
            });
          },
        });
      },
    });

    // Tap to start - pulsing
    const startText = this.add.text(width / 2, height * 0.70, 'Tap to Start', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '22px',
      color: UI.COLORS.TEXT_PRIMARY,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: { from: 1, to: 0.4 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Start title ambient audio if AudioManager already exists
    if (this.game._audioManager && typeof this.game._audioManager.playTitleAmbient === 'function') {
      this.game._audioManager.playTitleAmbient();
    }

    // Tap anywhere to start (also initializes audio context)
    this.input.once('pointerdown', async () => {
      // Initialize audio context on user gesture
      if (!this.game._audioManager) {
        this.game._audioManager = new AudioManager();
      }
      await this.game._audioManager.init();

      // Stop title ambient before transitioning
      if (typeof this.game._audioManager.stopTitleAmbient === 'function') {
        this.game._audioManager.stopTitleAmbient();
      }

      // Increment flight counter for this new game
      ScoreManager.incrementFlightCount();

      this.cameras.main.fadeOut(UI.SCENE_FADE_DURATION_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }
}
