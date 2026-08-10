/** Mở Google Maps bằng địa chỉ/tên quán — không cần map riêng trong app */
export function mapsUrl(...parts: (string | undefined | null)[]): string {
  const query = parts.filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function hasDestination(...parts: (string | undefined | null)[]): boolean {
  return parts.some((part) => Boolean(part && part.trim()));
}
