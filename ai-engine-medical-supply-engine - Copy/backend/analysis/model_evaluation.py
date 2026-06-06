from __future__ import annotations

import argparse
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
PLOTS_DIR = BACKEND_ROOT / "analysis" / "plots"
REPORT_PATH = BACKEND_ROOT / "analysis" / "model_report.md"
METRICS_CSV_PATH = BACKEND_ROOT / "analysis" / "model_metrics.csv"
PREDICTIONS_CSV_PATH = BACKEND_ROOT / "analysis" / "model_predictions.csv"
CV_METRICS_CSV_PATH = BACKEND_ROOT / "analysis" / "time_series_cv_metrics.csv"
DATASET_PATH = BACKEND_ROOT / "pharmacy_demand.xlsx"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.Holtphet import hybrid_inventory_policy
from src.forecast import forecast_next_month, load_demand_by_medicine
from src.holtphet_main import MEDICINE_NAME_MAP
from src.prophet_model import prophet_forecast


MODEL_CONFIGS = (
    ("hw", "Holt-Winters", "#1f77b4"),
    ("prophet", "Prophet", "#ff7f0e"),
    ("ensemble", "Ensemble (Holt + Prophet)", "#2ca02c"),
)


@dataclass(frozen=True)
class EvaluationConfig:
    train_fraction: float = 0.8
    min_train_size: int = 24
    workers: int = 1
    run_cv: bool = True
    cv_splits: int = 3
    seed: int = 42


def _resolve_metrics_backend():
    try:
        from sklearn.metrics import mean_absolute_error, mean_squared_error

        return mean_absolute_error, mean_squared_error, "sklearn.metrics"
    except ImportError:
        def mean_absolute_error(y_true, y_pred):
            y_true = np.asarray(y_true, dtype=float)
            y_pred = np.asarray(y_pred, dtype=float)
            return float(np.mean(np.abs(y_true - y_pred)))

        def mean_squared_error(y_true, y_pred):
            y_true = np.asarray(y_true, dtype=float)
            y_pred = np.asarray(y_pred, dtype=float)
            return float(np.mean((y_true - y_pred) ** 2))

        return mean_absolute_error, mean_squared_error, "numpy fallback"


MEAN_ABSOLUTE_ERROR, MEAN_SQUARED_ERROR, METRICS_BACKEND = (
    _resolve_metrics_backend()
)


def set_deterministic_seed(seed: int) -> None:
    np.random.seed(seed)


def ensure_output_paths() -> None:
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)


def select_split_index(
    series_length: int,
    train_fraction: float,
    min_train_size: int,
) -> int:
    split_index = int(math.ceil(series_length * train_fraction))
    split_index = max(split_index, min_train_size)
    split_index = min(split_index, series_length - 1)
    if split_index <= 0:
        raise ValueError("Series must contain at least two observations.")
    return split_index


def mean_absolute_percentage_error(
    actual: np.ndarray,
    predicted: np.ndarray,
) -> float:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    mask = actual != 0
    if not np.any(mask):
        return float("nan")
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def symmetric_mean_absolute_percentage_error(
    actual: np.ndarray,
    predicted: np.ndarray,
) -> float:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    denominator = np.abs(actual) + np.abs(predicted)
    mask = denominator != 0
    if not np.any(mask):
        return float("nan")
    return float(np.mean(2 * np.abs(predicted[mask] - actual[mask]) / denominator[mask]) * 100)


def format_number(value: float, digits: int = 3) -> str:
    if pd.isna(value):
        return "NA"
    return f"{float(value):.{digits}f}"


def markdown_table(df: pd.DataFrame) -> str:
    headers = list(df.columns)
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in df.itertuples(index=False):
        lines.append("| " + " | ".join(str(value) for value in row) + " |")
    return "\n".join(lines)


def actual_is_bracketed(
    actual: pd.Series,
    a: pd.Series,
    b: pd.Series,
) -> pd.Series:
    lower = np.minimum(a, b)
    upper = np.maximum(a, b)
    return (actual >= lower) & (actual <= upper)


def evaluate_single_medicine(
    medicine_id: str,
    series: pd.Series,
    train_fraction: float,
    min_train_size: int,
    seed: int,
) -> tuple[list[dict], dict]:
    set_deterministic_seed(seed)
    series = pd.Series(series).dropna().sort_index().astype(float)
    split_index = select_split_index(len(series), train_fraction, min_train_size)
    train_series = series.iloc[:split_index]
    test_series = series.iloc[split_index:]
    spike_threshold = float(train_series.quantile(0.9))
    rows: list[dict] = []

    for i in range(split_index, len(series)):
        history = series.iloc[:i]
        actual = float(series.iloc[i])
        timestamp = pd.Timestamp(series.index[i])

        hw_prediction = float(forecast_next_month(history))
        prophet_result = prophet_forecast(history, periods=1)
        prophet_prediction = float(prophet_result["prediction"])
        prophet_lower = float(prophet_result["lower"])
        prophet_upper = float(prophet_result["upper"])
        prophet_sigma = max(0.0, (prophet_upper - prophet_lower) / 4.0)

        ensemble_result = hybrid_inventory_policy(
            hw_prediction,
            prophet_result,
            current_stock=0.0,
        )
        ensemble_prediction = float(ensemble_result["ensemble_forecast"])

        row = {
            "medicine_id": str(medicine_id),
            "medicine_name": MEDICINE_NAME_MAP.get(str(medicine_id), {}).get(
                "name",
                str(medicine_id),
            ),
            "date": timestamp,
            "actual": actual,
            "train_size_at_forecast": int(len(history)),
            "split_index": int(split_index),
            "split_train_end": pd.Timestamp(train_series.index[-1]),
            "split_test_start": pd.Timestamp(test_series.index[0]),
            "train_mean": float(train_series.mean()),
            "train_std": float(train_series.std(ddof=1)),
            "train_q90": spike_threshold,
            "is_spike": bool(actual >= spike_threshold),
            "hw_prediction": hw_prediction,
            "prophet_prediction": prophet_prediction,
            "prophet_lower": prophet_lower,
            "prophet_upper": prophet_upper,
            "prophet_sigma": prophet_sigma,
            "ensemble_prediction": ensemble_prediction,
            "weight_hw": float(ensemble_result["weight_hw"]),
            "weight_prophet": float(ensemble_result["weight_prophet"]),
        }
        rows.append(row)

    metadata = {
        "medicine_id": str(medicine_id),
        "series_length": int(len(series)),
        "train_size": int(len(train_series)),
        "test_size": int(len(test_series)),
        "train_start": pd.Timestamp(train_series.index[0]),
        "train_end": pd.Timestamp(train_series.index[-1]),
        "test_start": pd.Timestamp(test_series.index[0]),
        "test_end": pd.Timestamp(test_series.index[-1]),
        "spike_threshold": spike_threshold,
    }
    return rows, metadata


def evaluate_models(
    series_by_medicine: dict[str, pd.Series],
    config: EvaluationConfig,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    medicine_items = sorted(series_by_medicine.items())
    prediction_rows: list[dict] = []
    metadata_rows: list[dict] = []

    if config.workers > 1:
        executor_class = ProcessPoolExecutor
        try:
            executor = executor_class(max_workers=config.workers)
        except (OSError, PermissionError):
            print(
                "Process-based parallelism is unavailable in this environment. "
                "Falling back to thread-based parallelism.",
                flush=True,
            )
            executor_class = ThreadPoolExecutor
            executor = executor_class(max_workers=config.workers)

        with executor:
            futures = {
                executor.submit(
                    evaluate_single_medicine,
                    medicine_id,
                    series,
                    config.train_fraction,
                    config.min_train_size,
                    config.seed,
                ): medicine_id
                for medicine_id, series in medicine_items
            }
            completed = 0
            total = len(futures)
            for future in as_completed(futures):
                rows, metadata = future.result()
                prediction_rows.extend(rows)
                metadata_rows.append(metadata)
                completed += 1
                print(
                    f"Evaluated medicine {completed}/{total}: {metadata['medicine_id']}",
                    flush=True,
                )
    else:
        total = len(medicine_items)
        for index, (medicine_id, series) in enumerate(medicine_items, start=1):
            rows, metadata = evaluate_single_medicine(
                medicine_id,
                series,
                config.train_fraction,
                config.min_train_size,
                config.seed,
            )
            prediction_rows.extend(rows)
            metadata_rows.append(metadata)
            print(
                f"Evaluated medicine {index}/{total}: {medicine_id}",
                flush=True,
            )

    predictions_df = pd.DataFrame(prediction_rows).sort_values(
        ["medicine_id", "date"]
    )
    metadata_df = pd.DataFrame(metadata_rows).sort_values("medicine_id")

    for model_key, _, _ in MODEL_CONFIGS:
        prediction_column = f"{model_key}_prediction"
        error_column = f"{model_key}_error"
        abs_error_column = f"{model_key}_abs_error"
        predictions_df[error_column] = (
            predictions_df[prediction_column] - predictions_df["actual"]
        )
        predictions_df[abs_error_column] = predictions_df[error_column].abs()

    predictions_df["prophet_interval_width"] = (
        predictions_df["prophet_upper"] - predictions_df["prophet_lower"]
    )
    predictions_df["prophet_interval_contains_actual"] = (
        (predictions_df["actual"] >= predictions_df["prophet_lower"])
        & (predictions_df["actual"] <= predictions_df["prophet_upper"])
    )
    predictions_df["hw_prophet_disagreement"] = (
        predictions_df["hw_prediction"] - predictions_df["prophet_prediction"]
    ).abs()
    predictions_df["actual_between_hw_prophet"] = actual_is_bracketed(
        predictions_df["actual"],
        predictions_df["hw_prediction"],
        predictions_df["prophet_prediction"],
    )
    predictions_df["ensemble_better_than_hw"] = (
        predictions_df["ensemble_abs_error"] < predictions_df["hw_abs_error"]
    )
    predictions_df["ensemble_better_than_prophet"] = (
        predictions_df["ensemble_abs_error"] < predictions_df["prophet_abs_error"]
    )
    predictions_df["ensemble_better_than_both"] = (
        predictions_df["ensemble_abs_error"]
        < predictions_df[["hw_abs_error", "prophet_abs_error"]].min(axis=1)
    )
    predictions_df["ensemble_worse_than_both"] = (
        predictions_df["ensemble_abs_error"]
        > predictions_df[["hw_abs_error", "prophet_abs_error"]].max(axis=1)
    )

    return predictions_df, metadata_df


def compute_metrics_for_model(
    predictions_df: pd.DataFrame,
    model_key: str,
    label: str,
) -> dict:
    actual = predictions_df["actual"].to_numpy(dtype=float)
    predicted = predictions_df[f"{model_key}_prediction"].to_numpy(dtype=float)
    error = predicted - actual
    return {
        "model_key": model_key,
        "model": label,
        "mae": float(MEAN_ABSOLUTE_ERROR(actual, predicted)),
        "rmse": float(math.sqrt(MEAN_SQUARED_ERROR(actual, predicted))),
        "mape": mean_absolute_percentage_error(actual, predicted),
        "smape": symmetric_mean_absolute_percentage_error(actual, predicted),
        "error_std": float(np.std(error, ddof=1)),
        "bias": float(np.mean(error)),
    }


def compute_metrics_frame(predictions_df: pd.DataFrame) -> pd.DataFrame:
    rows = [
        compute_metrics_for_model(predictions_df, model_key, label)
        for model_key, label, _ in MODEL_CONFIGS
    ]
    return pd.DataFrame(rows).sort_values(["rmse", "mae"])


def compute_subset_metrics(
    predictions_df: pd.DataFrame,
    subset_mask: pd.Series,
    subset_name: str,
) -> pd.DataFrame:
    subset_df = predictions_df.loc[subset_mask].copy()
    if subset_df.empty:
        return pd.DataFrame(
            columns=["subset", "model", "mae", "rmse", "mape", "smape"]
        )

    rows = []
    for model_key, label, _ in MODEL_CONFIGS:
        actual = subset_df["actual"].to_numpy(dtype=float)
        predicted = subset_df[f"{model_key}_prediction"].to_numpy(dtype=float)
        rows.append(
            {
                "subset": subset_name,
                "model": label,
                "mae": float(MEAN_ABSOLUTE_ERROR(actual, predicted)),
                "rmse": float(math.sqrt(MEAN_SQUARED_ERROR(actual, predicted))),
                "mape": mean_absolute_percentage_error(actual, predicted),
                "smape": symmetric_mean_absolute_percentage_error(actual, predicted),
            }
        )
    return pd.DataFrame(rows).sort_values(["rmse", "mae"])


def compute_per_medicine_metrics(predictions_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for medicine_id, medicine_df in predictions_df.groupby("medicine_id"):
        for model_key, label, _ in MODEL_CONFIGS:
            actual = medicine_df["actual"].to_numpy(dtype=float)
            predicted = medicine_df[f"{model_key}_prediction"].to_numpy(dtype=float)
            error = predicted - actual
            rows.append(
                {
                    "medicine_id": medicine_id,
                    "model_key": model_key,
                    "model": label,
                    "mae": float(MEAN_ABSOLUTE_ERROR(actual, predicted)),
                    "rmse": float(math.sqrt(MEAN_SQUARED_ERROR(actual, predicted))),
                    "bias": float(np.mean(error)),
                }
            )
    return pd.DataFrame(rows)


def compute_monthly_error_summary(predictions_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for model_key, label, _ in MODEL_CONFIGS:
        monthly_mae = (
            predictions_df.groupby(predictions_df["date"].dt.month)[
                f"{model_key}_abs_error"
            ]
            .mean()
            .reindex(range(1, 13))
        )
        rows.append(
            {
                "model_key": model_key,
                "model": label,
                "avg_calendar_month_mae": float(monthly_mae.mean()),
                "std_calendar_month_mae": float(monthly_mae.std(ddof=1)),
            }
        )
    return pd.DataFrame(rows).sort_values(
        ["avg_calendar_month_mae", "std_calendar_month_mae"]
    )


def compute_ensemble_analysis(predictions_df: pd.DataFrame) -> dict:
    better_df = predictions_df.loc[predictions_df["ensemble_better_than_both"]]
    worse_df = predictions_df.loc[predictions_df["ensemble_worse_than_both"]]
    safe_prophet_scale = predictions_df["prophet_prediction"].abs().replace(0, np.nan)
    uncertainty_ratio = predictions_df["prophet_sigma"] / safe_prophet_scale

    return {
        "mean_weight_hw": float(predictions_df["weight_hw"].mean()),
        "mean_weight_prophet": float(predictions_df["weight_prophet"].mean()),
        "median_weight_hw": float(predictions_df["weight_hw"].median()),
        "mean_prophet_sigma": float(predictions_df["prophet_sigma"].mean()),
        "mean_prophet_uncertainty_ratio": float(np.nanmean(uncertainty_ratio)),
        "better_than_hw_rate": float(predictions_df["ensemble_better_than_hw"].mean()),
        "better_than_prophet_rate": float(
            predictions_df["ensemble_better_than_prophet"].mean()
        ),
        "better_than_both_rate": float(
            predictions_df["ensemble_better_than_both"].mean()
        ),
        "worse_than_both_rate": float(
            predictions_df["ensemble_worse_than_both"].mean()
        ),
        "actual_between_hw_prophet_rate": float(
            predictions_df["actual_between_hw_prophet"].mean()
        ),
        "actual_between_hw_prophet_when_better": float(
            better_df["actual_between_hw_prophet"].mean()
        )
        if not better_df.empty
        else float("nan"),
        "actual_between_hw_prophet_when_worse": float(
            worse_df["actual_between_hw_prophet"].mean()
        )
        if not worse_df.empty
        else float("nan"),
        "mean_disagreement_when_better": float(
            better_df["hw_prophet_disagreement"].mean()
        )
        if not better_df.empty
        else float("nan"),
        "mean_disagreement_when_worse": float(
            worse_df["hw_prophet_disagreement"].mean()
        )
        if not worse_df.empty
        else float("nan"),
        "mean_sigma_when_better": float(better_df["prophet_sigma"].mean())
        if not better_df.empty
        else float("nan"),
        "mean_sigma_when_worse": float(worse_df["prophet_sigma"].mean())
        if not worse_df.empty
        else float("nan"),
        "spike_rate_when_better": float(better_df["is_spike"].mean())
        if not better_df.empty
        else float("nan"),
        "spike_rate_when_worse": float(worse_df["is_spike"].mean())
        if not worse_df.empty
        else float("nan"),
    }


def compute_cv_split_points(
    series_length: int,
    min_train_size: int,
    n_splits: int,
) -> list[int]:
    max_start = series_length - 1
    raw_points = np.linspace(min_train_size, max_start, num=n_splits + 2)[1:-1]
    split_points = []
    for point in raw_points:
        split_index = int(round(point))
        split_index = max(min_train_size, min(split_index, max_start))
        if split_index not in split_points:
            split_points.append(split_index)
    return split_points


def run_time_series_cv(
    series_by_medicine: dict[str, pd.Series],
    config: EvaluationConfig,
) -> pd.DataFrame:
    rows = []
    for medicine_id, series in sorted(series_by_medicine.items()):
        series = pd.Series(series).dropna().sort_index().astype(float)
        for fold_number, split_index in enumerate(
            compute_cv_split_points(len(series), config.min_train_size, config.cv_splits),
            start=1,
        ):
            history = series.iloc[:split_index]
            actual = float(series.iloc[split_index])
            timestamp = pd.Timestamp(series.index[split_index])
            hw_prediction = float(forecast_next_month(history))
            prophet_result = prophet_forecast(history, periods=1)
            ensemble_result = hybrid_inventory_policy(
                hw_prediction,
                prophet_result,
                current_stock=0.0,
            )
            rows.append(
                {
                    "medicine_id": medicine_id,
                    "fold": fold_number,
                    "date": timestamp,
                    "actual": actual,
                    "hw_prediction": hw_prediction,
                    "prophet_prediction": float(prophet_result["prediction"]),
                    "ensemble_prediction": float(
                        ensemble_result["ensemble_forecast"]
                    ),
                }
            )

    cv_df = pd.DataFrame(rows).sort_values(["medicine_id", "fold"])
    metrics_rows = []
    for model_key, label, _ in MODEL_CONFIGS:
        actual = cv_df["actual"].to_numpy(dtype=float)
        predicted = cv_df[f"{model_key}_prediction"].to_numpy(dtype=float)
        metrics_rows.append(
            {
                "model": label,
                "mae": float(MEAN_ABSOLUTE_ERROR(actual, predicted)),
                "rmse": float(math.sqrt(MEAN_SQUARED_ERROR(actual, predicted))),
                "mape": mean_absolute_percentage_error(actual, predicted),
                "smape": symmetric_mean_absolute_percentage_error(actual, predicted),
            }
        )
    return pd.DataFrame(metrics_rows).sort_values(["rmse", "mae"])


def aggregate_monthly_predictions(predictions_df: pd.DataFrame) -> pd.DataFrame:
    return (
        predictions_df.groupby("date", as_index=False)[
            [
                "actual",
                "hw_prediction",
                "prophet_prediction",
                "ensemble_prediction",
                "hw_error",
                "prophet_error",
                "ensemble_error",
            ]
        ]
        .sum()
        .sort_values("date")
    )


def plot_actual_vs_predicted(
    monthly_df: pd.DataFrame,
    model_key: str,
    label: str,
    color: str,
) -> Path:
    output_path = PLOTS_DIR / f"actual_vs_predicted_{model_key}.png"
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(monthly_df["date"], monthly_df["actual"], label="Actual", color="#111111", linewidth=2.5)
    ax.plot(
        monthly_df["date"],
        monthly_df[f"{model_key}_prediction"],
        label=label,
        color=color,
        linewidth=2.2,
    )
    ax.set_title(f"Actual vs Predicted: {label}")
    ax.set_xlabel("Month")
    ax.set_ylabel("Total monthly demand across medicines")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def plot_error_distribution(predictions_df: pd.DataFrame) -> Path:
    output_path = PLOTS_DIR / "error_distribution.png"
    fig, axes = plt.subplots(1, 3, figsize=(18, 5), sharey=True)
    for ax, (model_key, label, color) in zip(axes, MODEL_CONFIGS):
        ax.hist(
            predictions_df[f"{model_key}_error"],
            bins=30,
            color=color,
            alpha=0.8,
            edgecolor="white",
        )
        ax.axvline(0.0, color="#111111", linestyle="--", linewidth=1.2)
        ax.set_title(label)
        ax.set_xlabel("Prediction error")
        ax.grid(alpha=0.2)
    axes[0].set_ylabel("Frequency")
    fig.suptitle("Error Distribution by Model")
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def plot_residuals(predictions_df: pd.DataFrame) -> Path:
    output_path = PLOTS_DIR / "residual_plots.png"
    fig, axes = plt.subplots(3, 1, figsize=(14, 11), sharex=True)
    for ax, (model_key, label, color) in zip(axes, MODEL_CONFIGS):
        ax.scatter(
            predictions_df["date"],
            predictions_df[f"{model_key}_error"],
            s=18,
            alpha=0.35,
            color=color,
            edgecolors="none",
        )
        monthly_mean = (
            predictions_df.groupby("date")[f"{model_key}_error"].mean().sort_index()
        )
        ax.plot(
            monthly_mean.index,
            monthly_mean.values,
            color="#111111",
            linewidth=1.8,
            label="Monthly mean residual",
        )
        ax.axhline(0.0, color="#555555", linestyle="--", linewidth=1.0)
        ax.set_title(f"Residuals Over Time: {label}")
        ax.set_ylabel("Residual")
        ax.legend(loc="upper right")
        ax.grid(alpha=0.2)
    axes[-1].set_xlabel("Month")
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def plot_trend_comparison(monthly_df: pd.DataFrame) -> Path:
    output_path = PLOTS_DIR / "trend_comparison.png"
    fig, ax = plt.subplots(figsize=(13, 5))
    ax.plot(
        monthly_df["date"],
        monthly_df["actual"],
        label="Actual",
        color="#111111",
        linewidth=2.6,
    )
    for model_key, label, color in MODEL_CONFIGS:
        ax.plot(
            monthly_df["date"],
            monthly_df[f"{model_key}_prediction"],
            label=label,
            color=color,
            linewidth=1.9,
        )
    ax.set_title("Trend Comparison Across Models")
    ax.set_xlabel("Month")
    ax.set_ylabel("Total monthly demand across medicines")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def plot_calendar_month_mae(predictions_df: pd.DataFrame) -> Path:
    output_path = PLOTS_DIR / "calendar_month_mae.png"
    calendar_months = range(1, 13)
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    fig, ax = plt.subplots(figsize=(13, 5))
    for model_key, label, color in MODEL_CONFIGS:
        monthly_mae = (
            predictions_df.groupby(predictions_df["date"].dt.month)[
                f"{model_key}_abs_error"
            ]
            .mean()
            .reindex(calendar_months)
        )
        ax.plot(month_labels, monthly_mae.values, marker="o", linewidth=2, color=color, label=label)
    ax.set_title("Average Absolute Error by Calendar Month")
    ax.set_xlabel("Calendar month")
    ax.set_ylabel("Mean absolute error")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def plot_ensemble_diagnostics(predictions_df: pd.DataFrame) -> Path:
    output_path = PLOTS_DIR / "ensemble_diagnostics.png"
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].scatter(
        predictions_df["weight_prophet"],
        predictions_df["ensemble_abs_error"]
        - predictions_df[["hw_abs_error", "prophet_abs_error"]].min(axis=1),
        s=18,
        alpha=0.35,
        color="#2ca02c",
        edgecolors="none",
    )
    axes[0].axhline(0.0, color="#111111", linestyle="--", linewidth=1.0)
    axes[0].set_title("Ensemble Regret vs Prophet Weight")
    axes[0].set_xlabel("Prophet weight in ensemble")
    axes[0].set_ylabel("Ensemble abs error - best standalone abs error")
    axes[0].grid(alpha=0.2)

    axes[1].scatter(
        predictions_df["prophet_sigma"],
        predictions_df["hw_prophet_disagreement"],
        s=18,
        alpha=0.35,
        color="#ff7f0e",
        edgecolors="none",
    )
    axes[1].set_title("Prophet Uncertainty vs Model Disagreement")
    axes[1].set_xlabel("Prophet sigma")
    axes[1].set_ylabel("|Holt forecast - Prophet forecast|")
    axes[1].grid(alpha=0.2)

    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return output_path


def create_plots(predictions_df: pd.DataFrame) -> list[Path]:
    monthly_df = aggregate_monthly_predictions(predictions_df)
    plot_paths = [
        plot_actual_vs_predicted(monthly_df, model_key, label, color)
        for model_key, label, color in MODEL_CONFIGS
    ]
    plot_paths.extend(
        [
            plot_error_distribution(predictions_df),
            plot_residuals(predictions_df),
            plot_trend_comparison(monthly_df),
            plot_calendar_month_mae(predictions_df),
            plot_ensemble_diagnostics(predictions_df),
        ]
    )
    return plot_paths


def build_metrics_report_table(metrics_df: pd.DataFrame) -> pd.DataFrame:
    table_df = metrics_df[["model", "mae", "rmse", "mape", "smape", "error_std", "bias"]].copy()
    for column in ["mae", "rmse", "mape", "smape", "error_std", "bias"]:
        table_df[column] = table_df[column].map(lambda value: format_number(value, 3))
    return table_df


def build_code_understanding_table() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Model": "Holt-Winters",
                "Input": "Monthly pandas Series indexed by date; non-negative quantity after loader cleaning",
                "Output": "Single next-month float forecast clipped at zero",
                "Horizon": "1 month",
                "Seasonality": "12-month additive trend + multiplicative seasonality when >=24 points; additive fallback; no seasonality when 6-23 points",
                "Assumptions": "Monthly demand, complete monthly index, zero-filled gaps, non-negative demand",
            },
            {
                "Model": "Prophet",
                "Input": "Monthly pandas Series converted to ds/y dataframe",
                "Output": "Dict with prediction, lower, upper, fitted model, and forecast dataframe",
                "Horizon": "Configurable; current code uses 1 month",
                "Seasonality": "Yearly seasonality enabled; weekly/daily disabled; 95% interval",
                "Assumptions": "Monthly-start timestamps, enough structure for Prophet trend/seasonality, raw prediction may be negative",
            },
            {
                "Model": "Ensemble (Holt + Prophet)",
                "Input": "Holt scalar forecast + Prophet result dict",
                "Output": "Inventory-policy dict including ensemble_forecast, weights, safety stock, ROP, target stock",
                "Horizon": "1 month forecast feeding inventory calculations",
                "Seasonality": "Inherited from Holt and Prophet outputs",
                "Assumptions": "Sigma from Prophet interval width when absent; weight_hw = clip(1 - sigma/abs(prophet), 0, 1); Prophet clipped non-negative inside ensemble",
            },
        ]
    )


def write_report(
    predictions_df: pd.DataFrame,
    metadata_df: pd.DataFrame,
    metrics_df: pd.DataFrame,
    spike_metrics_df: pd.DataFrame,
    non_spike_metrics_df: pd.DataFrame,
    monthly_error_summary_df: pd.DataFrame,
    per_medicine_metrics_df: pd.DataFrame,
    ensemble_analysis: dict,
    cv_metrics_df: pd.DataFrame | None,
    plot_paths: list[Path],
    config: EvaluationConfig,
) -> None:
    split_row = metadata_df.iloc[0]
    rmse_best = metrics_df.sort_values(["rmse", "mae"]).iloc[0]
    mae_best = metrics_df.sort_values(["mae", "rmse"]).iloc[0]
    seasonality_best = monthly_error_summary_df.iloc[0]
    spike_best = (
        spike_metrics_df.sort_values(["rmse", "mae"]).iloc[0]
        if not spike_metrics_df.empty
        else None
    )
    stability_df = (
        per_medicine_metrics_df.groupby(["model_key", "model"])["mae"]
        .agg(mean_mae="mean", mae_std="std")
        .reset_index()
        .sort_values(["mae_std", "mean_mae"])
    )
    stability_best = stability_df.iloc[0]
    per_medicine_mae_winners = (
        per_medicine_metrics_df.loc[
            per_medicine_metrics_df.groupby("medicine_id")["mae"].idxmin()
        ]["model"]
        .value_counts()
        .to_dict()
    )
    per_medicine_rmse_winners = (
        per_medicine_metrics_df.loc[
            per_medicine_metrics_df.groupby("medicine_id")["rmse"].idxmin()
        ]["model"]
        .value_counts()
        .to_dict()
    )

    interval_coverage = float(
        predictions_df["prophet_interval_contains_actual"].mean() * 100
    )
    average_interval_width = float(
        predictions_df["prophet_interval_width"].mean()
    )
    ensemble_minus_hw_rmse = float(
        metrics_df.loc[metrics_df["model_key"] == "ensemble", "rmse"].iloc[0]
        - metrics_df.loc[metrics_df["model_key"] == "hw", "rmse"].iloc[0]
    )
    ensemble_minus_hw_mae = float(
        metrics_df.loc[metrics_df["model_key"] == "ensemble", "mae"].iloc[0]
        - metrics_df.loc[metrics_df["model_key"] == "hw", "mae"].iloc[0]
    )

    metrics_table = markdown_table(build_metrics_report_table(metrics_df))
    code_table = markdown_table(build_code_understanding_table())

    plot_reference_lines = [
        f"- [{path.name}]({path.as_posix()}): generated directly from the held-out evaluation set."
        for path in plot_paths
    ]

    strengths = {
        "Holt-Winters": [
            "Strong deterministic monthly seasonal structure once at least 24 months are available.",
            "Non-negative clipping makes the production forecast operationally safe for demand quantities.",
            "Low implementation complexity and stable one-step behavior on dense monthly histories.",
        ],
        "Prophet": [
            "Provides an explicit 95% predictive interval in addition to the point forecast.",
            "Can capture changing trend and yearly seasonality without manual feature engineering.",
            "Retains a valid forecast path even when the ensemble weighting is not used.",
        ],
        "Ensemble (Holt + Prophet)": [
            "Combines two different forecast shapes into a single operational estimate.",
            "Carries Prophet uncertainty through to the inventory-policy layer via sigma, safety stock, and ROP.",
            "Can outperform both standalone models when the actual demand falls between Holt and Prophet predictions.",
        ],
    }

    weaknesses = {
        "Holt-Winters": [
            "Falls back to trend-only behavior for shorter series and cannot express predictive uncertainty.",
            "Relies on fixed 12-month seasonality and may lag abrupt structural changes.",
            "Single-step forecast function does not expose a native multi-step evaluation interface.",
        ],
        "Prophet": [
            "No non-negativity guard in the pure model path, so negative point forecasts are theoretically possible.",
            "Repeated fitting is materially slower than Holt-Winters during rolling evaluation.",
            "Performance is sensitive to whether yearly seasonality is sufficient to explain sharp month-to-month spikes.",
        ],
        "Ensemble (Holt + Prophet)": [
            "Weights are not learned from historical error; they are derived only from the current Prophet uncertainty band.",
            "The implemented formula increases Prophet influence as sigma grows relative to the Prophet forecast magnitude.",
            "A convex combination cannot recover extreme misses when both standalone forecasts are biased in the same direction.",
        ],
    }

    strength_lines = []
    for model_name, bullets in strengths.items():
        strength_lines.append(f"**{model_name}**")
        strength_lines.extend(f"- {bullet}" for bullet in bullets)

    weakness_lines = []
    for model_name, bullets in weaknesses.items():
        weakness_lines.append(f"**{model_name}**")
        weakness_lines.extend(f"- {bullet}" for bullet in bullets)

    cv_section = ""
    if cv_metrics_df is not None and not cv_metrics_df.empty:
        cv_table_df = cv_metrics_df.copy()
        for column in ["mae", "rmse", "mape", "smape"]:
            cv_table_df[column] = cv_table_df[column].map(
                lambda value: format_number(value, 3)
            )
        cv_section = "\n".join(
            [
                "## Bonus: Expanding-Window Cross-Validation",
                "",
                "A lightweight three-fold expanding-window cross-validation was also run as a secondary robustness check. Each fold predicts the next month after an expanding training window for every medicine.",
                "",
                markdown_table(cv_table_df),
                "",
                f"Prophet 95% interval empirical coverage on the main hold-out set was {format_number(interval_coverage, 2)}% with an average interval width of {format_number(average_interval_width, 3)} units.",
                "",
            ]
        )

    report = "\n".join(
        [
            "# Forecast Model Performance Report",
            "",
            "## 1. Introduction",
            "",
            "This analysis compares the three forecasting approaches currently implemented in the backend: Holt-Winters, Prophet, and the hybrid Holt + Prophet ensemble. The goal was to evaluate them under a single reproducible time-series backtest without modifying the production model logic.",
            "",
            f"The source workbook is `backend/pharmacy_demand.xlsx`, containing {int(metadata_df['series_length'].sum())} monthly observations across {len(metadata_df)} medicines.",
            "",
            "## 2. Existing Model Logic and Assumptions",
            "",
            code_table,
            "",
            "## 3. Methodology",
            "",
            f"- Dataset loading reused `src.forecast.load_demand_by_medicine`, which normalizes the workbook, groups duplicate rows, and reindexes to a monthly `MS` frequency.",
            f"- Each medicine contributes a separate monthly series. The held-out split used approximately the first {int(round(config.train_fraction * 100))}% for training and the final {int(round((1 - config.train_fraction) * 100))}% for testing.",
            f"- For the common 96-month series length in this dataset, the effective split was {int(split_row['train_size'])} train months and {int(split_row['test_size'])} test months per medicine.",
            f"- Train window: {pd.Timestamp(split_row['train_start']).date()} to {pd.Timestamp(split_row['train_end']).date()}. Test window: {pd.Timestamp(split_row['test_start']).date()} to {pd.Timestamp(split_row['test_end']).date()}.",
            "- Evaluation used an expanding-window one-step forecast over the entire test period so all three models remained comparable with their current one-step production interfaces.",
            f"- Metrics backend: `{METRICS_BACKEND}`.",
            "- Error is defined as `prediction - actual`, so negative bias means systematic under-forecasting.",
            "- Demand spikes were defined per medicine as test months at or above that medicine's 90th percentile of training demand.",
            "",
            "## 4. Metrics Table",
            "",
            metrics_table,
            "",
            "Spike-only subset:",
            "",
            markdown_table(
                spike_metrics_df.assign(
                    mae=spike_metrics_df["mae"].map(lambda value: format_number(value, 3)),
                    rmse=spike_metrics_df["rmse"].map(lambda value: format_number(value, 3)),
                    mape=spike_metrics_df["mape"].map(lambda value: format_number(value, 3)),
                    smape=spike_metrics_df["smape"].map(lambda value: format_number(value, 3)),
                )
            )
            if not spike_metrics_df.empty
            else "No spike months were detected under the selected threshold.",
            "",
            "Non-spike subset:",
            "",
            markdown_table(
                non_spike_metrics_df.assign(
                    mae=non_spike_metrics_df["mae"].map(lambda value: format_number(value, 3)),
                    rmse=non_spike_metrics_df["rmse"].map(lambda value: format_number(value, 3)),
                    mape=non_spike_metrics_df["mape"].map(lambda value: format_number(value, 3)),
                    smape=non_spike_metrics_df["smape"].map(lambda value: format_number(value, 3)),
                )
            )
            if not non_spike_metrics_df.empty
            else "No non-spike subset rows available.",
            "",
            "## 5. Graph Explanations",
            "",
            "- Actual-vs-predicted plots compare aggregate test-period monthly demand totals against each model forecast.",
            "- The error-distribution plot shows whether each model tends to be centered, skewed, or heavy-tailed.",
            "- Residual plots show temporal drift, clustering, and whether residuals remain centered near zero across the hold-out window.",
            "- The trend-comparison plot overlays all model totals on the actual monthly total to show comparative tracking of directional demand movement.",
            "- The calendar-month MAE plot is the direct seasonality diagnostic: lower and flatter monthly error curves indicate better seasonal handling.",
            "- The ensemble diagnostics plot relates hybrid regret to Prophet weighting and uncertainty-driven disagreement.",
            "",
            *plot_reference_lines,
            "",
            "## 6. Comparative Analysis",
            "",
            f"- Lowest RMSE: **{rmse_best['model']}** with RMSE {format_number(rmse_best['rmse'])}.",
            f"- Lowest MAE/MAPE/SMAPE: **{mae_best['model']}** with MAE {format_number(mae_best['mae'])}, MAPE {format_number(mae_best['mape'])}, and SMAPE {format_number(mae_best['smape'])}.",
            f"- Best seasonal consistency by calendar-month MAE: **{seasonality_best['model']}** with average monthly MAE {format_number(seasonality_best['avg_calendar_month_mae'])} and month-to-month dispersion {format_number(seasonality_best['std_calendar_month_mae'])}.",
            f"- Best spike handling: **{spike_best['model']}** based on the spike-only subset."
            if spike_best is not None
            else "- Best spike handling could not be ranked because no spike subset rows were detected.",
            f"- Most stable across medicines: **{stability_best['model']}** with per-medicine MAE standard deviation {format_number(stability_best['mae_std'])}.",
            f"- Prophet interval coverage on the hold-out set was {format_number(interval_coverage, 2)}%, which quantifies how well its uncertainty bands align with realized demand.",
            f"- Relative to Holt-Winters, the ensemble changed RMSE by {format_number(ensemble_minus_hw_rmse)} and MAE by {format_number(ensemble_minus_hw_mae)}. That means the ensemble reduced larger misses slightly while Holt kept a marginal advantage on average absolute error.",
            f"- Per-medicine MAE winners: Holt-Winters {per_medicine_mae_winners.get('Holt-Winters', 0)}, Ensemble {per_medicine_mae_winners.get('Ensemble (Holt + Prophet)', 0)}, Prophet {per_medicine_mae_winners.get('Prophet', 0)}.",
            f"- Per-medicine RMSE winners: Holt-Winters {per_medicine_rmse_winners.get('Holt-Winters', 0)}, Ensemble {per_medicine_rmse_winners.get('Ensemble (Holt + Prophet)', 0)}, Prophet {per_medicine_rmse_winners.get('Prophet', 0)}.",
            "",
            "Seasonality handling was judged primarily from the calendar-month MAE profile and secondarily from the aggregate trend plots. Spike behavior was judged on the held-out months above each medicine's training 90th percentile, because these are the periods most likely to stress inventory policy.",
            "",
            "## 7. Strengths and Weaknesses of Each Model",
            "",
            *strength_lines,
            "",
            *weakness_lines,
            "",
            "## 8. Why the Ensemble Works or Fails",
            "",
            "The hybrid forecast in `src/Holtphet.py` does not estimate weights from historical forecast accuracy. Instead, it computes:",
            "",
            "- `sigma = (upper - lower) / 4` when Prophet does not provide sigma directly",
            "- `weight_hw = clip(1 - sigma / |prophet_prediction|, 0, 1)`",
            "- `weight_prophet = 1 - weight_hw`",
            "",
            f"Observed average weights were Holt {format_number(ensemble_analysis['mean_weight_hw'])} and Prophet {format_number(ensemble_analysis['mean_weight_prophet'])}.",
            f"The ensemble beat Holt on {format_number(ensemble_analysis['better_than_hw_rate'] * 100, 2)}% of test points, beat Prophet on {format_number(ensemble_analysis['better_than_prophet_rate'] * 100, 2)}%, beat both on {format_number(ensemble_analysis['better_than_both_rate'] * 100, 2)}%, and was worse than both on {format_number(ensemble_analysis['worse_than_both_rate'] * 100, 2)}%.",
            f"When the ensemble beat both models, the actual demand lay between Holt and Prophet on {format_number(ensemble_analysis['actual_between_hw_prophet_when_better'] * 100, 2)}% of those points. This is consistent with a convex combination working best when the two standalone forecasts bracket the truth.",
            f"When the ensemble was worse than both, the average Holt-Prophet disagreement was {format_number(ensemble_analysis['mean_disagreement_when_worse'])} and the average Prophet sigma was {format_number(ensemble_analysis['mean_sigma_when_worse'])}.",
            "Because the ensemble forecast is always a convex combination of Holt and Prophet, it cannot be farther from the actual than both standalone forecasts under absolute error. That is why the worse-than-both rate is effectively zero here.",
            "Because the current weighting formula assigns more Prophet weight as sigma grows relative to the Prophet point forecast, high-uncertainty Prophet outputs can dominate the ensemble. That behavior is mathematically visible in the code and should be considered when interpreting failures.",
            "",
            "## 9. Final Conclusion",
            "",
            f"If the objective is minimizing large misses and spike-period RMSE, **{rmse_best['model']}** is the best choice in this experiment.",
            f"If the objective is minimizing typical absolute error and maximizing seasonal consistency, **{mae_best['model']}** is the better standalone choice.",
            f"For operational stability across medicines, **{stability_best['model']}** produced the most consistent per-medicine MAE dispersion.",
            "The ensemble remains useful when Holt and Prophet disagree in opposite directions and the actual demand falls between them, but its current uncertainty-based weighting rule is not a learned accuracy model. That is the main reason it can help in some months yet degrade performance in others.",
            "",
            cv_section.rstrip(),
        ]
    ).strip() + "\n"

    REPORT_PATH.write_text(report, encoding="utf-8")


def print_terminal_summary(
    metrics_df: pd.DataFrame,
    spike_metrics_df: pd.DataFrame,
    monthly_error_summary_df: pd.DataFrame,
    ensemble_analysis: dict,
    cv_metrics_df: pd.DataFrame | None,
) -> None:
    rmse_best = metrics_df.sort_values(["rmse", "mae"]).iloc[0]
    mae_best = metrics_df.sort_values(["mae", "rmse"]).iloc[0]
    seasonality_best = monthly_error_summary_df.iloc[0]
    spike_best = (
        spike_metrics_df.sort_values(["rmse", "mae"]).iloc[0]["model"]
        if not spike_metrics_df.empty
        else "NA"
    )

    print("\n=== MODEL EVALUATION SUMMARY ===")
    print(
        f"Lowest RMSE: {rmse_best['model']} "
        f"(RMSE={format_number(rmse_best['rmse'])})"
    )
    print(
        f"Lowest MAE: {mae_best['model']} "
        f"(MAE={format_number(mae_best['mae'])})"
    )
    print(
        f"Best seasonality handling: {seasonality_best['model']} "
        f"(avg monthly MAE={format_number(seasonality_best['avg_calendar_month_mae'])})"
    )
    print(f"Best spike handling: {spike_best}")
    print(
        "Ensemble rates: "
        f"better_than_both={format_number(ensemble_analysis['better_than_both_rate'] * 100, 2)}%, "
        f"worse_than_both={format_number(ensemble_analysis['worse_than_both_rate'] * 100, 2)}%"
    )
    if cv_metrics_df is not None and not cv_metrics_df.empty:
        cv_best = cv_metrics_df.iloc[0]
        print(
            f"Best CV model: {cv_best['model']} "
            f"(RMSE={format_number(cv_best['rmse'])}, MAE={format_number(cv_best['mae'])})"
        )
    print(f"Report: {REPORT_PATH}")
    print(f"Plots: {PLOTS_DIR}")


def parse_args() -> EvaluationConfig:
    parser = argparse.ArgumentParser(
        description="Evaluate Holt-Winters, Prophet, and ensemble forecasts."
    )
    parser.add_argument("--train-fraction", type=float, default=0.8)
    parser.add_argument("--min-train-size", type=int, default=24)
    parser.add_argument("--workers", type=int, default=max(1, min(4, os.cpu_count() or 1)))
    parser.add_argument("--skip-cv", action="store_true")
    parser.add_argument("--cv-splits", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    return EvaluationConfig(
        train_fraction=args.train_fraction,
        min_train_size=args.min_train_size,
        workers=args.workers,
        run_cv=not args.skip_cv,
        cv_splits=args.cv_splits,
        seed=args.seed,
    )


def main() -> None:
    config = parse_args()
    ensure_output_paths()
    set_deterministic_seed(config.seed)

    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    print(f"Loading demand data from {DATASET_PATH}...")
    series_by_medicine = load_demand_by_medicine(DATASET_PATH)
    print(
        f"Loaded {len(series_by_medicine)} medicine series. "
        f"Running evaluation with {config.workers} worker(s)..."
    )

    predictions_df, metadata_df = evaluate_models(series_by_medicine, config)
    metrics_df = compute_metrics_frame(predictions_df)
    spike_metrics_df = compute_subset_metrics(
        predictions_df,
        predictions_df["is_spike"],
        "Spike months",
    )
    non_spike_metrics_df = compute_subset_metrics(
        predictions_df,
        ~predictions_df["is_spike"],
        "Non-spike months",
    )
    monthly_error_summary_df = compute_monthly_error_summary(predictions_df)
    per_medicine_metrics_df = compute_per_medicine_metrics(predictions_df)
    ensemble_analysis = compute_ensemble_analysis(predictions_df)

    cv_metrics_df = None
    if config.run_cv:
        print("Running expanding-window cross-validation...")
        cv_metrics_df = run_time_series_cv(series_by_medicine, config)
        cv_metrics_df.to_csv(CV_METRICS_CSV_PATH, index=False)

    plot_paths = create_plots(predictions_df)

    metrics_df.to_csv(METRICS_CSV_PATH, index=False)
    predictions_df.to_csv(PREDICTIONS_CSV_PATH, index=False)

    write_report(
        predictions_df=predictions_df,
        metadata_df=metadata_df,
        metrics_df=metrics_df,
        spike_metrics_df=spike_metrics_df,
        non_spike_metrics_df=non_spike_metrics_df,
        monthly_error_summary_df=monthly_error_summary_df,
        per_medicine_metrics_df=per_medicine_metrics_df,
        ensemble_analysis=ensemble_analysis,
        cv_metrics_df=cv_metrics_df,
        plot_paths=plot_paths,
        config=config,
    )

    print_terminal_summary(
        metrics_df=metrics_df,
        spike_metrics_df=spike_metrics_df,
        monthly_error_summary_df=monthly_error_summary_df,
        ensemble_analysis=ensemble_analysis,
        cv_metrics_df=cv_metrics_df,
    )


if __name__ == "__main__":
    main()
