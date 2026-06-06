import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@shared/components/ui/Card";
import {
    User,
    Mail,
    Lock,
    Phone,
    BadgeCheck,
    HomeIcon,
    Eye,
    EyeOff,
    UserPlus,
    CheckCircle2,
    ArrowLeft
} from "lucide-react";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        username: "",
        password: "",
        phone: "",
        address: "",
        licenseNumber: "",
        companyName: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (
            !formData.name ||
            !formData.email ||
            !formData.username ||
            !formData.password ||
            !formData.phone ||
            !formData.address ||
            !formData.licenseNumber ||
            !formData.companyName
        ) {
            setError("Please fill all required fields");
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch("http://localhost:5203/auth/distributor/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    email: formData.email.toLowerCase(),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShowSuccess(true);
            setTimeout(() => navigate("/login"), 2000);
        } catch (err: any) {
            setError(err.message || "Registration failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Success Animation Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#3BB273] animate-fade-in z-50">
                    <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center animate-scale">
                        <CheckCircle2 className="w-20 h-20 text-[#3BB273]" />
                    </div>

                    <p className="text-white text-2xl font-semibold mt-6 animate-fade-up">
                        Registration Successful!
                    </p>

                    <p className="text-white text-sm opacity-80 mt-2">
                        Redirecting to Login...
                    </p>
                </div>
            )}

            {/* PAGE */}
            <div
                className={`min-h-screen flex items-center justify-center bg-gradient-to-br
from-[#C2410C] to-[#f69c3c] px-4 py-10
        ${showSuccess ? "opacity-0" : "opacity-100"} transition-opacity`}
            >
                {/* BACK BUTTON */}
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="absolute top-6 left-6 flex items-center gap-2
            rounded-xl border border-white/30 bg-white/10 backdrop-blur
            text-white shadow-lg hover:bg-white hover:text-black"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Card className="w-full max-w-md border-0 bg-white/95 backdrop-blur shadow-2xl">
                    <CardHeader className="text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                            <UserPlus className="h-7 w-7 text-orange-600" />
                        </div>

                        <CardTitle className="text-2xl font-semibold text-black">
                            Distributor Registration
                        </CardTitle>

                        <CardDescription className="text-gray-500">
                            Register to manage your distributor profile
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {error && (
                            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* NAME */}
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="Distributor Name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* EMAIL */}
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    type="email"
                                    placeholder="distributor@email.com"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* PHONE */}
                            <div className="relative group">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="Phone Number"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* LICENSE */}
                            <div className="relative group">
                                <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="License Number"
                                    value={formData.licenseNumber}
                                    onChange={(e) =>
                                        setFormData({ ...formData, licenseNumber: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* ADDRESS */}
                            <div className="relative group">
                                <HomeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="Address"
                                    value={formData.address}
                                    onChange={(e) =>
                                        setFormData({ ...formData, address: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* USERNAME */}
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="Username"
                                    value={formData.username}
                                    onChange={(e) =>
                                        setFormData({ ...formData, username: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* PASSWORD */}
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2
                  text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                            </div>

                            {/* COMPANY */}
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                  text-gray-400 group-focus-within:text-orange-500 transition" />
                                <Input
                                    placeholder="Company Name"
                                    value={formData.companyName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, companyName: e.target.value })
                                    }
                                    className="
  pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-orange-500
  focus:ring-2
  focus:ring-orange-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-orange-500
  focus-visible:ring-offset-0
"
                                    required
                                />
                            </div>

                            {/* SUBMIT */}
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C]"
                            >
                                {isSubmitting ? "Creating Account..." : "Register Distributor"}
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-600">
                            Already have an account?{" "}
                            <Link to="/login" className="text-orange-600 font-medium hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
