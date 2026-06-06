import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, Plus, AlertTriangle, Edit, Trash2, Download, CheckCircle, RefreshCw, X, FileText, BanIcon, Eye, Upload, Image as ImageIcon } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';
import { inventoryService, Medicine, InventoryStats } from '../services/inventoryService';
import { ChevronLeft, ChevronRight } from "lucide-react";
const API_URL = "http://localhost:5203";

// ✅ HELPER: Parse DD-MM-YYYY dates from backend
function parseDDMMYYYY(dateString: string | undefined | undefined): Date | undefined {
  if (!dateString) return undefined;

  // If already a Date object, return it
  if (dateString instanceof Date) return dateString;

  // If ISO format (YYYY-MM-DD or full ISO), parse normally
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // Parse DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const [dd, mm, yyyy] = dateString.split('-');
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    return isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}


// ✅ HELPER: Format date for display
function formatDateForDisplay(input?: string | Date): string {
  if (!input) return "—";

  const date =
    input instanceof Date ? input : parseDDMMYYYY(input);

  if (!date || isNaN(date.getTime())) return "—";

  // Detect if original input contains time
  const hasTime =
    input instanceof Date
      ? input.getHours() !== 0 ||
        input.getMinutes() !== 0 ||
        input.getSeconds() !== 0
      : typeof input === "string" &&
        (input.includes("T") || input.includes(":"));

  if (hasTime) {
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleDateString("en-GB");
}

export default function InventoryPage() {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<'all' | 'lowStock' | 'expiring' | 'expired'>('all');
  const itemsPerPage = 5;
  const [gstRegistered, setGstRegistered] = useState(false);
  
  // State for backend data
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [stats, setStats] = useState<InventoryStats | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);
  const [showViewModal, setShowViewModal] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  // ✅ NEW: Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const dosageForms = [
  { label: 'Tablet',         hasSubUnit: true  },
  { label: 'Capsule',        hasSubUnit: true  },
  { label: 'Syrup',          hasSubUnit: false },
  { label: 'Injection',      hasSubUnit: false },
  { label: 'Cream/Ointment', hasSubUnit: false },
  { label: 'Drops',          hasSubUnit: false },
  { label: 'Sachet',         hasSubUnit: true  },
  { label: 'Gloves',         hasSubUnit: true  },
  { label: 'Mask',           hasSubUnit: true  },
  { label: 'Other',          hasSubUnit: false },
];

const fetchgstDetails = async (pharmaID: string) => {
    try {
      const res = await fetch(`${API_URL}/pharmacy/${pharmaID}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.gstRegistered && data.gstIN) {
        setGstRegistered(true);
      }
    } catch (err) {
      console.error("Failed to fetch pharmacy timings:", err);
    }
  };
 


  // ✅ FIXED: Form state with undefined defaults for price fields
  const [formData, setFormData] = useState<any>({
    productImageURL: '',
    productID: '',
    medicineName: '',
    composition: '',
    batchCode: '',
    category: {
      primaryCategory: 'Prescription Medicines',
      therapeuticClass: '',
      dosageForm: ''
    },
    description: '',
    prescriptionRequired: false,
    manufacturer: '',
    packaging: {
      quantityDescription: '',
      mrp: undefined,
      discountPercent: undefined,
      price: undefined,
      pricePerUnit: undefined,
     
    },
    gstRate: undefined,
    hsnCode: '',
    stock: {
      unitsAvailable: undefined,
      threshold: undefined,
      allowSubQuantity: false,
      baseQuantity: '',
      totalSubUnits: undefined
    },
    storageCondition: '',
    manufacturedDate: '',
    expiryDate: '',
    lastUpdated: ''
  });

  const nonDrugCategories = [
  'FMCG',
  'Medical Devices',
  'Personal Care & Wellness'
];

const isDrugCategory = !nonDrugCategories.includes(
  formData.category?.primaryCategory
);
  const categories = [
    'ALL',
    'Prescription Medicines',
    'OTC Medicines',
    'Chronic Care Medicines',
    'Acute Care Medicines',
    'Supplements & Nutrition',
    'Topical Medicines',
    'Injectables & Vaccines',
    'Medical Devices',
    'Surgical & Consumables',
    'Personal Care & Wellness',
    'FMCG'
  ];

  useEffect(() => {
    console.log('👤 User:', user);
    if (user?.id) {
      fetchData();
      fetchgstDetails(user.id); 
    }
  }, [user]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(undefined), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    console.log('🔄 Fetching data for:', user.id);
    setLoading(true);
    try {
      const [inventoryData, statsData] = await Promise.all([
        inventoryService.getInventory(user.id),
        inventoryService.getStats(user.id)
      ]);
      
      console.log('✅ Inventory:', inventoryData);
      console.log('✅ Stats:', statsData);
      
      setInventory(inventoryData);
      setStats(statsData);
    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      alert(error.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextProductID = async () => {
    if (!user?.id) return;
    
    try {
      const nextID = await inventoryService.getNextProductID(user.id);
      setFormData((prev: any) => ({ ...prev, productID: nextID }));
    } catch (error) {
      console.error('Failed to fetch next product ID:', error);
      // Fallback to timestamp-based ID if fetch fails
      setFormData((prev: any) => ({ 
        ...prev, 
        productID: `PRD-${user.id}-${Date.now()}` 
      }));
    }
  };

const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size should be less than 5MB');
    return;
  }

  setImageFile(file);

  const reader = new FileReader();
  reader.onloadend = () => setImagePreview(reader.result as string);
  reader.readAsDataURL(file);
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const file = e.dataTransfer.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please drop an image file');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size should be less than 5MB');
    return;
  }

  setImageFile(file);

  const reader = new FileReader();
  reader.onloadend = () => setImagePreview(reader.result as string);
  reader.readAsDataURL(file);

};

const clearImage = async () => {
  // Only hit the delete API if an image is actually saved on the server
  if (formData.productImageURL && user?.id && formData.productID) {
    try {
      await inventoryService.deleteProductImage(user.id, formData.productID);
    } catch (error) {
      console.error('Failed to delete image from server:', error);
      // Don't block UI — clear local state regardless
    }
  }

  setImageFile(null);
  setImagePreview('');
  setFormData((prev: any) => ({ ...prev, productImageURL: '' }));
};

// ─── Fix getImageUrl (wrong port) ──────────────────────────
const getImageUrl = (imageUrl: string) => {
  if (!imageUrl) return 'http://localhost:5201/uploads/productImages/default-medicine.jpg'; // default placeholder
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/uploads/')) return `http://localhost:5201${imageUrl}`;
  return imageUrl;
};


  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const productID = formData.productID; // Already fetched from backend
      
      const dataToSend = {
        productImageURL: formData.productImageURL || undefined,
        productID,
        pharmaID: user.id,
        medicineName: formData.medicineName,
        composition: formData.composition,
        batchCode: formData.batchCode || undefined,
        category: {
          primaryCategory: formData.category.primaryCategory,
          therapeuticClass: formData.category.therapeuticClass || undefined,
          dosageForm: formData.category.dosageForm || undefined
        },
        description: formData.description || undefined,
        prescriptionRequired: formData.primaryCategory !== 'FMCG' && formData.primaryCategory !== 'Medical Devices' && formData.primaryCategory !== 'Personal Care & Wellness' ? formData.prescriptionRequired : undefined,
        manufacturer: formData.manufacturer || undefined,
        packaging: {
          quantityDescription: formData.packaging.quantityDescription || undefined,
          mrp: formData.packaging.mrp ? Number(formData.packaging.mrp) : undefined,
          discountPercent: formData.packaging.discountPercent ? Number(formData.packaging.discountPercent) : undefined,
          price: formData.packaging.price ? Number(formData.packaging.price) : undefined,
          ...(dosageForms.find(d => d.label === formData.category.dosageForm)?.hasSubUnit && formData.packaging.pricePerUnit
        ? { pricePerUnit: Number(formData.packaging.pricePerUnit) }
        : {}),
        
        },
        ...(gstRegistered && {
            gstRate: formData.packaging?.gstRate ? Number(formData.packaging.gstRate) : undefined,
            hsnCode: formData.packaging?.hsnCode || undefined,
          }),
        
        stock: {
          unitsAvailable: formData.stock.unitsAvailable ? Number(formData.stock.unitsAvailable) : undefined,
          threshold: formData.stock.threshold ? Number(formData.stock.threshold) : undefined,
         ...(formData.stock.allowSubQuantity && formData.stock.baseQuantity
            ? {
                allowSubQuantity: true,
                baseQuantity: String(formData.stock.baseQuantity),
                totalSubUnits:
                  formData.stock.unitsAvailable
                    ? Number(formData.stock.unitsAvailable) * Number(formData.stock.baseQuantity)
                    : undefined,
              }
            : {}),
        },
        storageCondition: formData.storageCondition,
        manufacturedDate: formData.manufacturedDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        lastUpdated: formData.lastUpdated || undefined
      };

      const saved= await inventoryService.addMedicine(user.id, productID, dataToSend);
       if (imageFile) {
      try {
        const imageURL = await inventoryService.uploadProductImage(
          user.id,
          saved.productID,
          imageFile
        );
        // Step 3: Patch the record with the image URL
        await inventoryService.updateMedicine(user.id, saved.productID, {
          productImageURL: imageURL,
        });
      } catch (imgErr) {
        console.warn('Product saved but image upload failed:', imgErr);
      }
    }
      setShowAddModal(false);
      resetForm();
      fetchData();
      setSuccessMessage('Medicine added successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to add medicine');
    }
  };

  const handleUpdateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    const productID = editingMedicine?.productID || editingMedicine?.id;
    if (!productID) return;
    if (!user?.id) return;

    try {
      const dataToSend = {
        productImageURL: formData.productImageURL || undefined,
        medicineName: formData.medicineName,
        composition: formData.composition,
        batchCode: formData.batchCode || undefined,
        category: formData.category,
        description: formData.description || undefined,
       prescriptionRequired: formData.primaryCategory !== 'FMCG' && formData.primaryCategory !== 'Medical Devices' && formData.primaryCategory !== 'Personal Care & Wellness' ? formData.prescriptionRequired : undefined,
        manufacturer: formData.manufacturer || undefined,
        packaging: {
          quantityDescription: formData.packaging.quantityDescription || undefined,
          mrp: formData.packaging.mrp ? Number(formData.packaging.mrp) : undefined,
          discountPercent: formData.packaging.discountPercent ? Number(formData.packaging.discountPercent) : undefined,
          price: formData.packaging.price ? Number(formData.packaging.price) : undefined,
         ...(dosageForms.find(d => d.label === formData.category.dosageForm)?.hasSubUnit && formData.packaging.pricePerUnit
      ? { pricePerUnit: Number(formData.packaging.pricePerUnit) }
      : {}),
      
        },
        ...(gstRegistered && {
            gstRate: formData.packaging.gstRate ? Number(formData.packaging.gstRate) : undefined,
            hsnCode: formData.packaging.hsnCode || undefined,
          }),
         
        stock: {
          unitsAvailable: formData.stock.unitsAvailable ? Number(formData.stock.unitsAvailable) : undefined,
          threshold: formData.stock.threshold ? Number(formData.stock.threshold) : undefined,
          ...(formData.stock.allowSubQuantity && formData.stock.baseQuantity
            ? {
                allowSubQuantity: true,
                baseQuantity: String(formData.stock.baseQuantity),
                totalSubUnits:
                  formData.stock.unitsAvailable
                    ? Number(formData.stock.unitsAvailable) * Number(formData.stock.baseQuantity)
                    : undefined,
              }
            : {}),
        },
        storageCondition: formData.storageCondition,
        manufacturedDate: formData.manufacturedDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        lastUpdated: formData.lastUpdated || undefined
      };

      await inventoryService.updateMedicine(user.id, productID, dataToSend);
      if (imageFile) {
            try {
              const imageURL = await inventoryService.uploadProductImage(
                user.id,
                productID,
                imageFile
              );
              await inventoryService.updateMedicine(user.id, productID, {
                productImageURL: imageURL,
              });
            } catch (imgErr) {
              console.warn('Medicine updated but image upload failed:', imgErr);
            }
          }

      setEditingMedicine(undefined);
      resetForm();
      fetchData();
      setSuccessMessage('Medicine updated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to update medicine');
    }
  };

  const handleDelete = async (medicineId: string) => {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    if (!user?.id) return;
    try {
      await inventoryService.deleteMedicine(medicineId, user.id);
      fetchData();
      setSuccessMessage('Medicine deleted successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to delete medicine');
    }
  };

  const mapMedicineToForm = (medicine: any) => {
    let manufDateForInput = '';
    let expiryDateForInput = '';
    
    if (medicine.manufacturedDate) {
      const parsed = parseDDMMYYYY(medicine.manufacturedDate);
      if (parsed) manufDateForInput = parsed.toISOString().split('T')[0];
    }

    if (medicine.expiryDate) {
      const parsed = parseDDMMYYYY(medicine.expiryDate);
      if (parsed) expiryDateForInput = parsed.toISOString().split('T')[0];
    }

    return {
      productImageURL: medicine.productImageURL || '',
      productID: medicine.productID || medicine.id || '',
      medicineName: medicine.medicineName || '',
      composition: medicine.composition || '',
      category: {
        primaryCategory: medicine.category?.primaryCategory || 'Prescription Medicines',
        therapeuticClass: medicine.category?.therapeuticClass || '',
        dosageForm: medicine.category?.dosageForm || ''
      },
      description: medicine.description || '',
      prescriptionRequired: formData.primaryCategory !== 'FMCG' && formData.primaryCategory !== 'Medical Devices' && formData.primaryCategory !== 'Personal Care & Wellness' ? formData.prescriptionRequired : undefined,
      manufacturer: medicine.manufacturer || '',
      packaging: {
        quantityDescription: medicine.packaging?.quantityDescription || '',
        discountPercent: medicine.packaging?.discountPercent || undefined,
        mrp: medicine.packaging?.mrp || undefined,
        price: medicine.packaging?.price || undefined,
        ...(dosageForms.find(d => d.label === medicine.category.dosageForm)?.hasSubUnit && medicine.packaging?.pricePerUnit
    ? { pricePerUnit: Number(medicine.packaging.pricePerUnit) }
    : {}),
    
      },
      ...(gstRegistered && {
        gstRate: medicine.packaging?.gstRate ? Number(medicine.packaging.gstRate) : undefined,
        hsnCode: medicine.packaging?.hsnCode || undefined,
      }),
      stock: {
  unitsAvailable: medicine.stock?.unitsAvailable || undefined,
  threshold: medicine.stock?.threshold || undefined,
  ...(medicine.stock?.allowSubQuantity && medicine.stock?.baseQuantity
    ? {
        allowSubQuantity: true,
        baseQuantity: medicine.stock.baseQuantity,
        totalSubUnits: medicine.stock.totalSubUnits || undefined,
      }
    : {}),
},
      storageCondition: medicine.storageCondition || '',
      batchCode: medicine.batchCode || '',
      manufacturedDate: manufDateForInput,
      expiryDate: expiryDateForInput,
      lastUpdated: medicine.lastUpdated || ''
    };
  };

  // ✅ UPDATED: openViewModal with image preview
  const openViewModal = (medicine: any) => {
    const mappedData = mapMedicineToForm(medicine);
    setFormData(mappedData);
    
    // Set image preview if exists
    if (mappedData.productImageURL) {
      setImagePreview(mappedData.productImageURL);
    } else {
      setImagePreview('');
    }
    setShowViewModal(true);
  };

  const openEditModal = (medicine: any) => {
    setEditingMedicine(medicine);
    
    // Set image preview if exists
    if (medicine.productImageURL) {
      setImagePreview(medicine.productImageURL);
    }
    
    // ✅ Parse dates when opening edit modal
    let manufDateForInput = '';
    let expiryDateForInput = '';
    
    if (medicine.manufacturedDate) {
      const parsed = parseDDMMYYYY(medicine.manufacturedDate);
      if (parsed) {
        manufDateForInput = parsed.toISOString().split('T')[0];
      }
    }
    
    if (medicine.expiryDate) {
      const parsed = parseDDMMYYYY(medicine.expiryDate);
      if (parsed) {
        expiryDateForInput = parsed.toISOString().split('T')[0];
      }
    }
    
    setFormData({
      productImageURL: medicine.productImageURL || '',
      productID: medicine.productID || '',
      medicineName: medicine.medicineName || '',
      composition: medicine.composition || '',
      category: {
        primaryCategory: medicine.category?.primaryCategory || 'Prescription Medicines',
        therapeuticClass: medicine.category?.therapeuticClass || '',
        dosageForm: medicine.category?.dosageForm || ''
      },
      description: medicine.description || '',
      prescriptionRequired: medicine.prescriptionRequired || false,
      manufacturer: medicine.manufacturer || '',
      packaging: {
        quantityDescription: medicine.packaging?.quantityDescription || '',
        mrp: medicine.packaging?.mrp || undefined,
        discountPercent: medicine.packaging?.discountPercent || undefined,
        price: medicine.packaging?.price || undefined,
        pricePerUnit: medicine.packaging?.pricePerUnit || undefined,
        gstRate: medicine.packaging?.gstRate || undefined,
        hsnCode: medicine.packaging?.hsnCode || '',
      },
        gstRate: medicine.packaging?.gstRate || undefined,
        hsnCode: medicine.packaging?.hsnCode || '',
      stock: {
        unitsAvailable: medicine.stock?.unitsAvailable || undefined,
        threshold: medicine.stock?.threshold || undefined,
        ...(medicine.stock?.allowSubQuantity && medicine.stock?.baseQuantity
    ? {
        allowSubQuantity: true,
        baseQuantity: medicine.stock.baseQuantity,
        totalSubUnits: medicine.stock.totalSubUnits || undefined,
      }
    : {}),
      },
      storageCondition: medicine.storageCondition || '',
      batchCode: medicine.batchCode || '',
      manufacturedDate: manufDateForInput,
      expiryDate: expiryDateForInput
    });
  };

  const resetForm = () => {
  setFormData({
    productImageURL: '',
    productID: '',
    medicineName: '',
    composition: '',
    batchCode: '',
    category: {
      primaryCategory: 'Prescription Medicines',
      therapeuticClass: '',
      dosageForm: ''
    },
    description: '',
    prescriptionRequired: false,
    manufacturer: '',
    packaging: {
      quantityDescription: '',
      mrp: undefined,
      discountPercent: undefined,
      price: undefined,
      pricePerUnit: undefined,
      gstRate: undefined,  
      hsnCode: '',        
    },
    stock: {
      unitsAvailable: undefined,
      threshold: undefined,
      allowSubQuantity: false,    
      baseQuantity: '',            
      totalSubUnits: undefined 
    },
    storageCondition: '',
    manufacturedDate: '',
    expiryDate: '',
    lastUpdated: ''  
  });
  
  // Clear image state
  setImageFile(null);
  setImagePreview('');
};

  const getAvailableStockValue = (item: any) => item.availableStock ?? item.stock?.unitsAvailable ?? 0;
  const getReservedStockValue = (item: any) => item.reservedStock ?? 0;

  const allFilteredInventory = inventory.filter(item => {
    const name = (item as any).medicineName || '';
    const composition = (item as any).composition || '';
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      composition.toLowerCase().includes(searchTerm.toLowerCase());

    const itemCategory = (item as any).category?.primaryCategory || '';
    const matchesCategory = filterCategory === 'ALL' || itemCategory === filterCategory;

    const availableStock = getAvailableStockValue(item);

    let matchesStatsFilter = true;

    // LOW STOCK FILTER
    if (activeFilter === 'lowStock') {
      const threshold = (item as any).stock?.threshold || 0;
      matchesStatsFilter = availableStock <= threshold;
    }

    // EXPIRING SOON FILTER (0–90 DAYS ONLY)
    else if (activeFilter === 'expiring') {
      const expiryDate = parseDDMMYYYY((item as any).expiryDate);

      if (!expiryDate) {
        matchesStatsFilter = false;
      } else {
        const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        matchesStatsFilter = daysLeft >= 0 && daysLeft <= 90;
      }
    }

    // EXPIRED FILTER
    else if (activeFilter === 'expired') {
      const expiryDate = parseDDMMYYYY((item as any).expiryDate);

      if (!expiryDate) {
        matchesStatsFilter = false;
      } else {
        const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        matchesStatsFilter = daysLeft < 0; // ✅ expired only
      }
    }

    return matchesSearch && matchesCategory && matchesStatsFilter;
  })

  // ✅ HIDE EXPIRED WHEN SORT = EXPIRY
  .filter(item => {
    if (sortBy !== 'expiry') return true;

    const expiryDate = parseDDMMYYYY((item as any).expiryDate);
    if (!expiryDate) return false;

    return expiryDate >= new Date(); // ❌ remove expired
  })

  // ✅ SORT LOGIC
  .sort((a, b) => {
    let aValue: any, bValue: any;

    if (sortBy === 'name') {
      aValue = ((a as any).medicineName || '').toLowerCase();
      bValue = ((b as any).medicineName || '').toLowerCase();
    } 
    else if (sortBy === 'stock') {
      aValue = getAvailableStockValue(a);
      bValue = getAvailableStockValue(b);
    } 
    else if (sortBy === 'price') {
      aValue = (a as any).price || (a as any).packaging?.price || 0;
      bValue = (b as any).price || (b as any).packaging?.price || 0;
    } 
    else if (sortBy === 'expiry') {
      const aDate = parseDDMMYYYY((a as any).expiryDate);
      const bDate = parseDDMMYYYY((b as any).expiryDate);

      const aDays = aDate
        ? Math.ceil((aDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : Infinity;

      const bDays = bDate
        ? Math.ceil((bDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : Infinity;

      // Soonest first
      if (sortOrder === 'asc') return aDays - bDays;

      // Latest first
      return bDays - aDays;
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const totalPages = Math.ceil(allFilteredInventory.length / itemsPerPage);
  const filteredInventory = allFilteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStockStatus = (item: any) => {
    const availableStock = getAvailableStockValue(item);
    const threshold = item.stock?.threshold || 0;

    if (availableStock === 0) {
      return { status: 'Out of Stock', variant: 'secondary' as const };
    }

    if (availableStock <= threshold) {
      return { status: 'Low Stock', variant: 'warning' as const };
    }

    return { status: 'In Stock', variant: 'success' as const };
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Prescription Medicines': 'bg-blue-100 text-blue-800',
      'OTC Medicines': 'bg-green-100 text-green-800',
      'Chronic Care Medicines': 'bg-yellow-100 text-yellow-800',
      'Acute Care Medicines': 'bg-red-100 text-red-800',
      'Supplements & Nutrition': 'bg-slate-100 text-slate-800',
      'Topical Medicines': 'bg-pink-100 text-pink-800',
      'Injectables & Vaccines': 'bg-purple-100 text-purple-800',
      'Medical Devices': 'bg-emerald-100 text-emerald-800',
      'Surgical & Consumables': 'bg-teal-100 text-teal-800',
      'Personal Care & Wellness': 'bg-orange-100 text-orange-800',
      'FMCG': 'bg-amber-100 text-amber-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };
  const exportToCSV = () => {
    if (!user?.id || inventory.length === 0) return;
    
    const headers = [
      'Product ID',
      'Medicine Name',
      'Composition',
      'Category',
      'Manufacturer',
      'Batch Code',
      'Physical Stock',
      'Reserved Stock',
      'Available Stock',
      'Threshold',
      'Price',
      'MRP',
      'Manufactured Date',
      'Expiry Date',
      'Status'
    ];
    
    const rows = inventory.map((item: any) => {
      const expiryDate = parseDDMMYYYY(item.expiryDate);
      const manufDate = parseDDMMYYYY(item.manufacturedDate);
      const availableStock = getAvailableStockValue(item);
      const reservedStock = getReservedStockValue(item);
      const physicalStock = item.stock?.unitsAvailable || 0;
      const threshold = item.stock?.threshold || 0;
      const isLowStock = availableStock <= threshold;
      const isExpired = expiryDate && expiryDate < new Date();
      
      let status = 'In Stock';
      if (isExpired) status = 'Expired';
      else if (isLowStock) status = 'Low Stock';
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedExpiryDate = expiryDate 
        ? `${String(expiryDate.getDate()).padStart(2, '0')}-${monthNames[expiryDate.getMonth()]}-${expiryDate.getFullYear()}`
        : 'N/A';
      const formattedManufDate = manufDate 
        ? `${String(manufDate.getDate()).padStart(2, '0')}-${monthNames[manufDate.getMonth()]}-${manufDate.getFullYear()}`
        : 'N/A';
      
      const price = item.price || item.packaging?.price || 0;
      const mrp = item.mrp || item.packaging?.mrp || 0;
      
      return [
        item.productID || item.id || '-',
        item.medicineName || '',
        item.composition || '-',
        item.category?.primaryCategory || '',
        item.manufacturer || '-',
        item.batchCode || '-',
        physicalStock,
        reservedStock,
        availableStock,
        threshold,
        price.toFixed(2),
        mrp.toFixed(2),
        formattedManufDate,
        formattedExpiryDate,
        status
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmacy_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    if (!user?.id || inventory.length === 0) return;

    const headers = ['Product ID', 'Medicine Name', 'Composition', 'Category', 'Physical Stock', 'Reserved', 'Available', 'Price', 'Manufactured', 'Expiry', 'Status'];

    let pdfContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; margin-bottom: 5px; }
    .pharmacy-info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      border-left: 4px solid #0066cc;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    thead {
      background: #0066cc;
      color: white;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .status-low { color: #d97706; font-weight: bold; }
    .status-expired { color: #dc2626; font-weight: bold; }
    .status-instock { color: #059669; font-weight: bold; }
    .timestamp {
      text-align: right;
      font-size: 12px;
      color: #666;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h1>Pharmacy Inventory Report</h1>

  <div class="pharmacy-info">
    <h2 style="margin-top: 0;">${user.name || 'Pharmacy'}</h2>
    <p><strong>Address:</strong> ${user.address || 'N/A'}</p>
    <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
    <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
`;

    inventory.forEach((item: any) => {
      const expiryDate = parseDDMMYYYY(item.expiryDate);
      const manufDate = parseDDMMYYYY(item.manufacturedDate);
      const availableStock = getAvailableStockValue(item);
      const reservedStock = getReservedStockValue(item);
      const physicalStock = item.stock?.unitsAvailable || 0;
      const threshold = item.stock?.threshold || 0;
      const isLowStock = availableStock <= threshold;
      const isExpired = expiryDate && expiryDate < new Date();
      
      let status = 'In Stock';
      let statusClass = 'status-instock';

      if (isExpired) {
        status = 'Expired';
        statusClass = 'status-expired';
      } else if (isLowStock) {
        status = 'Low Stock';
        statusClass = 'status-low';
      }

      const price = item.price || item.packaging?.price || 0;

      const rowCells = [
        item.productID || item.id || '-',
        `<strong>${item.medicineName || ''}</strong>`,
        item.composition || '-',
        item.category?.primaryCategory || '',
        physicalStock,
        reservedStock,
        availableStock,
        price.toFixed(2),
        manufDate ? manufDate.toLocaleDateString() : 'N/A',
        expiryDate ? expiryDate.toLocaleDateString() : 'N/A',
        `<span class="${statusClass}">${status}</span>`
      ];

      pdfContent += `
      <tr>
        ${rowCells.map(cell => `<td>${cell}</td>`).join('')}
      </tr>
`;
    });

    pdfContent += `
    </tbody>
  </table>

  <div class="timestamp">
    <p>Generated on: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`;

    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
          window.URL.revokeObjectURL(url);
        }, 100);
      });
    }

    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading inventory...</div>
      </div>
    );
  }

  const Info = ({ label, value }: { label: string; value: any }) => (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="w-full bg-green-500 text-white rounded-lg px-6 py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 font-semibold text-base">
            <CheckCircle className="w-5 h-5 text-white" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(undefined)}
            className="text-white/80 hover:text-white transition"
            aria-label="Dismiss success message"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card 
          className={`border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'all' ? 'ring-2 ring-blue-500 shadow-md' : ''
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Medicines</p>
                <p className="text-3xl font-bold text-black">{stats?.totalItems || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Active inventory</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-lg font-bold">M</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`border-l-4 border-l-yellow-400 cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'lowStock' ? 'ring-2 ring-yellow-400 shadow-md' : ''
          }`}
          onClick={() => setActiveFilter('lowStock')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Low Stock</p>
                <p className="text-3xl font-bold text-black">{stats?.lowStock || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Need reorder • Click to filter</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`border-l-4 border-l-orange-500 cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'expiring' ? 'ring-2 ring-orange-500 shadow-md' : ''
          }`}
          onClick={() => setActiveFilter('expiring')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Expiring Soon</p>
                <p className="text-3xl font-bold text-black">{stats?.expiringSoon || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Within 90 days • Click to filter</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`border-l-4 border-l-red-500 cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'expired' ? 'ring-2 ring-red-500 shadow-md' : ''
          }`}
          onClick={() => setActiveFilter('expired')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Expired</p>
                <p className="text-3xl font-bold text-black">{stats?.expired || 0}</p>
                <p className="text-xs text-gray-500 mt-1">0 days • Click to filter</p>
              </div>
              <BanIcon className="h-12 w-12 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Value</p>
                <p className="text-3xl font-bold text-black">₹{stats?.totalValue?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-gray-500 mt-1">Inventory worth</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-lg font-bold">₹</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search medicines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2.5 border border-input rounded-md bg-background text-sm font-medium h-11 min-w-[200px]"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
                ))}
              </select>
              
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-4 py-2.5 border border-input rounded-md bg-background text-sm font-medium h-11 min-w-[140px]"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="stock-asc">Stock-Low</option>
                <option value="stock-desc">Stock-High</option>
                <option value="price-asc">Price-Low</option>
                <option value="price-desc">Price-High</option>
                <option value="expiry-asc">Expiry-Soon</option>
                <option value="expiry-desc">Expiry-Later</option>
              </select>
            </div>
            
            <div className="flex gap-3">
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-11 px-4"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={exportToCSV}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 border-b"
                    >
                      <FileText className="w-4 h-4" />
                      Export as CSV
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
              
              <Button variant="outline" size="sm" className="h-11 px-4" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                setShowAddModal(true); 
                fetchNextProductID(); 
              }}> 
                <Plus className="w-4 h-4 mr-2" /> 
                Add Medicine 
              </Button> 
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Inventory Table */}
      <Card className="shadow-sm">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="font-bold">
              Medicine Inventory ({allFilteredInventory.length} items) - Page {currentPage} of {totalPages || 1}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b-2 border-muted bg-muted/30">
                <th className="text-left py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[20%]">Medicine Details</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[12%]">Category</th>
                <th className=" pr-10 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[18%]">Stock</th>
                <th className="pr-7 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[13%]">Price</th>
                <th className=" pr-6 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[12%]">Expiry/Warranty</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[10%]">Status</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[14%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item: any, index) => {
                const stockStatus = getStockStatus(item);
                const availableStock = getAvailableStockValue(item);
                const reservedStock = getReservedStockValue(item);
                const physicalStock = item.stock?.unitsAvailable || 0;
                const threshold = item.stock?.threshold || 0;
                const isLowStock = availableStock <= threshold;
                
                const expiryDate = parseDDMMYYYY(item.expiryDate);

                const daysLeft = expiryDate
                  ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : undefined;

                const isExpired = daysLeft !== undefined && daysLeft < 0;
                const isExpiringSoon = daysLeft !== undefined && daysLeft <= 90 && daysLeft >= 0;

                let expirySubText = "N/A";
                let expirySubColor = "text-green-600";

                if (isExpired) {
                  expirySubText = "Expired";
                  expirySubColor = "text-red-600";
                } 
                else if (isExpiringSoon) {
                  expirySubText = `${daysLeft} days left • Expiring Soon`;
                  expirySubColor = "text-orange-600";
                } 
                else if (daysLeft !== undefined) {
                  expirySubText = `${daysLeft} days left`;
                  expirySubColor = "text-green-600";
                }

                const medicineId = item.productID || item.id || item._id || '';
                const price = item.packaging?.price || 0;
                const mrp = item.packaging?.mrp || 0;
                
                return (
                  <tr key={medicineId} className={`border-b border-muted/50 hover:bg-muted/20 transition-all duration-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                    <td className="py-5 px-6 w-[20%]">
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground text-base">{item.medicineName}</div>
                        <div className="text-sm text-muted-foreground">{item.composition || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.manufacturer || '-'} • {item.batchCode || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 w-[12%]">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs text-center font-semibold ${getCategoryColor(item.category?.primaryCategory || '')}`}>
                        {item.category?.primaryCategory || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-5 px-6 w-[19%]">
                      <div className="space-y-1">
                        <div className={`font-semibold text-base flex items-center ${isLowStock ? 'text-red-600' : 'text-foreground'}`}>
                          Available: {availableStock} units 
                          {isLowStock && <AlertTriangle className="inline w-4 h-4 ml-2 text-red-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          
                        {`ReservedQty: ${reservedStock}`}{item.stock?.allowSubQuantity && item.stock?.totalSubUnits != null
                          ? ` • ReservedSubQty: ${item.displayStock?.reservedSubUnits ?? 0}`
                          : ''}
                        {item.stock?.allowSubQuantity && item.stock?.totalSubUnits != null
                          ? ` • Sub-Units: ${item.stock.totalSubUnits}`
                          : ''}{` • Threshold: ${threshold > 1 ? `${threshold} units` : `${threshold} unit`}`}

                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 w-[13%]">
                      <div className="font-semibold text-base flex items-center gap-2 whitespace-nowrap">
                        <span className="whitespace-nowrap">
                          ₹ {price.toFixed(1)}
                        </span>

                        {mrp > price && (
                          <span className="text-green-600 font-semibold text-xs">
                            {Math.round(((mrp - price) / mrp) * 100)}% OFF
                          </span>
                        )}
                      </div>

                      {mrp > price && (
                        <div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                          MRP: ₹ <span className="line-through">{mrp.toFixed(1)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-5 px-6 w-[12%]">
                      {expiryDate ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-sm text-foreground">
                            {expiryDate.toLocaleDateString('en-GB')}
                          </div>
                          <div className={`text-xs ${expirySubColor}`}>
                            {expirySubText}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">N/A</div>
                      )}
                    </td>

                    <td className="py-5 px-6 w-[10%]">
                      <Badge
                        variant={stockStatus.variant}
                        className="font-semibold text-center w-auto flex justify-center"
                      >
                        {stockStatus.status}
                      </Badge>
                    </td>

                    <td className="py-5 px-6 w-[14%]">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" title="Edit" className="hover:bg-green-100 hover:text-green-600" onClick={() => openEditModal(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"  
                          title="View" 
                          className="hover:bg-blue-100 hover:text-blue-600"  
                          onClick={() => openViewModal(item)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Delete" className="hover:bg-red-100 hover:text-red-600" onClick={() => handleDelete(medicineId)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            
            {filteredInventory.length === 0 && (
              <div className="text-center py-8">
                <div className="text-muted-foreground">No medicines found matching your criteria.</div>
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, allFilteredInventory.length)} of {allFilteredInventory.length} items
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded ${
                          currentPage === page
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {(showAddModal || editingMedicine) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full my-8">
            {(() => {
            
              const totalSubUnits =
                formData.stock.allowSubQuantity &&
                formData.stock.unitsAvailable &&
                formData.stock.baseQuantity
                  ? formData.stock.unitsAvailable * formData.stock.baseQuantity
                  : null;

              return (
                <>
                  {/* Header */}
                  <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                      {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
                    </h2>
                    <button
                      onClick={() => {
                        resetForm();
                        setShowAddModal(false);
                        setEditingMedicine(undefined);
                        
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form
                    onSubmit={editingMedicine ? handleUpdateMedicine : handleAddMedicine}
                    className="p-6 space-y-6 max-h-[70vh] overflow-y-auto"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Product ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product ID
                        </label>
                        <Input
                          value={formData.productID}
                          disabled
                          className="bg-gray-50"
                          placeholder="Loading..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-incremented from previous products
                        </p>
                      </div>

                      {/* Product Image Upload with Drag & Drop */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Image
                        </label>

                        <div className="relative">
                          {!imagePreview && !formData.productImageURL ? (
                            <div
                              onDragOver={handleDragOver}
                            onDrop={handleDrop}
                              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                              onClick={() => document.getElementById('imageUpload')?.click()}
                            >
                              <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-gray-100 rounded-full">
                                  <Upload className="w-8 h-8 text-gray-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-700">
                                    Drop image here or click to upload
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Or paste image URL below • PNG, JPG up to 5MB
                                  </p>
                                </div>
                              </div>
                              <input
                                id="imageUpload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <img
                                src={getImageUrl(imagePreview || formData.productImageURL)}
                                alt="Product preview"
                                className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                              />
                              <button
                                type="button"
                                onClick={clearImage}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                title="Remove image"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {/* Loading indicator */}
                          {uploadingImage && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Or paste image URL
                          </label>
                          <Input
                            value={formData.productImageURL}
                            onChange={(e) => {
                              setFormData({ ...formData, productImageURL: e.target.value });
                              if (e.target.value) {
                                setImagePreview(e.target.value);
                              }
                            }}
                            placeholder="https://example.com/image.jpg"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      {/* Rest of the form fields remain the same... */}
                      {/* Product Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Name *
                        </label>
                        <Input
                          required
                          value={formData.medicineName}
                          onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
                          placeholder="e.g. Paracetamol 500mg"
                        />
                      </div>
                       {/* Primary Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category *
                        </label>
                        <select
                          required
                          value={formData.category.primaryCategory}
                          onChange={(e) => {
                            const newCategory = e.target.value;
                            setFormData({
                              ...formData,
                              category: {
                                ...formData.category,
                                primaryCategory: newCategory
                              },
                              packaging:
                                newCategory === 'FMCG'
                                  ? {
                                      ...formData.packaging,
                                      quantityDescription: ''
                                    }
                                  : formData.packaging
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          {categories.filter((c) => c !== 'ALL').map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Composition */}
                       {!'Medical Devices'.includes(
                      formData.category.primaryCategory
                  ) && (  
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Composition *
                        </label>
                        <Input
                          required
                          value={formData.composition}
                          onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                          placeholder="e.g. Acetaminophen"
                        />
                      </div>
                  )}

                      {/* Manufacturer */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Manufacturer
                        </label>
                        <Input
                          value={formData.manufacturer}
                          onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                          placeholder="e.g. Cipla Ltd."
                        />
                      </div>

                      {/* Batch Code */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Batch Code
                        </label>
                        <Input
                          value={formData.batchCode}
                          onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })}
                          placeholder="e.g. BATCH001"
                        />
                      </div>

                     

                      {/* Therapeutic Class */}
                   {!['Medical Devices', 'Personal Care & Wellness', 'FMCG'].includes(
                      formData.category.primaryCategory
                  ) && (    
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Therapeutic Class
                        </label>
                        <Input
                          value={formData.category.therapeuticClass}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              category: { ...formData.category, therapeuticClass: e.target.value }
                            })
                          }
                          placeholder="e.g. Analgesic"
                        />
                      </div>
                     )}

                      {/* Dosage Form */}
                      {!['Medical Devices', 'Personal Care & Wellness', 'FMCG'].includes(
                      formData.category.primaryCategory
                  ) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dosage Form
                        </label>
                        <select
                          value={formData.category.dosageForm}
                          onChange={(e) => {
                            const selected = dosageForms.find(d => d.label === e.target.value);
                            setFormData({
                              ...formData,
                              category: { ...formData.category, dosageForm: e.target.value },
                              // Reset sub-quantity fields if the new form doesn't support sub units
                              stock: selected?.hasSubUnit
                                ? formData.stock
                                : { ...formData.stock, allowSubQuantity: false, baseQuantity: '', totalSubUnits: undefined }
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">-- Select Dosage Form --</option>
                          {dosageForms.map(d => (
                            <option key={d.label} value={d.label}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                  )}

                      {/* Quantity (Full Units) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity (Full Units)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.stock.unitsAvailable || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stock: {
                                ...formData.stock,
                                unitsAvailable: e.target.value ? Number(e.target.value) : undefined
                              }
                            })
                          }
                          placeholder="e.g. 150"
                        />
                      </div>

                      {/* Low Stock Threshold */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Low Stock Threshold
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.stock.threshold || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stock: {
                                ...formData.stock,
                                threshold: e.target.value ? Number(e.target.value) : undefined
                              }
                            })
                          }
                          placeholder="e.g. 20"
                        />
                      </div>

                      {/* Sub Quantity Toggle */}
                      {dosageForms.find(d => d.label === formData.category.dosageForm)?.hasSubUnit && (
                      <div className="md:col-span-2 flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="allowSubQuantity"
                          checked={formData.stock.allowSubQuantity || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stock: {
                                ...formData.stock,
                                allowSubQuantity: e.target.checked,
                                baseQuantity: undefined
                              }
                            })
                          }
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                        <label htmlFor="allowSubQuantity" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Allow Sub-Quantity Sale (e.g., sell individual tablets from strips)
                        </label>
                      </div>
                        )} 

                      {/* Conditional: Sub-Quantity Fields */}
                      {formData.stock.allowSubQuantity && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Base Quantity (Units per Package) *
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={formData.stock.baseQuantity || ''}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  stock: {
                                    ...formData.stock,
                                    baseQuantity: e.target.value ? Number(e.target.value) : undefined
                                  }
                                })
                              }
                              placeholder="e.g. 10 (tablets per strip)"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Total Sub-Units Available
                            </label>
                            <Input 
                              value={totalSubUnits || '0'} 
                              disabled 
                              className="bg-gray-50"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Full Units x Base Quantity = {formData.stock.unitsAvailable || 0} × {formData.stock.baseQuantity || 0} = {totalSubUnits || 0}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Quantity Description (Hidden for FMCG) */}
                   
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity Description
                          </label>
                          <Input
                            value={formData.packaging.quantityDescription}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                packaging: { ...formData.packaging, quantityDescription: e.target.value }
                              })
                            }
                            placeholder="e.g. Strip of 10 tablets, Bottle of 100ml"
                          />
                        </div>
                     

                      {/* Price */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price (₹)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.packaging.price || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              packaging: {
                                ...formData.packaging,
                                price: e.target.value ? Number(e.target.value) : undefined
                              }
                            })
                          }
                          placeholder="e.g. 25.50"
                        />
                      </div>

                      
                      {/* Price per Unit */}
                    {formData.stock?.allowSubQuantity && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price per Unit (₹)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.packaging.pricePerUnit || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                packaging: {
                                  ...formData.packaging,
                                  pricePerUnit: e.target.value ? Number(e.target.value) : undefined
                                }
                              })
                            }
                            placeholder="e.g. 2.55"
                          />
                        </div>
                      )}
                      {/* MRP */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          MRP (₹)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.packaging.mrp || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              packaging: {
                                ...formData.packaging,
                                mrp: e.target.value ? Number(e.target.value) : undefined
                              }
                            })
                          }
                          placeholder="e.g. 30.00"
                        />
                      </div>

                      {/* Discount Percent */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Discount (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.packaging.discountPercent || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              packaging: {
                                ...formData.packaging,
                                discountPercent: e.target.value ? Number(e.target.value) : undefined
                              }
                            })
                          }
                          placeholder="e.g. 20 for 20% off"
                        />
                      </div>

                      {/* Manufacturing Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Manufacturing Date
                        </label>
                        <Input
                          type="date"
                          value={formData.manufacturedDate}
                          onChange={(e) => setFormData({ ...formData, manufacturedDate: e.target.value })}
                        />
                      </div>

                      {/* Expiry Date / Warranty */}
                      {formData.category.primaryCategory === 'Medical Devices' ? (
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Warranty (Years)
                              </label>
                              <Input
                                  type="number"
                                  min="0"
                                  value={formData.warranty || ''}
                                  onChange={(e) =>
                                      setFormData({ ...formData, warranty: e.target.value })
                                  }
                                  placeholder="e.g. 2"
                              />
                          </div>
                      ) : (
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Expiry Date
                              </label>
                              <Input
                                  type="date"
                                  value={formData.expiryDate}
                                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                              />
                          </div>
                      )}


                      {/* Storage Condition */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Storage Condition
                        </label>
                        <Input
                          value={formData.storageCondition || ''}
                          onChange={(e) => setFormData({ ...formData, storageCondition: e.target.value })}
                          placeholder="e.g. Store in cool, dry place"
                        />
                      </div>

                      {gstRegistered && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              GST Rate (%)
                            </label>
                            <select
                              value={formData.packaging?.gstRate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, packaging: { ...formData.packaging, gstRate: e.target.value ? Number(e.target.value) : undefined } })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="">-- Select GST Rate --</option>
                              {[0, 5, 12, 18, 28].map((rate) => (
                                <option key={rate} value={rate}>{rate}%</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              HSN Code
                            </label>
                            <Input
                              value={formData.packaging?.hsnCode || ''}
                              onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, hsnCode: e.target.value } })}
                              placeholder="e.g. 30049099"
                            />
                          </div>
                        </>
                      )}

                      {/* Description */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Additional details about the medicine"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Prescription Required Checkbox */}
                    {!['Medical Devices', 'Personal Care & Wellness', 'FMCG'].includes(
                      formData.category.primaryCategory
                  ) && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="prescriptionRequired"
                        checked={formData.prescriptionRequired || false}
                        onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="prescriptionRequired" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Prescription Required
                      </label>
                    </div>
                  )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setShowAddModal(false);
                          setEditingMedicine(undefined);
                          
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                        {editingMedicine ? 'Update Medicine' : 'Add Medicine'}
                      </Button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* View Medicine Card */}
      {showViewModal && (
        
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => {
              setShowViewModal(false);
              resetForm();  
            }}
          />

          <div className="relative bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-scaleIn">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-bold tracking-tight text-emerald-700">
                Medicine Details
              </h2>
              
              <button onClick={() => {
                setShowViewModal(false);
                resetForm();  // ✅ Add this
              }}>
                <X className="w-5 h-5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-8 text-sm">
              <img 
                src={getImageUrl(imagePreview || formData.productImageURL)} 
                alt="Medicine" 
                className="w-[clamp(400px,80vw,600px)] h-[clamp(200px,60vh,400px)] object-contain mx-auto mb-4" 
              />
              
              {/* BASIC INFO */}
              <div>
                <p className="text-xs font-bold uppercase text-blue-600 mb-3">Basic Info</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Name" value={formData.medicineName}  />
                  <Info label="Product ID" value={formData.productID} />
                  <Info label="Composition" value={formData.composition}  />
                  <Info label="Manufacturer" value={formData.manufacturer}  />
                </div>
              </div>

              {/* CATEGORY */}
              <div>
                
                <p className="text-xs font-bold uppercase text-purple-600 mb-3">Category</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Primary" value={formData.category?.primaryCategory}  />
                  
                  {isDrugCategory && (
                    <>
                      <Info label="Therapeutic" value={formData.category?.therapeuticClass} />
                      <Info label="Dosage Form" value={formData.category?.dosageForm} />
                    </>
                  )}
                </div>
              </div>

              {/* STOCK */}
              <div>
                <p className="text-xs font-bold uppercase text-amber-600 mb-3">Stock</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Units Available" value={formData.stock?.unitsAvailable} />
                  <Info label="Threshold" value={formData.stock?.threshold} />

                    {formData.stock?.allowSubQuantity && formData.stock?.baseQuantity && (
                      <Info
                        label="Total Sub-Units"
                        value={formData.stock.totalSubUnits ?? 0}
                      />
                    )}
                </div>
              </div>

              {/* PRICING */}
              <div>
                <p className="text-xs font-bold uppercase text-emerald-600 mb-3">Pricing</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Price" value={formData.packaging?.price ? `₹ ${formData.packaging.price}` : '—'}  />
                  <Info label="MRP" value={formData.packaging?.mrp ? `₹ ${formData.packaging.mrp}` : '—'} />
                   {formData.stock?.allowSubQuantity && (
                 <Info label="Price per unit" value={formData.packaging?.pricePerUnit ? `₹ ${formData.packaging.pricePerUnit}` : '-'}/>
                )}
                  <Info label="Quantity Description" value={formData.packaging.quantityDescription}  />
                </div>
              </div>

              {/* DATES */}
              <div>
                <p className="text-xs font-bold uppercase text-rose-600 mb-3">Dates</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Manufactured" value={formatDateForDisplay(formData.manufacturedDate)}  />
                  <Info label="Expiry" value={formatDateForDisplay(formData.expiryDate)}  />
                  <Info label="Last Updated" value={formatDateForDisplay(formData.lastUpdated)}  />
                </div>
              </div>

              {/* STORAGE */}
              <div>
                <p className="text-xs font-bold uppercase text-cyan-600 mb-3">Storage</p>
                <Info label="Condition" value={formData.storageCondition} />
              </div>

              {/* GST — only shown for GST-registered pharmacies */}
              {gstRegistered && (
                <div>
                  <p className="text-xs font-bold uppercase text-indigo-600 mb-3">GST Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Info label="GST Rate" value={formData.gstRate != null ? `${formData.gstRate}%` : '—'} />
                    <Info label="HSN Code" value={formData.hsnCode || '—'} />
                  </div>
                </div>
              )}
              
              {/* DESCRIPTION */}
              <div>
                <p className="text-xs font-bold uppercase text-gray-600 mb-2">Description</p>
                <div className="bg-gray-50 rounded-lg p-3 text-justify text-gray-700">
                  {formData.description || "—"}
                </div>
              </div>

              {/* BADGE */}
              <div>
                  {isDrugCategory && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    formData.prescriptionRequired
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {formData.prescriptionRequired
                    ? "Prescription medicine"
                    : "Non-prescription medicine"}
                </span>
                )}
              </div>
                  
            </div>
          </div>
        </div>
      )}
    </div>
  );
}