import {
  Mail,
  Phone,
  MapPin,
  Lock,
  User,
  User2,
  Home,
  Pin,
  FileCheck,
  Building,
  Navigation,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { LocationModal } from "../../../shared/components/LocationModal";
import { locationService } from "../../../shared/services/locationService";
import { getToken } from "../services/authService";

const API_URL = "http://localhost:5203";

export default function ProfileSection() {
  const { user, updateUser, isLoading } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [locationMode, setLocationMode] = useState(false);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",  
    licenseNumber: "",
    licenseCertificate: "",
    gstIN: "",
    gstRegistered: false,
    logo: "",
    companyName: "",
    address: { line1: "", city: "", state: "", pincode: "" },
  });

  // File upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, newPass: false, confirm: false });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const [successType, setSuccessType] = useState<"profile" | "password" | "location" | null>(null);

  type Address = { line1?: string; city?: string; state?: string; pincode?: string };

  function formatAddress(address: Address) {
    if (!address) return "No address added";
    const main = [address.line1, address.city, address.state].filter(Boolean).join(", ");
    if (!main) return "No address added";
    return address.pincode ? `${main} - ${address.pincode}` : main;
  }

  useEffect(() => {
    if (!user) return;

    let addressObj = { line1: "", city: "", state: "", pincode: "" };
    if (typeof user.address === "object" && user.address) {
      addressObj = {
        line1: user.address.line1 || "",
        city: user.address.city || "",
        state: user.address.state || "",
        pincode: user.address.pincode || "",
      };
    } else if (typeof user.address === "string" && user.address) {
      addressObj = { line1: user.address, city: "", state: "", pincode: "" };
    }

    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      licenseNumber: user.licenseNumber || "",
      companyName: user.companyName || "",
      licenseCertificate: user.licenseCertificate || "",
      gstIN: user.gstIN || "",
      gstRegistered: user.gstRegistered || false,
      logo: user.logo || "",
      address: addressObj,
    });
  }, [user]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicenseFile(file);
    setLicenseName(file.name);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const clearLicense = () => {
    setLicenseFile(null);
    setLicenseName(null);
    if (licenseInputRef.current) licenseInputRef.current.value = "";
  };

  const triggerSuccess = (type: "profile" | "password" | "location") => {
    setSuccessType(type);
    setShowSuccess(true);
    setShowTick(false);
    setTimeout(() => setShowTick(true), 1200);
    setTimeout(() => { setShowSuccess(false); setSuccessType(null); }, 2200);
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      const token = getToken();
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("username", form.username);
      formData.append("phone", form.phone);
      formData.append("licenseNumber", form.licenseNumber);
      formData.append("companyName", form.companyName);
      formData.append("address", JSON.stringify(form.address));

      if (logoFile) formData.append("logo", logoFile);
      if (licenseFile) formData.append("license", licenseFile);

      const res = await fetch(`${API_URL}/distributor/${user.id}/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile update failed");

      updateUser({
        ...user,
        name: data.name,
        email: data.email,
        username: data.username,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
        companyName: data.companyName,
        address: data.address,
        logo: data.logo || user.logo,
        licenseCertificate: data.licenseCertificate || user.licenseCertificate,
      });

      setLogoFile(null);
      setLogoPreview(null);
      setLicenseFile(null);
      setLicenseName(null);
      setEditMode(false);
      triggerSuccess("profile");
    } catch (err: any) {
      alert(err?.message || "Profile update failed");
    }
  };

  const changePassword = async () => {
    if (!user) return;
    if (passwords.newPass !== passwords.confirm) { alert("Passwords do not match"); return; }
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/distributor/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPasswordMode(false);
      setPasswords({ current: "", newPass: "", confirm: "" });
      triggerSuccess("password");
    } catch (err: any) {
      alert(err?.message || "Password change failed");
    }
  };

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      await locationService.updateLocation(latitude, longitude, address, "distributor");
      setLocationMode(false);
      triggerSuccess("location");
    } catch (err: any) {
      alert(err?.message || "Failed to update location");
    }
  };

  const inputClass = `
    pl-10 h-11 border border-gray-300 outline-none
    focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0
  `;

  if (isLoading || !user) return <div className="text-center py-10">Loading profile...</div>;

  // Current logo: new preview > existing logo from server > null
  const currentLogo = logoPreview || (user.logo ? `${API_URL}${user.logo}` : null);
  const hasLicense = !!user.licenseCertificate || !!licenseName;

  return (
    <>
      <LocationModal
        isOpen={locationMode}
        onClose={() => setLocationMode(false)}
        onLocationSet={handleLocationSet}
        portalType="distributor"
      />

      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-4">
              {!showTick && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-200 border-t-[#c13c08] animate-spin" />
                  <div className="absolute inset-2 rounded-full bg-orange-100 flex items-center justify-center shadow-inner">
                    <User className="w-8 h-8 text-[#c13c08]" />
                  </div>
                </div>
              )}
              {showTick && (
                <div className="absolute inset-0 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#c13c08]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {successType === "password" ? "Password Updated" : successType === "location" ? "Location Updated" : "Profile Updated"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {successType === "password" ? "Your password has been changed securely"
                : successType === "location" ? "Your business location has been saved"
                : "Your profile details were saved successfully"}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-black mb-1">Distributor Settings</h1>
          <p className="text-gray-600">Manage your distributor account details and security settings.</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">

            {/* HEADER */}
            <div className="flex items-center gap-4">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Logo"
                  className="w-14 h-14 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-14 h-14 bg-orange-100 text-[#c13c08] flex items-center justify-center rounded-full text-xl font-bold">
                  {form.name.charAt(0).toUpperCase() || "D"}
                </div>
              )}
              <div>
                <h3 className="text-xl font-semibold">{form.name}</h3>
                <p className="text-sm text-orange-700">Distributor</p>
              </div>
            </div>

            <hr />

            {/* VIEW MODE */}
            {!editMode && !passwordMode && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-500" />{form.email}</div>
                  <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-500" />{form.phone || "Not provided"}</div>
                  <div className="flex items-center gap-2 text-sm"><FileCheck className="w-4 h-4 text-gray-500" />{form.licenseNumber || "Not provided"}</div>
                  <div className="flex items-center gap-2 text-sm"><Building className="w-4 h-4 text-gray-500" />{form.companyName || "Not provided"}</div>
                  <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-gray-500 mt-0.5" />{formatAddress(form.address)}</div>

                  {/* Logo & License status */}
                  <div className="flex items-center gap-2 text-sm">
                    <Upload className="w-4 h-4 text-gray-500" />
                    <span className={user.logo ? "text-green-600" : "text-orange-500"}>
                      Logo: {user.logo ? "Uploaded" : "Not uploaded"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className={hasLicense ? "text-green-600" : "text-orange-500"}>
                      License Certificate: {hasLicense ? "Uploaded" : "Not uploaded"}
                    </span>
                  </div>
                </div>

                <hr />

                <div className="space-y-2">
                  <Button className="w-full bg-[#c13c08] hover:bg-[#a02f06] text-white" onClick={() => setEditMode(true)}>
                    Edit Profile
                  </Button>
                  <Button variant="outline" className="w-full bg-white text-gray-700 hover:bg-orange-100" onClick={() => setPasswordMode(true)}>
                    Change Password
                  </Button>
                  <Button variant="outline" className="w-full bg-white text-gray-700 hover:bg-orange-100 flex items-center justify-center gap-2" onClick={() => setLocationMode(true)}>
                    <Navigation className="w-4 h-4" />
                    Reset Location
                  </Button>
                </div>
              </>
            )}

            {/* EDIT PROFILE */}
            {editMode && (
              <div className="space-y-4">

                {/* Logo Upload */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Logo</p>
                  <div className="flex items-center gap-3">
                    {currentLogo ? (
                      <div className="relative">
                        <img src={currentLogo} alt="Logo preview" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                        {logoFile && (
                          <button onClick={clearLogo} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-orange-100 text-[#c13c08] flex items-center justify-center text-xl font-bold border-2 border-dashed border-orange-300">
                        {form.name.charAt(0).toUpperCase() || "D"}
                      </div>
                    )}
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      <Button type="button" variant="outline" className="text-sm border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => logoInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {user.logo ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {logoFile && <p className="text-xs text-gray-500 mt-1">{logoFile.name}</p>}
                    </div>
                  </div>
                </div>

                {/* License Certificate Upload */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">License Certificate</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 ${user.licenseCertificate || licenseFile ? "bg-green-50 border-green-300" : "bg-orange-50 border-dashed border-orange-300"}`}>
                      <FileText className={`w-7 h-7 ${user.licenseCertificate || licenseFile ? "text-green-600" : "text-orange-400"}`} />
                    </div>
                    <div>
                      <input ref={licenseInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleLicenseChange} />
                      <Button type="button" variant="outline" className="text-sm border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => licenseInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {user.licenseCertificate ? "Replace Certificate" : "Upload Certificate"}
                      </Button>
                      {licenseName ? (
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-xs text-gray-500 truncate max-w-[160px]">{licenseName}</p>
                          <button onClick={clearLicense}><X className="w-3 h-3 text-red-400" /></button>
                        </div>
                      ) : user.licenseCertificate ? (
                        <p className="text-xs text-green-600 mt-1">Certificate on file</p>
                      ) : (
                        <p className="text-xs text-orange-500 mt-1">Not yet uploaded</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr />

                {/* Text fields */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="relative">
                  <User2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="relative">
                  <FileCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="License Number" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
                </div>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Company Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className={inputClass} placeholder="Address Line" value={form.address.line1} onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className={inputClass} placeholder="City" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className={inputClass} placeholder="State" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} />
                  </div>
                  <div className="relative">
                    <Pin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className={inputClass} placeholder="Pincode" value={form.address.pincode} onChange={(e) => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="bg-[#c13c08] hover:bg-[#a02f06] text-white" onClick={saveProfile}>Save Changes</Button>
                  <Button variant="outline" onClick={() => { setEditMode(false); clearLogo(); clearLicense(); }}>Cancel</Button>
                </div>
              </div>
            )}

            {/* CHANGE PASSWORD */}
            {passwordMode && (
              <div className="space-y-4">
                {(["current", "newPass", "confirm"] as const).map((field) => (
                  <div key={field} className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className={`pl-10 pr-10 h-11 border border-gray-300 outline-none
                        focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0`}
                      type={showPasswords[field] ? "text" : "password"}
                      placeholder={field === "current" ? "Current Password" : field === "newPass" ? "New Password" : "Confirm New Password"}
                      value={passwords[field]}
                      onChange={(e) => setPasswords({ ...passwords, [field]: e.target.value })}
                    />
                    <button type="button" onClick={() => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPasswords[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button className="bg-[#c13c08] hover:bg-[#a02f06] text-white" onClick={changePassword}>Update Password</Button>
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