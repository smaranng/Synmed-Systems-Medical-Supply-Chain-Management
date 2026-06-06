import {
  Mail,
  Download,
  Lock,
  Image as ImageIcon,
  Phone,
  MapPin,
  FileCheck,
  FileText,
  PencilLine,
  Building,
  User,
  Home,
  Pin,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";

const API_URL = "http://localhost:5203";

// ─── Timings types & helpers ──────────────────────────────────────────────────
type DayTimings = { open: string; close: string; closed: boolean };
type WeekTimings = Record<string, DayTimings>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultTimings = (): WeekTimings =>
  Object.fromEntries(
    DAYS.map((day) => [day, { open: "09:00", close: "21:00", closed: false }])
  );

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const todayKey = () => DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

function isOpenNow(t: DayTimings | undefined): boolean {
  if (!t || t.closed) return false;
  return nowMins() >= toMins(t.open) && nowMins() < toMins(t.close);
}

export default function PharmacySettingsSection() {
  const { user, updateUser, isLoading } = useAuth();

  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [timingsMode, setTimingsMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({ current: false, newPass: false, confirm: false });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const [successType, setSuccessType] = useState<"profile" | "password" | "timings" | null>(null);
  const [timings, setTimings] = useState<WeekTimings>(defaultTimings());

  const logoInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", username: "", email: "", phone: "",
    address: { line1: "", city: "", state: "", pincode: "" },
    licenseNumber: "",
  });

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const [license, setLicense] = useState<File | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function parseAddress(address: string) {
    if (!address) return { line1: "", city: "", state: "", pincode: "" };
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) {
      return { line1: parts[0] || "", city: parts[1] || "", state: parts[2] || "", pincode: parts[3] || "" };
    }
    return {
      line1: parts.slice(0, -3).join(", "),
      city: parts.slice(-3, -2).join(", "),
      state: parts.at(-2) || "",
      pincode: parts.at(-1) || "",
    };
  }

  const loadTimingsFromObject = (raw: Record<string, { open: string; close: string }>) => {
    const merged: WeekTimings = {};
    DAYS.forEach((day) => {
      if (raw[day]) {
        merged[day] = { open: raw[day].open, close: raw[day].close, closed: false };
      } else {
        merged[day] = { open: "09:00", close: "21:00", closed: true };
      }
    });
    setTimings(merged);
  };

  const fetchTimingsFromBackend = async (pharmaId: string) => {
    try {
      const res = await fetch(`${API_URL}/pharmacy/${pharmaId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.timings && Object.keys(data.timings).length > 0) {
        loadTimingsFromObject(data.timings);
      }
    } catch (err) {
      console.error("Failed to fetch pharmacy timings:", err);
    }
  };

  // ── Load user data on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let parsedAddress = { line1: "", city: "", state: "", pincode: "" };
    if (typeof user.address === "string") parsedAddress = parseAddress(user.address);

    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      licenseNumber: user.licenseNumber || "",
      address: parsedAddress,
    });

    if (user.logo) setLogoPreview(`${API_URL}${user.logo}`);
    if (user.licenseCertificate) setLicensePreview(`${API_URL}${user.licenseCertificate}`);

    // ✅ Always fetch timings fresh — localStorage may be stale
    fetchTimingsFromBackend(user.id);
  }, [user]);

  const triggerSuccess = (type: "profile" | "password" | "timings") => {
    setSuccessType(type);
    setShowSuccess(true);
    setShowTick(false);
    setTimeout(() => setShowTick(true), 1200);
    setTimeout(() => { setShowSuccess(false); setSuccessType(null); }, 2200);
  };

  const handleCancel = () => {
    setEditMode(false);
    setLogo(null);
    setLicense(null);
    if (logoPreview?.startsWith("blob:")) setLogoPreview(null);
    else if (user?.logo) setLogoPreview(`${API_URL}${user.logo}`);
    if (licensePreview?.startsWith("blob:")) setLicensePreview(null);
    else if (user?.licenseCertificate) setLicensePreview(`${API_URL}${user.licenseCertificate}`);
    if (user) {
      const parsedAddress = typeof user.address === "string"
        ? parseAddress(user.address)
        : { line1: "", city: "", state: "", pincode: "" };
      setForm({
        name: user.name || "", username: user.username || "",
        email: user.email || "", phone: user.phone || "",
        licenseNumber: user.licenseNumber || "", address: parsedAddress,
      });
    }
  };

  const handleDownload = async (url: string | null, filename: string) => {
    if (!url) return;
    try {
      const fullUrl = url.startsWith("blob:") || url.startsWith("http") ? url : `${API_URL}${url}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url.startsWith("http") ? url : `${API_URL}${url}`, "_blank");
    }
  };

  const isPDF = (file: File | null, existingPath: string | null) => {
    if (file) return file.type === "application/pdf";
    return existingPath?.toLowerCase().endsWith(".pdf");
  };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const addressString = [form.address.line1, form.address.city, form.address.state, form.address.pincode]
        .filter(Boolean).join(", ");
      const fd = new FormData();
      fd.append("username", form.username);
      fd.append("email", form.email);
      fd.append("name", form.name);
      fd.append("address", addressString);
      if (logo) fd.append("logo", logo);
      if (license) fd.append("license", license);

      const { getToken } = await import("../services/authService");
      const token = getToken();

      const res = await fetch(`${API_URL}/pharmacy/${user.id}/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Update failed"); }

      const updated = await res.json();
      updateUser({
        ...user,
        name: updated.name, email: updated.email, username: updated.username,
        address: updated.address, logo: updated.logo ?? user.logo,
        licenseCertificate: updated.licenseCertificate ?? user.licenseCertificate,
      });

      setForm({ name: updated.name, username: updated.username, email: updated.email, phone: updated.phone || "", licenseNumber: updated.licenseNumber || "", address: parseAddress(updated.address || "") });
      setEditMode(false);
      setLogo(null);
      setLicense(null);
      if (updated.logo) setLogoPreview(`${API_URL}${updated.logo}`);
      if (updated.licenseCertificate) setLicensePreview(`${API_URL}${updated.licenseCertificate}`);
      triggerSuccess("profile");
    } catch (err: any) {
      alert(err.message || "Profile update failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Save timings ─────────────────────────────────────────────────────────────
  const saveTimings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const timingsPayload: Record<string, { open: string; close: string }> = {};
      DAYS.forEach((day) => {
        if (!timings[day].closed) {
          timingsPayload[day] = { open: timings[day].open, close: timings[day].close };
        }
      });

      const { getToken } = await import("../services/authService");
      const token = getToken();

      const fd = new FormData();
      fd.append("timings", JSON.stringify(timingsPayload));

      const res = await fetch(`${API_URL}/pharmacy/${user.id}/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save timings"); }

      const updated = await res.json();

      // ✅ Update context and reload timings state from saved response
      updateUser({ ...user, timings: updated.timings });
      if (updated.timings) loadTimingsFromObject(updated.timings);

      setTimingsMode(false);
      triggerSuccess("timings");
    } catch (err: any) {
      alert(err.message || "Failed to save timings");
    } finally {
      setLoading(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (!user) return;
    if (passwords.newPass !== passwords.confirm) { alert("Passwords do not match"); return; }
    try {
      const { getToken } = await import("../services/authService");
      const token = getToken();
      const res = await fetch(`${API_URL}/pharmacy/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Password change failed"); }
      setPasswordMode(false);
      setPasswords({ current: "", newPass: "", confirm: "" });
      triggerSuccess("password");
    } catch (err: any) {
      alert(err?.message || "Password change failed");
    }
  };

  if (isLoading || !user) return <div className="text-center py-10">Loading settings…</div>;

  const inputCls = `
    pl-10 h-11 border border-gray-300 outline-none
    focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0
  `;

  return (
    <>
      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-4">
              {!showTick && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                  <div className="absolute inset-2 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
                    {successType === "timings"
                      ? <Clock className="w-8 h-8 text-emerald-700" />
                      : <User className="w-8 h-8 text-emerald-700" />}
                  </div>
                </div>
              )}
              {showTick && (
                <div className="absolute inset-0 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {successType === "password" ? "Password Updated"
                : successType === "timings" ? "Timings Saved"
                : "Profile Updated"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {successType === "password" ? "Your password has been changed securely"
                : successType === "timings" ? "Opening hours updated successfully"
                : "Your pharmacy details were saved successfully"}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-black mb-1">Pharmacy Settings</h1>
          <p className="text-gray-600">Manage pharmacy profile, logo, license, timings and security.</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">

            {/* HEADER */}
            <div className="flex items-center gap-4">
              {user.logo ? (
                <img src={`${API_URL}${user.logo}?t=${Date.now()}`} alt="Pharmacy logo" className="w-16 h-16 rounded-lg border object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold border">
                  {user.name?.charAt(0).toUpperCase() || "P"}
                </div>
              )}
              <div>
                <h3 className="text-xl font-semibold">{form.name}</h3>
                <p className="text-sm text-emerald-700">Pharmacy Account</p>
              </div>
            </div>

            <hr />

            {/* ── VIEW MODE ── */}
            {!editMode && !passwordMode && !timingsMode && (
              <>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-500" />{form.email}</div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-500" />{form.phone || "N/A"}</div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {[form.address.line1, form.address.city, form.address.state, form.address.pincode].filter(Boolean).join(", ") || "N/A"}
                  </div>
                  <div className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-gray-500" />{form.licenseNumber || "Not set"}</div>
                </div>

                <hr />

                {/* TIMINGS VIEW */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-tight flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" /> Opening Hours
                    </h4>
                    {(() => {
                      const t = timings[todayKey()];
                      const open = isOpenNow(t);
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-green-500" : "bg-red-400"}`} />
                          {open ? "Open Now" : "Closed Now"}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="rounded-lg border overflow-hidden text-sm">
                    {DAYS.map((day) => {
                      const t = timings[day];
                      const isToday = day === todayKey();
                      const open = isToday && isOpenNow(t);
                      return (
                        <div key={day} className={`flex items-center justify-between px-4 py-2.5 ${isToday ? "bg-emerald-50" : "even:bg-gray-50 bg-white"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${isToday ? (open ? "bg-green-500" : "bg-red-400") : t?.closed ? "bg-gray-200" : "bg-gray-300"}`} />
                            <span className={`${isToday ? "font-bold text-emerald-700" : "text-gray-600"}`}>{day}</span>
                            {isToday && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {open ? "Open now" : "Closed now"}
                              </span>
                            )}
                          </div>
                          <span className={`font-medium ${isToday ? "text-emerald-700" : t?.closed ? "text-gray-400 italic" : "text-gray-600"}`}>
                            {t?.closed ? "Closed" : `${t?.open} – ${t?.close}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <hr />

                {/* LICENSE VIEW */}
                {(licensePreview || user.licenseCertificate) && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">License Certificate</label>
                    <div className="border rounded-lg p-3 bg-gray-50 flex items-center gap-3">
                      {isPDF(null, user.licenseCertificate || null) ? (
                        <>
                          <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">PDF Document</p>
                            <p className="text-xs text-gray-500">{user.licenseCertificate?.split("/").pop() || "license.pdf"}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">Certificate Image</p>
                            <p className="text-xs text-gray-500">{user.licenseCertificate?.split("/").pop() || "license-image"}</p>
                          </div>
                        </>
                      )}
                      <Button type="button" size="sm" className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleDownload(licensePreview || user.licenseCertificate || null, "pharmacy-license")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <hr />

                <div className="space-y-2">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setEditMode(true)}>Edit Profile</Button>
                  <Button variant="outline" className="w-full" onClick={() => setTimingsMode(true)}>
                    <Clock className="w-4 h-4 mr-2 " /> Edit Timings
                  </Button>
                  <Button variant="outline" className="w-full bg-emerald-100 hover:bg-emerald-200" onClick={() => setPasswordMode(true)}>Change Password</Button>
                </div>
              </>
            )}

            {/* ── EDIT PROFILE ── */}
            {editMode && (
              <div className="space-y-4">
                <div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="Pharmacy Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="relative"><Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="Address Line 1" value={form.address.line1} onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} /></div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="City" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} /></div>
                  <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="State" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} /></div>
                  <div className="relative"><Pin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className={inputCls} placeholder="Pincode" value={form.address.pincode} onChange={(e) => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} /></div>
                </div>

                {/* Asset Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* LOGO */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Pharmacy Logo</label>
                    <div className="border rounded-xl p-4 flex flex-col items-center bg-gray-50 space-y-4 shadow-sm">
                      <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center">
                        {logoPreview || user.logo ? (
                          <img src={logoPreview ?? `${API_URL}${user.logo}`} className="w-full h-full object-cover" alt="Logo Preview" />
                        ) : (
                          <div className="flex flex-col items-center text-gray-400"><ImageIcon className="w-10 h-10 mb-1 opacity-20" /><span className="text-[10px] font-bold uppercase tracking-tighter text-center">Not Yet Uploaded</span></div>
                        )}
                      </div>
                      <div className="flex w-full gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1 bg-white border-gray-300" onClick={() => handleDownload(logoPreview || user.logo || null, "pharmacy-logo")} disabled={!logoPreview && !user.logo}><Download className="w-4 h-4 mr-2" /> Download</Button>
                        <Button type="button" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => logoInputRef.current?.click()}><PencilLine className="w-4 h-4 mr-2" /> Edit</Button>
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0] || null; setLogo(file); if (file) setLogoPreview(URL.createObjectURL(file)); }} />
                      </div>
                    </div>
                  </div>

                  {/* LICENSE */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">License Certificate</label>
                    <div className="border rounded-xl p-4 flex flex-col items-center bg-gray-50 space-y-4 shadow-sm">
                      <div className="w-32 h-32 rounded-lg flex items-center justify-center border-2 border-white shadow-md bg-white overflow-hidden text-center">
                        {licensePreview || user.licenseCertificate ? (
                          isPDF(license, user.licenseCertificate ?? null) ? (
                            <div className="flex flex-col items-center text-red-500"><FileText className="w-10 h-10 mb-1 opacity-60" /><span className="text-[10px] font-bold uppercase tracking-tight">PDF Document</span></div>
                          ) : (
                            <img src={licensePreview ?? `${API_URL}${user.licenseCertificate}`} className="w-full h-full object-cover" alt="License Preview" />
                          )
                        ) : (
                          <div className="flex flex-col items-center text-gray-400"><FileText className="w-10 h-10 mb-1 opacity-20" /><span className="text-[10px] font-bold uppercase tracking-tighter text-center leading-tight">Not Yet<br />Uploaded</span></div>
                        )}
                      </div>
                      <div className="flex w-full gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1 bg-white border-gray-300" onClick={() => handleDownload(licensePreview || user.licenseCertificate || null, "pharmacy-license")} disabled={!licensePreview && !user.licenseCertificate}><Download className="w-4 h-4 mr-2" /> Download</Button>
                        <Button type="button" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => licenseInputRef.current?.click()}><PencilLine className="w-4 h-4 mr-2" /> Edit</Button>
                        <input type="file" ref={licenseInputRef} className="hidden" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0] || null; setLicense(file); if (file) setLicensePreview(URL.createObjectURL(file)); }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveProfile} className="bg-[#047857] hover:bg-[#059669]" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
                  <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── EDIT TIMINGS ── */}
            {timingsMode && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-gray-800">Edit Opening Hours</h3>
                </div>

                <div className="rounded-xl border overflow-hidden divide-y divide-gray-100">
                  <div className="grid grid-cols-[140px_1fr_1fr_80px] gap-3 px-4 py-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span>Day</span><span>Opens</span><span>Closes</span><span className="text-center">Closed</span>
                  </div>

                  {DAYS.map((day) => {
                    const t = timings[day];
                    const isToday = day === todayKey();
                    return (
                      <div key={day} className={`grid grid-cols-[140px_1fr_1fr_80px] gap-3 items-center px-4 py-3 ${isToday ? "bg-emerald-50" : "bg-white hover:bg-gray-50"} transition-colors`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${isToday ? "bg-emerald-500" : "bg-gray-300"}`} />
                          <span className={`text-sm font-medium ${isToday ? "text-emerald-700 font-bold" : "text-gray-700"}`}>
                            {day}{isToday && <span className="ml-1 text-[10px] font-semibold text-emerald-600">(Today)</span>}
                          </span>
                        </div>
                        <input type="time" value={t.open} disabled={t.closed}
                          onChange={(e) => setTimings({ ...timings, [day]: { ...t, open: e.target.value } })}
                          className={`h-9 px-3 rounded-lg border text-sm transition-colors ${t.closed ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"}`}
                        />
                        <input type="time" value={t.close} disabled={t.closed}
                          onChange={(e) => setTimings({ ...timings, [day]: { ...t, close: e.target.value } })}
                          className={`h-9 px-3 rounded-lg border text-sm transition-colors ${t.closed ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"}`}
                        />
                        <div className="flex justify-center">
                          <button type="button"
                            onClick={() => setTimings({ ...timings, [day]: { ...t, closed: !t.closed } })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${t.closed ? "bg-red-400" : "bg-emerald-500"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${t.closed ? "translate-x-1" : "translate-x-6"}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-gray-500 self-center">Quick set:</span>
                  <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    onClick={() => setTimings(Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "21:00", closed: false }])))}>
                    All 9AM–9PM
                  </button>
                  <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    onClick={() => setTimings(Object.fromEntries(DAYS.map((d, i) => [d, { open: "09:00", close: "21:00", closed: i === 6 }])))}>
                    Mon–Sat 9AM–9PM
                  </button>
                  <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    onClick={() => setTimings(Object.fromEntries(DAYS.map((d) => [d, { open: "08:00", close: "22:00", closed: false }])))}>
                    All 8AM–10PM
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={saveTimings} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>
                    {loading ? "Saving..." : "Save Timings"}
                  </Button>
                  <Button variant="outline" onClick={() => setTimingsMode(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── CHANGE PASSWORD ── */}
            {passwordMode && (
              <div className="space-y-4">
                {[
                  { key: "current", label: "Current Password" },
                  { key: "newPass", label: "New Password" },
                  { key: "confirm", label: "Confirm New Password" },
                ].map(({ key, label }) => (
                  <div key={key} className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="pl-10 pr-10 h-11 border border-gray-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                      type={showPasswords[key as keyof typeof showPasswords] ? "text" : "password"}
                      placeholder={label}
                      value={passwords[key as keyof typeof passwords]}
                      onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                    />
                    <button type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, [key]: !showPasswords[key as keyof typeof showPasswords] })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPasswords[key as keyof typeof showPasswords] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={changePassword} className="bg-emerald-600 hover:bg-emerald-700">Update Password</Button>
                  <Button variant="outline" onClick={() => setPasswordMode(false)}>Cancel</Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </>
  );
}