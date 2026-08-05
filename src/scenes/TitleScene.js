import Phaser from 'phaser';
import AudioManager from '../systems/AudioManager.js';
import ScoreManager from '../systems/ScoreManager.js';
import { UI, GAME, SCORING, VISUAL, MODES } from '../utils/constants.js';
import { getSavedMode, saveMode } from '../utils/modes.js';

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

    // ── Mode select: two quiet chips, Drift is the front door ─────────
    this.selectedMode = getSavedMode();
    this._modeChips = {};

    const chipY = height * 0.68;
    this._createModeChip(MODES.DRIFT, 'Drift', 'just fly', width / 2 - 78, chipY);
    this._createModeChip(MODES.ASCENT, 'Ascent', 'chase the height', width / 2 + 78, chipY);
    this._refreshModeChips();

    // Tap to start - pulsing
    const startText = this.add.text(width / 2, height * 0.79, 'Tap to Start', {
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

    // Tap anywhere (except a mode chip) to start. Chip taps only select.
    this._starting = false;
    this.input.on('pointerdown', async (pointer) => {
      if (this._starting) return;
      if (this._pointerOnChip(pointer)) return;
      this._starting = true;

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
        this.scene.start('GameScene', { mode: this.selectedMode });
      });
    });
  }

  /**
   * Create one mode chip: name over a whispered description.
   * @private
   */
  _createModeChip(mode, name, blurb, x, y) {
    const bg = this.add.graphics();
    const chipW = 132;
    const chipH = 52;

    const nameText = this.add.text(x, y - 8, name, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '18px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const blurbText = this.add.text(x, y + 12, blurb, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '12px',
      color: UI.COLORS.TEXT_PRIMARY,
    }).setOrigin(0.5).setAlpha(0.6);

    const zone = this.add.zone(x, y, chipW, chipH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      this.selectedMode = mode;
      saveMode(mode);
      this._refreshModeChips();
    });

    this._modeChips[mode] = { bg, nameText, blurbText, zone, x, y, chipW, chipH };
  }

  /**
   * Redraw chips to reflect the current selection.
   * @private
   */
  _refreshModeChips() {
    for (const [mode, chip] of Object.entries(this._modeChips)) {
      const selected = mode === this.selectedMode;
      chip.bg.clear();
      chip.bg.fillStyle(0xFFFFFF, selected ? 0.22 : 0.07);
      chip.bg.fillRoundedRect(chip.x - chip.chipW / 2, chip.y - chip.chipH / 2, chip.chipW, chip.chipH, 12);
      if (selected) {
        chip.bg.lineStyle(1, 0xFFFFFF, 0.5);
        chip.bg.strokeRoundedRect(chip.x - chip.chipW / 2, chip.y - chip.chipH / 2, chip.chipW, chip.chipH, 12);
      }
      chip.nameText.setAlpha(selected ? 1 : 0.55);
      chip.blurbText.setAlpha(selected ? 0.7 : 0.35);
    }
  }

  /**
   * Whether a pointer event landed on one of the mode chips.
   * @private
   */
  _pointerOnChip(pointer) {
    for (const chip of Object.values(this._modeChips)) {
      const b = chip.zone.getBounds();
      if (b.contains(pointer.x, pointer.y)) return true;
    }
    return false;
  }
}
