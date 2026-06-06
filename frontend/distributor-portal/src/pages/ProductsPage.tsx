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

// ─────────────────────────────────────────────────────────────────────────────
// Dosage-form configuration — drives which packaging fields are shown
// ─────────────────────────────────────────────────────────────────────────────
type FieldType = 'units+packs' | 'packSize' | 'packsOnly' | 'unitsOnly' | 'none';

interface DosageFormConfig {
  fieldType: FieldType;
  defaultUnit?: string;
  container?: string;
  unitLabel?: string;    // label for the "units" input
  packsLabel?: string;   // label for the "packs/box" input
}

const DOSAGE_FORM_CONFIG: Record<string, DosageFormConfig> = {
  'Tablet':     { fieldType: 'units+packs', unitLabel: 'Tablets per Strip',  packsLabel: 'Strips per Box' },
  'Capsule':    { fieldType: 'units+packs', unitLabel: 'Capsules per Strip', packsLabel: 'Strips per Box' },
  'Syrup':      { fieldType: 'packSize',  defaultUnit: 'ml',    container: 'Bottle'  },
  'Injection':  { fieldType: 'packSize',  defaultUnit: 'ml',    container: 'Vial'    },
  'Cream':      { fieldType: 'packSize',  defaultUnit: 'g',     container: 'Tube'    },
  'Ointment':   { fieldType: 'packSize',  defaultUnit: 'g',     container: 'Tube'    },
  'Gel/Spray':  { fieldType: 'packSize',  defaultUnit: 'ml',    container: 'Bottle'  },
  'Drops':      { fieldType: 'packSize',  defaultUnit: 'ml',    container: 'Bottle'  },
  'Sachet':     { fieldType: 'packsOnly', packsLabel: 'Sachets per Box' },
  'Lotion':     { fieldType: 'packSize',  defaultUnit: 'ml',    container: 'Bottle'  },
  'Powder':     { fieldType: 'packSize',  defaultUnit: 'g',     container: 'Pack'    },
  'Inhaler':    { fieldType: 'packSize',  defaultUnit: 'doses', container: 'Inhaler' },
  'Gloves':     { fieldType: 'packsOnly', packsLabel: 'Gloves per Box' },
  'Mask':       { fieldType: 'packsOnly', packsLabel: 'Pieces per Box' },
  'Other':      { fieldType: 'units+packs' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toNum(value: any): number {
  if (value == null) return 0;
  if (typeof value === 'object' && '$numberDecimal' in value) return parseFloat(value.$numberDecimal) || 0;
  return Number(value) || 0;
}

function parseDDMMYYYY(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined;
  if (dateString instanceof Date) return dateString as any;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? undefined : d;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const [dd, mm, yyyy] = dateString.split('-');
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function formatDateForDisplay(input?: string | Date): string {
  if (!input) return "—";
  const date = input instanceof Date ? input : parseDDMMYYYY(input as string);
  if (!date || isNaN(date.getTime())) return "—";
  const hasTime =
    input instanceof Date
      ? input.getHours() !== 0 || input.getMinutes() !== 0 || input.getSeconds() !== 0
      : typeof input === "string" && (input.includes("T") || input.includes(":"));
  if (hasTime) {
    return date.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  }
  return date.toLocaleDateString("en-GB");
}

/**
 * Build a human-readable quantity description based on dosage form & packaging fields.
 * Each dosage form category uses different source fields:
 *   - units+packs  → unitsPerPack + packsPerBox   (Tablet, Capsule, Other)
 *   - packSize     → packSize + packSizeUnit       (Syrup, Injection, Cream, …)
 *   - packsOnly    → packsPerBox                  (Sachet)
 *   - unitsOnly    → unitsPerPack                 (Gloves, Mask)
 */
function getQuantityDescription(
  dosageForm: string,
  unitsPerPack: number,
  packsPerBox: number,
  packSize?: number,
  packSizeUnit?: string
): string {
  const cfg = DOSAGE_FORM_CONFIG[dosageForm];
  const fieldType: FieldType = cfg?.fieldType ?? 'units+packs';

  // ── packSize forms (Syrup, Injection, Cream, …) ──────────────────────────
  if (fieldType === 'packSize') {
    if (!packSize) return '—';
    const unit      = packSizeUnit || cfg?.defaultUnit || 'ml';
    const container = cfg?.container || 'Pack';
    let desc = `${packSize} ${unit} per ${container}`;
    if (packsPerBox > 0) {
      desc += ` | ${packsPerBox} ${container}${packsPerBox !== 1 ? 's' : ''} per Box`;
    }
    return desc;
  }

  if (fieldType === 'packsOnly') {
  if (!packsPerBox) return '—';

  const nounMap: Record<string, string> = {
    Sachet: 'Sachet',
    Gloves: 'Glove',
    Mask: 'Piece'
  };

  const noun = nounMap[dosageForm] || 'Unit';

  return `${packsPerBox} ${noun}${packsPerBox !== 1 ? 's' : ''} per Box`;
}

  // ── units+packs (Tablet, Capsule, Other) ─────────────────────────────────
  const unitNames: Record<string, { unit: string; pack: string }> = {
    Tablet:  { unit: 'Tablet',  pack: 'Strip' },
    Capsule: { unit: 'Capsule', pack: 'Strip' },
  };
  const names = unitNames[dosageForm] || { unit: 'Unit', pack: 'Pack' };
  const parts: string[] = [];
  if (unitsPerPack > 0) parts.push(`${unitsPerPack} ${names.unit}${unitsPerPack !== 1 ? 's' : ''} per ${names.pack}`);
  if (packsPerBox  > 0) parts.push(`${packsPerBox} ${names.pack}${packsPerBox !== 1 ? 's' : ''} per Box`);
  return parts.join(' | ') || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
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

  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [stats, setStats] = useState<InventoryStats | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);
  const [showViewModal, setShowViewModal] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Flat list of dosage form labels driven by the config object
  const dosageFormLabels = Object.keys(DOSAGE_FORM_CONFIG);

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

  // ── Initial / blank form state ────────────────────────────────────────────
  const blankForm = () => ({
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

      mrpPerPack:      undefined as number | undefined,
      discountPercent: undefined as number | undefined,
      price:           undefined as number | undefined,
      pricePerBox:     undefined as number | undefined,   // ← ADD
      mrpPerBox:       undefined as number | undefined,  
      gstRate:         undefined as number | undefined,
      hsnCode:         '',
      // units+packs fields
      unitsPerPack:    undefined as number | undefined,
      packsPerBox:     undefined as number | undefined,
      // packSize fields (Syrup, Injection, Cream, …)
      packSize:        undefined as number | undefined,
      packSizeUnit:    '',
      purchase: [{ orderUnit: 'box', minimumOrderQuantity: undefined as number | undefined }],
      scheme: {
        buyQty:  undefined as number | undefined,
        buyUnit: 'pack',
        freeQty: undefined as number | undefined,
        freeUnit: 'pack'
      }
    },
    stock: {
      packsAvailable: undefined as number | undefined,
      threshold:      undefined as number | undefined,
    },
    storageCondition: '',
    manufacturedDate: '',
    expiryDate: '',
    lastUpdated: '',
    warranty: ''
  });

  const [formData, setFormData] = useState<ReturnType<typeof blankForm>>(blankForm());

  // ── API helpers ───────────────────────────────────────────────────────────
  const fetchgstDetails = async (distributorID: string) => {
    try {
      const res = await fetch(`${API_URL}/distributor/${distributorID}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.gstRegistered && data.gstIN) setGstRegistered(true);
    } catch (err) {
      console.error("Failed to fetch distributor details:", err);
    }
  };

  useEffect(() => {
    if (user?.id) { fetchData(); fetchgstDetails(user.id); }
  }, [user]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(undefined), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, activeFilter, sortBy, sortOrder]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [inventoryData, statsData] = await Promise.all([
        inventoryService.getInventory(user.id),
        inventoryService.getStats(user.id)
      ]);
      setInventory(inventoryData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Fetch error:', error);
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
    } catch {
      setFormData((prev: any) => ({ ...prev, productID: `PRD-${user.id}-${Date.now()}` }));
    }
  };

  // ── Image helpers ─────────────────────────────────────────────────────────
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image size should be less than 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please drop an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image size should be less than 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = async () => {
    if (formData.productImageURL && user?.id && formData.productID) {
      try { await inventoryService.deleteProductImage(user.id, formData.productID); }
      catch (error) { console.error('Failed to delete image from server:', error); }
    }
    setImageFile(null);
    setImagePreview('');
    setFormData((prev: any) => ({ ...prev, productImageURL: '' }));
  };

  const getImageUrl = (imageUrl: string) => {
    if (!imageUrl) return 'http://localhost:5204/uploads/productImages/default-medicine.jpg';
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('/uploads/')) return `http://localhost:5204${imageUrl}`;
    return imageUrl;
  };

  // ── Payload builders ──────────────────────────────────────────────────────
  const buildPurchasePayload = (purchaseArr: any[]) =>
    (purchaseArr || [])
      .filter((p: any) => p.orderUnit)
      .map((p: any) => ({
        orderUnit: p.orderUnit,
        minimumOrderQuantity: p.minimumOrderQuantity ? Number(p.minimumOrderQuantity) : undefined,
      }));

  /**
   * Build the packaging sub-object for save/update.
   * Only persists fields that are relevant to the selected dosage form's fieldType,
   * keeping the DB clean while ensuring round-trip fidelity.
   */
  const buildPackagingPayload = (pkg: typeof formData.packaging) => {
    const cfg       = DOSAGE_FORM_CONFIG[formData.category.dosageForm];
    const fieldType = cfg?.fieldType ?? 'units+packs';

    return {
  
      mrpPerPack:      pkg.mrpPerPack      ? Number(pkg.mrpPerPack)      : undefined,
      discountPercent: pkg.discountPercent ? Number(pkg.discountPercent) : undefined,
      price:           pkg.price           ? Number(pkg.price)           : undefined,
      pricePerBox:     (pkg as any).pricePerBox ? Number((pkg as any).pricePerBox) : undefined,  
      mrpPerBox:       (pkg as any).mrpPerBox   ? Number((pkg as any).mrpPerBox)   : undefined,  
      // Conditionally include field groups
      unitsPerPack: (fieldType === 'units+packs' || fieldType === 'unitsOnly')
        ? (pkg.unitsPerPack ? Number(pkg.unitsPerPack) : undefined)
        : undefined,
      packsPerBox: (fieldType === 'units+packs' || fieldType === 'packsOnly' || fieldType === 'packSize')
        ? (pkg.packsPerBox ? Number(pkg.packsPerBox) : undefined)
        : undefined,
      packSize:     fieldType === 'packSize' ? ((pkg as any).packSize ? Number((pkg as any).packSize) : undefined) : undefined,
      packSizeUnit: fieldType === 'packSize' ? ((pkg as any).packSizeUnit || cfg?.defaultUnit || undefined) : undefined,
      ...(gstRegistered && {
        gstRate: (pkg as any).gstRate ? Number((pkg as any).gstRate) : undefined,
        hsnCode: (pkg as any).hsnCode || undefined,
      }),
      purchase: buildPurchasePayload(pkg.purchase),
      scheme: {
        buyQty:  pkg.scheme.buyQty  ? Number(pkg.scheme.buyQty)  : undefined,
        buyUnit: pkg.scheme.buyUnit  || 'pack',
        freeQty: pkg.scheme.freeQty ? Number(pkg.scheme.freeQty) : undefined,
        freeUnit: pkg.scheme.freeUnit || 'pack'
      }
    };
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      const productID = formData.productID;
      const dataToSend = {
        productImageURL: formData.productImageURL || undefined,
        productID,
        distributorID: user.id,
        medicineName: formData.medicineName,
        composition:  formData.composition,
        batchCode:    formData.batchCode || undefined,
        category: {
          primaryCategory:  formData.category.primaryCategory,
          therapeuticClass: formData.category.therapeuticClass || undefined,
          dosageForm:       formData.category.dosageForm || undefined
        },
        description:          formData.description          || undefined,
        prescriptionRequired: formData.prescriptionRequired,
        manufacturer:         formData.manufacturer         || undefined,
        packaging: buildPackagingPayload(formData.packaging),
        stock: {
          packsAvailable: formData.stock.packsAvailable ? Number(formData.stock.packsAvailable) : undefined,
          threshold:      formData.stock.threshold      ? Number(formData.stock.threshold)      : undefined,
        },
        storageCondition: formData.storageCondition,
        manufacturedDate: formData.manufacturedDate || undefined,
        ...(formData.category.primaryCategory === 'Medical Devices'
          ? { warranty:   formData.warranty   || undefined }
          : { expiryDate: formData.expiryDate || undefined }
        ),
        lastUpdated: formData.lastUpdated || undefined
      };

      const saved = await inventoryService.addMedicine(user.id, productID, dataToSend);
      if (imageFile) {
        try {
          const imageURL = await inventoryService.uploadProductImage(user.id, saved.productID, imageFile);
          await inventoryService.updateMedicine(user.id, saved.productID, { productImageURL: imageURL });
        } catch (imgErr) { console.warn('Product saved but image upload failed:', imgErr); }
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
    const productID = editingMedicine?.productID || (editingMedicine as any)?.id;
    if (!productID || !user?.id) return;
    try {
      const dataToSend = {
        productImageURL:      formData.productImageURL || undefined,
        medicineName:         formData.medicineName,
        composition:          formData.composition,
        batchCode:            formData.batchCode || undefined,
        category:             formData.category,
        description:          formData.description || undefined,
        prescriptionRequired: formData.prescriptionRequired,
        manufacturer:         formData.manufacturer || undefined,
        packaging: buildPackagingPayload(formData.packaging),
        stock: {
          packsAvailable: formData.stock.packsAvailable ? Number(formData.stock.packsAvailable) : undefined,
          threshold:      formData.stock.threshold      ? Number(formData.stock.threshold)      : undefined,
        },
        storageCondition: formData.storageCondition,
        manufacturedDate: formData.manufacturedDate || undefined,
        ...(formData.category.primaryCategory === 'Medical Devices'
          ? { warranty:   formData.warranty   || undefined }
          : { expiryDate: formData.expiryDate || undefined }
        ),
        lastUpdated: formData.lastUpdated || undefined
      };

      await inventoryService.updateMedicine(user.id, productID, dataToSend);
      if (imageFile) {
        try {
          const imageURL = await inventoryService.uploadProductImage(user.id, productID, imageFile);
          await inventoryService.updateMedicine(user.id, productID, { productImageURL: imageURL });
        } catch (imgErr) { console.warn('Medicine updated but image upload failed:', imgErr); }
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

  // ── Form mappers ──────────────────────────────────────────────────────────
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

    let purchaseMapped: any[];
    if (Array.isArray(medicine.packaging?.purchase) && medicine.packaging.purchase.length > 0) {
      purchaseMapped = medicine.packaging.purchase.map((p: any) => ({
        orderUnit: p.orderUnit || 'box',
        minimumOrderQuantity: toNum(p.minimumOrderQuantity) || undefined,
      }));
    } else if (medicine.packaging?.orderUnit) {
      purchaseMapped = [{
        orderUnit: medicine.packaging.orderUnit,
        minimumOrderQuantity: toNum(medicine.packaging.minimumOrderQuantity) || undefined,
      }];
    } else {
      purchaseMapped = [{ orderUnit: 'box', minimumOrderQuantity: undefined }];
    }

    const dosageForm   = medicine.category?.dosageForm || '';
    const cfg          = DOSAGE_FORM_CONFIG[dosageForm];
    // Prefer stored packSizeUnit; fall back to the config default
    const packSizeUnit = medicine.packaging?.packSizeUnit || cfg?.defaultUnit || '';

    return {
      productImageURL:      medicine.productImageURL || '',
      productID:            medicine.productID || medicine.id || '',
      medicineName:         medicine.medicineName || '',
      composition:          medicine.composition  || '',
      category: {
        primaryCategory:  medicine.category?.primaryCategory  || 'Prescription Medicines',
        therapeuticClass: medicine.category?.therapeuticClass || '',
        dosageForm
      },
      description:          medicine.description          || '',
      prescriptionRequired: medicine.prescriptionRequired || false,
      manufacturer:         medicine.manufacturer         || '',
      packaging: {
      
        price:           toNum(medicine.packaging?.price)           || undefined,
        mrpPerPack:      toNum(medicine.packaging?.mrpPerPack)      || undefined,
        pricePerBox:     toNum(medicine.packaging?.pricePerBox)     || undefined,   // ← ADD
        mrpPerBox:       toNum(medicine.packaging?.mrpPerBox)       || undefined,   // ← ADD
        discountPercent: toNum(medicine.packaging?.discountPercent) || undefined,
        unitsPerPack:    toNum(medicine.packaging?.unitsPerPack)    || undefined,
        packsPerBox:     toNum(medicine.packaging?.packsPerBox)     || undefined,
        packSize:        toNum(medicine.packaging?.packSize)        || undefined,
        packSizeUnit,
        purchase: purchaseMapped,
        ...(gstRegistered && {
          gstRate: toNum(medicine.packaging?.gstRate) || undefined,
          hsnCode: medicine.packaging?.hsnCode || undefined,
        }),
        scheme: {
          buyQty:   toNum(medicine.packaging?.scheme?.buyQty)  || undefined,
          buyUnit:  medicine.packaging?.scheme?.buyUnit  || 'pack',
          freeQty:  toNum(medicine.packaging?.scheme?.freeQty) || undefined,
          freeUnit: medicine.packaging?.scheme?.freeUnit || 'pack'
        }
      },
      stock: {
        packsAvailable: medicine.stock?.packsAvailable ?? undefined,
        threshold:      medicine.stock?.threshold      ?? undefined,
      },
      storageCondition: medicine.storageCondition || '',
      batchCode:        medicine.batchCode        || '',
      manufacturedDate: manufDateForInput,
      expiryDate:       expiryDateForInput,
      warranty:         medicine.warranty    || '',
      lastUpdated:      medicine.lastUpdated || ''
    };
  };

  const openViewModal = (medicine: any) => {
    const mappedData = mapMedicineToForm(medicine);
    setFormData(mappedData as any);
    setImagePreview(mappedData.productImageURL || '');
    setShowViewModal(true);
  };

  const openEditModal = (medicine: any) => {
    setEditingMedicine(medicine);
    const mappedData = mapMedicineToForm(medicine);
    setFormData(mappedData as any);
    setImagePreview(medicine.productImageURL || '');
  };

  const resetForm = () => {
    setFormData(blankForm() as any);
    setImageFile(null);
    setImagePreview('');
  };

  // ── Stock / status helpers ────────────────────────────────────────────────
  const getAvailableStockValue = (item: any) => {
    const packs  = toNum(item.stock?.packsAvailable);
    const perBox = toNum(item.packaging?.packsPerBox);
    return perBox > 0 ? Math.floor(packs / perBox) : packs;
  };
  const getReservedStockValue = (item: any) => item.reservedStock ?? 0;

  // ── Filtering / sorting ───────────────────────────────────────────────────
  const allFilteredInventory = inventory.filter(item => {
    const name        = (item as any).medicineName || '';
    const composition = (item as any).composition  || '';
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      composition.toLowerCase().includes(searchTerm.toLowerCase());
    const itemCategory = (item as any).category?.primaryCategory || '';
    const matchesCategory = filterCategory === 'ALL' || itemCategory === filterCategory;
    const availableStock = getAvailableStockValue(item);
    let matchesStatsFilter = true;
    if (activeFilter === 'lowStock') {
      const threshold = (item as any).stock?.threshold || 0;
      matchesStatsFilter = availableStock <= threshold;
    } else if (activeFilter === 'expiring') {
      const expiryDate = parseDDMMYYYY((item as any).expiryDate);
      if (!expiryDate) { matchesStatsFilter = false; }
      else {
        const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        matchesStatsFilter = daysLeft >= 0 && daysLeft <= 90;
      }
    } else if (activeFilter === 'expired') {
      const expiryDate = parseDDMMYYYY((item as any).expiryDate);
      if (!expiryDate) { matchesStatsFilter = false; }
      else {
        const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        matchesStatsFilter = daysLeft < 0;
      }
    }
    return matchesSearch && matchesCategory && matchesStatsFilter;
  })
  .filter(item => {
    if (sortBy !== 'expiry') return true;
    const expiryDate = parseDDMMYYYY((item as any).expiryDate);
    if (!expiryDate) return false;
    return expiryDate >= new Date();
  })
  .sort((a, b) => {
    let aValue: any, bValue: any;
    if (sortBy === 'name') {
      aValue = ((a as any).medicineName || '').toLowerCase();
      bValue = ((b as any).medicineName || '').toLowerCase();
    } else if (sortBy === 'stock') {
      aValue = getAvailableStockValue(a);
      bValue = getAvailableStockValue(b);
    } else if (sortBy === 'price') {
      aValue = (a as any).packaging?.price || 0;
      bValue = (b as any).packaging?.price || 0;
    } else if (sortBy === 'expiry') {
      const aDate = parseDDMMYYYY((a as any).expiryDate);
      const bDate = parseDDMMYYYY((b as any).expiryDate);
      const aDays = aDate ? Math.ceil((aDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : Infinity;
      const bDays = bDate ? Math.ceil((bDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : Infinity;
      return sortOrder === 'asc' ? aDays - bDays : bDays - aDays;
    }
    if (sortOrder === 'asc') return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
  });

  const totalPages = Math.ceil(allFilteredInventory.length / itemsPerPage);
  const filteredInventory = allFilteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ── Status / colour helpers ───────────────────────────────────────────────
  const getStockStatus = (item: any) => {
    const availableStock = getAvailableStockValue(item);
    const threshold      = item.stock?.threshold || 0;
    if (availableStock === 0)        return { status: 'Out of Stock', variant: 'secondary' as const };
    if (availableStock <= threshold) return { status: 'Low Stock',    variant: 'warning'   as const };
    return                                  { status: 'In Stock',     variant: 'success'   as const };
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Prescription Medicines':   'bg-blue-100 text-blue-800',
      'OTC Medicines':            'bg-green-100 text-green-800',
      'Chronic Care Medicines':   'bg-yellow-100 text-yellow-800',
      'Acute Care Medicines':     'bg-red-100 text-red-800',
      'Supplements & Nutrition':  'bg-slate-100 text-slate-800',
      'Topical Medicines':        'bg-pink-100 text-pink-800',
      'Injectables & Vaccines':   'bg-purple-100 text-purple-800',
      'Medical Devices':          'bg-emerald-100 text-emerald-800',
      'Surgical & Consumables':   'bg-teal-100 text-teal-800',
      'Personal Care & Wellness': 'bg-orange-100 text-orange-800',
      'FMCG':                     'bg-amber-100 text-amber-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (!user?.id || inventory.length === 0) return;
    const headers = [
      'Product ID','Medicine Name','Composition','Category','Manufacturer',
      'Batch Code','Physical Stock','Reserved Stock','Available Stock',
      'Threshold','Price','MRP','Manufactured Date','Expiry Date','Status'
    ];
    const rows = inventory.map((item: any) => {
      const expiryDate = parseDDMMYYYY(item.expiryDate);
      const manufDate  = parseDDMMYYYY(item.manufacturedDate);
      const availableStock = getAvailableStockValue(item);
      const reservedStock  = getReservedStockValue(item);
      const physicalStock  = item.stock?.packsAvailable || 0;
      const threshold      = item.stock?.threshold || 0;
      const isLowStock     = availableStock <= threshold;
      const isExpired      = expiryDate && expiryDate < new Date();
      let status = 'In Stock';
      if (isExpired) status = 'Expired';
      else if (isLowStock) status = 'Low Stock';
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fmtDate = (d: Date | undefined) =>
        d ? `${String(d.getDate()).padStart(2,'0')}-${monthNames[d.getMonth()]}-${d.getFullYear()}` : 'N/A';
      const price = toNum(item.packaging?.price);
      const mrp   = toNum(item.packaging?.mrpPerPack);
      return [
        item.productID || item.id || '-', item.medicineName || '', item.composition || '-',
        item.category?.primaryCategory || '', item.manufacturer || '-', item.batchCode || '-',
        physicalStock, reservedStock, availableStock, threshold,
        price.toFixed(2), mrp.toFixed(2), fmtDate(manufDate), fmtDate(expiryDate), status
      ];
    });
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `pharmacy_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    if (!user?.id || inventory.length === 0) return;
    const headers = ['Product ID','Medicine Name','Composition','Category','Physical Stock','Reserved','Available','Price','Manufactured','Expiry','Status'];
    let pdfContent = `
<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;margin:20px;}
  h1{color:#333;margin-bottom:5px;}
  .pharmacy-info{background:#f5f5f5;padding:15px;border-radius:5px;margin-bottom:20px;border-left:4px solid #0066cc;}
  table{width:100%;border-collapse:collapse;margin-top:20px;}
  thead{background:#0066cc;color:white;}
  th,td{border:1px solid #ddd;padding:12px;text-align:left;}
  tr:nth-child(even){background:#f9f9f9;}
  .status-low{color:#d97706;font-weight:bold;}
  .status-expired{color:#dc2626;font-weight:bold;}
  .status-instock{color:#059669;font-weight:bold;}
  .timestamp{text-align:right;font-size:12px;color:#666;margin-top:20px;}
</style></head><body>
  <h1>Pharmacy Inventory Report</h1>
  <div class="pharmacy-info">
    <h2 style="margin-top:0;">${user.name || 'Pharmacy'}</h2>
    <p><strong>Address:</strong> ${(user as any).address || 'N/A'}</p>
    <p><strong>Phone:</strong> ${(user as any).phone || 'N/A'}</p>
    <p><strong>Email:</strong> ${(user as any).email || 'N/A'}</p>
  </div>
  <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>`;

    inventory.forEach((item: any) => {
      const expiryDate = parseDDMMYYYY(item.expiryDate);
      const manufDate  = parseDDMMYYYY(item.manufacturedDate);
      const availableStock = getAvailableStockValue(item);
      const reservedStock  = getReservedStockValue(item);
      const physicalStock  = item.stock?.packsAvailable || 0;
      const threshold      = item.stock?.threshold || 0;
      const isLowStock     = availableStock <= threshold;
      const isExpired      = expiryDate && expiryDate < new Date();
      let status = 'In Stock', statusClass = 'status-instock';
      if (isExpired) { status = 'Expired'; statusClass = 'status-expired'; }
      else if (isLowStock) { status = 'Low Stock'; statusClass = 'status-low'; }
      const price = toNum(item.packaging?.price);
      const cells = [
        item.productID || item.id || '-',
        `<strong>${item.medicineName || ''}</strong>`,
        item.composition || '-',
        item.category?.primaryCategory || '',
        physicalStock, reservedStock, availableStock,
        price.toFixed(2),
        manufDate  ? manufDate.toLocaleDateString()  : 'N/A',
        expiryDate ? expiryDate.toLocaleDateString() : 'N/A',
        `<span class="${statusClass}">${status}</span>`
      ];
      pdfContent += `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;
    });

    pdfContent += `</tbody></table><div class="timestamp"><p>Generated on: ${new Date().toLocaleString()}</p></div></body></html>`;
    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url  = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
        setTimeout(() => { printWindow.close(); window.URL.revokeObjectURL(url); }, 100);
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

  const selectCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm";

  // ── Packaging field type for the currently selected dosage form ───────────
  const activeCfg       = DOSAGE_FORM_CONFIG[formData.category.dosageForm];
  const activeFieldType = activeCfg?.fieldType ?? 'units+packs';

  // Auto-preview for the quantity description input hint
  const qtyPreview = formData.category.dosageForm
    ? getQuantityDescription(
        formData.category.dosageForm,
        toNum(formData.packaging.unitsPerPack),
        toNum(formData.packaging.packsPerBox),
        toNum((formData.packaging as any).packSize) || undefined,
        (formData.packaging as any).packSizeUnit
      )
    : '';
  const showQtyPreview = qtyPreview && qtyPreview !== '—';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="w-full bg-green-500 text-white rounded-lg px-6 py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 font-semibold text-base">
            <CheckCircle className="w-5 h-5 text-white" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(undefined)} className="text-white/80 hover:text-white transition" aria-label="Dismiss">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { filter: 'all'      as const, label: 'Total Medicines', value: stats?.totalItems   || 0, sub: 'Active inventory',               iconBg: 'bg-blue-100',  icon: <span className="text-blue-600 text-lg font-bold">M</span>, borderColor: 'border-l-blue-500'   },
          { filter: 'lowStock' as const, label: 'Low Stock',       value: stats?.lowStock     || 0, sub: 'Need reorder • Click to filter',  icon: <AlertTriangle className="h-12 w-12 text-yellow-400" />,                             borderColor: 'border-l-yellow-400' },
          { filter: 'expiring' as const, label: 'Expiring Soon',   value: stats?.expiringSoon || 0, sub: 'Within 90 days • Click to filter',icon: <AlertTriangle className="h-12 w-12 text-orange-500" />,                             borderColor: 'border-l-orange-500' },
          { filter: 'expired'  as const, label: 'Expired',         value: stats?.expired      || 0, sub: '0 days • Click to filter',        icon: <BanIcon className="h-12 w-12 text-red-500" />,                                      borderColor: 'border-l-red-500'    },
        ].map(({ filter, label, value, sub, icon, iconBg, borderColor }) => (
          <Card
            key={filter}
            className={`border-l-4 ${borderColor} cursor-pointer transition-all hover:shadow-md ${activeFilter === filter ? `ring-2 ${borderColor.replace('border-l-', 'ring-')} shadow-md` : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{label}</p>
                  <p className="text-3xl font-bold text-black">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{sub}</p>
                </div>
                {iconBg
                  ? <div className={`h-12 w-12 ${iconBg} rounded-full flex items-center justify-center`}>{icon}</div>
                  : icon}
              </div>
            </CardContent>
          </Card>
        ))}

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
                  setSortBy(field); setSortOrder(order);
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
                <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download className="w-4 h-4 mr-2" />Export
                </Button>
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button onClick={exportToCSV} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 border-b">
                      <FileText className="w-4 h-4" />Export as CSV
                    </button>
                    <button onClick={exportToPDF} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                      <FileText className="w-4 h-4" />Export as PDF
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-11 px-4" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />Refresh
              </Button>
              <Button
                className="h-11 px-6 bg-orange-600 hover:bg-orange-700"
                onClick={() => { setShowAddModal(true); fetchNextProductID(); }}
              >
                <Plus className="w-4 h-4 mr-2" />Add Medicine
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
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
                  <th className="pr-10 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[18%]">Stock</th>
                  <th className="pr-7 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[13%]">Price(per pack)</th>
                  <th className="pr-6 py-4 font-semibold text-foreground text-sm uppercase tracking-wide w-[12%]">Expiry/Warranty</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[10%]">Status</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground text-sm uppercase tracking-wide w-[14%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item: any, index) => {
                  const stockStatus    = getStockStatus(item);
                  const availableStock = getAvailableStockValue(item);
                  const reservedStock  = getReservedStockValue(item);
                  const threshold      = item.stock?.threshold || 0;
                  const isLowStock     = item.stock?.packsAvailable <= threshold;
                  const expiryDate     = parseDDMMYYYY(item.expiryDate);
                  const daysLeft       = expiryDate
                    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : undefined;
                  const isExpired      = daysLeft !== undefined && daysLeft < 0;
                  const isExpiringSoon = daysLeft !== undefined && daysLeft <= 90 && daysLeft >= 0;
                  let expirySubText = "N/A", expirySubColor = "text-green-600";
                  if (isExpired)           { expirySubText = "Expired";                                    expirySubColor = "text-red-600";    }
                  else if (isExpiringSoon) { expirySubText = `${daysLeft} days left • Expiring Soon`;      expirySubColor = "text-orange-600"; }
                  else if (daysLeft !== undefined) { expirySubText = `${daysLeft} days left`; }
                  const medicineId = item.productID || item.id || item._id || '';
                  const price = toNum(item.packaging?.price);
                  const mrp   = toNum(item.packaging?.mrpPerPack);
                  const priceBox   = toNum(item.packaging?.pricePerBox);
                  const mrpBox     = toNum(item.packaging?.mrpPerBox);
                  const displayPrice = priceBox > 0 ? priceBox : price;
                  const displayMrp   = priceBox > 0 ? mrpBox   : mrp;
                  const label        = priceBox > 0 ? '/box'   : '/pack';

                  return (
                    <tr key={medicineId} className={`border-b border-muted/50 hover:bg-muted/20 transition-all duration-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                      <td className="py-5 px-6">
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground text-base">{item.medicineName}</div>
                          {item.composition && (
                            <div className="text-sm text-muted-foreground">{item.composition}</div>
                          )}
                          <div className="text-xs text-muted-foreground">{item.manufacturer || '-'} • {item.batchCode || '-'}</div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs text-center font-semibold ${getCategoryColor(item.category?.primaryCategory || '')}`}>
                          {item.category?.primaryCategory || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="space-y-1">
                          <div className={`font-semibold text-base flex items-center ${isLowStock ? 'text-red-600' : 'text-foreground'}`}>
                            Available: {availableStock} boxes ({item.stock?.packsAvailable || 0} packs)
                            {isLowStock && <AlertTriangle className="inline w-4 h-4 ml-2 text-red-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {`ReservedQty: ${reservedStock}`} {` • Threshold: ${threshold} packs`}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                      {displayPrice > 0 ? (
                        <>
                          <div className="font-semibold text-base flex items-center gap-2 whitespace-nowrap">
                            <span>₹{displayPrice.toFixed(1)}<span className="text-xs font-normal text-gray-600 ml-0.5">{label}</span></span>
                            {displayMrp > displayPrice && (
                              <span className="text-green-600 font-semibold text-xs -ml-1 mt-1">
                                {Math.round(((displayMrp - displayPrice) / displayMrp) * 100)}% OFF
                              </span>
                            )}
                          </div>
                          {displayMrp > displayPrice && (
                            <div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                              MRP: ₹<span className="line-through">{displayMrp.toFixed(1)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                      <td className="py-3 px-4">
                        {item.category?.primaryCategory === 'Medical Devices' ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-sm text-foreground">{item.warranty || '—'}</div>
                            <div className="text-xs text-muted-foreground">Warranty</div>
                          </div>
                        ) : expiryDate ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-sm text-foreground">{expiryDate.toLocaleDateString('en-GB')}</div>
                            <div className={`text-xs ${expirySubColor}`}>{expirySubText}</div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">N/A</div>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        <Badge variant={stockStatus.variant} className="font-semibold text-center w-auto flex justify-center">
                          {stockStatus.status}
                        </Badge>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" title="Edit"   className="hover:bg-green-100 hover:text-green-600" onClick={() => openEditModal(item)}>
                            <Edit   className="w-4 h-4" />
                          </Button>
                          <Button size="icon"    variant="ghost" title="View"   className="hover:bg-blue-100  hover:text-blue-600"  onClick={() => openViewModal(item)}>
                            <Eye    className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Delete" className="hover:bg-red-100   hover:text-red-600"   onClick={() => handleDelete(medicineId)}>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, allFilteredInventory.length)} of {allFilteredInventory.length} items
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />Previous
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5)                   page = i + 1;
                    else if (currentPage <= 3)             page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else                                   page = currentPage - 2 + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded ${currentPage === page ? 'bg-orange-600 text-white font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {(showAddModal || editingMedicine) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full my-8">
            {(() => {
              const isFMCG      = formData.category.primaryCategory === 'FMCG';
              const isMedDevice = formData.category.primaryCategory === 'Medical Devices';
              const isSpecialCat = ['Medical Devices', 'Personal Care & Wellness', 'FMCG'].includes(formData.category.primaryCategory);
              const cfg         = DOSAGE_FORM_CONFIG[formData.category.dosageForm];
              const fieldType   = cfg?.fieldType ?? 'units+packs';
              return (
                <>
                  <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}</h2>
                    <button onClick={() => { resetForm(); setShowAddModal(false); setEditingMedicine(undefined); }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={editingMedicine ? handleUpdateMedicine : handleAddMedicine} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* ── Product ID ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                        <Input value={formData.productID} disabled className="bg-gray-50" placeholder="Loading..." />
                        <p className="text-xs text-gray-500 mt-1">Auto-incremented from previous products</p>
                      </div>

                      {/* ── Image Upload ── */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
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
                                  <p className="text-sm font-medium text-gray-700">Drop image here or click to upload</p>
                                  <p className="text-xs text-gray-500 mt-1">Or paste image URL below • PNG, JPG up to 5MB</p>
                                </div>
                              </div>
                              <input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </div>
                          ) : (
                            <div className="relative">
                              <img src={getImageUrl(imagePreview || formData.productImageURL)} alt="Product preview" className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                              <button type="button" onClick={clearImage} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
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
                          <label className="block text-xs font-medium text-gray-600 mb-1">Or paste image URL</label>
                          <Input
                            value={formData.productImageURL}
                            onChange={(e) => { setFormData({ ...formData, productImageURL: e.target.value }); if (e.target.value) setImagePreview(e.target.value); }}
                            placeholder="https://example.com/image.jpg"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      {/* ── Product Name ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name </label>
                        <Input required value={formData.medicineName} onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
                      </div>

                      {/* ── Manufacturer ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                        <Input value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="e.g. Cipla Ltd." />
                      </div>

                      {/* ── Batch Code ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Batch Code</label>
                        <Input value={formData.batchCode} onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })} placeholder="e.g. BATCH001" />
                      </div>

                      {/* ── Category ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category </label>
                        <select
                          required
                          value={formData.category.primaryCategory}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              category: { ...formData.category, primaryCategory: e.target.value },
                              packaging: e.target.value === 'FMCG'
                                ? { ...formData.packaging }
                                : formData.packaging
                            });
                          }}
                          className={selectCls}
                        >
                          {categories.filter(c => c !== 'ALL').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* ── Composition ── */}
                      {formData.category.primaryCategory !== 'Surgical & Consumables' &&
                      formData.category.primaryCategory !== 'Medical Devices' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Composition </label>
                          <Input
                            required
                            value={formData.composition}
                            onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                            placeholder="e.g. Acetaminophen"
                          />
                        </div>
                      )}

                      {/* ── Therapeutic Class ── */}
                      {!isSpecialCat &&
                      formData.category.primaryCategory !== 'Surgical & Consumables' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Therapeutic Class</label>
                          <Input
                            value={formData.category.therapeuticClass}
                            onChange={(e) => setFormData({ ...formData, category: { ...formData.category, therapeuticClass: e.target.value } })}
                            placeholder="e.g. Analgesic"
                          />
                        </div>
                      )}

                      {/* ── Dosage Form (hidden for Medical Devices / Personal Care / FMCG) ── */}
                      {!isSpecialCat && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
                          <select
                            value={formData.category.dosageForm}
                            onChange={(e) => {
                              const form   = e.target.value;
                              const newCfg = DOSAGE_FORM_CONFIG[form];
                              setFormData({
                                ...formData,
                                category: { ...formData.category, dosageForm: form },
                                // Pre-fill packSizeUnit with the form's default
                                packaging: {
                                  ...formData.packaging,
                                  packSizeUnit: newCfg?.defaultUnit || (formData.packaging as any).packSizeUnit || '',
                                } as any
                              });
                            }}
                            className={selectCls}
                          >
                            <option value="">-- Select Dosage Form --</option>
                            {dosageFormLabels.map(label => <option key={label} value={label}>{label}</option>)}
                          </select>
                        </div>
                      )}

                      {/* ── Stock ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Packs)</label>
                        <Input
                          type="number" min="0"
                          value={formData.stock.packsAvailable ?? ''}
                          onChange={(e) => setFormData({ ...formData, stock: { ...formData.stock, packsAvailable: e.target.value ? Number(e.target.value) : undefined } })}
                          placeholder="e.g. 150"
                        />
                      </div>

                      {/* ── Threshold ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                        <Input
                          type="number" min="0"
                          value={formData.stock.threshold ?? ''}
                          onChange={(e) => setFormData({ ...formData, stock: { ...formData.stock, threshold: e.target.value ? Number(e.target.value) : undefined } })}
                          placeholder="e.g. 20"
                        />
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        PACKAGING SECTION
                        Fields are rendered conditionally based on the dosage
                        form's fieldType from DOSAGE_FORM_CONFIG.
                    ══════════════════════════════════════════════════════════ */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">
                        Packaging Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* ── packSize: Syrup / Injection / Cream / Ointment / … ── */}
                        {fieldType === 'packSize' && !isSpecialCat && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Pack Size
                                <span className="ml-1 text-gray-400 font-normal">
                                  ({cfg?.container || 'container'})
                                </span>
                              </label>
                              <div className="flex gap-2">
                                <Input
                                  type="number" min="0" step="0.1"
                                  value={(formData.packaging as any).packSize ?? ''}
                                  onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packSize: e.target.value ? Number(e.target.value) : undefined } as any })}
                                  placeholder="e.g. 100"
                                  className="flex-1"
                                />
                                <select
                                  value={(formData.packaging as any).packSizeUnit || cfg?.defaultUnit || 'ml'}
                                  onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packSizeUnit: e.target.value } as any })}
                                  className="px-3 py-2 border border-gray-300 rounded-md text-sm w-24"
                                >
                                  <option value="ml">ml</option>
                                  <option value="g">g</option>
                                  <option value="doses">doses</option>
                                  <option value="mg">mg</option>
                                  <option value="L">L</option>
                                </select>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Size of one {cfg?.container?.toLowerCase() || 'container'}
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {cfg?.container || 'Packs'} per Box
                                <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                              </label>
                              <Input
                                type="number" min="0"
                                value={formData.packaging.packsPerBox ?? ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packsPerBox: e.target.value ? Number(e.target.value) : undefined } })}
                                placeholder="e.g. 6"
                              />
                            </div>
                          </>
                        )}

                        {/* ── packsOnly: Sachet, Gloves, Mask ── */}
                        {fieldType === 'packsOnly' && !isSpecialCat && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {cfg?.packsLabel || 'Packs per Box'}
                            </label>
                            <Input
                              type="number" min="0"
                              value={formData.packaging.packsPerBox ?? ''}
                              onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packsPerBox: e.target.value ? Number(e.target.value) : undefined } })}
                              placeholder="e.g. 6"
                            />
                          </div>
                        )}

                        {/* ── units+packs: Tablet / Capsule / Other (also used when no dosage form selected or special category) ── */}
                        {(fieldType === 'units+packs' || !formData.category.dosageForm || isSpecialCat) && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {cfg?.unitLabel || 'Units per Pack / Unit Size'}
                              </label>
                              <Input
                                type="number" min="0"
                                value={formData.packaging.unitsPerPack ?? ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, unitsPerPack: e.target.value ? Number(e.target.value) : undefined } })}
                                placeholder="e.g. 10"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {cfg?.packsLabel || 'Packs per Box'}
                              </label>
                              <Input
                                type="number" min="0"
                                value={formData.packaging.packsPerBox ?? ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packsPerBox: e.target.value ? Number(e.target.value) : undefined } })}
                                placeholder="e.g. 10"
                              />
                            </div>
                          </>
                        )}

                        {/* ── Auto-generated Quantity Description ── */}
                        {!isFMCG && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quantity Description
                              {showQtyPreview && (
                                <span className="ml-2 text-xs text-orange-600 font-normal">
                                  (auto-preview: {qtyPreview})
                                </span>
                              )}
                            </label>
                            <Input
                              value={''}
                              
                              placeholder={showQtyPreview ? qtyPreview : 'e.g. Strip of 10 tablets, Bottle of 100ml'}
                            />
                            <p className="text-xs text-gray-400 mt-1">Leave blank to use the auto-generated description above.</p>
                          </div>
                        )}

                        {/* ── Purchase Options ── */}
                        <div className="md:col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Purchase Options
                              <span className="ml-2 text-xs text-gray-400 font-normal">(e.g. Box × 1, Pack × 5)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  packaging: {
                                    ...formData.packaging,
                                    purchase: [
                                      ...(formData.packaging.purchase || []),
                                      { orderUnit: 'pack', minimumOrderQuantity: undefined },
                                    ],
                                  },
                                })
                              }
                              className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Tier
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(formData.packaging.purchase || []).map((tier: any, idx: number) => (
                              <div key={idx} className="flex gap-3 items-center">
                                <select
                                  value={tier.orderUnit}
                                  onChange={(e) => {
                                    const updated = [...formData.packaging.purchase];
                                    updated[idx] = { ...updated[idx], orderUnit: e.target.value };
                                    setFormData({ ...formData, packaging: { ...formData.packaging, purchase: updated } });
                                  }}
                                  className="px-3 py-2 border border-gray-300 rounded-md text-sm w-36"
                                >
                                  <option value="box">Box</option>
                                  <option value="pack">Pack</option>
                                </select>

                                <Input
                                  type="number" min="1"
                                  placeholder="Min. Order Qty"
                                  value={tier.minimumOrderQuantity ?? ''}
                                  onChange={(e) => {
                                    const updated = [...formData.packaging.purchase];
                                    updated[idx] = { ...updated[idx], minimumOrderQuantity: e.target.value ? Number(e.target.value) : undefined };
                                    setFormData({ ...formData, packaging: { ...formData.packaging, purchase: updated } });
                                  }}
                                  className="w-40"
                                />

                                <span className="text-xs text-gray-400 shrink-0">min qty</span>

                                {(formData.packaging.purchase || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = formData.packaging.purchase.filter((_: any, i: number) => i !== idx);
                                      setFormData({ ...formData, packaging: { ...formData.packaging, purchase: updated } });
                                    }}
                                    className="text-red-400 hover:text-red-600 ml-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Each row is one purchasable unit type buyers can order.</p>
                        </div>

                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        PRICING SECTION
                    ══════════════════════════════════════════════════════════ */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">Pricing</h3>
                      {(() => {
                        const purchaseUnits = new Set((formData.packaging.purchase || []).map((p: any) => p.orderUnit));
                        const showPack = purchaseUnits.has('pack');
                        const showBox  = purchaseUnits.has('box');

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* ── Pack pricing ── */}
                            {(showPack || (!showPack && !showBox)) && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Price <span className="text-gray-400 font-normal">(₹ per pack)</span>
                                  </label>
                                  <Input
                                    type="number" min="0" step="0.01"
                                    value={formData.packaging.price ?? ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, price: e.target.value ? Number(e.target.value) : undefined } })}
                                    placeholder="e.g. 82.50"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    MRP <span className="text-gray-400 font-normal">(₹ per pack)</span>
                                  </label>
                                  <Input
                                    type="number" min="0" step="0.01"
                                    value={formData.packaging.mrpPerPack ?? ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, mrpPerPack: e.target.value ? Number(e.target.value) : undefined } })}
                                    placeholder="e.g. 117.85"
                                  />
                                </div>
                              </>
                            )}

                            {/* ── Box pricing ── */}
                            {showBox && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Price <span className="text-gray-400 font-normal">(₹ per box)</span>
                                  </label>
                                  <Input
                                    type="number" min="0" step="0.01"
                                    value={(formData.packaging as any).pricePerBox ?? ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, pricePerBox: e.target.value ? Number(e.target.value) : undefined } as any })}
                                    placeholder="e.g. 825.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    MRP <span className="text-gray-400 font-normal">(₹ per box)</span>
                                  </label>
                                  <Input
                                    type="number" min="0" step="0.01"
                                    value={(formData.packaging as any).mrpPerBox ?? ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, mrpPerBox: e.target.value ? Number(e.target.value) : undefined } as any })}
                                    placeholder="e.g. 1178.50"
                                  />
                                </div>
                              </>
                            )}

                            {/* ── Discount & GST (always visible) ── */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                              <Input
                                type="number" min="0" max="100" step="0.01"
                                value={formData.packaging.discountPercent ?? ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, discountPercent: e.target.value ? Number(e.target.value) : undefined } })}
                                placeholder="e.g. 30"
                              />
                            </div>

                            {gstRegistered && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
                                  <select
                                    value={(formData.packaging as any).gstRate || ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, gstRate: e.target.value ? Number(e.target.value) : undefined } as any })}
                                    className={selectCls}
                                  >
                                    <option value="">-- Select GST Rate --</option>
                                    {[0, 5, 12, 18, 28].map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                  <Input
                                    value={(formData.packaging as any).hsnCode || ''}
                                    onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, hsnCode: e.target.value } as any })}
                                    placeholder="e.g. 3004"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {/* ══════════════════════════════════════════════════════════
                        SCHEME
                    ══════════════════════════════════════════════════════════ */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1 border-b pb-1">
                        Scheme <span className="normal-case font-normal text-gray-400">(Buy X Get Y Free — optional)</span>
                      </h3>

                      {(toNum(formData.packaging.scheme?.buyQty) > 0 || toNum(formData.packaging.scheme?.freeQty) > 0) && (
                        <div className="mt-2 mb-3 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 font-medium">
                          🎁 Buy {formData.packaging.scheme.buyQty || '?'} {formData.packaging.scheme.buyUnit}(s) → Get {formData.packaging.scheme.freeQty || '?'} {formData.packaging.scheme.freeUnit}(s) Free
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Buy Qty</label>
                          <Input
                            type="number" min="0"
                            value={formData.packaging.scheme?.buyQty ?? ''}
                            onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, scheme: { ...formData.packaging.scheme, buyQty: e.target.value ? Number(e.target.value) : undefined } } })}
                            placeholder="e.g. 10"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Buy Unit</label>
                          <select value={formData.packaging.scheme?.buyUnit || 'pack'} onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, scheme: { ...formData.packaging.scheme, buyUnit: e.target.value } } })} className={selectCls}>
                            <option value="pack">Pack</option>
                            <option value="box">Box</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Free Qty</label>
                          <Input
                            type="number" min="0"
                            value={formData.packaging.scheme?.freeQty ?? ''}
                            onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, scheme: { ...formData.packaging.scheme, freeQty: e.target.value ? Number(e.target.value) : undefined } } })}
                            placeholder="e.g. 1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Free Unit</label>
                          <select value={formData.packaging.scheme?.freeUnit || 'pack'} onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, scheme: { ...formData.packaging.scheme, freeUnit: e.target.value } } })} className={selectCls}>
                            <option value="pack">Pack</option>
                            <option value="box">Box</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        DATES & STORAGE
                    ══════════════════════════════════════════════════════════ */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">Dates &amp; Storage</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturing Date</label>
                          <Input type="date" value={formData.manufacturedDate} onChange={(e) => setFormData({ ...formData, manufacturedDate: e.target.value })} />
                        </div>

                        {isMedDevice ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty (Years)</label>
                            <Input type="number" min="0" value={formData.warranty || ''} onChange={(e) => setFormData({ ...formData, warranty: e.target.value })} placeholder="e.g. 2" />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                            <Input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Storage Condition</label>
                          <Input value={formData.storageCondition || ''} onChange={(e) => setFormData({ ...formData, storageCondition: e.target.value })} placeholder="e.g. Store below 25°C in cool, dry place" />
                        </div>
                      </div>
                    </div>

                    {/* ── Description ── */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Additional details about the medicine"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    </div>

                    {/* ── Prescription Checkbox ── */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="prescriptionRequired"
                        checked={formData.prescriptionRequired || false}
                        onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="prescriptionRequired" className="text-sm font-medium text-gray-700 cursor-pointer">Prescription Required</label>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="flex gap-3 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => { resetForm(); setShowAddModal(false); setEditingMedicine(undefined); }}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
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

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => { setShowViewModal(false); resetForm(); }}
          />
          <div className="relative bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-scaleIn">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-bold tracking-tight text-emerald-700">Medicine Details</h2>
              <button onClick={() => { setShowViewModal(false); resetForm(); }}>
                <X className="w-5 h-5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-8 text-sm">
              <img
                src={getImageUrl(imagePreview || formData.productImageURL)}
                alt="Medicine"
                className="w-[clamp(400px,80vw,600px)] h-[clamp(200px,60vh,400px)] object-contain mx-auto mb-4"
              />

              {/* Basic Info */}
              <div>
                <p className="text-xs font-bold uppercase text-blue-600 mb-3">Basic Info</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Name"         value={formData.medicineName} />
                  <Info label="Product ID"   value={formData.productID} />
                  {formData.category?.therapeuticClass && (
                  <Info label="Composition"  value={formData.composition} />
                  )}
                  <Info label="Manufacturer" value={formData.manufacturer} />
                  <Info label="Batch Code"   value={formData.batchCode} />
                  <Info
                    label="Prescription"
                    value={
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formData.prescriptionRequired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {formData.prescriptionRequired ? 'Required' : 'Not Required'}
                      </span>
                    }
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="text-xs font-bold uppercase text-purple-600 mb-3">Category</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Primary"           value={formData.category?.primaryCategory} />
                 {formData.category?.therapeuticClass && (
                  <Info
                    label="Therapeutic Class"
                    value={formData.category.therapeuticClass}
                  />
                )}
                  {!['Medical Devices', 'Personal Care & Wellness', 'FMCG'].includes(formData.category?.primaryCategory) && (
                    <Info label="Dosage Form" value={formData.category?.dosageForm} />
                  )}
                </div>
              </div>

              {/* Stock */}
              <div>
                <p className="text-xs font-bold uppercase text-amber-600 mb-3">Stock</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Packs Available" value={formData.stock?.packsAvailable} />
                  {toNum(formData.packaging?.packsPerBox) > 0 && (
                    <Info
                      label="Boxes Available"
                      value={Math.floor((formData.stock?.packsAvailable || 0) / toNum(formData.packaging.packsPerBox))}
                    />
                  )}
                  <Info label="Low Stock Threshold" value={formData.stock?.threshold ? `${formData.stock.threshold} packs` : '—'} />
                </div>
              </div>

              {/* Packaging */}
              <div>
                <p className="text-xs font-bold uppercase text-rose-800 mb-3">Packaging</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quantity Description tile */}
                  <div className="md:col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-orange-500 mb-1">Quantity Description</p>
                    <p className="font-semibold text-gray-900">
                      {
                        (formData.category?.dosageForm
                          ? getQuantityDescription(
                              formData.category.dosageForm,
                              toNum(formData.packaging?.unitsPerPack),
                              toNum(formData.packaging?.packsPerBox),
                              toNum((formData.packaging as any)?.packSize) || undefined,
                              (formData.packaging as any)?.packSizeUnit
                            )
                          : '—')}
                    </p>
                  </div>

                  {/* Field-type-specific tiles */}
                  {(() => {
                    const vCfg = DOSAGE_FORM_CONFIG[formData.category?.dosageForm || ''];
                    const vFt  = vCfg?.fieldType;

                    if (vFt === 'packSize') {
                      const ps   = toNum((formData.packaging as any)?.packSize);
                      const psu  = (formData.packaging as any)?.packSizeUnit || vCfg?.defaultUnit || 'ml';
                      const ppb  = toNum(formData.packaging?.packsPerBox);
                      return (
                        <>
                          <Info
                            label={`Pack Size`}
                            value={ps > 0 ? `${ps} ${psu}` : '—'}
                          />
                          {ppb > 0 && (
                            <Info label={`${vCfg?.container || 'Packs'}`} value={ppb} />
                          )}
                        </>
                      );
                    }
                    if (vFt === 'packsOnly') {
                      return (
                        <Info
                          label={vCfg?.packsLabel || 'Packs per Box'}
                          value={toNum(formData.packaging?.packsPerBox) > 0 ? toNum(formData.packaging.packsPerBox) : '—'}
                        />
                      );
                    }
                    
                    // units+packs / fallback
                    return (
                      <>
                        <Info label="Units per Pack" value={toNum(formData.packaging?.unitsPerPack) > 0 ? toNum(formData.packaging.unitsPerPack) : '—'} />
                        <Info label="Packs per Box"  value={toNum(formData.packaging?.packsPerBox)  > 0 ? toNum(formData.packaging.packsPerBox)  : '—'} />
                      </>
                    );
                  })()}

                  {/* Purchase Options */}
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 mb-2">Purchase Options</p>
                    {(formData.packaging?.purchase || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {(formData.packaging.purchase as any[]).map((p: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs font-semibold text-orange-700">
                            Min {p.minimumOrderQuantity ?? 1} {p.orderUnit}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-bold uppercase text-emerald-600 mb-3">Pricing</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {toNum(formData.packaging?.price) > 0 && (
                    <Info label="Price (per pack)" value={`₹ ${toNum(formData.packaging.price).toFixed(2)}`} />
                  )}
                  {toNum(formData.packaging?.mrpPerPack) > 0 && (
                    <Info label="MRP (per pack)"   value={`₹ ${toNum(formData.packaging.mrpPerPack).toFixed(2)}`} />
                  )}
                  {toNum((formData.packaging as any)?.pricePerBox) > 0 && (
                    <Info label="Price (per box)"  value={`₹ ${toNum((formData.packaging as any).pricePerBox).toFixed(2)}`} />
                  )}
                  {toNum((formData.packaging as any)?.mrpPerBox) > 0 && (
                    <Info label="MRP (per box)"    value={`₹ ${toNum((formData.packaging as any).mrpPerBox).toFixed(2)}`} />
                  )}
                  {toNum(formData.packaging?.discountPercent) > 0 && (
                    <Info label="Discount"         value={`${toNum(formData.packaging.discountPercent)}%`} />
                  )}
                  <Info label="GST Rate" value={(formData.packaging as any)?.gstRate != null ? `${(formData.packaging as any).gstRate}%` : '—'} />
                  <Info label="HSN Code" value={(formData.packaging as any)?.hsnCode || '—'} />
                </div>
              </div>

              {/* Scheme */}
              {(toNum(formData.packaging?.scheme?.buyQty) > 0 || toNum(formData.packaging?.scheme?.freeQty) > 0) && (
                <div>
                  <p className="text-xs font-bold uppercase text-violet-600 mb-3">Scheme</p>
                  <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-lg text-sm font-medium text-violet-800">
                    🎁 Buy{' '}
                    <span className="font-bold">{toNum(formData.packaging.scheme.buyQty)} {formData.packaging.scheme.buyUnit}(s)</span>
                    {' '}→ Get{' '}
                    <span className="font-bold">{toNum(formData.packaging.scheme.freeQty)} {formData.packaging.scheme.freeUnit}(s)</span>
                    {' '}free
                  </div>
                </div>
              )}

              {/* Dates */}
              <div>
                <p className="text-xs font-bold uppercase text-rose-600 mb-3">Dates</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Manufactured" value={formatDateForDisplay(formData.manufacturedDate)} />
                  {formData.category?.primaryCategory === 'Medical Devices'
                    ? <Info label="Warranty"   value={formData.warranty ? `${formData.warranty} year(s)` : '—'} />
                    : <Info label="Expiry"     value={formatDateForDisplay(formData.expiryDate)} />
                  }
                  <Info label="Last Updated" value={formatDateForDisplay(formData.lastUpdated)} />
                </div>
              </div>

              {/* Storage */}
              <div>
                <p className="text-xs font-bold uppercase text-cyan-600 mb-3">Storage</p>
                <Info label="Condition" value={formData.storageCondition} />
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-bold uppercase text-gray-600 mb-2">Description</p>
                <div className="bg-gray-50 rounded-lg p-3 text-justify text-gray-700">{formData.description || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}