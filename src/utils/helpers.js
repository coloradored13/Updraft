/**
 * Updraft - Utility helpers
 */

/**
 * Linearly interpolate between two values.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Convert a hex color number to a CSS rgba string.
 * @param {number} hex - Color as 0xRRGGBB
 * @param {number} [alpha=1] - Alpha (0-1)
 * @returns {string}
 */
export function hexToRgba(hex, alpha = 1) {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >> 8) & 0xFF;
  const b = hex & 0xFF;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Interpolate between two hex colors.
 * @param {number} colorA - Start color as 0xRRGGBB
 * @param {number} colorB - End color as 0xRRGGBB
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated color as 0xRRGGBB
 */
export function lerpColor(colorA, colorB, t) {
  t = Math.max(0, Math.min(1, t));
  const rA = (colorA >> 16) & 0xFF;
  const gA = (colorA >> 8) & 0xFF;
  const bA = colorA & 0xFF;
  const rB = (colorB >> 16) & 0xFF;
  const gB = (colorB >> 8) & 0xFF;
  const bB = colorB & 0xFF;
  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Random float between min (inclusive) and max (exclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer between min and max (both inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * Convert pixels of vertical travel to meters (for display).
 * @param {number} pixels
 * @param {number} metersPerPixel
 * @returns {number}
 */
export function pixelsToMeters(pixels, metersPerPixel) {
  return Math.floor(pixels * metersPerPixel);
}

/**
 * Smooth step function (ease in/out).
 * @param {number} t - Input (0-1)
 * @returns {number} Smoothed value (0-1)
 */
export function smoothStep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// ── Watercolor Texture Generation ────────────────────────────────────────────

/**
 * Extract RGB components from a hex color number.
 * @param {number} hex - Color as 0xRRGGBB
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 0xFF,
    g: (hex >> 8) & 0xFF,
    b: hex & 0xFF,
  };
}

/**
 * Draw a soft brush stroke on a canvas context.
 * Creates an elongated soft-edged ellipse with alpha falloff.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} rx - Radius X
 * @param {number} ry - Radius Y
 * @param {number} color - Color as 0xRRGGBB
 * @param {number} alpha - Max alpha (0-1)
 * @param {number} [angle=0] - Rotation in radians
 */
export function drawBrushStroke(ctx, cx, cy, rx, ry, color, alpha, angle = 0) {
  const { r, g, b } = hexToRgb(color);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.6})`);
  grad.addColorStop(0.8, `rgba(${r},${g},${b},${alpha * 0.2})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a paint splatter — several overlapping soft circles with varying opacity.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Approximate radius of splatter area
 * @param {number} color - Color as 0xRRGGBB
 * @param {number} alpha - Max alpha
 * @param {number} [count=6] - Number of blobs
 */
export function drawSplatter(ctx, cx, cy, radius, color, alpha, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.6;
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist;
    const br = radius * (0.3 + Math.random() * 0.5);
    const ba = alpha * (0.3 + Math.random() * 0.7);
    drawBrushStroke(ctx, bx, by, br, br * (0.6 + Math.random() * 0.4), color, ba);
  }
}

/**
 * Draw a watercolor cloud blotch — overlapping soft circles for organic shapes.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} width - Approximate width
 * @param {number} height - Approximate height
 * @param {number} color - Color as 0xRRGGBB
 * @param {number} alpha - Max alpha
 */
export function drawCloudBlotch(ctx, cx, cy, width, height, color, alpha) {
  const blobs = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < blobs; i++) {
    const bx = cx + (Math.random() - 0.5) * width * 0.7;
    const by = cy + (Math.random() - 0.5) * height * 0.5;
    const rx = width * (0.15 + Math.random() * 0.25);
    const ry = height * (0.2 + Math.random() * 0.3);
    const ba = alpha * (0.4 + Math.random() * 0.6);
    drawBrushStroke(ctx, bx, by, rx, ry, color, ba);
  }
}

/**
 * Fill a canvas with a vertical gradient wash.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} topColor - Top color as 0xRRGGBB
 * @param {number} bottomColor - Bottom color as 0xRRGGBB
 * @param {number} [alpha=1] - Alpha for the gradient
 */
export function drawGradientWash(ctx, w, h, topColor, bottomColor, alpha = 1) {
  const top = hexToRgb(topColor);
  const bot = hexToRgb(bottomColor);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(${top.r},${top.g},${top.b},${alpha})`);
  grad.addColorStop(1, `rgba(${bot.r},${bot.g},${bot.b},${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Add subtle noise/grain texture overlay to a canvas for watercolor paper feel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} [intensity=0.03] - Noise intensity (0-1)
 */
export function addNoiseTexture(ctx, w, h, intensity = 0.03) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * intensity;
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);
}
