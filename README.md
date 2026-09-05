# MarketPulse

### A smarter market watchlist that tells you what meaningfully changed — and what deserves your attention.

MarketPulse is a full-stack market monitoring application designed to reduce the noise of constantly checking stock prices.

Instead of simply displaying the latest market data, MarketPulse compares the current market state with the user's **last successful check** and highlights changes that are meaningful enough to deserve attention.

The goal is simple:

> **Less noise. More signal.**

---

## Overview

Traditional watchlists primarily answer:

> "What is the price of this stock?"

MarketPulse focuses on a different question:

> **"What has meaningfully changed since I last checked, and what should I look at now?"**

Users can:

- Create and manage watchlists
- Search for stocks
- Add multiple stocks to a watchlist
- Remove individual stocks
- View the latest available market information
- Check their watchlist for meaningful changes
- Compare market conditions against their previous successful check
- See an attention level for each stock
- Understand _why_ a stock received that attention level
- Continue using the application even when the external market-data provider is temporarily unavailable

MarketPulse intentionally focuses on **market awareness rather than prediction or financial advice**.

---

# Key Features

## 1. Personalized Watchlists

Users can create their own watchlists and manage the stocks they want to follow.

Each watchlist belongs to a specific authenticated user.

Users can:

- Create watchlists
- Rename watchlists
- Delete watchlists
- Search for stocks
- Add stocks
- Remove individual stocks
- Maintain multiple stocks within a watchlist

Watchlist data is persisted in MongoDB so it is not dependent on browser-local state.

---

## 2. Meaningful Change Detection

The core idea of MarketPulse is not simply showing price movement.

A change becomes meaningful when the observed market state provides enough evidence that the user should pay attention.

MarketPulse evaluates signals including:

- Price movement
- Volume activity
- Significant market events
- Data recency

This allows the application to distinguish between ordinary market movement and activity that deserves closer inspection.

---

# Attention Scoring

MarketPulse calculates an attention score from multiple signals.

| Signal             | Weight |
| ------------------ | -----: |
| Price anomaly      |    40% |
| Volume anomaly     |    30% |
| Event significance |    20% |
| Recency            |    10% |

The resulting score is mapped into four attention levels:

|  Score | Level       |
| -----: | ----------- |
|   0–30 | NORMAL      |
|  31–60 | WATCH       |
|  61–80 | SIGNIFICANT |
| 81–100 | HIGH        |

The application also provides human-readable reasons behind the attention level instead of exposing only a number.

For example:

- Significant price movement detected
- Unusual volume activity
- Recent corporate event detected
- No meaningful change detected

This makes the output explainable rather than acting as a black-box score.

---

# Last Check Semantics

A key design decision in MarketPulse is how the **"last check"** is defined.

### Last check means:

> The last successful user-visible watchlist check.

It does **not** mean:

- Last background refresh
- Last API request
- Last browser refresh
- Last server restart

This distinction is important because background market-data refreshes should not silently overwrite the user's comparison baseline.

### First visit

When a user checks a watchlist for the first time:

```text
No previous baseline
        ↓
Show latest market state
        ↓
Save successful baseline
```
