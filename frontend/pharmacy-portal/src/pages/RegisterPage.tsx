import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@shared/components/ui/Card';
import {
    UserPlus2, CheckCircle2, ArrowLeft, Mail,
    Lock,
    Phone,
    BadgeCheck,
    HomeIcon,
    MapPin, User
} from 'lucide-react';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        address: '',
        licenseNumber: '',
        latitude: '',
        longitude: '',
        logo: null as File | null,
    });
    const fields = [
        {
            label: 'Pharmacy Name',
            key: 'name',
            placeholder: 'Pharmacy Name',
        },
        {
            label: 'Email',
            key: 'email',
            placeholder: 'pharmacy@email.com',
        },
        {
            label: 'License Number',
            key: 'licenseNumber',
            placeholder: 'DL-XXXX-YYYY',
        },
        {
            label: 'Phone',
            key: 'phone',
            placeholder: '+91 98765 43210',
        },
        {
            label: 'Address',
            key: 'address',
            placeholder: 'Street, Area, City, State',
        },
        {
            label: 'Username',
            key: 'username',
            placeholder: 'pharmacy_username',
        },
        {
            label: 'Password',
            key: 'password',
            placeholder: '••••••••',
        },
        //{
        //     label: 'Latitude',
        //   key: 'latitude',
        // placeholder: '12.9716',
        //},
        //{
        //label: 'Longitude',
        //key: 'longitude',
        //placeholder: '77.5946',
        //},
    ];
    const fieldIcons: Record<string, any> = {
        name: User,
        email: Mail,
        licenseNumber: BadgeCheck,
        phone: Phone,
        address: HomeIcon,
        username: User,
        password: Lock,
        //latitude: MapPin,
        //longitude: MapPin,
    };

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
            !formData.licenseNumber
            //!formData.latitude ||
            //!formData.longitude
        ) {
            setError('Please fill all required fields');
            return;
        }

        setIsSubmitting(true);

        try {
            const formDataToSend = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (value) formDataToSend.append(key, value as any);
            });

            const res = await fetch(
                'http://localhost:5203/auth/pharmacy/register',
                {
                    method: 'POST',
                    body: formDataToSend,
                }
            );

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Registration failed');
            }

            setShowSuccess(true);
            setTimeout(() => navigate('/login'), 2000);

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
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600">
                    <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-20 h-20 text-emerald-600" />
                    </div>
                    <p className="text-white text-2xl font-semibold mt-6">
                        Registration Successful!
                    </p>
                    <p className="text-white text-sm opacity-80 mt-2">
                        Redirecting to Login...
                    </p>
                </div>
            )}

            {/* Register Page */}
            <div
                className={`min-h-screen flex justify-center
    bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#10B981]
    px-4 py-16
    ${showSuccess ? 'opacity-0' : 'opacity-100'} transition-opacity`}
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
                <Card
                    className="w-full max-w-md bg-white/95 backdrop-blur
          border border-emerald-200 shadow-2xl rounded-2xl"
                >
                    <CardHeader className="text-center space-y-3">
                        <div
                            className="mx-auto flex h-14 w-14 items-center justify-center
              rounded-full bg-emerald-100"
                        >
                            <UserPlus2 className="h-7 w-7 text-emerald-600" />
                        </div>

                        <CardTitle className="text-2xl font-semibold text-slate-800">
                            Create Pharmacy Account
                        </CardTitle>

                        <CardDescription className="text-slate-500">
                            Register your pharmacy to manage orders & inventory
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {error && (
                            <div
                                className="mb-4 p-3 bg-rose-50 border border-rose-300
                text-rose-700 rounded-lg text-sm"
                            >
                                {error}
                            </div>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4 mt-6 mb-8"
                        >

                            {fields.map(({ label, key, placeholder }) => {
                                const Icon = fieldIcons[key];

                                return (
                                    <div key={key}>

                                        <div className="relative group">
                                            {Icon && (
                                                <Icon
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
            text-slate-400 group-focus-within:text-emerald-600 transition"
                                                />
                                            )}

                                            <Input
                                                type={key === 'password' ? 'password' : 'text'}
                                                placeholder={placeholder}
                                                value={(formData as any)[key]}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, [key]: e.target.value })
                                                }
                                                required
                                                className="
                   pl-10 h-11
  border border-gray-300
  outline-none

  focus:border-emerald-500
  focus:ring-2
  focus:ring-emerald-500
  focus:ring-offset-0

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-emerald-500
  focus-visible:ring-offset-0
                  "

                                            />
                                        </div>
                                    </div>
                                );
                            })}



                            {/* Logo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Pharmacy Logo Upload
                                </label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            logo: e.target.files ? e.target.files[0] : null,
                                        })
                                    }
                                    className="
                    h-11 rounded-lg
                    border border-emerald-200"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-11 bg-emerald-600
                  hover:bg-emerald-700 text-white font-medium"
                            >
                                {isSubmitting ? 'Creating Account...' : 'Register Pharmacy'}
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-600">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="text-emerald-600 font-medium hover:underline"
                            >
                                Sign In
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
