import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  createOrder,
  fetchOrders,
  fetchProcurement,
  fetchProcurementStream,
  OrderPayload,
  ProcurementResponse,
  StoredOrder,
  updateProcurementConfig,
} from '../api/api';
import AIThinkingPanel from '../components/AIThinkingPanel';
import { AgentReasoningStep } from '../components/AgentStep';
import OrdersSidebar from '../components/OrdersSidebar';
import PriorityBadge from '../components/PriorityBadge';
import ProcurementSummaryCards from '../components/ProcurementSummaryCards';
import ProcurementTable, {
  ProcurementDashboardRow,
} from '../components/ProcurementTable';
import Receipt from '../components/Receipt';
import {
  appendReasoningSteps,
  buildOrderDraft,
  getReasoningStepDelay,
  isProcurementResponse,
  roundCurrency,
  ReasoningParserState,
  sortOrdersNewestFirst,
  splitProcurementStream,
  waitForReasoningDelay,
} from './procurementPageUtils';

interface OrderFeedback {
  message: string;
  tone: 'success' | 'error';
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const PHARMACY_PROCUREMENT_URL = 'http://localhost:5173/dashboard/procurement';
const PROCUREMENT_BRIDGE_PREFIX = 'SYNMED_PROCUREMENT_BRIDGE::';

function ProcurementPage() {
  const [steps, setSteps] = useState<AgentReasoningStep[]>([]);
  const [procurement, setProcurement] = useState<ProcurementResponse | null>(null);
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderPayload | StoredOrder | null>(null);
  const [receiptMode, setReceiptMode] = useState<'draft' | 'persisted' | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [orderFlowLocked, setOrderFlowLocked] = useState(false);
  const [preparingOrderPreview, setPreparingOrderPreview] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<OrderFeedback | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);
  const [queuedReasoningSteps, setQueuedReasoningSteps] = useState(0);
  const [renderingReasoning, setRenderingReasoning] = useState(false);
  const [monthlyBudgetDraft, setMonthlyBudgetDraft] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetNotice, setBudgetNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      try {
        setOrdersLoading(true);
        setOrdersError(null);
        const response = await fetchOrders();

        if (!cancelled) {
          setOrders(sortOrdersNewestFirst(response.orders));
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrdersError(
            loadError instanceof Error ? loadError.message : 'Failed to load saved orders.',
          );
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (procurement) {
      setMonthlyBudgetDraft(String(procurement.monthly_budget));
    }
  }, [procurement?.monthly_budget]);

  useEffect(() => {
    let active = true;
    let parsedFinalJson = false;
    const abortController = new AbortController();
    const decoder = new TextDecoder();
    let streamText = '';
    let renderingQueue = false;
    const renderQueue: AgentReasoningStep[] = [];
    const parserState: ReasoningParserState = {
      nextId: 1,
      pendingBuffer: '',
      pendingTitle: null,
      processedLength: 0,
      steps: [],
    };

    const publishQueueDepth = () => {
      startTransition(() => {
        if (active) {
          setQueuedReasoningSteps(renderQueue.length);
        }
      });
    };

    const publishRenderingState = (isRendering: boolean) => {
      startTransition(() => {
        if (active) {
          setRenderingReasoning(isRendering);
        }
      });
    };

    const pumpRenderQueue = async () => {
      if (renderingQueue) {
        return;
      }

      renderingQueue = true;
      publishRenderingState(true);

      while (active && renderQueue.length > 0) {
        const nextStep = renderQueue.shift();
        publishQueueDepth();

        if (!nextStep) {
          continue;
        }

        await waitForReasoningDelay(getReasoningStepDelay(nextStep));

        if (!active) {
          return;
        }

        startTransition(() => {
          if (active) {
            setSteps((currentSteps) => [...currentSteps, nextStep]);
          }
        });
      }

      renderingQueue = false;
      publishRenderingState(false);
    };

    const enqueueReasoningSteps = (nextSteps: AgentReasoningStep[]) => {
      if (nextSteps.length === 0) {
        return;
      }

      renderQueue.push(...nextSteps);
      publishQueueDepth();
      void pumpRenderQueue();
    };

    const applySnapshot = (flushRemainder: boolean) => {
      const snapshot = splitProcurementStream(streamText);
      const shouldFlushReasoning = flushRemainder || Boolean(snapshot.finalJsonText);
      const nextSteps = appendReasoningSteps(
        parserState,
        snapshot.reasoningText,
        shouldFlushReasoning,
      );

      enqueueReasoningSteps(nextSteps);

      if (!snapshot.finalJsonText) {
        return;
      }

      try {
        const parsedValue = JSON.parse(snapshot.finalJsonText) as unknown;
        if (!isProcurementResponse(parsedValue)) {
          return;
        }

        parsedFinalJson = true;
        startTransition(() => {
          if (active) {
            setProcurement(parsedValue);
          }
        });
      } catch {
        // Wait for the streamed JSON body to complete before parsing.
      }
    };

    const loadProcurementFallback = async (): Promise<boolean> => {
      try {
        const payload = await fetchProcurement();

        startTransition(() => {
          if (active) {
            setProcurement(payload);
            setError(false);
          }
        });

        return true;
      } catch {
        return false;
      }
    };

    const loadProcurementStream = async () => {
      try {
        setError(false);
        setStreaming(true);
        setSteps([]);
        setQueuedReasoningSteps(0);
        setRenderingReasoning(false);
        setProcurement(null);

        const response = await fetchProcurementStream(abortController.signal);
        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error('Missing response body.');
        }

        while (active) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          streamText += decoder.decode(value, { stream: true });
          applySnapshot(false);
        }

        streamText += decoder.decode();
        applySnapshot(true);

        if (active && !parsedFinalJson) {
          const loadedFallback = await loadProcurementFallback();
          if (!loadedFallback && active) {
            setError(true);
          }
        }
      } catch {
        if (active && !abortController.signal.aborted) {
          const loadedFallback = await loadProcurementFallback();
          if (!loadedFallback && active) {
            setError(true);
          }
        }
      } finally {
        if (active) {
          setStreaming(false);
        }
      }
    };

    loadProcurementStream();
    return () => {
      active = false;
      abortController.abort();
    };
  }, []);

  const rows = useMemo<ProcurementDashboardRow[]>(() => {
    if (!procurement) {
      return [];
    }

    return procurement.decisions
      .filter(
        (medicine) =>
          medicine.reorder && medicine.order_quantity > 0,
      )
      .map((medicine) => ({
        medicineId: medicine.medicine_id,
        medicineName: medicine.medicine_name,
        priority: medicine.priority,
        priorityScore: medicine.priority_score,
        isCritical: medicine.is_critical,
        selectedForOrder: medicine.selected_for_order,
        orderCycle: medicine.order_cycle,
        reason: medicine.reason,
        cost: medicine.cost,
        orderQuantity: medicine.order_quantity,
        distributorId: medicine.distributor_id,
        distributorName: medicine.distributor_name,
        leadDays: medicine.lead_days,
        pricePerUnit: medicine.price_per_unit,
        currentStock: medicine.current_stock,
        reorderPoint: medicine.reorder_point,
        daysToStockout: medicine.days_to_stockout,
        safeDeadlineDays: medicine.safe_deadline_days,
        urgencyLevel: medicine.urgency_level,
        adjustedCycle: medicine.adjusted_cycle,
        triggerReason: medicine.trigger_reason,
      }));
  }, [procurement]);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selectedForOrder),
    [rows],
  );
  const cycleOneSelectedRows = useMemo(
    () => selectedRows.filter((row) => row.orderCycle === 1),
    [selectedRows],
  );
  const cycleDecisionCards = useMemo(() => {
    if (!procurement) {
      return [];
    }

    return procurement.cycle_summaries.map((cycle) => {
      const medicines = rows
        .filter((row) => row.orderCycle === cycle.cycle)
        .sort((left, right) => {
          if (left.priorityScore !== right.priorityScore) {
            return right.priorityScore - left.priorityScore;
          }

          return (right.cost ?? 0) - (left.cost ?? 0);
        });
      const visibleUsedBudget = roundCurrency(
        medicines.reduce((total, row) => total + (row.cost ?? 0), 0),
      );
      const visibleRemainingBudget = roundCurrency(
        Math.max(cycle.budget - visibleUsedBudget, 0),
      );
      const visibleCriticalSelectedCount = medicines.filter(
        (row) => row.isCritical,
      ).length;

      return {
        ...cycle,
        medicines,
        visibleSelectedCount: medicines.length,
        visibleCriticalSelectedCount,
        visibleUsedBudget,
        visibleRemainingBudget,
      };
    });
  }, [procurement, rows]);

  const orderPreviewState = useMemo(() => {
    if (!procurement) {
      return { draft: null as OrderPayload | null, errorMessage: null as string | null };
    }

    try {
      return {
        draft: buildOrderDraft(procurement.pharmacy_id, cycleOneSelectedRows, 'PREVIEW'),
        errorMessage: null,
      };
    } catch (previewError) {
      return {
        draft: null,
        errorMessage:
          previewError instanceof Error
            ? previewError.message
            : 'Unable to build the order preview.',
      };
    }
  }, [cycleOneSelectedRows, procurement]);

  const selectedPersistedOrderId =
    receiptMode === 'persisted' && activeOrder ? activeOrder.orderid : null;
  const pharmacyDisplayName =
    procurement?.pharmacy_id ?? activeOrder?.pharmaid ?? 'Pharmacy';
  const previewItemCount = orderPreviewState.draft
    ? Object.keys(orderPreviewState.draft.items).length
    : 0;
  const previewDistributorId = orderPreviewState.draft?.distributorid ?? 'Unavailable';
  const previewTotalAmount = orderPreviewState.draft?.totalAmount ?? 0;
  const reasoningSourceLabel =
    streaming || renderingReasoning || queuedReasoningSteps > 0 || steps.length > 0
      ? 'Groq live stream'
      : 'Fallback JSON payload';
  const orderNowDisabled =
    !orderPreviewState.draft || orderFlowLocked || preparingOrderPreview || confirmingOrder;
  const orderNowLabel = confirmingOrder
    ? 'Submitting Order...'
    : preparingOrderPreview
      ? 'Preparing Invoice...'
      : orderFlowLocked
        ? 'Order Request Active'
        : 'Order Now';

  const handleCloseReceipt = () => {
    if (confirmingOrder) {
      return;
    }

    setActiveOrder(null);
    setReceiptMode(null);
    setOrderFlowLocked(false);
  };

  const handleOrderNow = () => {
    if (!procurement || orderFlowLocked || preparingOrderPreview) {
      return;
    }

    setPreparingOrderPreview(true);
    setOrderFlowLocked(true);

    try {
      const nextDraft = buildOrderDraft(procurement.pharmacy_id, cycleOneSelectedRows);
      setActiveOrder(nextDraft);
      setReceiptMode('draft');
      setOrderFeedback(null);
    } catch (draftError) {
      setOrderFlowLocked(false);
      setOrderFeedback({
        tone: 'error',
        message:
          draftError instanceof Error
            ? draftError.message
            : 'Unable to generate the order summary.',
      });
    } finally {
      setPreparingOrderPreview(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!activeOrder || receiptMode !== 'draft' || confirmingOrder) {
      return;
    }

    const shouldConfirm = window.confirm('Are you sure you want to place this order?');
    if (!shouldConfirm) {
      return;
    }

    try {
      setConfirmingOrder(true);
      setOrderFeedback(null);
      const response = await createOrder(activeOrder);
      setOrders((currentOrders) =>
        sortOrdersNewestFirst([
          response.order,
          ...currentOrders.filter((order) => order.orderid !== response.order.orderid),
        ]),
      );
      setActiveOrder(response.order);
      setReceiptMode('persisted');
      setOrderFeedback({
        tone: 'success',
        message:
          response.status === 'duplicate'
            ? 'Order already placed. Showing existing receipt.'
            : response.message,
      });
    } catch (submissionError) {
      setOrderFeedback({
        tone: 'error',
        message:
          submissionError instanceof Error
            ? submissionError.message
            : 'Failed to place the order.',
      });
    } finally {
      setConfirmingOrder(false);
      setOrderFlowLocked(false);
      setPreparingOrderPreview(false);
    }
  };

  const handleSelectSavedOrder = (order: StoredOrder) => {
    setActiveOrder(order);
    setReceiptMode('persisted');
    setOrderFeedback(null);
  };

  const handleSendToPharmacyProcurement = () => {
    if (!procurement) {
      return;
    }

    const mappedDecisions = procurement.decisions.filter((decision) => decision.mongo_mapped);
    if (mappedDecisions.length === 0) {
      setOrderFeedback({
        tone: 'error',
        message: 'No Mongo-mapped medicines are available to send.',
      });
      return;
    }

    const shouldContinue = window.confirm(
      'Send all Mongo-mapped medicines to Pharmacy Portal procurement page?',
    );
    if (!shouldContinue) {
      return;
    }

    try {
      setTransferNotice('Please go back to your pharmacy procurement page');
      const payload = {
        source: 'ai-engine',
        sentAt: new Date().toISOString(),
        decisions: mappedDecisions,
      };
      window.name = `${PROCUREMENT_BRIDGE_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
      window.setTimeout(() => {
        window.location.href = PHARMACY_PROCUREMENT_URL;
      }, 700);
    } catch {
      setOrderFeedback({
        tone: 'error',
        message: 'Failed to transfer medicines to Pharmacy Portal.',
      });
    }
  };

  const handleSaveMonthlyBudget = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!procurement || savingBudget) {
      return;
    }

    const nextBudget = Number(monthlyBudgetDraft);
    if (!Number.isFinite(nextBudget) || nextBudget < 0) {
      setBudgetNotice('Enter a valid monthly budget of 0 or more.');
      return;
    }

    try {
      setSavingBudget(true);
      setBudgetNotice(null);
      const updatedProcurement = await updateProcurementConfig({ monthly_budget: nextBudget });
      startTransition(() => {
        setProcurement(updatedProcurement);
      });
      setMonthlyBudgetDraft(String(updatedProcurement.monthly_budget));
      setBudgetNotice(
        `Monthly budget saved and split across ${updatedProcurement.order_cycles} cycles.`,
      );
    } catch (saveError) {
      setBudgetNotice(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save the monthly budget.',
      );
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <>
      <section className="space-y-6 dashboard-fade-in">
        <AIThinkingPanel
          steps={steps}
          streaming={streaming}
          processing={renderingReasoning}
          queuedStepCount={queuedReasoningSteps}
          collapsed={reasoningCollapsed}
          streamSourceLabel={reasoningSourceLabel}
          onToggleCollapse={() =>
            setReasoningCollapsed((currentValue) => !currentValue)
          }
        />

        {error && !procurement ? (
          <section className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-6 shadow-md">
            <p className="text-sm font-semibold text-rose-50">
              Procurement data could not be loaded. Check backend availability and stream
              readiness.
            </p>
          </section>
        ) : null}

        {procurement ? (
          <>
            <section className="rounded-2xl border border-[#d9e7cf] bg-gradient-to-br from-[#fbf8f1] via-[#f5f1e7] to-[#eef6ea] p-6 shadow-md backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Budget Setup
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-slate-900">
                    Set the monthly procurement budget
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Enter the pharmacy monthly budget here and the AI procurement engine will
                    persist it, then split it evenly across {procurement.order_cycles} order
                    cycles.
                  </p>
                </div>

                <form className="flex flex-col gap-3 sm:min-w-[320px]" onSubmit={handleSaveMonthlyBudget}>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Monthly budget
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyBudgetDraft}
                    onChange={(event) => setMonthlyBudgetDraft(event.target.value)}
                    className="rounded-xl border border-[#d9e7cf] bg-white/80 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200/40"
                    placeholder="Enter monthly budget"
                  />
                  <button
                    type="submit"
                    disabled={savingBudget}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-md transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {savingBudget ? 'Saving Budget...' : 'Save Budget'}
                  </button>
                </form>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#d9e7cf] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current Budget</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {currencyFormatter.format(procurement.monthly_budget)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d9e7cf] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Per Cycle</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {currencyFormatter.format(procurement.budget_per_cycle)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d9e7cf] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Order Cycles</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {procurement.order_cycles}
                  </p>
                </div>
              </div>

              {budgetNotice ? (
                <p className="mt-4 text-sm font-medium text-emerald-800">{budgetNotice}</p>
              ) : null}
            </section>

            <ProcurementSummaryCards
              orderCycles={procurement.order_cycles}
              budgetPerCycle={procurement.budget_per_cycle}
              totalMedicines={rows.length}
              selectedMedicines={selectedRows.length}
            />

            <ProcurementTable rows={rows} />

            <div className="flex flex-col items-end gap-3">
              <button
  type="button"
  onClick={handleSendToPharmacyProcurement}
  className="inline-flex items-center justify-center rounded-xl bg-green-100 px-6 py-3 text-sm font-semibold text-green-800 shadow-md transition hover:bg-green-200"
>
  Get these to order in pharmacy procurement
</button>
              {transferNotice ? (
                <p className="text-sm font-medium text-cyan-700">{transferNotice}</p>
              ) : null}
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-md backdrop-blur">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sand">
                    Cycle Decisions
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Cycle-by-cycle allocation cards
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    Each cycle gets an equal-width card with budget usage, critical protection, and
                    the medicines assigned by the procurement agent.
                  </p>
                </div>
                <p className="text-sm text-slate-400">
                  {procurement.cycle_summaries.length} cycles in the active run
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {cycleDecisionCards.map((cycle) => (
                  <article
                    key={`cycle-card-${cycle.cycle}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                          Cycle {cycle.cycle}
                        </p>
                        <h4 className="mt-2 text-xl font-semibold text-white">
                          {currencyFormatter.format(cycle.budget)} budget
                        </h4>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        {cycle.visibleSelectedCount} selected
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Used</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {currencyFormatter.format(cycle.visibleUsedBudget)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Remaining
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {currencyFormatter.format(cycle.visibleRemainingBudget)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Critical
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {cycle.visibleCriticalSelectedCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Medicines
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {cycle.medicines.length}
                        </p>
                      </div>
                    </div>

                    <div className="dashboard-scrollbar mt-5 max-h-56 space-y-3 overflow-auto pr-1">
                      {cycle.medicines.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                          No medicines assigned to this cycle.
                        </div>
                      ) : (
                        cycle.medicines.map((row) => (
                          <div
                            key={`${cycle.cycle}-${row.medicineId}`}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {row.medicineName}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {row.medicineId}
                                </p>
                              </div>
                              <PriorityBadge priority={row.priority} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                              <span>{row.orderQuantity} units</span>
                              <span>{currencyFormatter.format(row.cost ?? 0)}</span>
                              <span>
                                {row.safeDeadlineDays !== null
                                  ? row.safeDeadlineDays <= 0
                                    ? 'Order now'
                                    : `Order within ${row.safeDeadlineDays.toFixed(1)} days`
                                  : 'No near-term deadline'}
                              </span>
                              <span>
                                {row.reason === 'CRITICAL' ? 'Critical first' : 'Knapsack'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <article className="xl:col-span-8 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-md backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                      Order Execution
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-white">
                      Execute the live cycle-1 procurement order
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      Convert the current cycle-1 selection into an invoice-ready order. Only
                      medicines with `selected_for_order == true` and `order_cycle == 1` are sent
                      into the execution flow.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOrderNow}
                    disabled={orderNowDisabled}
                    className="inline-flex items-center justify-center rounded-md border border-cyan-300 bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-md transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-500 disabled:text-slate-300"
                  >
                    {orderNowLabel}
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Pharmacy
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {procurement.pharmacy_id}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Cycle-1 Lines
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">{previewItemCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Draft Total
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {currencyFormatter.format(previewTotalAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Distributor
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {previewDistributorId}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <span>
                      Session state:{' '}
                      <span className="font-semibold text-white">
                        {streaming || renderingReasoning || queuedReasoningSteps > 0
                          ? 'AI still reasoning'
                          : 'Decision set ready'}
                      </span>
                    </span>
                    <span className="hidden h-4 w-px bg-white/10 sm:block" />
                    <span>
                      Selected medicines:{' '}
                      <span className="font-semibold text-white">{selectedRows.length}</span>
                    </span>
                    <span className="hidden h-4 w-px bg-white/10 sm:block" />
                    <span>
                      Stream source:{' '}
                      <span className="font-semibold text-white">{reasoningSourceLabel}</span>
                    </span>
                  </div>
                </div>

                {orderPreviewState.errorMessage ? (
                  <div className="mt-4 border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    {orderPreviewState.errorMessage}
                  </div>
                ) : null}
              </article>

              <div className="xl:col-span-4">
                <OrdersSidebar
                  orders={orders}
                  loading={ordersLoading}
                  error={ordersError}
                  selectedOrderId={selectedPersistedOrderId}
                  onSelectOrder={handleSelectSavedOrder}
                />
              </div>
            </section>
          </>
        ) : null}
      </section>

      <Receipt
        order={activeOrder}
        pharmacyName={pharmacyDisplayName}
        onClose={handleCloseReceipt}
        onConfirm={receiptMode === 'draft' ? handleConfirmOrder : undefined}
        confirming={confirmingOrder}
        feedback={orderFeedback}
      />
    </>
  );
}

export default ProcurementPage;
