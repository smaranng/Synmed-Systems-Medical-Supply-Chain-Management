import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { MapPin, Navigation, Phone, Car, ExternalLink, Search, X, PersonStanding, Building2, Clock, Truck } from "lucide-react";
import { Input } from "../components/ui/Input";
import { locationService, DistributorLocation } from "../../../shared/services/locationService";
import { LocationModal } from "../../../shared/components/LocationModal";

export default function DistributorsNearYou() {
  const navigate = useNavigate();

  const [distributors, setDistributors] = useState<DistributorLocation[]>([]);
  const [filteredDistributors, setFilteredDistributors] = useState<DistributorLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<"all" | "near" | "medium" | "far">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => { fetchNearbyDistributors(); }, []);
  useEffect(() => { filterDistributors(); }, [distributors, distanceFilter, searchTerm]);

  const fetchNearbyDistributors = async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    setLoading(true);
    setError(null);
    try {
      
      const data = await locationService.getNearbyDistributors(50000, "pharmacy");
      setDistributors(data.distributors);
      setUserLocation(data.userLocation);
    } catch (err: any) {
      if (err.message === "LOCATION_REQUIRED") {
        setShowLocationModal(true);
        setError("Please set your location to find nearby distributors");
      } else {
        setError(err.message || "Failed to fetch nearby distributors");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDistributor = (distributorID: string) => {
    navigate(`/dashboard/distributor/${distributorID}/search`);
  };
  const filterDistributors = () => {
    let filtered = [...distributors];
    switch (distanceFilter) {
      case "near":   filtered = filtered.filter((d) => d.distance < 3); break;
      case "medium": filtered = filtered.filter((d) => d.distance >= 3 && d.distance < 10); break;
      case "far":    filtered = filtered.filter((d) => d.distance >= 10); break;
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((d) =>
        d.name.toLowerCase().includes(lower) ||
        (d.companyName && d.companyName.toLowerCase().includes(lower)) ||
        (d.address && d.address.toLowerCase().includes(lower))
      );
    }
    setFilteredDistributors(filtered);
  };

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      await locationService.updateLocation(latitude, longitude, address, "pharmacy");
      setShowLocationModal(false);
      hasFetchedRef.current = false;
      fetchNearbyDistributors();
    } catch (err: any) {
      alert(err.message || "Failed to update location");
    }
  };

  const getDistanceBadgeColor = (distance: number) => {
    if (distance < 3)  return "bg-green-100 text-green-800";
    if (distance < 10) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Distributors Near You</h1>
        <p className="text-gray-600">Find trusted distributors in your area</p>
      </div>

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="pharmacy"
      />

      {/* Filters and Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-sm text-gray-600">
                Found <span className="font-bold text-black">{filteredDistributors.length}</span> distributors
                {distanceFilter !== "all" && " in selected range"}
              </p>
              {userLocation && (
                <p className="text-xs text-gray-500 mt-1">📍 Showing results near your location</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "near", "medium", "far"] as const).map((f) => (
                <Button
                  key={f}
                  variant={distanceFilter === f ? "default" : "outline"}
                  onClick={() => setDistanceFilter(f)}
                  className={distanceFilter === f ? "bg-emerald-700 hover:bg-emerald-500 text-white" : ""}
                >
                  {f === "all" ? "All" : f === "near" ? "< 3 km" : f === "medium" ? "3–10 km" : "10+ km"}
                </Button>
              ))}
              <Button variant="outline" onClick={() => setShowLocationModal(true)}>
                <Navigation className="w-4 h-4 mr-2" /> Update Location
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search distributors by name, company, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="text-lg text-gray-600">Finding nearby distributors...</div>
        </div>
      )}

      {/* Error State */}
      {error && !showLocationModal && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-lg text-red-600 mb-4">{error}</p>
              <Button onClick={() => setShowLocationModal(true)}>Set Location</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distributor Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDistributors.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-lg text-gray-600">
                No distributors found in this range. Try adjusting the distance filter.
              </div>
            </div>
          ) : (
            filteredDistributors.map((distributor) => (
              <Card key={distributor.id} className="hover:shadow-lg transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {distributor.logo ? (
                          <img
                            src={`http://localhost:5203${distributor.logo}`}
                            alt={distributor.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-black">{distributor.name}</CardTitle>
                        {distributor.companyName && (
                          <p className="text-xs text-gray-500 mt-0.5">{distributor.companyName}</p>
                        )}
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getDistanceBadgeColor(distributor.distance)}`}>
                            {locationService.formatDistance(distributor.distance)} away
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Address */}
                  <div className="flex items-start text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                    <span>
                      {typeof distributor.address === 'string'
                        ? distributor.address
                        : [distributor.address?.line1
                          , distributor.address?.city, distributor.address?.state]
                            .filter(Boolean)
                            .join(', ')}
                    </span>
                  </div>

                  {/* Phone */}
                  {distributor.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                      <a
                        href={`tel:${distributor.phone}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {distributor.phone}
                      </a>
                    </div>
                  )}
                  
                  {/* Phone */}
                  {distributor.avgLeadTime && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Truck className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>Delivery: {distributor.avgLeadTime} business days </span>
                    </div>
                  )}

                
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-emerald-800 hover:bg-emerald-600 text-white font-medium"
                      onClick={() => handleSelectDistributor(distributor.id)}
                    >
                      View Distributor
                    </Button>
                    <Button
                      variant="outline"
                      className="px-3"
                      title="Get Directions in Google Maps"
                      onClick={() => {
                        if (userLocation) {
                          window.open(
                            locationService.getGoogleMapsDirectionsUrl(
                              userLocation.latitude,
                              userLocation.longitude,
                              distributor.location.latitude,
                              distributor.location.longitude
                            ),
                            "_blank"
                          );
                        }
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}