/**
 * Reads NSOffice design tokens out of CSS.
 *
 * Most of the UI uses Tailwind utilities generated from the `@theme` block in
 * index.css. Two surfaces cannot: the anatomical SVG sets presentation
 * attributes (which do not accept `var()`), and the waveform paints onto a
 * canvas. Both read their colours here so there is still exactly one place
 * where the palette is defined.
 */

const FALLBACKS: Record<string, string> = {
  '--color-accent': '#0062FF',
  '--color-accent-tint': '#7FB0FF',
  '--color-critical': '#FF453A',
  '--color-caution': '#FF9F0A',
  '--color-hairline-strong': '#2A364E',
  '--color-surface-sunken': '#1A2333',
};

const cache = new Map<string, string>();

/** Resolves a CSS custom property to its computed value. */
export function token(name: keyof typeof FALLBACKS | string): string {
  const hit = cache.get(name);
  if (hit) return hit;

  let value = '';
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const resolved = value || FALLBACKS[name] || '#0062FF';
  if (value) cache.set(name, resolved);
  return resolved;
}
