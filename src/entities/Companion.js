import Phaser from 'phaser';
import { GAME, TRICKS } from '../utils/constants.js';
import { lerp } from '../utils/helpers.js';

/** How far behind the airplane's path the crane flies, in ms */
const FOLLOW_DELAY_MS = 350;
/** Horizontal offset from the airplane's (delayed) position */
const SIDE_OFFSET = 54;
/** Vertical offset above/beside the airplane */
const Y_OFFSET = -26;
/** How often the crane does a roll of its own (ms, plus jitter) */
const SELF_ROLL_INTERVAL_MS = 8000;

/**
 * Companion - An origami crane that joins the flight in Drift mode.
 *
 * It flies your path a moment after you do — a delayed mirror — flapping
 * gently, banking when you bank. Every so often it barrel-rolls on its own,
 * an invitation to copy it. If you roll, it answers a beat later. After a
 * while it spirals up and away.
 *
 * No collision, no mechanics, no reward. Just company.
 */
export default class Companion extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('./Airplane.js').default} airplane
   * @param {boolean} fromLeft - Which side the crane arrives from
   * @param {number} [visitIndex] - Which visit this is (0-based). On later
   *   visits the crane demonstrates the loop instead of the roll.
   */
  constructor(scene, airplane, fromLeft, visitIndex = 0) {
    const startX = fromLeft ? -50 : GAME.WIDTH + 50;
    super(scene, startX, airplane.y - 60);

    /** @private */
    this.airplane = airplane;
    /** @private {number} Which visit this is */
    this.visitIndex = visitIndex;
    /** @private {number} Which side of the airplane the crane keeps to */
    this.side = fromLeft ? -1 : 1;
    /** @private {{x: number, t: number}[]} Recent airplane positions for delayed follow */
    this._history = [];
    /** @private {number} Extra rotation from an in-progress roll */
    this._rollOffset = 0;
    /** @private {boolean} */
    this._rolling = false;
    /** @private {boolean} Set once the arrival tween finishes */
    this._arrived = false;
    /** @private {boolean} Set when departing; stops following */
    this._departing = false;

    this._draw(scene);
    this.setDepth(6);
    scene.add.existing(this);

    // Glide in from the side
    scene.tweens.add({
      targets: this,
      x: airplane.x + this.side * SIDE_OFFSET,
      y: airplane.y + Y_OFFSET,
      duration: 1800,
      ease: 'Sine.easeOut',
      onComplete: () => { this._arrived = true; },
    });

    /** @private {boolean} Holding the expectant "your turn" pause */
    this._inviting = false;

    // Occasional demonstration — trick, then an expectant pause that
    // makes the demo read as an invitation, not an animation.
    // First visit teaches the roll; later visits teach the loop.
    this._rollTimer = scene.time.addEvent({
      delay: SELF_ROLL_INTERVAL_MS + Math.random() * 4000,
      loop: true,
      callback: () => this._demonstrate(),
    });

    // Wing flap — gentle, continuous
    scene.tweens.add({
      targets: [this._wingL, this._wingR],
      scaleY: 0.55,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Draw an origami crane from folded-paper triangles.
   * @private
   * @param {Phaser.Scene} scene
   */
  _draw(scene) {
    const paper = 0xFAF6EC;
    const crease = 0xDCD2BE;
    const accent = 0xE07050;

    // Body — a folded diamond
    const body = scene.add.graphics();
    body.fillStyle(paper, 1);
    body.fillTriangle(-10, 0, 6, -5, 6, 5);
    body.fillStyle(crease, 1);
    body.fillTriangle(-10, 0, 6, 5, 0, 7);
    // Neck and head
    body.fillStyle(paper, 1);
    body.fillTriangle(6, -5, 6, 3, 15, -7);
    // Beak
    body.fillStyle(accent, 1);
    body.fillTriangle(15, -7, 19, -6, 15, -4);
    this.add(body);

    // Wings — drawn separately so they can flap
    this._wingL = scene.add.graphics();
    this._wingL.fillStyle(paper, 1);
    this._wingL.fillTriangle(0, 0, -4, -14, 6, -3);
    this._wingL.y = -2;
    this.add(this._wingL);

    this._wingR = scene.add.graphics();
    this._wingR.fillStyle(crease, 1);
    this._wingR.fillTriangle(0, 0, -2, 12, 6, 3);
    this._wingR.y = 2;
    this.add(this._wingR);
  }

  /**
   * Per-frame update: follow the airplane's path with a time delay,
   * mirror its banking, keep to one side.
   * @param {number} _delta - Frame delta in ms (unused; history is time-keyed)
   */
  update(_delta) {
    if (this._departing) return;

    const now = this.scene.time.now;
    this._history.push({ x: this.airplane.x, t: now });
    // Keep only what the delay window needs
    while (this._history.length > 2 && this._history[0].t < now - FOLLOW_DELAY_MS - 100) {
      this._history.shift();
    }

    if (!this._arrived) return;

    // Find the airplane's x from FOLLOW_DELAY_MS ago
    const targetT = now - FOLLOW_DELAY_MS;
    let delayedX = this.airplane.x;
    for (const sample of this._history) {
      if (sample.t >= targetT) {
        delayedX = sample.x;
        break;
      }
    }

    // While inviting, the crane drifts closer and holds — waiting on you.
    // Otherwise it flies your path a moment behind, as usual.
    const sideOffset = this._inviting ? SIDE_OFFSET * 0.65 : SIDE_OFFSET;
    const followX = this._inviting ? this.airplane.x : delayedX;
    this.x = lerp(this.x, followX + this.side * sideOffset, this._inviting ? 0.10 : 0.06);
    // A loop tween drives y directly; don't fight it mid-trick
    if (!this._rolling) {
      this.y = lerp(this.y, this.airplane.y + Y_OFFSET, 0.05);
    }

    // Mirror the airplane's banking, softened, plus any roll in progress
    const bank = this.airplane.driftDirection * 14;
    this._baseAngle = lerp(this._baseAngle ?? 0, bank, 0.08);
    this.setAngle(this._baseAngle + this._rollOffset);
  }

  /**
   * Demonstrate this visit's trick, then hold an expectant pause —
   * drifting closer and waiting — so the demo reads as "your turn".
   * The scene listens for 'companion-demo' to render the gesture cue.
   * @private
   */
  _demonstrate() {
    if (this._rolling || this._departing || !this.active) return;
    const trick = this.visitIndex >= 1 ? 'loop' : 'roll';
    if (trick === 'loop') {
      this._doLoop();
    } else {
      this._doRoll();
    }

    // Once the trick lands, turn to the player and wait
    this.scene.time.delayedCall(trick === 'loop' ? 900 : 700, () => {
      if (!this.active || this._departing) return;
      this._inviting = true;
      this.scene.events.emit('companion-demo', trick);
      this.scene.time.delayedCall(TRICKS.INVITE_PAUSE_MS, () => {
        this._inviting = false;
      });
    });
  }

  /**
   * End the expectant pause early — the player took the invitation.
   */
  endInvite() {
    this._inviting = false;
  }

  /**
   * The crane answers the player's barrel roll, a beat later.
   */
  respondRoll() {
    if (!this.active || this._departing) return;
    this.scene.time.delayedCall(400, () => this._doRoll());
  }

  /**
   * The crane celebrates the player's first loop — a delighted double roll.
   */
  celebrateLoop() {
    if (!this.active || this._departing) return;
    this.scene.time.delayedCall(400, () => this._doRoll());
    this.scene.time.delayedCall(1250, () => this._doRoll());
  }

  /**
   * Loop-the-loop demonstration: a small circle traced in the air with a
   * full rotation — the trick the crane is teaching.
   * @private
   */
  _doLoop() {
    if (this._rolling || this._departing || !this.active) return;
    this._rolling = true;

    const radius = 16;
    const baseY = this.y;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 800,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        const theta = t * Math.PI * 2;
        this._rollOffset = t * 360 * this.side;
        this.y = baseY - Math.sin(theta) * radius;
      },
      onComplete: () => {
        this._rollOffset = 0;
        this._rolling = false;
      },
    });
  }

  /**
   * Roll — a full loop with a tiny hop.
   * @private
   */
  _doRoll() {
    if (this._rolling || this._departing || !this.active) return;
    this._rolling = true;

    this.scene.tweens.addCounter({
      from: 0,
      to: 360 * this.side,
      duration: 620,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => { this._rollOffset = tween.getValue(); },
      onComplete: () => {
        this._rollOffset = 0;
        this._rolling = false;
      },
    });

    // A small joyful hop during the roll
    this.scene.tweens.add({
      targets: this,
      y: this.y - 14,
      duration: 310,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /**
   * Depart: spiral up and away, then destroy.
   * @param {Function} [onGone] - Called after the crane has left
   */
  depart(onGone) {
    if (this._departing) return;
    this._departing = true;
    this._inviting = false;
    this._rollTimer?.remove();

    const exitX = this.side > 0 ? GAME.WIDTH + 80 : -80;
    this.scene.tweens.add({
      targets: this,
      x: exitX,
      y: this.y - this.scene.scale.height * 0.5,
      angle: this.side * 40,
      duration: 2600,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.destroy();
        if (onGone) onGone();
      },
    });
  }

  destroy(fromScene) {
    this._rollTimer?.remove();
    super.destroy(fromScene);
  }
}
