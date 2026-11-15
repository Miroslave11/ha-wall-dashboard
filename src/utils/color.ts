/** "#FFB45C" → "255,180,92" (pro rgba(var(--x-rgb), alfa) v CSS). */
export function hexToRgbTriplet(hex: string, fallback = "255,180,92"): string {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
