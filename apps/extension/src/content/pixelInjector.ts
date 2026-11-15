export const PIXEL_ATTR = 'data-mailtrack-pixel';

/**
 * Inserts an invisible 1x1 tracking pixel at the end of the compose body editor.
 * Preserves all existing content/formatting and prevents duplicate pixel elements.
 */
export function insertTrackingPixel(bodyEditor: HTMLElement, pixelUrl: string): boolean {
  if (bodyEditor.querySelector(`img[${PIXEL_ATTR}="1"]`)) {
    return false;
  }

  const img = document.createElement('img');
  img.src = pixelUrl;
  img.alt = '';
  img.width = 1;
  img.height = 1;
  img.setAttribute(PIXEL_ATTR, '1');
  img.style.cssText = 'display:none;width:1px;height:1px;border:0;opacity:0;';

  bodyEditor.appendChild(img);
  return true;
}

/**
 * Removes any injected MailTrack pixel from the compose body editor (e.g., on rollback).
 */
export function removeTrackingPixel(bodyEditor: HTMLElement): void {
  const pixels = bodyEditor.querySelectorAll(`img[${PIXEL_ATTR}="1"]`);
  pixels.forEach((pixel) => pixel.remove());
}
