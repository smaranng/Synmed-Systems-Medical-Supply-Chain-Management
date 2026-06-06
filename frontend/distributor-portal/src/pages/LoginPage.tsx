import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, ArrowLeft, User, User2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import DistributorFullScreenLoader from "../components/DistributorFullScreenLoader";

export default function DistributorLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (error: any) {
      setLocalError(error.message || "Login failed");
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return <DistributorFullScreenLoader />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C2410C] to-[#f69c3c] px-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 backdrop-blur-md text-white shadow-lg hover:bg-white hover:text-black"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md border-0 bg-[#FFF7ED] shadow-2xl">
        <CardHeader className="text-center space-y-3">
          {/* Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <User2 className="h-7 w-7 text-orange-600" />
          </div>

          <CardTitle className="text-2xl font-semibold text-black">
            Distributor Portal
          </CardTitle>

          <CardDescription className="text-gray-500">
            Secure access to registered distributors
          </CardDescription>
        </CardHeader>

        <CardContent>
          {localError && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
                className="pl-10 h-11 border border-gray-300 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0"
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="pl-10 h-11 border border-gray-300 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#EA580C] hover:bg-[#C2410C] text-white font-medium"
            >
              {isSubmitting ? "Logging in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            New distributor?{" "}
            <Link
              to="/register"
              className="text-orange-500 font-medium hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}