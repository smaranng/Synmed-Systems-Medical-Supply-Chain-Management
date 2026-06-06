import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@shared/components/ui/Card';
import { authService } from '../services/authService';
import {
  UserPlus,
  CheckCircle2,
  User,
  Mail,
  Phone,
  Lock,
  ArrowLeft
} from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.email || !formData.username || !formData.password || !formData.phone) {
      setError('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.register({
        name: formData.name,
        email: formData.email,
        username: formData.username,
        phone: formData.phone,
        password: formData.password,
        role: 'customer',
      });

      setShowSuccess(true);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1dbf73] animate-fade-in">
          <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center animate-scale">
            <CheckCircle2 className="w-20 h-20 text-[#1dbf73]" />
          </div>

          <p className="text-white text-2xl font-semibold mt-6 animate-fade-up">
            Registered Successfully
          </p>
          <p className="text-white text-sm opacity-80 mt-2">
            Redirecting to Login...
          </p>
        </div>
      )}

      {/* Register UI */}
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1D37] via-[#123B6B] to-[#4BA3C3] px-4 ${showSuccess ? 'opacity-0' : 'opacity-100'
          } transition-opacity`}
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
        <Card className="w-full max-w-md bg-white/95 backdrop-blur border border-blue-100 shadow-2xl rounded-2xl">

          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
              <UserPlus className="h-7 w-7 text-blue-600" />
            </div>

            <CardTitle className="text-2xl font-semibold text-slate-800">
              Create Account
            </CardTitle>

            <CardDescription className="text-slate-500">
              Register to start ordering medicines
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full Name */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full h-11 rounded-lg border border-blue-200 pl-10 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full h-11 rounded-lg border border-blue-200 pl-10 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Username */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="w-full h-11 rounded-lg border border-blue-200 pl-10 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="w-full h-11 rounded-lg border border-blue-200 pl-10 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full h-11 rounded-lg border border-blue-200 pl-10 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-sky-500
                           hover:from-blue-700 hover:to-sky-600 text-white font-medium"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
