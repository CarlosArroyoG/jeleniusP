/** `#rrggbb` → the `rgb(r, g, b)` string `getComputedStyle` returns. */
export const rgb = (hex: string): string => {
  const h = hex.replace('#', '')
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
}
