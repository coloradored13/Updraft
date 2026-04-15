import Phaser from 'phaser';
import { UI, GAME } from '../utils/constants.js';

/**
 * PauseOverlayScene - A transparent overlay scene launched on top of GameScene.
 * Shows a calming dark wash with "Paused" text and current altitude.
 * Tap anywhere or press Escape/P to resume. "Land gently" triggers soft close.
 */
export default class PauseOverlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseOverlayScene' });
  }

  /**
   * @param {{ altitude: number }} data
   */
  create(data) {
    const { width, height } = this.scale;
    const altitude = data?.altitude ?? 0;

    // Semi-transparent calming dark wash
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0A0A2A, 0.65);
    overlay.fillRect(0, 0, width, height);

    // "Paused" text
    this.add.text(width / 2, height * 0.38, 'Paused', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '36px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#00000088', blur: 4, fill: true },
    }).setOrigin(0.5);

    // Current altitude
    this.add.text(width / 2, height * 0.45, `${altitude}m`, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '20px',
      color: UI.COLORS.ACCENT,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5);

    // Gentle encouragement
    this.add.text(width / 2, height * 0.52, 'Take your time', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '16px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0.6);

    // Resume prompt
    const resumeText = this.add.text(width / 2, height * 0.62, 'Tap to continue', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '18px',
      color: UI.COLORS.TEXT_PRIMARY,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: resumeText,
      alpha: { from: 1, to: 0.4 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // "Land gently" option — softer, below resume
    const landText = this.add.text(width / 2, height * 0.69, 'Land gently', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '15px',
      color: '#D4A76A',
      fontStyle: 'italic',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5).setAlpha(0.7)
      .setInteractive({ useHandCursor: true });

    landText.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      // Resume GameScene so it can run the soft close flow
      this.scene.resume('GameScene');
      // Tell GameScene to start soft close via its event system
      const gameScene = this.scene.get('GameScene');
      if (gameScene && gameScene._startSoftClose) {
        gameScene._startSoftClose();
      }
      this.scene.stop();
    });

    // Delay input slightly to prevent accidental immediate resume
    this.time.delayedCall(300, () => {
      // Tap to resume (but not on the "Land gently" text)
      this.input.on('pointerdown', (pointer) => {
        // Only resume if not clicking the land text
        const bounds = landText.getBounds();
        if (pointer.y >= bounds.top - 10 && pointer.y <= bounds.bottom + 10 &&
            pointer.x >= bounds.left - 10 && pointer.x <= bounds.right + 10) {
          return; // Let the landText handler deal with it
        }
        this._resume();
      });

      // Keyboard: Escape or P to resume
      this.input.keyboard.on('keydown-ESC', () => {
        this._resume();
      });
      this.input.keyboard.on('keydown-P', () => {
        this._resume();
      });
    });
  }

  /** @private */
  _resume() {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
