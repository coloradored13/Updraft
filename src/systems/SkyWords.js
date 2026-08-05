import { UI, GAME, VISUAL, DRIFT_TUNING } from '../utils/constants.js';
import { randomRange } from '../utils/helpers.js';

/**
 * One poem, distributed across the climb. Each phase continues the thought
 * of the one before it — dawn releases you, day empties out, gold holds you,
 * twilight introduces the stars, night keeps the record.
 */
const PHASE_LINES = {
  dawn: [
    'The morning lets you go.',
    'Paper wings. Warm air.',
    'The rooftops wave you past.',
  ],
  day: [
    'The world becomes a map.',
    'Nothing down there needs you right now.',
    'The blue goes on and on.',
  ],
  golden: [
    'Everything the light touches turns soft.',
    'The clouds keep the warmth.',
    'You could stay in this hour forever.',
  ],
  twilight: [
    'First stars. They’ve been waiting.',
    'The air is thin and kind.',
    'Half the sky still remembers the sun.',
  ],
  night: [
    'The sky keeps every flight.',
    'Almost among the stars now.',
    'Quiet enough to hear your own wings.',
  ],
};

/** Lines for when the player has found a rhythm — the sky notices. */
const FLOW_LINES = [
  'You’ve found the rhythm the wind uses.',
  'The sky is showing off for you.',
  'This is what gliding is for.',
];

/** Lines for when the player is struggling — reassurance, never instruction. */
const STRUGGLE_LINES = [
  'The wind always comes back.',
  'No hurry. The sky isn’t going anywhere.',
  'Rest on the air a moment.',
];

/**
 * SkyWords - Responsive ambient text for Drift mode.
 *
 * Replaces fixed-altitude distance markers with lines chosen by how the
 * flight is actually going: smooth streaks earn wonder, rough patches earn
 * reassurance, and everything else continues the phase poem. Lines appear
 * at irregular intervals so the sky never feels metronomic.
 */
export default class SkyWords {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    /** @private */
    this.scene = scene;
    /** @private {number} Altitude (m) at which the next line may appear */
    this._nextAltitude = 700;
    /** @private {string} Last line spoken, to avoid immediate repeats */
    this._lastLine = '';
    /** @private {boolean} Which side the next line appears on */
    this._sideLeft = Math.random() > 0.5;
    /** @private {Phaser.GameObjects.Text[]} Active text objects */
    this._elements = [];
  }

  /**
   * Get the sky phase name for an altitude.
   * @param {number} altitude - Altitude in meters
   * @returns {string} Phase name
   */
  phaseFor(altitude) {
    let name = VISUAL.SKY_PHASES[0].name;
    for (const p of VISUAL.SKY_PHASES) {
      if (altitude >= p.altitude) name = p.name;
    }
    return name;
  }

  /**
   * Maybe speak a line, based on altitude and current flight state.
   * @param {number} altitudeMeters - Current altitude
   * @param {'flow'|'struggle'|'ambient'} state - How the flight is going
   */
  update(altitudeMeters, state) {
    if (altitudeMeters < this._nextAltitude) return;
    this._nextAltitude = altitudeMeters
      + randomRange(DRIFT_TUNING.WORD_INTERVAL_MIN, DRIFT_TUNING.WORD_INTERVAL_MAX);

    let pool;
    if (state === 'struggle') {
      pool = STRUGGLE_LINES;
    } else if (state === 'flow' && Math.random() < 0.6) {
      pool = FLOW_LINES;
    } else {
      pool = PHASE_LINES[this.phaseFor(altitudeMeters)] || PHASE_LINES.dawn;
    }

    let line = pool[Math.floor(Math.random() * pool.length)];
    if (line === this._lastLine && pool.length > 1) {
      line = pool[(pool.indexOf(line) + 1) % pool.length];
    }
    this._lastLine = line;
    this._speak(line);
  }

  /**
   * Render a line drifting in the sky ahead of the airplane.
   * @private
   * @param {string} line
   */
  _speak(line) {
    const cam = this.scene.cameras.main;
    const worldY = cam.scrollY + this.scene.scale.height * 0.18;
    this._sideLeft = !this._sideLeft;
    const x = this._sideLeft
      ? UI.HUD_PADDING + 14
      : GAME.WIDTH - UI.HUD_PADDING - 14;

    const text = this.scene.add.text(x, worldY, line, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '15px',
      color: '#FFFFFF',
      fontStyle: 'italic',
      wordWrap: { width: GAME.WIDTH * 0.6 },
      shadow: { offsetX: 0, offsetY: 0, color: '#FFFFFF44', blur: 6, fill: true },
    }).setOrigin(this._sideLeft ? 0 : 1, 0.5).setAlpha(0).setDepth(4);

    this.scene.tweens.add({
      targets: text,
      alpha: 0.55,
      duration: 900,
      ease: 'Sine.easeIn',
    });

    this._elements.push(text);
  }

  /**
   * Destroy lines that have scrolled well below the camera.
   * @param {number} cameraScrollY
   */
  cleanup(cameraScrollY) {
    const cutoff = cameraScrollY + this.scene.scale.height + 200;
    this._elements = this._elements.filter((el) => {
      if (el.y > cutoff) {
        el.destroy();
        return false;
      }
      return true;
    });
  }
}
