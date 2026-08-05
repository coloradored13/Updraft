/**
 * Updraft - Game Constants
 * All tuning values live here. No magic numbers in game code.
 */

// ── Game Dimensions ──────────────────────────────────────────────────────────

/** @type {{ WIDTH: number, HEIGHT: number }} */
export const GAME = {
  /** Base design width (mobile portrait) */
  WIDTH: 390,
  /** Base design height (mobile portrait) */
  HEIGHT: 844,
};

// ── Airplane ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AirplaneConstants
 * @property {number} BASE_RISE_SPEED - Default upward speed in px/s
 * @property {number} BASE_DRIFT_SPEED - Initial horizontal drift speed in px/s
 * @property {number} MAX_DRIFT_SPEED - Cap on horizontal drift speed in px/s
 * @property {number} BANKING_ANGLE - Max tilt angle in degrees when drifting
 * @property {number} BANKING_LERP - How fast the airplane banks (0-1)
 * @property {number} TRAIL_LENGTH - Number of trail particles
 * @property {number} TRAIL_ALPHA_START - Trail start opacity
 * @property {number} TRAIL_ALPHA_END - Trail end opacity
 * @property {number} BOOST_AMOUNT - Speed added when catching a wind current
 * @property {number} MISS_PENALTY - Speed lost when missing a wind current
 * @property {number} HIT_PENALTY - Speed lost when hitting an obstacle
 * @property {number} WIDTH - Airplane hitbox width
 * @property {number} HEIGHT - Airplane hitbox height
 */
export const AIRPLANE = {
  BASE_RISE_SPEED: 180,
  BASE_DRIFT_SPEED: 80,
  MAX_DRIFT_SPEED: 220,
  BANKING_ANGLE: 25,
  BANKING_LERP: 0.12,
  TRAIL_LENGTH: 20,
  TRAIL_ALPHA_START: 0.4,
  TRAIL_ALPHA_END: 0.0,
  BOOST_AMOUNT: 60,
  MISS_PENALTY: 45,
  HIT_PENALTY: 30,
  WIDTH: 32,
  HEIGHT: 20,
};

// ── Wind Currents ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WindCurrentConstants
 * @property {number} BASE_WIDTH - Starting width of wind currents in px
 * @property {number} MIN_WIDTH - Minimum width at high difficulty
 * @property {number} BASE_SPACING - Vertical distance between currents in px
 * @property {number} MAX_SPACING - Max distance between currents at high difficulty
 * @property {number} BOOST_AMOUNT - Speed boost when caught
 * @property {number} BOOST_DURATION_MS - How long the boost lasts
 * @property {number} DRIFT_OFFSET_MAX - Max horizontal offset from center
 * @property {number} PARTICLE_COUNT - Number of particles in a wind current visual
 * @property {number} ALPHA - Visual opacity of wind currents
 * @property {number} CATCH_TOLERANCE - Extra px around hitbox for forgiving catch
 */
export const WIND_CURRENT = {
  BASE_WIDTH: 110,
  MIN_WIDTH: 40,
  BASE_SPACING: 170,
  MAX_SPACING: 380,
  BOOST_AMOUNT: 60,
  BOOST_DURATION_MS: 500,
  DRIFT_OFFSET_MAX: 150,
  PARTICLE_COUNT: 12,
  ALPHA: 0.5,
  CATCH_TOLERANCE: 8,
};

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ScoringConstants
 * @property {number} METERS_PER_PIXEL - Conversion factor from px to displayed meters
 * @property {number} STREAK_BONUS_MULTIPLIER - Score multiplier per streak level
 * @property {number} STREAK_MILESTONE_SMALL - Catches for small streak bonus
 * @property {number} STREAK_MILESTONE_LARGE - Catches for large streak bonus
 * @property {number} ALTITUDE_SCORE_RATE - Base points per meter
 * @property {number} WIND_CATCH_SCORE - Points for catching a wind current
 */
export const SCORING = {
  METERS_PER_PIXEL: 0.1,
  STREAK_BONUS_MULTIPLIER: 0.5,
  STREAK_MILESTONE_SMALL: 5,
  STREAK_MILESTONE_LARGE: 10,
  ALTITUDE_SCORE_RATE: 1,
  WIND_CATCH_SCORE: 50,
};

// ── Difficulty ───────────────────────────────────────────────────────────────

/**
 * Altitude thresholds in meters where new obstacles / difficulty changes happen.
 * @typedef {Object} DifficultyConstants
 * @property {number[]} OBSTACLE_THRESHOLDS - Altitudes where new obstacle types appear
 * @property {number} WIND_WIDTH_FLOOR - Minimum wind current width at max difficulty
 * @property {number} WIND_SPACING_CEILING - Max spacing at max difficulty
 * @property {number} DRIFT_SPEED_SCALE_MAX - Max multiplier applied to drift speed
 * @property {number} DIFFICULTY_ALTITUDE_CAP - Altitude where difficulty maxes out
 */
export const DIFFICULTY = {
  /** [Birds, StormClouds, Crosswinds, Kites, Combinations] */
  OBSTACLE_THRESHOLDS: [1200, 3000, 5000, 7000, 9500],
  WIND_WIDTH_FLOOR: 70,
  WIND_SPACING_CEILING: 380,
  DRIFT_SPEED_SCALE_MAX: 1.8,
  DIFFICULTY_ALTITUDE_CAP: 9000,
  /** Exponent for the difficulty curve (>1 = front-loaded ramp) */
  CURVE_EXPONENT: 1.5,
};

// ── Obstacles ────────────────────────────────────────────────────────────────

/**
 * Per-obstacle tuning values.
 */
export const OBSTACLES = {
  BIRD: {
    /** Horizontal speed in px/s */
    SPEED: 180,
    /** Sprite width */
    WIDTH: 28,
    /** Sprite height */
    HEIGHT: 20,
    /** Base spawn rate (spawns per 1000px of altitude) */
    SPAWN_RATE: 2.5,
    /** Max spawn rate at peak difficulty */
    MAX_SPAWN_RATE: 5,
    /** Vertical weave amplitude in px */
    WEAVE_AMPLITUDE: 35,
    /** Weave frequency (radians/s) */
    WEAVE_FREQUENCY: 2.2,
  },
  STORM_CLOUD: {
    /** Width of the storm zone */
    WIDTH: 130,
    /** Height of the storm zone */
    HEIGHT: 85,
    SPAWN_RATE: 1.2,
    MAX_SPAWN_RATE: 3.5,
    /** Turbulence shake intensity in px */
    TURBULENCE: 2,
    /** Duration of the slow effect in ms */
    SLOW_DURATION_MS: 900,
    /** Speed reduction multiplier while in storm */
    SLOW_FACTOR: 0.25,
  },
  CROSSWIND: {
    /** Width of the crosswind zone */
    WIDTH: 200,
    /** Height of the crosswind zone */
    HEIGHT: 60,
    /** Horizontal push speed in px/s */
    PUSH_SPEED: 80,
    SPAWN_RATE: 1.0,
    MAX_SPAWN_RATE: 3,
  },
  KITE: {
    /** Sprite width */
    WIDTH: 24,
    /** Sprite height */
    HEIGHT: 36,
    /** Base speed */
    SPEED: 90,
    SPAWN_RATE: 0.8,
    MAX_SPAWN_RATE: 2.5,
    /** String length in px (visual tether) */
    STRING_LENGTH: 100,
    /** Sway amplitude */
    SWAY_AMPLITUDE: 45,
    /** Sway frequency */
    SWAY_FREQUENCY: 1.7,
  },
};

// ── Physics ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PhysicsConstants
 * @property {number} GRAVITY - Downward force when no input (px/s^2)
 * @property {number} MAX_RISE_SPEED - Cap on upward velocity
 * @property {number} MIN_RISE_SPEED - Below this triggers stall warning
 * @property {number} SPEED_DECAY_RATE - Natural speed loss per second
 * @property {number} LATERAL_DAMPING - How fast horizontal momentum decays (0-1)
 */
export const PHYSICS = {
  GRAVITY: 45,
  MAX_RISE_SPEED: 400,
  MIN_RISE_SPEED: 45,
  SPEED_DECAY_RATE: 28,
  LATERAL_DAMPING: 0.90,
};

// ── Visual / Sky Phases ──────────────────────────────────────────────────────

/**
 * Sky color phases based on altitude, designed for watercolor aesthetic.
 * Each phase defines top/bottom gradient colors and a mid-band accent.
 */
export const VISUAL = {
  SKY_PHASES: [
    {
      altitude: 0,
      topColor: 0xF7CAC9,    // soft pink
      bottomColor: 0xFDE8D0, // pale peach / gold
      midColor: 0xF9D5A7,    // warm peach accent
      name: 'dawn',
    },
    {
      altitude: 2000,
      topColor: 0x5DADE2,    // cerulean
      bottomColor: 0xAED6F1, // pale blue wash
      midColor: 0x85C1E9,    // cobalt wash
      name: 'day',
    },
    {
      altitude: 4000,
      topColor: 0xD4A76A,    // amber
      bottomColor: 0xC39BD3, // soft violet
      midColor: 0xCC7722,    // burnt sienna
      name: 'golden',
    },
    {
      altitude: 6000,
      topColor: 0x1A237E,    // deep indigo
      bottomColor: 0x283593, // prussian blue
      midColor: 0x1B3A6B,    // dark blue accent
      name: 'twilight',
    },
    {
      altitude: 8000,
      topColor: 0x0A0A2A,    // dark wash
      bottomColor: 0x121240, // deep night
      midColor: 0x0D0D35,    // midnight accent
      name: 'night',
    },
  ],

  /** Number of parallax cloud layers */
  CLOUD_LAYER_COUNT: 3,
  /** Parallax speeds for each cloud layer (slowest to fastest) */
  CLOUD_PARALLAX: [0.15, 0.3, 0.5],
  /** Max clouds per layer */
  CLOUDS_PER_LAYER: 4,

  /** Star count in the night sky */
  STAR_COUNT: 60,
  /** Altitude where stars begin to appear */
  STAR_APPEAR_ALTITUDE: 5000,
  /** Altitude where stars are fully visible */
  STAR_FULL_ALTITUDE: 7500,

  /** Moon appears at this altitude */
  MOON_APPEAR_ALTITUDE: 7000,
  /** Moon radius in pixels */
  MOON_RADIUS: 30,

  /** Trail particle lifespan in ms */
  TRAIL_LIFESPAN_MS: 600,
  /** Trail particle start scale */
  TRAIL_SCALE_START: 0.5,
  /** Trail particle end scale */
  TRAIL_SCALE_END: 0.1,

  /** Ambient elements (leaves, butterflies, dandelion seeds) */
  AMBIENT_ELEMENT_COUNT: 6,
  /** Max ambient elements on screen at once */
  AMBIENT_MAX_ONSCREEN: 8,
  /** Spawn interval in ms for ambient elements */
  AMBIENT_SPAWN_INTERVAL_MS: 1200,
};

// ── Levels ──────────────────────────────────────────────────────────────

/**
 * Level/stage definitions aligned with sky phases.
 * Each level corresponds to a visual phase and altitude milestone.
 */
export const LEVELS = {
  /** Level definitions in ascending order */
  STAGES: [
    { level: 1, altitude: 0,    name: 'Dawn',        color: 0xF7CAC9 },
    { level: 2, altitude: 2000, name: 'Day',         color: 0x5DADE2 },
    { level: 3, altitude: 4000, name: 'Golden Hour',  color: 0xD4A76A },
    { level: 4, altitude: 6000, name: 'Twilight',     color: 0x1A237E },
    { level: 5, altitude: 8000, name: 'Night',        color: 0x9B59B6 },
  ],
  /** Speed boost granted on level-up (px/s added to rise speed) */
  LEVEL_UP_BOOST: 40,
  /** Duration of level-up boost in ms */
  LEVEL_UP_BOOST_DURATION_MS: 800,
  /** Duration of level-up notification on screen in ms */
  NOTIFICATION_DURATION_MS: 2500,
  /** Altitude at which the player wins the game */
  VICTORY_ALTITUDE: 10000,
};

// ── Thermal Zones ────────────────────────────────────────────────────────────

/**
 * Thermal breathing zones — generous stretches that let the player glide.
 * Spawn periodically based on altitude; disabled at high difficulty.
 */
export const THERMAL = {
  /** Altitude interval in meters between thermal zones */
  INTERVAL_METERS: 400,
  /** Number of wide wind currents in a thermal zone */
  ZONE_CURRENT_COUNT: 3,
  /** Extra width added to wind currents inside a thermal zone */
  ZONE_WIDTH_BONUS: 40,
  /** Vertical spacing between currents in a thermal zone (px) */
  ZONE_SPACING: 80,
  /** Speed decay multiplier while inside a thermal zone (lower = less decay) */
  DECAY_MULTIPLIER: 0.3,
  /** Thermals stop appearing above this difficulty factor */
  MAX_DIFFICULTY_FACTOR: 1.0,
};

// ── Wonder Moments ──────────────────────────────────────────────────────────

/**
 * Visual wonder moments at altitude milestones — purely aesthetic, no gameplay impact.
 */
export const WONDER = {
  /** Cloud break-through bands at these altitudes (meters) */
  CLOUD_BREAK_ALTITUDES: [1000, 3000, 5000],
  /** Height of each cloud band in px */
  CLOUD_BAND_HEIGHT: 80,
  /** Alpha for the cloud band */
  CLOUD_BAND_ALPHA: 0.45,
  /** Flash alpha when passing through */
  CLOUD_FLASH_ALPHA: 0.3,

  /** Friendly passing elements: spawn every N meters starting at START_ALTITUDE */
  FRIENDLY_INTERVAL: 800,
  FRIENDLY_START_ALTITUDE: 800,
  /** Alpha for friendly drifting elements */
  FRIENDLY_ALPHA: 0.55,
  /** Horizontal drift speed in px/s */
  FRIENDLY_DRIFT_SPEED: 30,

  /** Altitude milestone sparkle: burst of small particles around airplane */
  SPARKLE_PARTICLE_COUNT: 12,
  SPARKLE_RADIUS: 35,
  SPARKLE_DURATION_MS: 800,

  /** Distance marker text that drifts by in the background */
  DISTANCE_MARKERS: [
    { altitude: 1000, text: 'Above the rooftops' },
    { altitude: 3000, text: 'Higher than the hills' },
    { altitude: 5000, text: 'The golden hour begins' },
    { altitude: 7000, text: 'Where the air thins' },
    { altitude: 9000, text: 'Almost there' },
  ],
  /** Alpha for distance marker text */
  MARKER_ALPHA: 0.5,
  /** Font size for distance markers */
  MARKER_FONT_SIZE: '15px',
};

// ── Modes ────────────────────────────────────────────────────────────────────

/**
 * Game modes. Drift is the default: no score, no obstacles, no fail state —
 * pure glide, wonder, and play. Ascent is the opt-in competitive climb with
 * scoring, obstacles, and real stakes.
 */
export const MODES = {
  DRIFT: 'drift',
  ASCENT: 'ascent',
};

/** Tuning specific to Drift mode. */
export const DRIFT_TUNING = {
  /** Miss penalty multiplier — the wind sighs, it doesn't punish */
  MISS_PENALTY_SCALE: 0.4,
  /** Altitudes (m) where a companion crane joins the flight */
  COMPANION_ALTITUDES: [1600, 5600],
  /** How long the companion stays before departing (ms) */
  COMPANION_DURATION_MS: 26000,
  /** Sky words: min/max altitude gap between lines (m) */
  WORD_INTERVAL_MIN: 450,
  WORD_INTERVAL_MAX: 850,
  /** Altitudes (m) offering a gentle invitation to rest */
  REST_INVITE_ALTITUDES: [5000, 8500],
  /** One-breath mode: the invitation comes just after the Day transition */
  BREATH_INVITE_ALTITUDE: 2200,
};

/** Local ghost planes — your own past flights, replayed as faint company. */
export const GHOSTS = {
  /** How many past flights the sky remembers */
  MAX_STORED: 3,
  /** Trace sample interval (ms) */
  SAMPLE_MS: 500,
  /** Max points kept per trace (~3.3 min of flight) */
  MAX_POINTS: 400,
  /** Silhouette opacity */
  ALPHA: 0.2,
};

/** Tuning specific to Ascent mode. */
export const ASCENT_TUNING = {
  /** Seconds pinned at minimum rise speed before the wind sets you down */
  STALL_SECONDS: 6,
  /** Seconds at minimum speed before the quiet warning appears */
  STALL_WARNING_SECONDS: 3.5,
  /** Extra px beyond hitbox that counts as a thrilling near-miss */
  NEAR_MISS_RADIUS: 30,
  /** Score bonus for a near-miss */
  NEAR_MISS_BONUS: 25,
  /** Score bonus for catching a current mid/just-after barrel roll */
  STYLE_BONUS: 100,
  /** Window after a roll completes in which a catch still counts as stylish (ms) */
  STYLE_WINDOW_MS: 500,
};

/** Trick tuning (available in both modes). */
export const TRICKS = {
  /** Max gap between taps to register a double-tap (ms) */
  DOUBLE_TAP_MS: 260,
  /** Full roll duration (ms) */
  ROLL_DURATION_MS: 560,
  /** Small speed boost from a roll — play should feel good, not optimal */
  ROLL_BOOST: 15,
  /** Cooldown between tricks (ms) */
  ROLL_COOLDOWN_MS: 700,

  /** Loop-the-loop: swipe up (or Down arrow). Learned from the crane. */
  LOOP_DURATION_MS: 760,
  /** Radius of the sprite-local circle the plane traces (px) */
  LOOP_RADIUS: 20,
  /** Loop boost — a touch more lift than the roll */
  LOOP_BOOST: 25,
  /** Swipe-up detection: minimum upward travel (px) within the window */
  SWIPE_MIN_DY: 60,
  /** Swipe-up detection: max press duration (ms) */
  SWIPE_MAX_MS: 400,

  /** How long the crane holds its expectant pause after a demo (ms) */
  INVITE_PAUSE_MS: 4000,
  /** Max invitations per companion visit — patient, never nagging */
  INVITES_PER_VISIT: 3,
};

// ── Audio ────────────────────────────────────────────────────────────────────

export const AUDIO = {
  /** Master volume (0-1) */
  MASTER_VOLUME: 0.7,
  /** Music volume relative to master */
  MUSIC_VOLUME: 0.7,
  /** SFX volume relative to master */
  SFX_VOLUME: 0.8,
  /** Duration of music crossfade between phases in seconds */
  CROSSFADE_DURATION_S: 12,
  /** Wind ambient base volume */
  WIND_VOLUME: 0.08,
  /** Wind pitch range mapped to airplane speed [minRate, maxRate] */
  WIND_PITCH_RANGE: [0.8, 1.4],

  /** SFX individual volumes (relative to SFX_VOLUME) */
  SFX: {
    CURRENT_CATCH: 0.5,
    STREAK_SMALL: 0.6,
    STREAK_LARGE: 0.7,
    DIRECTION_CHANGE: 0.2,
    BIRD_HIT: 0.5,
    STORM_ENTER: 0.4,
    STORM_EXIT: 0.3,
    BIRD_TELEGRAPH: 0.15,
    CROSSWIND_TELEGRAPH: 0.2,
  },

  /** Muffled low-pass filter frequency when inside storm cloud */
  MUFFLE_FREQUENCY: 400,
  /** Normal low-pass filter frequency */
  NORMAL_FREQUENCY: 20000,
  /** Muffle transition time in seconds */
  MUFFLE_TRANSITION_S: 0.5,
};

// ── UI ───────────────────────────────────────────────────────────────────────

export const UI = {
  /** Font family for all text */
  FONT_FAMILY: '"Segoe UI", system-ui, sans-serif',
  /** Title screen font size */
  TITLE_FONT_SIZE: 48,
  /** HUD font size */
  HUD_FONT_SIZE: 20,
  /** Score font size */
  SCORE_FONT_SIZE: 28,
  /** Game over title font size */
  GAME_OVER_FONT_SIZE: 40,
  /** HUD padding from screen edges */
  HUD_PADDING: 16,
  /** Animation duration for score popups in ms */
  SCORE_POPUP_DURATION_MS: 800,
  /** Animation duration for streak notifications in ms */
  STREAK_NOTIFICATION_DURATION_MS: 1200,
  /** Fade duration for scene transitions in ms */
  SCENE_FADE_DURATION_MS: 500,
  /** Colors */
  COLORS: {
    TEXT_PRIMARY: '#FFFFFF',
    TEXT_SHADOW: '#00000066',
    ACCENT: '#FFD700',
    DANGER: '#FF4444',
  },
};
