import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Plus, RefreshCw, Sparkles, Ban, Clock3, Loader2, Printer, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { IcnExchange, icnService } from '../services/icnService';
import { inventoryService, Medicine } from '../services/inventoryService';
import { pharmacyService, PharmacyUser } from '../services/pharmacyService';

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return 'N/A';
  const d = new Date(dateValue);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function getDaysToExpiry(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const diff = new Date(dateValue).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function formatCountdown(dateValue: string | null | undefined, nowMs: number) {
  if (!dateValue) return null;
  const diff = new Date(dateValue).getTime() - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return 'Expired';

  const totalSeconds = Math.floor(diff / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getIcnActionTimerLabel(item: IcnExchange, nowMs: number) {
  if (!item.expiresAt) return null;
  if (item.status !== 'OPEN' && item.status !== 'ACCEPTED') return null;

  const countdown = formatCountdown(item.expiresAt, nowMs);
  if (!countdown) return null;

  if (item.status === 'OPEN') {
    return countdown === 'Expired' ? 'Post expired' : `${countdown} to respond`;
  }

  return countdown === 'Expired' ? 'Pickup window expired' : `${countdown} to collect`;
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatPayment(raw?: string) {
  if (!raw) return '—';
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolvePharmacyName(pharmacy: PharmacyUser | null) {
  return pharmacy?.name ?? '—';
}

function resolvePharmacyAddress(pharmacy: PharmacyUser | null) {
  if (!pharmacy?.address) return '—';
  if (typeof pharmacy.address === 'string') return pharmacy.address;
  return [
    pharmacy.address.line1,
    pharmacy.address.line2,
    pharmacy.address.city,
    pharmacy.address.state,
    pharmacy.address.pincode ?? pharmacy.address.zip,
  ]
    .filter(Boolean)
    .join(', ');
}

function resolvePharmacyPhone(pharmacy: PharmacyUser | null) {
  return pharmacy?.phone ?? '—';
}

function resolvePharmacyLogoUrl(pharmacy: PharmacyUser | null) {
  const logo = (pharmacy as any)?.logo as string | undefined;
  if (!logo) return null;
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
  return `http://localhost:5203${logo}`;
}

function getExchangeUnits(exchange: IcnExchange): number {
  if (exchange.type === 'REQUEST') {
    return Number(exchange.quantityRequested || 0);
  }
  return (exchange.batchDetails || []).reduce((sum, b) => sum + Number(b.quantity || 0), 0);
}

function getStatusMeta(status: IcnExchange['status']) {
  const map: Record<string, { label: string; color: string }> = {
    OPEN: { label: 'In Transit', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    ACCEPTED: { label: 'Accepted & Yet to receive', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    COMPLETED: { label: 'Accepted & Received', color: 'bg-green-100 text-green-700 border-green-200' },
    TIME_EXPIRED: { label: 'Timed out and Cancelled', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    CANCELLED: { label: 'Cancelled', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  };

  return map[status] || {
    label: String(status || '').replace(/_/g, ' '),
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  };
}

function getTypeMeta(type: IcnExchange['type']) {
  if (type === 'REQUEST') {
    return { label: 'Request', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Exchange', color: 'bg-blue-100 text-blue-700 border-blue-200' };
}

type MedicineOption = {
  genericKey: string;
  productID: string;
  medicineName: string;
  composition?: string;
  batches: Array<{
    batchCode: string;
    expiryDate: string | null;
    unitsAvailable: number;
    subUnitsAvailable: number;
    totalSubUnits: number;
    mrp: number;
    discount: number;
  }>;
  totalUnitsAvailable: number;
  totalSubUnitsAvailable: number;
  totalSubUnitsInBatches: number;
  nearestExpiry: string | null;
  threshold: number;
  isLowStock: boolean;
  isCloseToExpiry: boolean;
};

type LatLng = {
  latitude: number;
  longitude: number;
};

function resolvePharmacyLatLng(pharmacy: PharmacyUser | null | undefined): LatLng | null {
  if (!pharmacy) return null;
  const location = (pharmacy as any).location;
  if (!location) return null;

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    const lng = Number(location.coordinates[0]);
    const lat = Number(location.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  const lat = Number((location as any).latitude);
  const lng = Number((location as any).longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }

  return null;
}

function resolveLoggedInPharmacyId(user: any): string | null {
  let storedUser: any = null;

  try {
    storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    storedUser = null;
  }

  const candidateIds = [user?.pharmaID, (user as any)?.pharmaID, storedUser?.pharmaID, storedUser?.id];
  for (const candidate of candidateIds) {
    if (typeof candidate === 'string' && candidate.startsWith('PHM-')) {
      return candidate;
    }
  }

  return null;
}

export default function ICNPage() {
  const { user } = useAuth();
  const billRef = useRef<HTMLDivElement>(null);
  const MIN_PROCESSING_OVERLAY_MS = 5000;

  const [openExchanges, setOpenExchanges] = useState<IcnExchange[]>([]);
  const [myExchanges, setMyExchanges] = useState<IcnExchange[]>([]);
  const [pharmacyNameMap, setPharmacyNameMap] = useState<Record<string, string>>({});
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([]);
  const [selectedIcnExchange, setSelectedIcnExchange] = useState<IcnExchange | null>(null);
  const [selectedIcnMedicine, setSelectedIcnMedicine] = useState<Medicine | null>(null);
  const [selectedIcnPharmacy, setSelectedIcnPharmacy] = useState<PharmacyUser | null>(null);
  const [medicineDetailsLoading, setMedicineDetailsLoading] = useState(false);
  const [showIcnMedicineModal, setShowIcnMedicineModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postingExchange, setPostingExchange] = useState(false);
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showRiskConfirmModal, setShowRiskConfirmModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [showZeroStockModal, setShowZeroStockModal] = useState(false);
  const [riskWarningText, setRiskWarningText] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<IcnExchange | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<IcnExchange | null>(null);
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);
  const [completeConfirmTarget, setCompleteConfirmTarget] = useState<IcnExchange | null>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'ONLINE'>('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [showBillModal, setShowBillModal] = useState(false);
  const [billTarget, setBillTarget] = useState<IcnExchange | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageDest, setCurrentPageDest] = useState(1);
  const [currentPageReceived, setCurrentPageReceived] = useState(1);
  const itemsPerPage = 9;
  const [filterType, setFilterType] = useState<'all' | 'accepted & yet to receive' | 'accepted & received' | 'cancelled' | 'timed out and cancelled'>('all');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'post-exchange-history' | 'raise-request-history' | 'received-history'>('marketplace');
  const [selectedExchangeDetail, setSelectedExchangeDetail] = useState<IcnExchange | null>(null);
  const [showExchangeDetailModal, setShowExchangeDetailModal] = useState(false);
  const [sourcePharmacyDetail, setSourcePharmacyDetail] = useState<PharmacyUser | null>(null);
  const [destinationPharmacyDetail, setDestinationPharmacyDetail] = useState<PharmacyUser | null>(null);
  const [exchangeDetailLoading, setExchangeDetailLoading] = useState(false);
  const [destPharmacyExchanges, setDestPharmacyExchanges] = useState<IcnExchange[]>([]);
  const [billMedicineDetail, setBillMedicineDetail] = useState<Medicine | null>(null);
  const [billDetailsLoading, setBillDetailsLoading] = useState(false);
  const [billFetchError, setBillFetchError] = useState<string | null>(null);
  const [currentPharmacyLocation, setCurrentPharmacyLocation] = useState<LatLng | null>(null);
  const [pharmacyLocationMap, setPharmacyLocationMap] = useState<Partial<Record<string, LatLng>>>({});

  const [exchangeForm, setExchangeForm] = useState({
    genericKey: '',
    unitsToExchange: 1,
  });

  type ListingStockMatch = {
    units: number;
    subUnits: number;
    threshold: number;
    isLowStock: boolean;
  };
  const [requestForm, setRequestForm] = useState({
    genericKey: '',
    quantityRequested: 1,
  });

  const buildMedicineOptions = (items: Medicine[]): MedicineOption[] => {
    const grouped = new Map<string, MedicineOption>();

    for (const item of items) {
      const genericKey = String((item as any).genericKey || '').trim();
      if (!genericKey) continue;

      const units = Number(item.stock?.unitsAvailable ?? item.availableStock ?? 0);
      const subUnits = Number((item.stock as any)?.subUnitsAvailable ?? item.stock?.totalSubUnits ?? 0);
      const expiry = item.expiryDate || null;
      const threshold = Number(item.stock?.threshold ?? 15);

      if (!grouped.has(genericKey)) {
        grouped.set(genericKey, {
          genericKey,
          productID: item.productID,
          medicineName: item.medicineName || item.productID,
          composition: item.composition,
          batches: [],
          totalUnitsAvailable: Math.max(0, units),
          totalSubUnitsAvailable: Math.max(0, subUnits),
          totalSubUnitsInBatches: Math.max(0, Number(item.stock?.totalSubUnits ?? 0)),
          nearestExpiry: expiry,
          threshold,
          isLowStock: false,
          isCloseToExpiry: false,
        });
      } else {
        const curr = grouped.get(genericKey)!;
        curr.totalUnitsAvailable += Math.max(0, units);
        curr.totalSubUnitsAvailable += Math.max(0, subUnits);
        curr.totalSubUnitsInBatches += Math.max(0, Number(item.stock?.totalSubUnits ?? 0));

        if (expiry && (!curr.nearestExpiry || new Date(expiry).getTime() < new Date(curr.nearestExpiry).getTime())) {
          curr.nearestExpiry = expiry;
        }

        if (item.productID && !curr.productID) {
          curr.productID = item.productID;
        }

        if (item.composition && !curr.composition) {
          curr.composition = item.composition;
        }
      }

      const target = grouped.get(genericKey)!;
      target.batches.push({
        batchCode: String(item.batchCode || '').trim(),
        expiryDate: expiry,
        unitsAvailable: Math.max(0, units),
        subUnitsAvailable: Math.max(0, subUnits),
        totalSubUnits: Math.max(0, Number(item.stock?.totalSubUnits ?? 0)),
        mrp: Number(item.packaging?.mrp ?? 0),
        discount: Number(item.packaging?.discountPercent ?? 0),
      });
    }

    return Array.from(grouped.values())
      .map((option) => {
        const days = getDaysToExpiry(option.nearestExpiry);
        const batches = option.batches
          .filter((b) => b.batchCode && b.unitsAvailable > 0)
          .sort((a, b) => {
            const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
          });
        return {
          ...option,
          batches,
          isLowStock: option.totalUnitsAvailable <= option.threshold,
          isCloseToExpiry: days != null && days <= 90,
        };
      })
      .sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [openData, mineData, pharmacyInventory] = await Promise.all([
        icnService.getExchanges({ status: 'OPEN', mine: false }),
        icnService.getExchanges({ mine: true }),
        user?.id ? inventoryService.getInventory(user.id) : Promise.resolve([]),
      ]);

      // Get exchanges where user is destination pharmacy
      const destData = mineData.filter((x) => x.destinationPharmacyID === user?.id || x.acceptedByPharmacyID === user?.id);
      setDestPharmacyExchanges(destData);

      const allPharmacyIds = Array.from(
        new Set(
          [...openData, ...mineData]
            .flatMap((x) => [x.sourcePharmacyID, x.destinationPharmacyID, x.acceptedByPharmacyID])
            .filter((id): id is string => Boolean(id))
        )
      );

      const unresolved = allPharmacyIds.filter((id) => !pharmacyNameMap[id]);
      if (unresolved.length > 0) {
        const fetched = await Promise.all(
          unresolved.map(async (id) => {
            const info = await pharmacyService.getPharmacyById(id);
            return { id, name: info?.name || `Pharmacy ${id.slice(-6).toUpperCase()}` };
          })
        );

        setPharmacyNameMap((prev) => {
          const next = { ...prev };
          for (const row of fetched) next[row.id] = row.name;
          return next;
        });
      }

      setOpenExchanges(openData);
      setMyExchanges(mineData);
      setMedicineOptions(buildMedicineOptions(pharmacyInventory || []));
    } catch (err: any) {
      setError(err?.message || 'Failed to load ICN exchanges');
    } finally {
      setLoading(false);
    }
  }, [user?.id, pharmacyNameMap]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = icnService.subscribeToIcnUpdates(() => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadCurrentPharmacyLocation = async () => {
      if (currentPharmacyLocation) return;

      const loggedInPharmacyID = resolveLoggedInPharmacyId(user);
      if (!loggedInPharmacyID) return;

      try {
        const profile = await pharmacyService.getPharmacyById(loggedInPharmacyID);
        const coords = resolvePharmacyLatLng(profile);
        if (coords) {
          setCurrentPharmacyLocation(coords);
        }
      } catch {
        // Try again when the user state refreshes or the profile endpoint becomes available.
      }
    };

    loadCurrentPharmacyLocation();
  }, [user?.id, user?.pharmaID, currentPharmacyLocation]);

  useEffect(() => {
    if (!showBillModal || !billTarget) return;

    const loadBillDetails = async () => {
      setBillDetailsLoading(true);
      setBillFetchError(null);
      setSourcePharmacyDetail(null);
      setBillMedicineDetail(null);

      try {
        if (!billTarget.sourcePharmacyID) {
          setBillFetchError('Bill loaded with limited details (source pharmacy not found).');
          return;
        }

        const pharmacyPromise = pharmacyService.getPharmacyById(billTarget.sourcePharmacyID);
        const medicinePromise = billTarget.productID
          ? inventoryService.getMedicineDetails(billTarget.productID, billTarget.sourcePharmacyID)
          : Promise.resolve(null as unknown as Medicine);

        const [pharmacyResult, medicineResult] = await Promise.allSettled([pharmacyPromise, medicinePromise]);

        if (pharmacyResult.status === 'fulfilled') {
          setSourcePharmacyDetail(pharmacyResult.value);
        }

        if (medicineResult.status === 'fulfilled') {
          setBillMedicineDetail(medicineResult.value || null);
        }

        if (pharmacyResult.status === 'rejected' && medicineResult.status === 'rejected') {
          setBillFetchError('Could not load bill details. Please try again.');
        } else if (medicineResult.status === 'rejected') {
          setBillFetchError('Bill loaded with limited details (medicine pricing data unavailable).');
        } else if (pharmacyResult.status === 'rejected') {
          setBillFetchError('Bill loaded with limited details (pharmacy info unavailable).');
        }
      } catch (err) {
        console.error('Failed to load bill details:', err);
        setBillFetchError('Could not load bill details. Please try again.');
      } finally {
        setBillDetailsLoading(false);
      }
    };

    loadBillDetails();
  }, [billTarget, showBillModal]);

  const postExchangeNow = async () => {
    const processingStartedAt = Date.now();
    try {
      setPostingExchange(true);
      setError(null);

      const selectedMedicine = medicineOptions.find((m) => m.genericKey === exchangeForm.genericKey);
      if (!selectedMedicine) {
        throw new Error('Please select a medicine first');
      }

      let remaining = Number(exchangeForm.unitsToExchange);
      const legacyBatchDetails = [] as Array<{
        batchCode: string;
        expiryDate: string | null;
        quantity: number;
        mrp: number;
        discount: number;
      }>;

      for (const batch of selectedMedicine.batches) {
        if (remaining <= 0) break;
        const move = Math.min(batch.unitsAvailable, remaining);
        if (move <= 0) continue;
        legacyBatchDetails.push({
          batchCode: batch.batchCode,
          expiryDate: batch.expiryDate,
          quantity: move,
          mrp: batch.mrp,
          discount: batch.discount,
        });
        remaining -= move;
      }

      if (remaining > 0) {
        throw new Error('Insufficient FEFO units available to post this exchange');
      }

      await icnService.postExchange({
        genericKey: exchangeForm.genericKey,
        unitsToExchange: Number(exchangeForm.unitsToExchange),
        productID: selectedMedicine.productID,
        batchDetails: legacyBatchDetails,
      });

      setExchangeForm({
        genericKey: '',
        unitsToExchange: 1,
      });
      setShowExchangeForm(false);
      setShowRiskConfirmModal(false);
      setRiskWarningText('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to post exchange');
    } finally {
      const elapsed = Date.now() - processingStartedAt;
      const remainingDelay = MIN_PROCESSING_OVERLAY_MS - elapsed;
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
      setPostingExchange(false);
    }
  };

  const handlePostExchange = async () => {
    const selectedMedicine = medicineOptions.find((m) => m.genericKey === exchangeForm.genericKey);
    if (!selectedMedicine) {
      setError('Please select a medicine from the dropdown.');
      return;
    }

    const unitsToExchange = Number(exchangeForm.unitsToExchange);

    if (unitsToExchange >= selectedMedicine.totalUnitsAvailable) {
      setShowZeroStockModal(true);
      return;
    }

    const hasExpiredBatch = selectedMedicine.batches.some((batch) => {
      if (!batch.expiryDate) return false;
      return new Date(batch.expiryDate).getTime() < Date.now();
    });

    if (hasExpiredBatch) {
      setShowExpiredModal(true);
      return;
    }

    const daysToExpiry = getDaysToExpiry(selectedMedicine.nearestExpiry);
    if (daysToExpiry != null && daysToExpiry < 0) {
      setShowExpiredModal(true);
      return;
    }

    const warnings = [];
    if (selectedMedicine.isCloseToExpiry) {
      warnings.push('This medicine is close to expiry.');
    }
    if (selectedMedicine.isLowStock) {
      warnings.push('This medicine is low stock.');
    }

    if (warnings.length > 0) {
      setRiskWarningText(`${warnings.join(' ')} Are you sure you want to proceed with posting this exchange?`);
      setShowRiskConfirmModal(true);
      return;
    }

    await postExchangeNow();
  };

  const handlePostRequest = async () => {
    const processingStartedAt = Date.now();
    try {
      setPostingExchange(true);
      setSubmitting(true);
      setError(null);

      await icnService.postRequest({
        genericKey: requestForm.genericKey,
        quantityRequested: Number(requestForm.quantityRequested),
        productID: selectedRequestMedicine?.productID,
      });

      setRequestForm({ genericKey: '', quantityRequested: 1 });
      setShowRequestForm(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to raise request');
    } finally {
      const elapsed = Date.now() - processingStartedAt;
      const remainingDelay = MIN_PROCESSING_OVERLAY_MS - elapsed;
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
      setPostingExchange(false);
      setSubmitting(false);
    }
  };

  const handleAccept = async (exchangeId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      await icnService.acceptExchange(exchangeId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to accept exchange');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPost = async () => {
    if (!cancelTarget?._id) return;
    if (!cancelReason.trim()) {
      setError('Please enter a cancellation reason');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await icnService.cancelExchange(cancelTarget._id, cancelReason.trim());
      setShowCancelModal(false);
      setCancelTarget(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel ICN post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteExchange = async () => {
    if (!completeTarget?._id) return;

    if (paymentMode === 'ONLINE' && !transactionId.trim()) {
      setError('Transaction ID is required for online payment');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await icnService.completeExchange({
        exchangeId: completeTarget._id,
        paymentMode,
        transactionId: paymentMode === 'ONLINE' ? transactionId.trim() : undefined,
      });

      setShowCompleteModal(false);
      setCompleteTarget(null);
      setPaymentMode('CASH');
      setTransactionId('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete ICN exchange');
    } finally {
      setSubmitting(false);
    }
  };

  const startCompleteFlow = (exchange: IcnExchange) => {
    setCompleteConfirmTarget(exchange);
    setShowCompleteConfirmModal(true);
  };

  const proceedToPayment = () => {
    if (!completeConfirmTarget) return;
    setCompleteTarget(completeConfirmTarget);
    setShowCompleteConfirmModal(false);
    setCompleteConfirmTarget(null);
    setShowCompleteModal(true);
  };

  const canSubmitExchange = useMemo(() => {
    return (
      exchangeForm.genericKey.trim().length > 0 &&
      Number(exchangeForm.unitsToExchange) > 0
    );
  }, [exchangeForm]);

  const canSubmitRequest = useMemo(() => {
    return requestForm.genericKey.trim().length > 0 && Number(requestForm.quantityRequested) > 0;
  }, [requestForm]);

  const selectedExchangeMedicine = useMemo(
    () => medicineOptions.find((m) => m.genericKey === exchangeForm.genericKey),
    [medicineOptions, exchangeForm.genericKey]
  );

  const selectedRequestMedicine = useMemo(
    () => medicineOptions.find((m) => m.genericKey === requestForm.genericKey),
    [medicineOptions, requestForm.genericKey]
  );

  const sourceExchangeHistoryItems = useMemo(
    () => myExchanges.filter((item) => item.sourcePharmacyID === user?.id && item.type === 'EXCHANGE'),
    [myExchanges, user?.id]
  );

  const sourceRequestHistoryItems = useMemo(
    () => myExchanges.filter((item) => item.sourcePharmacyID === user?.id && item.type === 'REQUEST'),
    [myExchanges, user?.id]
  );

  const getPosterName = (pharmacyId: string | undefined) => {
    if (!pharmacyId) return 'A pharmacy';
    return pharmacyNameMap[pharmacyId] || `Pharmacy ${pharmacyId.slice(-6).toUpperCase()}`;
  };

  const getDestinationName = (item: IcnExchange) => {
    if (item.destinationPharmacyID) return getPosterName(item.destinationPharmacyID);
    if (item.acceptedByPharmacyID) return getPosterName(item.acceptedByPharmacyID);
    return 'Pending acceptance';
  };

  const myActiveIcnItems = useMemo(
    () => myExchanges.filter((item) => {
      const isAcceptedForCurrentPharmacy =
        item.status === 'ACCEPTED' &&
        (item.sourcePharmacyID === user?.id || item.destinationPharmacyID === user?.id || item.acceptedByPharmacyID === user?.id);

      const isOpenExchangePostedBySource =
        item.type === 'EXCHANGE' && item.status === 'OPEN' && item.sourcePharmacyID === user?.id;

      const isOpenRequestRaisedBySource =
        item.type === 'REQUEST' && item.status === 'OPEN' && item.sourcePharmacyID === user?.id;

      return isAcceptedForCurrentPharmacy || isOpenExchangePostedBySource || isOpenRequestRaisedBySource;
    }),
    [myExchanges, user?.id]
  );

  const myReceivedHistoryItems = useMemo(
    () => destPharmacyExchanges.filter((item) => item.status !== 'ACCEPTED'),
    [destPharmacyExchanges]
  );

  const getMyStockForListing = (listing: IcnExchange): ListingStockMatch | null => {
    const targetName = normalizeText(listing?.medicineName);
    const targetComposition = normalizeText((listing as any)?.composition);

    const match = medicineOptions.find((m) =>
      (listing?.genericKey && m.genericKey === listing.genericKey) ||
      (listing?.productID && m.productID === listing.productID) ||
      (targetName && normalizeText(m.medicineName) === targetName) ||
      (targetComposition && normalizeText(m.composition) === targetComposition)
    );

    if (!match) return null;

    return {
      units: match.totalUnitsAvailable,
      subUnits: match.totalSubUnitsAvailable,
      threshold: match.threshold,
      isLowStock: match.totalUnitsAvailable <= match.threshold,
    };
  };

  const handleViewMedicine = async (listing: IcnExchange) => {
    try {
      setSelectedIcnExchange(listing);
      setSelectedIcnMedicine(null);
      setSelectedIcnPharmacy(null);
      setMedicineDetailsLoading(true);
      setShowIcnMedicineModal(true);

      if (!listing.sourcePharmacyID) {
        throw new Error('Source pharmacy is unavailable for this listing.');
      }

      const pharmacy = await pharmacyService.getPharmacyById(listing.sourcePharmacyID);
      setSelectedIcnPharmacy(pharmacy);

      // For REQUEST entries, productID may not belong to source pharmacy.
      // Try multiple identifiers before falling back to listing-based details.
      const productIdCandidates = [
        listing.sourceProductID,
        listing.productID,
        listing.destinationProductID,
      ].filter((v): v is string => Boolean(v));

      let medicine: Medicine | null = null;
      for (const productId of productIdCandidates) {
        try {
          medicine = await inventoryService.getMedicineDetails(productId, listing.sourcePharmacyID);
          if (medicine) break;
        } catch {
          // Try next candidate.
        }
      }

      if (!medicine) {
        const fallbackName = listing.medicineName || listing.genericKey || 'Requested medicine';
        medicine = {
          productID: listing.productID || listing.sourceProductID || listing.destinationProductID || `REQ-${listing._id}`,
          medicineName: fallbackName,
          composition: listing.composition || 'N/A',
          description:
            listing.type === 'REQUEST'
              ? `Requested quantity: ${Number(listing.quantityRequested || 0)} unit(s).`
              : 'Medicine details are limited for this listing.',
          stock: {
            unitsAvailable: Number(listing.quantityRequested || 0),
          },
          packaging: {
            quantityDescription:
              listing.type === 'REQUEST'
                ? `Requested: ${Number(listing.quantityRequested || 0)} unit(s)`
                : undefined,
          },
        };
      }

      setSelectedIcnMedicine(medicine);

      const sourceCoords = resolvePharmacyLatLng(pharmacy);
      if (sourceCoords && listing.sourcePharmacyID) {
        setPharmacyLocationMap((prev) => ({ ...prev, [listing.sourcePharmacyID!]: sourceCoords }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load medicine details');
    } finally {
      setMedicineDetailsLoading(false);
    }
  };

  const handlePrintBill = () => {
    const printContent = billRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ICN Bill</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background: #ecfdf5; color: #047857; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleViewExchange = async (exchange: IcnExchange) => {
    try {
      setSelectedExchangeDetail(exchange);
      setSourcePharmacyDetail(null);
      setDestinationPharmacyDetail(null);
      setExchangeDetailLoading(true);
      setShowExchangeDetailModal(true);

      // Load both source and destination pharmacy details
      const pharmacyPromises = [];
      if (exchange.sourcePharmacyID) {
        pharmacyPromises.push({
          id: exchange.sourcePharmacyID,
          type: 'source',
          promise: pharmacyService.getPharmacyById(exchange.sourcePharmacyID),
        });
      }
      if (exchange.destinationPharmacyID) {
        pharmacyPromises.push({
          id: exchange.destinationPharmacyID,
          type: 'destination',
          promise: pharmacyService.getPharmacyById(exchange.destinationPharmacyID),
        });
      } else if (exchange.acceptedByPharmacyID) {
        pharmacyPromises.push({
          id: exchange.acceptedByPharmacyID,
          type: 'destination',
          promise: pharmacyService.getPharmacyById(exchange.acceptedByPharmacyID),
        });
      }

      const results = await Promise.all(
        pharmacyPromises.map(async (p) => ({
          type: p.type,
          pharmacy: await p.promise,
        }))
      );

      results.forEach((result) => {
        if (result.type === 'source') {
          setSourcePharmacyDetail(result.pharmacy);
        } else if (result.type === 'destination') {
          setDestinationPharmacyDetail(result.pharmacy);
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load exchange details');
    } finally {
      setExchangeDetailLoading(false);
    }
  };

  const handleOpenSourceDirections = (sourcePharmacyID: string | undefined) => {
    setError(null);

    if (!sourcePharmacyID) {
      setError('Source pharmacy is unavailable for directions.');
      return;
    }

    const cachedDestination = pharmacyLocationMap[sourcePharmacyID] ?? null;
    const selectedDestination =
      selectedIcnExchange?.sourcePharmacyID === sourcePharmacyID ? resolvePharmacyLatLng(selectedIcnPharmacy) : null;
    const destination = cachedDestination || selectedDestination;

    if (!destination) {
      setError('Source pharmacy location is unavailable for directions. Please reopen View Medicine and try again.');
      return;
    }

    const loggedInPharmacyID = resolveLoggedInPharmacyId(user);
    if (!loggedInPharmacyID) {
      setError('Logged-in pharmacy id is unavailable, so route cannot be plotted yet.');
      return;
    }

    pharmacyService.getPharmacyById(loggedInPharmacyID)
      .then((profile) => {
        const loggedInCoords = resolvePharmacyLatLng(profile);
        if (!loggedInCoords) {
          setError('Logged-in pharmacy location is unavailable, so route cannot be plotted yet.');
          return;
        }

        const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${loggedInCoords.latitude},${loggedInCoords.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving&dir_action=navigate`;
        window.open(mapUrl, '_blank');
      })
      .catch(() => {
        setError('Logged-in pharmacy location is unavailable, so route cannot be plotted yet.');
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center rounded-xl bg-white border px-6 py-5">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Inter-Clinic Network Exchange</h3>
          <p className="text-sm text-gray-600 mt-1">Exchange excess stock or request medicines from nearby pharmacies</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowRequestForm((prev) => !prev)}>
            <Plus className="w-4 h-4 mr-2" />
            Raise Request
          </Button>
          <Button onClick={() => setShowExchangeForm((prev) => !prev)}>
            <Plus className="w-4 h-4 mr-2" />
            Post Exchange
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
        <h4 className="text-sm font-semibold">⚠️ Important Notice – ICN Transactions</h4>
        <p className="text-sm mt-2">
          The Inter-Pharmacy Network (ICN) module is a voluntary stock exchange system between pharmacies. All exchanges and requests are initiated manually based on individual pharmacy decisions.
        </p>

        <p className="text-sm mt-3 font-medium">Please note:</p>
        <ul className="list-disc pl-5 mt-1 text-sm space-y-1">
          <li>ICN transactions are independent of the AI-based demand forecasting system.</li>
          <li>The system does not validate whether the exchange aligns with predicted demand or optimal stock levels.</li>
          <li>Pharmacies are responsible for verifying stock requirements, expiry dates, and pricing before accepting any exchange.</li>
        </ul>

        <p className="text-sm mt-3">
          It is advised to use ICN only when there is a clear business need, such as excess inventory or urgent stock requirements.
        </p>
        <p className="text-sm mt-2">
          All ICN transactions are performed at the discretion and responsibility of the participating pharmacies.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'marketplace' as const, label: 'Available ICN Posts' },
            { key: 'post-exchange-history' as const, label: 'My Post Exchange History' },
            { key: 'raise-request-history' as const, label: 'My Raise Request History' },
            { key: 'received-history' as const, label: 'My ICN History' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {showExchangeForm && (
        <Card className="border-emerald-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-emerald-800">Post Exchange</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Choose medicine to post for exchange and enter only the number of units.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Choose Medicine To Post For Exchange
                </label>
                <select
                  className="border rounded-md px-3 py-2 text-sm w-full"
                  value={exchangeForm.genericKey}
                  onChange={(e) => setExchangeForm((prev) => ({ ...prev, genericKey: e.target.value }))}
                >
                  <option value="">Select medicine</option>
                  {medicineOptions.map((medicine) => (
                    <option key={medicine.genericKey} value={medicine.genericKey}>
                      {medicine.medicineName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Number Of Quantities (Units Only)
                </label>
                <input
                  className="border rounded-md px-3 py-2 text-sm w-full"
                  type="number"
                  min={1}
                  placeholder="Enter units"
                  value={exchangeForm.unitsToExchange}
                  onChange={(e) => setExchangeForm((prev) => ({ ...prev, unitsToExchange: Number(e.target.value) }))}
                />
              </div>
            </div>

            {selectedExchangeMedicine && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs text-emerald-700">Nearest Expiry</p>
                  <p className="font-semibold text-emerald-900">{formatDate(selectedExchangeMedicine.nearestExpiry)}</p>
                </div>
                <div className="rounded-lg bg-cyan-50 border border-cyan-200 p-3">
                  <p className="text-xs text-cyan-700">Units Available</p>
                  <p className="font-semibold text-cyan-900">{selectedExchangeMedicine.totalUnitsAvailable}</p>
                </div>
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                  <p className="text-xs text-sky-700">Subunits Available</p>
                  <p className="font-semibold text-sky-900">{selectedExchangeMedicine.totalSubUnitsAvailable}</p>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
                  <p className="text-xs text-violet-700">Total Subunits (Batches)</p>
                  <p className="font-semibold text-violet-900">{selectedExchangeMedicine.totalSubUnitsInBatches}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-700">Risk Flags</p>
                  <p className="font-semibold text-amber-900">
                    {selectedExchangeMedicine.isLowStock ? 'Low Stock ' : ''}
                    {selectedExchangeMedicine.isCloseToExpiry ? 'Close To Expiry' : ''}
                    {!selectedExchangeMedicine.isLowStock && !selectedExchangeMedicine.isCloseToExpiry ? 'Normal' : ''}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExchangeForm(false);
                  setExchangeForm({ genericKey: '', unitsToExchange: 1 });
                  setError(null);
                }}
                disabled={postingExchange}
              >
                Cancel
              </Button>
              <Button onClick={handlePostExchange} disabled={!canSubmitExchange || postingExchange}>
                {postingExchange ? 'Posting exchange...' : 'Submit Exchange'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showRequestForm && (
        <Card className="border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-800">Raise Request</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                className="border rounded-md px-3 py-2 text-sm"
                value={requestForm.genericKey}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, genericKey: e.target.value }))}
              >
                <option value="">Select medicine</option>
                {medicineOptions.map((medicine) => (
                  <option key={medicine.genericKey} value={medicine.genericKey}>
                    {medicine.medicineName}
                  </option>
                ))}
              </select>
              <input
                className="border rounded-md px-3 py-2 text-sm"
                type="number"
                min={1}
                placeholder="Quantity Requested"
                value={requestForm.quantityRequested}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, quantityRequested: Number(e.target.value) }))}
              />
            </div>

            {selectedRequestMedicine && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  Available internally: {selectedRequestMedicine.totalUnitsAvailable} units, {selectedRequestMedicine.totalSubUnitsAvailable} subunits.
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={handlePostRequest} disabled={!canSubmitRequest || submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'marketplace' && (
      <Card>
        <CardHeader>
          <CardTitle>Available ICN Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500">Loading exchanges...</p>
            ) : openExchanges.length === 0 ? (
              <p className="text-sm text-gray-500">No open ICN listings found.</p>
            ) : (
              openExchanges.map((listing) => {
                const totalQty = getExchangeUnits(listing);
                const statusMeta = getStatusMeta(listing.status);
                const myStock = getMyStockForListing(listing);

                const isMine = listing.sourcePharmacyID === user?.id;

                return (
                  <div key={listing._id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-emerald-50/30 bg-white">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 mb-2">
                        {listing.type === 'EXCHANGE'
                          ? `${getPosterName(listing.sourcePharmacyID)} is posting this exchange and would like to offer ${totalQty} unit${totalQty !== 1 ? 's' : ''} of ${listing.medicineName || 'this medicine'}.`
                          : `${getPosterName(listing.sourcePharmacyID)} is requesting ${totalQty} unit${totalQty !== 1 ? 's' : ''} of ${listing.medicineName || 'this medicine'} from nearby pharmacies.`}
                      </p>

                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{listing.medicineName || listing.composition || 'Unknown medicine'}</h4>
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200" variant="outline">{listing.type === 'REQUEST' ? 'Request' : 'Exchange'}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">{totalQty} units</Badge>
                        <Badge className={statusMeta.color} variant="outline">{statusMeta.label}</Badge>
                      </div>

                      <div className="space-y-1.5 mb-2 text-xs">
                        <p className="text-emerald-700 font-medium">
                          {listing.type === 'REQUEST' ? 'Requested Units' : 'Posted Units'}: <span className="text-gray-800 font-semibold">{totalQty}</span>
                        </p>
                        <p className="text-blue-700 font-medium">
                          My Pharmacy Units: <span className="text-gray-800 font-semibold">{myStock ? myStock.units : 'Not available'}</span>
                        </p>
                        <p className="text-cyan-700 font-medium">
                          My Pharmacy Subunits: <span className="text-gray-800 font-semibold">{myStock ? myStock.subUnits : 'Not available'}</span>
                        </p>
                        <p className="text-amber-700 font-medium">
                          Expiry Date: <span className="text-gray-800 font-semibold">{formatDate(listing.postedSnapshot?.nearestExpiry || listing.batchDetails?.[0]?.expiryDate)}</span>
                        </p>
                        <p className="text-purple-700 font-medium">
                          {listing.type === 'REQUEST' ? 'Requested By' : 'Posted By'}: <span className="text-gray-800 font-semibold">{getPosterName(listing.sourcePharmacyID)}</span>
                        </p>
                        {listing.expiresAt && (
                          <p className="text-rose-700 font-medium flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            Post Expires In: <span className="text-gray-800 font-semibold">{formatCountdown(listing.expiresAt, nowMs)}</span>
                          </p>
                        )}
                      </div>

                      {myStock?.isLowStock && (
                        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                          <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            SynmedProcAi suggestion
                          </p>
                          <p className="text-xs text-violet-700 mt-1">
                            Your pharmacy currently has low stock for this medicine. You may consider accepting this exchange to replenish inventory.
                          </p>
                        </div>
                      )}

                      {listing.postedSnapshot?.nearestExpiry && (
                        <p className="text-xs text-gray-500 mb-2">
                          Nearest expiry in posting pharmacy: {formatDate(listing.postedSnapshot.nearestExpiry)}
                        </p>
                      )}

                      {listing.type === 'REQUEST' && (
                        <p className="text-sm text-gray-600">
                          Requested quantity: {listing.quantityRequested || 0} units
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={medicineDetailsLoading}
                        onClick={() => handleViewMedicine(listing)}
                      >
                        View Medicine
                      </Button>
                      {!isMine && listing.status === 'OPEN' && (
                        <Button size="sm" disabled={submitting} onClick={() => handleAccept(listing._id)}>
                          {listing.type === 'REQUEST' ? 'Accept Request' : 'Accept'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'post-exchange-history' && (
      <Card>
        <CardHeader>
          <CardTitle>My Post Exchange History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading your posted exchanges...</p>
          ) : sourceExchangeHistoryItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No ICN exchange posts yet</p>
            </div>
          ) : (
            <>
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All Exchange Posts
                </button>
                <button
                  onClick={() => { setFilterType('accepted & yet to receive'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterType === 'accepted & yet to receive' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Accepted & Yet to Receive
                </button>
                <button
                  onClick={() => { setFilterType('accepted & received'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterType === 'accepted & received' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Accepted & Received
                </button>
                <button
                  onClick={() => { setFilterType('cancelled'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterType === 'cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancelled
                </button>
                <button
                  onClick={() => { setFilterType('timed out and cancelled'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterType === 'timed out and cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Timed out & Cancelled
                </button>
              </div>

              {/* Table */}
              {(() => {
                const filtered = sourceExchangeHistoryItems.filter((item) => {
                  if (filterType === 'all') return true;
                  if (filterType === 'accepted & yet to receive') return item.status === 'ACCEPTED';
                  if (filterType === 'accepted & received') return item.status === 'COMPLETED';
                  if (filterType === 'cancelled') return item.status === 'CANCELLED';
                  if (filterType === 'timed out and cancelled') return item.status === 'TIME_EXPIRED';
                  return false;
                });

                const totalPages = Math.ceil(filtered.length / itemsPerPage);
                const paginatedItems = filtered.slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                );

                return (
                  <>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Medicine</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Source Pharmacy</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Destination Pharmacy</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                No listings found for this filter
                              </td>
                            </tr>
                          ) : (
                            paginatedItems.map((item) => {
                              const statusMeta = getStatusMeta(item.status);
                              const typeMeta = getTypeMeta(item.type);
                              return (
                                <tr key={item._id} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-900 font-medium">
                                    {item.medicineName || item.composition || 'Unknown medicine'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge className={typeMeta.color} variant="outline">{typeMeta.label}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">{getPosterName(item.sourcePharmacyID)}</td>
                                  <td className="px-4 py-3 text-gray-700">{getDestinationName(item)}</td>
                                  <td className="px-4 py-3">
                                    <Badge className={statusMeta.color} variant="outline">
                                      {statusMeta.label}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col items-start gap-2">
                                      {getIcnActionTimerLabel(item, nowMs) && (
                                        <div className={`flex items-center gap-1 w-max text-xs px-2 py-1 rounded ${item.status === 'OPEN' ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100'}`}>
                                          <Clock3 className="w-3 h-3" />
                                          <span className="font-medium">{getIcnActionTimerLabel(item, nowMs)}</span>
                                        </div>
                                      )}

                                      <div className="flex gap-2 flex-wrap">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={exchangeDetailLoading}
                                        onClick={() => handleViewExchange(item)}
                                      >
                                        View Details
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={item.status !== 'COMPLETED'}
                                        onClick={() => {
                                          setBillTarget(item);
                                          setShowBillModal(true);
                                        }}
                                      >
                                        View Bill
                                      </Button>

                                      {item.status === 'OPEN' && item.sourcePharmacyID === user?.id && (
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          disabled={submitting}
                                          onClick={() => {
                                            setCancelTarget(item);
                                            setCancelReason('');
                                            setShowCancelModal(true);
                                          }}
                                        >
                                          Cancel Post
                                        </Button>
                                      )}

                                      {item.status === 'ACCEPTED' && item.sourcePharmacyID === user?.id && (
                                        <Button
                                          size="sm"
                                          className="bg-blue-500 hover:bg-blue-600 text-white"
                                          disabled={submitting}
                                          onClick={() => startCompleteFlow(item)}
                                        >
                                          Mark As Completed
                                        </Button>
                                      )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="px-4 py-4 border-t flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} items
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="inline-flex items-center gap-1"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                          >
                            <ChevronLeft className="w-4 h-4 shrink-0" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              let page;
                              if (totalPages <= 5) {
                                page = i + 1;
                              } else if (currentPage <= 3) {
                                page = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                page = totalPages - 4 + i;
                              } else {
                                page = currentPage - 2 + i;
                              }
                              return (
                                <button
                                  key={page}
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-2 rounded ${
                                    currentPage === page
                                      ? 'bg-emerald-600 text-white font-semibold'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            className="inline-flex items-center gap-1"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 shrink-0" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Destination Pharmacy Active ICN */}
      {activeTab === 'marketplace' && (
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">My Active ICN</h2>
                <p className="text-sm text-gray-500 mt-1">Accepted requests/exchanges and active requests raised by you</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {myActiveIcnItems.length === 0 ? (
              <p className="text-sm text-gray-500">No active ICN items right now.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Medicine</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Source Pharmacy</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Destination Pharmacy</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myActiveIcnItems.map((item) => {
                      const statusMeta = getStatusMeta(item.status);
                      const typeMeta = getTypeMeta(item.type);

                      const canCancelInTransit =
                        item.status === 'OPEN' && item.sourcePharmacyID === user?.id;

                      const canCompleteHere =
                        item.status === 'ACCEPTED' && (
                          (item.type === 'EXCHANGE' && item.sourcePharmacyID === user?.id) ||
                          (item.type === 'REQUEST' && item.destinationPharmacyID === user?.id)
                        );

                      return (
                        <tr key={item._id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">{item.medicineName || item.composition || 'Unknown medicine'}</td>
                          <td className="px-4 py-3">
                            <Badge className={typeMeta.color} variant="outline">{typeMeta.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{getPosterName(item.sourcePharmacyID)}</td>
                          <td className="px-4 py-3 text-gray-700">{getDestinationName(item)}</td>
                          <td className="px-4 py-3">
                            <Badge className={statusMeta.color} variant="outline">
                              {statusMeta.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-2">
                              {getIcnActionTimerLabel(item, nowMs) && (
                                <div className="flex items-center gap-1 w-max text-xs px-2 py-1 rounded text-blue-600 bg-blue-100">
                                  <Clock3 className="w-3 h-3" />
                                  <span className="font-medium">{getIcnActionTimerLabel(item, nowMs)}</span>
                                </div>
                              )}
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={exchangeDetailLoading}
                                  onClick={() => handleViewExchange(item)}
                                >
                                  View Details
                                </Button>

                                {canCancelInTransit && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={submitting}
                                    onClick={() => {
                                      setCancelTarget(item);
                                      setCancelReason('');
                                      setShowCancelModal(true);
                                    }}
                                  >
                                    {item.type === 'REQUEST' ? 'Cancel Request' : 'Cancel Post'}
                                  </Button>
                                )}

                                {canCompleteHere && (
                                  <Button
                                    size="sm"
                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                    disabled={submitting}
                                    onClick={() => startCompleteFlow(item)}
                                  >
                                    Mark As Completed
                                  </Button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Source Pharmacy Request History */}
      {activeTab === 'raise-request-history' && (
      <Card className="shadow-lg border-emerald-200">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">My Raise Request History</h2>
              <p className="text-sm text-gray-500 mt-1">Requests created by your pharmacy</p>
            </div>
            <div className="text-2xl"></div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {(() => {
            const filteredDest = sourceRequestHistoryItems.filter((item) => {
              if (filterType === 'all') return true;
              if (filterType === 'accepted & yet to receive') return item.status === 'ACCEPTED';
              if (filterType === 'accepted & received') return item.status === 'COMPLETED';
              if (filterType === 'cancelled') return item.status === 'CANCELLED';
              if (filterType === 'timed out and cancelled') return item.status === 'TIME_EXPIRED';
              return false;
            });

            const totalPagesDest = Math.ceil(filteredDest.length / itemsPerPage);
            const paginatedItemsDest = filteredDest.slice(
              (currentPageDest - 1) * itemsPerPage,
              currentPageDest * itemsPerPage
            );

            return (
              <>
                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2 mb-4 pt-4">
                  {[
                    { value: 'all' as const, label: 'All' },
                    { value: 'accepted & yet to receive' as const, label: 'Accepted & Yet to Receive' },
                    { value: 'accepted & received' as const, label: 'Accepted & Received' },
                    { value: 'cancelled' as const, label: 'Cancelled' },
                    { value: 'timed out and cancelled' as const, label: 'Timed Out & Cancelled' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterType(option.value);
                        setCurrentPageDest(1);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        filterType === option.value
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Medicine</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Source Pharmacy</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Destination Pharmacy</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItemsDest.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No requests found for this filter
                          </td>
                        </tr>
                      ) : (
                        paginatedItemsDest.map((item) => {
                          const statusMeta = getStatusMeta(item.status);
                          const typeMeta = getTypeMeta(item.type);
                          const canCancelRequest = item.status === 'OPEN' && item.sourcePharmacyID === user?.id;

                          return (
                            <tr key={item._id} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900 font-medium">
                                {item.medicineName || item.composition || 'Unknown medicine'}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={typeMeta.color} variant="outline">{typeMeta.label}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{getPosterName(item.sourcePharmacyID)}</td>
                              <td className="px-4 py-3 text-gray-700">{getDestinationName(item)}</td>
                              <td className="px-4 py-3">
                                <Badge className={statusMeta.color} variant="outline">
                                  {statusMeta.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col items-start gap-2">
                                  {getIcnActionTimerLabel(item, nowMs) && (
                                    <div className={`flex items-center gap-1 w-max text-xs px-2 py-1 rounded ${item.status === 'OPEN' ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100'}`}>
                                      <Clock3 className="w-3 h-3" />
                                      <span className="font-medium">{getIcnActionTimerLabel(item, nowMs)}</span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={exchangeDetailLoading}
                                    onClick={() => handleViewExchange(item)}
                                  >
                                    View Details
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={item.status !== 'COMPLETED'}
                                    onClick={() => {
                                      setBillTarget(item);
                                      setShowBillModal(true);
                                    }}
                                  >
                                    View Bill
                                  </Button>

                                  {canCancelRequest && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={submitting}
                                      onClick={() => {
                                        setCancelTarget(item);
                                        setCancelReason('');
                                        setShowCancelModal(true);
                                      }}
                                    >
                                      Cancel Request
                                    </Button>
                                  )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPagesDest > 1 && (
                  <div className="px-4 py-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPageDest - 1) * itemsPerPage + 1} to {Math.min(currentPageDest * itemsPerPage, filteredDest.length)} of {filteredDest.length} items
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="inline-flex items-center gap-1"
                        disabled={currentPageDest === 1}
                        onClick={() => setCurrentPageDest(currentPageDest - 1)}
                      >
                        <ChevronLeft className="w-4 h-4 shrink-0" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: Math.min(totalPagesDest, 5) }, (_, i) => {
                          let page;
                          if (totalPagesDest <= 5) {
                            page = i + 1;
                          } else if (currentPageDest <= 3) {
                            page = i + 1;
                          } else if (currentPageDest >= totalPagesDest - 2) {
                            page = totalPagesDest - 4 + i;
                          } else {
                            page = currentPageDest - 2 + i;
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPageDest(page)}
                              className={`px-3 py-2 rounded ${
                                currentPageDest === page
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        className="inline-flex items-center gap-1"
                        disabled={currentPageDest === totalPagesDest}
                        onClick={() => setCurrentPageDest(currentPageDest + 1)}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
      )}

      {/* Destination Pharmacy Exchanges Table */}
      {activeTab === 'received-history' && myReceivedHistoryItems.length > 0 && (
        <Card className="shadow-lg border-emerald-200">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">My ICN History</h2>
                <p className="text-sm text-gray-500 mt-1">All your ICN exchanges with filters</p>
              </div>
              <div className="text-2xl"></div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {(() => {
              const filteredReceived = myReceivedHistoryItems.filter((item) => {
                if (filterType === 'all') return true;
                if (filterType === 'accepted & yet to receive') return item.status === 'ACCEPTED';
                if (filterType === 'accepted & received') return item.status === 'COMPLETED';
                if (filterType === 'cancelled') return item.status === 'CANCELLED';
                if (filterType === 'timed out and cancelled') return item.status === 'TIME_EXPIRED';
                return false;
              });

              const totalPagesReceived = Math.ceil(filteredReceived.length / itemsPerPage);
              const paginatedReceived = filteredReceived.slice(
                (currentPageReceived - 1) * itemsPerPage,
                currentPageReceived * itemsPerPage
              );

              return (
                <>
                  <div className="flex flex-wrap gap-2 mb-4 pt-4">
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'accepted & yet to receive' as const, label: 'Accepted & Yet to Receive' },
                      { value: 'accepted & received' as const, label: 'Accepted & Received' },
                      { value: 'cancelled' as const, label: 'Cancelled' },
                      { value: 'timed out and cancelled' as const, label: 'Timed Out & Cancelled' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterType(option.value);
                          setCurrentPageReceived(1);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          filterType === option.value
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Medicine</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Source Pharmacy</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Destination Pharmacy</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReceived.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No exchanges found for this filter
                            </td>
                          </tr>
                        ) : (
                          paginatedReceived.map((item) => {
                            const statusMeta = getStatusMeta(item.status);
                            const typeMeta = getTypeMeta(item.type);
                            return (
                              <tr key={item._id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-900 font-medium">
                                  {item.medicineName || item.composition || 'Unknown medicine'}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={typeMeta.color} variant="outline">{typeMeta.label}</Badge>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{getPosterName(item.sourcePharmacyID)}</td>
                                <td className="px-4 py-3 text-gray-700">{getDestinationName(item)}</td>
                                <td className="px-4 py-3">
                                  <Badge className={statusMeta.color} variant="outline">
                                    {statusMeta.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col items-start gap-2">
                                    {getIcnActionTimerLabel(item, nowMs) && (
                                      <div className={`flex items-center gap-1 w-max text-xs px-2 py-1 rounded ${item.status === 'OPEN' ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100'}`}>
                                        <Clock3 className="w-3 h-3" />
                                        <span className="font-medium">{getIcnActionTimerLabel(item, nowMs)}</span>
                                      </div>
                                    )}

                                    <div className="flex gap-2 flex-wrap">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={exchangeDetailLoading}
                                        onClick={() => handleViewExchange(item)}
                                      >
                                        View Details
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={item.status !== 'COMPLETED'}
                                        onClick={() => {
                                          setBillTarget(item);
                                          setShowBillModal(true);
                                        }}
                                      >
                                        View Bill
                                      </Button>

                                      {item.status === 'OPEN' && item.sourcePharmacyID !== user?.id && (
                                        <Button
                                          size="sm"
                                          disabled={submitting}
                                          onClick={() => handleAccept(item._id)}
                                        >
                                          {item.type === 'REQUEST' ? 'Accept Request' : 'Accept'}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPagesReceived > 1 && (
                    <div className="px-4 py-4 border-t flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {(currentPageReceived - 1) * itemsPerPage + 1} to {Math.min(currentPageReceived * itemsPerPage, filteredReceived.length)} of {filteredReceived.length} items
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="inline-flex items-center gap-1"
                          disabled={currentPageReceived === 1}
                          onClick={() => setCurrentPageReceived(currentPageReceived - 1)}
                        >
                          <ChevronLeft className="w-4 h-4 shrink-0" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: Math.min(totalPagesReceived, 5) }, (_, i) => {
                            let page;
                            if (totalPagesReceived <= 5) {
                              page = i + 1;
                            } else if (currentPageReceived <= 3) {
                              page = i + 1;
                            } else if (currentPageReceived >= totalPagesReceived - 2) {
                              page = totalPagesReceived - 4 + i;
                            } else {
                              page = currentPageReceived - 2 + i;
                            }
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPageReceived(page)}
                                className={`px-3 py-2 rounded ${
                                  currentPageReceived === page
                                    ? 'bg-emerald-600 text-white font-semibold'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          className="inline-flex items-center gap-1"
                          disabled={currentPageReceived === totalPagesReceived}
                          onClick={() => setCurrentPageReceived(currentPageReceived + 1)}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {activeTab === 'received-history' && myReceivedHistoryItems.length === 0 && (
        <Card className="shadow-lg border-emerald-200">
          <CardHeader>
            <CardTitle>My ICN History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">No ICN history yet.</p>
          </CardContent>
        </Card>
      )}

      {showBillModal && billTarget && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bill Details</h2>
                <p className="text-xs text-gray-500">ICN-{billTarget._id.slice(-8).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintBill}
                  disabled={billDetailsLoading || !sourcePharmacyDetail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button onClick={() => setShowBillModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
            </div>

            {billDetailsLoading ? (
              <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading bill details...
              </div>
            ) : (
            <div className="overflow-y-auto flex-1 p-6" ref={billRef}>
              {(() => {
                const qty = getExchangeUnits(billTarget);
                const fallbackMrp = Number((billTarget.transferredBatchDetails?.[0]?.mrp ?? billTarget.batchDetails?.[0]?.mrp) || 0);
                const fallbackDiscount = Number((billTarget.transferredBatchDetails?.[0]?.discount ?? billTarget.batchDetails?.[0]?.discount) || 0);
                const mrp = Number(billMedicineDetail?.packaging?.mrp ?? fallbackMrp ?? 0);
                const discountPercent = Number(billMedicineDetail?.packaging?.discountPercent ?? fallbackDiscount ?? 0);
                const gstRate = Number(billMedicineDetail?.packaging?.gstRate ?? 0);
                const pricePerUnit = Number(billMedicineDetail?.packaging?.pricePerUnit ?? 0);
                const gross = mrp * qty;
                const discount = gross * (discountPercent / 100);
                const taxable = Math.max(gross - discount, 0);
                const gst = taxable * (gstRate / 100);
                const totalAmount = taxable + gst;

                return (
                  <>
                {billFetchError && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                    {billFetchError}
                  </div>
                )}
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      {resolvePharmacyLogoUrl(sourcePharmacyDetail) ? (
                        <img
                          src={resolvePharmacyLogoUrl(sourcePharmacyDetail)!}
                          alt={resolvePharmacyName(sourcePharmacyDetail)}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🏥</span>
                      )}
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">{resolvePharmacyName(sourcePharmacyDetail)}</h1>
                      <p className="text-sm text-gray-600 mt-1 max-w-xl">{resolvePharmacyAddress(sourcePharmacyDetail)}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span><span className="font-medium text-gray-600">Ph:</span> {resolvePharmacyPhone(sourcePharmacyDetail)}</span>
                        <span><span className="font-medium text-gray-600">License:</span> {(sourcePharmacyDetail as any)?.licenseNumber ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div>
                        <p className="text-xs font-semibold text-emerald-800">Synmed Systems</p>
                        <p className="text-[10px] text-emerald-500">Powered by</p>
                      </div>
                    </div>
                    <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-left">
                      <p className="text-xs text-emerald-700 font-semibold">ICN-{billTarget._id.slice(-8).toUpperCase()}</p>
                      <p className="text-[10px] text-emerald-500">ICN Order</p>
                    </div>
                  </div>
                </div>

              <div className="text-center text-[11px] font-bold tracking-[3px] uppercase text-emerald-800 border-y-2 border-emerald-800 py-2 mb-6">
                ICN Purchase Bill
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Order Details</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Placed:</span> {formatDateTime(billTarget.createdAt)}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Payment:</span> {formatPayment(billTarget.paymentMode || 'CASH')}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Status:</span> {getStatusMeta(billTarget.status).label}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Partner Details</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Source Pharmacy:</span> {getPosterName(billTarget.sourcePharmacyID)}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Destination Pharmacy:</span> {getDestinationName(billTarget)}</p>
                  {billTarget.transactionId && <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Txn ID:</span> {billTarget.transactionId}</p>}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Items</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="bg-emerald-50">
                        <th className="text-left px-4 py-3 font-semibold text-emerald-700">#</th>
                        <th className="text-left px-4 py-3 font-semibold text-emerald-700">Medicine</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">MRP</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">Disc%</th>
                        <th className="text-center px-4 py-3 font-semibold text-emerald-700">Qty</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">Price/Unit</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">GST%</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">Taxable</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">GST</th>
                        <th className="text-right px-4 py-3 font-semibold text-emerald-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="text-gray-400 font-medium px-4 py-3">1</td>
                        <td className="font-semibold text-slate-900 px-4 py-3">{billTarget.medicineName || billTarget.composition || 'Unknown'}</td>
                        <td className="text-right font-mono px-4 py-3">₹{mrp.toFixed(2)}</td>
                        <td className="text-right px-4 py-3 text-emerald-600 font-medium">{discountPercent.toFixed(2)}%</td>
                        <td className="text-center font-semibold px-4 py-3">{qty}</td>
                        <td className="text-right font-mono px-4 py-3">₹{pricePerUnit.toFixed(2)}</td>
                        <td className="text-right px-4 py-3">{gstRate.toFixed(2)}%</td>
                        <td className="text-right font-mono px-4 py-3">₹{taxable.toFixed(2)}</td>
                        <td className="text-right font-mono px-4 py-3">₹{gst.toFixed(2)}</td>
                        <td className="text-right font-mono font-semibold px-4 py-3">₹{totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:ml-auto lg:min-w-[280px] mt-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Summary</p>
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Gross Amount</span>
                    <span className="font-mono">₹{gross.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Discount</span>
                    <span className="font-mono text-emerald-600">- ₹{discount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Taxable Amount</span>
                    <span className="font-mono">₹{taxable.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Total GST</span>
                    <span className="font-mono">₹{gst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
                    <span className="text-sm font-bold uppercase tracking-wide">Net Payable</span>
                    <span className="font-mono font-bold text-base">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 mt-6 pt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This is a computer-generated bill and does not require a signature.
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-2">
                    {resolvePharmacyName(sourcePharmacyDetail)}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Synmed Systems</p>
                    <p className="text-[10px] text-emerald-500">Pharmacy Management</p>
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
            )}

            <div className="border-t p-4 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setShowBillModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showExpiredModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-red-200 shadow-xl p-5">
            <h4 className="text-lg font-semibold text-red-700 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Cannot Post Exchange
            </h4>
            <p className="text-sm text-gray-700 mt-2">
              This medicine has reached expiry in your pharmacy, so ICN exchange cannot be initiated.
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowExpiredModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showZeroStockModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-amber-200 shadow-xl p-5">
            <h4 className="text-lg font-semibold text-amber-700 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Cannot Post Exchange
            </h4>
            <p className="text-sm text-gray-700 mt-2">
              You cannot initiate this exchange because the entered quantity will reduce your current stock to 0.
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowZeroStockModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRiskConfirmModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-amber-200 shadow-xl p-5">
            <h4 className="text-lg font-semibold text-amber-800">Confirm Exchange Post</h4>
            <p className="text-sm text-gray-700 mt-2">{riskWarningText}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRiskConfirmModal(false)} disabled={postingExchange}>
                Cancel
              </Button>
              <Button onClick={postExchangeNow} disabled={postingExchange}>
                {postingExchange ? 'Posting exchange...' : 'Proceed Anyway'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-xl p-5">
            <h4 className="text-lg font-semibold text-gray-900">{cancelTarget?.type === 'REQUEST' ? 'Cancel This ICN Request?' : 'Cancel This ICN Post?'}</h4>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to cancel this {cancelTarget?.type === 'REQUEST' ? 'request' : 'post'}? Please enter a cancellation reason.
            </p>
            <textarea
              className="mt-3 border rounded-md px-3 py-2 text-sm w-full min-h-[110px]"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={submitting} onClick={() => setShowCancelModal(false)}>
                Back
              </Button>
              <Button disabled={submitting || !cancelReason.trim()} onClick={handleCancelPost}>
                {submitting ? 'Cancelling...' : (cancelTarget?.type === 'REQUEST' ? 'Cancel Request' : 'Cancel Post')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Mark ICN Completed</h2>
                <p className="text-xs text-gray-500">{completeTarget ? `ICN-${completeTarget._id.slice(-8).toUpperCase()}` : ''}</p>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <span className="text-xs text-emerald-700 font-medium tracking-wide">
                  Payment Mode: <span className="font-bold">PAY_AT_PHARMACY - {paymentMode}</span>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  How did destination pharmacy pay?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'ONLINE' as const, label: 'Online', sub: 'UPI / Card / Net Banking', icon: '📲' },
                    { value: 'CASH' as const, label: 'Cash', sub: 'Physical cash', icon: '💵' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPaymentMode(opt.value);
                        setTransactionId('');
                        setError(null);
                      }}
                      className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        paymentMode === opt.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">{opt.icon}</span>
                        {opt.label}
                      </span>
                      <span className="text-[10px] font-normal text-gray-400 ml-0.5">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'ONLINE' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Transaction ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter UPI / card / net banking reference ID"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
              )}

              <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center text-sm">
                <span className="text-gray-500">Exchange Quantity</span>
                <span className="font-bold text-gray-900">{completeTarget ? getExchangeUnits(completeTarget) : 0} units</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3 justify-end bg-gray-50">
              <Button variant="outline" disabled={submitting} onClick={() => setShowCompleteModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={submitting}
                onClick={handleCompleteExchange}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Completing...' : 'Confirm & Complete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompleteConfirmModal && completeConfirmTarget && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-xl p-5">
            <h4 className="text-lg font-semibold text-gray-900">Proceed To ICN Checkout?</h4>
            <p className="text-sm text-gray-600 mt-2">
              You are about to complete this ICN transfer for {getExchangeUnits(completeConfirmTarget)} unit{getExchangeUnits(completeConfirmTarget) !== 1 ? 's' : ''}. Continue to payment confirmation?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowCompleteConfirmModal(false);
                setCompleteConfirmTarget(null);
              }}>
                Back
              </Button>
              <Button onClick={proceedToPayment}>
                Proceed To Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {postingExchange && (
        <div className="fixed inset-0 z-[1100] bg-black/45 flex items-center justify-center p-4">
          <div className="rounded-xl bg-white border shadow-xl px-6 py-5 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Processing your request</p>
              <p className="text-xs text-gray-600">Please wait while we process your ICN exchange request...</p>
            </div>
          </div>
        </div>
      )}

      {showExchangeDetailModal && selectedExchangeDetail && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold">Exchange Details</h2>
                <p className="text-sm text-gray-500 mt-1">Transaction ID: {selectedExchangeDetail._id.slice(-8)}</p>
              </div>
              <button
                onClick={() => setShowExchangeDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {exchangeDetailLoading ? (
                <div className="py-12 text-center text-gray-600">Loading exchange details...</div>
              ) : (
                <>
                  {/* Pharmacy Cards Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Source Pharmacy Card */}
                    {sourcePharmacyDetail && (
                      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4">Source Pharmacy</h3>
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            {(() => {
                              const logo = (sourcePharmacyDetail as any)?.logo as string | undefined;
                              const logoUrl = logo
                                ? !logo.startsWith('http') ? `http://localhost:5203${logo}` : logo
                                : null;
                              if (logoUrl) {
                                return (
                                  <img
                                    src={logoUrl}
                                    alt={sourcePharmacyDetail.name}
                                    className="w-16 h-16 rounded-full object-cover"
                                  />
                                );
                              }
                              return <span className="text-3xl">🏥</span>;
                            })()}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-blue-900">{sourcePharmacyDetail.name}</h4>
                            <p className="text-xs text-blue-600 mt-1">Posted by</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-blue-800">
                            <span className="font-semibold">Address:</span> {sourcePharmacyDetail.address
                              ? typeof sourcePharmacyDetail.address === 'string'
                                ? sourcePharmacyDetail.address
                                : [
                                    sourcePharmacyDetail.address.line1,
                                    sourcePharmacyDetail.address.line2,
                                    sourcePharmacyDetail.address.city,
                                    sourcePharmacyDetail.address.state,
                                    sourcePharmacyDetail.address.pincode || sourcePharmacyDetail.address.zip,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')
                              : 'N/A'}
                          </p>
                          <p className="text-blue-800">
                            <span className="font-semibold">Phone:</span> {sourcePharmacyDetail.phone || 'N/A'}
                          </p>
                          <p className="text-blue-800">
                            <span className="font-semibold">License:</span> {(sourcePharmacyDetail as any)?.licenseNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Destination Pharmacy Card */}
                    {destinationPharmacyDetail && (
                      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600 mb-4">Destination Pharmacy</h3>
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            {(() => {
                              const logo = (destinationPharmacyDetail as any)?.logo as string | undefined;
                              const logoUrl = logo
                                ? !logo.startsWith('http') ? `http://localhost:5203${logo}` : logo
                                : null;
                              if (logoUrl) {
                                return (
                                  <img
                                    src={logoUrl}
                                    alt={destinationPharmacyDetail.name}
                                    className="w-16 h-16 rounded-full object-cover"
                                  />
                                );
                              }
                              return <span className="text-3xl">🏥</span>;
                            })()}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-emerald-900">{destinationPharmacyDetail.name}</h4>
                            <p className="text-xs text-emerald-600 mt-1">Receiving</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-emerald-800">
                            <span className="font-semibold">Address:</span> {destinationPharmacyDetail.address
                              ? typeof destinationPharmacyDetail.address === 'string'
                                ? destinationPharmacyDetail.address
                                : [
                                    destinationPharmacyDetail.address.line1,
                                    destinationPharmacyDetail.address.line2,
                                    destinationPharmacyDetail.address.city,
                                    destinationPharmacyDetail.address.state,
                                    destinationPharmacyDetail.address.pincode || destinationPharmacyDetail.address.zip,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')
                              : 'N/A'}
                          </p>
                          <p className="text-emerald-800">
                            <span className="font-semibold">Phone:</span> {destinationPharmacyDetail.phone || 'N/A'}
                          </p>
                          <p className="text-emerald-800">
                            <span className="font-semibold">License:</span> {(destinationPharmacyDetail as any)?.licenseNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exchange Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Medicine</p>
                      <p className="mt-2 font-semibold text-slate-900">{selectedExchangeDetail.medicineName || selectedExchangeDetail.composition || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Quantity</p>
                      <p className="mt-2 font-semibold text-slate-900">{getExchangeUnits(selectedExchangeDetail)} unit{getExchangeUnits(selectedExchangeDetail) !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Type</p>
                      <p className="mt-2 font-semibold text-slate-900">{selectedExchangeDetail.type === 'REQUEST' ? 'Request' : 'Exchange'}</p>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
                      <p className="mt-2">
                        <Badge className={getStatusMeta(selectedExchangeDetail.status).color} variant="outline">
                          {getStatusMeta(selectedExchangeDetail.status).label}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900 mb-3">Timeline</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between pb-3 border-b">
                        <span className="text-slate-600 font-medium">Posted</span>
                        <span className="text-slate-900">{formatDate(selectedExchangeDetail.createdAt)}</span>
                      </div>
                      {selectedExchangeDetail.acceptedAt && (
                        <div className="flex items-center justify-between pb-3 border-b">
                          <span className="text-slate-600 font-medium">Accepted</span>
                          <span className="text-slate-900">{formatDate(selectedExchangeDetail.acceptedAt)}</span>
                        </div>
                      )}
                      {selectedExchangeDetail.completedAt && (
                        <div className="flex items-center justify-between pb-3 border-b">
                          <span className="text-slate-600 font-medium">Completed</span>
                          <span className="text-slate-900">{formatDate(selectedExchangeDetail.completedAt)}</span>
                        </div>
                      )}
                      {selectedExchangeDetail.cancellationReason && (
                        <div className="flex items-start justify-between gap-4 pt-3 border-t">
                          <span className="text-slate-600 font-medium">Cancellation Reason</span>
                          <span className="text-slate-900 text-right">{selectedExchangeDetail.cancellationReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Batch Details */}
                  {selectedExchangeDetail.batchDetails && selectedExchangeDetail.batchDetails.length > 0 && (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b">
                        <p className="text-sm font-semibold text-slate-900">Batch Details</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Batch Code</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Expiry Date</th>
                              <th className="text-center px-4 py-2 font-medium text-slate-600">Quantity</th>
                              <th className="text-right px-4 py-2 font-medium text-slate-600">MRP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedExchangeDetail.batchDetails.map((batch, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="px-4 py-2 text-slate-900">{batch.batchCode}</td>
                                <td className="px-4 py-2 text-slate-900">{formatDate(batch.expiryDate)}</td>
                                <td className="px-4 py-2 text-center text-slate-900">{batch.quantity}</td>
                                <td className="px-4 py-2 text-right text-slate-900 font-mono">₹{(batch.mrp || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t p-6 flex justify-end gap-2 bg-slate-50">
              <Button variant="outline" onClick={() => setShowExchangeDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showIcnMedicineModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold">Medicine Details</h2>
                <p className="text-sm text-gray-500 mt-1">Posted by {selectedIcnPharmacy?.name || getPosterName(selectedIcnExchange?.sourcePharmacyID)}</p>
              </div>
              <button onClick={() => setShowIcnMedicineModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {medicineDetailsLoading ? (
                <div className="py-12 text-center text-gray-600">Loading medicine details...</div>
              ) : selectedIcnMedicine ? (
                <>
                  <div className="flex justify-center items-center bg-white rounded-lg border p-4 w-3/4 min-w-60 mx-auto min-h-60">
                    {selectedIcnMedicine.productImageURL ? (
                      <img
                        src={selectedIcnMedicine.productImageURL}
                        alt={selectedIcnMedicine.medicineName}
                        className="max-h-96 w-auto object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="text-7xl">💊</div>';
                        }}
                      />
                    ) : (
                      <div className="text-7xl">💊</div>
                    )}
                  </div>

                  <div className="border-b pb-6">
                    <h3 className="text-xl font-bold text-emerald-800 mb-4">
                      {selectedIcnMedicine.medicineName}
                      <p className="text-gray-600 text-sm pt-1 font-normal">{selectedIcnMedicine.packaging?.quantityDescription}</p>
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Composition</p>
                        <p className="text-black font-semibold">{selectedIcnMedicine.composition || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Category</p>
                        <p className="text-black font-semibold">{selectedIcnMedicine.category?.primaryCategory || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Price</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-black font-semibold text-lg">₹{(selectedIcnMedicine.packaging?.price ?? 0).toFixed(2)}</p>
                          {(() => {
                            const price = selectedIcnMedicine.packaging?.price ?? 0;
                            const mrp = selectedIcnMedicine.packaging?.mrp ?? price;
                            const discount = selectedIcnMedicine.packaging?.discountPercent ?? 0;
                            return mrp > price ? (
                              <>
                                <span className="text-sm text-gray-500 line-through">₹{mrp.toFixed(2)}</span>
                                <span className="text-sm font-semibold text-green-600">{discount}% off</span>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Stock Status</p>
                        {(() => {
                          const stock = selectedIcnMedicine.stock?.unitsAvailable ?? 0;
                          const subStock = selectedIcnMedicine.stock?.totalSubUnits ?? 0;
                          return stock > 0 ? (
                            <p className="font-semibold text-green-600">
                              Available: {stock} units{selectedIcnMedicine.stock?.allowSubQuantity && subStock > 0 ? ` (${subStock} sub-units)` : ''}
                            </p>
                          ) : subStock > 0 ? (
                            <p className="font-semibold text-orange-600">{subStock} sub-units left</p>
                          ) : (
                            <p className="font-semibold text-red-600">Out of Stock</p>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Manufacturer</p>
                        <p className="text-black">{selectedIcnMedicine.manufacturer || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Manufactured Date</p>
                        <p className="text-black">{formatDate(selectedIcnMedicine.manufacturedDate)}</p>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-4">
                      {selectedIcnMedicine.expiryDate ? (
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Expiry Date</p>
                          <p className="text-black">{formatDate(selectedIcnMedicine.expiryDate)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Warranty</p>
                          <p className="text-black">{selectedIcnMedicine.warranty || 'N/A'}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Storage Condition</p>
                        <p className="text-black">{selectedIcnMedicine.storageCondition || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="mb-4 text-justify">
                      <p className="text-sm text-gray-600 font-medium">Description</p>
                      <p className="text-black text-sm mt-2">{selectedIcnMedicine.description || 'No description available'}</p>
                    </div>
                  </div>

                  {selectedIcnPharmacy && (
                    <div className="border-b pb-6">
                      <h3 className="text-lg font-bold text-emerald-800 mb-4">Pharmacy Information</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Pharmacy Name</p>
                          <p className="text-black">{selectedIcnPharmacy.name || 'N/A'}</p>
                        </div>

                        {selectedIcnPharmacy.phone && (
                          <div>
                            <p className="text-sm text-gray-600 font-medium">Contact Number</p>
                            <p className="text-black">
                              <a href={`tel:${selectedIcnPharmacy.phone}`} className="text-blue-600 hover:underline">
                                {selectedIcnPharmacy.phone}
                              </a>
                            </p>
                          </div>
                        )}

                        {selectedIcnPharmacy.address && (
                          <div>
                            <p className="text-sm text-gray-600 font-medium">Address</p>
                            <p className="text-black">{typeof selectedIcnPharmacy.address === 'string' ? selectedIcnPharmacy.address : JSON.stringify(selectedIcnPharmacy.address)}</p>
                          </div>
                        )}

                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="inline-flex items-center gap-2 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 hover:text-white"
                            onClick={() => handleOpenSourceDirections(selectedIcnExchange?.sourcePharmacyID)}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Route on Map
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowIcnMedicineModal(false)}>
                      Close
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-gray-600">Medicine details unavailable.</div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
