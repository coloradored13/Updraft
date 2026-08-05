import { MODES } from './constants.js';

const MODE_KEY = 'updraft_mode';

/**
 * Get the last-selected game mode. Defaults to Drift — the calm mode is
 * the front door; Ascent is the opt-in.
 * @returns {string} One of MODES.DRIFT | MODES.ASCENT
 */
export function getSavedMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === MODES.ASCENT ? MODES.ASCENT : MODES.DRIFT;
  } catch (_) {
    return MODES.DRIFT;
  }
}

/**
 * Persist the selected game mode.
 * @param {string} mode - One of MODES.DRIFT | MODES.ASCENT
 */
export function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (_) { /* localStorage might be unavailable */ }
}
