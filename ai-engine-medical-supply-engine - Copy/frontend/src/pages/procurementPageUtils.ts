import {
  OrderPayload,
  ProcurementMedicine,
  ProcurementPriority,
  ProcurementResponse,
  ProcurementUrgencyLevel,
  StoredOrder,
  PROCUREMENT_STREAM_MARKERS,
} from '../api/api';
import { ProcurementDashboardRow } from '../components/ProcurementTable';
import { getMedicineCatalogEntry } from '../config/medicineCatalog';

export interface StreamSnapshot {
  finalJsonText: string;
  reasoningText: string;
}

export interface ReasoningParserState {
  nextId: number;
  pendingBuffer: string;
  pendingTitle: string | null;
  processedLength: number;
  steps: import('../components/AgentStep').AgentReasoningStep[];
}

export function waitForReasoningDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function buildOrderId(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `ORD-${datePart}-${randomPart}`;
}

export function sortOrdersNewestFirst(orders: StoredOrder[]): StoredOrder[] {
  return [...orders].sort((left, right) => {
    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

export function buildOrderDraft(
  pharmacyId: string,
  rows: ProcurementDashboardRow[],
  orderId = buildOrderId(),
): OrderPayload {
  if (rows.length === 0) {
    throw new Error('No cycle-1 medicines are ready for ordering.');
  }

  const distributorIds = [...new Set(rows.map((row) => row.distributorId).filter(Boolean))];

  if (distributorIds.length === 0) {
    throw new Error('Selected medicines are missing distributor assignments.');
  }

  if (distributorIds.length > 1) {
    throw new Error(
      'Cycle-1 medicines span multiple distributors. Current workflow expects a single distributor per order.',
    );
  }

  const distributorId = distributorIds[0] as string;
  let totalAmount = 0;

  const items = rows.reduce<Record<string, OrderPayload['items'][string]>>(
    (accumulator, row, index) => {
      const catalogEntry = getMedicineCatalogEntry(row.medicineId);
      if (!catalogEntry) {
        throw new Error(`Missing catalog metadata for ${row.medicineName}.`);
      }

      if (row.pricePerUnit === null) {
        throw new Error(`Live pricing is unavailable for ${row.medicineName}.`);
      }

      const price = roundCurrency(row.pricePerUnit);
      const quantity = row.orderQuantity;
      const discountPercent = catalogEntry.discountPercent;
      const gstRate = catalogEntry.gstRate;
      const gross = roundCurrency(price * quantity);
      const discount = roundCurrency(gross * (discountPercent / 100));
      const taxable = roundCurrency(gross - discount);
      const gst = roundCurrency(taxable * (gstRate / 100));
      const cgst = roundCurrency(gst / 2);
      const sgst = roundCurrency(gst / 2);
      const lineTotal = roundCurrency(taxable + gst);

      totalAmount += lineTotal;

      accumulator[String(index)] = {
        name: row.medicineName,
        price,
        quantity,
        discountPercent,
        gstRate,
        hsnCode: catalogEntry.hsnCode,
        mrpPerPack: roundCurrency(price * catalogEntry.mrpMultiplier),
        taxBreakdown: {
          gross,
          discount,
          taxable,
          gst,
          cgst,
          sgst,
        },
        productID_Dtb: `${distributorId}-${row.medicineId}`,
        productID_Phm: `${pharmacyId}-${row.medicineId}`,
      };

      return accumulator;
    },
    {},
  );

  return {
    orderid: orderId,
    pharmaid: pharmacyId,
    distributorid: distributorId,
    items,
    totalAmount: roundCurrency(totalAmount),
  };
}

export function isPriority(value: unknown): value is ProcurementPriority {
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW';
}

export function isUrgencyLevel(value: unknown): value is ProcurementUrgencyLevel {
  return value === 'CRITICAL' || value === 'URGENT' || value === 'SAFE';
}

export function isProcurementMedicine(value: unknown): value is ProcurementMedicine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.medicine_id === 'string' &&
    typeof candidate.medicine_name === 'string' &&
    typeof candidate.reorder === 'boolean' &&
    isPriority(candidate.priority) &&
    typeof candidate.priority_score === 'number' &&
    typeof candidate.is_critical === 'boolean' &&
    typeof candidate.selected_for_order === 'boolean' &&
    (typeof candidate.order_cycle === 'number' || candidate.order_cycle === null) &&
    (candidate.reason === 'CRITICAL' ||
      candidate.reason === 'KNAPSACK' ||
      candidate.reason === 'SKIPPED') &&
    (typeof candidate.cost === 'number' || candidate.cost === null) &&
    typeof candidate.order_quantity === 'number' &&
    (typeof candidate.distributor_id === 'string' || candidate.distributor_id === null) &&
    (typeof candidate.distributor_name === 'string' || candidate.distributor_name === null) &&
    (typeof candidate.lead_days === 'number' || candidate.lead_days === null) &&
    (typeof candidate.price_per_unit === 'number' || candidate.price_per_unit === null) &&
    typeof candidate.forecast_quantity === 'number' &&
    typeof candidate.average_demand === 'number' &&
    (typeof candidate.current_stock === 'number' || candidate.current_stock === null) &&
    (typeof candidate.reorder_point === 'number' || candidate.reorder_point === null) &&
    typeof candidate.daily_demand === 'number' &&
    (typeof candidate.days_to_stockout === 'number' || candidate.days_to_stockout === null) &&
    (typeof candidate.safe_deadline_days === 'number' ||
      candidate.safe_deadline_days === null) &&
    isUrgencyLevel(candidate.urgency_level) &&
    (typeof candidate.adjusted_cycle === 'number' || candidate.adjusted_cycle === null) &&
    (typeof candidate.trigger_reason === 'string' || candidate.trigger_reason === null)
  );
}

export function isProcurementCycleSummary(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cycle === 'number' &&
    typeof candidate.budget === 'number' &&
    typeof candidate.used_budget === 'number' &&
    typeof candidate.remaining_budget === 'number' &&
    typeof candidate.selected_count === 'number' &&
    typeof candidate.critical_selected_count === 'number'
  );
}

export function isProcurementResponse(value: unknown): value is ProcurementResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.pharmacy_id === 'string' &&
    typeof candidate.monthly_budget === 'number' &&
    typeof candidate.order_cycles === 'number' &&
    typeof candidate.budget_per_cycle === 'number' &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(isProcurementMedicine) &&
    Array.isArray(candidate.cycle_summaries) &&
    candidate.cycle_summaries.every(isProcurementCycleSummary) &&
    typeof candidate.total_cost_used === 'number' &&
    typeof candidate.total_priority_achieved === 'number'
  );
}

export function splitProcurementStream(streamText: string): StreamSnapshot {
  const thinkingIndex = streamText.indexOf(PROCUREMENT_STREAM_MARKERS.thinking);
  const contentAfterThinking =
    thinkingIndex === -1
      ? streamText
      : streamText.slice(thinkingIndex + PROCUREMENT_STREAM_MARKERS.thinking.length);

  const finalJsonIndex = contentAfterThinking.indexOf(PROCUREMENT_STREAM_MARKERS.finalJson);

  if (finalJsonIndex === -1) {
    return {
      reasoningText: contentAfterThinking.replace(/^\s+/, ''),
      finalJsonText: '',
    };
  }

  return {
    reasoningText: contentAfterThinking.slice(0, finalJsonIndex).replace(/^\s+/, ''),
    finalJsonText: contentAfterThinking
      .slice(finalJsonIndex + PROCUREMENT_STREAM_MARKERS.finalJson.length)
      .replace(/^\s+/, ''),
  };
}

export function normalizeReasoningText(fragment: string): string {
  return fragment
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isStructuralHeading(text: string): boolean {
  return /step.*procurement reasoning/i.test(text);
}

export function isHeadingOnly(rawFragment: string, cleanedFragment: string): boolean {
  if (!cleanedFragment) {
    return false;
  }

  if (cleanedFragment.includes(':')) {
    return false;
  }

  const trimmedRawFragment = rawFragment.trim();
  const hasExplicitHeadingMarker =
    trimmedRawFragment.includes('**') ||
    /^\d+\.\s/.test(trimmedRawFragment) ||
    /^[-*]\s/.test(trimmedRawFragment);

  if (hasExplicitHeadingMarker) {
    return true;
  }

  return !/[.!?]$/.test(trimmedRawFragment) && cleanedFragment.split(/\s+/).length <= 4;
}

export function normalizeStepTitle(title: string): string {
  const sanitizedTitle = normalizeReasoningText(title)
    .replace(/[.:!?]+$/, '')
    .replace(/^(we need to|need to|we should|should|we must|must|next|then|now)\s+/i, '')
    .trim();

  if (!sanitizedTitle) {
    return 'Reasoning Update';
  }

  return sanitizedTitle.charAt(0).toUpperCase() + sanitizedTitle.slice(1);
}

export function normalizeStepContent(content: string): string {
  return normalizeReasoningText(content).trim();
}

export function inferStepTitle(content: string): string {
  const normalizedContent = normalizeStepContent(content);
  const loweredContent = normalizedContent.toLowerCase();

  if (loweredContent.includes('safety stock') || loweredContent.includes('deadline')) {
    return 'Evaluating safe deadlines';
  }

  if (loweredContent.includes('critical') || loweredContent.includes('stockout')) {
    return 'Protecting critical medicines';
  }

  if (loweredContent.includes('knapsack') || loweredContent.includes('optimal')) {
    return 'Evaluating optimal selection';
  }

  if (loweredContent.includes('cycle')) {
    return 'Allocating cycle budgets';
  }

  if (loweredContent.includes('priority')) {
    return 'Scoring priority pressure';
  }

  if (loweredContent.includes('budget')) {
    return 'Applying budget constraint';
  }

  if (loweredContent.includes('forecast') || loweredContent.includes('demand')) {
    return 'Analyzing demand pressure';
  }

  if (
    loweredContent.includes('inventory') ||
    loweredContent.includes('stock') ||
    loweredContent.includes('reorder')
  ) {
    return 'Reviewing stock pressure';
  }

  if (loweredContent.includes('lead time')) {
    return 'Evaluating lead times';
  }

  if (loweredContent.includes('supplier')) {
    return 'Evaluating supplier options';
  }

  if (loweredContent.includes('cost') || loweredContent.includes('price')) {
    return 'Comparing cost trade-offs';
  }

  const firstClause = normalizedContent.split(':', 1)[0];
  const firstWords = firstClause.split(/\s+/).slice(0, 6).join(' ');
  return normalizeStepTitle(firstWords);
}

export function splitCompletedReasoningSegments(
  buffer: string,
  flushRemainder: boolean,
): { completedSegments: string[]; remainder: string } {
  const completedSegments: string[] = [];
  let segmentStart = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    const currentCharacter = buffer[index];
    const previousCharacter = buffer[index - 1] ?? '';
    const nextCharacter = buffer[index + 1] ?? '';
    const isLineBreakBoundary = currentCharacter === '\n';
    const isSentenceBoundary =
      currentCharacter === '.' &&
      (nextCharacter === '' || /\s/.test(nextCharacter)) &&
      !(/\d/.test(previousCharacter) && /\d/.test(nextCharacter));

    if (!isLineBreakBoundary && !isSentenceBoundary) {
      continue;
    }

    const segment = buffer.slice(segmentStart, isLineBreakBoundary ? index : index + 1);

    if (segment.trim()) {
      completedSegments.push(segment);
    }

    segmentStart = index + 1;
    while (/\s/.test(buffer[segmentStart] ?? '')) {
      segmentStart += 1;
    }
  }

  let remainder = buffer.slice(segmentStart);
  if (flushRemainder && remainder.trim()) {
    completedSegments.push(remainder);
    remainder = '';
  }

  return { completedSegments, remainder };
}

export function getReasoningStepDelay(step: import('../components/AgentStep').AgentReasoningStep): number {
  const stepLength = `${step.title} ${step.content}`.trim().length;
  return Math.min(1200, Math.max(300, stepLength * 20));
}

export function appendReasoningSteps(
  parserState: ReasoningParserState,
  reasoningText: string,
  flushRemainder: boolean,
): import('../components/AgentStep').AgentReasoningStep[] {
  const nextChunk = reasoningText.slice(parserState.processedLength);
  parserState.processedLength = reasoningText.length;
  parserState.pendingBuffer += nextChunk;

  const { completedSegments, remainder } = splitCompletedReasoningSegments(
    parserState.pendingBuffer,
    flushRemainder,
  );
  parserState.pendingBuffer = remainder;

  const nextSteps: import('../components/AgentStep').AgentReasoningStep[] = [];

  for (const segment of completedSegments) {
    const cleanedSegment = normalizeReasoningText(segment);

    if (!cleanedSegment || isStructuralHeading(cleanedSegment)) {
      continue;
    }

    if (parserState.pendingTitle) {
      if (isHeadingOnly(segment, cleanedSegment)) {
        parserState.pendingTitle = normalizeStepTitle(cleanedSegment);
        continue;
      }

      const nextStep = {
        id: `reasoning-step-${parserState.nextId}`,
        title: parserState.pendingTitle,
        content: normalizeStepContent(cleanedSegment),
      };
      parserState.steps.push(nextStep);
      nextSteps.push(nextStep);
      parserState.pendingTitle = null;
      parserState.nextId += 1;
      continue;
    }

    if (isHeadingOnly(segment, cleanedSegment)) {
      parserState.pendingTitle = normalizeStepTitle(cleanedSegment);
      continue;
    }

    const separatorIndex = cleanedSegment.indexOf(':');
    if (separatorIndex > 0 && separatorIndex < cleanedSegment.length - 1) {
      const nextStep = {
        id: `reasoning-step-${parserState.nextId}`,
        title: normalizeStepTitle(cleanedSegment.slice(0, separatorIndex)),
        content: normalizeStepContent(cleanedSegment.slice(separatorIndex + 1)),
      };
      parserState.steps.push(nextStep);
      nextSteps.push(nextStep);
      parserState.nextId += 1;
      continue;
    }

    const nextStep = {
      id: `reasoning-step-${parserState.nextId}`,
      title: inferStepTitle(cleanedSegment),
      content: normalizeStepContent(cleanedSegment),
    };
    parserState.steps.push(nextStep);
    nextSteps.push(nextStep);
    parserState.nextId += 1;
  }

  return nextSteps;
}
