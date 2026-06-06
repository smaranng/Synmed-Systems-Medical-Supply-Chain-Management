import warnings
from pathlib import Path
from typing import Any

import pandas as pd
from statsmodels.tools.sm_exceptions import ConvergenceWarning
from statsmodels.tsa.holtwinters import ExponentialSmoothing


DATE_COLUMN = "date"
QUANTITY_COLUMN = "quantity"
MEDICINE_COLUMN = "medicine_id"


def _clean_numeric_quantity(series):
    return (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace(" ", "", regex=False)
    )


def _select_active_columns(df):
    columns = df.columns.tolist()
    suffixes = []

    for column in columns:
        if column.startswith(DATE_COLUMN):
            suffix = column[len(DATE_COLUMN) :]
            quantity_column = f"{QUANTITY_COLUMN}{suffix}"
            if quantity_column in columns and suffix not in suffixes:
                suffixes.append(suffix)

    for suffix in suffixes:
        date_column = f"{DATE_COLUMN}{suffix}"
        quantity_column = f"{QUANTITY_COLUMN}{suffix}"

        parsed_dates = pd.to_datetime(df[date_column], errors="coerce")
        parsed_quantities = pd.to_numeric(
            _clean_numeric_quantity(df[quantity_column]),
            errors="coerce",
        )

        if not parsed_dates.notna().any() or not parsed_quantities.notna().any():
            continue

        selected = pd.DataFrame(
            {
                DATE_COLUMN: parsed_dates,
                QUANTITY_COLUMN: parsed_quantities,
            }
        )

        medicine_column = None
        preferred_medicine_column = f"{MEDICINE_COLUMN}{suffix}"
        if preferred_medicine_column in columns and df[preferred_medicine_column].notna().any():
            medicine_column = preferred_medicine_column
        elif MEDICINE_COLUMN in columns and df[MEDICINE_COLUMN].notna().any():
            medicine_column = MEDICINE_COLUMN

        if medicine_column is not None:
            selected[MEDICINE_COLUMN] = (
                df[medicine_column].astype("string").str.strip()
            )

        return selected

    raise ValueError(
        "Incorrect Excel format. Expected at least one usable "
        f"'{DATE_COLUMN}'/'{QUANTITY_COLUMN}' column pair."
    )


def _resolve_sheet_name(filepath, sheet_name=None):
    workbook = pd.ExcelFile(filepath)

    if sheet_name is None:
        if "demand" in workbook.sheet_names:
            return "demand"
        return workbook.sheet_names[0]

    if isinstance(sheet_name, str) and sheet_name not in workbook.sheet_names:
        raise ValueError(
            f"Sheet '{sheet_name}' was not found in {filepath}. "
            f"Available sheets: {workbook.sheet_names}"
        )

    return sheet_name


def _clean_demand_frame(df):
    df = df.copy()
    df.columns = df.columns.astype(str).str.strip().str.lower()
    df = _select_active_columns(df)

    df = df.dropna(subset=[DATE_COLUMN, QUANTITY_COLUMN])

    if MEDICINE_COLUMN in df.columns and df[MEDICINE_COLUMN].notna().any():
        df = df.dropna(subset=[MEDICINE_COLUMN])
    elif MEDICINE_COLUMN in df.columns:
        df = df.drop(columns=[MEDICINE_COLUMN])

    group_columns = [DATE_COLUMN]
    if MEDICINE_COLUMN in df.columns:
        group_columns.insert(0, MEDICINE_COLUMN)

    return (
        df.groupby(group_columns, as_index=False)[QUANTITY_COLUMN]
        .sum()
        .sort_values(group_columns)
    )


def _to_monthly_series(df):
    series = (
        df.set_index(DATE_COLUMN)[QUANTITY_COLUMN]
        .sort_index()
        .astype(float)
    )

    if series.empty:
        return series

    full_index = pd.date_range(series.index.min(), series.index.max(), freq="MS")
    series = series.reindex(full_index, fill_value=0.0)
    series.index.name = DATE_COLUMN
    return series


def load_demand_frame(filepath, sheet_name=None):
    resolved_sheet = _resolve_sheet_name(filepath, sheet_name=sheet_name)
    df = pd.read_excel(Path(filepath), sheet_name=resolved_sheet)
    return _clean_demand_frame(df)


def load_demand(filepath, medicine_id=None, sheet_name=None):
    series_by_medicine = load_demand_by_medicine(filepath, sheet_name=sheet_name)

    if medicine_id is not None:
        medicine_key = str(medicine_id)
        if medicine_key not in series_by_medicine:
            raise KeyError(f"Medicine '{medicine_key}' not found in {filepath}.")
        return series_by_medicine[medicine_key]

    if len(series_by_medicine) != 1:
        raise ValueError(
            "Multiple medicines detected. Pass medicine_id or use "
            "load_demand_by_medicine() for batch forecasting."
        )

    return next(iter(series_by_medicine.values()))


def load_demand_by_medicine(filepath, sheet_name=None):
    df = load_demand_frame(filepath, sheet_name=sheet_name)

    if MEDICINE_COLUMN not in df.columns:
        return {"ALL": _to_monthly_series(df)}

    series_by_medicine = {}
    for medicine_id, medicine_df in df.groupby(MEDICINE_COLUMN):
        series_by_medicine[str(medicine_id)] = _to_monthly_series(medicine_df)

    return series_by_medicine


def forecast_next_month_with_details(series) -> dict[str, Any]:
    series = pd.Series(series).dropna().sort_index().astype(float)

    if series.empty:
        raise ValueError("Cannot forecast an empty demand series.")

    n = len(series)
    details: dict[str, Any] = {
        "history_length": int(n),
        "model_family": "",
        "model_used": "",
        "trend": None,
        "seasonal": None,
        "seasonal_periods": None,
        "fallback_reason": None,
        "forecast_before_clip": None,
    }

    if n >= 24:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", ConvergenceWarning)
                model = ExponentialSmoothing(
                    series,
                    trend="add",
                    seasonal="mul",
                    seasonal_periods=12,
                ).fit()
            details.update(
                {
                    "model_family": "holt_winters",
                    "model_used": (
                        "Holt-Winters with additive trend and multiplicative "
                        "seasonality"
                    ),
                    "trend": "add",
                    "seasonal": "mul",
                    "seasonal_periods": 12,
                }
            )
        except ValueError:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", ConvergenceWarning)
                model = ExponentialSmoothing(
                    series,
                    trend="add",
                    seasonal="add",
                    seasonal_periods=12,
                ).fit()
            details.update(
                {
                    "model_family": "holt_winters",
                    "model_used": (
                        "Holt-Winters with additive trend and additive "
                        "seasonality"
                    ),
                    "trend": "add",
                    "seasonal": "add",
                    "seasonal_periods": 12,
                    "fallback_reason": (
                        "Multiplicative seasonality was not feasible for this "
                        "series, so the model fell back to additive seasonality."
                    ),
                }
            )
    elif n >= 6:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ConvergenceWarning)
            model = ExponentialSmoothing(
                series,
                trend="add",
                seasonal=None,
            ).fit()
        details.update(
            {
                "model_family": "holt_linear",
                "model_used": "Holt linear trend",
                "trend": "add",
                "seasonal": None,
                "seasonal_periods": None,
            }
        )
    else:
        forecast = float(series.mean())
        details.update(
            {
                "model_family": "mean_fallback",
                "model_used": "Mean fallback",
                "fallback_reason": (
                    "The history contains fewer than 6 observations, so the "
                    "forecast falls back to the mean demand."
                ),
                "forecast_before_clip": forecast,
                "forecast": max(forecast, 0.0),
            }
        )
        return details

    forecast = model.forecast(1).iloc[0]
    details["forecast_before_clip"] = float(forecast)
    details["forecast"] = max(float(forecast), 0.0)
    return details


def forecast_next_month(series):
    return float(forecast_next_month_with_details(series)["forecast"])


def forecast_by_medicine(series_by_medicine):
    return {
        medicine_id: forecast_next_month(series)
        for medicine_id, series in series_by_medicine.items()
    }