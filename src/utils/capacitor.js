/**
 * Capacitor mobile platform integration.
 * Handles status bar, splash screen, orientation lock, keyboard suppression,
 * and Android back button behavior.
 *
 * Safe to import on web — all calls are no-ops when Capacitor is not present.
 */
import { Capacitor } from '@capacitor/core';

/** Whether the app is running inside a native Capacitor shell. */
export const isNative = Capacitor.isNativePlatform();

/**
 * Initialize all mobile-specific Capacitor plugins.
 * Call once at app startup (e.g., in BootScene.create or main.js).
 */
export async function initMobilePlugins(game) {
  if (!isNative) return;

  await hideStatusBar();
  await lockOrientation();
  suppressKeyboard();
  setupBackButton(game);
}

/**
 * Hide the splash screen. Call after the game has finished loading
 * (e.g., at the end of BootScene.create).
 */
export async function hideSplashScreen() {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn('SplashScreen.hide failed:', e.message);
  }
}

/** Hide the native status bar for immersive fullscreen gameplay. */
async function hideStatusBar() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.hide();
    await StatusBar.setStyle({ style: Style.Light });
  } catch (e) {
    console.warn('StatusBar setup failed:', e.message);
  }
}

/** Lock screen orientation to portrait. */
async function lockOrientation() {
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch (e) {
    console.warn('ScreenOrientation lock failed:', e.message);
  }
}

/** Prevent the virtual keyboard from ever appearing (game is tap-only). */
function suppressKeyboard() {
  // Capacitor Keyboard plugin resize mode is set to 'none' in capacitor.config.ts.
  // Additionally, prevent focus on any input elements that might trigger the keyboard.
  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      e.target.blur();
    }
  });
}

/**
 * Handle the Android hardware back button.
 * - During gameplay (GameScene active): toggle pause
 * - On title screen: exit the app
 * - On pause overlay: resume
 * - On game over / victory: go to title
 */
function setupBackButton(game) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', ({ canGoBack }) => {
      const sceneManager = game.scene;

      // Check which scene is currently active
      if (sceneManager.isActive('PauseOverlayScene')) {
        // Resume from pause
        sceneManager.resume('GameScene');
        sceneManager.stop('PauseOverlayScene');
      } else if (sceneManager.isActive('GameScene')) {
        // Pause the game
        sceneManager.pause('GameScene');
        sceneManager.launch('PauseOverlayScene', { altitude: 0 });
      } else if (sceneManager.isActive('TitleScene')) {
        // Exit the app from the title screen
        App.exitApp();
      } else if (
        sceneManager.isActive('GameOverScene') ||
        sceneManager.isActive('VictoryScene')
      ) {
        // Go back to title
        sceneManager.start('TitleScene');
      }
    });
  }).catch((e) => {
    console.warn('App plugin (back button) setup failed:', e.message);
  });
}
