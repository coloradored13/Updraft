/**
 * Privacy-respecting analytics via Plausible.
 * Tracks game lifecycle events as custom goals.
 *
 * Setup: Replace YOURDOMAIN.COM in index.html with your domain,
 * then create matching goals in your Plausible dashboard:
 *   - Game Start
 *   - Game Over (with "score" custom property)
 *   - Victory (with "score" custom property)
 */

function track(eventName, props) {
  if (typeof window.plausible === 'function') {
    window.plausible(eventName, props ? { props } : undefined);
  }
}

export function trackGameStart() {
  track('Game Start');
}

export function trackGameOver(score) {
  track('Game Over', { score: String(score) });
}

export function trackVictory(score) {
  track('Victory', { score: String(score) });
}
