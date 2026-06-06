# Forecast Model Performance Report

## 1. Introduction

This analysis compares the three forecasting approaches currently implemented in the backend: Holt-Winters, Prophet, and the hybrid Holt + Prophet ensemble. The goal was to evaluate them under a single reproducible time-series backtest without modifying the production model logic.

The source workbook is `backend/pharmacy_demand.xlsx`, containing 4800 monthly observations across 50 medicines.

## 2. Existing Model Logic and Assumptions

| Model | Input | Output | Horizon | Seasonality | Assumptions |
| --- | --- | --- | --- | --- | --- |
| Holt-Winters | Monthly pandas Series indexed by date; non-negative quantity after loader cleaning | Single next-month float forecast clipped at zero | 1 month | 12-month additive trend + multiplicative seasonality when >=24 points; additive fallback; no seasonality when 6-23 points | Monthly demand, complete monthly index, zero-filled gaps, non-negative demand |
| Prophet | Monthly pandas Series converted to ds/y dataframe | Dict with prediction, lower, upper, fitted model, and forecast dataframe | Configurable; current code uses 1 month | Yearly seasonality enabled; weekly/daily disabled; 95% interval | Monthly-start timestamps, enough structure for Prophet trend/seasonality, raw prediction may be negative |
| Ensemble (Holt + Prophet) | Holt scalar forecast + Prophet result dict | Inventory-policy dict including ensemble_forecast, weights, safety stock, ROP, target stock | 1 month forecast feeding inventory calculations | Inherited from Holt and Prophet outputs | Sigma from Prophet interval width when absent; weight_hw = clip(1 - sigma/abs(prophet), 0, 1); Prophet clipped non-negative inside ensemble |

## 3. Methodology

- Dataset loading reused `src.forecast.load_demand_by_medicine`, which normalizes the workbook, groups duplicate rows, and reindexes to a monthly `MS` frequency.
- Each medicine contributes a separate monthly series. The held-out split used approximately the first 80% for training and the final 20% for testing.
- For the common 96-month series length in this dataset, the effective split was 77 train months and 19 test months per medicine.
- Train window: 2018-01-01 to 2024-05-01. Test window: 2024-06-01 to 2025-12-01.
- Evaluation used an expanding-window one-step forecast over the entire test period so all three models remained comparable with their current one-step production interfaces.
- Metrics backend: `numpy fallback`.
- Error is defined as `prediction - actual`, so negative bias means systematic under-forecasting.
- Demand spikes were defined per medicine as test months at or above that medicine's 90th percentile of training demand.

## 4. Metrics Table

| model | mae | rmse | mape | smape | error_std | bias |
| --- | --- | --- | --- | --- | --- | --- |
| Ensemble (Holt + Prophet) | 15.923 | 21.981 | 4.992 | 4.924 | 21.987 | 0.492 |
| Holt-Winters | 15.899 | 22.019 | 4.976 | 4.914 | 22.024 | 0.527 |
| Prophet | 28.479 | 40.032 | 7.465 | 7.313 | 39.949 | -2.891 |

Spike-only subset:

| subset | model | mae | rmse | mape | smape |
| --- | --- | --- | --- | --- | --- |
| Spike months | Ensemble (Holt + Prophet) | 15.403 | 21.434 | 3.816 | 3.936 |
| Spike months | Holt-Winters | 15.464 | 21.566 | 3.842 | 3.960 |
| Spike months | Prophet | 27.414 | 39.205 | 5.499 | 5.732 |

Non-spike subset:

| subset | model | mae | rmse | mape | smape |
| --- | --- | --- | --- | --- | --- |
| Non-spike months | Holt-Winters | 16.770 | 22.901 | 7.252 | 6.827 |
| Non-spike months | Ensemble (Holt + Prophet) | 16.965 | 23.039 | 7.352 | 6.905 |
| Non-spike months | Prophet | 30.617 | 41.642 | 11.409 | 10.486 |

## 5. Graph Explanations

- Actual-vs-predicted plots compare aggregate test-period monthly demand totals against each model forecast.
- The error-distribution plot shows whether each model tends to be centered, skewed, or heavy-tailed.
- Residual plots show temporal drift, clustering, and whether residuals remain centered near zero across the hold-out window.
- The trend-comparison plot overlays all model totals on the actual monthly total to show comparative tracking of directional demand movement.
- The calendar-month MAE plot is the direct seasonality diagnostic: lower and flatter monthly error curves indicate better seasonal handling.
- The ensemble diagnostics plot relates hybrid regret to Prophet weighting and uncertainty-driven disagreement.

- [actual_vs_predicted_ensemble.png](backend/analysis/plots/actual_vs_predicted_ensemble.png): generated directly from the held-out evaluation set.
- [actual_vs_predicted_hw.png](backend/analysis/plots/actual_vs_predicted_hw.png): generated directly from the held-out evaluation set.
- [actual_vs_predicted_prophet.png](backend/analysis/plots/actual_vs_predicted_prophet.png): generated directly from the held-out evaluation set.
- [calendar_month_mae.png](backend/analysis/plots/calendar_month_mae.png): generated directly from the held-out evaluation set.
- [ensemble_diagnostics.png](backend/analysis/plots/ensemble_diagnostics.png): generated directly from the held-out evaluation set.
- [error_distribution.png](backend/analysis/plots/error_distribution.png): generated directly from the held-out evaluation set.
- [residual_plots.png](backend/analysis/plots/residual_plots.png): generated directly from the held-out evaluation set.
- [trend_comparison.png](backend/analysis/plots/trend_comparison.png): generated directly from the held-out evaluation set.

## 6. Comparative Analysis

- Lowest RMSE: **Ensemble (Holt + Prophet)** with RMSE 21.981.
- Lowest MAE/MAPE/SMAPE: **Holt-Winters** with MAE 15.899, MAPE 4.976, and SMAPE 4.914.
- Best seasonal consistency by calendar-month MAE: **Holt-Winters** with average monthly MAE 16.086 and month-to-month dispersion 1.285.
- Best spike handling: **Ensemble (Holt + Prophet)** based on the spike-only subset.
- Most stable across medicines: **Ensemble (Holt + Prophet)** with per-medicine MAE standard deviation 7.802.
- Prophet interval coverage on the hold-out set was 75.16%, which quantifies how well its uncertainty bands align with realized demand.
- Relative to Holt-Winters, the ensemble changed RMSE by -0.038 and MAE by 0.024. That means the ensemble reduced larger misses slightly while Holt kept a marginal advantage on average absolute error.
- Per-medicine MAE winners: Holt-Winters 26, Ensemble 21, Prophet 3.
- Per-medicine RMSE winners: Holt-Winters 28, Ensemble 19, Prophet 3.

Seasonality handling was judged primarily from the calendar-month MAE profile and secondarily from the aggregate trend plots. Spike behavior was judged on the held-out months above each medicine's training 90th percentile, because these are the periods most likely to stress inventory policy.

## 7. Strengths and Weaknesses of Each Model

**Holt-Winters**
- Strong deterministic monthly seasonal structure once at least 24 months are available.
- Non-negative clipping makes the production forecast operationally safe for demand quantities.
- Low implementation complexity and stable one-step behavior on dense monthly histories.
**Prophet**
- Provides an explicit 95% predictive interval in addition to the point forecast.
- Can capture changing trend and yearly seasonality without manual feature engineering.
- Retains a valid forecast path even when the ensemble weighting is not used.
**Ensemble (Holt + Prophet)**
- Combines two different forecast shapes into a single operational estimate.
- Carries Prophet uncertainty through to the inventory-policy layer via sigma, safety stock, and ROP.
- Can outperform both standalone models when the actual demand falls between Holt and Prophet predictions.

**Holt-Winters**
- Falls back to trend-only behavior for shorter series and cannot express predictive uncertainty.
- Relies on fixed 12-month seasonality and may lag abrupt structural changes.
- Single-step forecast function does not expose a native multi-step evaluation interface.
**Prophet**
- No non-negativity guard in the pure model path, so negative point forecasts are theoretically possible.
- Repeated fitting is materially slower than Holt-Winters during rolling evaluation.
- Performance is sensitive to whether yearly seasonality is sufficient to explain sharp month-to-month spikes.
**Ensemble (Holt + Prophet)**
- Weights are not learned from historical error; they are derived only from the current Prophet uncertainty band.
- The implemented formula increases Prophet influence as sigma grows relative to the Prophet forecast magnitude.
- A convex combination cannot recover extreme misses when both standalone forecasts are biased in the same direction.

## 8. Why the Ensemble Works or Fails

The hybrid forecast in `src/Holtphet.py` does not estimate weights from historical forecast accuracy. Instead, it computes:

- `sigma = (upper - lower) / 4` when Prophet does not provide sigma directly
- `weight_hw = clip(1 - sigma / |prophet_prediction|, 0, 1)`
- `weight_prophet = 1 - weight_hw`

Observed average weights were Holt 0.943 and Prophet 0.057.
The ensemble beat Holt on 50.74% of test points, beat Prophet on 67.37%, beat both on 18.11%, and was worse than both on 0.00%.
When the ensemble beat both models, the actual demand lay between Holt and Prophet on 100.00% of those points. This is consistent with a convex combination working best when the two standalone forecasts bracket the truth.
When the ensemble was worse than both, the average Holt-Prophet disagreement was NA and the average Prophet sigma was NA.
Because the ensemble forecast is always a convex combination of Holt and Prophet, it cannot be farther from the actual than both standalone forecasts under absolute error. That is why the worse-than-both rate is effectively zero here.
Because the current weighting formula assigns more Prophet weight as sigma grows relative to the Prophet point forecast, high-uncertainty Prophet outputs can dominate the ensemble. That behavior is mathematically visible in the code and should be considered when interpreting failures.

## 9. Final Conclusion

If the objective is minimizing large misses and spike-period RMSE, **Ensemble (Holt + Prophet)** is the best choice in this experiment.
If the objective is minimizing typical absolute error and maximizing seasonal consistency, **Holt-Winters** is the better standalone choice.
For operational stability across medicines, **Ensemble (Holt + Prophet)** produced the most consistent per-medicine MAE dispersion.
The ensemble remains useful when Holt and Prophet disagree in opposite directions and the actual demand falls between them, but its current uncertainty-based weighting rule is not a learned accuracy model. That is the main reason it can help in some months yet degrade performance in others.

## Bonus: Expanding-Window Cross-Validation

A lightweight three-fold expanding-window cross-validation was also run as a secondary robustness check. Each fold predicts the next month after an expanding training window for every medicine.

| model | mae | rmse | mape | smape |
| --- | --- | --- | --- | --- |
| Ensemble (Holt + Prophet) | 19.154 | 26.231 | 6.510 | 6.607 |
| Holt-Winters | 19.234 | 26.311 | 6.534 | 6.621 |
| Prophet | 23.957 | 32.485 | 7.326 | 7.548 |

Prophet 95% interval empirical coverage on the main hold-out set was 75.16% with an average interval width of 85.350 units.
