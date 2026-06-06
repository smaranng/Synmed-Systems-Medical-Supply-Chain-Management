import { useState } from 'react';
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
import AdminFullScreenLoader from '../components/AdminFullScreenLoader';
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isTransitioning } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      // Call login (which handles showing the loader via isTransitioning)
      await login(username, password);
    } catch (error: any) {
      setLocalError(error.message || 'Login failed');
      setIsSubmitting(false);
    }
  };

  // ✅ Show the purple full-screen loader
  if (isTransitioning) {
    return <AdminFullScreenLoader />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br
      from-[#2A044A] via-[#4A0F73] to-[#7A1E96] px-4">

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

      <Card className="w-full max-w-md bg-white/95 backdrop-blur
        border border-fuchsia-200 shadow-2xl rounded-2xl">

        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-100">
            <User2 className="h-7 w-7 text-fuchsia-600" />
          </div>

          <CardTitle className="text-2xl font-semibold text-slate-800">
            Admin Portal
          </CardTitle>

          <CardDescription className="text-slate-500">
            Secure administrator access
          </CardDescription>
        </CardHeader>

        <CardContent>
          {localError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-300
              text-rose-700 rounded-lg text-sm">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2
                h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
                className="
                  w-full h-11 rounded-lg
                  border border-fuchsia-200
                  pl-10 pr-3 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-fuchsia-500
                  focus:border-fuchsia-500
                  disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="
                  w-full h-11 rounded-lg
                  border border-fuchsia-200
                  pl-10 pr-12 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-fuchsia-500
                  focus:border-fuchsia-500
                  disabled:opacity-60"
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

            {/* Login Button (single color) */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-fuchsia-600
                hover:bg-fuchsia-700 text-white font-medium"
            >
              {isSubmitting ? 'Logging in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Need an account?{' '}
            <Link
              to="/register"
              className="text-fuchsia-600 font-medium hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
