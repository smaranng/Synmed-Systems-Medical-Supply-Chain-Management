# Project Overview

This document is derived strictly from the repository's current source files and local runtime probes of the bundled datasets. It explains the implemented system as it exists today, including places where the code is more of a prototype than a fully integrated production platform.

## 1. System Overview

The repository implements a pharmacy inventory and procurement prototype with three main responsibilities:

1. Convert historical monthly demand data into forecastable time series.
2. Turn those forecasts into reorder decisions using reorder point and safety stock logic.
3. Route reorder decisions into a deterministic distributor-selection engine that can optionally add LLM-generated explanations.

At a high level, the system solves a common pharmacy operations problem: deciding when a medicine should be reordered, how much should be ordered, and which supplier should fulfill that order. The codebase is not one single monolithic flow. It contains two inventory-planning tracks:

- A newer batch-oriented, multi-medicine hybrid flow built around Holt-Winters plus Prophet forecasting and written primarily in [src/forecast.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/forecast.py), [src/Holtphet.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/Holtphet.py), and [src/holtphet_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/holtphet_main.py).
- An older single-medicine planning flow built around one demand series, simple statistics, and a threshold update rule in [src/main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/main.py).

The procurement side is concentrated in [src/procurement_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/procurement_main.py) and the `src/engine/` package. That layer is deterministic first. It filters and scores distributors using explicit rules. LLM usage is optional and limited to natural-language reasoning and reflection. If the agent cannot initialize or call the API, supplier selection still completes through deterministic code.

The key implemented capabilities are:

- Workbook ingestion for two different Excel layouts.
- Per-medicine monthly demand normalization.
- Holt-Winters one-step-ahead monthly forecasting.
- Prophet monthly forecasting with a 95 percent interval.
- Hybrid inventory policy that combines the two forecast outputs.
- Safety stock, reorder point, target stock, and order quantity calculation.
- Batch reorder request JSON generation.
- Distributor filtering by distance, lead time, and minimum order value.
- Weighted supplier scoring by distance, lead time, rating, and price.
- Audit logging and optional AI-generated procurement narrative.

The primary runnable entry points are:

- `.\myenv\Scripts\python.exe src\holtphet_main.py`
  Runs the batch inventory cycle and writes `data/monthly_reorder_requests.json`.
- `.\myenv\Scripts\python.exe src\procurement_main.py`
  Consumes an existing reorder-request file and writes `data/monthly_procurement_orders.json`.
- `.\myenv\Scripts\python.exe -c "import sys; sys.path.append('src'); from procurement_main import run_monthly_pipeline; run_monthly_pipeline()"`
  Runs the batch inventory cycle and procurement cycle together without relying on `src` being an importable package.
- `.\myenv\Scripts\python.exe src\main.py`
  Runs the legacy single-medicine AI order planner.
- `.\myenv\Scripts\python.exe src\prophet_main.py`
  Runs the Prophet-only demonstration path.

Important environment notes:

- No `requirements.txt` or lock file is present. Dependencies must be inferred from imports. The code needs at least `pandas`, `numpy`, `scipy`, `statsmodels`, `prophet`, `python-dotenv`, and `openai`.
- The optional procurement agent expects a repo-root `.env` file containing `GROQ_API_KEY`.
- The batch flow expects a workbook in the repository root named `pharmacy_demand.xlsx`, `synthetic_pharmacy_demand.xlsx`, or `synthetic_pharmacy_dataset.xlsx`.

## 2. End-to-End Execution Flow

### 2.1 Forecasting Pipeline

The main batch forecasting pipeline starts in [src/holtphet_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/holtphet_main.py) inside `run()`.

1. `run()` calls `resolve_dataset_path()`.
   The code searches the repository root for `pharmacy_demand.xlsx`, then `synthetic_pharmacy_demand.xlsx`, then `synthetic_pharmacy_dataset.xlsx`. The first existing file is used.

2. `run()` calls `load_demand_by_medicine()` from [src/forecast.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/forecast.py).
   This is the ingestion boundary between raw spreadsheet data and the forecasting domain.

3. `load_demand_by_medicine()` first calls `load_demand_frame()`.
   `load_demand_frame()` resolves the worksheet name through `_resolve_sheet_name()`. If the caller does not specify a sheet, the loader prefers a sheet literally named `demand`; otherwise it falls back to the first sheet.

4. `load_demand_frame()` reads the sheet with `pandas.read_excel()` and normalizes the data through `_clean_demand_frame()`.
   `_clean_demand_frame()` lowercases and trims column names, then delegates to `_select_active_columns()`.

5. `_select_active_columns()` scans the workbook columns for usable `date` and `quantity` pairs.
   This is how the loader supports both the modern dataset shape (`date`, `medicine_id`, `quantity`) and the older workbook shape that stores active values in `date.1` and `quantity.1`.

6. `_clean_demand_frame()` removes unusable rows and groups duplicates.
   It drops rows with null dates or quantities, optionally drops rows with null `medicine_id` values if that column is active, groups by `medicine_id` and `date` when applicable, sums duplicate quantities, and sorts the result.

7. `load_demand_by_medicine()` splits the cleaned frame into one series per medicine.
   If no usable `medicine_id` column exists, the loader returns a single synthetic key, `ALL`. Otherwise each medicine becomes its own monthly series.

8. `_to_monthly_series()` reindexes each series to a full month-start date range.
   Missing months are filled with `0.0`. This means the forecasting models always receive a continuous monthly series even if the workbook skipped months.

9. `run()` passes the per-medicine mapping to `forecast_by_medicine()`.
   `forecast_by_medicine()` calls `forecast_next_month()` for each series.

10. `forecast_next_month()` chooses a Holt-Winters variant based on history length.
    If at least 24 monthly points exist, it tries additive trend plus multiplicative seasonality with a 12-month seasonal period. If multiplicative seasonality fails, usually because of zero values, it falls back to additive seasonality. If only 6 to 23 points exist, it uses additive trend with no seasonality. If fewer than 6 points exist, it returns the mean demand.

11. In parallel conceptually, `run()` also calls `prophet_forecast_by_medicine()` from [src/prophet_model.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/prophet_model.py).
    Each monthly series is converted into Prophet's `ds` and `y` schema and forecast one step forward at a month-start frequency.

12. `run()` calls `hybrid_inventory_policy_by_medicine()` from [src/Holtphet.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/Holtphet.py).
    This joins the Holt forecast, the Prophet result, and current stock for each medicine into one inventory-policy row.

13. `attach_medicine_names()` enriches each row with a human-readable name from `MEDICINE_NAME_MAP`.
    `build_display_frame()` then selects business-facing columns and rounds numeric values for console display.

14. `save_reorder_requests()` converts only the rows where `reorder` is true into a JSON payload.
    Order quantity is rounded up to an integer using `math.ceil()`. The payload is written to `data/monthly_reorder_requests.json` by default.

15. The function prints a table and returns the full policy DataFrame.
    The returned DataFrame is richer than the JSON file. It includes raw forecast components, weights, and numeric policy values.

### 2.2 Procurement Pipeline After Forecasting

The procurement batch path starts in [src/procurement_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/procurement_main.py), usually through `run_procurement_batch()` or `run_monthly_pipeline()`.

1. `run_procurement_batch()` calls `load_reorder_requests()`.
   The input file defaults to `data/monthly_reorder_requests.json`. If it does not exist, the function raises `FileNotFoundError` and instructs the caller to run the monthly inventory cycle first.

2. `load_reorder_requests()` reads JSON and normalizes it through `_normalize_reorder_payload()`.
   The loader accepts either a list of request dictionaries or a wrapper dictionary with a top-level `reorder_requests` list.

3. `process_reorder_requests()` loops over each normalized request.
   For every medicine, it builds a direct AI order plan using `_build_direct_ai_order_plan()`. This wraps the request into the shape expected by `procure()`.

4. `process_reorder_requests()` prints an inventory alert and then calls `procure()`.
   `procure()` is the gateway into the deterministic procurement engine.

5. `procure()` validates whether procurement is needed.
   It derives `required_units` from the plan, checks the `reorder` flag, and short-circuits with a `NO_ORDER_REQUIRED` result if no order should be placed.

6. If procurement is required, `procure()` builds:
   - `context`: pharmacy id, pharmacy location, allowed lead time, and AI order plan.
   - `order`: pharmacy id, medicine id, required units, and optionally requested units.

7. `procure()` instantiates:
   - `AuditLogger`
   - `FilterPipeline`
   - `ScoringEngine`
   - `ProcurementEngine`

8. The `FilterPipeline` is configured with three filters in order:
   - `nearest_filter`
   - `lead_time_filter`
   - `min_order_filter`

9. The `ScoringEngine` is configured with four criteria in order:
   - `distance_score`
   - `lead_time_score`
   - `rating_score`
   - `price_score`

10. `ProcurementEngine.process_order()` executes the actual decision sequence.
    It logs activation, applies each filter one by one, scores surviving distributors, chooses the top-ranked supplier, generates an explanation, generates a reflection, and returns the final result dictionary.

11. `process_reorder_requests()` converts each result into a much smaller procurement record.
    Only `pharmacy_id`, `medicine_id`, `order_quantity`, and `distributor_id` are preserved in the final batch payload.

12. `run_procurement_batch()` saves the procurement payload to `data/monthly_procurement_orders.json`.

### 2.3 The "Real-Time Inventory Monitoring" Path in This Repository

The repository does not implement a continuously running daemon, streaming listener, or event-driven monitor. The closest thing to real-time behavior is the on-demand decision path inside `procure()`.

That path works like this:

1. A caller invokes `procure()` for one medicine.
2. If the caller provides neither `ai_order_plan` nor explicit `required_units`, `procure()` imports and calls `calculate_ai_order_plan()` from [src/main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/main.py).
3. `calculate_ai_order_plan()` loads one demand series from `data/medicine_history.xlsx`, computes forecast and threshold values, and returns a plan.
4. `procure()` checks the plan's `reorder` flag.
5. If reorder is false, no supplier selection runs.
6. If reorder is true, the exact same deterministic procurement engine described above is used.

This means the codebase separates:

- A batch forecast-and-plan loop for many medicines.
- A just-in-time procurement decision for one medicine.

That separation is important when explaining the system. The code does not monitor live stock events. It evaluates stock only when an entry point is called.

## 3. Architecture Breakdown

### 3.1 Logical Architecture

The implemented system has six logical layers.

1. Data ingestion and normalization.
   Implemented mainly in [src/forecast.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/forecast.py). This layer reads Excel files, normalizes headers, cleans quantities, resolves sheets, groups duplicates, and converts demand into monthly time series.

2. Forecasting.
   Implemented in [src/forecast.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/forecast.py) for Holt-Winters and [src/prophet_model.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/prophet_model.py) for Prophet.

3. Inventory policy.
   Implemented in [src/inventory_policy.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/inventory_policy.py), [src/inventory_math.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/inventory_math.py), [src/main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/main.py), and [src/Holtphet.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/Holtphet.py). This is where reorder point, safety stock, threshold, and order quantity are computed.

4. Batch orchestration and payload generation.
   Implemented in [src/holtphet_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/holtphet_main.py). This layer turns raw model outputs into DataFrames and JSON payloads that the procurement stage can consume.

5. Procurement decision engine.
   Implemented in [src/procurement_main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/procurement_main.py) and the `src/engine/` package. This layer applies feasibility constraints, scores distributors, chooses a winner, and builds an audit narrative.

6. Optional AI explanation layer.
   Implemented in [src/engine/agent.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/engine/agent.py). This layer does not change the procurement decision. It explains or critiques the already-selected deterministic outcome.

### 3.2 Data Flow Diagram in Text Form

The primary batch flow can be described as:

`pharmacy_demand.xlsx`  
-> `forecast.load_demand_frame()`  
-> cleaned demand DataFrame  
-> `forecast.load_demand_by_medicine()`  
-> `{medicine_id: monthly demand series}`  
-> `forecast.forecast_by_medicine()` and `prophet_model.prophet_forecast_by_medicine()`  
-> `Holtphet.hybrid_inventory_policy_by_medicine()`  
-> policy DataFrame  
-> `holtphet_main.build_reorder_requests_payload()`  
-> `data/monthly_reorder_requests.json`  
-> `procurement_main.load_reorder_requests()`  
-> normalized reorder request records  
-> `procurement_main.procure()`  
-> `ProcurementEngine.process_order()`  
-> selected distributor result  
-> `data/monthly_procurement_orders.json`

The legacy single-medicine path is:

`data/medicine_history.xlsx`  
-> `forecast.load_demand_by_medicine()`  
-> one monthly series  
-> `main.calculate_ai_order_plan()`  
-> threshold-style order plan  
-> `procurement_main.procure()`  
-> `ProcurementEngine.process_order()`

### 3.3 Separation of Concerns

The codebase separates concerns reasonably well even though it is script-oriented:

- Data loading is isolated from forecasting logic.
- Forecasting is isolated from inventory policy math.
- Inventory policy is isolated from distributor selection.
- Distributor filtering is separated from distributor scoring.
- Logging and explanation are separated from the core decision rules.

There are also important architectural seams:

- The batch inventory cycle and the legacy single-medicine planner use different formulas and datasets.
- The procurement engine can run with or without the LLM layer.
- The procurement engine iterates filters manually instead of delegating to `FilterPipeline.apply()` because it wants richer stage-by-stage logs and rejection summaries.

### 3.4 Why This Architecture Was Chosen

This section is an architectural inference from the implementation rather than an explicit comment in the code.

The architecture appears to have been chosen for explainability and incremental evolution:

- Forecasting is split from procurement because reorder math and supplier choice are different business problems.
- A deterministic procurement core exists so decisions remain reproducible even without LLM access.
- The batch flow exists because multi-medicine forecasting is naturally a grouped operation over historical demand.
- The older single-medicine flow still exists because the project appears to have evolved from a simpler prototype rather than being rewritten from scratch.
- Sample distributors and hardcoded medicine metadata indicate the code is organized as a demonstrator or proof of concept, where clarity of flow mattered more than full backend integration.

## 4. Module-Level Deep Dive

### `src/forecast.py`

Purpose:
Central ingestion and Holt-Winters forecasting module. It is the canonical place where workbook data becomes cleaned monthly demand series.

Inputs and outputs:
- Input: Excel workbook path, optional sheet name, optional medicine id.
- Output: cleaned demand DataFrame, one monthly series, or a dictionary of per-medicine monthly series.
- Output: one-step-ahead monthly Holt forecast as a float.

Internal logic:
- Normalizes numeric quantities by removing commas and spaces.
- Searches for usable `date` and `quantity` column pairs, including suffixed pairs such as `date.1` and `quantity.1`.
- Resolves the appropriate worksheet, preferring `demand` when present.
- Drops invalid rows and groups duplicates.
- Reindexes every series to a full monthly start frequency and fills missing months with zero.
- Selects forecast model complexity based on series length.

Dependencies:
- `pandas`
- `statsmodels.tsa.holtwinters.ExponentialSmoothing`
- `statsmodels.tools.sm_exceptions.ConvergenceWarning`

Design decisions:
- The loader is intentionally tolerant of messy spreadsheet formats.
- Monthly reindexing with zero fill assumes missing months represent zero observed demand rather than missing data. That is a strong design assumption.
- The model-selection ladder keeps short histories forecastable without forcing seasonality on sparse data.

### `src/prophet_model.py`

Purpose:
Wraps Prophet forecasting and hides import/runtime noise.

Inputs and outputs:
- Input: one monthly demand series and an optional horizon, defaulting to one month.
- Output: dictionary with `prediction`, `lower`, `upper`, `model`, and `forecast_df`.
- Batch output: `{medicine_id: prophet_result}`.

Internal logic:
- Converts the series into Prophet's `ds` and `y` schema.
- Enables yearly seasonality and disables weekly and daily seasonality.
- Generates future dates at month-start frequency.
- Uses a 95 percent interval and returns the last predicted row.
- Short-circuits constant series by returning a fixed prediction with identical lower and upper bounds.

Dependencies:
- `pandas`
- `prophet.Prophet`
- `contextlib`, `io`, and `logging` for noise suppression

Design decisions:
- Import stdout and stderr are redirected to suppress noisy Prophet startup messages.
- Constant-series short-circuiting prevents unnecessary model fitting and avoids unstable behavior when the history is flat.
- Returning the full `model` and `forecast_df` keeps room for later visualization or diagnostics even though the current code mostly uses only the point prediction and interval.

### `src/inventory_policy.py`

Purpose:
Implements the older Prophet-only single-medicine inventory policy.

Inputs and outputs:
- Input: one Prophet forecast result and current stock.
- Output: dictionary containing forecast, sigma, safety stock, reorder point, target stock, reorder flag, and order quantity.

Internal logic:
- Reads `prediction`, `lower`, and `upper`.
- Estimates `sigma` as `(upper - lower) / 4`.
- Uses fixed service level `z = 1.65` and fixed lead time of `0.5` months.
- Computes expected demand during lead time, safety stock, reorder point, target stock, and reorder decision.

Dependencies:
- `math`

Design decisions:
- This module assumes a 95 percent Prophet interval maps approximately to a `4 * sigma` span.
- It uses a standard reorder-point formulation, which is simpler and more interpretable than optimization-based inventory control.

### `src/inventory_math.py`

Purpose:
Provides small reusable mathematical helpers for the older single-medicine planner.

Inputs and outputs:
- Input: raw demand arrays, forecast values, lead time, thresholds.
- Output: means, standard deviations, expected lead-time demand, safety stock, reorder point, and rounded thresholds.

Internal logic:
- Computes `mu` using `numpy.mean`.
- Computes `sigma` using `numpy.std`.
- Uses `scipy.stats.norm.ppf(0.95)` to derive the z-score once at import time.
- Rounds the new threshold to the nearest integer.

Dependencies:
- `numpy`
- `math`
- `scipy.stats.norm`

Design decisions:
- This module exists mainly to keep [src/main.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/main.py) readable.
- It reflects the original prototype's formula-based style before the batch hybrid path was added.

### `src/main.py`

Purpose:
Legacy single-medicine AI order planner.

Inputs and outputs:
- Input: optional medicine id, workbook path, current stock, lead time in days, old threshold.
- Output: dictionary with demand statistics, forecast, reorder point, new threshold, reorder flag, and required units.

Internal logic:
- Loads one demand series from `data/medicine_history.xlsx`.
- Forecasts next month with Holt-Winters via `forecast_next_month()`.
- Computes historical mean and standard deviation on raw demand values.
- Converts lead time from days to months.
- Calculates expected lead-time demand, safety stock, reorder point, rounded threshold, reorder flag, and rounded-up order quantity.

Dependencies:
- `numpy`
- local imports from `forecast.py` and `inventory_math.py`

Design decisions:
- This module uses the rounded reorder point as a threshold-like operational trigger.
- It predates the batch hybrid system and remains as a fallback order-plan generator for `procure()`.
- It mixes forecast-based and history-based statistics, which is simple but not fully consistent with the newer hybrid flow.

Important behavioral detail:
- `required_units` can be positive even when `reorder` is false, because `raw_order_qty` is computed independently of the reorder gate. `procure()` respects the `reorder` flag, so the positive quantity does not automatically lead to an order.

### `src/prophet_main.py`

Purpose:
Demonstration script for the Prophet-only inventory path.

Inputs and outputs:
- Input: `../data/medicine_history.xlsx` and hardcoded `CURRENT_STOCK = 85`.
- Output: console printout of Prophet-based inventory metrics.

Internal logic:
- Reads the `demand` sheet directly with `pandas`.
- Cleans headers and sorts dates.
- Builds one demand series from the `quantity` column.
- Calls `prophet_forecast()` and then `compute_inventory_policy()`.

Dependencies:
- `pandas`
- local imports from `prophet_model.py` and `inventory_policy.py`

Design decisions:
- This is a thin demo script, not an architectural core.
- It is useful mainly for validating the Prophet inventory calculation independently of the batch flow.

### `src/Holtphet.py`

Purpose:
Implements the newer hybrid inventory policy that combines Holt-Winters and Prophet outputs.

Inputs and outputs:
- Input: Holt forecast, Prophet result, current stock.
- Output: dictionary containing forecast weights, ensemble forecast, safety stock, reorder point, target stock, reorder flag, and order quantity.
- Batch output: DataFrame with one row per medicine.

Internal logic:
- Clamps negative forecasts to zero.
- Derives `sigma` either from `prophet_result["sigma"]` or from `(upper - lower) / 4`.
- Computes a Holt weight as `1 - sigma / abs(prophet_forecast)` clipped to `[0, 1]`, or `0.5` if the Prophet forecast is not positive.
- Builds an ensemble forecast from Holt and Prophet.
- Uses fixed service level `1.65` and fixed lead time `0.5` months.
- Calculates demand during lead time, safety stock, reorder point, target stock, and order quantity.

Dependencies:
- `math`
- `pandas`
- `collections.abc.Mapping`

Design decisions:
- Batch processing is implemented as a DataFrame builder because downstream reporting and JSON export are tabular.
- The function validates that the Holt and Prophet forecast sets contain identical medicine keys before combining them.

Important behavioral detail:
- The implemented weighting formula gives Holt more weight when Prophet uncertainty is low and less weight when Prophet uncertainty is high. That means very uncertain Prophet intervals can increase Prophet's influence rather than decrease it. This is the code's actual behavior and should be treated as a current limitation rather than an idealized uncertainty policy.

### `src/holtphet_main.py`

Purpose:
Primary batch inventory orchestrator for the repository.

Inputs and outputs:
- Input: optional current stock mapping, pharmacy id, reorder output path.
- Output: full policy DataFrame, console table, and reorder-request JSON file.

Internal logic:
- Resolves the dataset path from a candidate list.
- Loads one monthly series per medicine.
- Generates Holt and Prophet forecasts for every medicine.
- Builds a stock map from `MEDICINE_NAME_MAP` unless the caller provides one.
- Applies the hybrid policy and enriches results with display names.
- Builds a business-facing display DataFrame.
- Saves only reorderable items to JSON.

Dependencies:
- local modules `Holtphet`, `forecast`, `prophet_model`, and `procurement_data`
- `json`, `math`, and `pathlib`

Design decisions:
- The medicine catalog stores both display name and current stock. This keeps demos self-contained without requiring another source of operational stock data.
- `build_reorder_requests_payload()` rounds quantities up to integers because procurement payloads are treated as unit counts.
- Trigger reasons are generated in plain language here so the procurement layer can display them without recomputing policy numbers.

### `src/procurement_data.py`

Purpose:
Holds static configuration and sample procurement master data.

Inputs and outputs:
- Input: none at runtime beyond import.
- Output: default pharmacy metadata, file paths, sample distributors, sample request, and scoring weights.

Internal logic:
- Defines path constants for reorder and procurement JSON files.
- Defines a sample pharmacy id and location.
- Defines five sample distributors with distance-relevant coordinates, lead days, ratings, unit prices, and minimum order values.
- Defines default scoring weights.

Dependencies:
- `pathlib.Path`

Design decisions:
- This module centralizes all sample procurement configuration so the rest of the engine stays focused on decision logic.
- It is clearly demonstration data rather than production master data.

### `src/procurement_main.py`

Purpose:
Top-level procurement orchestrator and adapter between inventory outputs and the procurement engine.

Inputs and outputs:
- Input: distributors, pharmacy context, medicine id, required units, AI order plan, or reorder request payload.
- Output: one procurement result, one procurement batch payload, or one end-to-end monthly pipeline result.

Internal logic:
- Normalizes medicine ids for catalog lookup.
- Resolves medicine names from the batch inventory catalog if possible.
- Coerces quantity fields from several possible keys into one non-negative integer.
- Builds direct AI order plans when a caller provides reorder requests rather than a full plan.
- Prints inventory alerts and procurement summaries with Unicode-safe helpers.
- Loads and saves JSON payloads.
- Bridges batch reorder requests into repeated calls to `procure()`.
- Provides `run_monthly_pipeline()` to connect the batch inventory cycle with batch procurement.

Dependencies:
- local `engine` package
- local `main.py` for fallback AI order planning
- local `holtphet_main.py` for running the monthly inventory cycle

Design decisions:
- The module accepts multiple request shapes because the repository supports both direct single-medicine calls and file-based batch processing.
- It uses simplified procurement-order records in the final JSON, which makes the output compact but discards detailed reasoning unless the caller keeps the in-memory result.

Important behavioral detail:
- Running the file directly executes `run_procurement_batch()`, not `run_monthly_pipeline()`. That means `data/monthly_reorder_requests.json` must already exist.

### `src/engine/audit.py`

Purpose:
Simple audit logger used by the procurement engine.

Inputs and outputs:
- Input: free-form log messages.
- Output: printed console messages and an in-memory list of log lines.

Internal logic:
- Prepares stdout for UTF-8 if possible.
- Prints each log line.
- Falls back to manual encoding if the console cannot print Unicode cleanly.

Dependencies:
- `sys`

Design decisions:
- The audit trail is intentionally lightweight. It is just enough to support human inspection and downstream LLM explanation prompts.

### `src/engine/filters.py`

Purpose:
Defines supplier-feasibility filters and the filter pipeline container.

Inputs and outputs:
- Input: distributor lists, procurement context, and order.
- Output: filtered distributor lists.

Internal logic:
- `distance()` computes Euclidean distance between `(x, y)` coordinates.
- `nearest_filter()` keeps suppliers within a radius, default `50`.
- `lead_time_filter()` keeps suppliers whose `lead_days` are within the allowed maximum.
- `min_order_filter()` keeps suppliers where `required_units * price_per_unit >= min_order_value`.
- `FilterPipeline` stores filter callables and can apply them sequentially.

Dependencies:
- `math`

Design decisions:
- Filters are plain functions rather than classes, which keeps the feasibility rules very transparent.
- `min_order_filter()` prints a rejection message directly. `ProcurementEngine` wraps filter execution in `redirect_stdout()` so these raw prints do not leak into the final structured console flow.

### `src/engine/scoring.py`

Purpose:
Scores feasible distributors after filtering.

Inputs and outputs:
- Input: one distributor, context, and order.
- Output: one scalar total score and a logged breakdown.

Internal logic:
- `distance_score()` returns `1 / (distance + 1)`.
- `lead_time_score()` returns `1 / (lead_days + 1)`.
- `rating_score()` returns `rating / 5`.
- `price_score()` returns `1 / (price_per_unit + 1)`.
- `ScoringEngine.score()` multiplies each raw criterion by its configured weight, accumulates the total, and logs a breakdown.

Dependencies:
- local `distance()` from `filters.py`

Design decisions:
- Weighted additive scoring keeps supplier selection interpretable.
- Normalizations are simple monotonic transforms rather than learned scores, which suits a prototype where transparency matters more than calibration.

Important behavioral detail:
- `ProcurementEngine` captures the detailed scoring logs instead of writing them into the visible audit trail. The visible audit log shows ranked suppliers but not the raw criterion-level breakdown.

### `src/engine/agent.py`

Purpose:
Optional LLM adapter for procurement narration.

Inputs and outputs:
- Input: audit logs, procurement context, order data, and decision summaries.
- Output: natural-language reasoning strings or reflections.

Internal logic:
- Loads `.env` from the repository root.
- Reads `GROQ_API_KEY`.
- Uses the `openai` client against Groq's OpenAI-compatible base URL.
- Defines prompt templates that explicitly prohibit chain-of-thought disclosure.
- Provides methods for brief step narration, decision reasoning, reflection, and suggested future actions.

Dependencies:
- `dotenv.load_dotenv`
- `openai.OpenAI`
- `os`, `json`, and `pathlib`

Design decisions:
- The agent is deliberately non-authoritative. It explains a deterministic outcome; it does not choose the supplier.
- The prompts enforce a rigid output format for decision reasoning so the procurement engine can parse the sections safely.

Important behavioral detail:
- `generate_reflection()` and `suggest_actions()` exist but are not currently used by `ProcurementEngine`. The engine instead calls `reflect()`, which uses a different prompt style.

### `src/engine/procurement_engine.py`

Purpose:
Core procurement decision engine and the most structured orchestration module in the repository.

Inputs and outputs:
- Input: list of distributors, configured filter pipeline, scoring engine, audit logger, context, and order.
- Output: selected distributor result with status, reasoning, reflection, and audit log.

Internal logic:
- Tries to initialize `ProcurementAgent`. If that fails for any reason, `self.agent` becomes `None` and deterministic fallback text is used.
- Builds supplier summaries for logging and for prompt inputs.
- Sanitizes LLM outputs to strip incomplete sentences and remove repeated section labels.
- Runs each filter as its own logged stage and records which distributors were removed.
- Scores remaining distributors and ranks them descending by total score.
- Builds deterministic fallback explanations and reflections.
- If LLM calls succeed, replaces fallback text with cleaned agent outputs.
- Returns the winning distributor plus audit metadata.

Dependencies:
- `io`, `re`, and `contextlib.redirect_stdout`
- optional import of `engine.agent.ProcurementAgent`

Design decisions:
- The engine manually iterates filters rather than using `FilterPipeline.apply()` so it can report stage titles, rejection reasons, and shortlist changes in detail.
- The LLM layer is wrapped in aggressive fallback logic so procurement remains functional under missing keys, network problems, or model failures.

Important behavioral detail:
- If all suppliers are filtered out, the function returns `{"error": "No valid distributors found"}` rather than a standardized result dictionary. Callers therefore need to handle this shape separately.

### `src/engine/__init__.py`

Purpose:
Convenience re-export module for procurement engine components.

Inputs and outputs:
- Input: none.
- Output: imported symbols for easier package-level access.

Internal logic:
- Re-exports `AuditLogger`, `FilterPipeline`, filters, `ProcurementEngine`, `ScoringEngine`, and scoring functions.

Dependencies:
- local engine modules

Design decisions:
- This file exists for package ergonomics only. It contains no business logic.

### `data/generator.py`

Purpose:
Synthetic demand generator used to create a multi-medicine monthly workbook.

Inputs and outputs:
- Input: no external input beyond fixed constants and the random seed.
- Output: `synthetic_pharmacy_demand.xlsx`.

Internal logic:
- Seeds NumPy with `42`.
- Creates 50 medicine ids from `MED001` to `MED050`.
- Generates monthly dates from January 2018 through December 2025.
- Applies a hand-written seasonality function with peaks in July and August and lows in March and April.
- Adds medicine-specific base demand, trend, and volatility.
- Rounds demand to non-negative integers and writes the data to Excel.

Dependencies:
- `numpy`
- `pandas`

Design decisions:
- The generator encodes obvious seasonal behavior so the forecasting models have patterns to detect.
- The output filename has no explicit directory prefix, so the actual save location depends on the current working directory when the script runs.

### Repository Artifacts That Matter But Are Not Runtime Code

`pharmacy_demand.xlsx`
- Primary batch dataset in the current repository state.
- Runtime probe results show 4,800 rows, 50 medicines, and monthly dates from 2018-01-01 through 2025-12-01.
- This file is the one selected by the batch pipeline because it matches the first dataset candidate name.

`data/medicine_history.xlsx`
- Legacy single-series workbook used by `main.py` and `prophet_main.py`.
- After cleaning through `forecast.load_demand_frame()`, it becomes a 36-row monthly series from 2022-01-01 through 2024-12-01.
- The active data lives in `date.1` and `quantity.1`, while some leading columns are effectively inactive.

`data/Montly.csv`
- Unused by all runtime modules.
- Contains 70 rows of category-level data with columns such as `M01AB`, `M01AE`, `N02BA`, and others.
- It appears to be a reference dataset or experimentation artifact, not part of the implemented execution path.

`fixes.md`
- Non-executable summary of the project's recent evolution.
- Its statements align with the current batch-medicine implementation and are useful as change context, but the runtime behavior must still be taken from source code.

`brainstorm.md`
- Non-executable ideation document describing future ambitions such as MongoDB event extraction, unit conversion, priority classes, and budget constraints.
- Most of those ideas are not yet implemented in the code.

`.env`
- Not inspected here for secrets.
- The code expects it at the repository root and uses it only for `GROQ_API_KEY`.

## 5. Core Algorithms and Mathematical Models

### 5.1 Forecasting

#### Holt-Winters in `forecast_next_month()`

Implemented model-selection logic:

- If history length `n >= 24`:
  - First try `ExponentialSmoothing(series, trend="add", seasonal="mul", seasonal_periods=12)`.
  - If that fails with `ValueError`, retry with `seasonal="add"`.
- If `6 <= n < 24`:
  - Use `ExponentialSmoothing(series, trend="add", seasonal=None)`.
- If `n < 6`:
  - Return `max(mean(series), 0)`.

The intuition is:

- Long monthly histories can support a 12-month seasonal pattern.
- Medium histories can support a trend estimate but not stable seasonality.
- Very short histories are too sparse for model fitting, so the code falls back to a non-negative average.

Why this was used instead of more complex alternatives:

This is an implementation inference. The code favors Holt-Winters because it is simple, explainable, fast for one-step monthly forecasting, and well suited to smooth level, trend, and seasonality patterns. There is no evidence in the repository of ARIMA selection, machine-learning regressors, or intermittent-demand methods such as Croston's method.

#### Prophet in `prophet_forecast()`

Implemented settings:

- `yearly_seasonality=True`
- `weekly_seasonality=False`
- `daily_seasonality=False`
- `interval_width=0.95`
- future frequency `MS` for month start

The intuition is:

- The system works on monthly demand series, so yearly seasonality is the only relevant calendar cycle in the code.
- Prophet provides both a point estimate and an uncertainty interval, which the inventory layer uses to approximate variability.

Formula-like summary:

- Point forecast: `prediction = yhat(t+1)`
- Lower bound: `lower = yhat_lower(t+1)`
- Upper bound: `upper = yhat_upper(t+1)`
- Estimated standard deviation in inventory modules: `sigma ~= (upper - lower) / 4`

Why this was used instead of alternatives:

Again, this is inferred from code. Prophet gives interval outputs with little custom feature engineering and is convenient for business-facing monthly demand forecasting. The code seems to use Prophet mainly as an uncertainty-aware companion to Holt-Winters rather than as the sole forecast authority.

#### Ensemble Logic in `Holtphet.hybrid_inventory_policy()`

Implemented formulas:

- `forecast_hw = max(hw_forecast, 0)`
- `forecast_prophet = max(prophet_result["prediction"], 0)`
- `sigma = prophet_result["sigma"]` if present, else `(upper - lower) / 4`, else `0`
- If `forecast_prophet <= 0`, `weight_hw = 0.5`
- Else `weight_hw = clip(1 - sigma / abs(forecast_prophet), 0, 1)`
- `weight_prophet = 1 - weight_hw`
- `ensemble_forecast = weight_hw * forecast_hw + weight_prophet * forecast_prophet`

The intuition of the intended design is clear: combine a classical time-series forecast with a probabilistic forecast. However, the exact implemented formula matters more than the intended narrative. As coded, the ensemble trusts Holt more when Prophet's interval-derived sigma is small and trusts Prophet more as sigma grows. That directional behavior should be explained honestly because it affects the real system.

Why ensemble forecasting is used:

This is an inference from the implemented structure. The repository appears to use an ensemble to avoid single-model dependence:

- Holt-Winters contributes a classical signal driven by level, trend, and seasonality.
- Prophet contributes a separate forecast plus interval bounds.
- The hybrid policy then converts those outputs into one downstream operational forecast.

### 5.2 Inventory Model

There are two inventory models in the repository.

#### Legacy Threshold Model in `main.py`

Implemented formulas:

- `lead_time_months = lead_time_days / 30`
- `forecast = forecast_next_month(demand_series)`
- `mu = mean(demand)`
- `sigma = std(demand)`
- `expected_lt = forecast * lead_time_months`
- `safety_stock = Z * sigma * sqrt(lead_time_months)` where `Z = norm.ppf(0.95)`
- `reorder_point = expected_lt + safety_stock`
- `new_threshold = round(reorder_point)`
- `reorder = current_stock < new_threshold`
- `raw_order_qty = max(0, forecast + safety_stock - current_stock)`
- `required_units = ceil(raw_order_qty)`

Intuition:

- Expected lead-time demand covers what will likely be consumed while replenishment is in transit.
- Safety stock covers demand uncertainty.
- The rounded reorder point becomes an operational threshold.
- Order quantity tries to bring stock up to approximately one forecast cycle plus a safety buffer.

Important caveat:

This model does not order up to `forecast + expected_lt + safety_stock`. It uses `forecast + safety_stock - current_stock`. That is simpler than the hybrid model and operationally different.

#### Hybrid Batch Model in `Holtphet.py`

Implemented formulas:

- `lead_time = 0.5`
- `service_z = 1.65`
- `demand_during_lead_time = ensemble_forecast * lead_time`
- `safety_stock = service_z * sigma * sqrt(lead_time)`
- `rop = demand_during_lead_time + safety_stock`
- `target_stock = ensemble_forecast + demand_during_lead_time + safety_stock`
- `reorder = current_stock < rop`
- `order_qty = max(0, target_stock - current_stock)` if reorder else `0`

Intuition:

- Reorder point protects the pipeline period.
- Target stock covers the coming cycle plus lead-time demand plus uncertainty.
- `reorder` acts like a continuous-review-style control rule: whenever stock drops below the reorder point, replenish toward a target.

Why this approach is used instead of alternatives:

This is an inference from the code. A reorder-point plus order-up-to policy is easier to explain to pharmacists and judges than optimization-heavy models such as stochastic dynamic programming or multi-echelon optimization. The code prioritizes an interpretable operational rule over a globally optimal policy.

### 5.3 Procurement Logic

The procurement layer uses a two-stage algorithm.

#### Stage 1: Hard Constraints

Filters applied in order:

1. Distance filter:
   - Keep distributor if `euclidean_distance(distributor.location, pharmacy.location) <= 50`

2. Lead-time filter:
   - Keep distributor if `distributor.lead_days <= max_lead_days`

3. Minimum-order filter:
   - Keep distributor if `required_units * price_per_unit >= min_order_value`

Intuition:

- Do not score infeasible suppliers.
- Keep business rules explicit and auditable.
- Reduce the ranking problem to a shortlist of viable candidates.

#### Stage 2: Weighted Additive Scoring

Default weights from [src/procurement_data.py](/c:/Users/Vishruth/Desktop/ai-engine-medical-supply-engine/src/procurement_data.py):

- `distance = 0.30`
- `lead_time = 0.30`
- `rating = 0.25`
- `price = 0.15`

Raw scoring formulas:

- `distance_score = 1 / (distance + 1)`
- `lead_time_score = 1 / (lead_days + 1)`
- `rating_score = rating / 5`
- `price_score = 1 / (price_per_unit + 1)`

Total score:

- `total_score = 0.30 * distance_score + 0.30 * lead_time_score + 0.25 * rating_score + 0.15 * price_score`

Winning rule:

- Select the distributor with the maximum total score after filtering.

Why this approach is used instead of alternatives:

This is again an inference from code. A weighted additive model is easier to defend in a technical review than opaque optimization or learned ranking. Every criterion is transparent, every weight is visible, and trade-offs are understandable from the logs.

## 6. Data Model and Pipeline

### 6.1 Input Dataset Structures

Primary batch dataset:

- File: `pharmacy_demand.xlsx`
- Observed shape from runtime probe: 4,800 rows
- Columns: `date`, `medicine_id`, `quantity`
- Date range: 2018-01-01 to 2025-12-01
- Distinct medicines: 50

Legacy single-series dataset:

- File: `data/medicine_history.xlsx`
- Sheet: `demand`
- Raw columns: `date`, `medicine_id`, `medicine_name`, `quantity`, `date.1`, `quantity.1`
- Cleaned output shape through `load_demand_frame()`: 36 rows with columns `date`, `quantity`
- Date range after cleaning: 2022-01-01 to 2024-12-01

Reference dataset not used by runtime:

- File: `data/Montly.csv`
- Columns: `datum`, `M01AB`, `M01AE`, `N02BA`, `N02BE`, `N05B`, `N05C`, `R03`, `R06`

### 6.2 Normalized Internal Structures

Cleaned demand frame:

- Batch shape:
  - `medicine_id: string`
  - `date: datetime64`
  - `quantity: numeric`
- Single-series fallback shape:
  - `date: datetime64`
  - `quantity: numeric`

Per-medicine demand map:

- Python type: `dict[str, pandas.Series]`
- Series index: month-start `DatetimeIndex`
- Series values: float demand quantities

Prophet forecast result:

- `prediction: float`
- `lower: float`
- `upper: float`
- `model: Prophet or None`
- `forecast_df: pandas.DataFrame or None`

Hybrid policy DataFrame:

- `medicine_id`
- `current_stock`
- `hw_forecast`
- `prophet_forecast`
- `weight_hw`
- `weight_prophet`
- `ensemble_forecast`
- `safety_stock`
- `rop`
- `target_stock`
- `reorder`
- `order_qty`
- plus `medicine_name` after enrichment

Reorder request payload:

```json
{
  "pharmacy_id": "PHARM-001",
  "reorder_requests": [
    {
      "pharmacy_id": "PHARM-001",
      "medicine_id": "MED001",
      "medicine_name": "Paracetamol 500 mg",
      "current_stock": 120.0,
      "required_stock": 220.0,
      "order_quantity": 100,
      "trigger_reason": "Current stock 120.0 is below the reorder point of 150.0."
    }
  ]
}
```

The numeric values above illustrate shape only. Actual rows depend on the forecast outputs.

Distributor record shape:

- `id`
- `name`
- `location`
- `lead_days`
- `rating`
- `price_per_unit`
- `min_order_value`

Procurement result shape from `procure()`:

- `pharmacy_id`
- `medicine_id`
- `distributor_id`
- `distributor_name`
- `quantity`
- `order_quantity`
- `status`
- `audit_log`
- `agent_reasoning`
- `ai_order_plan`
- `reflection`

Saved procurement batch payload:

```json
{
  "pharmacy_id": "PHARM-001",
  "procurement_orders": [
    {
      "pharmacy_id": "PHARM-001",
      "medicine_id": "MED001",
      "order_quantity": 40,
      "distributor_id": "D001"
    }
  ]
}
```

### 6.3 Transformations at Each Stage

The data transformations are:

1. Raw workbook to cleaned frame.
   Header normalization, sheet resolution, numeric cleaning, null dropping, grouping, sorting.

2. Cleaned frame to monthly series.
   Grouping by medicine, setting date index, sorting, monthly reindexing, zero filling.

3. Monthly series to forecast values.
   Holt-Winters point forecast plus Prophet point and interval forecast.

4. Forecast values to inventory policy rows.
   Ensemble weighting, safety stock, reorder point, target stock, reorder decision, order quantity.

5. Policy rows to reorder payload.
   Filter only reorder candidates, round quantity up to integers, attach trigger reason.

6. Reorder payload to procurement context.
   Normalize request schema, coerce units, build one plan per medicine.

7. Procurement context to selected supplier.
   Apply hard constraints, score survivors, pick top supplier, attach explanation and reflection.

8. Selected supplier results to saved procurement orders.
   Downsample rich in-memory results into a compact JSON artifact.

## 7. Real-Time Decision Engine

The repository's real-time decision engine is really an on-demand decision engine.

### 7.1 How Stock Is Monitored

Stock is not monitored through subscriptions, event streams, or polling loops. Instead, stock is provided to decision functions in one of two ways:

- In the batch hybrid flow, `holtphet_main.build_current_stock_map()` pulls current stock from the hardcoded `MEDICINE_NAME_MAP`.
- In the legacy single-medicine flow, `main.calculate_ai_order_plan()` receives `current_stock` as a function argument with a default of `85`.

This means stock observation is snapshot-based.

### 7.2 Trigger Conditions

There are two trigger formulations in the codebase.

Batch hybrid trigger:

- `reorder = current_stock < rop`

Legacy trigger:

- `reorder = current_stock < new_threshold`
- where `new_threshold = round(reorder_point)`

Batch procurement trigger:

- `procure()` respects the incoming plan's `reorder` flag.
- If `reorder` is false or derived required units are zero, the function returns a `NO_ORDER_REQUIRED` response and does not evaluate suppliers.

### 7.3 Order Generation Logic

Batch hybrid path:

- Compute `order_qty = target_stock - current_stock` when reorder is true.
- Convert to integer `order_quantity = ceil(order_qty)` before saving JSON.

Legacy path:

- Compute `raw_order_qty = forecast + safety_stock - current_stock`.
- Convert to integer `required_units = ceil(raw_order_qty)`.

Procurement path:

- `_coerce_required_units()` reads quantity from `required_units`, `order_quantity`, `quantity`, or fallback input.
- The result is always a non-negative integer.

### 7.4 Edge Case Handling in the Decision Engine

- If there is no reorder, procurement is short-circuited cleanly.
- If no suppliers survive the filter stages, procurement halts and returns an error dictionary.
- If the LLM layer fails, deterministic fallback reasoning and reflection are returned.
- If the reorder-request file is missing, procurement batch execution fails early with a clear `FileNotFoundError`.

## 8. Unit Conversion and Constraints Handling

### 8.1 Packaging Logic

The code does not currently implement real package-conversion logic.

All demand and stock values are treated as scalar units:

- The forecasting layer operates on plain numeric `quantity`.
- The inventory layer computes plain numeric `order_qty`.
- The procurement layer coerces order quantities to non-negative integers.

There is no implemented handling for:

- packs versus loose tablets
- base quantity versus subquantity
- dosage-form-specific units
- bottle sizes
- carton multiples
- procurement pack constraints

This gap matters because `brainstorm.md` explicitly mentions future unit-conversion logic, but that logic is not present in the executable code.

### 8.2 Rounding Strategies

Implemented rounding behavior:

- Display DataFrame values are rounded to two decimal places for presentation.
- Reorder quantities are rounded up using `math.ceil()`.
- The legacy reorder threshold is rounded using Python `round()`.
- Current stock and target stock in saved payloads are rounded to two decimals.

Operational effect:

- Procurement always orders whole-unit counts.
- Very small positive order quantities become one unit.
- Threshold rounding in the legacy path can shift reorder timing by up to half a unit.

### 8.3 Real-World Constraints That Are Implemented

- Maximum supplier distance through `nearest_filter`
- Maximum lead time through `lead_time_filter`
- Minimum order value through `min_order_filter`
- Non-negative demand forecasts via `max(..., 0.0)`
- Matching forecast universes between Holt and Prophet before combining
- Explicit file existence checks for reorder JSON input

### 8.4 Real-World Constraints That Are Not Implemented

- Supplier capacity
- Expiry dates or shelf life
- Pharmacy budget caps
- Split-order optimization across multiple suppliers
- Backorder handling
- Purchase-order approval workflow
- Package-size multiples
- Inventory position tracking with outstanding purchase orders
- Service levels by medicine class
- Lead-time uncertainty inside the inventory formula

## 9. System Design Decisions

### 9.1 Why a Continuous-Review-Style Model Was Chosen

This is an inference from the implemented rules.

Both inventory paths compare current stock to a threshold whenever the calculation is invoked. That is the defining characteristic of a continuous-review-style control rule. The code does not wait for a fixed periodic review bucket before deciding. Instead, it says: if stock is below the reorder threshold now, place an order now.

This choice makes sense for a pharmacy setting because:

- Stockout risk matters more than strictly periodic ordering.
- The formulas are easy to explain operationally.
- Reorder points naturally combine forecast, lead time, and uncertainty.

The current repository still runs in a script-triggered way, so the review is conceptually continuous but operationally invoked manually or by an outer scheduler.

### 9.2 Why Ensemble Forecasting Is Used

This is also an inference from the code structure.

The system appears to use an ensemble because no single forecast model is trusted absolutely:

- Holt-Winters captures smooth level, trend, and seasonality.
- Prophet supplies an alternative point forecast and an interval.
- The hybrid policy converts both into one operational forecast.

From an architectural perspective, this is useful because inventory decisions are expensive. Using two models reduces dependence on one modeling assumption.

However, the current uncertainty-weighting formula should be explained carefully. The implemented logic does not simply "downweight uncertain Prophet forecasts." It computes Holt's weight from Prophet's sigma in a way that can increase Prophet's influence when sigma grows. That is the actual design as coded.

### 9.3 Why Inventory Position Is Used Instead of Stock

The correct answer for this repository is: inventory position is not used.

The code consistently uses current stock:

- `current_stock < rop` in the hybrid batch path
- `current_stock < new_threshold` in the legacy path
- procurement requests carry `current_stock` and `required_stock`, not on-order inventory

Why this matters:

- Inventory position would normally equal on-hand plus on-order minus backorders.
- Using only current stock can trigger unnecessary orders if replenishment is already in transit.
- The current implementation is therefore simpler but less operationally accurate than a full inventory-position model.

If this topic comes up in a technical review, the correct explanation is that inventory-position logic is a future enhancement, not a current feature.

### 9.4 Why the Forecast Loop and Procurement Loop Are Separate

The separation is explicit in the code:

- Forecasting and inventory planning produce reorder requests.
- Procurement consumes reorder requests and selects suppliers.

This separation exists for good architectural reasons:

- Forecasting can run in batch over many medicines.
- Procurement can run only for flagged items.
- Supplier-selection rules can evolve independently of forecasting logic.
- Reorder requests become a clean handoff artifact between planning and execution.

This separation also allows the optional AI explanation layer to sit only on the procurement side, where human-readable justification is most useful.

### 9.5 Why the Procurement Core Is Deterministic First

The code goes out of its way to keep LLM output non-authoritative:

- `ProcurementEngine` picks the supplier through filters and weighted scoring.
- `ProcurementAgent` only explains the result or reflects on it.
- Any agent initialization or API failure falls back to deterministic reasoning text.

This design is appropriate for auditability. The selected supplier can always be traced back to explicit constraints and weights.

## 10. Edge Cases and Failure Handling

### 10.1 Demand Spikes

What the code does:

- Historical spikes feed directly into Holt-Winters and Prophet because there is no outlier removal.
- Prophet can widen its interval, which increases the derived `sigma`.
- Safety stock therefore increases when `sigma` increases.

What the code does not do:

- No anomaly detection
- No promotion flags
- No manual overrides
- No demand decomposition diagnostics

Practical implication:

- The system is somewhat protected by higher safety stock, but it can still overreact to one-off spikes because all observations are treated as valid demand.

### 10.2 Low Demand or Constant Demand

Implemented handling:

- `forecast_next_month()` returns the mean for very short series.
- `prophet_forecast()` bypasses model fitting when all values are equal and returns a constant prediction with zero interval width.
- Negative forecasts are clamped to zero.

Practical implication:

- The code can handle flat or weak-demand series without crashing.
- It is not specialized for intermittent demand, which is common in pharmacy inventories for slow movers.

### 10.3 Lead Time Variation

Implemented handling:

- Inventory formulas use a fixed lead time in the batch flow (`0.5` months).
- The legacy flow uses user-supplied lead time converted from days to months.
- Procurement filters each supplier by fixed `lead_days`.

Not implemented:

- Lead-time distributions
- Supplier reliability history
- Expedited shipping options
- Lead-time uncertainty inside safety-stock calculations

Practical implication:

- The system handles deterministic lead times only.

### 10.4 Data Inconsistencies

Implemented handling:

- Missing or malformed sheet names raise explicit errors.
- Invalid dates and numeric quantities are coerced to null and then dropped.
- Duplicate rows are aggregated by date and medicine.
- Missing months are inserted as zeros.
- Empty series raise explicit `ValueError`.
- Missing medicines raise `KeyError` or `ValueError` depending on call path.

Not implemented:

- Outlier validation
- Negative-demand investigation
- Cross-checking current stock against demand history
- Schema versioning

### 10.5 Forecast Mismatch or Model Failure

Implemented handling:

- `hybrid_inventory_policy_by_medicine()` validates that the Holt and Prophet medicine sets match exactly.
- Holt-Winters seasonal multiplicative failure falls back to additive seasonality.
- Convergence warnings are suppressed during Holt-Winters fitting.
- Prophet startup logs are suppressed.

### 10.6 Procurement Failures

Implemented handling:

- Missing reorder JSON file raises `FileNotFoundError`.
- No suppliers surviving the filter stages returns an error dictionary.
- Missing `GROQ_API_KEY`, network issues, or LLM call problems do not stop procurement; the engine uses fallback text.
- Unicode console printing failures are handled explicitly in both `AuditLogger` and `_print_line()`.

## 11. Limitations and Future Improvements

### 11.1 Current System Constraints

- The codebase contains two inventory paradigms that are not fully unified.
- Current stock is hardcoded in a Python dictionary for the batch flow.
- The legacy fallback planner uses a different dataset and different order-quantity logic from the batch hybrid planner.
- Inventory position is not modeled.
- Unit conversion and package constraints are not modeled.
- Distributor data is static and sample-sized.
- Final procurement batch JSON discards rich reasoning and status details.
- There are no tests, no dependency manifest, and no API/service wrapper.
- `data/Montly.csv` is unused and may confuse future maintainers about the real data path.

### 11.2 Specific Technical Weaknesses Visible in the Code

- The hybrid weight formula behaves counterintuitively with respect to Prophet uncertainty.
- `main.calculate_ai_order_plan()` can produce positive `required_units` while `reorder` is false.
- `procurement_main.procure()` relies on `main.py` as a fallback planner, which ties modern procurement to the legacy dataset unless the caller passes a plan explicitly.
- `ProcurementEngine.process_order()` returns a non-standard error shape when no suppliers survive filtering.
- Detailed scoring breakdowns are not included in the returned audit log.
- The procurement engine selects a single best supplier only. It cannot split an order.

### 11.3 Real-World Enhancements That Fit the Existing Architecture

- Replace hardcoded stock maps with live inventory snapshots from a database.
- Replace static sample distributors with supplier master data and historical performance metrics.
- Use inventory position instead of only on-hand stock.
- Add purchase-order state so in-transit stock suppresses duplicate reorders.
- Add pack-size and dosage-form conversion logic.
- Add budget constraints and supplier capacity.
- Calibrate or redesign the ensemble-weight formula.
- Add backtesting and forecast accuracy measurement.
- Expose the batch flow and procurement flow through an API instead of scripts.
- Preserve full procurement results, not just simplified order records.

### 11.4 Future Work Already Foreshadowed by Repository Notes

`brainstorm.md` points toward a more ambitious architecture:

- Extract demand from raw pharmacy stock events rather than spreadsheets.
- Build true monthly demand from inventory movement logic.
- Implement dosage-form-aware unit conversion.
- Add budget and preferred-distributor logic.

Those ideas fit the current layered architecture, but they are not yet present in executable code.

## 12. Developer Mental Model

The most useful way to think about this system is as a four-stage operational pipeline with one optional narrative layer.

Stage 1: Build a trustworthy monthly demand signal.
- Everything downstream assumes the monthly series is meaningful.
- If the series is wrong, the forecast, reorder point, and procurement decision will all be wrong.

Stage 2: Produce one operational demand forecast per medicine.
- The batch path does this with Holt-Winters plus Prophet.
- The legacy path does this with Holt-Winters plus historical variance statistics.

Stage 3: Convert forecast into a replenishment decision.
- The crucial outputs are `reorder`, `rop`, `target_stock`, and order quantity.
- These are the business handoff variables.

Stage 4: Convert replenishment need into supplier choice.
- Procurement is not trying to re-evaluate demand.
- It assumes the order quantity is already justified and focuses on feasibility plus supplier trade-offs.

Optional layer: Explain the deterministic supplier choice in natural language.
- This helps presentation and auditability.
- It does not own the decision.

### 12.1 Key Invariants and Assumptions

- Demand time series are monthly and aligned to month start.
- Missing months are treated as zero demand, not unknown demand.
- Forecasts and stock values are treated as non-negative.
- The batch hybrid flow expects one demand series per medicine id.
- Procurement scoring occurs only after hard feasibility filters.
- Current stock is treated as the operational inventory signal.
- Procurement quantities are always whole numbers by the time they are saved.

### 12.2 Common Pitfalls

- Confusing the legacy single-medicine path with the newer batch path.
- Assuming `procurement_main.py` automatically runs the monthly forecast first when executed directly.
- Assuming inventory position, pack conversion, or budget constraints already exist.
- Forgetting that the batch inventory path uses `pharmacy_demand.xlsx` at the repo root, while the legacy path uses `data/medicine_history.xlsx`.
- Assuming the LLM chooses the supplier. It does not.
- Assuming `FilterPipeline.apply()` is the active execution path. `ProcurementEngine` manually iterates filters instead.

### 12.3 What to Change First If You Extend the System

If the goal is operational realism, the first high-value changes are:

1. Unify the batch and legacy inventory models so procurement uses one authoritative planner.
2. Replace hardcoded stock and distributor inputs with persistent data sources.
3. Introduce inventory position and purchase-order state.
4. Add pack-size conversion and dosage-form handling.
5. Fix or redesign the hybrid forecast-weighting rule.

## 13. Presentation Explanation Layer

If this system needs to be explained to a technical jury, the strongest narrative is not "we built a few formulas." The correct story is:

This repository implements a full decision chain from demand history to procurement action.

1. It starts by cleaning demand data into a consistent monthly signal.
   The system is robust to more than one spreadsheet layout, and it explicitly reconstructs a complete monthly time axis before forecasting.

2. It then forecasts demand with two different models.
   One model is classical time-series smoothing. The other is Prophet, which also supplies uncertainty intervals. The system does not rely on one model blindly.

3. It translates forecast uncertainty into operational inventory rules.
   Instead of predicting demand and stopping there, it computes safety stock, reorder point, target stock, and the actual reorder quantity that operations would need.

4. It turns inventory shortage into procurement execution.
   Once a medicine needs replenishment, the code filters infeasible suppliers, scores the remaining suppliers on explicit criteria, and chooses the best one transparently.

5. It can explain its procurement choice in plain language.
   The deterministic decision is wrapped with an audit trail and optional AI narration, which is useful for presentations, reviews, and stakeholder communication.

### 13.1 Key Innovation Points to Emphasize

- The system spans forecasting, inventory policy, and procurement in one chain.
- The batch path works medicine by medicine rather than assuming one generic demand stream.
- The procurement engine is explainable by construction because filters, weights, and rankings are explicit.
- The LLM layer is attached as an explanation tool, not as an unbounded decision-maker.

### 13.2 Why This Is Better Than Traditional Manual Pharmacy Practice

The code should be compared to spreadsheet-driven or intuition-driven practice, not to a mature enterprise ERP.

Compared with manual thresholding and ad hoc supplier choice, this system is stronger because it:

- uses historical monthly demand instead of gut feel
- converts uncertainty into safety stock explicitly
- standardizes reorder logic across medicines
- standardizes supplier choice through visible constraints and weights
- produces machine-readable outputs that can be integrated with other systems

### 13.3 Real-World Impact

If extended into a production system, the architecture could reduce:

- stockouts caused by underestimating lead-time demand
- overstock caused by fixed manual thresholds
- inconsistent supplier choice across pharmacists or buyers
- procurement decisions that cannot be justified later

The repository is not yet a complete live pharmacy platform, but it already demonstrates the full reasoning arc a real platform would need:

historical demand  
-> forecast  
-> inventory policy  
-> reorder request  
-> supplier selection  
-> audit explanation

That is the correct mental and presentation model for this codebase.
