import Phaser from 'phaser';
import Airplane from '../entities/Airplane.js';
import WindCurrent from '../entities/WindCurrent.js';
import Bird from '../entities/Bird.js';
import StormCloud from '../entities/StormCloud.js';
import Crosswind from '../entities/Crosswind.js';
import Kite from '../entities/Kite.js';
import DifficultyManager from '../systems/DifficultyManager.js';
import ScoreManager from '../systems/ScoreManager.js';
import AudioManager from '../systems/AudioManager.js';
import SkyBackground from '../systems/SkyBackground.js';
import AmbientElements from '../systems/AmbientElements.js';
import JuiceEffects from '../systems/JuiceEffects.js';
import SkyWords from '../systems/SkyWords.js';
import GhostPlanes from '../systems/GhostPlanes.js';
import Companion from '../entities/Companion.js';
import {
  GAME, AIRPLANE, WIND_CURRENT, PHYSICS, SCORING,
  UI, VISUAL, DIFFICULTY, OBSTACLES, LEVELS, THERMAL, WONDER,
  MODES, DRIFT_TUNING, ASCENT_TUNING, TRICKS,
} from '../utils/constants.js';
import { pixelsToMeters, randomRange, randomInt, lerpColor, clamp } from '../utils/helpers.js';
import { getSavedMode } from '../utils/modes.js';
import { trackGameStart, trackGameOver, trackVictory } from '../utils/analytics.js';

/**
 * GameScene - Core gameplay scene.
 *
 * Loop:
 * 1. Airplane auto-rises based on current speed
 * 2. Player taps to toggle drift direction (left/right)
 * 3. Wind currents spawn ahead; catching them boosts speed
 * 4. Missing wind currents or hitting obstacles reduces speed
 * 5. Speed decays naturally to a minimum floor; airplane always climbs
 * 6. Difficulty increases with altitude (DifficultyManager)
 * 7. Camera follows airplane upward
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * @param {{ mode?: string, breath?: boolean }} data - Scene data; mode
   *   falls back to the saved choice. `breath` marks a one-breath flight.
   */
  init(data) {
    /** @type {string} Current game mode (MODES.DRIFT | MODES.ASCENT) */
    this.mode = data?.mode || getSavedMode();
    /** @type {boolean} Convenience flag — Drift is the calm default */
    this.isDrift = this.mode !== MODES.ASCENT;
    /** @type {boolean} One-breath flight: a ~3-minute arc with an early rest */
    this.isBreath = this.isDrift && Boolean(data?.breath);
  }

  create() {
    const { width, height } = this.scale;

    // ── Systems ──────────────────────────────────────────────────────────
    this.difficultyManager = new DifficultyManager(this);
    this.scoreManager = new ScoreManager(this);

    // Audio (shared singleton survives scene restarts)
    if (!this.game._audioManager) {
      this.game._audioManager = new AudioManager();
    }
    /** @type {AudioManager} */
    this.audioManager = this.game._audioManager;

    // ── Sky background (watercolor layered system) ──────────────────────
    this.skyBackground = new SkyBackground(this);

    // ── Ambient floating elements ───────────────────────────────────────
    this.ambientElements = new AmbientElements(this);

    // ── Juice effects ─────────────────────────────────────────────────────
    this.juice = new JuiceEffects(this);

    // ── Player ──────────────────────────────────────────────────────────
    this.airplane = new Airplane(this, width / 2, height * 0.7);

    // ── Wind currents pool ──────────────────────────────────────────────
    /** @type {WindCurrent[]} */
    this.windCurrents = [];
    /** @type {number} Y position of the next wind current to spawn */
    this.nextWindCurrentY = this.airplane.y - 100; // First current close and visible

    // Spawn initial set of wind currents above the airplane
    this._spawnInitialWindCurrents();

    // ── Obstacle pools ──────────────────────────────────────────────────
    /** @type {Bird[]} */
    this.birds = [];
    /** @type {StormCloud[]} */
    this.stormClouds = [];
    /** @type {Crosswind[]} */
    this.crosswinds = [];
    /** @type {Kite[]} */
    this.kites = [];

    // ── First-encounter cue tracking ────────────────────────────────────
    this._firstEncounterShown = {
      bird: false, stormCloud: false, crosswind: false, kite: false,
    };

    // ── State ────────────────────────────────────────────────────────────
    /** @type {number} Altitude in meters */
    this.altitudeMeters = 0;
    /** @type {boolean} Whether the game has ended */
    this.gameOver = false;
    /** @type {number} Pixels traveled since last obstacle spawn check */
    this.pixelsSinceObstacleCheck = 0;
    /** @type {boolean} Whether airplane is inside a storm cloud */
    this.inStorm = false;
    /** @type {number} Crosswind push being applied this frame */
    this.crosswindPush = 0;

    // ── Kindness state ────────────────────────────────────────────────
    /** @type {boolean} Whether the first wind catch of this run has happened */
    this._firstCatchDone = false;
    /** @type {boolean} Mercy flag: next spawned wind current drifts toward player */
    this._mercyNextWind = false;
    /** @type {number} X position to bias mercy wind toward */
    this._mercyTargetX = GAME.WIDTH / 2;
    /** @type {number} Next altitude (meters) at which a thermal zone spawns */
    this._nextThermalAltitude = THERMAL.INTERVAL_METERS;
    /** @type {boolean} Whether the airplane is currently inside a thermal zone */
    this._inThermalZone = false;
    /** @type {number} Y coordinate of the bottom of the active thermal zone */
    this._thermalZoneBottomY = 0;
    /** @type {number} Y coordinate of the top of the active thermal zone */
    this._thermalZoneTopY = 0;

    // ── Adaptive camera (performance-based screen position) ──────────
    /** @type {number} Performance rating 0-1. Drives airplane screen position. */
    this._performanceRating = 0.3;
    /** @type {number} Current camera offset Y (lerps toward target) */
    this._cameraOffsetY = height * 0.25;

    // ── Yeti friend (appears at 8000m+ as a friendly companion) ───────
    /** @type {boolean} Whether the yeti friend has appeared this run */
    this._yetiTriggered = false;
    /** @type {Phaser.GameObjects.Container|null} The yeti sprite container */
    this._yetiSprite = null;

    // ── Session arc state ───────────────────────────────────────────
    /** @type {boolean} Whether the session arc has been triggered this run */
    this._sessionArcTriggered = false;
    /** @type {boolean} Whether the soft close descent is in progress */
    this._softClosing = false;
    /** @type {number} Index into the rest-invitation sequence */
    this._restInviteIdx = 0;
    /**
     * The rest-invitation sequence for this flight. One-breath flights get
     * an early invitation just after the Day transition's wonder beat.
     * @type {{alt: number, message: string, glow: string, landLabel: string}[]}
     */
    this._restInvites = [];
    if (this.isDrift) {
      if (this.isBreath) {
        this._restInvites.push({
          alt: DRIFT_TUNING.BREATH_INVITE_ALTITUDE,
          message: 'That’s one breath.\nThe day can have you back.',
          glow: '#AED6F188',
          landLabel: 'Land softly',
        });
      }
      this._restInvites.push({
        alt: DRIFT_TUNING.REST_INVITE_ALTITUDES[0],
        message: 'The light is turning gold.\nYou could rest here.',
        glow: '#D4A76A88',
        landLabel: 'Land gently',
      });
      this._restInvites.push({
        alt: DRIFT_TUNING.REST_INVITE_ALTITUDES[1],
        message: 'The stars will hold you now.\nOr carry you higher.',
        glow: '#AABBFF66',
        landLabel: 'Rest among them',
      });
    }

    // ── Drift: responsive sky words + companion crane ────────────────
    /** @type {SkyWords|null} */
    this._skyWords = this.isDrift ? new SkyWords(this) : null;
    /** @type {Companion|null} */
    this._companion = null;
    /** @type {number} Index into DRIFT_TUNING.COMPANION_ALTITUDES */
    this._companionIdx = 0;

    // ── Tricks state ─────────────────────────────────────────────────
    /** @type {number} Timestamp of the last single tap (double-tap detection) */
    this._lastTapTime = 0;
    /** @type {number} Timestamp of the last trick (roll or loop) */
    this._lastRollTime = -Infinity;
    /** @type {{rollDone: boolean, loopDone: boolean}} Persisted trick knowledge */
    this._tricks = this._loadTricks();
    /** @type {number} Pointer-down y for swipe detection */
    this._pressY = 0;
    /** @type {number} Pointer-down time for swipe detection */
    this._pressTime = 0;

    // ── Ghost planes: record every flight; replay past ones in Drift ──
    /** @type {GhostPlanes} */
    this._ghosts = new GhostPlanes(this, this.airplane, (a) => this._altitudeToWorldY(a));
    if (this.isDrift) {
      this._ghosts.spawnReplays();
      this.events.once('ghost-visible', () => {
        if (this._skyWords) this._skyWords.speak('The sky remembers your last flight.');
      });
    }
    // Save on shutdown so every ending — chosen, wind-set, victorious,
    // or abandoned — leaves a trace behind.
    this.events.once('shutdown', () => this._ghosts.saveTrace());

    // The crane's demonstrations: trick → expectant pause → gesture cue
    /** @type {number} Invitations shown during the current companion visit */
    this._invitesThisVisit = 0;
    this.events.on('companion-demo', (trick) => this._onCompanionDemo(trick));

    // ── Ascent: stall watch ──────────────────────────────────────────
    /** @type {number} Seconds spent pinned at minimum rise speed */
    this._stallSeconds = 0;
    /** @type {Phaser.GameObjects.Text|null} The quiet stall warning */
    this._stallWarningText = null;


// ── Wonder moments state ──────────────────────────────────────────
    /** @type {Set<number>} Altitude thresholds already triggered for cloud break-throughs */
    this._cloudBreakTriggered = new Set();
    /** @type {Set<number>} Altitude thresholds already triggered for distance markers */
    this._distanceMarkerTriggered = new Set();
    /** @type {number} Next altitude for spawning a friendly passing element */
    this._nextFriendlyAltitude = WONDER.FRIENDLY_START_ALTITUDE;
    /** @type {number} Last altitude that triggered a sparkle (to avoid duplicates at level-up) */
    this._lastSparkleAltitude = 0;
    /** @type {Phaser.GameObjects.GameObject[]} Active wonder elements for cleanup */
    this._wonderElements = [];

    // ── Camera ──────────────────────────────────────────────────────────
    // Follow airplane but keep it in the lower third — 70% of screen shows what's ahead
    this.cameras.main.startFollow(this.airplane, false, 0, 0.1, 0, height * 0.25);
    this.cameras.main.setDeadzone(0, height * 0.15);
    this.cameras.main.fadeIn(UI.SCENE_FADE_DURATION_MS);

    // ── Storm vignette overlay ──────────────────────────────────────────
    this.vignetteGraphics = this.add.graphics()
      .setScrollFactor(0).setDepth(90).setAlpha(0);

    // ── HUD (fixed to camera) ───────────────────────────────────────────
    // Semi-transparent watercolor wash backing for the top HUD
    this.hudBacking = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.hudBacking.fillStyle(0x000000, 0.15);
    this.hudBacking.fillRoundedRect(width / 2 - 70, 6, 140, 38, 8);

    // Phase name: top-center, replaces numeric altitude display
    this.altitudeText = this.add.text(width / 2, UI.HUD_PADDING, 'Dawn', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: `${UI.SCORE_FONT_SIZE - 4}px`,
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: UI.COLORS.TEXT_SHADOW, blur: 2, fill: true },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Small altitude number beneath phase name, low opacity
    this.altitudeSubText = this.add.text(width / 2, UI.HUD_PADDING + 26, '0m', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '13px',
      color: UI.COLORS.TEXT_PRIMARY,
      shadow: { offsetX: 1, offsetY: 1, color: UI.COLORS.TEXT_SHADOW, blur: 2, fill: true },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setAlpha(0.3);

    // Level indicator, speed bar, progress bar: Ascent only.
    // Drift's HUD is just the phase name and a whisper of altitude.
    if (!this.isDrift) {
      this.levelText = this.add.text(UI.HUD_PADDING, UI.HUD_PADDING, 'Lv 1', {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '14px',
        color: UI.COLORS.TEXT_PRIMARY,
        fontStyle: 'bold',
        shadow: { offsetX: 1, offsetY: 1, color: UI.COLORS.TEXT_SHADOW, blur: 2, fill: true },
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(100).setAlpha(0.8);

      this.speedBar = this.add.graphics().setScrollFactor(0).setDepth(100);

      // ── Journey progress bar (left side) ─────────────────────────────
      this._createProgressBar();
    }

    // ── Pause button (top-right, small and unobtrusive) ─────────────────
    this.pauseButton = this.add.text(width - UI.HUD_PADDING, UI.HUD_PADDING, '||', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '16px',
      color: UI.COLORS.TEXT_PRIMARY,
      shadow: { offsetX: 1, offsetY: 1, color: UI.COLORS.TEXT_SHADOW, blur: 2, fill: true },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setAlpha(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => {
        pointer.event.stopPropagation();
        this._togglePause();
      });

    // ── First-play tutorial hint ────────────────────────────────────────
    if (this.scoreManager.isFirstPlay()) {
      const hint = this.add.text(width / 2, height * 0.55, 'Tap or use arrow keys', {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '18px',
        color: UI.COLORS.TEXT_PRIMARY,
        shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 2, fill: true },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.9);

      this.tweens.add({
        targets: hint,
        alpha: 0,
        delay: 3000,
        duration: 500,
        onComplete: () => hint.destroy(),
      });

      this.scoreManager.markFirstPlayDone();
    }

    // ── Analytics ──────────────────────────────────────────────────────
    trackGameStart();

    // ── Audio init on first interaction ──────────────────────────────────
    this._audioInitialized = this.audioManager._started;
    if (this._audioInitialized) {
      this.audioManager.startMusic();
    }

    // ── Track last known sky phase for crossfading ────────────────────────
    this._lastPhase = this.audioManager.getPhaseForAltitude(0);

    // ── Input ────────────────────────────────────────────────────────────
    // Single tap: change direction. Double tap: barrel roll. Swipe up:
    // loop-the-loop. Trick gestures re-toggle direction back, so no trick
    // ever changes your course.
    this.input.on('pointerdown', async (pointer) => {
      await this._initAudioOnGesture();
      if (this.gameOver) return;

      this._pressY = pointer.y;
      this._pressTime = this.time.now;

      const now = this.time.now;
      if (now - this._lastTapTime < TRICKS.DOUBLE_TAP_MS) {
        this._lastTapTime = 0;
        this.airplane.toggleDirection();
        this._doBarrelRoll();
        return;
      }
      this._lastTapTime = now;

      this.airplane.toggleDirection();
      this.audioManager.playSFX('directionChange');
      this.juice.directionStreak(
        this.airplane.x, this.airplane.y,
        this.airplane.driftDirection
      );
    });

    // Swipe-up detection on release → loop
    this.input.on('pointerup', (pointer) => {
      if (this.gameOver) return;
      const heldMs = this.time.now - this._pressTime;
      const dy = pointer.y - this._pressY;
      if (heldMs < TRICKS.SWIPE_MAX_MS && dy < -TRICKS.SWIPE_MIN_DY) {
        // The press that started this swipe toggled direction — undo it
        this.airplane.toggleDirection();
        this._lastTapTime = 0;
        this._doLoop();
      }
    });

    // Keyboard controls (arrow keys for web)
    this._cursors = this.input.keyboard.createCursorKeys();
    this._leftWasDown = false;
    this._rightWasDown = false;

    // Pause keyboard shortcuts (Escape and P)
    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.gameOver) this._togglePause();
    });
    this.input.keyboard.on('keydown-P', () => {
      if (!this.gameOver) this._togglePause();
    });

    // Barrel roll on Space or Up, loop on Down (web)
    this.input.keyboard.on('keydown-SPACE', async () => {
      await this._initAudioOnGesture();
      if (!this.gameOver) this._doBarrelRoll();
    });
    this.input.keyboard.on('keydown-UP', async () => {
      await this._initAudioOnGesture();
      if (!this.gameOver) this._doBarrelRoll();
    });
    this.input.keyboard.on('keydown-DOWN', async () => {
      await this._initAudioOnGesture();
      if (!this.gameOver) this._doLoop();
    });
  }

  /**
   * Load persisted trick knowledge.
   * @private
   * @returns {{rollDone: boolean, loopDone: boolean}}
   */
  _loadTricks() {
    try {
      const raw = localStorage.getItem('updraft_tricks');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        rollDone: Boolean(parsed.rollDone),
        loopDone: Boolean(parsed.loopDone),
      };
    } catch (_) {
      return { rollDone: false, loopDone: false };
    }
  }

  /** @private */
  _saveTricks() {
    try {
      localStorage.setItem('updraft_tricks', JSON.stringify(this._tricks));
    } catch (_) { /* localStorage might be unavailable */ }
  }

  /**
   * The crane finished a demonstration and is holding its expectant
   * pause. If the trick isn't learned yet, render the invitation:
   * a line beside the crane, and the gesture itself near the plane.
   * @private
   * @param {'roll'|'loop'} trick
   */
  _onCompanionDemo(trick) {
    if (this.gameOver) return;
    const learned = trick === 'loop' ? this._tricks.loopDone : this._tricks.rollDone;
    if (learned) return;
    if (this._invitesThisVisit >= TRICKS.INVITES_PER_VISIT) return;
    this._invitesThisVisit += 1;

    const touch = this.sys.game.device.input.touch;
    const line = trick === 'loop'
      ? (touch ? 'swipe up — like this' : 'swipe up — or ↓')
      : (touch ? 'tap twice — like this' : 'double-tap — or space');

    // The line belongs to the crane: it floats just above it and follows
    const text = this.add.text(0, 0, line, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '14px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'italic',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000055', blur: 2, fill: true },
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    const follow = this.time.addEvent({
      delay: 33,
      loop: true,
      callback: () => {
        if (!this._companion || !this._companion.active || !text.active) return;
        const x = clamp(this._companion.x, 70, GAME.WIDTH - 70);
        text.setPosition(x, this._companion.y - 36);
      },
    });

    this.tweens.add({ targets: text, alpha: 0.85, duration: 500 });
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: TRICKS.INVITE_PAUSE_MS - 600,
      duration: 600,
      onComplete: () => {
        follow.remove();
        text.destroy();
      },
    });

    // And the gesture itself, shown where the player's attention lives
    if (trick === 'roll') {
      this._showTapRipples();
    } else {
      this._showSwipeArrow();
    }
  }

  /**
   * Gesture cue for the roll: two double-tap ripple pairs beside the plane.
   * @private
   */
  _showTapRipples() {
    const side = this.airplane.x > GAME.WIDTH / 2 ? -46 : 46;
    const ripple = (delay) => this.time.delayedCall(delay, () => {
      if (this.gameOver) return;
      const g = this.add.graphics().setDepth(96);
      g.setPosition(this.airplane.x + side, this.airplane.y - 6);
      g.lineStyle(2, 0xFFFFFF, 0.5);
      g.strokeCircle(0, 0, 9);
      this.tweens.add({
        targets: g,
        alpha: 0,
        scaleX: 2.2,
        scaleY: 2.2,
        duration: 420,
        ease: 'Sine.easeOut',
        onComplete: () => g.destroy(),
      });
    });
    // Two taps, a beat, two taps — the rhythm of the gesture itself
    ripple(0); ripple(250);
    ripple(1300); ripple(1550);
  }

  /**
   * Gesture cue for the loop: wind motes rising along the swipe path.
   * @private
   */
  _showSwipeArrow() {
    if (!this.textures.exists('trail_particle')) return;
    const side = this.airplane.x > GAME.WIDTH / 2 ? -46 : 46;

    const wave = (baseDelay) => {
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(baseDelay + i * 90, () => {
          if (this.gameOver) return;
          const x = this.airplane.x + side;
          const startY = this.airplane.y + 24;
          const mote = this.add.image(x, startY, 'trail_particle')
            .setDepth(96).setAlpha(0.7).setScale(0.5).setBlendMode('ADD');
          this.tweens.add({
            targets: mote,
            y: startY - 72,
            alpha: 0,
            scale: 0.15,
            duration: 620,
            ease: 'Sine.easeOut',
            onComplete: () => mote.destroy(),
          });
        });
      }
    };
    wave(0);
    wave(1500);
  }

  /**
   * Loop-the-loop: the crane's trick. Bigger flourish and lift than the
   * roll; the first successful loop earns a celebration from the teacher.
   * @private
   */
  _doLoop() {
    const now = this.time.now;
    if (now - this._lastRollTime < TRICKS.ROLL_COOLDOWN_MS) return;
    if (!this.airplane.loopTheLoop(TRICKS.LOOP_DURATION_MS, TRICKS.LOOP_RADIUS)) return;

    this._lastRollTime = now;
    this.audioManager.playSFX('streakSmall');
    this.juice.rollFlourish(this.airplane);
    this.airplane.applyBoost(TRICKS.LOOP_BOOST, 350);

    if (!this._tricks.loopDone) {
      this._tricks.loopDone = true;
      this._saveTricks();
      if (this._companion && this._companion.active) {
        this._companion.endInvite();
        this._companion.celebrateLoop();
      }
      if (this._skyWords) this._skyWords.speak('You learned that from a friend.');
    } else if (this._companion && this._companion.active) {
      this._companion.respondRoll();
    }
  }

  /**
   * Perform a barrel roll: a full spin that rides on top of banking,
   * with a flourish of light and a tiny lift. In Drift it's pure play;
   * in Ascent, catching a current right after one is a style bonus.
   * @private
   */
  _doBarrelRoll() {
    const now = this.time.now;
    if (now - this._lastRollTime < TRICKS.ROLL_COOLDOWN_MS) return;
    if (!this.airplane.barrelRoll(this.airplane.driftDirection || 1, TRICKS.ROLL_DURATION_MS)) return;

    this._lastRollTime = now;
    this.audioManager.playSFX('streakSmall');
    this.juice.rollFlourish(this.airplane);
    this.airplane.applyBoost(TRICKS.ROLL_BOOST, 300);

    if (!this._tricks.rollDone) {
      // First roll ever — the lesson landed
      this._tricks.rollDone = true;
      this._saveTricks();
      if (this._companion && this._companion.active) {
        this._companion.endInvite();
        this._companion.respondRoll();
        if (this._skyWords) this._skyWords.speak('Now you’re flying together.');
      }
    } else if (this._companion && this._companion.active) {
      // The companion answers a beat later — call and response
      this._companion.respondRoll();
    }
  }

  /**
   * Drift-mode per-frame systems: responsive sky words and the companion.
   * @private
   * @param {number} delta - Frame delta in ms
   */
  _updateDrift(delta) {
    this._skyWords.update(this.altitudeMeters, this._flowState());
    this._skyWords.cleanup(this.cameras.main.scrollY);
    this._checkCompanion();
    if (this._companion && this._companion.active) {
      this._companion.update(delta);
    }
  }

  /**
   * Read the flight's current character from the performance rating the
   * adaptive camera already tracks. Words respond to how you're flying.
   * @private
   * @returns {'flow'|'struggle'|'ambient'}
   */
  _flowState() {
    if (this._performanceRating > 0.55) return 'flow';
    if (this._performanceRating < 0.15) return 'struggle';
    return 'ambient';
  }

  /**
   * Spawn a companion crane at the configured altitudes (Drift only).
   * @private
   */
  _checkCompanion() {
    if (this._companionIdx >= DRIFT_TUNING.COMPANION_ALTITUDES.length) return;
    if (this._companion && this._companion.active) return;
    const triggerAlt = DRIFT_TUNING.COMPANION_ALTITUDES[this._companionIdx];
    if (this.altitudeMeters < triggerAlt) return;

    const visitIndex = this._companionIdx;
    this._companionIdx += 1;
    this._invitesThisVisit = 0;
    this._companion = new Companion(this, this.airplane, Math.random() > 0.5, visitIndex);

    // It stays a while, then spirals away
    this.time.delayedCall(DRIFT_TUNING.COMPANION_DURATION_MS, () => {
      if (this._companion && this._companion.active) {
        this._companion.depart(() => { this._companion = null; });
      }
    });
  }

  /**
   * Ascent only: if the airplane sits pinned at minimum speed with no
   * catches for too long, the wind gently sets it down — a real ending,
   * arrived at kindly.
   * @private
   * @param {number} delta - Frame delta in ms
   */
  _updateStallWatch(delta) {
    if (this.gameOver || this._softClosing) return;

    const atFloor = this.airplane.riseSpeed <= PHYSICS.MIN_RISE_SPEED + 1;
    if (atFloor) {
      this._stallSeconds += delta / 1000;
    } else {
      this._stallSeconds = 0;
      if (this._stallWarningText) {
        const t = this._stallWarningText;
        this._stallWarningText = null;
        this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() });
      }
      return;
    }

    if (this._stallSeconds >= ASCENT_TUNING.STALL_WARNING_SECONDS && !this._stallWarningText) {
      this._stallWarningText = this.add.text(
        this.scale.width / 2, this.scale.height * 0.32, 'the wind is thinning…', {
          fontFamily: UI.FONT_FAMILY,
          fontSize: '16px',
          color: UI.COLORS.TEXT_PRIMARY,
          fontStyle: 'italic',
          shadow: { offsetX: 0, offsetY: 0, color: '#00000066', blur: 6, fill: true },
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0);
      this.tweens.add({ targets: this._stallWarningText, alpha: 0.7, duration: 600 });
    }

    if (this._stallSeconds >= ASCENT_TUNING.STALL_SECONDS) {
      this._windSetDown();
    }
  }

  /**
   * The Ascent ending: the wind sets the airplane down. Gentle descent,
   * warm fade, results screen — a landing, not a death.
   * @private
   */
  _windSetDown() {
    if (this.gameOver) return;
    this.gameOver = true;

    if (this._stallWarningText) {
      this._stallWarningText.destroy();
      this._stallWarningText = null;
    }

    this.audioManager.softFadeOut(3);

    // Drift down with a paper-light sway
    this.tweens.add({
      targets: this.airplane,
      y: this.airplane.y + this.scale.height * 0.35,
      duration: 2800,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.airplane,
      x: this.airplane.x + 30,
      duration: 700,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(1200, 212, 167, 106);
    });

    this.time.delayedCall(3100, () => {
      ScoreManager.recordCrashAltitude(this.altitudeMeters);
      trackGameOver(this.altitudeMeters);
      const results = this.scoreManager.getResults();
      this.scene.start('GameOverScene', {
        score: results.score,
        altitude: this.altitudeMeters,
        streak: results.bestStreak,
        isNewHighScore: results.isNewHighScore,
        personalBest: results.personalBest,
        level: results.level,
        levelName: results.levelName,
        flightCount: results.flightCount,
        totalCatches: results.totalCatches,
        totalMisses: results.totalMisses,
        landedByWind: true,
        mode: this.mode,
      });
    });
  }

  /**
   * Initialize audio on first user gesture (tap or keypress).
   * @private
   */
  async _initAudioOnGesture() {
    if (!this._audioInitialized) {
      await this.audioManager.init();
      // Start music at the current phase (not always 'dawn')
      const currentPhase = this.audioManager.getPhaseForAltitude(this.altitudeMeters);
      this.audioManager.crossfadeToPhase(currentPhase);
      this._lastPhase = currentPhase;
      this._audioInitialized = true;
    }
  }

  /**
   * Handle keyboard input (arrow keys).
   * Sets direction on key-down edge (not held).
   * @private
   */
  _handleKeyboard() {
    const left = this._cursors.left.isDown;
    const right = this._cursors.right.isDown;

    // Left arrow: set direction to left on key-down edge
    if (left && !this._leftWasDown) {
      this._initAudioOnGesture();
      if (this.airplane.driftDirection !== -1) {
        this.airplane.driftDirection = -1;
        this.audioManager.playSFX('directionChange');
        this.juice.directionStreak(this.airplane.x, this.airplane.y, -1);
      }
    }

    // Right arrow: set direction to right on key-down edge
    if (right && !this._rightWasDown) {
      this._initAudioOnGesture();
      if (this.airplane.driftDirection !== 1) {
        this.airplane.driftDirection = 1;
        this.audioManager.playSFX('directionChange');
        this.juice.directionStreak(this.airplane.x, this.airplane.y, 1);
      }
    }

    this._leftWasDown = left;
    this._rightWasDown = right;
  }

  /**
   * Main game update loop.
   * @param {number} time - Total elapsed time
   * @param {number} delta - Frame delta in ms
   */
  update(time, delta) {
    if (this.gameOver) return;

    // ── Core updates (must always run) ─────────────────────────────────
    this._handleKeyboard();
    this.altitudeMeters = pixelsToMeters(this.airplane.totalPixelsRisen, SCORING.METERS_PER_PIXEL);

    const driftSpeed = this.difficultyManager.getDriftSpeed(this.altitudeMeters);
    this.airplane.setDriftSpeed(driftSpeed);

    // Dynamic speed decay: increases with altitude (reduced in thermal zones)
    let speedDecay = this.difficultyManager.getSpeedDecayRate(this.altitudeMeters);
    if (this._inThermalZone) {
      speedDecay *= THERMAL.DECAY_MULTIPLIER;
    }
    this.airplane.speedDecayRate = speedDecay;

    const { pixelsRisen } = this.airplane.update(delta);

    if (this.crosswindPush !== 0) {
      this.airplane.x += this.crosswindPush * (delta / 1000);
    }

    this.pixelsSinceObstacleCheck += pixelsRisen;

    // ── Subsystems (isolated so one failure can't block others) ────────
    try { this._checkThermalZones(); } catch (e) { console.warn('thermal:', e.message); }
    try { this._spawnWindCurrentsAhead(); } catch (e) { console.warn('wind spawn:', e.message); }
    try { this._checkWindCurrents(); } catch (e) { console.warn('wind check:', e.message); }
    if (!this.isDrift) {
      // Obstacles are an Ascent concern — Drift's sky holds nothing against you
      try { this._spawnObstacles(); } catch (e) { console.warn('obstacle spawn:', e.message); }
      try { this._updateObstacles(time, delta); } catch (e) { console.warn('obstacle update:', e.message); }
      try { this._checkObstacleCollisions(); } catch (e) { console.warn('collision:', e.message); }
      try { this._updateStallWatch(delta); } catch (e) { console.warn('stall:', e.message); }
    } else {
      try { this._updateDrift(delta); } catch (e) { console.warn('drift:', e.message); }
    }
    try { this._ghosts.update(this.altitudeMeters); } catch (e) { console.warn('ghosts:', e.message); }
    try { this._cleanupEntities(); } catch (e) { console.warn('cleanup:', e.message); }
    try { this.skyBackground.update(this.altitudeMeters, time, delta); } catch (e) { console.warn('sky:', e.message); }
    try { this.ambientElements.update(this.altitudeMeters, time, delta); } catch (e) { console.warn('ambient:', e.message); }
    try { this.juice.update(time, delta); } catch (e) { console.warn('juice:', e.message); }
    try { this._updateVignette(); } catch (e) { console.warn('vignette:', e.message); }
    try { this._updateAudio(); } catch (e) { console.warn('audio:', e.message); }
    try { this._checkWonderMoments(); } catch (e) { console.warn('wonder:', e.message); }

    // ── Victory detection ──────────────────────────────────────────────
    try { this._checkVictory(); } catch (e) { console.warn('victory:', e.message); }

    // ── Yeti friend check ────────────────────────────────────────────
    try { this._checkYetiFriend(); } catch (e) { console.warn('yeti:', e.message); }

    // ── Session arc check ──────────────────────────────────────────────
    try { this._checkSessionArc(); } catch (e) { console.warn('sessionArc:', e.message); }

    // ── Level-up detection ──────────────────────────────────────────────
    try { this._checkLevelUp(); } catch (e) { console.warn('levelUp:', e.message); }

    // ── Adaptive camera position ────────────────────────────────────────
    this._updateAdaptiveCamera(delta);

    // ── HUD (must always run) ──────────────────────────────────────────
    this._updateHUD();
  }

  /**
   * Spawn the initial set of wind currents above the starting position.
   * First few are centered and wide to guarantee the player can start.
   * @private
   */
  _spawnInitialWindCurrents() {
    // Adaptive widening: if the player has been struggling, make early winds more forgiving
    const struggles = ScoreManager.getRecentStruggles();
    let widthBonus = 0;
    let extraCount = 0;
    if (struggles >= 3) {
      widthBonus = 50;
      extraCount = 1;
    } else if (struggles >= 2) {
      widthBonus = 30;
    }

    // First 3 currents: centered on screen, full width — guaranteed catchable
    const initialCount = 3 + extraCount;
    for (let i = 0; i < initialCount; i++) {
      // Apply struggle bonus to the first 5 winds (or all initial if fewer)
      const w = i < 5 ? WIND_CURRENT.BASE_WIDTH + widthBonus : WIND_CURRENT.BASE_WIDTH;
      const wc = new WindCurrent(this, GAME.WIDTH / 2, this.nextWindCurrentY, w);
      this.windCurrents.push(wc);
      this.nextWindCurrentY -= WIND_CURRENT.BASE_SPACING;
    }
    // Remaining 3: normal randomized spawning
    for (let i = 0; i < 3; i++) {
      this._spawnWindCurrent();
    }
  }

  /**
   * Spawn wind currents ahead of the airplane as it rises.
   * @private
   */
  _spawnWindCurrentsAhead() {
    const lookAheadY = this.airplane.y - this.scale.height * 1.5;

    while (this.nextWindCurrentY > lookAheadY) {
      this._spawnWindCurrent();
    }

    // Safety net: if no active wind currents exist ahead, reset and spawn fresh
    const hasActiveAhead = this.windCurrents.some(wc => wc.active && wc.y < this.airplane.y);
    if (!hasActiveAhead) {
      this.nextWindCurrentY = this.airplane.y - 120;
      for (let i = 0; i < 4; i++) {
        this._spawnWindCurrent();
      }
    }
  }

  /**
   * Spawn a single wind current at the next scheduled Y position.
   * If mercy drift is active and difficulty is low enough, bias toward the player.
   * @private
   */
  _spawnWindCurrent() {
    const params = this.difficultyManager.getWindCurrentParams(this.altitudeMeters);
    let x = GAME.WIDTH / 2 + randomRange(-params.driftOffsetMax, params.driftOffsetMax);
    let width = params.width;

    // Mercy drift: after a miss, bias the next current toward the player
    const diffFactor = this.difficultyManager.getDifficultyFactor(this.altitudeMeters);
    if (this._mercyNextWind && diffFactor <= 0.7) {
      x = x + (this._mercyTargetX - x) * 0.6; // lerp 60% toward player
      width += 20;
      this._mercyNextWind = false;
    }

    // Clamp X so the current stays on screen
    const halfW = width / 2;
    x = clamp(x, halfW, GAME.WIDTH - halfW);

    const wc = new WindCurrent(this, x, this.nextWindCurrentY, width);
    this.windCurrents.push(wc);

    this.nextWindCurrentY -= params.spacing;
  }

  /**
   * Check if altitude has crossed a thermal zone threshold and spawn one.
   * Also tracks whether the airplane is currently inside a thermal zone.
   * @private
   */
  _checkThermalZones() {
    const diffFactor = this.difficultyManager.getDifficultyFactor(this.altitudeMeters);

    // Spawn a thermal zone when we cross the next threshold (if difficulty allows)
    if (this.altitudeMeters >= this._nextThermalAltitude && diffFactor <= THERMAL.MAX_DIFFICULTY_FACTOR) {
      this._spawnThermalZone();
      this._nextThermalAltitude += THERMAL.INTERVAL_METERS;
    }

    // Track whether the airplane is currently within an active thermal zone
    const wasInThermal = this._inThermalZone;
    this._inThermalZone = (
      this._thermalZoneTopY !== 0 &&
      this.airplane.y <= this._thermalZoneBottomY &&
      this.airplane.y >= this._thermalZoneTopY
    );

    // Notify audio when entering/leaving thermal zone
    if (this._inThermalZone && !wasInThermal) {
      this.audioManager.setThermalCalm(true);
    } else if (!this._inThermalZone && wasInThermal) {
      this.audioManager.setThermalCalm(false);
    }
  }

  /**
   * Spawn a thermal breathing zone: a cluster of wide, closely-spaced wind currents.
   * @private
   */
  _spawnThermalZone() {
    const startY = this.nextWindCurrentY;

    for (let i = 0; i < THERMAL.ZONE_CURRENT_COUNT; i++) {
      const x = GAME.WIDTH / 2 + randomRange(-30, 30); // roughly centered
      const width = WIND_CURRENT.BASE_WIDTH + THERMAL.ZONE_WIDTH_BONUS;

      const wc = new WindCurrent(this, x, this.nextWindCurrentY, width);
      this.windCurrents.push(wc);

      this.nextWindCurrentY -= THERMAL.ZONE_SPACING;
    }

    // Record the zone bounds (Y decreases going up)
    this._thermalZoneBottomY = startY + 40; // small buffer below first current
    this._thermalZoneTopY = this.nextWindCurrentY - 40; // small buffer above last current
  }

  /**
   * Check each active wind current for catch or miss.
   * First catch of a run triggers a special takeoff swell.
   * On miss, the next spawned current drifts toward the player (mercy).
   * @private
   */
  _checkWindCurrents() {
    const airplaneY = this.airplane.y;
    const airplaneX = this.airplane.x;

    const catchRangeAhead = 20;
    const catchRangeBehind = 0;

    for (const wc of this.windCurrents) {
      if (!wc.active) continue;

      // Check if airplane is within catch range of this wind current
      // wc.y > airplaneY means the current is below (behind) the airplane
      const yDiff = wc.y - airplaneY; // positive = behind, negative = ahead
      const inRange = yDiff >= -catchRangeAhead && yDiff <= catchRangeBehind;

      if (inRange) {
        const halfWidth = wc.currentWidth / 2 + WIND_CURRENT.CATCH_TOLERANCE;
        const xDist = Math.abs(airplaneX - wc.x);

        if (xDist < halfWidth) {
          // Caught!
          wc.catch();
          this._performanceRating = Math.min(this._performanceRating + 0.06, 1.0);

          // First catch of the run: special takeoff feel
          if (!this._firstCatchDone) {
            this._firstCatchDone = true;
            this.audioManager.playTakeoffSwell();
            // Extra boost on first catch (30 px/s for 300ms)
            this.airplane.applyBoost(30, 300);
          }

          const result = this.scoreManager.onWindCatch();
          // Streak multiplier boosts both speed AND duration — streaks feel like surges
          const streakMultiplier = 1 + (result.streak * SCORING.STREAK_BONUS_MULTIPLIER);
          const boostedAmount = Math.floor(WIND_CURRENT.BOOST_AMOUNT * streakMultiplier);
          const boostedDuration = Math.floor(WIND_CURRENT.BOOST_DURATION_MS * (1 + result.streak * 0.15));
          this.airplane.applyBoost(boostedAmount, boostedDuration);
          this._showCatchFeedback(result);
        }
      }

      // Check if airplane has risen past this current (missed)
      if (wc.active && wc.hasBeenPassedBy(airplaneY)) {
        wc.miss();
        this._performanceRating = Math.max(this._performanceRating - 0.1, 0.0);
        // Apply penalty gradually over 400ms — the wind just dies down naturally.
        // In Drift the wind sighs rather than punishes.
        const missPenalty = AIRPLANE.MISS_PENALTY
          * (this.isDrift ? DRIFT_TUNING.MISS_PENALTY_SCALE : 1);
        this._applyGradualPenalty(missPenalty, 400);
        this.scoreManager.onWindMiss();
        this.audioManager.onWindMiss();

        // Set mercy flag so the next spawned current drifts toward the player
        this._mercyNextWind = true;
        this._mercyTargetX = this.airplane.x;
      }
    }
  }

  /**
   * Show visual feedback for catching a wind current.
   * @private
   * @param {{ bonusScore: number, streak: number, isMilestone: boolean, milestoneType: string|null }} result
   */
  _showCatchFeedback(result) {
    // Audio feedback
    this.audioManager.playSFX('currentCatch');
    this.audioManager.onWindCatch();

    // Juice: zoom pulse + spatter
    this.juice.catchPulse(this.airplane.x, this.airplane.y);

    // Drift keeps only the soft feedback — no milestones, no fanfare.
    // The catch itself is the reward.
    if (this.isDrift) return;

    if (result.isMilestone) {
      this.audioManager.playSFX(result.milestoneType === 'large' ? 'streakLarge' : 'streakSmall');
    }

    // Ascent: catching a current mid-roll (or just after) is a style moment
    if (this.time.now - this._lastRollTime < TRICKS.ROLL_DURATION_MS + ASCENT_TUNING.STYLE_WINDOW_MS) {
      this._showStylishCatch();
    }

    // Juice: streak milestone ring
    if (result.isMilestone) {
      this.juice.streakRing(this.airplane.x, this.airplane.y, result.milestoneType);
    }

    // Big streaks earn the surge — the whole sky rushes past
    if (result.isMilestone && result.milestoneType === 'large') {
      this.juice.surgeRush();
    }

    // Streak moved to end-of-flight summary

    // Milestone flash
    if (result.isMilestone) {
      const flash = this.add.text(
        this.scale.width / 2,
        this.scale.height * 0.3,
        result.milestoneType === 'large' ? 'INCREDIBLE!' : 'NICE STREAK!',
        {
          fontFamily: UI.FONT_FAMILY,
          fontSize: '28px',
          color: UI.COLORS.ACCENT,
          fontStyle: 'bold',
          shadow: { offsetX: 2, offsetY: 2, color: '#00000088', blur: 4, fill: true },
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(101);

      this.tweens.add({
        targets: flash,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        duration: UI.STREAK_NOTIFICATION_DURATION_MS,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
    }
  }

  /**
   * A catch landed during/just after a barrel roll — style points.
   * Bonus speed plus a quick flourish of text. The "whoa" is earned.
   * @private
   */
  _showStylishCatch() {
    this.airplane.applyBoost(25, 400);
    if (typeof this.scoreManager.addBonus === 'function') {
      this.scoreManager.addBonus(ASCENT_TUNING.STYLE_BONUS);
    }

    const text = this.add.text(this.airplane.x, this.airplane.y - 34, 'stylish!', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '18px',
      color: UI.COLORS.ACCENT,
      fontStyle: 'italic bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
    }).setOrigin(0.5).setDepth(101);

    this.tweens.add({
      targets: text,
      y: text.y - 26,
      alpha: 0,
      angle: 8,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Update audio state: wind pitch, phase crossfading.
   * @private
   */
  _updateAudio() {
    if (!this._audioInitialized) return;

    // Wind pitch tracks airplane speed
    this.audioManager.setWindPitch(this.airplane.riseSpeed, PHYSICS.MAX_RISE_SPEED);

    // Altitude-locked ambient layers
    this.audioManager.updateAltitude(this.altitudeMeters);

    // Crossfade music when sky phase changes + phase transition wash
    const phase = this.audioManager.getPhaseForAltitude(this.altitudeMeters);
    if (phase !== this._lastPhase) {
      this.audioManager.crossfadeToPhase(phase);
      this.juice.phaseTransitionWash(phase);
      this._lastPhase = phase;
    }
  }

  // ── Obstacle Spawning ──────────────────────────────────────────────────

  /** @private */
  _spawnObstacles() {
    if (this.pixelsSinceObstacleCheck < 50) return;

    const traveled = this.pixelsSinceObstacleCheck;
    this.pixelsSinceObstacleCheck = 0; // Reset immediately to prevent repeated checks

    const params = this.difficultyManager.getObstacleParams(this.altitudeMeters);
    const spawnY = this.cameras.main.scrollY - 60;

    // At 7000m+, sometimes spawn intentional combinations
    if (params.combinationsActive && Math.random() < 0.3) {
      this._spawnCombination(spawnY);
      return;
    }

    if (params.birdsActive && this.difficultyManager.shouldSpawn(params.birdSpawnRate, traveled)) {
      this._spawnBirdFlock(spawnY);
    }
    if (params.stormCloudsActive && this.difficultyManager.shouldSpawn(params.stormCloudSpawnRate, traveled)) {
      this._spawnStormCloud(spawnY);
    }
    if (params.crosswindsActive && this.difficultyManager.shouldSpawn(params.crosswindSpawnRate, traveled)) {
      this._spawnCrosswind(spawnY);
    }
    if (params.kitesActive && this.difficultyManager.shouldSpawn(params.kiteSpawnRate, traveled)) {
      this._spawnKite(spawnY);
    }
  }

  /**
   * Spawn intentional obstacle combinations at 7000m+.
   * Always leaves a navigable path — challenging but fair.
   * @private
   * @param {number} spawnY
   */
  _spawnCombination(spawnY) {
    const combo = randomInt(0, 3);
    switch (combo) {
      case 0: // Crosswind through storm cloud
        this._spawnStormCloud(spawnY);
        this._spawnCrosswind(spawnY + 20);
        break;
      case 1: // Birds approaching near current
        this._spawnBirdFlock(spawnY - 40);
        break;
      case 2: // Kites in crosswind zone
        this._spawnCrosswind(spawnY);
        this._spawnKite(spawnY - 15);
        break;
      case 3: // Storm cloud with incoming birds
        this._spawnStormCloud(spawnY);
        this._spawnBirdFlock(spawnY + 30);
        break;
    }
  }

  /** @private */
  _spawnBirdFlock(spawnY) {
    const flockSize = randomInt(2, 3);
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? -1 : 1;
    // Start birds partially on-screen so they intercept the airplane's path
    const startX = fromLeft
      ? randomRange(-20, GAME.WIDTH * 0.3)
      : randomRange(GAME.WIDTH * 0.7, GAME.WIDTH + 20);
    // Spawn at a Y that accounts for airplane rise speed — aim where the airplane will be
    const interceptY = spawnY + randomRange(100, 250);
    if (!this._firstEncounterShown.bird) {
      this._showFirstEncounterCue('Birds ahead!');
      this._firstEncounterShown.bird = true;
    }
    for (let i = 0; i < flockSize; i++) {
      this.birds.push(new Bird(this, startX + i * dir * -25, interceptY + i * 25, dir));
    }
  }

  /** @private */
  _spawnStormCloud(spawnY) {
    if (!this._firstEncounterShown.stormCloud) {
      this._showFirstEncounterCue('Storm ahead!');
      this._firstEncounterShown.stormCloud = true;
    }
    this.stormClouds.push(new StormCloud(this, randomRange(60, GAME.WIDTH - 60), spawnY));
  }

  /** @private */
  _spawnCrosswind(spawnY) {
    if (!this._firstEncounterShown.crosswind) {
      this._showFirstEncounterCue('Crosswind!');
      this._firstEncounterShown.crosswind = true;
    }
    this.crosswinds.push(new Crosswind(this, GAME.WIDTH / 2, spawnY, Math.random() > 0.5 ? 1 : -1));
  }

  /** @private */
  _spawnKite(spawnY) {
    if (!this._firstEncounterShown.kite) {
      this._showFirstEncounterCue('Kites!');
      this._firstEncounterShown.kite = true;
    }
    this.kites.push(new Kite(this, randomRange(40, GAME.WIDTH - 40), spawnY));
  }

  /**
   * Show an atmospheric first-encounter warning.
   * A brief screen-edge ripple in a warning color, with small text that
   * drifts through like a whisper — not a UI box.
   * @private
   */
  _showFirstEncounterCue(message) {
    const { width, height } = this.scale;

    // Brief amber/orange ripple at the top edge — something's coming
    const ripple = this.add.graphics().setScrollFactor(0).setDepth(94).setAlpha(0);
    ripple.fillGradientStyle(0xD4A040, 0xD4A040, 0xD4A040, 0xD4A040, 0.5, 0.5, 0, 0);
    ripple.fillRect(0, 0, width, height * 0.15);

    this.tweens.add({
      targets: ripple,
      alpha: 1,
      duration: 200,
      yoyo: true,
      hold: 300,
      ease: 'Sine.easeOut',
      onComplete: () => ripple.destroy(),
    });

    // Text drifts in from the side like a whisper, not a notification
    const fromLeft = Math.random() > 0.5;
    const cue = this.add.text(
      fromLeft ? -100 : width + 100,
      height * 0.22,
      message,
      {
        fontFamily: UI.FONT_FAMILY,
        fontSize: '20px',
        color: '#FFFFFF',
        fontStyle: 'italic',
        shadow: { offsetX: 0, offsetY: 0, color: '#D4A04088', blur: 10, fill: true },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0);

    // Drift in
    this.tweens.add({
      targets: cue,
      x: width / 2,
      alpha: 0.8,
      duration: 600,
      ease: 'Power2',
    });

    // Hold and drift out the other side
    this.tweens.add({
      targets: cue,
      x: fromLeft ? width + 100 : -100,
      alpha: 0,
      delay: 1800,
      duration: 600,
      ease: 'Power2',
      onComplete: () => cue.destroy(),
    });
  }

  // ── Obstacle Update & Collision ────────────────────────────────────────

  /** @private */
  _updateObstacles(time, delta) {
    for (const b of this.birds) b.update(delta);
    for (const s of this.stormClouds) s.update(delta);
    for (const c of this.crosswinds) c.update(delta);
    for (const k of this.kites) k.update(delta);
  }

  /** @private */
  _checkObstacleCollisions() {
    const ax = this.airplane.x, ay = this.airplane.y;
    const ahw = AIRPLANE.WIDTH / 2, ahh = AIRPLANE.HEIGHT / 2;

    for (const bird of this.birds) {
      if (bird._hit) continue;
      const dx = Math.abs(ax - bird.x);
      const dy = Math.abs(ay - bird.y);
      if (dx < ahw + OBSTACLES.BIRD.WIDTH / 2 &&
          dy < ahh + OBSTACLES.BIRD.HEIGHT / 2) {
        bird._hit = true;
        this.airplane.applyPenalty(AIRPLANE.HIT_PENALTY);
        this._performanceRating = Math.max(this._performanceRating - 0.12, 0.0);
        this.airplane.x += (ax > bird.x ? 15 : -15);
        this.audioManager.playSFX('birdHit');
        this.juice.birdHitSway(bird.x, bird.y);
        this.tweens.add({ targets: bird, alpha: 0, duration: 200, onComplete: () => bird.setVisible(false) });
      } else if (!bird._nearMissed &&
          dx < ahw + OBSTACLES.BIRD.WIDTH / 2 + ASCENT_TUNING.NEAR_MISS_RADIUS &&
          dy < ahh + OBSTACLES.BIRD.HEIGHT / 2 + ASCENT_TUNING.NEAR_MISS_RADIUS) {
        // Grazed it — the sharp intake of breath
        bird._nearMissed = true;
        this.juice.nearMissPunch((ax + bird.x) / 2, (ay + bird.y) / 2);
        this.audioManager.playSFX('crosswindTelegraph');
        if (typeof this.scoreManager.addBonus === 'function') {
          this.scoreManager.addBonus(ASCENT_TUNING.NEAR_MISS_BONUS);
        }
      }
    }

    const wasInStorm = this.inStorm;
    this.inStorm = false;
    this.crosswindPush = 0;

    for (const sc of this.stormClouds) {
      if (Math.abs(ax - sc.x) < OBSTACLES.STORM_CLOUD.WIDTH / 2 &&
          Math.abs(ay - sc.y) < OBSTACLES.STORM_CLOUD.HEIGHT / 2) {
        this.inStorm = true;
        // Substantial speed drain while inside storm
        const slowAmount = OBSTACLES.STORM_CLOUD.SLOW_FACTOR * this.airplane.riseSpeed * (delta / 1000);
        this.airplane.riseSpeed = Math.max(this.airplane.riseSpeed - slowAmount, PHYSICS.MIN_RISE_SPEED);
        // Strong turbulence shake
        this.airplane.x += (Math.random() - 0.5) * OBSTACLES.STORM_CLOUD.TURBULENCE * 2;
      }
    }

    // Storm enter/exit audio + juice
    if (this.inStorm && !wasInStorm) {
      this.juice.stormEnter();
    } else if (!this.inStorm && wasInStorm) {
      this.juice.stormExit();
    }

    for (const cw of this.crosswinds) {
      if (Math.abs(ax - cw.x) < OBSTACLES.CROSSWIND.WIDTH / 2 &&
          Math.abs(ay - cw.y) < OBSTACLES.CROSSWIND.HEIGHT / 2) {
        this.crosswindPush = cw.getPushForce();
      }
    }

    for (const kite of this.kites) {
      if (kite._hit) continue;
      if (Math.abs(ax - kite.x) < ahw + OBSTACLES.KITE.WIDTH / 2 &&
          Math.abs(ay - kite.y) < ahh + OBSTACLES.KITE.HEIGHT / 2) {
        kite._hit = true;
        this.airplane.applyPenalty(AIRPLANE.HIT_PENALTY);
        this._performanceRating = Math.max(this._performanceRating - 0.12, 0.0);
        this.audioManager.playSFX('birdHit');
        this.juice.birdHitSway(kite.x, kite.y);
        this.tweens.add({ targets: kite, alpha: 0, duration: 200, onComplete: () => kite.setVisible(false) });
      }
    }
  }

  /** @private */
  _updateVignette() {
    if (this.inStorm) {
      this.vignetteGraphics.setAlpha(Math.min(this.vignetteGraphics.alpha + 0.08, 0.5));
      this.vignetteGraphics.clear();
      const { width, height } = this.scale;
      this.vignetteGraphics.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0.35, 0, 0);
      this.vignetteGraphics.fillRect(0, 0, width, height * 0.3);
      this.vignetteGraphics.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.35, 0.35);
      this.vignetteGraphics.fillRect(0, height * 0.7, width, height * 0.3);
    } else {
      this.vignetteGraphics.setAlpha(Math.max(this.vignetteGraphics.alpha - 0.05, 0));
    }
  }

  /**
   * Clean up wind currents and entities that are far below the camera.
   * @private
   */
  _cleanupEntities() {
    const cleanupThreshold = this.cameras.main.scrollY + this.scale.height * 2;

    this.windCurrents = this.windCurrents.filter((wc) => {
      if (wc.y > cleanupThreshold) {
        this.tweens.killTweensOf(wc);
        wc.destroy();
        return false;
      }
      return true;
    });

    this.birds = this.birds.filter((b) => {
      if (b.y > cleanupThreshold || b.isOffScreen(GAME.WIDTH)) {
        this.tweens.killTweensOf(b);
        b.destroy();
        return false;
      }
      return true;
    });

    this.stormClouds = this.stormClouds.filter((s) => {
      if (s.y > cleanupThreshold) {
        this.tweens.killTweensOf(s);
        s.destroy();
        return false;
      }
      return true;
    });

    this.crosswinds = this.crosswinds.filter((c) => {
      if (c.y > cleanupThreshold) {
        this.tweens.killTweensOf(c);
        c.destroy();
        return false;
      }
      return true;
    });

    this.kites = this.kites.filter((k) => {
      if (k.y > cleanupThreshold) {
        this.tweens.killTweensOf(k);
        k.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Check if altitude has crossed a level threshold, and trigger effects.
   * @private
   */
  _checkLevelUp() {
    const result = this.scoreManager.checkLevelUp(this.altitudeMeters);
    if (result) {
      // Drift: the sky changing IS the event — music crossfades, colors
      // wash, and nothing interrupts. No banner, no slow-mo, no reward.
      if (this.isDrift) return;

      // Speed boost reward
      this.airplane.applyBoost(LEVELS.LEVEL_UP_BOOST, LEVELS.LEVEL_UP_BOOST_DURATION_MS);

      // Visual effect
      this.juice.levelUpEffect(this.airplane.x, this.airplane.y, result.color);

      // Level-up SFX (ascending arpeggio)
      this.audioManager.playSFX('levelUp');

      // Brief time-slow for dramatic "moment of achievement"
      this.time.timeScale = 0.3;
      this.time.delayedCall(600, () => {
        // Ramp timeScale back to 1.0 over 400ms
        this.tweens.addCounter({
          from: 0.3,
          to: 1.0,
          duration: 400,
          ease: 'Sine.easeOut',
          onUpdate: (tween) => {
            this.time.timeScale = tween.getValue();
          },
          onComplete: () => {
            this.time.timeScale = 1.0;
          },
        });
      });

      // HUD level text color tween to new level's theme color
      this._tweenLevelTextColor(result.color);

      // Level-up notification
      this._showLevelUpNotification(result.level, result.name, result.color);
    }
  }

  /**
   * Show an immersive level-up moment — no panels, no boxes.
   * The name sweeps across the whole screen like a horizon, then dissolves.
   * Horizontal light streaks race past. The sky itself announces the change.
   * @private
   * @param {number} level
   * @param {string} name
   * @param {number} color
   */
  _showLevelUpNotification(level, name, color) {
    const { width, height } = this.scale;

    // ── Full-width horizontal light streaks racing across the screen ──
    const streakCount = 6 + level * 2;
    for (let i = 0; i < streakCount; i++) {
      const streak = this.add.graphics().setScrollFactor(0).setDepth(95);
      const y = randomRange(height * 0.1, height * 0.9);
      const streakW = randomRange(80, width * 0.7);
      const streakH = randomRange(1, 3);
      const fromLeft = Math.random() > 0.5;
      const startX = fromLeft ? -streakW : width;

      streak.fillStyle(color, randomRange(0.15, 0.4));
      streak.fillRect(startX, y, streakW, streakH);
      // Brighter core
      streak.fillStyle(0xFFFFFF, randomRange(0.1, 0.25));
      streak.fillRect(startX + streakW * 0.3, y, streakW * 0.4, streakH);

      this.tweens.add({
        targets: streak,
        x: fromLeft ? width + streakW : -(width + streakW),
        duration: randomRange(400, 900),
        delay: randomRange(0, 300),
        ease: 'Power2',
        onComplete: () => streak.destroy(),
      });
    }

    // ── Stage name — large, cinematic, centered, sweeps up and fades ──
    const nameText = this.add.text(width / 2, height * 0.45, name, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '42px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      shadow: { offsetX: 0, offsetY: 0, color: `#${color.toString(16).padStart(6, '0')}`, blur: 20, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setAlpha(0).setScale(1.5);

    // Fade in and scale down to 1.0
    this.tweens.add({
      targets: nameText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      ease: 'Power3',
    });

    // Hold, then drift up and dissolve
    this.tweens.add({
      targets: nameText,
      alpha: 0,
      y: height * 0.3,
      scaleX: 0.9,
      scaleY: 0.9,
      delay: LEVELS.NOTIFICATION_DURATION_MS - 800,
      duration: 800,
      ease: 'Sine.easeIn',
      onComplete: () => nameText.destroy(),
    });

    // ── Particle burst from both edges — like breaking through a barrier ──
    const edgeBurst = this.add.graphics().setScrollFactor(0).setDepth(94);
    const burstCount = 20;
    for (let i = 0; i < burstCount; i++) {
      const bx = Math.random() > 0.5 ? randomRange(-10, 30) : randomRange(width - 30, width + 10);
      const by = randomRange(height * 0.2, height * 0.8);
      const size = randomRange(2, 5);
      edgeBurst.fillStyle(color, randomRange(0.3, 0.7));
      edgeBurst.fillCircle(bx, by, size);
    }
    this.tweens.add({
      targets: edgeBurst,
      x: 0,
      alpha: 0,
      duration: 1200,
      delay: 200,
      ease: 'Power2',
      onComplete: () => edgeBurst.destroy(),
    });
  }

  /**
   * Update the HUD elements.
   * @private
   */
  /**
   * Smoothly adjust the camera follow offset based on performance.
   * Doing well → airplane drifts higher on screen (less reaction time).
   * Struggling → airplane drops lower (more lookahead, more forgiving).
   * @private
   * @param {number} delta - Frame delta in ms
   */
  _updateAdaptiveCamera(delta) {
    const { height } = this.scale;

    // Natural drift toward baseline (0.3) — performance slowly normalizes
    const baseline = 0.3;
    const decayRate = 0.008 * (delta / 16.67); // normalize to ~60fps
    if (this._performanceRating > baseline) {
      this._performanceRating = Math.max(this._performanceRating - decayRate, baseline);
    } else if (this._performanceRating < baseline) {
      this._performanceRating = Math.min(this._performanceRating + decayRate * 0.5, baseline);
    }

    // Map performance to camera offset:
    // Low (0.0) → offset = height * 0.35 (airplane very low, max lookahead)
    // High (1.0) → offset = height * 0.05 (airplane near center, less lookahead)
    const targetOffset = height * (0.35 - this._performanceRating * 0.30);

    // Smooth lerp toward target (slow enough to never feel jarring)
    const lerpSpeed = 0.02;
    this._cameraOffsetY += (targetOffset - this._cameraOffsetY) * lerpSpeed;
    this.cameras.main.followOffset.y = this._cameraOffsetY;
  }

  _updateHUD() {
    // Show phase name as primary HUD, altitude as subtle sub-text
    this.altitudeText.setText(this.scoreManager.levelName);
    this.altitudeSubText.setText(`${this.altitudeMeters}m`);
    this.scoreManager.addAltitudeScore(this.altitudeMeters);

    // Drift's HUD ends here — no level, no bars, no progress
    if (this.isDrift) return;

    this.levelText.setText(`Lv ${this.scoreManager.level}`);

    // Speed bar
    this._drawSpeedBar();

    // Journey progress bar
    this._updateProgressBar();
  }

  /**
   * Draw the wind-trail speed indicator — a thin atmospheric line that feels
   * like part of the sky. High speed = bright white-blue, low speed = nearly
   * invisible, like wind dying down. No red, ever.
   * @private
   */
  _drawSpeedBar() {
    const { width, height } = this.scale;
    this.speedBar.clear();

    const barWidth = 3;
    const barHeight = height * 0.22;
    const barX = width - UI.HUD_PADDING - barWidth;
    const barY = height * 0.5 - barHeight / 2;

    const speedRatio = Math.min(this.airplane.riseSpeed / PHYSICS.MAX_RISE_SPEED, 1);
    const fillHeight = barHeight * speedRatio;

    // Subtle background — barely there
    this.speedBar.fillStyle(0xFFFFFF, 0.06);
    this.speedBar.fillRect(barX, barY, barWidth, barHeight);

    // Wind trail fill: white-blue, alpha tracks speed
    // High speed: bright soft blue-white. Low speed: fades to near-invisible.
    const trailColor = lerpColor(0xB0D4F1, 0xFFFFFF, speedRatio);
    const trailAlpha = 0.1 + speedRatio * 0.55; // range: 0.1 (stalling) to 0.65 (max)

    this.speedBar.fillStyle(trailColor, trailAlpha);
    this.speedBar.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight);
  }

  /**
   * Create the journey progress bar on the left side of the screen.
   * Segmented by sky phases with gradient colors, a moving indicator, and a star at the top.
   * @private
   */
  _createProgressBar() {
    const { height } = this.scale;
    const barX = UI.HUD_PADDING + 2;
    const barW = 6;
    const barTop = height * 0.12;
    const barBottom = height * 0.88;
    const barH = barBottom - barTop;

    // Store layout for updates
    this._progressBar = { x: barX, w: barW, top: barTop, bottom: barBottom, h: barH };

    // Static background: segmented gradient bar
    const barBg = this.add.graphics().setScrollFactor(0).setDepth(99);

    // Dark backing for contrast
    barBg.fillStyle(0x000000, 0.25);
    barBg.fillRoundedRect(barX - 2, barTop - 2, barW + 4, barH + 4, 4);

    // Draw segments bottom-to-top (dawn at bottom, victory at top)
    const stages = LEVELS.STAGES;
    const victoryAlt = LEVELS.VICTORY_ALTITUDE;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const nextAlt = i < stages.length - 1 ? stages[i + 1].altitude : victoryAlt;

      // Convert altitude range to bar Y positions (bottom = 0m, top = victoryAlt)
      const segBottom = barBottom - (stage.altitude / victoryAlt) * barH;
      const segTop = barBottom - (nextAlt / victoryAlt) * barH;
      const segH = segBottom - segTop;

      barBg.fillStyle(stage.color, 0.7);
      barBg.fillRect(barX, segTop, barW, segH);

      // Divider line between segments
      if (i > 0) {
        barBg.fillStyle(0xFFFFFF, 0.4);
        barBg.fillRect(barX - 1, segBottom - 1, barW + 2, 2);
      }
    }

    // Star at the very top
    this.add.text(barX + barW / 2, barTop - 10, '★', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '14px',
      color: UI.COLORS.ACCENT,
      shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 2, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Moving indicator (small bright triangle/dot)
    this.progressIndicator = this.add.graphics().setScrollFactor(0).setDepth(101);
  }

  /**
   * Update the progress bar indicator position based on current altitude.
   * @private
   */
  _updateProgressBar() {
    const pb = this._progressBar;
    if (!pb) return;

    const progress = Math.min(this.altitudeMeters / LEVELS.VICTORY_ALTITUDE, 1);
    const indicatorY = pb.bottom - progress * pb.h;

    this.progressIndicator.clear();

    // Glow behind the indicator
    this.progressIndicator.fillStyle(0xFFFFFF, 0.3);
    this.progressIndicator.fillCircle(pb.x + pb.w / 2, indicatorY, 6);

    // Bright indicator dot
    this.progressIndicator.fillStyle(0xFFFFFF, 0.9);
    this.progressIndicator.fillCircle(pb.x + pb.w / 2, indicatorY, 3);

    // Small arrow pointing right from the bar
    this.progressIndicator.fillStyle(0xFFFFFF, 0.7);
    this.progressIndicator.fillTriangle(
      pb.x + pb.w + 3, indicatorY,
      pb.x + pb.w + 8, indicatorY - 3,
      pb.x + pb.w + 8, indicatorY + 3
    );
  }

  /**
   * Tween the HUD level text tint to the new level's theme color.
   * @private
   * @param {number} color - Target color as 0xRRGGBB
   */
  _tweenLevelTextColor(color) {
    const currentTint = this.levelText.tintTopLeft || 0xFFFFFF;
    const startR = (currentTint >> 16) & 0xFF;
    const startG = (currentTint >> 8) & 0xFF;
    const startB = currentTint & 0xFF;
    const endR = (color >> 16) & 0xFF;
    const endG = (color >> 8) & 0xFF;
    const endB = color & 0xFF;

    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 500,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() / 100;
        const r = Math.round(startR + (endR - startR) * t);
        const g = Math.round(startG + (endG - startG) * t);
        const b = Math.round(startB + (endB - startB) * t);
        this.levelText.setTint((r << 16) | (g << 8) | b);
      },
    });
  }

  // ── Wonder Moments ────────────────────────────────────────────────────

  /**
   * Convert an altitude in meters to a world-Y position.
   * @private
   * @param {number} altitudeMeters
   * @returns {number} World Y coordinate
   */
  _altitudeToWorldY(altitudeMeters) {
    const startY = this.airplane.y + this.airplane.totalPixelsRisen;
    return startY - (altitudeMeters / SCORING.METERS_PER_PIXEL);
  }

  /**
   * Check and trigger altitude-based wonder moments.
   * Purely visual — no gameplay impact.
   * @private
   */
  _checkWonderMoments() {
    const alt = this.altitudeMeters;

    // 1. Cloud break-throughs — trigger 300m early so they appear AHEAD
    for (const threshold of WONDER.CLOUD_BREAK_ALTITUDES) {
      const triggerAlt = threshold - 300;
      if (alt >= triggerAlt && !this._cloudBreakTriggered.has(threshold)) {
        this._cloudBreakTriggered.add(threshold);
        this._spawnCloudBreak(threshold);
      }
    }

    // 2. Friendly passing elements — spawn ahead of the airplane
    if (alt >= this._nextFriendlyAltitude) {
      this._spawnFriendlyElement();
      this._nextFriendlyAltitude += WONDER.FRIENDLY_INTERVAL;
    }

    // 3. Altitude milestone sparkle (at level transitions: 2000, 4000, 6000, 8000)
    // These happen AT the airplane, so no change needed
    for (const stage of LEVELS.STAGES) {
      if (stage.altitude > 0 && alt >= stage.altitude && this._lastSparkleAltitude < stage.altitude) {
        this._lastSparkleAltitude = stage.altitude;
        this._spawnMilestoneSparkle();
      }
    }

    // 4. Distance markers — trigger 400m early so they appear AHEAD.
    // Drift replaces these with SkyWords, which respond to the flight.
    if (!this.isDrift) {
      for (const marker of WONDER.DISTANCE_MARKERS) {
        const triggerAlt = marker.altitude - 400;
        if (alt >= triggerAlt && !this._distanceMarkerTriggered.has(marker.altitude)) {
          this._distanceMarkerTriggered.add(marker.altitude);
          this._spawnDistanceMarker(marker);
        }
      }
    }

    // Clean up off-screen wonder elements
    const cleanupY = this.cameras.main.scrollY + this.scale.height * 2;
    this._wonderElements = this._wonderElements.filter((el) => {
      if (!el || !el.active) return false;
      if (el.y > cleanupY) {
        this.tweens.killTweensOf(el);
        el.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Spawn a horizontal cloud band at a given altitude that the airplane passes through.
   * @private
   * @param {number} altitudeMeters
   */
  _spawnCloudBreak(altitudeMeters) {
    const worldY = this._altitudeToWorldY(altitudeMeters);
    const bandH = WONDER.CLOUD_BAND_HEIGHT;
    const { width, height } = this.scale;

    // Multiple cloud layers for depth — wispy, overlapping bands
    const gfx = this.add.graphics().setDepth(5);
    // Wide soft outer haze
    gfx.fillStyle(0xFFFFFF, WONDER.CLOUD_BAND_ALPHA * 0.3);
    gfx.fillRoundedRect(-30, worldY - bandH, GAME.WIDTH + 60, bandH * 2, 30);
    // Main cloud band
    gfx.fillStyle(0xFFFFFF, WONDER.CLOUD_BAND_ALPHA);
    gfx.fillRoundedRect(-20, worldY - bandH / 2, GAME.WIDTH + 40, bandH, 20);
    // Brighter core
    gfx.fillStyle(0xFFFFFF, WONDER.CLOUD_BAND_ALPHA * 0.7);
    gfx.fillRoundedRect(20, worldY - bandH / 4, GAME.WIDTH - 40, bandH / 2, 12);
    // Small cloud puffs scattered along the band
    for (let i = 0; i < 8; i++) {
      const cx = randomRange(20, GAME.WIDTH - 20);
      const cy = worldY + randomRange(-bandH * 0.4, bandH * 0.4);
      const cr = randomRange(15, 35);
      gfx.fillStyle(0xFFFFFF, randomRange(0.15, 0.35));
      gfx.fillCircle(cx, cy, cr);
    }

    this._wonderElements.push(gfx);

    // When the airplane reaches this band, dramatic break-through effect
    const checkFlash = () => {
      if (this.gameOver) return;
      const dist = Math.abs(this.airplane.y - worldY);
      if (dist < bandH) {
        // White flash — brighter and more dramatic
        const flash = this.add.graphics().setScrollFactor(0).setDepth(80);
        flash.fillStyle(0xFFFFFF, 1);
        flash.fillRect(0, 0, GAME.WIDTH, height);
        flash.setAlpha(WONDER.CLOUD_FLASH_ALPHA);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 800,
          ease: 'Sine.easeOut',
          onComplete: () => flash.destroy(),
        });

        // Cloud wisps streaming past the edges after break-through
        for (let i = 0; i < 12; i++) {
          const wisp = this.add.graphics().setScrollFactor(0).setDepth(79);
          const wy = randomRange(height * 0.1, height * 0.9);
          const ww = randomRange(40, 120);
          const wh = randomRange(3, 8);
          wisp.fillStyle(0xFFFFFF, randomRange(0.1, 0.3));
          wisp.fillRoundedRect(randomRange(-20, width), wy, ww, wh, 4);
          this.tweens.add({
            targets: wisp,
            y: wisp.y + height * 0.8,
            alpha: 0,
            duration: randomRange(600, 1200),
            delay: randomRange(0, 200),
            ease: 'Power1',
            onComplete: () => wisp.destroy(),
          });
        }
      } else if (this.airplane.y < worldY - bandH) {
        return;
      } else {
        this.time.delayedCall(50, checkFlash);
      }
    };
    checkFlash();
  }

  /**
   * Spawn a friendly visual-only element that drifts across the screen.
   * Small, low-alpha, behind the gameplay layer.
   * @private
   */
  _spawnFriendlyElement() {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -15 : GAME.WIDTH + 15;
    const endX = fromLeft ? GAME.WIDTH + 15 : -15;
    const worldY = this.airplane.y - randomRange(200, 500);

    // Pick a shape type randomly
    const type = randomInt(0, 2);
    const gfx = this.add.graphics().setDepth(3);

    if (type === 0) {
      // Butterfly: two overlapping circles with body
      gfx.fillStyle(0xE8D5B7, WONDER.FRIENDLY_ALPHA);
      gfx.fillCircle(startX - 6, worldY, 6);
      gfx.fillCircle(startX + 6, worldY, 6);
      gfx.fillStyle(0xD4A76A, WONDER.FRIENDLY_ALPHA * 0.8);
      gfx.fillCircle(startX, worldY, 3);
    } else if (type === 1) {
      // Leaf: a tilted ellipse
      gfx.fillStyle(0x8FBC8F, WONDER.FRIENDLY_ALPHA);
      gfx.fillEllipse(startX, worldY, 14, 7);
    } else {
      // Distant bird silhouette: a chevron
      gfx.lineStyle(2, 0x444444, WONDER.FRIENDLY_ALPHA * 0.8);
      gfx.lineBetween(startX - 8, worldY + 3, startX, worldY);
      gfx.lineBetween(startX, worldY, startX + 8, worldY + 3);
    }

    this._wonderElements.push(gfx);

    // Drift horizontally with a gentle vertical bob
    const duration = randomRange(6000, 10000);
    this.tweens.add({
      targets: gfx,
      x: endX - startX,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        gfx.destroy();
        const idx = this._wonderElements.indexOf(gfx);
        if (idx !== -1) this._wonderElements.splice(idx, 1);
      },
    });

    // Gentle vertical bob
    this.tweens.add({
      targets: gfx,
      y: gfx.y + randomRange(-8, 8),
      duration: randomRange(1500, 2500),
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Spawn a brief sparkle/shimmer effect around the airplane at level transitions.
   * Feels celebratory but gentle — like sunlight catching paper.
   * @private
   */
  _spawnMilestoneSparkle() {
    const count = WONDER.SPARKLE_PARTICLE_COUNT;
    const radius = WONDER.SPARKLE_RADIUS;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + randomRange(-0.2, 0.2);
      const dist = randomRange(radius * 0.4, radius);
      const px = this.airplane.x + Math.cos(angle) * dist;
      const py = this.airplane.y + Math.sin(angle) * dist;

      const sparkle = this.add.graphics().setDepth(50);
      sparkle.fillStyle(0xFFFFFF, 0.8);
      sparkle.fillCircle(px, py, randomRange(1.5, 3));

      this.tweens.add({
        targets: sparkle,
        x: sparkle.x + Math.cos(angle) * 15,
        y: sparkle.y + Math.sin(angle) * 15,
        alpha: 0,
        duration: WONDER.SPARKLE_DURATION_MS,
        ease: 'Power2',
        delay: randomRange(0, 150),
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  /**
   * Spawn a distance marker — faint text positioned in the world at the side of the screen.
   * Drifts by naturally as the airplane rises past it.
   * @private
   * @param {{ altitude: number, text: string }} marker
   */
  _spawnDistanceMarker(marker) {
    const worldY = this._altitudeToWorldY(marker.altitude);
    // Alternate left/right based on which marker this is
    const markerIndex = WONDER.DISTANCE_MARKERS.indexOf(marker);
    const onLeft = markerIndex % 2 === 0;
    const x = onLeft ? UI.HUD_PADDING + 30 : GAME.WIDTH - UI.HUD_PADDING - 30;

    // Thin horizon line extending from the text
    const line = this.add.graphics().setDepth(3);
    const lineStart = onLeft ? 0 : GAME.WIDTH;
    const lineEnd = onLeft ? GAME.WIDTH * 0.4 : GAME.WIDTH * 0.6;
    line.lineStyle(1, 0xFFFFFF, 0.12);
    line.lineBetween(lineStart, worldY, lineEnd, worldY);
    this._wonderElements.push(line);

    const text = this.add.text(x, worldY - 10, marker.text, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: WONDER.MARKER_FONT_SIZE,
      color: '#FFFFFF',
      fontStyle: 'italic',
      shadow: { offsetX: 0, offsetY: 0, color: '#FFFFFF44', blur: 6, fill: true },
    }).setOrigin(onLeft ? 0 : 1, 0.5)
      .setAlpha(WONDER.MARKER_ALPHA)
      .setDepth(4);

    this._wonderElements.push(text);
  }

  // ── Yeti Friend (reframed from Ski Free easter egg) ─────────────────

  /**
   * At 8000m+, spawn the yeti as a friendly companion that floats alongside.
   * No collision, no game-over trigger — just a cheerful presence.
   * @private
   */
  _checkYetiFriend() {
    if (this._yetiTriggered || this.altitudeMeters < 8000) return;

    this._yetiTriggered = true;
    this._spawnYetiFriend();
  }

  /**
   * Spawn the yeti as a friendly companion that drifts beside the airplane.
   * Preserves the original pixel art but reframes the encounter.
   * @private
   */
  _spawnYetiFriend() {
    const { width, height } = this.scale;
    const airplaneWorldY = this.airplane.y;

    // Create yeti as a container with graphics — appears from the side, not below
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -60 : width + 60;
    const container = this.add.container(startX, airplaneWorldY);
    container.setDepth(95);

    const g = this.add.graphics();
    const px = 3; // pixel size for retro look

    // Same pixel art — but softer colors for friendly feel
    const fur = 0xB0B8C0;
    const darkFur = 0x90A0A8;
    const white = 0xE8ECF0;

    const dot = (x, y, color = fur) => {
      g.fillStyle(color, 1);
      g.fillRect(x * px, y * px, px, px);
    };

    // Legs (wide stance)
    dot(-3, -1, darkFur); dot(-2, -1, darkFur);
    dot(2, -1, darkFur); dot(3, -1, darkFur);
    dot(-3, -2, fur); dot(-2, -2, fur);
    dot(2, -2, fur); dot(3, -2, fur);
    dot(-3, -3, fur); dot(-2, -3, fur);
    dot(2, -3, fur); dot(3, -3, fur);

    // Torso
    for (let y = -4; y >= -10; y--) {
      for (let x = -4; x <= 4; x++) {
        dot(x, y, fur);
      }
    }
    // Belly highlight
    for (let y = -5; y >= -9; y--) {
      for (let x = -2; x <= 2; x++) {
        dot(x, y, white);
      }
    }

    // Head
    for (let y = -11; y >= -15; y--) {
      for (let x = -3; x <= 3; x++) {
        dot(x, y, fur);
      }
    }
    dot(-2, -16, fur); dot(-1, -16, fur); dot(0, -16, fur); dot(1, -16, fur); dot(2, -16, fur);
    dot(-1, -17, fur); dot(0, -17, fur); dot(1, -17, fur);

    // Eyes — friendly, dark dots
    dot(-2, -14, 0x222222); dot(2, -14, 0x222222);

    // Smile instead of open mouth
    dot(-2, -12, 0x665555); dot(-1, -12, 0x665555); dot(0, -12, 0x665555);
    dot(1, -12, 0x665555); dot(2, -12, 0x665555);

    // Arms — waving pose (one up, one down)
    // Left arm waving up
    dot(-5, -9, fur); dot(-6, -10, fur); dot(-7, -11, fur);
    dot(-7, -12, fur); dot(-7, -13, fur); dot(-7, -14, fur);
    dot(-8, -15, darkFur); dot(-7, -15, darkFur); dot(-6, -15, darkFur);

    // Right arm relaxed down
    dot(5, -8, fur); dot(6, -7, fur); dot(7, -6, fur);
    dot(7, -5, fur);
    dot(8, -4, darkFur); dot(7, -4, darkFur);

    container.add(g);
    this._yetiSprite = container;

    // Drift in gently from the side to beside the airplane
    const companionX = fromLeft
      ? this.airplane.x - 60
      : this.airplane.x + 60;

    this.tweens.add({
      targets: container,
      x: companionX,
      y: this.airplane.y - 20,
      duration: 2000,
      ease: 'Sine.easeOut',
    });

    // Gentle bobbing once in position
    this.time.delayedCall(2000, () => {
      if (!container.active) return;
      this.tweens.add({
        targets: container,
        y: container.y - 8,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      // Follow the airplane's Y loosely
      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (!container.active || this.gameOver) return;
          container.y += (this.airplane.y - 20 - container.y) * 0.03;
        },
      });
    });
  }

  // ── Session Arc ────────────────────────────────────────────────────

  /**
   * At 5000m, trigger a designed golden-hour arc:
   * distance marker → reduced difficulty → choice to land or fly on.
   * @private
   */
  _checkSessionArc() {
    // Ascent runs uninterrupted — a competitive climb doesn't ask questions.
    if (!this.isDrift) return;
    if (this._softClosing || this.gameOver) return;
    if (this._restInviteIdx >= this._restInvites.length) return;

    const invite = this._restInvites[this._restInviteIdx];
    if (this.altitudeMeters < invite.alt) return;
    this._restInviteIdx += 1;

    const { message, glow, landLabel } = invite;
    const inviteAlt = invite.alt;

    const { width, height } = this.scale;

    const markerText = this.add.text(width / 2, height * 0.3, message, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '17px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'italic',
      align: 'center',
      shadow: { offsetX: 0, offsetY: 0, color: glow, blur: 10, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setAlpha(0);

    this.tweens.add({
      targets: markerText,
      alpha: 0.8,
      duration: 800,
      ease: 'Sine.easeIn',
    });

    // Fade out the marker after a few seconds
    this.tweens.add({
      targets: markerText,
      alpha: 0,
      delay: 4000,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => markerText.destroy(),
    });

    // After ~500m more, show the gentle choice
    const choiceAlt = inviteAlt + 500;
    const checkChoice = () => {
      if (this.gameOver || this._softClosing) return;
      if (this.altitudeMeters >= choiceAlt) {
        this._showSessionArcChoice(landLabel);
      } else {
        this.time.delayedCall(200, checkChoice);
      }
    };
    this.time.delayedCall(1000, checkChoice);
  }

  /**
   * Show the "Fly on" / land choice overlay.
   * @private
   * @param {string} [landLabel] - Label for the landing option
   */
  _showSessionArcChoice(landLabel = 'Land gently') {
    const { width, height } = this.scale;

    const choiceBg = this.add.graphics().setScrollFactor(0).setDepth(110);
    choiceBg.fillStyle(0x000000, 0.3);
    choiceBg.fillRect(0, height * 0.35, width, height * 0.22);

    const flyOnText = this.add.text(width / 2, height * 0.41, 'Fly on', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '20px',
      color: UI.COLORS.TEXT_PRIMARY,
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000066', blur: 3, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(111).setAlpha(0)
      .setInteractive({ useHandCursor: true });

    const landText = this.add.text(width / 2, height * 0.50, landLabel, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: '17px',
      color: '#D4A76A',
      fontStyle: 'italic',
      shadow: { offsetX: 1, offsetY: 1, color: '#00000044', blur: 2, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(111).setAlpha(0)
      .setInteractive({ useHandCursor: true });

    // Fade in
    this.tweens.add({ targets: [flyOnText, landText, choiceBg], alpha: { from: 0, to: 1 }, duration: 500 });
    this.tweens.add({ targets: flyOnText, alpha: 1, duration: 500 });
    this.tweens.add({ targets: landText, alpha: 0.8, duration: 500 });

    const dismiss = () => {
      flyOnText.removeInteractive();
      landText.removeInteractive();
      this.tweens.add({
        targets: [flyOnText, landText, choiceBg],
        alpha: 0,
        duration: 400,
        onComplete: () => {
          flyOnText.destroy();
          landText.destroy();
          choiceBg.destroy();
        },
      });
    };

    flyOnText.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      dismiss();
    });

    landText.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      dismiss();
      this._startSoftClose();
    });

    // Auto-dismiss after 6 seconds if no choice made (player keeps flying)
    this.time.delayedCall(6000, () => {
      if (flyOnText.active) dismiss();
    });
  }

  /**
   * Graceful descent: airplane slowly drifts down, trails expand, then transition.
   * @private
   */
  _startSoftClose() {
    if (this._softClosing || this.gameOver) return;
    this._softClosing = true;
    this.gameOver = true;

    // Gentle music fadeout
    this.audioManager.softFadeOut(3);

    // Airplane slowly drifts down
    this.tweens.add({
      targets: this.airplane,
      y: this.airplane.y + this.scale.height * 0.3,
      duration: 3000,
      ease: 'Sine.easeInOut',
    });

    // Airplane gently fades
    this.tweens.add({
      targets: this.airplane,
      alpha: 0.3,
      duration: 3000,
      ease: 'Sine.easeIn',
    });

    // Fade to warm golden
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(1200, 212, 167, 106);
    });

    // Transition to game over with softClose flag
    this.time.delayedCall(3500, () => {
      ScoreManager.recordCrashAltitude(this.altitudeMeters);
      trackGameOver(this.altitudeMeters);
      const results = this.scoreManager.getResults();
      this.scene.start('GameOverScene', {
        score: results.score,
        altitude: this.altitudeMeters,
        streak: results.bestStreak,
        isNewHighScore: results.isNewHighScore,
        personalBest: results.personalBest,
        level: results.level,
        levelName: results.levelName,
        flightCount: results.flightCount,
        totalCatches: results.totalCatches,
        totalMisses: results.totalMisses,
        softClose: true,
        mode: this.mode,
      });
    });
  }

  /**
   * Check if the player has reached the victory altitude.
   * @private
   */
  _checkVictory() {
    if (this.altitudeMeters >= LEVELS.VICTORY_ALTITUDE) {
      this._onVictory();
    }
  }

  /**
   * Handle victory — the player reached the summit.
   * Celebratory slow-mo, gentle ascent, and transition to VictoryScene.
   * @private
   */
  _onVictory() {
    this.gameOver = true;

    // Celebratory time-slow
    this.time.timeScale = 0.3;

    // Gentle music fadeout
    this.audioManager.softFadeOut(4);

    // Float the airplane upward gently
    this.tweens.add({
      targets: this.airplane,
      y: this.airplane.y - 200,
      duration: 4000,
      ease: 'Sine.easeOut',
    });

    // Airplane shimmers — pulsing alpha like it's dissolving into light
    this.tweens.add({
      targets: this.airplane,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });

    // Camera zooms out slowly to reveal the sky
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 0.9,
      duration: 4000,
      ease: 'Sine.easeInOut',
    });

    // Fade to dark (night sky for the constellation)
    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(1200, 0, 0, 15);
    });

    // Transition to VictoryScene
    this.time.delayedCall(4200, () => {
      trackVictory(this.altitudeMeters);
      const results = this.scoreManager.getResults();
      this.scene.start('VictoryScene', {
        altitude: this.altitudeMeters,
        streak: results.bestStreak,
        personalBest: results.personalBest,
        flightCount: results.flightCount,
      });
    });
  }

  /**
   * Apply a speed penalty gradually over a duration using a tween.
   * The airplane just slows naturally, like the wind died — no jarring jump.
   * @private
   * @param {number} amount - Total speed to subtract
   * @param {number} durationMs - Time over which the penalty is applied
   */
  _applyGradualPenalty(amount, durationMs) {
    const startSpeed = this.airplane.riseSpeed;
    const targetSpeed = Math.max(startSpeed - amount, PHYSICS.MIN_RISE_SPEED);

    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: durationMs,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() / 100;
        this.airplane.riseSpeed = startSpeed + (targetSpeed - startSpeed) * t;
      },
      onComplete: () => {
        this.airplane.riseSpeed = targetSpeed;
      },
    });
  }

  /**
   * Toggle pause: launch the PauseOverlayScene on top and pause this scene.
   * @private
   */
  _togglePause() {
    if (this.gameOver) return;
    this.scene.pause();
    this.scene.launch('PauseOverlayScene', { altitude: this.altitudeMeters });
  }
}
