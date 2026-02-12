import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';
import PauseOverlayScene from './scenes/PauseOverlayScene.js';
import { GAME } from './utils/constants.js';

/**
 * Updraft - A serene paper airplane game.
 * Phaser 3 configuration and entry point.
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: '#87CEEB',
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    touch: {
      capture: true,
    },
  },
  scene: [BootScene, TitleScene, GameScene, GameOverScene, VictoryScene, PauseOverlayScene],
};

const game = new Phaser.Game(config);

export default game;
