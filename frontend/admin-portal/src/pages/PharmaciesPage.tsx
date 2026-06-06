import { useEffect, useState } from 'react';
import { adminService, UserStats, Pharmacy, PharmacyStats } from '../services/adminService';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Download, Plus, Building2, CheckCircle, Truck, Package, Ban,Clock, DollarSign, Eye, Edit, Bell, AlertTriangle } from "lucide-react";

import { Badge } from '../components/ui/Badge';

const API_BASE_URL = 'http://localhost:5203';

const getImageUrl = (filePath: string | null | undefined): string | null => {
  if (!filePath) return null;
  // If filePath already includes http, return as is
  if (filePath.startsWith('http')) return filePath;
  // Otherwise prepend the API base URL
  return `${API_BASE_URL}${filePath}`;
};

const getStatusBadge = (status: string) => {
  const statusMap = {
    active: { variant: 'success' as const, label: 'Active' },
    inactive: { variant: 'inactive' as const, label: 'Inactive' },
    pending: { variant: 'pending' as const, label: 'Pending' },
    approved: { variant: 'approved' as const, label: 'Approved' },
    rejected: { variant: 'rejected' as const, label: 'Rejected' },
    suspended: { variant: 'warning' as const, label: 'Suspended' },
    online: { variant: 'online' as const, label: 'Online' },
    offline: { variant: 'offline' as const, label: 'Offline' },
    degraded: { variant: 'degraded' as const, label: 'Degraded' }
  };

  const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
};

export default function PharmaciesPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [pharmacyStats, setPharmacyStats] = useState<PharmacyStats | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [pharmacyDetails, setPharmacyDetails] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userStatsData, pharmacyStatsData, pharmaciesData] = await Promise.all([
          adminService.getUserStats(),
          adminService.getPharmacyStats(),
          adminService.getAllPharmacies(),
        ]);
        setStats(userStatsData);
        setPharmacyStats(pharmacyStatsData);
        setPharmacies(pharmaciesData);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewPharmacy = (pharmacy: Pharmacy) => {
    console.log('👁️ Viewing pharmacy:', pharmacy);
    console.log('📸 Logo:', pharmacy.logo);
    console.log('📜 License Certificate:', pharmacy.licenseCertificate);
    setSelectedPharmacy(pharmacy);
    setPharmacyDetails(pharmacy);
  };

  const handleCloseModal = () => {
    setSelectedPharmacy(null);
    setPharmacyDetails(null);
  };
     return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Pharmacy Overview</h1>
                <p className="text-gray-600">Look at the current status and statistics of all registered pharmacies</p>
              </div>
              <div className="flex gap-3">
              
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pharmacy
                </Button>
              </div>
            </div>

            {/* Pharmacy Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Pharmacies</p>
                      <p className="text-2xl font-bold text-black">
                        {loading || !stats ? "—" : stats.pharmacies.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-black">
                        {loading || !pharmacyStats ? "—" : pharmacyStats.totalOrders.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Truck className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-black">
                        {loading || !pharmacyStats ? "—" : `₹${(pharmacyStats.totalRevenue).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <div className="h-6 w-6 text-purple-600 text-2xl font-bold">₹</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Pharmacies</p>
                      <p className="text-2xl font-bold text-black">
                        {loading || !pharmacies ? "—" : pharmacies.length.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pharmacies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pharmacies.map((pharmacy) => (
                <Card key={pharmacy._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-black">{pharmacy.name}</CardTitle>
                        <CardDescription className="text-gray-600">{pharmacy.email}</CardDescription>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">License:</span>
                        <span className="font-medium text-black">{pharmacy.licenseNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-black">{pharmacy.phone}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium text-black text-right flex-1 ml-2 break-words">{pharmacy.address}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Registered:</span>
                        <span className="font-medium text-black">
                          {new Date(pharmacy.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm" onClick={() => handleViewPharmacy(pharmacy)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pharmacy Detail Modal */}
            {selectedPharmacy && pharmacyDetails && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                  <CardHeader className="flex flex-row items-start justify-between pb-4 border-b">
                    <div>
                      <CardTitle className="text-2xl text-black">{pharmacyDetails.name}</CardTitle>
                      <CardDescription className="text-gray-600">{pharmacyDetails.email}</CardDescription>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                      ✕
                    </button>
                  </CardHeader>

                  <CardContent className="space-y-6 pt-6">
                    {/* Logo Section */}
                    {pharmacyDetails.logo && (
                      <div className="flex justify-center">
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <img
                            src={getImageUrl(pharmacyDetails.logo) || ''}
                            alt={pharmacyDetails.name}
                            className="h-32 w-32 object-cover rounded"
                            onError={(e) => {
                              console.error('Logo loading error. Path:', pharmacyDetails.logo);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">License Number</p>
                        <p className="text-base font-semibold text-black">{pharmacyDetails.licenseNumber}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Phone</p>
                        <p className="text-base font-semibold text-black">{pharmacyDetails.phone}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm font-medium text-gray-600 mb-1">Location (Address)</p>
                        <p className="text-base font-semibold text-black break-words">{pharmacyDetails.address}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Registration Date</p>
                        <p className="text-base font-semibold text-black">
                          {new Date(pharmacyDetails.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Username</p>
                        <p className="text-base font-semibold text-black">{pharmacyDetails.username}</p>
                      </div>
                    </div>

                    {/* License Certificate Section */}
                    {pharmacyDetails.licenseCertificate ? (
                      <div className="border-t pt-6">
                        <p className="text-sm font-medium text-gray-600 mb-3">License Certificate</p>
                        {pharmacyDetails.licenseCertificate.toLowerCase().endsWith('.pdf') ? (
                          <div className="space-y-3">
                            <div className="border rounded-lg overflow-hidden bg-gray-50 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 bg-red-100 rounded flex items-center justify-center">
                                    <span className="text-red-600 font-bold text-sm">PDF</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-black">License Certificate</p>
                                    <p className="text-sm text-gray-500">PDF Document</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(getImageUrl(pharmacyDetails.licenseCertificate) || '', '_blank')}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = getImageUrl(pharmacyDetails.licenseCertificate) || '';
                                      link.download = `${pharmacyDetails.name}_license.pdf`;
                                      link.click();
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden bg-gray-50">
                              <iframe
                                src={getImageUrl(pharmacyDetails.licenseCertificate) || ''}
                                className="w-full h-96"
                                title="License Certificate"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="border rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={getImageUrl(pharmacyDetails.licenseCertificate) || ''}
                              alt="License Certificate"
                              className="w-full max-h-96 object-contain"
                              onError={(e) => {
                                console.error('Certificate loading error. Path:', pharmacyDetails.licenseCertificate);
                                e.currentTarget.parentElement!.innerHTML = 
                                  '<div class="text-center text-gray-500 py-8">Certificate not found or invalid path</div>';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t pt-6">
                        <p className="text-sm font-medium text-gray-600 mb-3">License Certificate</p>
                        <div className="border rounded-lg overflow-hidden bg-gray-50 p-4 text-center text-gray-400">
                          No certificate uploaded
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <div className="border-t p-4 flex justify-end">
                    <Button onClick={handleCloseModal}>Close</Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        );
    }
