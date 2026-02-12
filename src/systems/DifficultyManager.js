import { DIFFICULTY, WIND_CURRENT, AIRPLANE, OBSTACLES, PHYSICS } from '../utils/constants.js';
import { lerp, clamp } from '../utils/helpers.js';

/**
 * DifficultyManager - Controls all altitude-based difficulty scaling.
 *
 * As the player rises, this manager adjusts:
 * - Wind current width and spacing
 * - Drift speed
 * - Obstacle spawn rates and types
 * - Speed decay rate
 *
 * Uses an ease-out power curve (1 - (1-t)^exp) so difficulty ramps
 * quickly in mid-game then flattens near the cap. This keeps the
 * early game (0-500m) gentle while making mid-game (500-2000m) feel
 * like a real challenge and late game (2000m+) intense but possible.
 */
export default class DifficultyManager {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    /** @private */
    this.scene = scene;
  }

  /**
   * Get the normalized difficulty factor (0-1) for a given altitude.
   * Uses an ease-out power curve so difficulty ramps faster in mid-game.
   * 0 = easiest (ground level), 1 = hardest (DIFFICULTY_ALTITUDE_CAP).
   * @param {number} altitudeMeters - Current altitude in meters
   * @returns {number} Difficulty factor between 0 and 1
   */
  getDifficultyFactor(altitudeMeters) {
    const linear = clamp(altitudeMeters / DIFFICULTY.DIFFICULTY_ALTITUDE_CAP, 0, 1);
    const exp = DIFFICULTY.CURVE_EXPONENT;
    // Ease-out curve: ramps quickly early/mid, flattens near cap
    return 1 - Math.pow(1 - linear, exp);
  }

  /**
   * Get wind current parameters scaled to current altitude.
   * As altitude increases: currents get narrower and more spaced out.
   * @param {number} altitudeMeters - Current altitude in meters
   * @returns {{ width: number, spacing: number, driftOffsetMax: number }}
   */
  getWindCurrentParams(altitudeMeters) {
    const t = this.getDifficultyFactor(altitudeMeters);
    return {
      width: lerp(WIND_CURRENT.BASE_WIDTH, DIFFICULTY.WIND_WIDTH_FLOOR, t),
      spacing: lerp(WIND_CURRENT.BASE_SPACING, DIFFICULTY.WIND_SPACING_CEILING, t),
      driftOffsetMax: lerp(WIND_CURRENT.DRIFT_OFFSET_MAX * 0.4, WIND_CURRENT.DRIFT_OFFSET_MAX, t),
    };
  }

  /**
   * Get the current drift speed for the airplane at a given altitude.
   * Drift speed increases with altitude to make the game harder.
   * @param {number} altitudeMeters - Current altitude in meters
   * @returns {number} Drift speed in px/s
   */
  getDriftSpeed(altitudeMeters) {
    const t = this.getDifficultyFactor(altitudeMeters);
    return lerp(AIRPLANE.BASE_DRIFT_SPEED, AIRPLANE.BASE_DRIFT_SPEED * DIFFICULTY.DRIFT_SPEED_SCALE_MAX, t);
  }

  /**
   * Get the speed decay rate scaled to altitude.
   * Higher altitudes have faster speed decay, making catching winds more urgent.
   * @param {number} altitudeMeters - Current altitude in meters
   * @returns {number} Speed decay rate in px/s^2
   */
  getSpeedDecayRate(altitudeMeters) {
    const t = this.getDifficultyFactor(altitudeMeters);
    // Decay ramps from base rate to 1.6x at max difficulty
    return PHYSICS.SPEED_DECAY_RATE * lerp(1.0, 1.6, t);
  }

  /**
   * Get obstacle spawning parameters for the current altitude.
   * Returns which obstacle types are active and their current spawn rates.
   * Spawn rates ramp using the same ease-out curve for consistency.
   * @param {number} altitudeMeters - Current altitude in meters
   * @returns {ObstacleParams}
   */
  getObstacleParams(altitudeMeters) {
    const thresholds = DIFFICULTY.OBSTACLE_THRESHOLDS;

    /** @type {ObstacleParams} */
    const params = {
      birdsActive: altitudeMeters >= thresholds[0],
      stormCloudsActive: altitudeMeters >= thresholds[1],
      crosswindsActive: altitudeMeters >= thresholds[2],
      kitesActive: altitudeMeters >= thresholds[3],
      combinationsActive: altitudeMeters >= thresholds[4],
      birdSpawnRate: 0,
      stormCloudSpawnRate: 0,
      crosswindSpawnRate: 0,
      kiteSpawnRate: 0,
    };

    // Birds: ramp up from threshold[0] using ease-out curve
    if (params.birdsActive) {
      const birdT = this._obstacleRamp(altitudeMeters, thresholds[0]);
      params.birdSpawnRate = lerp(OBSTACLES.BIRD.SPAWN_RATE, OBSTACLES.BIRD.MAX_SPAWN_RATE, birdT);
    }

    // Storm clouds: ramp up from threshold[1]
    if (params.stormCloudsActive) {
      const stormT = this._obstacleRamp(altitudeMeters, thresholds[1]);
      params.stormCloudSpawnRate = lerp(OBSTACLES.STORM_CLOUD.SPAWN_RATE, OBSTACLES.STORM_CLOUD.MAX_SPAWN_RATE, stormT);
    }

    // Crosswinds: ramp up from threshold[2]
    if (params.crosswindsActive) {
      const crossT = this._obstacleRamp(altitudeMeters, thresholds[2]);
      params.crosswindSpawnRate = lerp(OBSTACLES.CROSSWIND.SPAWN_RATE, OBSTACLES.CROSSWIND.MAX_SPAWN_RATE, crossT);
    }

    // Kites: ramp up from threshold[3]
    if (params.kitesActive) {
      const kiteT = this._obstacleRamp(altitudeMeters, thresholds[3]);
      params.kiteSpawnRate = lerp(OBSTACLES.KITE.SPAWN_RATE, OBSTACLES.KITE.MAX_SPAWN_RATE, kiteT);
    }

    return params;
  }

  /**
   * Compute the ease-out ramp factor for an obstacle type.
   * @private
   * @param {number} altitude - Current altitude in meters
   * @param {number} threshold - Altitude where this obstacle type starts
   * @returns {number} Ramp factor between 0 and 1
   */
  _obstacleRamp(altitude, threshold) {
    const linear = clamp(
      (altitude - threshold) / (DIFFICULTY.DIFFICULTY_ALTITUDE_CAP - threshold),
      0, 1
    );
    const exp = DIFFICULTY.CURVE_EXPONENT;
    return 1 - Math.pow(1 - linear, exp);
  }

  /**
   * Calculate the spawn interval in pixels of vertical travel for a given spawn rate.
   * A spawn rate of 2 means 2 spawns per 1000px, so interval = 500px.
   * @param {number} spawnRate - Spawns per 1000px of altitude
   * @returns {number} Vertical pixels between spawns
   */
  getSpawnInterval(spawnRate) {
    if (spawnRate <= 0) return Infinity;
    return 1000 / spawnRate;
  }

  /**
   * Check if it's time to spawn an obstacle of a given type.
   * Uses a stochastic check based on distance traveled.
   * @param {number} spawnRate - Spawns per 1000px
   * @param {number} pixelsTraveled - Pixels traveled since last check
   * @returns {boolean} Whether to spawn
   */
  shouldSpawn(spawnRate, pixelsTraveled) {
    if (spawnRate <= 0) return false;
    const probability = (spawnRate * pixelsTraveled) / 1000;
    return Math.random() < probability;
  }
}

/**
 * @typedef {Object} ObstacleParams
 * @property {boolean} birdsActive
 * @property {boolean} stormCloudsActive
 * @property {boolean} crosswindsActive
 * @property {boolean} kitesActive
 * @property {boolean} combinationsActive
 * @property {number} birdSpawnRate
 * @property {number} stormCloudSpawnRate
 * @property {number} crosswindSpawnRate
 * @property {number} kiteSpawnRate
 */
