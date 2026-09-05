export type AttentionLevel =
  | "NORMAL"
  | "WATCH"
  | "SIGNIFICANT"
  | "HIGH";

export interface AttentionInput {
  priceAnomalyScore: number;
  volumeAnomalyScore: number;
  eventSignificanceScore: number;
  recencyScore: number;

  priceChangePercent: number;
  volumeChangePercent: number;
}

export interface AttentionReason {
  type: "PRICE" | "VOLUME" | "EVENT" | "RECENCY";
  message: string;
  contribution: number;
}

export interface AttentionResult {
  score: number;
  level: AttentionLevel;
  reasons: AttentionReason[];
}

const PRICE_WEIGHT = 0.40;
const VOLUME_WEIGHT = 0.30;
const EVENT_WEIGHT = 0.20;
const RECENCY_WEIGHT = 0.10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAttentionLevel(score: number): AttentionLevel {
  if (score >= 81) return "HIGH";
  if (score >= 61) return "SIGNIFICANT";
  if (score >= 31) return "WATCH";
  return "NORMAL";
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function calculateAttention(
  input: AttentionInput
): AttentionResult {
  const priceScore = clamp(input.priceAnomalyScore, 0, 100);
  const volumeScore = clamp(input.volumeAnomalyScore, 0, 100);
  const eventScore = clamp(input.eventSignificanceScore, 0, 100);
  const recencyScore = clamp(input.recencyScore, 0, 100);

  const priceContribution = priceScore * PRICE_WEIGHT;
  const volumeContribution = volumeScore * VOLUME_WEIGHT;
  const eventContribution = eventScore * EVENT_WEIGHT;
  const recencyContribution = recencyScore * RECENCY_WEIGHT;

  const score = clamp(
    priceContribution +
      volumeContribution +
      eventContribution +
      recencyContribution,
    0,
    100
  );

  const reasons: AttentionReason[] = [];

  /*
   * Only add a reason when that signal is meaningful.
   * This prevents every stock from displaying a long
   * list of insignificant explanations.
   */
  if (priceScore >= 30) {
    reasons.push({
      type: "PRICE",
      message: `Price moved ${formatPercent(input.priceChangePercent)} since your last check.`,
      contribution: priceContribution,
    });
  }

  if (volumeScore >= 30) {
    reasons.push({
      type: "VOLUME",
      message: `Volume changed ${formatPercent(input.volumeChangePercent)} since your last check.`,
      contribution: volumeContribution,
    });
  }

  if (eventScore >= 30) {
    reasons.push({
      type: "EVENT",
      message: "A significant market event was detected.",
      contribution: eventContribution,
    });
  }

  if (recencyScore >= 30) {
    reasons.push({
      type: "RECENCY",
      message: "The detected change is recent.",
      contribution: recencyContribution,
    });
  }

  /*
   * If the stock receives attention because of the
   * overall combination but no individual signal crosses
   * the explanation threshold, expose the strongest signal.
   */
  if (reasons.length === 0) {
    const signals = [
      {
        type: "PRICE" as const,
        score: priceScore,
        contribution: priceContribution,
        message: `Price moved ${formatPercent(input.priceChangePercent)} since your last check.`,
      },
      {
        type: "VOLUME" as const,
        score: volumeScore,
        contribution: volumeContribution,
        message: `Volume changed ${formatPercent(input.volumeChangePercent)} since your last check.`,
      },
      {
        type: "EVENT" as const,
        score: eventScore,
        contribution: eventContribution,
        message: "A market event was detected.",
      },
      {
        type: "RECENCY" as const,
        score: recencyScore,
        contribution: recencyContribution,
        message: "A recent market change was detected.",
      },
    ];

    const strongestSignal = signals.reduce((strongest, current) =>
      current.score > strongest.score ? current : strongest
    );

    if (strongestSignal.score > 0) {
      reasons.push({
        type: strongestSignal.type,
        message: strongestSignal.message,
        contribution: strongestSignal.contribution,
      });
    }
  }

  /*
   * Highest contribution appears first so the explanation
   * is naturally ordered by importance.
   */
  reasons.sort((a, b) => b.contribution - a.contribution);

  return {
    score: Number(score.toFixed(2)),
    level: getAttentionLevel(score),
    reasons,
  };
}