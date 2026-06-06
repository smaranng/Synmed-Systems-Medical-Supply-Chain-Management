import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User2,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/ui/Card';
import FullScreenLoader from "../components/FullScreenLoader";

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
const [showLoader, setShowLoader] = useState(false);

  const navigate = useNavigate();

  const { login, isAuthenticated } = useAuth();

/*  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);*/

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLocalError(null);
  setIsSubmitting(true);

  try {
    await login(username, password);

    // 1️⃣ show loader FIRST
    setShowLoader(true);

    // 2️⃣ let React paint one frame
    requestAnimationFrame(() => {
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 2000); // smooth UX (not required, but feels premium)
    });

  } catch (error: any) {
    setLocalError(error.message || "Invalid username or password");
    setIsSubmitting(false);
  }
};

if (showLoader) {
  return <FullScreenLoader />;
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1D37] via-[#123B6B] to-[#4BA3C3] px-4">

      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="
          absolute top-6 left-6
          flex items-center gap-2
          rounded-xl
          border border-white/30
          bg-white/10
          backdrop-blur-md
          text-white
          shadow-lg
          transition
          hover:bg-white
          hover:text-black"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur border border-blue-100 shadow-2xl rounded-2xl">

        {/* Logo */}
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <User2 className="h-7 w-7 text-blue-600" />
          </div>

          <CardTitle className="text-2xl font-semibold text-slate-800">
            Customer Portal
          </CardTitle>

          <CardDescription className="text-slate-500">
            Sign in to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          {localError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
                className="
                  w-full h-11 rounded-lg
                  border border-blue-200
                  pl-10 pr-3 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500
                  disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="
                  w-full h-11 rounded-lg
                  border border-blue-200
                  pl-10 pr-12 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500
                  disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {/* Login */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-sky-500
                         hover:from-blue-700 hover:to-sky-600 text-white font-medium"
            >
              {isSubmitting ? 'Logging in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don’t have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
