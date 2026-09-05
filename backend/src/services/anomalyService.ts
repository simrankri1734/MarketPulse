export interface AnomalyInput {
  priceChangePercent: number;
  volumeChangePercent: number;

  returnVolatility: number;
  volumeVolatility: number;
}

export interface AnomalyMetrics {
  priceAnomalyScore: number;
  volumeAnomalyScore: number;

  priceZScore: number;
  volumeZScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Measures how unusual the price movement is compared
 * with the stock's historical daily-return volatility.
 *
 * Example:
 * movement = 4%
 * historical volatility = 2%
 *
 * z-score = 2
 */
export function calculatePriceAnomaly(
  priceChangePercent: number,
  returnVolatility: number
): {
  score: number;
  zScore: number;
} {
  if (!Number.isFinite(priceChangePercent)) {
    throw new Error("Invalid price change percentage");
  }

  if (!Number.isFinite(returnVolatility) || returnVolatility <= 0) {
    return {
      score: 0,
      zScore: 0,
    };
  }

  const zScore = Math.abs(priceChangePercent) / returnVolatility;

  // 0-3 standard deviations mapped to 0-100.
  const score = clamp((zScore / 3) * 100, 0, 100);

  return {
    score,
    zScore,
  };
}

/**
 * Measures how unusual the volume change is compared
 * with historical volume variability.
 *
 * We compare the percentage volume change against
 * the historical volume volatility expressed as a
 * percentage of average volume.
 */
export function calculateVolumeAnomaly(
  volumeChangePercent: number,
  averageVolume: number,
  volumeVolatility: number
): {
  score: number;
  zScore: number;
} {
  if (!Number.isFinite(volumeChangePercent)) {
    throw new Error("Invalid volume change percentage");
  }

  if (
    !Number.isFinite(averageVolume) ||
    averageVolume <= 0 ||
    !Number.isFinite(volumeVolatility) ||
    volumeVolatility <= 0
  ) {
    return {
      score: 0,
      zScore: 0,
    };
  }

  const historicalVolumeVolatilityPercent =
    (volumeVolatility / averageVolume) * 100;

  if (historicalVolumeVolatilityPercent <= 0) {
    return {
      score: 0,
      zScore: 0,
    };
  }

  const zScore =
    Math.abs(volumeChangePercent) /
    historicalVolumeVolatilityPercent;

  const score = clamp((zScore / 3) * 100, 0, 100);

  return {
    score,
    zScore,
  };
}

export function calculateAnomalyMetrics(
  input: AnomalyInput & {
    averageVolume: number;
  }
): AnomalyMetrics {
  const price = calculatePriceAnomaly(
    input.priceChangePercent,
    input.returnVolatility
  );

  const volume = calculateVolumeAnomaly(
    input.volumeChangePercent,
    input.averageVolume,
    input.volumeVolatility
  );

  return {
    priceAnomalyScore: price.score,
    volumeAnomalyScore: volume.score,
    priceZScore: price.zScore,
    volumeZScore: volume.zScore,
  };
}