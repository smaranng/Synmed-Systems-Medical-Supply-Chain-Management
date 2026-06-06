import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, User, Plus, Edit, Trash2, Search, Filter,
  XCircle, AlertTriangle, Car, Package, Loader2,
  ToggleLeft, ToggleRight, RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/authService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  driverID: string;
  name: string;
  phone: string;
  username: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  vehicleID: string | null;
  isActive: boolean;
  distributorID: string;
}

interface Vehicle {
  vehicleID: string;
  registrationNumber: string;
  vehicleType: string | null;
  capacity: number | null;
  ownership: "Driver" | "Distributor";
  distributorID: string;
  driverID: string | null;
  status: string;
  insuranceExpiry: string | null;
  permitExpiry: string | null;
  fuelType: string | null;
}

interface Assignment {
  id: string;
  orderId: string;
  driverId: string;
  vehicleId: string;
  assignedAt: string;
  status: "Pending" | "In Progress" | "Completed" | "Cancelled";
  customerName: string;
  deliveryAddress: string;
  estimatedDelivery: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  const map: Record<string, string> = {
    Active:        "bg-green-100 text-green-700",
    Available:     "bg-green-100 text-green-700",
    "On Delivery": "bg-blue-100 text-blue-700",
    Inactive:      "bg-gray-100 text-gray-700",
    Maintenance:   "bg-yellow-100 text-yellow-700",
    Pending:       "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Completed:     "bg-green-100 text-green-700",
    Cancelled:     "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function ExpiryLabel({ label, dateStr }: { label: string; dateStr: string | null }) {
  if (!dateStr) return <div className="text-xs text-gray-400">{label}: —</div>;
  const days = daysUntil(dateStr)!;
  const warning = days <= 30 && days > 0;
  const expired = days <= 0;
  return (
    <div className={`text-xs flex items-center gap-1 ${expired ? "text-red-600" : warning ? "text-orange-600" : "text-gray-600"}`}>
      {(warning || expired) && <AlertTriangle className="w-3 h-3" />}
      {label}: {expired ? "Expired" : dateStr}
    </div>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}

function ErrorRow({ cols, message, onRetry }: { cols: number; message: string; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center">
        <p className="text-sm text-red-500 mb-2">{message}</p>
        <button onClick={onRetry} className="text-xs text-orange-600 underline flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehiclesDriversPage() {
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const distributorID = user?.id ?? "";

  const [activeTab, setActiveTab] = useState<"drivers" | "vehicles" | "assignments">("drivers");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [drivers,     setDrivers]  = useState<Driver[]>([]);
  const [vehicles,    setVehicles] = useState<Vehicle[]>([]);
  const [assignments] = useState<Assignment[]>([]);

  // Loading / error per tab
  const [driverLoading,  setDriverLoading]  = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [driverError,    setDriverError]    = useState<string | null>(null);
  const [vehicleError,   setVehicleError]   = useState<string | null>(null);

  // In-flight toggle/delete to prevent double-clicks
  const [togglingID, setTogglingID] = useState<string | null>(null);
  const [deletingID, setDeletingID] = useState<string | null>(null);

  // ── Fetch vehicles ─────────────────────────────────────────────────────────
  const fetchVehicles = useCallback(async () => {
    setVehicleLoading(true);
    setVehicleError(null);
    try {
      const data = await authService.getDistributorVehicles();
      setVehicles(
        data.map((v: any) => ({
          vehicleID:          v.vehicleID,
          registrationNumber: v.registrationNumber,
          vehicleType:        v.vehicleType     ?? null,
          capacity:           v.capacity        ?? null,
          ownership:          v.ownership       ?? "Distributor",
          distributorID:      v.distributorID   ?? "",
          driverID:           v.driverID        ?? null,
          status:             v.status          ?? "Active",
          insuranceExpiry:    v.insuranceExpiry ?? null,
          permitExpiry:       v.permitExpiry    ?? null,
          fuelType:           v.fuelType        ?? null,
        }))
      );
    } catch (err: any) {
      setVehicleError(err.message ?? "Failed to load vehicles");
    } finally {
      setVehicleLoading(false);
    }
  }, []);

  // ── Fetch drivers ──────────────────────────────────────────────────────────
  const fetchDrivers = useCallback(async () => {
    if (!distributorID) return;
    setDriverLoading(true);
    setDriverError(null);
    try {
      const data = await authService.getDrivers(distributorID);
      setDrivers(
        data.map((d: any) => ({
          driverID:      d.driverID  ?? d.id,
          name:          d.name,
          phone:         d.phone,
          username:      d.username,
          licenseNumber: d.licenseNumber ?? null,
          licenseExpiry: d.licenseExpiry ?? null,
          vehicleID:     d.vehicleID    ?? null,
          isActive:      d.isActive,
          distributorID: d.distributorID ?? "",
        }))
      );
    } catch (err: any) {
      setDriverError(err.message ?? "Failed to load drivers");
    } finally {
      setDriverLoading(false);
    }
  }, [distributorID]);

  // ── Load on mount and tab switch ───────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "drivers") {
      fetchDrivers();
      fetchVehicles();
    }
    if (activeTab === "vehicles") {
      fetchVehicles();
      fetchDrivers();
    }
  }, [activeTab, fetchDrivers, fetchVehicles]);

  // ── Toggle driver active state ─────────────────────────────────────────────
  const toggleDriver = async (driver: Driver) => {
    setTogglingID(driver.driverID);
    try {
      await authService.setDriverStatus(driver.driverID, !driver.isActive);
      setDrivers(prev =>
        prev.map(d => d.driverID === driver.driverID ? { ...d, isActive: !d.isActive } : d)
      );
    } catch (err: any) {
      alert(err.message ?? "Failed to update driver status");
    } finally {
      setTogglingID(null);
    }
  };

  // ── Delete driver ──────────────────────────────────────────────────────────
  const deleteDriver = async (driverID: string) => {
    if (!confirm("Remove this driver? This cannot be undone.")) return;
    setDeletingID(driverID);
    try {
      await authService.deleteDriver(driverID);
      setDrivers(prev => prev.filter(d => d.driverID !== driverID));
    } catch (err: any) {
      alert(err.message ?? "Failed to delete driver");
    } finally {
      setDeletingID(null);
    }
  };

  // ── Search filter ──────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase();
  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.phone.includes(q) ||
    d.username.toLowerCase().includes(q)
  );
  const filteredVehicles = vehicles.filter(v =>
    v.registrationNumber.toLowerCase().includes(q) ||
    (v.vehicleType ?? "").toLowerCase().includes(q)
  );

  // ── Lookups ────────────────────────────────────────────────────────────────
  const vehicleForDriver = (vehicleID: string | null) =>
    vehicleID ? vehicles.find(v => v.vehicleID === vehicleID) : undefined;

  const driverForVehicle = (driverID: string | null) =>
    driverID ? drivers.find(d => d.driverID === driverID) : undefined;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeDrivers  = drivers.filter(d => d.isActive).length;
  const activeVehicles = vehicles.filter(v => v.status === "Active").length;
  const fleetVehicles  = vehicles.filter(v => v.ownership === "Distributor").length;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicles & Drivers</h1>
          <p className="text-gray-600 mt-1">Manage your fleet, drivers, and delivery assignments</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/vehicles-drivers/add-vehicle")}
            className="border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            <Truck className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
          <Button
            onClick={() => navigate("/dashboard/vehicles-drivers/add-driver")}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Driver
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: "Total Drivers",
            value: drivers.length,
            sub: `${activeDrivers} Active`,
            subColor: "text-green-600",
            icon: <User className="w-6 h-6 text-blue-600" />,
            bg: "bg-blue-100",
          },
          {
            label: "Total Vehicles",
            value: vehicles.length,
            sub: `${activeVehicles} Active`,
            subColor: "text-green-600",
            icon: <Truck className="w-6 h-6 text-orange-600" />,
            bg: "bg-orange-100",
          },
          {
            label: "Fleet Vehicles",
            value: fleetVehicles,
            sub: "Company owned",
            subColor: "text-gray-600",
            icon: <Car className="w-6 h-6 text-purple-600" />,
            bg: "bg-purple-100",
          },
          {
            label: "Active Deliveries",
            value: assignments.filter(a => a.status === "In Progress").length,
            sub: `${assignments.filter(a => a.status === "Pending").length} Pending`,
            subColor: "text-blue-600",
            icon: <Package className="w-6 h-6 text-green-600" />,
            bg: "bg-green-100",
          },
        ].map(({ label, value, sub, subColor, icon, bg }) => (
          <div key={label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
              </div>
              <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>
                {icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow">

        {/* Tab bar */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {(["drivers", "vehicles", "assignments"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "drivers"     && <User    className="w-4 h-4 inline mr-2" />}
                {tab === "vehicles"    && <Truck   className="w-4 h-4 inline mr-2" />}
                {tab === "assignments" && <Package className="w-4 h-4 inline mr-2" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* ── DRIVERS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "drivers" && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Driver</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Vehicle</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">License</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {driverLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                      </td>
                    </tr>
                  ) : driverError ? (
                    <ErrorRow cols={6} message={driverError} onRetry={fetchDrivers} />
                  ) : filteredDrivers.length === 0 ? (
                    <EmptyRow cols={6} message={searchQuery ? "No drivers match your search." : "No drivers yet. Add your first driver."} />
                  ) : (
                    filteredDrivers.map(driver => {
                      const vehicle = vehicleForDriver(driver.vehicleID);
                      return (
                        <tr key={driver.driverID} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-orange-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{driver.name}</div>
                                <div className="text-xs text-gray-400">{driver.driverID}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-gray-900">{driver.phone}</div>
                          </td>
                          <td className="py-4 px-4">
                            {vehicle ? (
                              <div>
                                <Badge className={
                                  vehicle.ownership === "Driver"
                                    ? "bg-purple-100 hover:bg-purple-200 text-purple-700 mb-1"
                                    : "bg-blue-100 hover:bg-blue-200 text-blue-700 mb-1"
                                }>
                                  {vehicle.ownership === "Driver" ? "Own Vehicle" : "Fleet Vehicle"}
                                </Badge>
                                <div className="text-sm text-gray-600">{vehicle.registrationNumber}</div>
                              </div>
                            ) : (
                              <button
                                onClick={() => navigate(`/dashboard/vehicles-drivers/drivers/${driver.driverID}/attach-vehicle`)}
                                className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                              >
                                <Truck className="w-3 h-3" /> Assign vehicle
                              </button>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {driver.licenseNumber
                              ? <>
                                  <div className="text-sm text-gray-900">{driver.licenseNumber}</div>
                                  <ExpiryLabel label="Exp" dateStr={driver.licenseExpiry} />
                                </>
                              : <span className="text-xs text-gray-400">Not provided</span>
                            }
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={driver.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                              {driver.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost" size="sm"
                                className={driver.isActive ? "hover:bg-gray-50 text-gray-500" : "hover:bg-green-50 text-green-600"}
                                disabled={togglingID === driver.driverID}
                                onClick={() => toggleDriver(driver)}
                                title={driver.isActive ? "Deactivate" : "Activate"}
                              >
                                {togglingID === driver.driverID
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : driver.isActive
                                    ? <ToggleRight className="w-4 h-4" />
                                    : <ToggleLeft className="w-4 h-4" />
                                }
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="hover:bg-red-50 text-red-400"
                                disabled={deletingID === driver.driverID}
                                onClick={() => deleteDriver(driver.driverID)}
                                title="Remove driver"
                              >
                                {deletingID === driver.driverID
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />
                                }
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VEHICLES TAB ─────────────────────────────────────────────────── */}
        {activeTab === "vehicles" && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Vehicle</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type / Specs</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Ownership</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Owner</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Documents</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                      </td>
                    </tr>
                  ) : vehicleError ? (
                    <ErrorRow cols={7} message={vehicleError} onRetry={fetchVehicles} />
                  ) : filteredVehicles.length === 0 ? (
                    <EmptyRow cols={7} message={searchQuery ? "No vehicles match your search." : "No vehicles yet. Add your first vehicle."} />
                  ) : (
                    filteredVehicles.map(vehicle => {
                      const driver = driverForVehicle(vehicle.driverID);
                      return (
                        <tr key={vehicle.vehicleID} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Truck className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{vehicle.registrationNumber}</div>
                                <div className="text-xs text-gray-400">{vehicle.vehicleID}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{vehicle.vehicleType ?? "—"}</div>
                            <div className="text-xs text-gray-500">
                              {vehicle.capacity ? `${vehicle.capacity} kg` : ""}
                              {vehicle.capacity && vehicle.fuelType ? " · " : ""}
                              {vehicle.fuelType ?? ""}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={
                              vehicle.ownership === "Distributor"
                                ? "bg-blue-100 hover:bg-blue-200 text-blue-700"
                                : "bg-purple-100 hover:bg-purple-200 text-purple-700"
                            }>
                              {vehicle.ownership}
                            </Badge>
                          </td>

                          {/* Owner: driver name for driver-owned, current logged-in user for fleet */}
                          <td className="py-4 px-4">
                            {vehicle.ownership === "Driver" && driver ? (
                              <>
                                <div className="font-medium text-gray-900">{driver.name}</div>
                                <div className="text-xs text-gray-500">{driver.phone}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-gray-900">{user?.name ?? "—"}</div>
                                <div className="text-xs text-gray-500">{user?.phone ?? ""}</div>
                              </>
                            )}
                          </td>

                          <td className="py-4 px-4 space-y-0.5">
                            <ExpiryLabel label="Insurance" dateStr={vehicle.insuranceExpiry} />
                            <ExpiryLabel label="Permit"    dateStr={vehicle.permitExpiry} />
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={statusColor(vehicle.status)}>{vehicle.status}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex space-x-1">
                              <Button variant="ghost" size="sm" className="hover:bg-blue-50">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="hover:bg-red-50 text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ───────────────────────────────────────────────── */}
        {activeTab === "assignments" && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Driver</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Vehicle</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned At</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Est. Delivery</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <EmptyRow cols={8} message="No assignments yet." />
                  ) : (
                    assignments.map(a => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900">{a.orderId}</div>
                          <div className="text-xs text-gray-400">{a.id}</div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">
                          {drivers.find(d => d.driverID === a.driverId)?.name ?? a.driverId}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">
                          {vehicles.find(v => v.vehicleID === a.vehicleId)?.registrationNumber ?? a.vehicleId}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{a.customerName}</div>
                          <div className="text-xs text-gray-500">{a.deliveryAddress}</div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">{a.assignedAt}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{a.estimatedDelivery}</td>
                        <td className="py-4 px-4">
                          <Badge className={statusColor(a.status)}>{a.status}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" className="hover:bg-blue-50">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="hover:bg-red-50 text-red-400">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}