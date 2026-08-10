import { GHOSTS } from '../utils/constants.js';

const STORAGE_KEY = 'updraft_ghosts';

/**
 * GhostPlanes - The sky remembers your flights.
 *
 * Recorder (all modes): samples the airplane's path during flight.
 * Replay (Drift): your last few flights fly alongside you as faint
 * silhouettes, in real time from flight start — yesterday's flight pulls
 * ahead or falls behind exactly as it actually did. When a trace ends,
 * the ghost dissolves into a few light motes.
 *
 * Purely local: traces live in localStorage. No network, no other people —
 * just company from who you were.
 */
export default class GhostPlanes {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../entities/Airplane.js').default} airplane
   * @param {(altitudeMeters: number) => number} altitudeToWorldY
   */
  constructor(scene, airplane, altitudeToWorldY) {
    /** @private */
    this.scene = scene;
    /** @private */
    this.airplane = airplane;
    /** @private */
    this.altitudeToWorldY = altitudeToWorldY;

    /** @private {number} Flight start time (scene clock) */
    this._startTime = scene.time.now;
    /** @private {number} Next sample time */
    this._nextSampleAt = this._startTime;
    /** @private {{t: number, x: number, a: number}[]} This flight's trace */
    this._trace = [];
    /** @private {number} Unique id for this flight's stored entry */
    this._flightId = Date.now();

    // Phaser's shutdown event doesn't fire on tab close or reload —
    // pagehide covers those endings so no flight goes unremembered.
    /** @private */
    this._onPageHide = () => this.saveTrace();
    window.addEventListener('pagehide', this._onPageHide);
    scene.events.once('shutdown', () => {
      window.removeEventListener('pagehide', this._onPageHide);
    });

    /** @private Active ghost replays */
    this._ghosts = [];
    /** @private {boolean} Whether a ghost has been seen this run */
    this._ghostSeen = false;
  }

  /**
   * Spawn replay silhouettes from stored traces. Call from create()
   * in modes that show ghosts (Drift).
   */
  spawnReplays() {
    if (!this.scene.textures.exists('airplane')) return;
    const traces = this._load();
    for (const trace of traces) {
      if (!trace.points || trace.points.length < 4) continue;
      const sprite = this.scene.add.image(-100, -100, 'airplane')
        .setAlpha(0)
        .setScale(0.85)
        .setDepth(2)
        .setTint(0xEDE8F5);
      this._ghosts.push({ sprite, points: trace.points, done: false, faded: false });
    }
  }

  /**
   * Per-frame update: record this flight, advance replays.
   * @param {number} altitudeMeters - Current altitude of the live airplane
   */
  update(altitudeMeters) {
    const now = this.scene.time.now;

    // ── Record ──
    if (now >= this._nextSampleAt && this._trace.length < GHOSTS.MAX_POINTS) {
      this._nextSampleAt = now + GHOSTS.SAMPLE_MS;
      this._trace.push({
        t: Math.round(now - this._startTime),
        x: Math.round(this.airplane.x),
        a: Math.round(altitudeMeters),
      });
    }

    // ── Replay ──
    const elapsed = now - this._startTime;
    for (const ghost of this._ghosts) {
      if (ghost.done) continue;

      const pts = ghost.points;
      if (elapsed >= pts[pts.length - 1].t) {
        this._dissolve(ghost);
        continue;
      }

      // Find the segment containing `elapsed` and interpolate
      let i = 1;
      while (i < pts.length && pts[i].t < elapsed) i++;
      const p0 = pts[i - 1];
      const p1 = pts[Math.min(i, pts.length - 1)];
      const span = Math.max(p1.t - p0.t, 1);
      const f = Math.min(Math.max((elapsed - p0.t) / span, 0), 1);

      const x = p0.x + (p1.x - p0.x) * f;
      const alt = p0.a + (p1.a - p0.a) * f;
      ghost.sprite.setPosition(x, this.altitudeToWorldY(alt));

      // Fade in once airborne; a gentle presence, never a focal point
      if (ghost.sprite.alpha < GHOSTS.ALPHA && elapsed > 1500) {
        ghost.sprite.setAlpha(Math.min(ghost.sprite.alpha + 0.005, GHOSTS.ALPHA));
      }

      if (!this._ghostSeen && this._isOnScreen(ghost.sprite)) {
        this._ghostSeen = true;
        this.scene.events.emit('ghost-visible');
      }
    }
  }

  /**
   * Whether a ghost sprite is within the camera view.
   * @private
   */
  _isOnScreen(sprite) {
    const cam = this.scene.cameras.main;
    return sprite.y > cam.scrollY && sprite.y < cam.scrollY + this.scene.scale.height;
  }

  /**
   * A ghost's trace ended — dissolve into a few light motes.
   * @private
   */
  _dissolve(ghost) {
    ghost.done = true;
    const { x, y } = ghost.sprite;

    this.scene.tweens.add({
      targets: ghost.sprite,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => ghost.sprite.destroy(),
    });

    if (this.scene.textures.exists('trail_particle')) {
      const motes = this.scene.add.particles(x, y, 'trail_particle', {
        speed: { min: 8, max: 25 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.3, end: 0 },
        lifespan: 1100,
        quantity: 6,
        blendMode: 'ADD',
      });
      motes.explode(6);
      this.scene.time.delayedCall(1200, () => motes.destroy());
    }
  }

  /**
   * Save this flight's trace. Upserts by flight id, so calling it more
   * than once (pagehide, then shutdown) keeps the longest version.
   * Every ending — chosen, wind-set, victorious, or abandoned — records.
   */
  saveTrace() {
    if (this._trace.length < 6) return;
    try {
      const stored = this._load().filter((t) => t.id !== this._flightId);
      stored.push({ id: this._flightId, date: this._flightId, points: this._trace });
      while (stored.length > GHOSTS.MAX_STORED) stored.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (_) { /* localStorage might be unavailable */ }
  }

  /**
   * Load stored traces.
   * @private
   * @returns {{ date: number, points: {t:number,x:number,a:number}[] }[]}
   */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
}
