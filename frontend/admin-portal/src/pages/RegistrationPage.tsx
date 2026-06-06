import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    UserPlus,
    User,
    Mail,
    Phone,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    ArrowLeft
} from 'lucide-react';

import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@shared/components/ui/Card';

import { authService } from '../services/authService';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        phone: '',
        password: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await authService.register({
                ...formData,
                role: 'admin',
            });

            setShowSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
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
                className={`min-h-screen flex items-center justify-center
        bg-gradient-to-br from-[#2A044A] via-[#4A0F73] to-[#7A1E96]
        px-4 ${showSuccess ? 'opacity-0' : 'opacity-100'} transition-opacity`}
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

                <Card className="w-full max-w-md bg-white/95 backdrop-blur
          border border-fuchsia-200 shadow-2xl rounded-2xl">

                    <CardHeader className="text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center
              rounded-full bg-fuchsia-100">
                            <UserPlus className="h-7 w-7 text-fuchsia-600" />
                        </div>

                        <CardTitle className="text-2xl font-semibold text-slate-800">
                            Admin Registration
                        </CardTitle>

                        <CardDescription className="text-slate-500">
                            Create a new administrator account
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {error && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-300
                text-rose-700 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* NAME */}
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2
                  h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Full name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
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
                                />
                            </div>

                            {/* EMAIL */}
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2
                  h-4 w-4 text-gray-400" />
                                <Input
                                    type="email"
                                    placeholder="admin@email.com"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    required
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
                                />
                            </div>

                            {/* USERNAME */}
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2
                  h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Admin username"
                                    value={formData.username}
                                    onChange={(e) =>
                                        setFormData({ ...formData, username: e.target.value })
                                    }
                                    required
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
                                />
                            </div>

                            {/* PHONE */}
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2
                  h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="+91 9876543210"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                    required
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
                                />
                            </div>

                            {/* PASSWORD */}
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                  h-4 w-4 text-gray-400" />
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    required
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

                            {/* SUBMIT */}
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-11 bg-fuchsia-600
                  hover:bg-fuchsia-700 text-white font-medium"
                            >
                                {isSubmitting ? 'Creating account…' : 'Register Admin'}
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-600">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="text-fuchsia-600 font-medium hover:underline"
                            >
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
