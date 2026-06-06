import {
  Mail,
  Phone,
  MapPin,
  Lock,
  User,
  User2,
  Home,
  Pin,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { Eye, EyeOff } from "lucide-react";

export default function ProfileSection() {
  const { user, updateUser, isLoading } = useAuth();
  console.log("USER ID:", user?.id);
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    address: { line1: "", city: "", state: "", pincode: "" },
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    newPass: false,
    confirm: false,
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const [successType, setSuccessType] = useState<"profile" | "password" | null>(
    null
  );

  // 🔹 Load profile safely
  useEffect(() => {
    if (!user) return;

    // Handle address as either object or string
    let addressObj = { line1: "", city: "", state: "", pincode: "" };

    if (typeof user.address === "object" && user.address) {
      // Address is already an object from backend
      addressObj = {
        line1: user.address.line1 || "",
        city: user.address.city || "",
        state: user.address.state || "",
        pincode: user.address.pincode || "",
      };
    } else if (typeof user.address === "string" && user.address) {
      // Address is a string (legacy format)
      addressObj = {
        line1: user.address,
        city: "",
        state: "",
        pincode: "",
      };
    }

    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      address: addressObj,
    });
  }, [user]);

  // 🔹 Save profile and update context
  const saveProfile = async () => {
    if (!user) return;

    try {
      const updated = await authService.updateAdminProfile(user.id, {
        name: form.name,
        email: form.email,
        username: form.username,
        phone: form.phone,
        address: {
          line1: form.address.line1,
          city: form.address.city,
          state: form.address.state,
          pincode: form.address.pincode,
        },
      });

      const mergedUser = {
        ...user, // 🔒 keep id, role, auth fields
        name: updated.name,
        email: updated.email,
        username: updated.username,
        phone: updated.phone,
        address: updated.address, // Store address object as returned from backend
      };

      updateUser(mergedUser);
      setEditMode(false);

      setSuccessType("profile");
      setShowSuccess(true);
      setShowTick(false);

      setTimeout(() => setShowTick(true), 1200);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessType(null);
      }, 2200);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Profile update failed");
    }
  };

  // 🔹 Change password
  const changePassword = async () => {
    if (!user) return;
    if (passwords.newPass !== passwords.confirm) {
      alert("Passwords do not match");
      return;
    }
    try {
      await authService.changeAdminPassword(user.id, {
        currentPassword: passwords.current,
        newPassword: passwords.newPass,
      });

      setPasswordMode(false);
      setPasswords({ current: "", newPass: "", confirm: "" });

      setSuccessType("password");
      setShowSuccess(true);
      setShowTick(false);

      setTimeout(() => setShowTick(true), 1200);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessType(null);
      }, 2200);
    } catch (err: any) {
      console.error("Password change failed:", err);
      alert(err?.message || "Password change failed");
    }
  };

  // 🔹 Show loading until user is available
  if (isLoading || !user) {
    return <div className="text-center py-10">Loading profile...</div>;
  }

  return (
    <>
      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div
            className="
          bg-white rounded-2xl shadow-2xl
          px-10 py-8
          flex flex-col items-center
          animate-success-pop
          animate-[scaleIn_0.35s_ease-out]
        "
          >
            {/* ICON TRANSITION */}
            <div className="relative w-20 h-20 mb-4">
              {/* SPINNER + USER */}
              {!showTick && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="
                  absolute inset-0
                  rounded-full
                  border-4
                  border-purple-200
                  border-t-[#4A0F73]
                  animate-spin
                "
                  />
                  <div
                    className="
                  absolute inset-2
                  rounded-full
                  bg-purple-100
                  flex items-center justify-center
                  shadow-inner
                "
                  >
                    <User className="w-8 h-8 text-[#4A0F73]" />
                  </div>
                </div>
              )}

              {/* SUCCESS TICK */}
              {showTick && (
                <div
                  className="
                absolute inset-0
                rounded-full
                bg-purple-100
                flex items-center justify-center
                animate-success-ring
              "
                >
                  <svg
                    className="w-10 h-10 text-[#4A0F73] animate-success-check"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* TEXT */}
            <h3 className="text-lg font-semibold text-gray-900">
              {successType === "password"
                ? "Password Updated"
                : "Profile Updated"}
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              {successType === "password"
                ? "Your password has been changed securely"
                : "Your profile details were saved successfully"}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-black mb-1">Admin Settings</h1>
          <p className="text-gray-600">
            Manage your admin account details and security settings.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 text-[#4A0F73] flex items-center justify-center rounded-full text-xl font-bold">
                {form.name.charAt(0).toUpperCase() || "C"}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{form.name}</h3>
                <p className="text-sm text-gray-600">Admin</p>
              </div>
            </div>

            <hr />

            {/* VIEW MODE */}
            {!editMode && !passwordMode && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-500" />
                    {form.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    {form.phone || "Not provided"}
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                    {form.address.line1
                      ? `${form.address.line1}, ${form.address.city}, ${form.address.state} - ${form.address.pincode}`
                      : "No address added"}
                  </div>
                </div>

                <hr />

                <div className="space-y-2">
                  <Button
                    className="w-full bg-[#4A0F73] hover:bg-[#3b0764] text-white"
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-white text-gray-700 hover:bg-purple-100"
                    onClick={() => setPasswordMode(true)}
                  >
                    Change Password
                  </Button>
                </div>
              </>
            )}

            {/* EDIT PROFILE */}
            {editMode && (
              <div className="space-y-4">
                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      placeholder="Full Name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>

                  {/* Username */}
                  <div className="relative">
                    <User2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      placeholder="Username"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                    />
                  </div>

                  {/* Email */}
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  {/* Phone */}
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>

                  {/* Address Line */}
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      placeholder="Address Line"
                      value={form.address.line1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address: { ...form.address, line1: e.target.value },
                        })
                      }
                    />
                  </div>

                  {/* City / State / Pincode */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                        placeholder="City"
                        value={form.address.city}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            address: { ...form.address, city: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                        placeholder="State"
                        value={form.address.state}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            address: { ...form.address, state: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div className="relative">
                      <Pin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        className="
                 pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                        placeholder="Pincode"
                        value={form.address.pincode}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            address: {
                              ...form.address,
                              pincode: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="bg-[#4A0F73] hover:bg-[#0a2a50] text-white"
                      onClick={saveProfile}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* CHANGE PASSWORD */}
            {passwordMode && (
              <div className="space-y-4">
                <div className="space-y-4">
                  {/* Current Password */}
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 pr-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      type={showPasswords.current ? "text" : "password"}
                      placeholder="Current Password"
                      value={passwords.current}
                      onChange={(e) =>
                        setPasswords({ ...passwords, current: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          current: !showPasswords.current,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>

                  {/* New Password */}
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 pr-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      type={showPasswords.newPass ? "text" : "password"}
                      placeholder="New Password"
                      value={passwords.newPass}
                      onChange={(e) =>
                        setPasswords({ ...passwords, newPass: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          newPass: !showPasswords.newPass,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.newPass ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="
                 pl-10 pr-10 h-11
  border border-gray-300
  outline-none

  focus:border-fuchsia-500
  focus:ring-2
  focus:ring-fuchsia-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-fuchsia-500
  focus-visible:ring-offset-0"
                      type={showPasswords.confirm ? "text" : "password"}
                      placeholder="Confirm New Password"
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirm: !showPasswords.confirm,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="bg-[#4A0F73] hover:bg-[#0a2a50] text-white"
                      onClick={changePassword}
                    >
                      Update Password
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPasswordMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
