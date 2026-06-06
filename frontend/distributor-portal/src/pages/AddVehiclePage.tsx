import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, Hash, Calendar, ArrowLeft, CheckCircle2,
  Fuel, Weight, Building2, ChevronDown, Edit2, X, Save, Info,
} from "lucide-react";
import { authService } from "../services/authService";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../components/ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ["Mini Truck", "Truck", "Tempo", "Van"];
const FUEL_TYPES    = ["Petrol", "Diesel", "CNG", "Electric"];

const inputClass = `
  pl-10 h-11 border border-gray-300 outline-none
  focus:border-orange-500 focus:ring-2 focus:ring-orange-500
  focus:ring-offset-0 focus-visible:outline-none
  focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0
`;

const selectClass = `
  w-full pl-10 h-11 rounded-md border border-gray-300 bg-white text-sm text-gray-700
  focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 outline-none
`;

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-orange-100" />
        <div className="text-center">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex-1 border-t border-orange-100" />
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-orange-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-800">{value || "—"}</span>
    </div>
  );
}

function ExpiryBadge({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return <span className="text-xs text-gray-400">—</span>;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  const color =
    days <= 0  ? "bg-red-100 text-red-700" :
    days <= 30 ? "bg-orange-100 text-orange-700" :
                 "bg-green-100 text-green-700";
  const label = days <= 0 ? "Expired" : days <= 30 ? `${days}d left` : dateStr;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FleetVehicle {
  vehicleID: string;
  registrationNumber: string;
  vehicleType: string | null;
  capacity: number | null;
  fuelType: string | null;
  status: string;
  driverID: string | null;
  ownership: string;
  insuranceExpiry: string | null;
  permitExpiry: string | null;
}

type Mode = "view-fleet" | "add-new";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttachVehiclePage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("view-fleet");

  // Fleet
  const [fleetVehicles, setFleetVehicles]         = useState<FleetVehicle[]>([]);
  const [loadingFleet, setLoadingFleet]           = useState(true);
  const [selectedVehicleID, setSelectedVehicleID] = useState("");
  const [selectedVehicle, setSelectedVehicle]     = useState<FleetVehicle | null>(null);

  // Inline edit
  const [isEditing, setIsEditing]       = useState(false);
  const [editForm, setEditForm]         = useState<Partial<FleetVehicle>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  // Add new vehicle form
  const [form, setForm] = useState({
    registrationNumber: "", vehicleType: "", capacity: "",
    fuelType: "", insuranceExpiry: "", permitExpiry: "",
  });

  const [error, setError]               = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [resultReg, setResultReg]       = useState("");

  const today = new Date().toISOString().split("T")[0];

  const setField = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  // Load all distributor-owned fleet vehicles
  useEffect(() => {
    authService.getDistributorVehicles()
      .then(vehicles => setFleetVehicles(vehicles.filter(v => v.ownership === "Distributor")))
      .catch(() => setFleetVehicles([]))
      .finally(() => setLoadingFleet(false));
  }, []);

  // Populate detail panel when a vehicle is selected
  const handleSelectVehicle = (vehicleID: string) => {
    setSelectedVehicleID(vehicleID);
    setIsEditing(false);
    setEditError(null);
    const v = fleetVehicles.find(v => v.vehicleID === vehicleID) ?? null;
    setSelectedVehicle(v);
    if (v) {
      setEditForm({
        vehicleType:     v.vehicleType     ?? "",
        capacity:        v.capacity        ?? undefined,
        fuelType:        v.fuelType        ?? "",
        insuranceExpiry: v.insuranceExpiry ?? "",
        permitExpiry:    v.permitExpiry    ?? "",
      });
    }
  };

  // Save inline edits
  const handleSaveEdit = async () => {
    if (!selectedVehicle) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await authService.updateDistributorVehicle(selectedVehicle.vehicleID, {
        vehicleType:     (editForm.vehicleType as string)     || undefined,
        capacity:        editForm.capacity != null ? Number(editForm.capacity) : undefined,
        fuelType:        (editForm.fuelType as string)        || undefined,
        insuranceExpiry: (editForm.insuranceExpiry as string) || undefined,
        permitExpiry:    (editForm.permitExpiry as string)    || undefined,
      });

      const updated: FleetVehicle = {
        ...selectedVehicle,
        vehicleType:     (editForm.vehicleType as string)     || null,
        capacity:        editForm.capacity != null ? Number(editForm.capacity) : null,
        fuelType:        (editForm.fuelType as string)        || null,
        insuranceExpiry: (editForm.insuranceExpiry as string) || null,
        permitExpiry:    (editForm.permitExpiry as string)    || null,
      };
      setSelectedVehicle(updated);
      setFleetVehicles(prev => prev.map(v => v.vehicleID === updated.vehicleID ? updated : v));
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to update vehicle");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add new vehicle to fleet only — no driver assignment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.registrationNumber.trim()) {
      setError("Registration number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await authService.addDistributorVehicle({
        registrationNumber: form.registrationNumber,
        vehicleType:        form.vehicleType     || undefined,
        capacity:           form.capacity        ? Number(form.capacity) : undefined,
        fuelType:           form.fuelType        || undefined,
        insuranceExpiry:    form.insuranceExpiry || undefined,
        permitExpiry:       form.permitExpiry    || undefined,
      });
      setResultReg(created.registrationNumber);
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to add vehicle");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success ────────────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C2410C] to-[#f69c3c] px-4">
        <Card className="w-full max-w-md border-0 bg-[#FFF7ED] shadow-2xl text-center">
          <CardContent className="pt-10 pb-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Vehicle Added!</h2>
              <p className="text-gray-500 text-sm mt-1">
                The vehicle has been added to your fleet. You can assign a driver later.
              </p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Registration</span>
                <span className="font-medium text-gray-900">{resultReg}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Driver</span>
                <span className="text-gray-400 font-medium">Unassigned</span>
              </div>
            </div>
            <Button
              onClick={() => navigate("/dashboard/vehicles-drivers")}
              className="w-full bg-[#EA580C] hover:bg-[#C2410C] text-white"
            >
              Back to Vehicles & Drivers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C2410C] to-[#f69c3c] px-4 py-10">
      <Button variant="ghost" onClick={() => navigate(-1)}
        className="absolute top-10 left-80 flex items-center gap-2 rounded-xl border border-white/30
          bg-white/10 backdrop-blur-md text-white shadow-lg hover:bg-white hover:text-black">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md border-0 bg-[#FFF7ED] shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <Building2 className="h-7 w-7 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-semibold text-black">Fleet Vehicles</CardTitle>
          <CardDescription className="text-gray-500">
            View your fleet or add a new vehicle
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── MODE TOGGLE ─────────────────────────────────────────── */}
          <div className="flex rounded-xl overflow-hidden border border-orange-200 bg-orange-50 p-1 gap-1 mb-5">
            <button type="button"
              onClick={() => { setMode("view-fleet"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "view-fleet"
                  ? "bg-[#EA580C] text-white shadow"
                  : "text-orange-600 hover:bg-orange-100"
              }`}
            >
              View Fleet
            </button>
            <button type="button"
              onClick={() => { setMode("add-new"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "add-new"
                  ? "bg-[#EA580C] text-white shadow"
                  : "text-orange-600 hover:bg-orange-100"
              }`}
            >
              Add New Vehicle
            </button>
          </div>

          {/* ── VIEW FLEET ──────────────────────────────────────────── */}
          {mode === "view-fleet" && (
            <Section title="Fleet Vehicles" subtitle="Distributor-owned vehicles">
              {loadingFleet ? (
                <div className="h-11 flex items-center justify-center text-sm text-gray-400">
                  Loading fleet...
                </div>
              ) : fleetVehicles.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
                  No fleet vehicles yet.{" "}
                  <button type="button" onClick={() => setMode("add-new")}
                    className="text-orange-600 underline font-medium">
                    Add one
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select
                      value={selectedVehicleID}
                      onChange={e => handleSelectVehicle(e.target.value)}
                      className={selectClass + " pr-8"}
                    >
                      <option value="">Select a vehicle to view...</option>
                      {fleetVehicles.map(v => (
                        <option key={v.vehicleID} value={v.vehicleID}>
                          {v.registrationNumber}{v.vehicleType ? ` — ${v.vehicleType}` : ""}
                          {v.driverID ? " (Assigned)" : " (Unassigned)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Detail Panel */}
                  {selectedVehicle && (
                    <div className="rounded-xl border border-orange-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50 border-b border-orange-100">
                        <div className="flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-xs font-semibold text-orange-700">Vehicle Details</span>
                        </div>
                        {!isEditing ? (
                          <button type="button"
                            onClick={() => { setIsEditing(true); setEditError(null); }}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button type="button"
                              onClick={() => { setIsEditing(false); setEditError(null); }}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                            <button type="button"
                              onClick={handleSaveEdit}
                              disabled={isSavingEdit}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" />
                              {isSavingEdit ? "Saving..." : "Save"}
                            </button>
                          </div>
                        )}
                      </div>

                      {editError && (
                        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
                          {editError}
                        </div>
                      )}

                      <div className="px-4 py-3 space-y-1">
                        <DetailRow label="Registration No." value={selectedVehicle.registrationNumber} />
                        <DetailRow label="Driver" value={selectedVehicle.driverID ? "Assigned" : "Unassigned"} />

                        {!isEditing ? (
                          <DetailRow label="Type" value={selectedVehicle.vehicleType} />
                        ) : (
                          <div className="flex justify-between items-center py-1.5 border-b border-orange-50">
                            <span className="text-xs text-gray-500">Type</span>
                            <select
                              value={(editForm.vehicleType as string) ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, vehicleType: e.target.value }))}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none bg-white w-36"
                            >
                              <option value="">Select...</option>
                              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        )}

                        {!isEditing ? (
                          <DetailRow label="Capacity" value={selectedVehicle.capacity ? `${selectedVehicle.capacity} kg` : null} />
                        ) : (
                          <div className="flex justify-between items-center py-1.5 border-b border-orange-50">
                            <span className="text-xs text-gray-500">Capacity (kg)</span>
                            <input
                              type="number"
                              value={(editForm.capacity as number | undefined) ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value as any }))}
                              placeholder="e.g. 500"
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none w-28 text-right"
                            />
                          </div>
                        )}

                        {!isEditing ? (
                          <DetailRow label="Fuel" value={selectedVehicle.fuelType} />
                        ) : (
                          <div className="flex justify-between items-center py-1.5 border-b border-orange-50">
                            <span className="text-xs text-gray-500">Fuel</span>
                            <select
                              value={(editForm.fuelType as string) ?? ""}
                              onChange={e => setEditForm(p => ({ ...p, fuelType: e.target.value }))}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none bg-white w-36"
                            >
                              <option value="">Select...</option>
                              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                        )}

                        <div className="flex justify-between items-center py-1.5 border-b border-orange-50">
                          <span className="text-xs text-gray-500">Insurance</span>
                          {!isEditing ? (
                            <ExpiryBadge dateStr={selectedVehicle.insuranceExpiry} />
                          ) : (
                            <input type="date"
                              value={(editForm.insuranceExpiry as string) ?? ""}
                              min={today}
                              onChange={e => setEditForm(p => ({ ...p, insuranceExpiry: e.target.value }))}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none w-36"
                            />
                          )}
                        </div>

                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-xs text-gray-500">Permit</span>
                          {!isEditing ? (
                            <ExpiryBadge dateStr={selectedVehicle.permitExpiry} />
                          ) : (
                            <input type="date"
                              value={(editForm.permitExpiry as string) ?? ""}
                              min={today}
                              onChange={e => setEditForm(p => ({ ...p, permitExpiry: e.target.value }))}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none w-36"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* ── ADD NEW VEHICLE ─────────────────────────────────────── */}
          {mode === "add-new" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Section title="Vehicle Details">
                <div className="relative group">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                  <Input
                    placeholder="Registration No. (e.g. KA01AB1234)"
                    value={form.registrationNumber} onChange={setField("registrationNumber")}
                    className={inputClass} required
                  />
                </div>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select value={form.vehicleType} onChange={setField("vehicleType")} className={selectClass}>
                    <option value="">Vehicle Type</option>
                    {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative group">
                    <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                    <Input type="number" placeholder="Capacity (kg)" value={form.capacity} onChange={setField("capacity")} className={inputClass} />
                  </div>
                  <div className="relative">
                    <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select value={form.fuelType} onChange={setField("fuelType")} className={selectClass}>
                      <option value="">Fuel Type</option>
                      {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </Section>

              <Section title="Documents" subtitle="For compliance tracking">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 pl-1">Insurance Expiry</label>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input type="date" value={form.insuranceExpiry} onChange={setField("insuranceExpiry")}
                        min={today} className={inputClass + " text-gray-600"} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 pl-1">Permit Expiry</label>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input type="date" value={form.permitExpiry} onChange={setField("permitExpiry")}
                        min={today} className={inputClass + " text-gray-600"} />
                    </div>
                  </div>
                </div>
              </Section>

              <Button type="submit" disabled={isSubmitting}
                className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-medium">
                {isSubmitting ? "Adding..." : "Add to Fleet"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}