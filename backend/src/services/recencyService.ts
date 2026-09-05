export function calculateRecencyScore(
  marketDataTime: Date,
  now: Date = new Date()
): number {
  const ageMs = now.getTime() - marketDataTime.getTime();

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0;
  }

  const ageHours = ageMs / (1000 * 60 * 60);

  /*
   * MarketPulse uses EOD market data.
   *
   * The score represents how recent the available
   * market observation is, not whether the stock itself
   * recently moved.
   */

  if (ageHours <= 24) {
    return 100;
  }

  if (ageHours <= 48) {
    return 75;
  }

  if (ageHours <= 72) {
    return 50;
  }

  if (ageHours <= 120) {
    return 25;
  }

  return 0;
}