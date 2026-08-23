/**
 * Display formatting. Deliberately free of locale-sensitive APIs: this code
 * runs on the server during SSR and again in the browser during hydration, and
 * `toLocaleString` would disagree between the two.
 */

const KELVIN_PER_RLO = 1_000_000_000n;
const KELVIN_DECIMALS = 9;

/** Group digits with commas, without going through a float. */
export function groupDigits(value: bigint | number | string): string {
  const s = typeof value === "string" ? value : value.toString();
  const negative = s.startsWith("-");
  const digits = negative ? s.slice(1) : s;
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

/**
 * Exact kelvin -> RLO. All-integer arithmetic, so a full-width u64 balance is
 * rendered exactly rather than approximated through a double.
 */
export function formatRlo(
  kelvin: bigint,
  { maxDecimals = 6, grouped = true }: { maxDecimals?: number; grouped?: boolean } = {},
): string {
  const negative = kelvin < 0n;
  const abs = negative ? -kelvin : kelvin;
  const whole = abs / KELVIN_PER_RLO;
  const fraction = abs % KELVIN_PER_RLO;

  let fractionText = fraction.toString().padStart(KELVIN_DECIMALS, "0");
  if (maxDecimals < KELVIN_DECIMALS) {
    // Truncate rather than round: an explorer should never overstate a balance.
    fractionText = fractionText.slice(0, maxDecimals);
  }
  fractionText = fractionText.replace(/0+$/, "");

  const wholeText = grouped ? groupDigits(whole) : whole.toString();
  const sign = negative ? "-" : "";
  return fractionText ? `${sign}${wholeText}.${fractionText}` : `${sign}${wholeText}`;
}

/** Every kelvin, no truncation. For detail views and tooltips. */
export function formatRloExact(kelvin: bigint): string {
  return formatRlo(kelvin, { maxDecimals: KELVIN_DECIMALS });
}

export function formatKelvin(kelvin: bigint): string {
  return `${groupDigits(kelvin)} kelvin`;
}

/** Compact magnitude for stat tiles: 45.8M, 1.63M, 16.5M. */
export function formatCompact(value: bigint | number): string {
  const n = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  const abs = n < 0n ? -n : n;
  const units: [bigint, string][] = [
    [1_000_000_000_000n, "T"],
    [1_000_000_000n, "B"],
    [1_000_000n, "M"],
    [1_000n, "K"],
  ];
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      // One decimal place, computed in integers to stay exact.
      const tenths = (abs * 10n) / scale;
      const whole = tenths / 10n;
      const tenth = tenths % 10n;
      const sign = n < 0n ? "-" : "";
      return tenth === 0n ? `${sign}${whole}${suffix}` : `${sign}${whole}.${tenth}${suffix}`;
    }
  }
  return groupDigits(n);
}

/** Middle-ellipsis for base58 hashes and addresses. */
export function shorten(value: string, head = 6, tail = 6): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" / "42s" / "7m" / "3h" / "12d". Compact, for dense tables. */
export function timeAgo(epochMs: number | null, now: number = Date.now()): string {
  if (epochMs === null) return "—";
  const delta = now - epochMs;
  if (delta < 0) return "soon";
  if (delta < 1_000) return "just now";
  if (delta < MINUTE) return `${Math.floor(delta / 1_000)}s`;
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  return `${Math.floor(delta / DAY)}d`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number, width = 2) => n.toString().padStart(width, "0");

/** Fixed UTC rendering, identical on server and client. */
export function formatUtc(epochMs: number | null): string {
  if (epochMs === null) return "—";
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
  );
}

export function formatUtcWithMillis(epochMs: number | null): string {
  if (epochMs === null) return "—";
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatUtc(epochMs).replace(" UTC", "")}.${pad(d.getUTCMilliseconds(), 3)} UTC`;
}

/** Human interval from a millisecond duration: "100ms", "30s", "5m". */
export function formatDuration(ms: bigint | number | null): string {
  if (ms === null) return "—";
  const n = typeof ms === "bigint" ? Number(ms) : ms;
  if (!Number.isFinite(n)) return "—";
  if (n < 1_000) return `${n}ms`;
  if (n < MINUTE) return `${trimFloat(n / 1_000)}s`;
  if (n < HOUR) return `${trimFloat(n / MINUTE)}m`;
  if (n < DAY) return `${trimFloat(n / HOUR)}h`;
  return `${trimFloat(n / DAY)}d`;
}

function trimFloat(n: number): string {
  return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, "");
}

/** Rate with one decimal: "20.0 /s". */
export function formatRate(perSecond: number): string {
  if (!Number.isFinite(perSecond) || perSecond < 0) return "—";
  if (perSecond >= 100) return groupDigits(Math.round(perSecond));
  return perSecond.toFixed(perSecond < 10 ? 2 : 1);
}

export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${trimFloat(n / 1024)} KiB`;
  return `${trimFloat(n / (1024 * 1024))} MiB`;
}

export function plural(count: number | bigint, singular: string, pluralForm?: string): string {
  const n = typeof count === "bigint" ? count : BigInt(Math.trunc(count));
  return n === 1n ? singular : (pluralForm ?? `${singular}s`);
}

/** Base58 is the encoding for every Rialo address and signature. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function looksLikeAddress(value: string): boolean {
  return value.length >= 32 && value.length <= 44 && BASE58.test(value);
}

export function looksLikeSignature(value: string): boolean {
  return value.length >= 64 && value.length <= 96 && BASE58.test(value);
}

export function looksLikeBlockHeight(value: string): boolean {
  return /^\d+$/.test(value);
}
