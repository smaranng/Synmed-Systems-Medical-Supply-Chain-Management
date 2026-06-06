# Hybrid Procurement Validation Report

Generated: 2026-04-06T17:57:40.608864+00:00

## Pass/Fail Summary

- Total tests: 4
- Passed: 4
- Failed: 0

## Test Matrix

| Test | Dataset | Status | Budget Utilization (%) | Total Priority | Risk Violations | Skipped |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Test 1: Small controlled dataset | Controlled | PASS | 100.00 | 1.0000 | 0 | 2 |
| Test 2: Critical medicines | Controlled | PASS | 92.86 | 1.8050 | 0 | 0 |
| Test 3: Budget constraint | Real backend data | PASS | 96.82 | 7.1204 | 0 | 2 |
| Test 4: Multi-cycle behavior | Controlled | PASS | 85.00 | 1.7750 | 0 | 1 |

## Detailed Results

### Test 1: Small controlled dataset

- Dataset: Controlled
- Objective: Verify 0/1 knapsack correctness against brute-force ground truth.
- Status: PASS
- Total cost: 100.00
- Total priority: 1.0000

| Metric | Value |
| --- | ---: |
| budget_utilization | 100.00 |
| total_priority_selected | 1.0000 |
| stockout_risk_violations | 0 |
| number_of_skipped_medicines | 2 |
| selected_count | 2 |

**Assertions**

- Brute-force optimum for the controlled candidate set matches the hybrid allocator output.
- Total selected cost stays within the configured budget.
- The control dataset remains non-critical so the test isolates knapsack correctness.

**Selected Medicines**

- VAL003 - Controlled Steroid C [KNAPSACK, cycle 1, cost 60.00]
- VAL004 - Controlled Antacid D [KNAPSACK, cycle 1, cost 40.00]

**Skipped Medicines**

- VAL001 - Controlled Analgesic A [SKIPPED, cost 30.00]
- VAL002 - Controlled Antibiotic B [SKIPPED, cost 70.00]

### Test 2: Critical medicines

- Dataset: Controlled
- Objective: Ensure the safety layer protects all stockout-critical medicines.
- Status: PASS
- Total cost: 130.00
- Total priority: 1.8050

| Metric | Value |
| --- | ---: |
| budget_utilization | 92.86 |
| total_priority_selected | 1.8050 |
| stockout_risk_violations | 0 |
| number_of_skipped_medicines | 0 |
| selected_count | 3 |

**Assertions**

- Every medicine detected as critical is selected for procurement.
- Selected critical medicines are labeled with the CRITICAL decision reason.
- Total selected cost stays within the configured multi-cycle budget.

**Selected Medicines**

- CRT001 - Critical Insulin [CRITICAL, cycle 1, cost 30.00]
- CRT002 - Critical Cardiac Drug [CRITICAL, cycle 1, cost 40.00]
- CRT003 - Noncritical Supplement [KNAPSACK, cycle 2, cost 60.00]

**Skipped Medicines**

- None

### Test 3: Budget constraint

- Dataset: Real backend data
- Objective: Validate budget safety and cycle accounting on the live dataset.
- Status: PASS
- Total cost: 48408.00
- Total priority: 7.1204

| Metric | Value |
| --- | ---: |
| budget_utilization | 96.82 |
| total_priority_selected | 7.1204 |
| stockout_risk_violations | 0 |
| number_of_skipped_medicines | 2 |
| selected_count | 13 |

**Assertions**

- Total selected spend remains within the live monthly budget.
- Every cycle summary remains within its own allocated budget.
- Every selected live-data medicine has a valid cycle assignment.

**Selected Medicines**

- MED006 - Metformin 500 mg tablet [KNAPSACK, cycle 1, cost 2568.00]
- MED014 - Montek-10 [KNAPSACK, cycle 2, cost 4760.00]
- MED019 - Iron Folic Acid [KNAPSACK, cycle 1, cost 1944.00]
- MED021 - Clopidogrel 75 mg [KNAPSACK, cycle 2, cost 5880.00]
- MED025 - Telma 40 Tablet [KNAPSACK, cycle 3, cost 4912.00]
- MED036 - Methylcobalamin 1500 mcg [KNAPSACK, cycle 1, cost 2896.00]
- MED037 - Prednisolone 10 mg [KNAPSACK, cycle 2, cost 1952.00]
- MED038 - Tramadol 50 mg [KNAPSACK, cycle 1, cost 3352.00]
- MED040 - Meropenem 1 g [KNAPSACK, cycle 3, cost 6944.00]
- MED042 - Doxycycline 100 mg [KNAPSACK, cycle 3, cost 4200.00]
- MED046 - Clindamycin 300 mg [KNAPSACK, cycle 1, cost 2824.00]
- MED047 - Fluconazole 150 mg [KNAPSACK, cycle 2, cost 3520.00]
- MED050 - Levoquin 500mg Tablet [KNAPSACK, cycle 1, cost 2656.00]

**Skipped Medicines**

- MED008 - Atorvastatin 10 mg [SKIPPED, cost 3840.00]
- MED035 - Ciprofloxacin 500 mg [SKIPPED, cost 5664.00]

**Notes**

- Live reorder medicines: 15
- Live critical medicines: 0
- Configured order cycles: 3

### Test 4: Multi-cycle behavior

- Dataset: Controlled
- Objective: Verify correct cycle assignment under critical-first plus knapsack allocation.
- Status: PASS
- Total cost: 170.00
- Total priority: 1.7750

| Metric | Value |
| --- | ---: |
| budget_utilization | 85.00 |
| total_priority_selected | 1.7750 |
| stockout_risk_violations | 0 |
| number_of_skipped_medicines | 1 |
| selected_count | 3 |

**Assertions**

- Decision reason, cycle assignment, and selection state match the independent reference allocator.
- The controlled case uses more than one cycle, verifying staged allocation behavior.
- Total selected spend remains within both monthly and per-cycle budgets.

**Selected Medicines**

- MC001 - Critical Vaccine [CRITICAL, cycle 1, cost 40.00]
- MC002 - Priority Analgesic [KNAPSACK, cycle 1, cost 60.00]
- MC003 - Priority Antibiotic [KNAPSACK, cycle 2, cost 70.00]

**Skipped Medicines**

- MC004 - Deferred Vitamin [SKIPPED, cost 50.00]

## Conclusion

The validation suite combines brute-force proof on controlled instances with live-data budget and cycle checks.
A passing report means the hybrid procurement system satisfies the tested properties of safety, budget feasibility, and optimal cycle-level selection under the modeled rules.
