import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Lock, Phone, Truck, Eye, EyeOff, ArrowLeft,
  CheckCircle2, Hash, Upload, Calendar, FileText, X,
  ChevronDown, ChevronUp, Fuel, Weight,
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function FileUploadField({ label, file, onSelect, onClear }: {
  label: string; file: File | null;
  onSelect: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onSelect(e.target.files[0]); }}
      />
      {file ? (
        <div className="flex items-center justify-between h-11 px-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="truncate text-gray-700">{file.name}</span>
          </div>
          <button type="button" onClick={onClear} className="ml-2 text-gray-400 hover:text-red-500 shrink-0">
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button" onClick={() => ref.current?.click()}
          className="w-full h-11 flex items-center gap-2 px-3 rounded-md border border-dashed
            border-gray-300 bg-white text-sm text-gray-500
            hover:border-orange-400 hover:text-orange-500 transition"
        >
          <Upload className="h-4 w-4" />
          {label}
        </button>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddDriverPage() {
  const navigate = useNavigate();

  // Driver
  const [form, setForm] = useState({
    name: "", phone: "", username: "", password: "",
    licenseNumber: "", licenseExpiry: "",
  });
  const [dlCertificate, setDlCertificate] = useState<File | null>(null);

  // Driver's own vehicle (optional)
  const [hasOwnVehicle, setHasOwnVehicle] = useState(false);
  const [vehicle, setVehicle] = useState({
    registrationNumber: "", vehicleType: "", capacity: "",
    fuelType: "", insuranceExpiry: "", permitExpiry: "",
  });

  // UI
  const [showPassword, setShowPassword]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [showSuccess, setShowSuccess]     = useState(false);
  const [createdDriver, setCreatedDriver] = useState<{ name: string; username: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const setF = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setV = (k: keyof typeof vehicle) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setVehicle(p => ({ ...p, [k]: e.target.value }));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.username || !form.password || !form.phone) {
      setError("Name, username, password, and phone are required.");
      return;
    }
    if (hasOwnVehicle && !vehicle.registrationNumber) {
      setError("Enter the vehicle registration number or uncheck 'Driver has own vehicle'.");
      return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();

      // Driver fields
      fd.append("name",     form.name);
      fd.append("username", form.username);
      fd.append("password", form.password);
      fd.append("phone",    form.phone);
      if (form.licenseNumber) fd.append("licenseNumber", form.licenseNumber);
      if (form.licenseExpiry) fd.append("licenseExpiry", form.licenseExpiry);
      if (dlCertificate)      fd.append("dlCertificate", dlCertificate);

      // Driver's own vehicle fields
      if (hasOwnVehicle) {
        fd.append("vehicleOwnership",    "Driver");
        fd.append("vehicleRegistration", vehicle.registrationNumber);
        if (vehicle.vehicleType)     fd.append("vehicleType",     vehicle.vehicleType);
        if (vehicle.capacity)        fd.append("vehicleCapacity",  vehicle.capacity);
        if (vehicle.fuelType)        fd.append("vehicleFuelType",  vehicle.fuelType);
        if (vehicle.insuranceExpiry) fd.append("insuranceExpiry",  vehicle.insuranceExpiry);
        if (vehicle.permitExpiry)    fd.append("permitExpiry",     vehicle.permitExpiry);
      }

      const created = await authService.registerDriver(fd);
      setCreatedDriver({ name: created.name, username: created.username });
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to register driver");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowSuccess(false);
    setCreatedDriver(null);
    setForm({ name: "", phone: "", username: "", password: "", licenseNumber: "", licenseExpiry: "" });
    setVehicle({ registrationNumber: "", vehicleType: "", capacity: "", fuelType: "", insuranceExpiry: "", permitExpiry: "" });
    setDlCertificate(null);
    setHasOwnVehicle(false);
  };

  // ── Success ────────────────────────────────────────────────────────────────
  if (showSuccess && createdDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C2410C] to-[#f69c3c] px-4">
        <Card className="w-full max-w-md border-0 bg-[#FFF7ED] shadow-2xl text-center">
          <CardContent className="pt-10 pb-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Driver Added!</h2>
              <p className="text-gray-500 text-sm mt-1">Share these credentials with the driver.</p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 text-left space-y-2">
              {[
                { label: "Name",     value: createdDriver.name },
                { label: "Username", value: createdDriver.username },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {showPassword ? form.password : "•".repeat(form.password.length)}
                  </span>
                  <button onClick={() => setShowPassword(p => !p)} className="text-gray-400 hover:text-gray-700">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {hasOwnVehicle && vehicle.registrationNumber && (
                <div className="flex justify-between text-sm pt-1 border-t border-orange-100">
                  <span className="text-gray-500">Vehicle</span>
                  <span className="font-medium text-gray-900">{vehicle.registrationNumber}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">The driver can change their password after first login.</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={resetForm}
                className="flex-1 border border-orange-200 text-orange-600 hover:bg-orange-50">
                Add Another
              </Button>
              <Button onClick={() => navigate("/dashboard/vehicles-drivers")}
                className="flex-1 bg-[#EA580C] hover:bg-[#C2410C] text-white">
                View All Drivers
              </Button>
            </div>
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
            <User className="h-7 w-7 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-semibold text-black">Add Driver</CardTitle>
          <CardDescription className="text-gray-500">
            Register a new delivery driver for your fleet
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── DRIVER DETAILS ─────────────────────────────────────── */}
            <Section title="Driver Details">
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                <Input placeholder="Full Name" value={form.name} onChange={setF("name")} className={inputClass} required />
              </div>
              <div className="relative group">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                <Input placeholder="Phone Number" value={form.phone} onChange={setF("phone")} className={inputClass} required />
              </div>
            </Section>

            {/* ── DRIVING LICENSE ────────────────────────────────────── */}
            <Section title="Driving License" subtitle="Optional but recommended">
              <div className="relative group">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                <Input
                  placeholder="DL Number (e.g. KA01 20230012345)"
                  value={form.licenseNumber} onChange={setF("licenseNumber")} className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 pl-1">DL Expiry Date</label>
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    type="date" value={form.licenseExpiry} onChange={setF("licenseExpiry")}
                    min={today} className={inputClass + " text-gray-600"}
                  />
                </div>
              </div>
              <FileUploadField
                label="Upload DL Certificate (PDF / Image)"
                file={dlCertificate} onSelect={setDlCertificate} onClear={() => setDlCertificate(null)}
              />
            </Section>

            {/* ── DRIVER'S OWN VEHICLE ───────────────────────────────── */}
            <Section title="Driver's Own Vehicle" subtitle="Does this driver bring their own vehicle?">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => setHasOwnVehicle(p => !p)}
                className={`w-full flex items-center justify-between px-4 h-11 rounded-md border
                  text-sm transition ${hasOwnVehicle
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-300 bg-white text-gray-600 hover:border-orange-300"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Truck className={`h-4 w-4 ${hasOwnVehicle ? "text-orange-500" : "text-gray-400"}`} />
                  {hasOwnVehicle ? "Yes — driver has their own vehicle" : "No — driver uses distributor vehicle or none"}
                </span>
                {hasOwnVehicle
                  ? <ChevronUp className="h-4 w-4 text-orange-400" />
                  : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {/* Vehicle fields — shown when toggled on */}
              {hasOwnVehicle && (
                <div className="space-y-3 rounded-xl border border-orange-100 bg-white p-4">
                  {/* Registration */}
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                    <Input
                      placeholder="Registration No. (e.g. KA01AB1234)"
                      value={vehicle.registrationNumber} onChange={setV("registrationNumber")}
                      className={inputClass} required={hasOwnVehicle}
                    />
                  </div>

                  {/* Type */}
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select value={vehicle.vehicleType} onChange={setV("vehicleType")} className={selectClass}>
                      <option value="">Vehicle Type</option>
                      {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  {/* Capacity + Fuel */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative group">
                      <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                      <Input type="number" placeholder="Capacity (kg)" value={vehicle.capacity} onChange={setV("capacity")} className={inputClass} />
                    </div>
                    <div className="relative">
                      <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <select value={vehicle.fuelType} onChange={setV("fuelType")} className={selectClass}>
                        <option value="">Fuel Type</option>
                        {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Insurance + Permit Expiry */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 pl-1">Insurance Expiry</label>
                      <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input type="date" value={vehicle.insuranceExpiry} onChange={setV("insuranceExpiry")}
                          min={today} className={inputClass + " text-gray-600"} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 pl-1">Permit Expiry</label>
                      <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input type="date" value={vehicle.permitExpiry} onChange={setV("permitExpiry")}
                          min={today} className={inputClass + " text-gray-600"} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* ── LOGIN CREDENTIALS ──────────────────────────────────── */}
            <Section title="Login Credentials" subtitle="Driver will use these to sign in">
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                <Input placeholder="Username" value={form.username} onChange={setF("username")} className={inputClass} required />
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
                <Input
                  type={showPassword ? "text" : "password"} placeholder="Set Password"
                  value={form.password} onChange={setF("password")} className={inputClass} required
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </Section>

            <Button type="submit" disabled={isSubmitting}
              className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-medium mt-2">
              {isSubmitting ? "Creating Account..." : "Add Driver"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}