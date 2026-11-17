export type NoritoLine = { text: string; at: number | null };

/** 本文を行に分ける。行頭の「12.5|」は、その秒で光らせる印。空行は捨てる。 */
export function parseLines(body: string): NoritoLine[] {
  return body
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const m = raw.match(/^(\d+(?:\.\d+)?)\s*\|\s*(.*)$/);
      if (m) return { text: m[2], at: Number(m[1]) };
      return { text: raw, at: null };
    });
}

/**
 * 各行の開始秒を決める。秒が書いてあればそれを使い、無い行は文字数で按分する。
 * duration が分からないときは null を返す（光らせない）。
 */
export function lineStarts(lines: NoritoLine[], duration: number | null): number[] | null {
  if (lines.length === 0) return [];
  if (lines.every((l) => l.at !== null)) return lines.map((l) => l.at as number);
  if (!duration || !Number.isFinite(duration) || duration <= 0) return null;
  const weights = lines.map((l) => Math.max(1, l.text.replace(/\s/g, "").length));
  const total = weights.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    const given = lines[i].at;
    starts.push(given ?? (acc / total) * duration);
    acc += weights[i];
  }
  return starts;
}

export function currentLine(starts: number[] | null, t: number): number {
  if (!starts || starts.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < starts.length; i++) {
    if (t >= starts[i]) idx = i;
    else break;
  }
  return idx;
}
