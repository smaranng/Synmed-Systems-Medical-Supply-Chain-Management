from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_DIR = BACKEND_ROOT / "analysis"
PLOTS_DIR = ANALYSIS_DIR / "plots"
POLICY_CSV_PATH = ANALYSIS_DIR / "inventory_policy_snapshot.csv"
SIMULATION_CSV_PATH = ANALYSIS_DIR / "inventory_stock_simulation.csv"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.Holtphet import hybrid_inventory_policy_by_medicine
from src.forecast import forecast_by_medicine, load_demand_by_medicine
from src.holtphet_main import (
    attach_medicine_names,
    build_current_stock_map,
    resolve_dataset_path,
)
from src.prophet_model import prophet_forecast_by_medicine


def ensure_output_paths() -> None:
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)


def build_policy_frame() -> tuple[pd.DataFrame, dict[str, pd.Series]]:
    demand_by_medicine = load_demand_by_medicine(resolve_dataset_path())
    hw_forecasts = forecast_by_medicine(demand_by_medicine)
    prophet_forecasts = prophet_forecast_by_medicine(demand_by_medicine)
    current_stock = build_current_stock_map()

    policy_df = hybrid_inventory_policy_by_medicine(
        hw_forecasts,
        prophet_forecasts,
        current_stock=current_stock,
    )
    policy_df = attach_medicine_names(policy_df)

    demand_stats_rows = []
    for medicine_id, series in sorted(demand_by_medicine.items()):
        clean_series = pd.Series(series).dropna().astype(float)
        recent_window = clean_series.tail(12)
        demand_stats_rows.append(
            {
                "medicine_id": medicine_id,
                "demand_variance": float(
                    clean_series.var(ddof=1) if len(clean_series) > 1 else 0.0
                ),
                "demand_std": float(
                    clean_series.std(ddof=1) if len(clean_series) > 1 else 0.0
                ),
                "recent_12m_mean_demand": float(recent_window.mean()),
                "recent_12m_std_demand": float(
                    recent_window.std(ddof=1) if len(recent_window) > 1 else 0.0
                ),
            }
        )

    demand_stats_df = pd.DataFrame(demand_stats_rows)
    policy_df = policy_df.merge(demand_stats_df, on="medicine_id", how="left")
    policy_df["stock_gap_to_rop"] = policy_df["current_stock"] - policy_df["rop"]
    policy_df["reorder_status"] = np.where(
        policy_df["reorder"],
        "Reorder needed",
        "Stock above reorder point",
    )
    return policy_df.sort_values("medicine_id").reset_index(drop=True), demand_by_medicine


def save_policy_snapshot(policy_df: pd.DataFrame) -> None:
    export_df = policy_df.copy()
    numeric_columns = export_df.select_dtypes(include="number").columns
    export_df[numeric_columns] = export_df[numeric_columns].round(2)
    export_df.sort_values(["reorder", "order_qty"], ascending=[False, False]).to_csv(
        POLICY_CSV_PATH,
        index=False,
    )


def build_recent_demand_scenario(
    demand_by_medicine: dict[str, pd.Series],
    horizon: int,
) -> tuple[pd.DatetimeIndex, dict[str, list[float]]]:
    latest_date = max(series.index.max() for series in demand_by_medicine.values())
    future_dates = pd.date_range(
        latest_date + pd.offsets.MonthBegin(1),
        periods=horizon,
        freq="MS",
    )
    scenario_by_medicine: dict[str, list[float]] = {}

    for medicine_id, series in sorted(demand_by_medicine.items()):
        clean_series = pd.Series(series).dropna().astype(float)
        scenario_window = clean_series.tail(horizon)
        if len(scenario_window) < horizon:
            padding = [float(clean_series.mean())] * (horizon - len(scenario_window))
            scenario_values = padding + scenario_window.tolist()
        else:
            scenario_values = scenario_window.tolist()
        scenario_by_medicine[medicine_id] = [float(value) for value in scenario_values]

    return future_dates, scenario_by_medicine


def simulate_stock_levels(
    policy_df: pd.DataFrame,
    demand_by_medicine: dict[str, pd.Series],
    horizon: int,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    future_dates, scenario_by_medicine = build_recent_demand_scenario(
        demand_by_medicine,
        horizon=horizon,
    )
    on_hand_stock = {
        row["medicine_id"]: float(row["current_stock"])
        for row in policy_df.to_dict("records")
    }
    pending_replenishment = {medicine_id: 0.0 for medicine_id in on_hand_stock}
    policy_map = policy_df.set_index("medicine_id").to_dict("index")
    simulation_rows = []

    for month_step, simulation_date in enumerate(future_dates, start=1):
        for half_step in (1, 2):
            for medicine_id in sorted(policy_map):
                policy = policy_map[medicine_id]
                reorder_point = float(policy["rop"])
                target_stock = float(policy["target_stock"])
                received_replenishment = pending_replenishment[medicine_id]
                starting_stock = on_hand_stock[medicine_id] + received_replenishment
                monthly_demand = float(scenario_by_medicine[medicine_id][month_step - 1])
                period_demand = monthly_demand / 2.0
                ending_stock = max(0.0, starting_stock - period_demand)
                lost_sales = max(0.0, period_demand - starting_stock)
                reorder = ending_stock < reorder_point
                order_placed = max(0.0, target_stock - ending_stock) if reorder else 0.0

                pending_replenishment[medicine_id] = order_placed
                on_hand_stock[medicine_id] = ending_stock

                simulation_rows.append(
                    {
                        "simulation_step": month_step,
                        "half_step": half_step,
                        "date": simulation_date,
                        "medicine_id": medicine_id,
                        "medicine_name": policy["medicine_name"],
                        "starting_stock": starting_stock,
                        "reorder_point": reorder_point,
                        "target_stock": target_stock,
                        "safety_stock": float(policy["safety_stock"]),
                        "received_replenishment": received_replenishment,
                        "scenario_demand": period_demand,
                        "ending_stock": ending_stock,
                        "lost_sales": lost_sales,
                        "reorder": reorder,
                        "order_placed": order_placed,
                    }
                )

    simulation_df = pd.DataFrame(simulation_rows)
    first_half_df = simulation_df.loc[simulation_df["half_step"] == 1]
    second_half_df = simulation_df.loc[simulation_df["half_step"] == 2]

    summary_df = first_half_df.groupby(["simulation_step", "date"], as_index=False).agg(
        starting_stock_total=("starting_stock", "sum"),
        reorder_point_total=("reorder_point", "sum"),
        safety_stock_total=("safety_stock", "sum"),
    )
    summary_df = summary_df.merge(
        simulation_df.groupby(["simulation_step", "date"], as_index=False).agg(
            received_replenishment_total=("received_replenishment", "sum"),
            order_placed_total=("order_placed", "sum"),
            scenario_demand_total=("scenario_demand", "sum"),
            lost_sales_total=("lost_sales", "sum"),
            reorder_count=("reorder", "sum"),
        ),
        on=["simulation_step", "date"],
        how="left",
    )
    summary_df = summary_df.merge(
        second_half_df.groupby(["simulation_step", "date"], as_index=False).agg(
            ending_stock_total=("ending_stock", "sum"),
        ),
        on=["simulation_step", "date"],
        how="left",
    ).sort_values("simulation_step").reset_index(drop=True)

    export_df = simulation_df.copy()
    numeric_columns = export_df.select_dtypes(include="number").columns
    export_df[numeric_columns] = export_df[numeric_columns].round(2)
    export_df.to_csv(SIMULATION_CSV_PATH, index=False)
    return simulation_df, summary_df


def _save_figure(fig: plt.Figure, filename: str) -> Path:
    output_path = PLOTS_DIR / filename
    fig.tight_layout()
    fig.savefig(output_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return output_path


def plot_reorder_point_vs_current_stock(policy_df: pd.DataFrame) -> Path:
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = policy_df["reorder"].map({True: "#d62728", False: "#1f77b4"})
    point_sizes = np.clip(policy_df["order_qty"] * 0.4 + 80, 80, 340)

    ax.scatter(
        policy_df["current_stock"],
        policy_df["rop"],
        s=point_sizes,
        c=colors,
        alpha=0.85,
        edgecolors="white",
        linewidths=0.8,
    )

    diagonal_max = float(
        max(policy_df["current_stock"].max(), policy_df["rop"].max()) * 1.05
    )
    ax.plot(
        [0, diagonal_max],
        [0, diagonal_max],
        linestyle="--",
        color="#555555",
        linewidth=1.1,
        label="Current stock = reorder point",
    )

    legend_handles = [
        plt.Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            label="Reorder needed",
            markerfacecolor="#d62728",
            markeredgecolor="white",
            markersize=10,
        ),
        plt.Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            label="Stock above reorder point",
            markerfacecolor="#1f77b4",
            markeredgecolor="white",
            markersize=10,
        ),
    ]
    ax.legend(handles=legend_handles, loc="upper left")
    ax.set_title("Reorder Point vs Current Stock")
    ax.set_xlabel("Current Stock")
    ax.set_ylabel("Reorder Point")
    ax.grid(True, alpha=0.25)
    return _save_figure(fig, "reorder_point_vs_current_stock.png")


def plot_safety_stock_vs_demand_variance(policy_df: pd.DataFrame) -> Path:
    fig, ax = plt.subplots(figsize=(10, 6))
    variance = policy_df["demand_variance"].astype(float).clip(lower=0.0)
    safety_stock = policy_df["safety_stock"].astype(float)

    scatter = ax.scatter(
        variance,
        safety_stock,
        c=policy_df["ensemble_forecast"],
        cmap="viridis",
        s=110,
        alpha=0.85,
        edgecolors="white",
        linewidths=0.8,
    )

    positive_variance = variance[variance > 0]
    if not positive_variance.empty:
        variance_ratio = positive_variance.max() / positive_variance.min()
        if variance_ratio >= 15:
            ax.set_xscale("log")
            fit_x = np.log10(positive_variance.to_numpy())
            fit_y = safety_stock.loc[positive_variance.index].to_numpy()
            coefficients = np.polyfit(fit_x, fit_y, deg=1)
            line_x = np.geomspace(positive_variance.min(), positive_variance.max(), 120)
            line_y = coefficients[0] * np.log10(line_x) + coefficients[1]
        else:
            coefficients = np.polyfit(variance.to_numpy(), safety_stock.to_numpy(), deg=1)
            line_x = np.linspace(variance.min(), variance.max(), 120)
            line_y = coefficients[0] * line_x + coefficients[1]
        ax.plot(
            line_x,
            line_y,
            color="#111111",
            linestyle="--",
            linewidth=1.2,
            label="Trend",
        )
        ax.legend(loc="upper left")

    colorbar = fig.colorbar(scatter, ax=ax)
    colorbar.set_label("Ensemble Forecast")
    ax.set_title("Safety Stock vs Demand Variance")
    ax.set_xlabel("Historical Demand Variance")
    ax.set_ylabel("Safety Stock")
    ax.grid(True, alpha=0.25)
    return _save_figure(fig, "safety_stock_vs_demand_variance.png")


def plot_stock_level_simulation(summary_df: pd.DataFrame, horizon: int) -> Path:
    fig, (ax_top, ax_bottom) = plt.subplots(
        2,
        1,
        figsize=(11, 8),
        sharex=True,
        gridspec_kw={"height_ratios": [2.2, 1.2]},
    )
    positions = np.arange(len(summary_df))
    labels = summary_df["date"].dt.strftime("%Y-%m")

    ax_top.plot(
        positions,
        summary_df["starting_stock_total"],
        marker="o",
        linewidth=2,
        color="#1f77b4",
        label="Starting stock",
    )
    ax_top.plot(
        positions,
        summary_df["ending_stock_total"],
        marker="o",
        linewidth=2,
        color="#2ca02c",
        label="Ending stock",
    )
    ax_top.plot(
        positions,
        summary_df["reorder_point_total"],
        linestyle="--",
        linewidth=1.4,
        color="#d62728",
        label="Aggregate reorder point",
    )
    ax_top.fill_between(
        positions,
        summary_df["ending_stock_total"],
        summary_df["reorder_point_total"],
        where=summary_df["ending_stock_total"] < summary_df["reorder_point_total"],
        interpolate=True,
        color="#d62728",
        alpha=0.12,
    )
    ax_top.set_ylabel("Units")
    ax_top.set_title(
        f"Stock Level Simulation ({horizon}-Month Replay Using Recent Demand)"
    )
    ax_top.grid(True, alpha=0.25)
    ax_top.legend(loc="upper right")

    ax_bottom.bar(
        positions,
        summary_df["received_replenishment_total"],
        color="#ff7f0e",
        alpha=0.8,
        label="Replenishment received",
    )
    ax_bottom.plot(
        positions,
        summary_df["scenario_demand_total"],
        marker="o",
        linewidth=2,
        color="#111111",
        label="Scenario demand",
    )
    if summary_df["lost_sales_total"].gt(0).any():
        ax_bottom.plot(
            positions,
            summary_df["lost_sales_total"],
            marker="o",
            linewidth=1.6,
            color="#9467bd",
            label="Lost sales",
        )
    ax_bottom.set_ylabel("Units")
    ax_bottom.set_xlabel("Simulation Month")
    ax_bottom.set_xticks(positions)
    ax_bottom.set_xticklabels(labels, rotation=45, ha="right")
    ax_bottom.grid(True, alpha=0.25)
    ax_bottom.legend(loc="upper right")

    return _save_figure(fig, "stock_level_simulation.png")


def plot_order_quantity_distribution(policy_df: pd.DataFrame) -> Path:
    order_quantities = policy_df.loc[policy_df["order_qty"] > 0, "order_qty"].astype(float)
    fig, ax = plt.subplots(figsize=(10, 6))

    if order_quantities.empty:
        ax.text(
            0.5,
            0.5,
            "No orders were triggered by the current hybrid policy.",
            ha="center",
            va="center",
            fontsize=12,
            transform=ax.transAxes,
        )
        ax.set_axis_off()
        return _save_figure(fig, "order_quantity_distribution.png")

    bin_count = min(10, max(5, int(np.ceil(np.sqrt(len(order_quantities))))))
    ax.hist(
        order_quantities,
        bins=bin_count,
        color="#2ca02c",
        alpha=0.85,
        edgecolor="white",
        linewidth=0.8,
    )
    ax.axvline(
        order_quantities.mean(),
        color="#d62728",
        linestyle="--",
        linewidth=1.5,
        label=f"Mean = {order_quantities.mean():.1f}",
    )
    ax.axvline(
        order_quantities.median(),
        color="#1f77b4",
        linestyle=":",
        linewidth=1.8,
        label=f"Median = {order_quantities.median():.1f}",
    )
    ax.set_title("Order Quantity Distribution")
    ax.set_xlabel("Order Quantity")
    ax.set_ylabel("Medicine Count")
    ax.grid(True, axis="y", alpha=0.25)
    ax.legend(loc="upper right")
    return _save_figure(fig, "order_quantity_distribution.png")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate hybrid inventory analysis plots."
    )
    parser.add_argument(
        "--horizon",
        type=int,
        default=12,
        help="Number of months to simulate in the stock level replay.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    horizon = max(1, int(args.horizon))
    ensure_output_paths()

    policy_df, demand_by_medicine = build_policy_frame()
    save_policy_snapshot(policy_df)

    _, simulation_summary_df = simulate_stock_levels(
        policy_df,
        demand_by_medicine,
        horizon=horizon,
    )

    plot_paths = [
        plot_reorder_point_vs_current_stock(policy_df),
        plot_safety_stock_vs_demand_variance(policy_df),
        plot_stock_level_simulation(simulation_summary_df, horizon=horizon),
        plot_order_quantity_distribution(policy_df),
    ]

    print("Generated inventory policy analysis outputs:")
    for path in plot_paths:
        print(f"- {path}")
    print(f"- {POLICY_CSV_PATH}")
    print(f"- {SIMULATION_CSV_PATH}")


if __name__ == "__main__":
    main()
