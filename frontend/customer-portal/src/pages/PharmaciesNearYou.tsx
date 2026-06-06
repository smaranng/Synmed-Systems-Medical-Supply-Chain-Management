import { useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  MapPin, Navigation, Phone, Car, ExternalLink,
  Search, X, PersonStanding, Sparkles, CheckCircle2,
  AlertCircle, MinusCircle, Loader2, Pill,
} from "lucide-react";
import { Input } from "../components/ui/Input";
import { medicineService } from "../services/medicineService"; 
import { locationService, PharmacyLocation } from "../../../shared/services/locationService";
import { LocationModal } from "../../../shared/components/LocationModal";

// ─── Time helpers ─────────────────────────────────────────────────────────────
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
type DayKey = typeof DAYS[number];
const todayKey = (): DayKey => DAYS[new Date().getDay()];

// ─── Types ────────────────────────────────────────────────────────────────────
interface MedicineAvailability {
  medicineName: string;
  available: boolean;
  productId?: string;
  price?: number;
  stock?: number;
}

interface PharmacyAvailabilityResult {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  distance: number;
  isOpen: boolean;
  medicines: MedicineAvailability[];
  availableCount: number;
  totalCount: number;
  hasAll: boolean;
}

type AvailabilityTab = "all" | "complete" | "partial";

export default function PharmaciesNearYou() {
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

  // ─── Pharmacy state ──────────────────────────────────────────────────────
  const [pharmacies, setPharmacies] = useState<PharmacyLocation[]>([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState<PharmacyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<"all" | "near" | "medium" | "far">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyLocation | null>(null);
  const [travelMode, setTravelMode] = useState<"DRIVING" | "WALKING">("DRIVING");
  const hasFetchedRef = useRef(false);

  // ─── Magic Search state ──────────────────────────────────────────────────
  const [medicineInput, setMedicineInput] = useState("");
  const [medicineList, setMedicineList] = useState<string[]>([]);
  const [availabilityResults, setAvailabilityResults] = useState<PharmacyAvailabilityResult[] | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityTab, setAvailabilityTab] = useState<AvailabilityTab>("all");
  /** When set, the pharmacy list is filtered to only show this pharmacy */
  const [highlightedPharmacyId, setHighlightedPharmacyId] = useState<string | null>(null);

  useEffect(() => { fetchNearbyPharmacies(); }, []);
  useEffect(() => { filterPharmacies(); }, [pharmacies, distanceFilter, searchTerm, highlightedPharmacyId]);

  // ─── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const mapElement = document.getElementById("pharmacies-map");
    if (!mapElement || mapRef.current) return;

    const initializeMapWhenReady = () => {
      if (!window.google || !window.google.maps) {
        const timeout = setTimeout(initializeMapWhenReady, 100);
        return () => clearTimeout(timeout);
      }

      try {
        const map = new window.google.maps.Map(mapElement, {
          center: { lat: userLocation.latitude, lng: userLocation.longitude },
          zoom: 14,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: false,
        });

        mapRef.current = map;
        directionsServiceRef.current = new window.google.maps.DirectionsService();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: travelMode === "DRIVING" ? "#3B82F6" : "#10B981",
            strokeWeight: 5,
            strokeOpacity: 0.9,
            zIndex: 5,
          },
        });
        infoWindowRef.current = new window.google.maps.InfoWindow();

        new window.google.maps.Marker({
          position: { lat: userLocation.latitude, lng: userLocation.longitude },
          map,
          title: "Your Location",
          label: { text: "H", color: "#ffffff", fontSize: "14px", fontWeight: "bold" },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#3B82F6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 10,
        });

        updateMapMarkers();
      } catch (err) {
        setError(`Map initialization failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };

    initializeMapWhenReady();
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    updateMapMarkers();
  }, [filteredPharmacies]);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const fetchNearbyPharmacies = async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    setLoading(true);
    setError(null);
    try {
      const data = await locationService.getNearbyPharmacies(50000, "customer");
      setPharmacies(data.pharmacies);
      setUserLocation(data.userLocation);
    } catch (err: any) {
      if (err.message === "LOCATION_REQUIRED") {
        setShowLocationModal(true);
        setError("Please set your location to find nearby pharmacies");
      } else {
        setError(err.message || "Failed to fetch nearby pharmacies");
      }
    } finally {
      setLoading(false);
    }
  };

  const filterPharmacies = () => {
    let filtered = [...pharmacies];

    // Distance filter
    switch (distanceFilter) {
      case "near":   filtered = filtered.filter((p) => p.distance < 3); break;
      case "medium": filtered = filtered.filter((p) => p.distance >= 3 && p.distance < 10); break;
      case "far":    filtered = filtered.filter((p) => p.distance >= 10); break;
    }

    // Text search
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.city && p.city.toLowerCase().includes(lower)) ||
        (p.area && p.area.toLowerCase().includes(lower))
      );
    }

    // Magic search highlight filter
    if (highlightedPharmacyId) {
      filtered = filtered.filter((p) => (p.pharmaID ?? p.pharmaID) === highlightedPharmacyId);
    }

    setFilteredPharmacies(filtered);
  };

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      await locationService.updateLocation(latitude, longitude, address, "customer");
      setShowLocationModal(false);
      hasFetchedRef.current = false;
      fetchNearbyPharmacies();
    } catch (err: any) {
      alert(err.message || "Failed to update location");
    }
  };

  // ─── Magic Search ────────────────────────────────────────────────────────
  const addMedicine = () => {
    const trimmed = medicineInput.trim();
    if (!trimmed) return;
    if (medicineList.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setMedicineInput("");
      return;
    }
    setMedicineList((prev) => [...prev, trimmed]);
    setMedicineInput("");
    // Reset previous results when the list changes
    setAvailabilityResults(null);
    setAvailabilityError(null);
  };

  const removeMedicine = (index: number) => {
    setMedicineList((prev) => prev.filter((_, i) => i !== index));
    setAvailabilityResults(null);
    setAvailabilityError(null);
  };

  const handleMedicineInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addMedicine(); }
    if (e.key === "Backspace" && !medicineInput && medicineList.length > 0) {
      removeMedicine(medicineList.length - 1);
    }
  };

  

    // Add these new state vars near your other availability state
const [splitSuggestion, setSplitSuggestion] = useState<{
  pharmacies: PharmacyAvailabilityResult[];
  uncovered: string[];
} | null>(null);
const [searchPhase, setSearchPhase] = useState<"nearby" | "expanded" | null>(null);

// Greedy set-cover: finds minimum pharmacies to cover all medicines
const findOptimalSplit = (
  results: PharmacyAvailabilityResult[],
  medicines: string[]
): { pharmacies: PharmacyAvailabilityResult[]; uncovered: string[] } => {
  const needed = new Set(medicines);
  const chosen: PharmacyAvailabilityResult[] = [];
  const pool = [...results]
    .filter((r) => r.availableCount > 0)
    .sort((a, b) => a.distance - b.distance); // prefer closer pharmacies

  while (needed.size > 0 && pool.length > 0) {
    // Score each remaining pharmacy by how many *still-needed* medicines it covers
    pool.sort((a, b) => {
      const aCover = a.medicines.filter(
        (m) => m.available && needed.has(m.medicineName)
      ).length;
      const bCover = b.medicines.filter(
        (m) => m.available && needed.has(m.medicineName)
      ).length;
      if (bCover !== aCover) return bCover - aCover;
      return a.distance - b.distance; // tiebreak: closer wins
    });

    const best = pool.shift()!;
    const covers = best.medicines.filter(
      (m) => m.available && needed.has(m.medicineName)
    );
    if (covers.length === 0) break;

    chosen.push(best);
    covers.forEach((m) => needed.delete(m.medicineName));
  }

  return { pharmacies: chosen, uncovered: [...needed] };
};

const checkMedicineAvailability = async () => {
  if (medicineList.length === 0) return;

  setCheckingAvailability(true);
  setAvailabilityError(null);
  setAvailabilityResults(null);
  setSplitSuggestion(null);
  setAvailabilityTab("all");
  setHighlightedPharmacyId(null);
  setSearchPhase(null);

  const NEARBY_THRESHOLD_KM = 5;

  try {
    // ── Phase 1: check nearby pharmacies only ─────────────────────────────
    const nearbyPharmacies = filteredPharmacies.filter(
      (p) => p.distance <= NEARBY_THRESHOLD_KM
    );
    const allPharmacies = filteredPharmacies;

    const fetchAvailability = async (
      pharmacyList: typeof filteredPharmacies
    ) => {
      const payload = pharmacyList.map((p) => ({
        id: p.pharmaID,
        distance: p.distance ?? 0,
      }));
      const data = await medicineService.checkAvailability({
      medicineNames: medicineList,
      pharmacies: payload,
    });

    return data.results;
    };

    // Phase 1 — nearby
    setSearchPhase("nearby");
    const nearbyResults = nearbyPharmacies.length > 0
      ? await fetchAvailability(nearbyPharmacies)
      : [];

    const nearbyComplete = nearbyResults.filter((r) => r.hasAll);

    if (nearbyComplete.length > 0) {
      // Great — nearby pharmacies cover everything
      const sorted = nearbyResults.sort((a, b) => {
        if (a.hasAll !== b.hasAll) return a.hasAll ? -1 : 1;
        if (b.availableCount !== a.availableCount)
          return b.availableCount - a.availableCount;
        return a.distance - b.distance;
      });
      setAvailabilityResults(sorted);
      setSplitSuggestion(null);
    } else {
      // Phase 2 — expand to all pharmacies
      setSearchPhase("expanded");
      const allResults = await fetchAvailability(allPharmacies);

      const sorted = allResults.sort((a, b) => {
        if (a.hasAll !== b.hasAll) return a.hasAll ? -1 : 1;
        if (b.availableCount !== a.availableCount)
          return b.availableCount - a.availableCount;
        return a.distance - b.distance;
      });

      setAvailabilityResults(sorted);

      // Compute optimal split only if no single pharmacy has everything
      const anyComplete = sorted.some((r) => r.hasAll);
      if (!anyComplete) {
        const split = findOptimalSplit(sorted, medicineList);
        setSplitSuggestion(split.pharmacies.length > 0 ? split : null);
      } else {
        setSplitSuggestion(null);
      }
    }
  } catch (err: any) {
    setAvailabilityError(
      err.message || "Could not check availability. Please try again."
    );
  } finally {
    setCheckingAvailability(false);
    setSearchPhase(null);
  }
};
  
  const clearMagicSearch = () => {
  setMedicineList([]);
  setMedicineInput("");
  setAvailabilityResults(null);
  setAvailabilityError(null);
  setHighlightedPharmacyId(null);
  setSplitSuggestion(null);       // add
  setSearchPhase(null);           // add
};

  // Derived counts for tabs
  const completeMatches = availabilityResults?.filter((r) => r.hasAll) ?? [];
  const partialMatches = availabilityResults?.filter((r) => !r.hasAll && r.availableCount > 0) ?? [];

  const visibleResults = availabilityResults
    ? availabilityTab === "complete"
      ? completeMatches
      : availabilityTab === "partial"
      ? partialMatches
      : availabilityResults
    : [];

  // ─── Map helpers ─────────────────────────────────────────────────────────
  const updateMapMarkers = useCallback(() => {
    if (!mapRef.current || !userLocation || !window.google) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    filteredPharmacies.forEach((pharmacy) => {
      const marker = new window.google.maps.Marker({
        position: { lat: pharmacy.location.latitude, lng: pharmacy.location.longitude },
        map: mapRef.current,
        title: pharmacy.name,
        icon: {
          path: "M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
          fillColor: "#EF4444",
          fillOpacity: 1,
          scale: 1.5,
          strokeColor: "#FFFFFF",
          strokeWeight: 1,
        },
      });

      marker.addListener("click", () => {
        setSelectedPharmacy(pharmacy);
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(
            `<div class="font-semibold text-red-600">${pharmacy.name}</div>`
          );
          infoWindowRef.current.open(mapRef.current, marker);
        }
        showDirectionsBetween(pharmacy);
      });

      markersRef.current.push(marker);
    });

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude });
    filteredPharmacies.forEach((pharmacy) => {
      bounds.extend({ lat: pharmacy.location.latitude, lng: pharmacy.location.longitude });
    });
    if (filteredPharmacies.length > 0) mapRef.current.fitBounds(bounds);
  }, [filteredPharmacies, userLocation]);

  const showDirectionsBetween = useCallback(
    (pharmacy: PharmacyLocation) => {
      if (!directionsServiceRef.current || !directionsRendererRef.current || !userLocation) return;
      directionsServiceRef.current.route(
        {
          origin: { lat: userLocation.latitude, lng: userLocation.longitude },
          destination: { lat: pharmacy.location.latitude, lng: pharmacy.location.longitude },
          travelMode: travelMode as google.maps.TravelMode,
        },
        (result, status) => {
          if (status === "OK" && result) directionsRendererRef.current?.setDirections(result);
        }
      );
    },
    [userLocation, travelMode]
  );

  const clearDirections = useCallback(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
    }
    setSelectedPharmacy(null);
  }, []);

  const handleSelectPharmacy = (pharmacyId: string) => {
    navigate(`/dashboard/pharmacy/${pharmacyId}/search`);
  };

  const getDistanceBadgeColor = (distance: number) => {
    if (distance < 3) return "bg-green-100 text-green-800";
    if (distance < 10) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  const getPharmacyOpenStatus = (pharmacy: PharmacyLocation) => {
    const todayTimings = (pharmacy as any).timings?.[todayKey()];
    if (!todayTimings) return { isOpen: false, isOpenToday: false, open: null, close: null };
    const isOpen = nowMins() >= toMins(todayTimings.open) && nowMins() < toMins(todayTimings.close);
    return { isOpen, isOpenToday: true, open: todayTimings.open as string, close: todayTimings.close as string };
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Pharmacies Near You</h1>
        <p className="text-gray-600">Find trusted pharmacies in your area and browse their inventory</p>
      </div>

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="customer"
      />

      {/* ── Magic Search ──────────────────────────────────────────────────── */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg text-black">Medicine availability checker</CardTitle>
            <span className="ml-auto text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              Magic search
            </span>
          </div>
          <CardDescription>
            Add medicines you need — we'll find which nearby pharmacies stock them all, or show you the best split
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Input row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Pill className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Type a medicine name and press Enter…"
                value={medicineInput}
                onChange={(e) => setMedicineInput(e.target.value)}
                onKeyDown={handleMedicineInputKeyDown}
                className="pl-9"
              />
            </div>
            <Button onClick={addMedicine} disabled={!medicineInput.trim()} className="bg-[#123B6B] text-white">
              Add
            </Button>
          </div>

          {/* Medicine tags */}
          {medicineList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {medicineList.map((medicine, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {medicine}
                  <button
                    onClick={() => removeMedicine(index)}
                    className="hover:text-blue-600 ml-0.5 leading-none"
                    title={`Remove ${medicine}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#123B6B] hover:bg-[#0f2a54] text-white disabled:opacity-50"
              disabled={medicineList.length === 0 || checkingAvailability || filteredPharmacies.length === 0}
              onClick={checkMedicineAvailability}
            >
             {checkingAvailability ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {searchPhase === "nearby"
                ? "Checking nearby pharmacies…"
                : searchPhase === "expanded"
                ? "No luck nearby — expanding search…"
                : "Checking…"}
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Check availability across {filteredPharmacies.length} pharmacies
            </>
          )}
            </Button>
            {(medicineList.length > 0 || availabilityResults) && (
              <Button variant="outline" onClick={clearMagicSearch}>
                Clear all
              </Button>
            )}
          </div>

          {/* Highlight filter notice */}
          {highlightedPharmacyId && (
            <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-blue-700">Showing only the selected pharmacy below</span>
              <button
                className="text-blue-600 hover:underline font-medium text-xs"
                onClick={() => setHighlightedPharmacyId(null)}
              >
                Show all pharmacies
              </button>
            </div>
          )}

          {/* Error */}
          {availabilityError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {availabilityError}
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────── */}
        {availabilityResults && (
  <div className="space-y-3 pt-1">
    {/* Summary */}
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-sm text-gray-500">
        Checked{" "}
        <span className="font-semibold text-black">{medicineList.length}</span>{" "}
        medicines across{" "}
        <span className="font-semibold text-black">
          {availabilityResults.length}
        </span>{" "}
        pharmacies
      </p>
      <div className="flex gap-1.5">
        {(
          [
            { key: "all",      label: `All (${availabilityResults.length})` },
            { key: "complete", label: `Has all (${completeMatches.length})` },
            { key: "partial",  label: `Partial (${partialMatches.length})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAvailabilityTab(key)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              availabilityTab === key
                ? "bg-[#123B6B] text-white border-[#123B6B]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* ── Complete matches ─────────────────────────────────────────── */}
    {(availabilityTab === "all" || availabilityTab === "complete") &&
      completeMatches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {completeMatches[0].distance <= 5
              ? "Nearby — all medicines in stock"
              : "Further away — all medicines in stock"}
          </p>
          <div className="space-y-2">
            {completeMatches.map((result) => (
              <AvailabilityResultRow
                key={result.pharmacyId}
                result={result}
                medicineList={medicineList}
                onShopHere={() => handleSelectPharmacy(result.pharmacyId)}
                onHighlight={() =>
                  setHighlightedPharmacyId(
                    highlightedPharmacyId === result.pharmacyId
                      ? null
                      : result.pharmacyId
                  )
                }
                isHighlighted={highlightedPharmacyId === result.pharmacyId}
              />
            ))}
          </div>
        </div>
      )}

    {/* ── Optimal split suggestion (only when no pharmacy has all) ── */}
    {(availabilityTab === "all" || availabilityTab === "partial") &&
      completeMatches.length === 0 &&
      splitSuggestion && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Suggested split — fewest stops to get everything
            </p>
            {splitSuggestion.uncovered.length > 0 && (
              <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                {splitSuggestion.uncovered.join(", ")} unavailable
              </span>
            )}
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
            {splitSuggestion.pharmacies.map((result, idx) => {
              // Only show medicines this pharmacy uniquely contributes to the split
              const alreadyCovered = new Set(
                splitSuggestion.pharmacies
                  .slice(0, idx)
                  .flatMap((r) =>
                    r.medicines.filter((m) => m.available).map((m) => m.medicineName)
                  )
              );
              const contributingMeds = result.medicines.filter(
                (m) => m.available && !alreadyCovered.has(m.medicineName)
              );

              return (
                <div
                  key={result.pharmacyId}
                  className="flex items-start justify-between gap-3 bg-white rounded-lg border border-blue-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        Stop {idx + 1}
                      </span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {result.pharmacyName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {result.distance.toFixed(1)} km
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {contributingMeds.map((med) => (
                        <span
                          key={med.medicineName}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-green-100 text-green-800"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          {med.medicineName}
                          {med.price != null && (
                            <span className="opacity-70 font-normal">
                              {" "}· ₹{med.price}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {result.isOpen ? (
                      <Button
                        size="sm"
                        className="bg-[#123B6B] hover:bg-[#0f2a54] text-white whitespace-nowrap"
                        onClick={() => handleSelectPharmacy(result.pharmacyId)}
                      >
                        Shop here
                      </Button>
                    ) : (
                      <span className="text-xs text-center text-red-500 font-medium px-3 py-1 bg-red-50 rounded-lg border border-red-200">
                        Closed now
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setHighlightedPharmacyId(
                          highlightedPharmacyId === result.pharmacyId
                            ? null
                            : result.pharmacyId
                        )
                      }
                      className={`text-xs text-center px-3 py-1 rounded-lg border transition-all ${
                        highlightedPharmacyId === result.pharmacyId
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "text-gray-500 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {highlightedPharmacyId === result.pharmacyId
                        ? "Unpin on map"
                        : "Pin on map"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    {/* ── No complete match warning ─────────────────────────────────── */}
    {(availabilityTab === "all" || availabilityTab === "complete") &&
      completeMatches.length === 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          No single pharmacy nearby has all your medicines. See the suggested
          split above, or browse partial matches below.
        </div>
      )}

    {/* ── Partial matches ───────────────────────────────────────────── */}
    {(availabilityTab === "all" || availabilityTab === "partial") &&
      partialMatches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Partial match
          </p>
          <div className="space-y-2">
            {partialMatches.map((result) => (
              <AvailabilityResultRow
                key={result.pharmacyId}
                result={result}
                medicineList={medicineList}
                onShopHere={() => handleSelectPharmacy(result.pharmacyId)}
                onHighlight={() =>
                  setHighlightedPharmacyId(
                    highlightedPharmacyId === result.pharmacyId
                      ? null
                      : result.pharmacyId
                  )
                }
                isHighlighted={highlightedPharmacyId === result.pharmacyId}
              />
            ))}
          </div>
        </div>
      )}

    {/* Empty state */}
    {visibleResults.length === 0 && availabilityTab !== "all" && (
      <p className="text-sm text-gray-500 text-center py-4">
        No pharmacies in this category.
      </p>
    )}
  </div>
)}
        </CardContent>
      </Card>

      {/* Filters and Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-sm text-gray-600">
                Found <span className="font-bold text-black">{filteredPharmacies.length}</span> pharmacies
                {distanceFilter !== "all" && " in selected range"}
                {highlightedPharmacyId && " (filtered by magic search)"}
              </p>
              {userLocation && (
                <p className="text-xs text-gray-500 mt-1">📍 Showing results near your location</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "near", "medium", "far"] as const).map((f) => (
                <Button
                  key={f}
                  variant={distanceFilter === f ? "default" : "outline"}
                  onClick={() => setDistanceFilter(f)}
                  className={distanceFilter === f ? "bg-[#123B6B] text-white" : ""}
                >
                  {f === "all" ? "All" : f === "near" ? "< 3 km" : f === "medium" ? "3–10 km" : "10+ km"}
                </Button>
              ))}
              <Button variant="outline" onClick={() => setShowLocationModal(true)}>
                <Navigation className="w-4 h-4 mr-2" /> Update Location
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search pharmacies by name, city, or area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Google Map Section */}
      {userLocation && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Pharmacy Locations Map</CardTitle>
            <CardDescription>Interactive map showing nearby pharmacies and directions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPharmacy && (
              <div className="flex gap-2 items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={travelMode === "DRIVING" ? "default" : "outline"}
                    onClick={() => { setTravelMode("DRIVING"); if (selectedPharmacy) showDirectionsBetween(selectedPharmacy); }}
                    className={travelMode === "DRIVING" ? "bg-[#123B6B]" : ""}
                  >
                    <Car className="w-4 h-4 mr-2" /> Driving
                  </Button>
                  <Button
                    size="sm"
                    variant={travelMode === "WALKING" ? "default" : "outline"}
                    onClick={() => { setTravelMode("WALKING"); if (selectedPharmacy) showDirectionsBetween(selectedPharmacy); }}
                    className={travelMode === "WALKING" ? "bg-[#123B6B]" : ""}
                  >
                    <PersonStanding className="w-4 h-4 mr-2" /> Walking
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={clearDirections}>Clear Directions</Button>
              </div>
            )}

            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">H</div>
                <span className="text-sm text-gray-700">Your Location</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-red-500" />
                <span className="text-sm text-gray-700">Pharmacy Location</span>
              </div>
            </div>

            <div id="pharmacies-map" style={{ width: "100%", height: "500px", borderRadius: "8px", border: "1px solid #e5e7eb" }} />

            {selectedPharmacy && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedPharmacy.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{selectedPharmacy.address}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Distance</p>
                    <p className="font-semibold">{selectedPharmacy.distance.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{travelMode === "DRIVING" ? "Driving Time" : "Walking Time"}</p>
                    <p className="font-semibold">
                      {travelMode === "DRIVING"
                        ? `${selectedPharmacy.drivingTime} min`
                        : `${selectedPharmacy.walkingTime} min`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="text-lg text-gray-600">Finding nearby pharmacies...</div>
        </div>
      )}

      {/* Error State */}
      {error && !showLocationModal && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-lg text-red-600 mb-4">{error}</p>
              <Button onClick={() => setShowLocationModal(true)}>Set Location</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pharmacy List */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPharmacies.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-lg text-gray-600">
                {highlightedPharmacyId
                  ? "Selected pharmacy not found. Try clearing the magic search filter."
                  : "No pharmacies found in this range. Try adjusting the distance filter."}
              </div>
              {highlightedPharmacyId && (
                <Button variant="outline" className="mt-4" onClick={() => setHighlightedPharmacyId(null)}>
                  Show all pharmacies
                </Button>
              )}
            </div>
          ) : (
            filteredPharmacies.map((pharmacy) => {
              const { isOpen, isOpenToday, open, close } = getPharmacyOpenStatus(pharmacy);
              const magicResult = availabilityResults?.find(
                (r) => r.pharmacyId === (pharmacy.pharmaID ?? pharmacy._id)
              );

              return (
                <Card
                  key={pharmacy.pharmaID ?? pharmacy._id}
                  className={`hover:shadow-lg transition-all cursor-pointer ${
                    selectedPharmacy?.pharmaID === pharmacy.pharmaID ? "ring-2 ring-blue-500 shadow-lg" : ""
                  } ${magicResult?.hasAll ? "ring-2 ring-green-400" : ""}`}
                  onClick={() => { setSelectedPharmacy(pharmacy); showDirectionsBetween(pharmacy); }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {pharmacy.logo ? (
                            <img
                              src={`http://localhost:5203${pharmacy.logo}`}
                              alt={pharmacy.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">🏥</span>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg text-black">{pharmacy.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getDistanceBadgeColor(pharmacy.distance)}`}>
                              {locationService.formatDistance(pharmacy.distance)} away
                            </span>
                            {/* Magic search badge on card */}
                            {magicResult && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                                magicResult.hasAll
                                  ? "bg-green-100 text-green-800"
                                  : magicResult.availableCount > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {magicResult.hasAll ? (
                                  <><CheckCircle2 className="w-3 h-3" /> All {magicResult.totalCount} medicines</>
                                ) : (
                                  <><MinusCircle className="w-3 h-3" /> {magicResult.availableCount}/{magicResult.totalCount} medicines</>
                                )}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Address */}
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{pharmacy.address}</span>
                    </div>

                    {/* Phone */}
                    {pharmacy.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                        <a
                          href={`tel:${pharmacy.phone}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pharmacy.phone}
                        </a>
                      </div>
                    )}

                    {/* Open / Closed Status */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isOpen
                          ? "bg-green-100 text-green-700"
                          : isOpenToday
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {isOpen ? "Open Now" : isOpenToday ? "Closed Now" : "Closed Today"}
                      </span>
                    </div>

                  
                    {/* Travel Times */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center text-gray-600">
                          <PersonStanding className="w-4 h-4 mr-2" /> Walking
                        </span>
                        <span className="font-semibold text-gray-900">
                          {locationService.formatTime(pharmacy.walkingTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center text-gray-600">
                          <Car className="w-4 h-4 mr-2" /> Driving
                        </span>
                        <span className="font-semibold text-gray-900">
                          {locationService.formatTime(pharmacy.drivingTime)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        className={`flex-1 font-medium transition-all ${
                          isOpen
                            ? "bg-[#123B6B] hover:bg-[#0f2a54] text-white cursor-pointer"
                            : "bg-[#123B6B] text-gray-300 cursor-not-allowed"
                        }`}
                        disabled={!isOpen}
                        title={!isOpen ? "This pharmacy is currently closed" : "Browse medicines"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOpen) handleSelectPharmacy(pharmacy.pharmaID);
                        }}
                      >
                        Search Medicines and More..
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3"
                        title="Get Directions in Google Maps"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (userLocation) {
                            const url = locationService.getGoogleMapsDirectionsUrl(
                              userLocation.latitude,
                              userLocation.longitude,
                              pharmacy.location.latitude,
                              pharmacy.location.longitude
                            );
                            window.open(url, "_blank");
                          }
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Closed hint */}
                    {!isOpen && (
                      <p className="text-xs text-center text-gray-400 italic">
                        {isOpenToday && open && close
                          ? `Opens: ${open} , Closes: ${close}`
                          : "Not available today"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Availability Result Row (sub-component) ──────────────────────────────────
interface AvailabilityResultRowProps {
  result: PharmacyAvailabilityResult;
  medicineList: string[];
  onShopHere: () => void;
  onHighlight: () => void;
  isHighlighted: boolean;
}

function AvailabilityResultRow({
  result,
  onShopHere,
  onHighlight,
  isHighlighted,
}: AvailabilityResultRowProps) {
  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        result.hasAll
          ? "border-green-200 bg-green-50/40"
          : "border-gray-200 bg-white"
      } ${isHighlighted ? "ring-2 ring-blue-400" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-semibold text-gray-900 text-sm">{result.pharmacyName}</span>
            {result.hasAll ? (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Has all {result.totalCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                <MinusCircle className="w-3 h-3" /> {result.availableCount} of {result.totalCount}
              </span>
            )}
            <span className="text-xs text-gray-400">{result.distance.toFixed(1)} km away</span>
          </div>

          {/* Medicine breakdown */}
          <div className="flex flex-wrap gap-1.5">
            {result.medicines.map((med) => (
              <span
                key={med.medicineName}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${
                  med.available
                    ? "bg-green-100 text-green-800"
                    : "bg-red-50 text-red-500 line-through"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${med.available ? "bg-green-500" : "bg-red-400"}`} />
                {med.medicineName}
                {med.available && med.price != null && (
                  <span className="opacity-70 font-normal"> · ₹{med.price}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          {result.isOpen ? (
            <Button size="sm" className="bg-[#123B6B] hover:bg-[#0f2a54] text-white whitespace-nowrap" onClick={onShopHere}>
              Shop here
            </Button>
          ) : (
            <span className="text-xs text-center text-red-500 font-medium px-3 py-1 bg-red-50 rounded-lg border border-red-200">
              Closed now
            </span>
          )}
          <button
            onClick={onHighlight}
            className={`text-xs text-center px-3 py-1 rounded-lg border transition-all ${
              isHighlighted
                ? "bg-blue-100 text-blue-700 border-blue-300"
                : "text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {isHighlighted ? "Unpin on map" : "Pin on map"}
          </button>
        </div>
      </div>
    </div>
  );
}