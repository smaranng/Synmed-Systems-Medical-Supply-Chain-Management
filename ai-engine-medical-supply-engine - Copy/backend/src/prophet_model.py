import contextlib
import io
import logging

import pandas as pd

with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(
    io.StringIO()
):
    from prophet import Prophet


logging.getLogger("cmdstanpy").disabled = True
logging.getLogger("prophet").setLevel(logging.ERROR)


def _prepare_series(series):
    series = pd.Series(series).dropna().sort_index().astype(float)
    if series.empty:
        raise ValueError("Cannot forecast an empty demand series.")

    if not isinstance(series.index, pd.DatetimeIndex):
        series.index = pd.to_datetime(series.index)

    return series


def prophet_forecast(series, periods=1):
    series = _prepare_series(series)

    if series.nunique() <= 1:
        prediction = float(series.iloc[-1])
        return {
            "prediction": prediction,
            "lower": prediction,
            "upper": prediction,
            "model": None,
            "forecast_df": None,
        }

    df = series.reset_index()
    df.columns = ["ds", "y"]

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.95,
    )

    model.fit(df)

    future = model.make_future_dataframe(periods=periods, freq="MS")
    forecast = model.predict(future)
    next_month = forecast.iloc[-1]

    return {
        "prediction": float(next_month["yhat"]),
        "lower": float(next_month["yhat_lower"]),
        "upper": float(next_month["yhat_upper"]),
        "model": model,
        "forecast_df": forecast,
    }


def prophet_forecast_by_medicine(series_by_medicine, periods=1):
    return {
        medicine_id: prophet_forecast(series, periods=periods)
        for medicine_id, series in series_by_medicine.items()
    }
