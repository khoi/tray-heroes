export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1_000) return Math.floor(n).toString();
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const v = n / size;
      return `${v >= 100 ? Math.floor(v) : v.toFixed(v >= 10 ? 1 : 2).replace(/\.?0+$/, "")}${suffix}`;
    }
  }
  return Math.floor(n).toString();
}

export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0).replace(/\.0$/, "")}%`;
}

export function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.ceil(ms / 1000)}s`;
}
