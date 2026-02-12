import { SCORING, LEVELS } from '../utils/constants.js';

const HIGH_SCORE_KEY = 'updraft_highScore';
const FIRST_PLAY_KEY = 'updraft_firstPlay';
const FLIGHT_COUNT_KEY = 'updraft_flightCount';
const TOTAL_ALTITUDE_KEY = 'updraft_totalAltitude';
const LONGEST_STREAK_KEY = 'updraft_longestStreak';
const CRASH_HISTORY_KEY = 'updraft_crashHistory';

/**
 * ScoreManager - Tracks score, altitude, wind current catch streaks,
 * and personal best via localStorage.
 *
 * Emits events via the scene's EventEmitter so other systems (AudioManager,
 * juice effects) can respond without tight coupling:
 * - 'currentCaught' : { bonusScore, streak, isMilestone, milestoneType }
 * - 'currentMissed'
 * - 'streakMilestone' : { streak, type: 'small'|'large' }
 * - 'newHighScore' : { score }
 */
export default class ScoreManager {
  /**
   * Get the persistent flight count from localStorage.
   * @returns {number}
   */
  static getFlightCount() {
    try {
      return parseInt(localStorage.getItem(FLIGHT_COUNT_KEY) || '0', 10);
    } catch (_) {
      return 0;
    }
  }

  /**
   * Get the persistent total altitude from localStorage.
   * @returns {number}
   */
  static getTotalAltitude() {
    try {
      return parseInt(localStorage.getItem(TOTAL_ALTITUDE_KEY) || '0', 10);
    } catch (_) {
      return 0;
    }
  }

  /**
   * Get the persistent longest streak ever from localStorage.
   * @returns {number}
   */
  static getLongestStreak() {
    try {
      return parseInt(localStorage.getItem(LONGEST_STREAK_KEY) || '0', 10);
    } catch (_) {
      return 0;
    }
  }

  /**
   * Record the altitude at which a crash (game over) occurred.
   * Stores the last 5 crash altitudes in localStorage.
   * @param {number} altitude - Altitude in meters at crash
   */
  static recordCrashAltitude(altitude) {
    try {
      const raw = localStorage.getItem(CRASH_HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      history.push(altitude);
      // Keep only the last 5 flights
      while (history.length > 5) {
        history.shift();
      }
      localStorage.setItem(CRASH_HISTORY_KEY, JSON.stringify(history));
    } catch (_) {
      // localStorage might be unavailable
    }
  }

  /**
   * Get the count of recent crashes below 1000m (from the last 5 flights).
   * @returns {number}
   */
  static getRecentStruggles() {
    try {
      const raw = localStorage.getItem(CRASH_HISTORY_KEY);
      if (!raw) return 0;
      const history = JSON.parse(raw);
      return history.filter(alt => alt < 1000).length;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Increment the persistent flight counter. Call at the start of each game.
   * @returns {number} The new flight count
   */
  static incrementFlightCount() {
    const count = ScoreManager.getFlightCount() + 1;
    try {
      localStorage.setItem(FLIGHT_COUNT_KEY, String(count));
    } catch (_) { /* localStorage might be unavailable */ }
    return count;
  }

  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    /** @private */
    this.scene = scene;
    /** @type {number} Current score */
    this.score = 0;
    /** @type {number} Current streak of consecutive wind catches */
    this.streak = 0;
    /** @type {number} Best streak achieved this run */
    this.bestStreak = 0;
    /** @type {number} Total wind currents caught */
    this.totalCatches = 0;
    /** @type {number} Total wind currents missed */
    this.totalMisses = 0;
    /** @type {number} Highest altitude-based score component (prevents score from decreasing) */
    this._peakAltitudeScore = 0;
    /** @type {number} Bonus score accumulated from wind catches */
    this._bonusScore = 0;
    /** @type {number} Personal best altitude from localStorage */
    this._personalBest = this._loadHighScore();
    /** @type {boolean} Whether the current run has set a new high score */
    this._isNewHighScore = false;
    /** @type {number} Current level (1-based) */
    this.level = 1;
    /** @type {string} Current level name */
    this.levelName = LEVELS.STAGES[0].name;
  }

  /**
   * Add altitude-based score. Score only goes up, never decreases.
   * @param {number} altitudeMeters - Current altitude
   */
  addAltitudeScore(altitudeMeters) {
    const altScore = Math.floor(altitudeMeters * SCORING.ALTITUDE_SCORE_RATE);
    if (altScore > this._peakAltitudeScore) {
      this._peakAltitudeScore = altScore;
    }
    this.score = this._peakAltitudeScore + this._bonusScore;
  }

  /**
   * Register a wind current catch. Increments streak and adds bonus score.
   * @returns {{ bonusScore: number, streak: number, isMilestone: boolean, milestoneType: string|null }}
   */
  onWindCatch() {
    this.streak++;
    this.totalCatches++;
    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
    }

    const multiplier = 1 + (this.streak * SCORING.STREAK_BONUS_MULTIPLIER);
    const bonusScore = Math.floor(SCORING.WIND_CATCH_SCORE * multiplier);
    this._bonusScore += bonusScore;
    this.score = this._peakAltitudeScore + this._bonusScore;

    let isMilestone = false;
    let milestoneType = null;

    if (this.streak > 0 && this.streak % SCORING.STREAK_MILESTONE_LARGE === 0) {
      isMilestone = true;
      milestoneType = 'large';
    } else if (this.streak > 0 && this.streak % SCORING.STREAK_MILESTONE_SMALL === 0) {
      isMilestone = true;
      milestoneType = 'small';
    }

    const result = { bonusScore, streak: this.streak, isMilestone, milestoneType };

    // Emit events for AudioManager and juice effects
    this.scene.events.emit('currentCaught', result);
    if (isMilestone) {
      this.scene.events.emit('streakMilestone', { streak: this.streak, type: milestoneType });
    }

    return result;
  }

  /**
   * Register a missed wind current. Resets streak.
   */
  onWindMiss() {
    this.streak = 0;
    this.totalMisses++;
    this.scene.events.emit('currentMissed');
  }

  /**
   * Check if altitude has crossed a level threshold.
   * @param {number} altitudeMeters - Current altitude
   * @returns {{ leveledUp: boolean, level: number, name: string, color: number }|null}
   */
  checkLevelUp(altitudeMeters) {
    const stages = LEVELS.STAGES;
    let newLevel = 1;
    for (let i = stages.length - 1; i >= 0; i--) {
      if (altitudeMeters >= stages[i].altitude) {
        newLevel = stages[i].level;
        break;
      }
    }

    if (newLevel > this.level) {
      this.level = newLevel;
      const stage = stages[newLevel - 1];
      this.levelName = stage.name;
      this.scene.events.emit('levelUp', { level: newLevel, name: stage.name, color: stage.color });
      return { leveledUp: true, level: newLevel, name: stage.name, color: stage.color };
    }
    return null;
  }

  /**
   * Get the current score.
   * @returns {number}
   */
  getCurrentScore() {
    return this.score;
  }

  /**
   * Get the current streak count.
   * @returns {number}
   */
  getStreak() {
    return this.streak;
  }

  /**
   * Get personal best altitude from localStorage.
   * @returns {number}
   */
  getPersonalBest() {
    return this._personalBest;
  }

  /**
   * Check if the current altitude is a new high score.
   * @param {number} altitudeMeters - Current altitude
   * @returns {boolean}
   */
  isNewHighScore(altitudeMeters) {
    if (altitudeMeters > this._personalBest) {
      this._isNewHighScore = true;
      return true;
    }
    return false;
  }

  /**
   * Check if this is the player's first ever play.
   * @returns {boolean}
   */
  isFirstPlay() {
    return !localStorage.getItem(FIRST_PLAY_KEY);
  }

  /**
   * Mark that the player has completed their first play.
   */
  markFirstPlayDone() {
    try {
      localStorage.setItem(FIRST_PLAY_KEY, '1');
    } catch (_) {
      // localStorage might be unavailable
    }
  }

  /**
   * Get final results for game over screen. Also saves high score.
   * @returns {{ score: number, bestStreak: number, totalCatches: number, totalMisses: number, isNewHighScore: boolean, personalBest: number }}
   */
  getResults() {
    const altitude = this._peakAltitudeScore; // altitude-based, same as meters since ALTITUDE_SCORE_RATE=1
    if (altitude > this._personalBest) {
      this._personalBest = altitude;
      this._saveHighScore(altitude);
      this._isNewHighScore = true;
    }

    // Persist cumulative stats
    try {
      const totalAlt = ScoreManager.getTotalAltitude() + altitude;
      localStorage.setItem(TOTAL_ALTITUDE_KEY, String(totalAlt));

      if (this.bestStreak > ScoreManager.getLongestStreak()) {
        localStorage.setItem(LONGEST_STREAK_KEY, String(this.bestStreak));
      }
    } catch (_) { /* localStorage might be unavailable */ }

    return {
      score: this.score,
      bestStreak: this.bestStreak,
      totalCatches: this.totalCatches,
      totalMisses: this.totalMisses,
      isNewHighScore: this._isNewHighScore,
      personalBest: this._personalBest,
      level: this.level,
      levelName: this.levelName,
      flightCount: ScoreManager.getFlightCount(),
    };
  }

  /**
   * Reset all state for a new run.
   */
  reset() {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.totalCatches = 0;
    this.totalMisses = 0;
    this._peakAltitudeScore = 0;
    this._bonusScore = 0;
    this._isNewHighScore = false;
    this.level = 1;
    this.levelName = LEVELS.STAGES[0].name;
  }

  /**
   * Load high score from localStorage.
   * @private
   * @returns {number}
   */
  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    } catch (_) {
      return 0;
    }
  }

  /**
   * Save high score to localStorage.
   * @private
   * @param {number} score
   */
  _saveHighScore(score) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch (_) {
      // localStorage might be unavailable
    }
  }
}
