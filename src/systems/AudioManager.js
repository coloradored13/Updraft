import * as Tone from 'tone';
import { AUDIO, VISUAL } from '../utils/constants.js';

/**
 * AudioManager - Programmatic audio using Tone.js.
 *
 * Generates all music and SFX procedurally:
 * - Background music that evolves with altitude phase (dawn, day, golden, twilight, night)
 * - Wind ambient loop with pitch shifting based on speed
 * - All SFX: catch, streak chimes, stall, direction change, collisions, telegraphs
 * - Storm cloud muffling via low-pass filter
 *
 * Handles mobile AudioContext restrictions (requires user gesture to start).
 */
export default class AudioManager {
  constructor() {
    /** @private Whether Tone.js context has been started */
    this._started = false;
    /** @private */
    this._muted = false;
    /** @private Current sky phase name */
    this._currentPhase = null;
    /** @private Active music layers keyed by phase name */
    this._musicLayers = {};
    /** @private Master gain for everything */
    this._masterGain = null;
    /** @private Global low-pass filter for storm muffling */
    this._masterFilter = null;
    /** @private Wind noise node */
    this._windNoise = null;
    /** @private Wind gain node */
    this._windGain = null;
    /** @private Wind filter for pitch shifting */
    this._windFilter = null;
    /** @private Reverb send for spacey feel */
    this._reverb = null;
    /** @private Whether currently muffled (storm cloud) */
    this._isMuffled = false;
    /** @private Musical intensity driven by wind catches (0-1) */
    this._musicIntensity = 0.15;
    /** @private Direction of last intensity change: 'up' or 'down' */
    this._intensityDirection = 'up';
    /** @private Index for cycling through pentatonic catch notes */
    this._catchNoteIndex = 0;
    /** @private Title ambient nodes for cleanup */
    this._titleAmbient = null;
    /** @private Whether thermal calm boost is active */
    this._thermalCalm = false;
  }

  /**
   * Initialize the audio context (must be called from a user gesture).
   * Safe to call multiple times; only initializes once.
   */
  async init() {
    if (this._started || this._starting) return;
    this._starting = true;
    try {
      await Tone.start();
      await this._buildGraph();
      Tone.Transport.start();
      this._started = true;
    } catch (e) {
      console.warn('AudioManager init failed:', e);
    }
    this._starting = false;
  }

  /**
   * Build the audio signal graph.
   * @private
   */
  async _buildGraph() {
    // Master filter (for storm muffling)
    this._masterFilter = new Tone.Filter({
      frequency: AUDIO.NORMAL_FREQUENCY,
      type: 'lowpass',
      rolloff: -24,
    }).toDestination();

    // Master gain
    this._masterGain = new Tone.Gain(AUDIO.MASTER_VOLUME).connect(this._masterFilter);

    // Reverb for music and SFX
    this._reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.3,
    }).connect(this._masterGain);

    // Ensure reverb is fully generated before connecting synths
    await this._reverb.generate();

    // Wind ambient
    this._buildWind();
  }

  /**
   * Build the continuous wind ambient sound.
   * @private
   */
  _buildWind() {
    this._windFilter = new Tone.Filter({
      frequency: 600,
      type: 'bandpass',
      Q: 0.8,
    }).connect(this._masterGain);

    this._windGain = new Tone.Gain(0).connect(this._windFilter);

    this._windNoise = new Tone.Noise('pink').connect(this._windGain);
    this._windNoise.start();

    // Fade wind in gently
    this._windGain.gain.rampTo(AUDIO.WIND_VOLUME * AUDIO.MASTER_VOLUME, 2);
  }

  // ── Music System ──────────────────────────────────────────────────────────

  /**
   * Start background music for the initial phase.
   */
  startMusic() {
    if (!this._started) return;
    this.stopTitleAmbient();
    this.crossfadeToPhase('dawn');
  }

  /**
   * Crossfade to the music layer for a given sky phase.
   * @param {string} phase - Phase name: 'dawn', 'day', 'golden', 'twilight', 'night'
   */
  crossfadeToPhase(phase) {
    if (!this._started || phase === this._currentPhase) return;

    try {
      const fadeDuration = AUDIO.CROSSFADE_DURATION_S;

      // Fade out current phase
      if (this._currentPhase && this._musicLayers[this._currentPhase]) {
        const oldPhase = this._currentPhase;
        const old = this._musicLayers[oldPhase];
        old.gain.gain.rampTo(0, fadeDuration);
        // Stop and clean up after fade
        setTimeout(() => {
          try {
            if (old.loop) {
              old.loop.stop();
              old.loop.dispose();
            }
            if (old._synth) old._synth.dispose();
            if (old._chime) old._chime.dispose();
            if (old._layers) {
              for (const l of old._layers) {
                if (l.synth) l.synth.dispose();
                if (l.gain) l.gain.dispose();
              }
            }
            if (old.gain) old.gain.dispose();
          } catch (_) { /* already disposed */ }
          delete this._musicLayers[oldPhase];
        }, fadeDuration * 1000 + 500);
      }

      // Create new phase music
      const layer = this._createMusicLayer(phase);
      if (layer) {
        this._musicLayers[phase] = layer;
        layer.gain.gain.value = 0;
        layer.gain.gain.rampTo(AUDIO.MUSIC_VOLUME * AUDIO.MASTER_VOLUME, fadeDuration);
        // Set layer volumes to match current intensity
        if (layer._layers) {
          for (const l of layer._layers) {
            const t = Math.max(0, Math.min(1, (this._musicIntensity - l.threshold) / 0.2));
            l.gain.gain.value = t * AUDIO.MUSIC_VOLUME * AUDIO.MASTER_VOLUME;
          }
        }
        layer.loop.start();
      }

      this._currentPhase = phase;
    } catch (e) {
      console.warn('Audio crossfade error:', e);
      this._currentPhase = phase;
    }
  }

  /**
   * Create a music layer (synth loop) for a given phase.
   * @private
   * @param {string} phase
   * @returns {{ loop: Tone.Loop|Tone.Pattern, gain: Tone.Gain }|null}
   */
  _createMusicLayer(phase) {
    const gain = new Tone.Gain(0).connect(this._reverb);

    switch (phase) {
      case 'dawn':
        return this._createDawnMusic(gain);
      case 'day':
        return this._createDayMusic(gain);
      case 'golden':
        return this._createGoldenMusic(gain);
      case 'twilight':
        return this._createTwilightMusic(gain);
      case 'night':
        return this._createNightMusic(gain);
      default:
        gain.dispose();
        return null;
    }
  }

  /**
   * Dawn: builds from a gentle piano melody to a warm, full arrangement.
   * Layers: melody → bass → pad chords → high sparkle arpeggios
   * @private
   */
  _createDawnMusic(gain) {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.6, decay: 1.2, sustain: 0.2, release: 2.0 },
      volume: -7,
    }).connect(gain);

    // Layer 1: Bass foundation — warm triangle bass
    const bassGain = new Tone.Gain(0).connect(this._reverb);
    const bass = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.8, decay: 1.5, sustain: 0.3, release: 2.5 },
      volume: -16,
    }).connect(bassGain);

    // Layer 2: Warm pad chords — fat sine for richness
    const padGain = new Tone.Gain(0).connect(this._reverb);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 20 },
      envelope: { attack: 1.5, decay: 2.0, sustain: 0.5, release: 3.0 },
      volume: -14,
    }).connect(padGain);

    // Layer 3: High sparkle arpeggios — sine with longer decay
    const sparkleGain = new Tone.Gain(0).connect(this._reverb);
    const sparkle = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2.0 },
      volume: -18,
    }).connect(sparkleGain);

    const melody = ['C4', 'E4', 'G4', 'A4', 'E4', 'G4', 'C5', 'G4'];
    const bassNotes = ['C3', 'G2', 'A2', 'E2', 'F2', 'C3'];
    const padChords = [['C4','E4','G4'], ['A3','C4','E4'], ['F3','A3','C4'], ['G3','B3','D4'], ['Am3','C4','E4']];
    const sparkleNotes = ['C5', 'E5', 'G5', 'A5', 'C6', 'G5', 'E5', 'A5'];
    let i = 0, bassIdx = 0, padIdx = 0, sparkIdx = 0;

    const loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease(melody[i % melody.length], '2n', time, 0.5);
      // Add a gentle third above every other note for thickness
      if (i % 2 === 0) {
        const third = Tone.Frequency(melody[i % melody.length]).transpose(4).toNote();
        synth.triggerAttackRelease(third, '2n', time + 0.05, 0.15);
      }
      if (i % 3 === 0) {
        bass.triggerAttackRelease(bassNotes[bassIdx++ % bassNotes.length], '1m', time, 0.3);
      }
      if (i % 4 === 2) {
        padChords[padIdx++ % padChords.length].forEach((n, idx) => {
          pad.triggerAttackRelease(n, '1m', time + idx * 0.08, 0.25);
        });
      }
      if (i % 2 === 1) {
        sparkle.triggerAttackRelease(sparkleNotes[sparkIdx++ % sparkleNotes.length], '4n', time, 0.2);
        // Add octave-above ghost note for shimmer
        const oct = Tone.Frequency(sparkleNotes[sparkIdx % sparkleNotes.length]).transpose(12).toNote();
        sparkle.triggerAttackRelease(oct, '8n', time + 0.1, 0.08);
      }
      i++;
    }, '2n');
    loop.humanize = '8n';

    return {
      loop, gain, _synth: synth,
      _layers: [
        { synth: bass, gain: bassGain, threshold: 0.1 },
        { synth: pad, gain: padGain, threshold: 0.25 },
        { synth: sparkle, gain: sparkleGain, threshold: 0.45 },
      ],
    };
  }

  /**
   * Day: builds from gentle arpeggios to a full, warm arrangement.
   * Layers: arpeggio → bass → chord pads → counter-melody
   * @private
   */
  _createDayMusic(gain) {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.3, decay: 0.8, sustain: 0.3, release: 1.5 },
      volume: -7,
    }).connect(gain);

    // Layer 1: Rhythmic bass line — triangle for warmth
    const bassGain = new Tone.Gain(0).connect(this._reverb);
    const bass = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.15, decay: 0.6, sustain: 0.2, release: 1.0 },
      volume: -14,
    }).connect(bassGain);

    // Layer 2: Lush pad chords — fatsine for width
    const padGain = new Tone.Gain(0).connect(this._reverb);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 25 },
      envelope: { attack: 1.2, decay: 1.5, sustain: 0.4, release: 2.5 },
      volume: -12,
    }).connect(padGain);

    // Layer 3: Bright counter-melody with harmonics
    const counterGain = new Tone.Gain(0).connect(this._reverb);
    const counter = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.15, decay: 0.6, sustain: 0.1, release: 1.2 },
      volume: -16,
    }).connect(counterGain);

    const melody = ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'E4', 'A4'];
    const bassNotes = ['D2', 'A2', 'E2', 'A2', 'D2', 'F#2', 'E2', 'A2'];
    const padChords = [['D3','F#3','A3','D4'], ['A3','C#4','E4','A4'], ['B3','D4','F#4'], ['G3','B3','D4','G4']];
    const counterMelody = ['A5', 'F#5', 'D5', 'E5', 'F#5', 'A5', 'B5', 'A5'];
    let i = 0, padIdx = 0;

    const loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease(melody[i % melody.length], '4n', time, 0.45);
      // Octave below on downbeats for depth
      if (i % 4 === 0) {
        const low = Tone.Frequency(melody[i % melody.length]).transpose(-12).toNote();
        synth.triggerAttackRelease(low, '4n', time, 0.12);
      }
      bass.triggerAttackRelease(bassNotes[i % bassNotes.length], '4n', time, 0.35);
      if (i % 4 === 0) {
        padChords[padIdx++ % padChords.length].forEach((n, idx) => {
          pad.triggerAttackRelease(n, '1m', time + idx * 0.1, 0.25);
        });
      }
      if (i % 2 === 0) {
        counter.triggerAttackRelease(counterMelody[i % counterMelody.length], '4n', time, 0.2);
        // Add 5th above for brightness
        const fifth = Tone.Frequency(counterMelody[i % counterMelody.length]).transpose(7).toNote();
        counter.triggerAttackRelease(fifth, '8n', time + 0.05, 0.1);
      }
      i++;
    }, '4n');
    loop.humanize = '16n';

    return {
      loop, gain, _synth: synth,
      _layers: [
        { synth: bass, gain: bassGain, threshold: 0.1 },
        { synth: pad, gain: padGain, threshold: 0.25 },
        { synth: counter, gain: counterGain, threshold: 0.45 },
      ],
    };
  }

  /**
   * Golden hour: builds from emotional melody to lush, layered warmth.
   * Layers: melody → deep pedal tones → rich 7th chords → shimmering octave doubles
   * @private
   */
  _createGoldenMusic(gain) {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 15 },
      envelope: { attack: 0.5, decay: 1.0, sustain: 0.35, release: 2.5 },
      volume: -8,
    }).connect(gain);

    // Layer 1: Deep pedal tones — triangle for body
    const pedalGain = new Tone.Gain(0).connect(this._reverb);
    const pedal = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.2, decay: 2.5, sustain: 0.4, release: 3.5 },
      volume: -16,
    }).connect(pedalGain);

    // Layer 2: Rich 7th chords — fatsine for lush spread
    const chordGain = new Tone.Gain(0).connect(this._reverb);
    const chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 30 },
      envelope: { attack: 0.8, decay: 1.5, sustain: 0.5, release: 2.5 },
      volume: -12,
    }).connect(chordGain);

    // Layer 3: Shimmering arpeggiated octave doubles
    const shimmerGain = new Tone.Gain(0).connect(this._reverb);
    const shimmer = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 1.2, sustain: 0, release: 2.0 },
      volume: -16,
    }).connect(shimmerGain);

    const melody = ['E4', 'G4', 'B4', 'D5', 'C5', 'A4', 'G4', 'E4'];
    const pedalNotes = ['E2', 'G2', 'A2', 'B2', 'C3', 'A2'];
    const seventhChords = [['E3','G#3','B3','D4'], ['C3','E3','G3','B3'], ['A2','C3','E3','G3'], ['G2','B2','D3','F#3'], ['D3','F#3','A3','C4']];
    const shimmerNotes = ['E5', 'G5', 'B5', 'D6', 'C6', 'A5', 'G5', 'E5'];
    let i = 0, pedalIdx = 0, chordIdx = 0;

    const loop = new Tone.Loop((time) => {
      const note = melody[i % melody.length];
      synth.triggerAttackRelease(note, '2n', time, 0.5);
      // Parallel 4th below for emotional richness
      if (i % 2 === 0) {
        synth.triggerAttackRelease(Tone.Frequency(note).transpose(-5).toNote(), '2n', time + 0.08, 0.18);
      }
      // Add octave below on every 4th note for weight
      if (i % 4 === 0) {
        synth.triggerAttackRelease(Tone.Frequency(note).transpose(-12).toNote(), '2n', time, 0.12);
      }
      if (i % 3 === 0) {
        pedal.triggerAttackRelease(pedalNotes[pedalIdx++ % pedalNotes.length], '1m', time, 0.3);
      }
      if (i % 4 === 2) {
        seventhChords[chordIdx++ % seventhChords.length].forEach((n, idx) => {
          chordSynth.triggerAttackRelease(n, '1m', time + idx * 0.06, 0.22);
        });
      }
      // Rapid shimmer arpeggios — 3 notes cascading
      if (i % 2 === 0) {
        for (let j = 0; j < 3; j++) {
          shimmer.triggerAttackRelease(shimmerNotes[(i + j) % shimmerNotes.length], '8n', time + j * 0.08, 0.18);
        }
      }
      i++;
    }, '2n');
    loop.humanize = '8n';

    return {
      loop, gain, _synth: synth,
      _layers: [
        { synth: pedal, gain: pedalGain, threshold: 0.1 },
        { synth: chordSynth, gain: chordGain, threshold: 0.25 },
        { synth: shimmer, gain: shimmerGain, threshold: 0.45 },
      ],
    };
  }

  /**
   * Twilight: builds from ambient pads to a deep, mysterious soundscape.
   * Layers: pad chords → sub-bass drone → weaving arpeggios → high harmonics
   * @private
   */
  _createTwilightMusic(gain) {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 20 },
      envelope: { attack: 1.5, decay: 2.0, sustain: 0.5, release: 3.5 },
      volume: -7,
    }).connect(gain);

    // Layer 1: Sub-bass drone — deep triangle
    const droneGain = new Tone.Gain(0).connect(this._masterGain);
    const drone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 2.5, decay: 3.0, sustain: 0.6, release: 4.0 },
      volume: -16,
    }).connect(droneGain);

    // Layer 2: Weaving arpeggio patterns — sine with reverb
    const arpGain = new Tone.Gain(0).connect(this._reverb);
    const arp = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.8, sustain: 0, release: 1.5 },
      volume: -14,
    }).connect(arpGain);

    // Layer 3: High ethereal harmonics — wide fat for celestial feel
    const harmonicGain = new Tone.Gain(0).connect(this._reverb);
    const harmonic = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 40 },
      envelope: { attack: 1.0, decay: 2.5, sustain: 0.3, release: 3.5 },
      volume: -18,
    }).connect(harmonicGain);

    const chords = [['A3','C4','E4','G4'], ['G3','B3','D4','F4'], ['F3','A3','C4','E4'], ['E3','G3','B3','D4']];
    const droneNotes = ['A1', 'G1', 'F1', 'E1'];
    const arpNotes = ['A4', 'E4', 'C5', 'G4', 'A4', 'D5', 'E4', 'B4'];
    const harmonicNotes = ['A5', 'E6', 'G5', 'D6', 'C6', 'A5'];
    let i = 0, arpIdx = 0;

    const loop = new Tone.Loop((time) => {
      const chord = chords[i % chords.length];
      chord.forEach((note, idx) => {
        synth.triggerAttackRelease(note, '1m', time + idx * 0.12, 0.25);
      });
      drone.triggerAttackRelease(droneNotes[i % droneNotes.length], '1m', time, 0.35);
      // Add a 5th above the drone for depth
      const droneFifth = Tone.Frequency(droneNotes[i % droneNotes.length]).transpose(7).toNote();
      drone.triggerAttackRelease(droneFifth, '1m', time + 0.5, 0.15);
      // Arpeggios: 6 notes cascading through the measure
      for (let j = 0; j < 6; j++) {
        arp.triggerAttackRelease(arpNotes[(arpIdx + j) % arpNotes.length], '8n', time + j * 0.35, 0.18);
      }
      arpIdx += 6;
      // Harmonics: two-note chord for width
      harmonic.triggerAttackRelease(harmonicNotes[i % harmonicNotes.length], '1m', time + 0.3, 0.15);
      const harmFifth = Tone.Frequency(harmonicNotes[i % harmonicNotes.length]).transpose(7).toNote();
      harmonic.triggerAttackRelease(harmFifth, '1m', time + 0.5, 0.1);
      i++;
    }, '1m');

    return {
      loop, gain, _synth: synth,
      _layers: [
        { synth: drone, gain: droneGain, threshold: 0.1 },
        { synth: arp, gain: arpGain, threshold: 0.25 },
        { synth: harmonic, gain: harmonicGain, threshold: 0.45 },
      ],
    };
  }

  /**
   * Night: builds from sparse, contemplative pads to a celestial soundscape.
   * Layers: pad + chimes → deep drone → bell arpeggios → celestial choir
   * @private
   */
  _createNightMusic(gain) {
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 30 },
      envelope: { attack: 2.5, decay: 2.5, sustain: 0.5, release: 4.5 },
      volume: -8,
    }).connect(gain);

    const chime = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 2.0, sustain: 0, release: 3.0 },
      volume: -16,
    }).connect(gain);

    // Layer 1: Deep drone — triangle for warmth
    const droneGain = new Tone.Gain(0).connect(this._masterGain);
    const drone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 3.5, decay: 3.5, sustain: 0.6, release: 4.5 },
      volume: -18,
    }).connect(droneGain);

    // Layer 2: Bell arpeggios — brighter and more present
    const bellGain = new Tone.Gain(0).connect(this._reverb);
    const bell = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 1.8, sustain: 0, release: 2.5 },
      volume: -16,
    }).connect(bellGain);

    // Layer 3: Celestial choir — wide fatsine for ethereal depth
    const choirGain = new Tone.Gain(0).connect(this._reverb);
    const choir = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', spread: 40 },
      envelope: { attack: 2.0, decay: 2.5, sustain: 0.5, release: 3.5 },
      volume: -14,
    }).connect(choirGain);

    const padNotes = [['D3','F3','A3','D4'], ['C3','E3','G3','C4'], ['Bb2','D3','F3','A3']];
    const chimeNotes = ['A5', 'E5', 'D5', 'F#5', 'C5', 'G5', 'A5', 'D6'];
    const droneNotes = ['D1', 'C1', 'Bb0'];
    const bellNotes = ['D5', 'F5', 'A5', 'C6', 'D6', 'A5', 'F5', 'D5'];
    const choirChords = [['D4','F4','A4','C5','D5'], ['C4','E4','G4','B4','C5'], ['Bb3','D4','F4','A4']];
    let padIdx = 0, chimeIdx = 0, bellIdx = 0;

    const loop = new Tone.Loop((time) => {
      const chord = padNotes[padIdx % padNotes.length];
      chord.forEach((note, idx) => {
        pad.triggerAttackRelease(note, '2m', time + idx * 0.15, 0.2);
      });
      // Two chime notes per measure for more sparkle
      chime.triggerAttackRelease(chimeNotes[chimeIdx % chimeNotes.length], '8n', time + 1.0, 0.22);
      chime.triggerAttackRelease(chimeNotes[(chimeIdx + 1) % chimeNotes.length], '8n', time + 2.5, 0.15);
      drone.triggerAttackRelease(droneNotes[padIdx % droneNotes.length], '2m', time, 0.3);
      // Drone 5th for depth
      const droneFifth = Tone.Frequency(droneNotes[padIdx % droneNotes.length]).transpose(7).toNote();
      drone.triggerAttackRelease(droneFifth, '2m', time + 0.5, 0.12);
      // Bell cascade — 4 notes
      for (let j = 0; j < 4; j++) {
        bell.triggerAttackRelease(bellNotes[(bellIdx + j) % bellNotes.length], '16n', time + 0.8 + j * 0.18, 0.18);
      }
      bellIdx += 4;
      // Choir chords with staggered voicing
      choirChords[padIdx % choirChords.length].forEach((n, idx) => {
        choir.triggerAttackRelease(n, '2m', time + 0.4 + idx * 0.12, 0.15);
      });
      padIdx++;
      chimeIdx += 2;
    }, '2m');

    return {
      loop, gain, _synth: pad, _chime: chime,
      _layers: [
        { synth: drone, gain: droneGain, threshold: 0.1 },
        { synth: bell, gain: bellGain, threshold: 0.25 },
        { synth: choir, gain: choirGain, threshold: 0.45 },
      ],
    };
  }

  // ── Musical Intensity (wind catch feedback) ──────────────────────────────

  /**
   * Called when the player catches a wind current.
   * Increases musical intensity, enriching the soundtrack.
   */
  onWindCatch() {
    if (!this._started) return;
    this._musicIntensity = Math.min(this._musicIntensity + 0.12, 1.0);
    this._intensityDirection = 'up';
    this._updateLayerVolumes();
  }

  /**
   * Called when the player misses a wind current.
   * Decreases musical intensity gently, thinning the soundtrack gradually.
   */
  onWindMiss() {
    if (!this._started) return;
    this._musicIntensity = Math.max(this._musicIntensity - 0.06, 0.0);
    this._intensityDirection = 'down';
    this._updateLayerVolumes();
  }

  /**
   * Update all progressive layer volumes based on current _musicIntensity.
   * Each layer has a threshold — it fades in smoothly over a 0.2 intensity range.
   * @private
   */
  _updateLayerVolumes() {
    const rampTime = this._intensityDirection === 'down' ? 1.5 : 0.8;
    for (const layer of Object.values(this._musicLayers)) {
      if (!layer._layers) continue;
      for (const l of layer._layers) {
        const t = Math.max(0, Math.min(1, (this._musicIntensity - l.threshold) / 0.2));
        const targetVol = t * AUDIO.MUSIC_VOLUME * AUDIO.MASTER_VOLUME;
        l.gain.gain.rampTo(targetVol, rampTime);
      }
    }
  }

  // ── Title Ambient ────────────────────────────────────────────────────────

  /**
   * Play a soft ambient version of the dawn music for the title screen.
   * Includes a gentle base melody at ~30% volume and soft wind noise underneath.
   */
  playTitleAmbient() {
    if (!this._started || this._titleAmbient) return;

    const ambientGain = new Tone.Gain(0).connect(this._reverb);

    // Soft dawn melody at ~30% volume
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.8, decay: 1.5, sustain: 0.1, release: 2.5 },
      volume: -18,
    }).connect(ambientGain);

    const melody = ['C4', 'E4', 'G4', 'A4', 'E4', 'G4', 'C5', 'G4'];
    let i = 0;

    const loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease(melody[i % melody.length], '2n', time, 0.2);
      i++;
    }, '2n');
    loop.humanize = '8n';
    loop.start();

    // Gentle wind noise underneath
    const windFilter = new Tone.Filter({
      frequency: 500,
      type: 'bandpass',
      Q: 0.6,
    }).connect(ambientGain);
    const windGain = new Tone.Gain(0).connect(windFilter);
    const windNoise = new Tone.Noise('pink').connect(windGain);
    windNoise.start();
    windGain.gain.rampTo(AUDIO.WIND_VOLUME * 0.5, 1);

    // Fade in the ambient music
    const targetVol = AUDIO.MUSIC_VOLUME * AUDIO.MASTER_VOLUME * 0.3;
    ambientGain.gain.rampTo(targetVol, 2);

    this._titleAmbient = { gain: ambientGain, synth, loop, windNoise, windGain, windFilter };
  }

  /**
   * Stop title ambient with a 1-second fade out.
   */
  stopTitleAmbient() {
    if (!this._titleAmbient) return;

    const amb = this._titleAmbient;
    this._titleAmbient = null;

    amb.gain.gain.rampTo(0, 1);
    amb.windGain.gain.rampTo(0, 1);

    setTimeout(() => {
      try {
        amb.loop.stop();
        amb.loop.dispose();
        amb.synth.dispose();
        amb.windNoise.stop();
        amb.windNoise.dispose();
        amb.windGain.dispose();
        amb.windFilter.dispose();
        amb.gain.dispose();
      } catch (_) { /* already disposed */ }
    }, 1200);
  }

  // ── Takeoff Swell ──────────────────────────────────────────────────────

  /**
   * Play a brief uplifting musical swell on first wind catch of a run.
   * Ascending 3-note figure (C4 -> E4 -> G4) with warm pad sound and reverb.
   */
  playTakeoffSwell() {
    if (!this._started) return;

    const swellGain = new Tone.Gain(0.6).connect(this._reverb);

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.6, sustain: 0.2, release: 1.2 },
      volume: -14,
    }).connect(swellGain);

    // Ascending 3-note figure over 600ms
    const notes = ['C4', 'E4', 'G4'];
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '4n', Tone.now() + i * 0.2, 0.35 + i * 0.05);
    });

    // Gentle fade out of the swell gain
    swellGain.gain.rampTo(0, 1.5);

    setTimeout(() => {
      try {
        synth.dispose();
        swellGain.dispose();
      } catch (_) { /* already disposed */ }
    }, 3000);
  }

  // ── Soft Fadeout ───────────────────────────────────────────────────────

  /**
   * Gradually reduce all music and wind volumes to 0 over the specified duration,
   * then call stopMusic() to clean up.
   * @param {number} durationSeconds - Fade duration in seconds
   */
  softFadeOut(durationSeconds) {
    if (!this._started) return;

    // Fade all active music layers
    for (const layer of Object.values(this._musicLayers)) {
      if (layer.gain) {
        layer.gain.gain.rampTo(0, durationSeconds);
      }
      if (layer._layers) {
        for (const l of layer._layers) {
          if (l.gain) l.gain.gain.rampTo(0, durationSeconds);
        }
      }
    }

    // Fade wind noise
    if (this._windGain) {
      this._windGain.gain.rampTo(0, durationSeconds);
    }

    // After the duration, clean up
    setTimeout(() => {
      this.stopMusic();
    }, durationSeconds * 1000 + 200);
  }

  // ── Thermal Calm ──────────────────────────────────────────────────────

  /**
   * Slightly boost or restore music volume when entering/leaving a thermal zone.
   * @param {boolean} active - true when entering thermal, false when leaving
   */
  setThermalCalm(active) {
    if (!this._started || !this._masterGain || active === this._thermalCalm) return;
    this._thermalCalm = active;

    const baseVol = this._muted ? 0 : AUDIO.MASTER_VOLUME;
    const targetVol = active ? baseVol * 1.1 : baseVol;
    this._masterGain.gain.rampTo(targetVol, 0.8);
  }

  // ── SFX System ────────────────────────────────────────────────────────────

  /**
   * Play a sound effect by name.
   * @param {string} name - SFX identifier
   */
  playSFX(name) {
    if (!this._started || this._muted) return;

    switch (name) {
      case 'currentCatch':
        this._playCurrentCatch();
        break;
      case 'streakSmall':
        this._playStreakSmall();
        break;
      case 'streakLarge':
        this._playStreakLarge();
        break;
      case 'directionChange':
        this._playDirectionChange();
        break;
      case 'birdHit':
        this._playBirdHit();
        break;
      case 'stormEnter':
        this._playStormEnter();
        break;
      case 'stormExit':
        this._playStormExit();
        break;
      case 'birdTelegraph':
        this._playBirdTelegraph();
        break;
      case 'crosswindTelegraph':
        this._playCrosswindTelegraph();
        break;
      case 'levelUp':
        this._playLevelUp();
        break;
    }
  }

  /**
   * Current catch: soft whoosh + subtle wind chime.
   * @private
   */
  _playCurrentCatch() {
    const vol = this._sfxDb(AUDIO.SFX.CURRENT_CATCH);

    // Soft whoosh via filtered noise burst
    const noise = new Tone.Noise('white');
    const filter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 1 });
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.02,
      decay: 0.3,
      sustain: 0,
      release: 0.2,
    });
    noise.connect(filter);
    filter.connect(env);
    env.connect(this._masterGain);
    env.set({ volume: vol });
    noise.start();
    env.triggerAttackRelease(0.3);
    setTimeout(() => { noise.stop(); noise.dispose(); filter.dispose(); env.dispose(); }, 1000);

    // Musical note from phase-matched pentatonic scale
    // Builds from single notes to harmonies as intensity grows
    const phaseScales = {
      dawn:     ['C', 'D', 'E', 'G', 'A'],
      day:      ['D', 'E', 'F#', 'A', 'B'],
      golden:   ['E', 'G', 'A', 'B', 'D'],
      twilight: ['A', 'C', 'D', 'E', 'G'],
      night:    ['D', 'F', 'G', 'A', 'C'],
    };
    const scale = phaseScales[this._currentPhase] || phaseScales.dawn;
    const noteIdx = this._catchNoteIndex % scale.length;
    const octave = this._musicIntensity > 0.6 ? 5 : 4;
    const rootNote = scale[noteIdx] + octave;
    this._catchNoteIndex++;

    const decay = 0.8 + this._musicIntensity * 1.2; // longer sustain at high intensity
    const chime = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay, sustain: 0, release: 1.5 },
      volume: vol - 2,
    }).connect(this._reverb);

    const velocity = 0.2 + this._musicIntensity * 0.3;
    chime.triggerAttackRelease(rootNote, '8n', Tone.now(), velocity);

    // At medium intensity: add a perfect 5th harmony
    if (this._musicIntensity > 0.3) {
      const fifth = Tone.Frequency(rootNote).transpose(7).toNote();
      chime.triggerAttackRelease(fifth, '8n', Tone.now() + 0.03, velocity * 0.6);
    }

    // At high intensity: add octave above for a full, bright chord
    if (this._musicIntensity > 0.65) {
      const octaveUp = Tone.Frequency(rootNote).transpose(12).toNote();
      chime.triggerAttackRelease(octaveUp, '8n', Tone.now() + 0.06, velocity * 0.4);
    }

    setTimeout(() => chime.dispose(), 3000);
  }

  /**
   * Streak milestone (every 5): warm singing bowl / soft bell chime.
   * @private
   */
  _playStreakSmall() {
    const vol = this._sfxDb(AUDIO.SFX.STREAK_SMALL);
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2.0 },
      volume: vol,
    }).connect(this._reverb);
    synth.triggerAttackRelease('G5', '4n');

    // Overtone
    const overtone = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 1.0, sustain: 0, release: 1.5 },
      volume: vol - 6,
    }).connect(this._reverb);
    overtone.triggerAttackRelease('D6', '4n', Tone.now() + 0.1);

    setTimeout(() => { synth.dispose(); overtone.dispose(); }, 4000);
  }

  /**
   * Streak milestone (every 10): more elaborate chime sequence.
   * @private
   */
  _playStreakLarge() {
    const vol = this._sfxDb(AUDIO.SFX.STREAK_LARGE);
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 1.2, sustain: 0, release: 2.0 },
      volume: vol,
    }).connect(this._reverb);

    const notes = ['E5', 'G5', 'B5', 'E6'];
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '4n', Tone.now() + i * 0.12, 0.5);
    });

    setTimeout(() => synth.dispose(), 5000);
  }

  /**
   * Stall/game over: soft paper flutter descending in pitch.
   * @private
   */
  /**
   * Direction change: very subtle paper swish.
   * @private
   */
  _playDirectionChange() {
    const vol = this._sfxDb(AUDIO.SFX.DIRECTION_CHANGE);
    const noise = new Tone.Noise('white');
    const filter = new Tone.Filter({ frequency: 4000, type: 'highpass' });
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.005,
      decay: 0.08,
      sustain: 0,
      release: 0.05,
    });
    noise.connect(filter);
    filter.connect(env);
    env.connect(this._masterGain);
    env.set({ volume: vol });
    noise.start();
    env.triggerAttackRelease(0.08);
    setTimeout(() => { noise.stop(); noise.dispose(); filter.dispose(); env.dispose(); }, 300);
  }

  /**
   * Bird collision: soft thud + feather ruffle.
   * @private
   */
  _playBirdHit() {
    const vol = this._sfxDb(AUDIO.SFX.BIRD_HIT);

    // Thud
    const thud = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
      volume: vol,
    }).connect(this._masterGain);
    thud.triggerAttackRelease('C2', '16n');

    // Feather ruffle
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter({ frequency: 2000, type: 'lowpass' });
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 0.3,
      sustain: 0.05,
      release: 0.3,
    });
    noise.connect(filter);
    filter.connect(env);
    env.connect(this._masterGain);
    env.set({ volume: vol - 4 });
    noise.start();
    env.triggerAttackRelease(0.4);

    setTimeout(() => {
      thud.dispose(); noise.stop(); noise.dispose();
      filter.dispose(); env.dispose();
    }, 1500);
  }

  /**
   * Storm cloud entry: muffled underwater filter + distant thunder.
   * @private
   */
  _playStormEnter() {
    const vol = this._sfxDb(AUDIO.SFX.STORM_ENTER);

    // Distant thunder rumble
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter({ frequency: 200, type: 'lowpass', rolloff: -24 });
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.3,
      decay: 1.5,
      sustain: 0,
      release: 1.0,
    });
    noise.connect(filter);
    filter.connect(env);
    env.connect(this._masterGain);
    env.set({ volume: vol });
    noise.start();
    env.triggerAttackRelease(1.5);

    setTimeout(() => { noise.stop(); noise.dispose(); filter.dispose(); env.dispose(); }, 4000);
  }

  /**
   * Storm cloud exit: audio unmuffles (handled by setMuffled, this is the "pop" out).
   * @private
   */
  _playStormExit() {
    const vol = this._sfxDb(AUDIO.SFX.STORM_EXIT);
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
      volume: vol,
    }).connect(this._reverb);
    synth.triggerAttackRelease('C5', '16n');
    setTimeout(() => synth.dispose(), 1500);
  }

  /**
   * Bird telegraph: faint bird call 1 second before entry.
   * @private
   */
  _playBirdTelegraph() {
    const vol = this._sfxDb(AUDIO.SFX.BIRD_TELEGRAPH);
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0, release: 0.2 },
      volume: vol,
    }).connect(this._reverb);

    // Two-note chirp
    synth.triggerAttackRelease('E6', '32n');
    setTimeout(() => {
      synth.triggerAttackRelease('G6', '32n');
    }, 100);
    setTimeout(() => synth.dispose(), 1000);
  }

  /**
   * Crosswind telegraph: directional wind shift.
   * @private
   */
  _playCrosswindTelegraph() {
    const vol = this._sfxDb(AUDIO.SFX.CROSSWIND_TELEGRAPH);
    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 2 });
    const panner = new Tone.Panner(0);
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.2,
      decay: 0.5,
      sustain: 0,
      release: 0.3,
    });
    noise.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this._masterGain);
    env.set({ volume: vol });

    // Pan from center to side
    panner.pan.rampTo(Math.random() > 0.5 ? 1 : -1, 0.7);

    noise.start();
    env.triggerAttackRelease(0.7);

    setTimeout(() => {
      noise.stop(); noise.dispose(); filter.dispose();
      panner.dispose(); env.dispose();
    }, 2000);
  }

  /**
   * Level-up: ascending arpeggio C4→E4→G4→C5 played in rapid succession.
   * @private
   */
  _playLevelUp() {
    const vol = this._sfxDb(0.65);
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.6, sustain: 0, release: 1.5 },
      volume: vol,
    }).connect(this._reverb);

    const notes = ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '8n', Tone.now() + i * 0.09, 0.5);
    });

    setTimeout(() => synth.dispose(), 4000);
  }

  // ── Wind & Environment ────────────────────────────────────────────────────

  /**
   * Adjust wind ambient pitch based on airplane speed.
   * @param {number} speed - Current rise speed
   * @param {number} maxSpeed - Maximum rise speed
   */
  setWindPitch(speed, maxSpeed) {
    if (!this._started || !this._windFilter) return;
    const t = Math.min(speed / maxSpeed, 1);
    const [minRate, maxRate] = AUDIO.WIND_PITCH_RANGE;
    const freq = 400 + t * 800;
    this._windFilter.frequency.rampTo(freq, 0.3);

    // Also adjust wind volume slightly with speed
    const vol = AUDIO.WIND_VOLUME * (0.5 + t * 0.5) * AUDIO.MASTER_VOLUME;
    if (this._windGain) {
      this._windGain.gain.rampTo(vol, 0.3);
    }
  }

  /**
   * Set muffled state (for storm cloud entry/exit).
   * @param {boolean} muffled
   */
  setMuffled(muffled) {
    if (!this._started || !this._masterFilter) return;
    if (muffled === this._isMuffled) return;
    this._isMuffled = muffled;

    const targetFreq = muffled ? AUDIO.MUFFLE_FREQUENCY : AUDIO.NORMAL_FREQUENCY;
    this._masterFilter.frequency.rampTo(targetFreq, AUDIO.MUFFLE_TRANSITION_S);
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  /**
   * Toggle mute.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this._muted = !this._muted;
    if (this._masterGain) {
      this._masterGain.gain.rampTo(this._muted ? 0 : AUDIO.MASTER_VOLUME, 0.3);
    }
    return this._muted;
  }

  /** @returns {boolean} Whether audio is muted */
  get muted() {
    return this._muted;
  }

  /**
   * Stop all music and clean up.
   */
  stopMusic() {
    for (const phase of Object.keys(this._musicLayers)) {
      const layer = this._musicLayers[phase];
      if (layer) {
        if (layer.loop) { layer.loop.stop(); layer.loop.dispose(); }
        if (layer.gain) layer.gain.dispose();
        if (layer._synth) layer._synth.dispose();
        if (layer._chime) layer._chime.dispose();
        if (layer._layers) {
          for (const l of layer._layers) {
            if (l.synth) l.synth.dispose();
            if (l.gain) l.gain.dispose();
          }
        }
      }
    }
    this._musicLayers = {};
    this._currentPhase = null;
    this._musicIntensity = 0;
    this._intensityDirection = 'up';
  }

  /**
   * Full cleanup.
   */
  destroy() {
    this.stopTitleAmbient();
    this.stopMusic();
    if (this._windNoise) { this._windNoise.stop(); this._windNoise.dispose(); }
    if (this._windGain) this._windGain.dispose();
    if (this._windFilter) this._windFilter.dispose();
    if (this._reverb) this._reverb.dispose();
    if (this._masterGain) this._masterGain.dispose();
    if (this._masterFilter) this._masterFilter.dispose();
    this._started = false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Convert a relative SFX volume (0-1) to decibels, factoring in SFX_VOLUME and MASTER_VOLUME.
   * @private
   * @param {number} relativeVol - Volume 0-1
   * @returns {number} Volume in dB
   */
  _sfxDb(relativeVol) {
    const linear = relativeVol * AUDIO.SFX_VOLUME * AUDIO.MASTER_VOLUME;
    // Clamp to avoid -Infinity
    return 20 * Math.log10(Math.max(linear, 0.001));
  }

  /**
   * Determine the sky phase name for a given altitude.
   * @param {number} altitudeMeters
   * @returns {string} Phase name
   */
  getPhaseForAltitude(altitudeMeters) {
    const phases = VISUAL.SKY_PHASES;
    let phaseName = phases[0].name;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (altitudeMeters >= phases[i].altitude) {
        phaseName = phases[i].name;
        break;
      }
    }
    return phaseName;
  }
}
