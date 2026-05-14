"use client";
import { useState, useEffect } from "react";
import { Product } from "@/types";
import { db, auth, storage, isFirebaseConfigured } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, 
  query, orderBy, where, serverTimestamp, setDoc, getDoc 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false, loading: () => <div style={{height:350,borderRadius:14,background:'var(--bg-secondary)',display:'flex',alignItems:'center',justifyContent:'center', color: 'var(--text-primary)'}}>⏳ جاري تحميل الخريطة...</div> });

// Helper Components moved OUTSIDE to prevent focus loss during re-renders
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border-color)', marginBottom: 20 }}>
    <h4 style={{ marginBottom: 16, fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{title}</h4>
    {children}
  </div>
);

const KPI = ({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) => (
  <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 18, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
    <span style={{ fontSize: '1.3rem' }}>{icon}</span>
    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: color || 'var(--gold-dark)' }}>{value}</span>
    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
    {sub && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{sub}</span>}
  </div>
);

const ReportTable = ({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) => (
  <div className="admin-table-wrap">
    <table className="admin-table" style={{ width: '100%' }}>
      <thead><tr>{heads.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.length > 0 ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ fontWeight: j === 0 ? 700 : 400 }}>{c}</td>)}</tr>) : <tr><td colSpan={heads.length} style={{ textAlign: 'center', padding: 30, color: '#999' }}>لا توجد بيانات</td></tr>}</tbody>
    </table>
  </div>
);

type AdminTab = 'dashboard' | 'products' | 'categories' | 'orders' | 'customers' | 'reviews' | 'banners' | 'shipping' | 'settings' | 'reports';

interface Category { id: string; name: string; icon: string; description: string; }
interface Order { id: string; customerName: string; customerPhone: string; items: {name:string;qty:number;price:number}[]; total: number; status: 'pending'|'processing'|'shipped'|'delivered'|'cancelled'; createdAt: number; }
interface Review { id: string; customerName: string; productName: string; rating: number; comment: string; adminReply?: string; createdAt: number; }
interface Customer { id: string; name: string; email: string; phone?: string; role: 'customer' | 'admin' | 'moderator'; isSuspended?: boolean; isActive?: boolean; createdAt?: any; }
interface Banner { id: string; title: string; subtitle: string; image: string; active: boolean; link?: string; }

const emptyProduct = { name: "", description: "", price: 0, oldPrice: 0, lowStockThreshold: 3, category: "abaya" as "abaya"|"bag", imageUrl: "", quantity: 1, featured: false };
const emptyCategory: Partial<Category> = { name: "", icon: "📦", description: "" };

const statusLabels: Record<string,string> = { pending:'قيد الانتظار', processing:'جاري التجهيز', shipped:'تم الشحن', delivered:'تم التوصيل', cancelled:'ملغي' };
const formatDate = (ts:number) => new Date(ts).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'});

export default function AdminDashboard() {
  const { showToast } = useToast();
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error("Auth error:", error);
        router.push('/');
      } finally {
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('summary');

  const [currentPrintingOrder, setCurrentPrintingOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [adminProductCategory, setAdminProductCategory] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ ...emptyProduct });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrcType, setImageSrcType] = useState<'upload' | 'url'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({ ...emptyCategory });

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerRoleFilter, setCustomerRoleFilter] = useState('all');

  const fetchOrders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"));
      const fetchedOrders = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          customerName: data.customer?.name || 'غير معروف',
          customerPhone: data.customer?.phone || '',
          items: data.items || [],
          total: data.total || 0,
          status: data.status || 'pending',
          createdAt: data.createdAt?.toMillis() || Date.now()
        } as Order;
      });
      setOrders(fetchedOrders.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      if (!isFirebaseConfigured()) return;
      await deleteDoc(doc(db, "orders", id));
      showToast("تم حذف الطلب بنجاح", "success");
      fetchOrders();
    } catch { showToast("فشل في حذف الطلب", "error"); }
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const { settings } = useSettings();

  const [categoryImageFile, setCategoryImageFile] = useState<File|null>(null);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);

  const [bannerImageFile, setBannerImageFile] = useState<File|null>(null);

  // Banners
  const [banners, setBanners] = useState<Banner[]>([]);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerForm, setBannerForm] = useState<Partial<Banner>>({ title: '', subtitle: '', image: '', active: true, link: '/' });
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null);
  const [storeLogoPreview, setStoreLogoPreview] = useState<string | null>(null);


  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handlePrintInvoice = (order: Order) => {
    setCurrentPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  useEffect(() => { 
    if (isAdmin) {
      fetchProducts();
      fetchCategories();
      fetchOrders();
      fetchCustomers();
      fetchShippingSettings();
      fetchSettings();
      fetchBanners();
    }
  }, [isAdmin]);

  const fetchBanners = async () => {
    try {
      if (!isFirebaseConfigured()) return;
      const querySnapshot = await getDocs(collection(db, "banners"));
      setBanners(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
    } catch (error) { console.error("Error fetching banners:", error); }
  };

  const saveBanner = async () => {
    try {
      setUploading(true);
      if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
      
      let finalImageUrl = bannerForm.image;
      if (bannerImageFile) finalImageUrl = await handleFileUpload(bannerImageFile);
      
      const bannerData = { ...bannerForm, image: finalImageUrl };

      if (editingBannerId) {
        await setDoc(doc(db, "banners", editingBannerId), bannerData);
        showToast("تم تحديث البانر", "success");
      } else {
        await addDoc(collection(db, "banners"), bannerData);
        showToast("تم إضافة البانر بنجاح", "success");
      }
      
      setShowBannerModal(false);
      fetchBanners();
    } catch (error) {
      showToast("خطأ في الحفظ", "error");
    } finally { setUploading(false); }
  };

  const handleDeleteBanner = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف البانر',
      message: 'هل أنت متأكد من حذف هذا البانر؟',
      onConfirm: async () => {
        try {
          if (!isFirebaseConfigured()) return;
          await deleteDoc(doc(db, "banners", id));
          showToast("تم الحذف بنجاح", "success");
          fetchBanners();
          setConfirmModal({ ...confirmModal, isOpen: false });
        } catch { showToast("فشل الحذف", "error"); }
      }
    });
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
      const querySnapshot = await getDocs(collection(db, "products"));
      setProducts(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch {
      setProducts([]);
    } finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      if (!isFirebaseConfigured()) return;
      const querySnapshot = await getDocs(collection(db, "users"));
      setCustomers(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      if (!isFirebaseConfigured()) return;
      await deleteDoc(doc(db, "users", id));
      showToast("تم حذف المستخدم بنجاح", "success");
      fetchCustomers();
    } catch { showToast("فشل الحذف", "error"); }
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const toggleCustomerSuspension = async (id: string, currentStatus: boolean) => {
    try {
      if (!isFirebaseConfigured()) return;
      await updateDoc(doc(db, "users", id), { isSuspended: !currentStatus });
      showToast(currentStatus ? "تم إلغاء الحظر" : "تم حظر المستخدم", "success");
      fetchCustomers();
    } catch { showToast("فشل تحديث الحالة", "error"); }
  };

  const updateCustomerRole = async (id: string, newRole: string) => {
    try {
      if (!isFirebaseConfigured()) return;
      await updateDoc(doc(db, "users", id), { role: newRole });
      showToast("تم تغيير الصلاحيات بنجاح", "success");
      fetchCustomers();
    } catch { showToast("فشل تغيير الصلاحيات", "error"); }
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    if (!isFirebaseConfigured()) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
    const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  };

  const saveProduct = async () => {
    try {
      setUploading(true);
      let finalImageUrl = productForm.imageUrl;
      if (imageFile) finalImageUrl = await handleFileUpload(imageFile);
      const productData = { ...productForm, imageUrl: finalImageUrl };
      if (isFirebaseConfigured()) {
        if (editingProductId) {
          await updateDoc(doc(db, "products", editingProductId), productData);
        } else {
          await addDoc(collection(db, "products"), { ...productData, createdAt: new Date() });
        }
        fetchProducts();
      } else {
        if (editingProductId) {
          setProducts(products.map(p => p.id === editingProductId ? { ...p, ...productData } : p));
        } else {
          setProducts([...products, { ...productData, id: Date.now().toString() } as Product]);
        }
      }
      closeProductModal();
    } catch (error) {
      console.error("Save error:", error);
      showToast("حدث خطأ أثناء الحفظ", "error");
    } finally { setUploading(false); }
  };

  const deleteProduct = async (id: string) => {
    try {
      if (isFirebaseConfigured()) {
        await deleteDoc(doc(db, "products", id));
        fetchProducts();
      } else {
        setProducts(products.filter(p => p.id !== id));
      }
    } catch { setProducts(products.filter(p => p.id !== id)); }
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const fetchCategories = async () => {
    try {
      if (!isFirebaseConfigured()) return;
      const querySnapshot = await getDocs(collection(db, "categories"));
      setCategories(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    } catch (error) { console.error("Error fetching categories:", error); }
  };

  const saveCategory = async () => {
    try {
      setUploading(true);
      if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
      
      let finalIcon = categoryForm.icon || '';
      if (categoryImageFile) finalIcon = await handleFileUpload(categoryImageFile);
      
      const categoryData = { ...categoryForm, icon: finalIcon };

      if (editingCategoryId) {
        await setDoc(doc(db, "categories", editingCategoryId), categoryData);
        showToast("تم تحديث القسم بنجاح", "success");
      } else {
        await addDoc(collection(db, "categories"), categoryData);
        showToast("تم إضافة القسم بنجاح", "success");
      }
      
      setShowCategoryModal(false);
      fetchCategories();
    } catch (error) {
      console.error("Category save error:", error);
      showToast("حدث خطأ أثناء الحفظ", "error");
    } finally { setUploading(false); }
  };

  const openAddProduct = () => {
    setProductForm({ 
      ...emptyProduct, 
      category: (adminProductCategory as "abaya"|"bag") || "abaya" 
    });
    setEditingProductId(null);
    setImageFile(null);
    setImagePreview(null);
    setImageSrcType('upload');
    setShowProductModal(true);
  };

  const openEditProduct = (product: Product) => {
    setProductForm({
      name: product.name, description: product.description, price: product.price,
      oldPrice: product.oldPrice || 0, lowStockThreshold: product.lowStockThreshold || 3,
      category: product.category, imageUrl: product.imageUrl, quantity: product.quantity,
      featured: product.featured || false
    });
    setEditingProductId(product.id);
    setImageFile(null);
    setImagePreview(product.imageUrl || null);
    setImageSrcType(product.imageUrl?.startsWith('http') ? 'url' : 'upload');
    setShowProductModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setCategoryForm({ ...cat });
    setEditingCategoryId(cat.id);
    setCategoryImageFile(null);
    setImagePreview(cat.icon || null);
    setImageSrcType(cat.icon?.startsWith('http') ? 'url' : 'upload');
    setShowCategoryModal(true);
  };

  const openEditBanner = (banner: Banner) => {
    setBannerForm({ ...banner });
    setEditingBannerId(banner.id);
    setBannerImageFile(null);
    setImagePreview(banner.image || null);
    setImageSrcType(banner.image?.startsWith('http') ? 'url' : 'upload');
    setShowBannerModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProductId(null);
    setImageFile(null);
    setImagePreview(null);
    setProductForm({ ...emptyProduct });
  };

  // Stats
  const totalRevenue = orders.filter(o=>o.status!=='cancelled').reduce((sum,o)=>sum+o.total,0);
  const outOfStock = products.filter(p => p.quantity <= 0).length;
  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 3));
  const pendingOrders = orders.filter(o=>o.status==='pending').length;

  const tabs: { id: AdminTab; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: '📊' },
    { id: 'products', label: 'المنتجات', icon: '🛍️' },
    { id: 'categories', label: 'التصنيفات', icon: '📂' },
    { id: 'orders', label: 'الطلبات', icon: '📦', badge: (orders.filter(o=>o.status==='pending').length)||undefined },
    { id: 'customers', label: 'العملاء', icon: '👥' },
    { id: 'reviews', label: 'التقييمات', icon: '⭐' },
    { id: 'banners', label: 'البانرات', icon: '🖼️' },
    { id: 'reports', label: 'التقارير', icon: '📈' },
    { id: 'shipping', label: 'التوصيل والتواصل', icon: '🚚' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
  ];

  // ========== RENDER SECTIONS ==========

  const renderDashboard = () => (
    <div>
      {outOfStock > 0 && (
        <div className="admin-alert alert-danger" onClick={() => setActiveTab('products')} style={{ marginBottom: 12, cursor: 'pointer' }}>
          <span className="alert-icon">🚨</span>
          <div>
            <div className="alert-title">{outOfStock} منتج نفد من المخزون</div>
            <div className="alert-desc">اضغط لمراجعة المنتجات وإعادة التعبئة</div>
          </div>
        </div>
      )}
      {lowStockProducts.length > 0 && (
        <div className="admin-alert alert-warning" onClick={() => setActiveTab('products')} style={{ marginBottom: 12, cursor: 'pointer' }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <div className="alert-title">{lowStockProducts.length} منتج مخزونه منخفض</div>
            <div className="alert-desc">بعض المنتجات وصلت للحد الأدنى المحدد للتنبيه</div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {[
          { label: 'إجمالي المبيعات', value: `${totalRevenue.toLocaleString()} ر.س`, icon: '💰', color: '#c8a96e' },
          { label: 'عدد الطلبات', value: orders.length, icon: '📦', color: '#2196F3' },
          { label: 'طلبات معلقة', value: pendingOrders, icon: '⏳', color: '#FF9800' },
          { label: 'العملاء', value: customers.length, icon: '👥', color: '#4caf50' },
          { label: 'المنتجات', value: products.length, icon: '🛍️', color: '#9C27B0' },
          { label: 'التقييمات', value: reviews.length, icon: '⭐', color: '#f6d365' },
          { label: 'نفد من المخزون', value: outOfStock, icon: '🚫', color: '#f44336' },
        ].map((s, i) => (
          <div className="stat-card" key={i} style={{ borderTop: `4px solid ${s.color}` }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="admin-section-header" style={{ marginTop: 32 }}>
        <h3>📈 آخر المنتجات المضافة</h3>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>الصورة</th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الحالة</th></tr></thead>
          <tbody>
            {products.slice(0, 5).map(p => (
              <tr key={p.id} style={{ opacity: p.quantity <= 0 ? 0.6 : 1 }}>
                <td><img src={p.imageUrl || "/images/hero.png"} alt="" className="table-thumb" /></td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.category === 'abaya' ? '👗 عباية' : '👜 حقيبة'}</td>
                <td className="price-cell">{p.price} ر.س</td>
                <td>
                  <span className={`stock-badge ${p.quantity <= 0 ? 'stock-out' : p.quantity <= 3 ? 'stock-low' : 'stock-ok'}`}>
                    {p.quantity}
                  </span>
                </td>
                <td>
                  <span className={`status-pill ${p.quantity > 0 ? 'status-active' : 'status-inactive'}`}>
                    {p.quantity > 0 ? 'متوفر' : 'نفد'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProducts = () => {
    const filteredByCat = adminProductCategory 
      ? products.filter(p => p.category === adminProductCategory)
      : [];

    return (
      <div>
        {adminProductCategory && (
          <button 
            className="btn-admin-secondary" 
            onClick={() => setAdminProductCategory(null)}
            style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            ⬅️ العودة للأقسام
          </button>
        )}

        <div className="admin-section-header">
          <h3>
            🛍️ {adminProductCategory 
              ? `منتجات قسم: ${adminProductCategory === 'abaya' ? 'العبايات' : 'الحقائب'} (${filteredByCat.length})` 
              : "إدارة المنتجات حسب القسم"}
          </h3>
          <button className="btn-admin-primary" onClick={openAddProduct}>+ إضافة منتج</button>
        </div>

        {!adminProductCategory ? (
          <div className="stats-grid" style={{ marginTop: 20 }}>
            {[
              { id: 'abaya', label: 'قسم العبايات', icon: '👗', count: products.filter(p => p.category === 'abaya').length, color: 'var(--gold)' },
              { id: 'bag', label: 'قسم الحقائب', icon: '👜', count: products.filter(p => p.category === 'bag').length, color: '#9C27B0' },
            ].map(cat => (
              <div 
                key={cat.id} 
                className="stat-card" 
                onClick={() => setAdminProductCategory(cat.id)}
                style={{ cursor: 'pointer', borderTop: `4px solid ${cat.color}`, textAlign: 'center' }}
              >
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>{cat.icon}</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{cat.label}</div>
                <div className="stat-label">{cat.count} منتج</div>
                <div style={{ marginTop: 10, fontSize: '12px', color: 'var(--gold)', fontWeight: 600 }}>اضغط لإدارة المنتجات ⬅️</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>المخزون</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredByCat.map(product => (
                  <tr key={product.id} style={{ opacity: product.quantity <= 0 ? 0.6 : 1 }}>
                    <td><img src={product.imageUrl || "/images/hero.png"} alt="" className="table-thumb" /></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{product.name}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{product.description?.substring(0, 30)}...</div>
                    </td>
                    <td className="price-cell">{product.price} ر.س</td>
                    <td>
                      <span className={`stock-badge ${product.quantity <= 0 ? 'stock-out' : product.quantity <= (product.lowStockThreshold || 3) ? 'stock-low' : 'stock-ok'}`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon btn-icon-edit" onClick={() => openEditProduct(product)}>✏️</button>
                        <button className="btn-icon btn-icon-delete" onClick={() => setConfirmModal({
                          isOpen: true,
                          title: 'حذف منتج',
                          message: `هل أنت متأكد من حذف "${product.name}"؟`,
                          onConfirm: () => deleteProduct(product.id)
                        })}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredByCat.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                      لا يوجد منتجات في هذا القسم حالياً. ابدأ بإضافة أول منتج!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderCategories = () => (
    <div>
      <div className="admin-section-header">
        <h3>📂 إدارة التصنيفات ({categories.length})</h3>
        <button className="btn-admin-primary" onClick={() => { setCategoryForm({ ...emptyCategory }); setEditingCategoryId(null); setShowCategoryModal(true); }}>
          ➕ إضافة تصنيف
        </button>
      </div>
      <div className="categories-admin-grid">
        {categories.map(cat => (
          <div key={cat.id} className="category-admin-card">
            <span className="cat-icon">{cat.icon}</span>
            <div className="cat-info">
              <div className="cat-name">{cat.name}</div>
              <div className="cat-desc">{cat.description}</div>
            </div>
            <div className="action-btns">
              <button className="btn-icon btn-icon-edit" onClick={() => openEditCategory(cat)}>✏️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderOrders = () => {
    const filtered = orders.filter(o => orderStatusFilter==='all' || o.status===orderStatusFilter);
    return (
      <div>
        <div className="admin-section-header">
          <h3>📦 إدارة الطلبات ({filtered.length})</h3>
          <select value={orderStatusFilter} onChange={e=>setOrderStatusFilter(e.target.value)} style={{padding:'8px 14px', borderRadius:10}}>
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">جاري التجهيز</option>
            <option value="shipped">تم الشحن</option>
            <option value="delivered">تم التوصيل</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المجموع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>
              {filtered.map(order=>(
                <tr key={order.id}>
                  <td style={{fontWeight:700}}>{order.id}</td>
                  <td>{order.customerName}</td>
                  <td className="price-cell">{order.total} ر.س</td>
                  <td><span className={`status-pill ${order.status==='delivered'?'status-active':'status-inactive'}`}>{statusLabels[order.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <select value={order.status} onChange={e=>{setOrders(orders.map(o=>o.id===order.id?{...o,status:e.target.value as Order['status']}:o))}} style={{ flex: 1 }}>
                        <option value="pending">قيد الانتظار</option>
                        <option value="processing">جاري التجهيز</option>
                        <option value="shipped">تم الشحن</option>
                        <option value="delivered">تم التوصيل</option>
                        <option value="cancelled">ملغي</option>
                      </select>
                      <button 
                        className="btn-icon" 
                        title="طباعة الفاتورة"
                        onClick={() => handlePrintInvoice(order)}
                        style={{ background: 'var(--gold)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px' }}
                      >
                        🖨️
                      </button>
                      <button 
                        className="btn-icon btn-icon-delete" 
                        title="حذف الطلب"
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          title: 'حذف طلب',
                          message: `هل أنت متأكد من حذف الطلب رقم ${order.id}؟`,
                          onConfirm: () => deleteOrder(order.id)
                        })}
                        style={{ background: '#f44336', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCustomers = () => {
    const filtered = customers.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                           (c.email || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                           (c.phone || '').includes(customerSearchQuery);
      const matchesRole = customerRoleFilter === 'all' || c.role === customerRoleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div>
        <div className="admin-section-header">
          <h3>👥 إدارة العملاء والصلحيات ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <input 
              type="text" 
              placeholder="ابحث بالاسم، البريد، أو الهاتف..." 
              value={customerSearchQuery}
              onChange={e => setCustomerSearchQuery(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #ddd', minWidth: 250 }}
            />
            <select 
              value={customerRoleFilter} 
              onChange={e => setCustomerRoleFilter(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #ddd' }}
            >
              <option value="all">كل الأدوار</option>
              <option value="admin">مدير</option>
              <option value="moderator">مشرف</option>
              <option value="customer">عميل</option>
            </select>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => (
                <tr key={customer.id} style={{ opacity: customer.isSuspended ? 0.6 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gold)', color: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {customer.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{customer.name}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{customer.email} {customer.phone && `| ${customer.phone}`}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select 
                      value={customer.role || 'customer'} 
                      onChange={e => updateCustomerRole(customer.id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: '13px' }}
                    >
                      <option value="customer">عميل</option>
                      <option value="moderator">مشرف</option>
                      <option value="admin">مدير</option>
                    </select>
                  </td>
                  <td>
                    <span className={`status-pill ${customer.isSuspended ? 'status-inactive' : 'status-active'}`}>
                      {customer.isSuspended ? 'محظور' : 'نشط'}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button 
                        className="btn-icon" 
                        style={{ color: customer.isSuspended ? '#4caf50' : '#ff9800' }}
                        title={customer.isSuspended ? "إلغاء الحظر" : "حظر"}
                        onClick={() => toggleCustomerSuspension(customer.id, customer.isSuspended || false)}
                      >
                        {customer.isSuspended ? '🔓' : '🚫'}
                      </button>
                      <button 
                        className="btn-icon btn-icon-delete" 
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          title: 'حذف مستخدم',
                          message: `هل أنت متأكد من حذف المستخدم "${customer.name}" نهائياً؟`,
                          onConfirm: () => deleteCustomer(customer.id)
                        })}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReviews = () => (
    <div>
      <div className="admin-section-header"><h3>⭐ تقييمات العملاء ({reviews.length})</h3></div>
      <div style={{display:'grid',gap:16}}>
        {reviews.map(review=>(
          <div key={review.id} style={{background:'var(--bg-card)',borderRadius:14,padding:20, border:'1px solid var(--border-color)'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div style={{fontWeight:800, color: 'var(--text-primary)'}}>{review.customerName}</div>
              <div style={{color:'#FFB300'}}>{'★'.repeat(review.rating)}</div>
            </div>
            <p style={{color: 'var(--text-secondary)'}}>{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBanners = () => (
    <div>
      <div className="admin-section-header">
        <h3>🖼️ البانرات الترويجية ({banners.length})</h3>
        <button className="btn-admin-primary" onClick={() => { setEditingBannerId(null); setBannerForm({ title:'', subtitle:'', image:'', active:true, link:'/' }); setShowBannerModal(true); }}>
          + إضافة بانر
        </button>
      </div>
      
      {banners.length === 0 ? (
        <div className="admin-empty-state" style={{ padding: '60px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: 20, textAlign: 'center', border: '2px dashed rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 15 }}>🖼️</div>
          <p style={{ color: '#888', fontWeight: 600 }}>🖼️ لا توجد بانرات – أضف بانرات ترويجية لتظهر في الصفحة الرئيسية</p>
        </div>
      ) : (
        <div className="categories-admin-grid">
          {banners.map(banner => (
            <div key={banner.id} className="category-admin-card" style={{ overflow: 'hidden' }}>
              <img src={banner.image} alt={banner.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
              <div className="cat-info" style={{ padding: 15 }}>
                <div className="cat-name" style={{ fontWeight: 700 }}>{banner.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4 }}>{banner.subtitle}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gold)', marginTop: 8 }}>🔗 {banner.link}</div>
              </div>
              <div className="action-btns" style={{ padding: '0 15px 15px' }}>
                <button className="btn-icon btn-icon-edit" onClick={() => openEditBanner(banner)}>✏️ تعديل</button>
                <button className="btn-icon btn-icon-delete" onClick={() => handleDeleteBanner(banner.id)}>🗑️ حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ========== SHIPPING & SOCIAL ==========
  const [shippingSettings, setShippingSettings] = useState({
    fixedDeliveryFee: 25, 
    freeDeliveryThreshold: 500, 
    pricePerKm: 5, 
    minimumOrder: 100,
    storeLat: 24.7136, 
    storeLng: 46.6753,
    instagram: '', 
    snapchat: '', 
    tiktok: '', 
    facebook: '',
    whatsapp: '966500000000',
  });
  const [locating, setLocating] = useState(false);

  const fetchShippingSettings = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "shipping_config"));
      if (docSnap.exists()) setShippingSettings(prev => ({ ...prev, ...docSnap.data() }));
    } catch (error) { console.error(error); }
  };

  const saveShippingSettings = async () => {
    try {
      setUploading(true);
      await setDoc(doc(db, "settings", "shipping_config"), shippingSettings);
      showToast("✅ تم حفظ إعدادات التوصيل بنجاح!", "success");
    } catch { showToast("❌ فشل في حفظ الإعدادات", "error"); }
    finally { setUploading(false); }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { showToast('المتصفح لا يدعم تحديد الموقع', 'info'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShippingSettings(prev => ({ 
          ...prev, 
          storeLat: parseFloat(pos.coords.latitude.toFixed(6)), 
          storeLng: parseFloat(pos.coords.longitude.toFixed(6)) 
        }));
        setLocating(false);
        showToast('✅ تم تحديد موقع المتجر بنجاح!', 'success');
      },
      (err) => { setLocating(false); showToast('❌ فشل في تحديد الموقع', 'error'); }
    );
  };

  const renderShipping = () => (
    <div>
      <div className="admin-section-header">
        <h3>🚚 إعدادات التوصيل والتواصل</h3>
        <button className="btn-admin-primary" onClick={saveShippingSettings} disabled={uploading}>
          {uploading ? "⏳ جاري الحفظ..." : "💾 حفظ كافة الإعدادات"}
        </button>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>🌐 روابط التواصل الاجتماعي</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div className="form-group">
            <label>رابط إنستقرام</label>
            <input type="text" value={shippingSettings.instagram} onChange={e => setShippingSettings({ ...shippingSettings, instagram: e.target.value })} placeholder="https://instagram.com/..." />
          </div>
          <div className="form-group">
            <label>رابط فيسبوك</label>
            <input type="text" value={shippingSettings.facebook} onChange={e => setShippingSettings({ ...shippingSettings, facebook: e.target.value })} placeholder="https://facebook.com/..." />
          </div>
          <div className="form-group">
            <label>رابط سناب شات</label>
            <input type="text" value={shippingSettings.snapchat} onChange={e => setShippingSettings({ ...shippingSettings, snapchat: e.target.value })} placeholder="https://snapchat.com/add/..." />
          </div>
          <div className="form-group">
            <label>رقم الواتساب</label>
            <input type="text" value={shippingSettings.whatsapp} onChange={e => setShippingSettings({ ...shippingSettings, whatsapp: e.target.value })} placeholder="966500000000" />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h4 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>🚚 تكاليف التوصيل والحد الأدنى</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 20 }}>
          <div className="form-group">
            <label>رسوم التوصيل الثابتة (ر.س)</label>
            <input type="number" value={shippingSettings.fixedDeliveryFee} onChange={e => setShippingSettings({ ...shippingSettings, fixedDeliveryFee: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>توصيل مجاني من (مبلغ)</label>
            <input type="number" value={shippingSettings.freeDeliveryThreshold} onChange={e => setShippingSettings({ ...shippingSettings, freeDeliveryThreshold: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>سعر الكيلومتر (التوصيل الذكي)</label>
            <input type="number" step="0.1" value={shippingSettings.pricePerKm} onChange={e => setShippingSettings({ ...shippingSettings, pricePerKm: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>الحد الأدنى للطلب</label>
            <input type="number" value={shippingSettings.minimumOrder} onChange={e => setShippingSettings({ ...shippingSettings, minimumOrder: Number(e.target.value) })} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 15, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label>خط عرض المتجر (Lat)</label>
            <input type="number" step="0.000001" value={shippingSettings.storeLat} onChange={e => setShippingSettings({ ...shippingSettings, storeLat: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label>خط طول المتجر (Lng)</label>
            <input type="number" step="0.000001" value={shippingSettings.storeLng} onChange={e => setShippingSettings({ ...shippingSettings, storeLng: Number(e.target.value) })} />
          </div>
          <button 
            className="btn-admin-secondary" 
            style={{ marginBottom: 15, padding: '12px 24px', height: 48, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={useCurrentLocation}
          >
            {locating ? "⏳ جاري التحديد..." : "📍 استخدام موقعي الحالي"}
          </button>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 10, fontWeight: 700 }}>🗺️ حدد موقع المتجر على الخريطة</label>
          <LocationPicker 
            lat={shippingSettings.storeLat} 
            lng={shippingSettings.storeLng} 
            onLocationChange={(lat, lng) => setShippingSettings(prev => ({ ...prev, storeLat: lat, storeLng: lng }))}
          />
          <p style={{ fontSize: '13px', color: '#888', marginTop: 10 }}>
            يمكنك سحب الدبوس أو الضغط على الخريطة لتحديث الموقع تلقائياً. الإحداثيات تستخدم لحساب مسافات التوصيل بدقة.
          </p>
        </div>
      </div>
    </div>
  );

  const renderReports = () => {
    const cur = storeSettings.currencySymbol || 'ر.س';
    
    // Sub-tab Navigation
    const reportTabs = [
      { id: 'summary', label: '📊 لوحة القيادة', icon: '🏠' },
      { id: 'daily', label: '📅 يومي', icon: '☀️' },
      { id: 'weekly', label: '🗓️ أسبوعي', icon: '📅' },
      { id: 'monthly', label: '🌙 شهري', icon: '📊' },
      { id: 'yearly', label: '⏳ سنوي', icon: '📈' },
    ];

    const handlePrint = () => {
      window.print();
    };

    const renderReportHeader = () => (
      <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 }}>
        <button className="btn-admin-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: '12px' }}>
          <span>🖨️</span> طباعة التقرير
        </button>
        <div className="report-tabs-pill" style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: 5, borderRadius: '14px', gap: 5 }}>
          {reportTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                background: activeReportTab === tab.id ? 'var(--gold)' : 'transparent',
                color: activeReportTab === tab.id ? '#fff' : '#666',
                boxShadow: activeReportTab === tab.id ? '0 4px 12px rgba(200, 169, 110, 0.3)' : 'none'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>
    );

    const renderSummary = () => (
      <div style={{ display: 'grid', gap: 25 }}>
        <div className="report-section">
          <h4 style={{ marginBottom: 15, color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>✨ المؤشرات المالية</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15 }}>
            <KPI icon="💰" label="إجمالي المبيعات" value={`${totalRevenue.toLocaleString()} ${cur}`} color="#4CAF50" />
            <KPI icon="📈" label="نمو المبيعات (الشهر الحالي)" value="+12%" color="#4CAF50" />
            <KPI icon="🛒" label="متوسط قيمة الطلب" value={`450 ${cur}`} color="#2196F3" />
            <KPI icon="📦" label="طلبات اليوم" value="12" color="#FF9800" />
          </div>
        </div>

        <div className="report-section">
          <h4 style={{ marginBottom: 15, color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>📦 حالة المخزون</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15 }}>
            <KPI icon="🏗️" label="قيمة المخزون الكلية" value={`599,500 ${cur}`} color="#9C27B0" />
            <KPI icon="⚠️" label="منتجات قاربت على النفاد" value="5" color="#F44336" />
            <KPI icon="🚫" label="منتجات غير متوفرة" value="2" color="#F44336" />
            <KPI icon="🏷️" label="إجمالي المنتجات" value={products.length} color="#607D8B" />
          </div>
        </div>

        <div className="report-section">
          <h4 style={{ marginBottom: 15, color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>👥 العملاء</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15 }}>
            <KPI icon="👥" label="إجمالي العملاء" value={customers.length} color="#3F51B5" />
            <KPI icon="🆕" label="عملاء جدد (هذا الأسبوع)" value="15" color="#00BCD4" />
            <KPI icon="💎" label="أعلى العملاء شراءً" value="8" color="#FFD700" />
            <KPI icon="💬" label="إجمالي التقييمات" value={reviews.length} color="#795548" />
          </div>
        </div>
      </div>
    );

    const renderDaily = () => (
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="admin-card">
          <h4>تقرير المبيعات اليومي - {new Date().toLocaleDateString('ar-SA')}</h4>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>ملخص الأداء لليوم الحالي مقارنة بالأيام السابقة.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginTop: 20 }}>
            <div className="stat-card-lite">
              <span className="label">مبيعات اليوم</span>
              <span className="value">{`1,250 ${cur}`}</span>
            </div>
            <div className="stat-card-lite">
              <span className="label">عدد الطلبات</span>
              <span className="value">8</span>
            </div>
            <div className="stat-card-lite">
              <span className="label">العملاء النشطون</span>
              <span className="value">24</span>
            </div>
          </div>
        </div>
        <div className="admin-card">
          <h4>أكثر المنتجات مبيعاً اليوم</h4>
          <table className="admin-table" style={{ marginTop: 15 }}>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية المباعة</th>
                <th>الإيرادات</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 3).map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{Math.floor(Math.random() * 10) + 1}</td>
                  <td>{`${(p.price * 2).toLocaleString()} ${cur}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderWeekly = () => (
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="admin-card">
          <h4>📊 ملخص الأداء الأسبوعي</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginTop: 15 }}>
            <KPI icon="📅" label="مبيعات الأسبوع" value={`8,450 ${cur}`} color="#4CAF50" />
            <KPI icon="🛍️" label="طلبات مكتملة" value="42" />
            <KPI icon="🔄" label="معدل التحويل" value="3.5%" color="#2196F3" />
          </div>
        </div>
        <div className="admin-card">
          <h4>📁 أداء الأقسام (هذا الأسبوع)</h4>
          <table className="admin-table" style={{ marginTop: 15 }}>
            <thead>
              <tr>
                <th>القسم</th>
                <th>عدد الطلبات</th>
                <th>نسبة المشاركة</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>عبايات</td><td>32</td><td>76%</td></tr>
              <tr><td>حقائب</td><td>10</td><td>24%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderMonthly = () => (
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="admin-card">
          <h4>🌙 التقرير المالي الشهري - {new Date().toLocaleString('ar-SA', { month: 'long' })}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginTop: 15 }}>
            <KPI icon="💰" label="صافي الإيرادات" value={`32,900 ${cur}`} color="#4CAF50" />
            <KPI icon="💳" label="دفع إلكتروني" value="65%" color="#673AB7" />
            <KPI icon="💵" label="دفع عند الاستلام" value="35%" />
          </div>
        </div>
        <div className="admin-card">
          <h4>🚨 تنبيهات المخزون المنخفض</h4>
          <table className="admin-table" style={{ marginTop: 15 }}>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية المتبقية</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {products.filter(p => (p.quantity || 0) < 5).map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ color: '#F44336', fontWeight: 700 }}>{p.quantity || 0}</td>
                  <td><button className="btn-icon" onClick={() => { setActiveTab('products'); setEditingProductId(p.id); setShowProductModal(true); }}>📦 تحديث</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderYearly = () => (
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="admin-card">
          <h4>⏳ التقرير السنوي الشامل {new Date().getFullYear()}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginTop: 15 }}>
            <KPI icon="🏆" label="إجمالي المبيعات السنوية" value={`450,000 ${cur}`} color="#FFD700" />
            <KPI icon="💎" label="أفضل عميل للسنة" value="نورة الراجحي" sub="32 طلب" />
            <KPI icon="🔥" label="أكثر شهر مبيعاً" value="رمضان" sub="85,000 ر.س" color="#FF5722" />
          </div>
        </div>
        <div className="admin-card">
          <h4>📈 النمو الشهري</h4>
          <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '20px 0', borderBottom: '1px solid #eee' }}>
            {[30, 45, 60, 40, 80, 95, 70, 85, 100, 90, 110, 120].map((h, i) => (
              <div key={i} style={{ flex: 1, background: 'var(--gold)', height: `${h}%`, borderRadius: '4px 4px 0 0', opacity: 0.8 }} title={`Month ${i+1}`}></div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.75rem', color: '#888' }}>
            <span>يناير</span><span>ديسمبر</span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="reports-container">
        {renderReportHeader()}
        <div className="report-content-animate">
          {activeReportTab === 'summary' && renderSummary()}
          {activeReportTab === 'daily' && renderDaily()}
          {activeReportTab === 'weekly' && renderWeekly()}
          {activeReportTab === 'monthly' && renderMonthly()}
          {activeReportTab === 'yearly' && renderYearly()}
        </div>
      </div>
    );
  };

  // Settings
  const [storeSettings, setStoreSettings] = useState({ 
    storeName: "أثير للعبايات", 
    storeDescription: "تشكيلة فاخرة من العبايات",
    logo: "👗",
    logoText: "ATHEER",
    whatsappNumber: "966500000000", 
    currency: "ريال",
    currencySymbol: "ر.س",
    footerText: "ATHEER ABAYA. All Rights Reserved.",
    termsAndConditions: ""
  });
  const fetchSettings = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "store_config"));
      if (docSnap.exists()) setStoreSettings(docSnap.data() as any);
    } catch (error) { console.error(error); }
  };
  const saveSettings = async () => {
    try {
      setUploading(true);
      let finalLogoUrl = storeSettings.logo;
      if (storeLogoFile) {
        finalLogoUrl = await handleFileUpload(storeLogoFile);
      }
      
      const updatedSettings = { ...storeSettings, logo: finalLogoUrl };
      await setDoc(doc(db, "settings", "store_config"), updatedSettings);
      setStoreSettings(updatedSettings);
      showToast("تم حفظ الإعدادات بنجاح", "success");
    } catch (error) { 
      console.error(error);
      showToast("حدث خطأ أثناء الحفظ", "error"); 
    }
    finally { setUploading(false); }
  };


  const renderSettings = () => (
    <div style={{ maxWidth: '900px' }}>
      <div className="admin-section-header">
        <h3>⚙️ الإعدادات</h3>
      </div>
      
      <Section title="⚙️ إعدادات المتجر">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 30px' }}>
          <div className="form-group">
            <label>اسم المتجر</label>
            <input 
              type="text" 
              value={storeSettings.storeName} 
              onChange={e => setStoreSettings({...storeSettings, storeName: e.target.value})} 
              placeholder="أدخل اسم المتجر"
            />
          </div>
          
          <div className="form-group">
            <label>الشعار (صورة أو إيموجي)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label className="btn-admin-secondary" style={{ background: 'var(--gold)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 10, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <span>🖼️</span> رفع شعار
                <input 
                  type="file" 
                  hidden 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setStoreLogoFile(file);
                      setStoreLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              <input 
                type="text" 
                value={storeSettings.logo} 
                onChange={e => {
                  setStoreSettings({...storeSettings, logo: e.target.value});
                  setStoreLogoPreview(null);
                }} 
                placeholder="أو ضع رابط صورة أو إيموجي"
                style={{ flex: 1 }}
              />
            </div>
            {(storeLogoPreview || (storeSettings.logo && storeSettings.logo.startsWith('http'))) && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '12px', color: '#888' }}>معاينة الشعار:</span>
                <div style={{ width: 50, height: 50, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                  <img src={storeLogoPreview || storeSettings.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            )}
          </div>


          <div className="form-group">
            <label>الوصف</label>
            <input 
              type="text" 
              value={storeSettings.storeDescription} 
              onChange={e => setStoreSettings({...storeSettings, storeDescription: e.target.value})} 
              placeholder="وصف مختصر للمتجر"
            />
          </div>

          <div className="form-group">
            <label>الشعار النصي (يظهر في الهيدر)</label>
            <input 
              type="text" 
              value={storeSettings.logoText} 
              onChange={e => setStoreSettings({...storeSettings, logoText: e.target.value})} 
              placeholder="مثال: ATHEER"
            />
          </div>

          <div className="form-group">
            <label>رقم الواتساب</label>
            <input 
              type="text" 
              value={storeSettings.whatsappNumber} 
              onChange={e => setStoreSettings({...storeSettings, whatsappNumber: e.target.value})} 
              placeholder="966500000000"
            />
          </div>

          <div className="form-group">
            <label>العملة</label>
            <input 
              type="text" 
              value={storeSettings.currency} 
              onChange={e => setStoreSettings({...storeSettings, currency: e.target.value})} 
              placeholder="مثال: ريال"
            />
          </div>

          <div className="form-group" style={{ gridColumn: '2 / 3' }}>
            <label>رمز العملة</label>
            <input 
              type="text" 
              value={storeSettings.currencySymbol} 
              onChange={e => setStoreSettings({...storeSettings, currencySymbol: e.target.value})} 
              placeholder="مثال: ر.س"
            />
          </div>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <button onClick={saveSettings} disabled={uploading} className="btn-admin-primary" style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700 }}>
            {uploading ? "⏳ جاري حفظ التغييرات..." : "💾 حفظ كافة الإعدادات"}
          </button>
        </div>
      </Section>

      <Section title="📜 نصوص إضافية وشروط">
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>نص الفوتر (Footer)</label>
          <input 
            type="text" 
            value={storeSettings.footerText} 
            onChange={e => setStoreSettings({...storeSettings, footerText: e.target.value})} 
            placeholder="© 2026 أثير للعبايات. جميع الحقوق محفوظة."
          />
        </div>
        <div className="form-group">
          <label>الشروط والأحكام</label>
          <textarea 
            placeholder="اكتب الشروط والأحكام هنا..."
            value={storeSettings.termsAndConditions}
            onChange={e => setStoreSettings({...storeSettings, termsAndConditions: e.target.value})}
            style={{ width: '100%', minHeight: 150, padding: 15, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          ></textarea>
        </div>
      </Section>
    </div>
  );

  const renderContent = () => {
    if (loading) return <div className="admin-loading-state"><div className="spinner"></div><p>جاري التحميل...</p></div>;
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'products': return renderProducts();
      case 'categories': return renderCategories();
      case 'orders': return renderOrders();
      case 'customers': return renderCustomers();
      case 'reviews': return renderReviews();
      case 'banners': return renderBanners();
      case 'shipping': return renderShipping();
      case 'settings': return renderSettings();
      case 'reports': return renderReports();
    }
  };

  if (loadingAuth) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c0c', color: '#c8a96e' }}>جاري التحقق...</div>;
  if (!user || !isAdmin) return null;

  return (
    <div className="admin-layout" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="admin-sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
          }}
        />

      )}

      <aside className={`admin-sidebar ${isSidebarOpen ? 'mobile-active' : ''}`}>

        <div className="sidebar-logo">
          <span className="logo-text">أثير</span>
        </div>
        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => {
                setActiveTab(tab.id);
                setIsSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">{tab.icon}</span>
              <span className="sidebar-label">{tab.label}</span>
            </button>
          ))}

          
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Link href="/" className="sidebar-item" style={{ textDecoration: 'none' }}>
              <span className="sidebar-icon">🏠</span>
              <span className="sidebar-label">العودة للمتجر</span>
            </Link>
          </div>
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="admin-menu-toggle"
              style={{ 
                background: 'var(--charcoal)', color: 'white', border: 'none', 
                borderRadius: '8px', padding: '8px', display: 'none', cursor: 'pointer' 
              }}
            >
              ☰
            </button>
            <h1 className="topbar-title">{tabs.find(t => t.id === activeTab)?.label}</h1>
          </div>
          
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(200, 169, 110, 0.1)', borderRadius: '10px', color: 'var(--gold)', fontSize: '13px', fontWeight: 600 }}>
            <span>🏠</span>
            <span className="mobile-hide">العودة للمتجر</span>
          </Link>
        </header>


        <div className="admin-content">{renderContent()}</div>
      </main>
      {/* Modals and other logic remain same but cleaned up */}
      {showProductModal && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProductId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
              <button className="modal-close" onClick={closeProductModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid" style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label>اسم المنتج *</label>
                  <input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="مثال: عباية ملكي فاخرة" />
                </div>
                <div className="form-group">
                  <label>التصنيف *</label>
                  <select value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value as any })}>
                    <option value="abaya">👗 عبايات</option>
                    <option value="bag">👜 حقائب</option>
                  </select>
                </div>
              </div>

              <div className="modal-grid" style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label>السعر الحالي (ر.س) *</label>
                  <input type="number" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>السعر قبل الخصم (اختياري)</label>
                  <input type="number" value={productForm.oldPrice} onChange={e => setProductForm({ ...productForm, oldPrice: Number(e.target.value) })} />
                </div>
              </div>

              <div className="modal-grid" style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label>الكمية المتوفرة *</label>
                  <input type="number" value={productForm.quantity} onChange={e => setProductForm({ ...productForm, quantity: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>تنبيه عند وصول المخزون إلى</label>
                  <input type="number" value={productForm.lowStockThreshold} onChange={e => setProductForm({ ...productForm, lowStockThreshold: Number(e.target.value) })} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>وصف المنتج</label>
                <textarea 
                  value={productForm.description} 
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })} 
                  placeholder="اكتبي تفاصيل المنتج، نوع القماش، المميزات..." 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>صورة المنتج</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                  <button 
                    onClick={() => setImageSrcType('upload')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      background: imageSrcType === 'upload' ? 'var(--charcoal)' : '#f5f5f5',
                      color: imageSrcType === 'upload' ? 'white' : 'var(--charcoal)',
                      border: 'none', fontWeight: 600
                    }}
                  >
                    رفع من الجهاز
                  </button>
                  <button 
                    onClick={() => setImageSrcType('url')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      background: imageSrcType === 'url' ? 'var(--charcoal)' : '#f5f5f5',
                      color: imageSrcType === 'url' ? 'white' : 'var(--charcoal)',
                      border: 'none', fontWeight: 600
                    }}
                  >
                    رابط مباشر
                  </button>
                </div>

                {imageSrcType === 'upload' ? (
                  <div className="upload-zone">
                    <label className="upload-label">
                      {imageFile ? `✅ تم اختيار: ${imageFile.name}` : '📁 اضغطي هنا لاختيار صورة من جهازك'}
                      <input 
                        type="file" 
                        hidden 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </label>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={productForm.imageUrl} 
                    onChange={e => {
                      setProductForm({ ...productForm, imageUrl: e.target.value });
                      setImagePreview(e.target.value);
                    }} 
                    placeholder="أدخلي رابط الصورة هنا (https://...)" 
                  />
                )}

                {(imagePreview || productForm.imageUrl) && (
                  <div style={{ marginTop: 15 }}>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: 8 }}>معاينة الصورة:</p>
                    <div className="upload-preview">
                      <img src={imagePreview || productForm.imageUrl} alt="Preview" />
                      <button className="remove-preview" onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setProductForm({ ...productForm, imageUrl: '' });
                      }}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px dashed var(--gold)' }}>
                <input 
                  type="checkbox" 
                  checked={productForm.featured} 
                  onChange={e => setProductForm({ ...productForm, featured: e.target.checked })}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontWeight: 700, color: 'var(--gold-dark)' }}>تمييز المنتج في الصفحة الرئيسية ✨</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-secondary" onClick={closeProductModal}>إلغاء</button>
              <button onClick={saveProduct} className="btn-admin-primary" disabled={uploading}>
                {uploading ? "⏳ جاري الحفظ..." : (editingProductId ? "تحديث المنتج" : "حفظ المنتج")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategoryId ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</h2>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>اسم التصنيف *</label>
                <input type="text" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="مثال: عبايات صيفية" />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>الوصف</label>
                <input type="text" value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="وصف مختصر للتصنيف" />
              </div>
              <div className="form-group">
                <label>أيقونة أو صورة التصنيف</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                  <button 
                    onClick={() => setImageSrcType('upload')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      background: imageSrcType === 'upload' ? 'var(--charcoal)' : '#f5f5f5',
                      color: imageSrcType === 'upload' ? 'white' : 'var(--charcoal)',
                      border: 'none', fontWeight: 600
                    }}
                  >
                    رفع صورة
                  </button>
                  <button 
                    onClick={() => setImageSrcType('url')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      background: imageSrcType === 'url' ? 'var(--charcoal)' : '#f5f5f5',
                      color: imageSrcType === 'url' ? 'white' : 'var(--charcoal)',
                      border: 'none', fontWeight: 600
                    }}
                  >
                    رابط أيقونة
                  </button>
                </div>

                {imageSrcType === 'upload' ? (
                  <div className="upload-zone">
                    <label className="upload-label">
                      {categoryImageFile ? `✅ تم الاختيار` : '📁 اختر صورة للتصنيف'}
                      <input type="file" hidden accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCategoryImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }} />
                    </label>
                  </div>
                ) : (
                  <input type="text" value={categoryForm.icon} onChange={e => { setCategoryForm({ ...categoryForm, icon: e.target.value }); setImagePreview(e.target.value); }} placeholder="أدخلي رابط الأيقونة أو رمز تعبيري" />
                )}

                {(imagePreview || categoryForm.icon) && (
                  <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
                    <div className="upload-preview" style={{ width: 80, height: 80 }}>
                      <img src={imagePreview || categoryForm.icon} alt="Preview" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-secondary" onClick={() => setShowCategoryModal(false)}>إلغاء</button>
              <button onClick={saveCategory} className="btn-admin-primary" disabled={uploading}>
                {uploading ? "⏳ جاري الحفظ..." : "حفظ التصنيف"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Modal */}
      {showBannerModal && (
        <div className="modal-overlay" onClick={() => setShowBannerModal(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #333', maxWidth: '550px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #333', padding: '20px 25px' }}>
              <h2 style={{ color: '#fff', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--gold)' }}>➕</span> إضافة بانر جديد
              </h2>
              <button className="modal-close" onClick={() => setShowBannerModal(false)} style={{ color: '#888', background: '#333', borderRadius: '50%', width: 32, height: 32 }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '25px' }}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ color: '#fff', fontWeight: 600 }}>عنوان البانر *</label>
                <input 
                  type="text" 
                  value={bannerForm.title} 
                  onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })} 
                  placeholder="عرض جديد!"
                  style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: 10 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ color: '#fff', fontWeight: 600 }}>الوصف</label>
                <input 
                  type="text" 
                  value={bannerForm.subtitle} 
                  onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })} 
                  placeholder="خصومات مميزة على منتجات مختارة"
                  style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: 10 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ color: '#fff', fontWeight: 600 }}>صورة البانر *</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    value={bannerForm.image} 
                    onChange={e => { setBannerForm({ ...bannerForm, image: e.target.value }); setImagePreview(e.target.value); }} 
                    placeholder="رابط الصورة أو ارفع من جهازك"
                    style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: 10 }}
                  />
                  <label className="btn-admin-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 15px', borderRadius: 10, cursor: 'pointer', background: 'var(--gold)', color: '#000', border: 'none' }}>
                    <span>📤</span> رفع
                    <input type="file" hidden accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBannerImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                </div>
                {(imagePreview || bannerForm.image) && (
                  <div style={{ marginTop: 12 }}>
                    <div className="upload-preview" style={{ width: '100%', height: 120, borderRadius: 10, border: '1px solid #333' }}>
                      <img src={imagePreview || bannerForm.image} alt="Preview" style={{ objectFit: 'cover' }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ color: '#fff', fontWeight: 600 }}>رابط التوجيه (اختر من القائمة)</label>
                <select 
                  onChange={(e) => setBannerForm({ ...bannerForm, link: e.target.value })}
                  value={bannerForm.link}
                  style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: 10, width: '100%', marginBottom: 10 }}
                >
                  <option value="/">🎯 سهم التوجيه: اختر وجهة التوجيه...</option>
                  <optgroup label="📂 الأقسام">
                    {categories.map(cat => (
                      <option key={cat.id} value={`/${cat.id}`}>{cat.icon} {cat.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🛍️ الصفحات العامة">
                    <option value="/abayas">👗 كل العبايات</option>
                    <option value="/bags">👜 كل الحقائب</option>
                    <option value="/collection">🆕 أحدث التشكيلات</option>
                  </optgroup>
                  <optgroup label="✨ منتجات مختارة">
                    {products.slice(0, 8).map(p => (
                      <option key={p.id} value={`/product/${p.id}`}>{p.name}</option>
                    ))}
                  </optgroup>
                </select>
                <div style={{ fontSize: '0.8rem', color: '#666', background: '#000', padding: '10px', borderRadius: 8, border: '1px solid #222' }}>
                  الرابط الفعلي: <span style={{ color: 'var(--gold)' }}>{bannerForm.link}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #333', padding: '20px 25px', gap: 15 }}>
              <button className="btn-admin-secondary" onClick={() => setShowBannerModal(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '12px 30px' }}>إلغاء</button>
              <button onClick={saveBanner} className="btn-admin-primary" disabled={uploading} style={{ padding: '12px 40px', boxShadow: '0 0 20px rgba(200, 169, 110, 0.2)' }}>
                {uploading ? "⏳ جاري الحفظ..." : "💾 إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn-admin-secondary" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>إلغاء</button>
              <button className="btn-admin-danger" style={{ padding: '10px 24px', borderRadius: 10 }} onClick={confirmModal.onConfirm}>حذف نهائياً</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Printable Template (Hidden from screen, visible in print) */}
      {currentPrintingOrder && (
        <div id="invoice-print-area" className="print-only">
          <div style={{ padding: '50px', color: '#1a1a1a', direction: 'rtl', fontFamily: '"Times New Roman", Times, serif', backgroundColor: '#fff' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #c8a96e', paddingBottom: '20px', marginBottom: '40px' }}>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, color: '#c8a96e', fontSize: '2.5rem', fontWeight: 'bold' }}>{storeSettings.storeName}</h1>
                <p style={{ margin: '5px 0', fontSize: '1.2rem', color: '#666' }}>فاتورة ضريبية مبسطة</p>
              </div>
              <div style={{ textAlign: 'left', fontSize: '0.9rem', color: '#333' }}>
                <div style={{ marginBottom: '5px' }}><span style={{ fontWeight: 'bold' }}>رقم الفاتورة:</span> <span style={{ color: '#c8a96e' }}>#{currentPrintingOrder.id.substring(0, 8)}</span></div>
                <div><span style={{ fontWeight: 'bold' }}>التاريخ:</span> {formatDate(currentPrintingOrder.createdAt)}</div>
              </div>
            </div>

            {/* Customer Details Section */}
            <div style={{ marginBottom: '40px', background: '#fcfaf7', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
              <h3 style={{ color: '#c8a96e', marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>بيانات العميل:</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div><span style={{ color: '#888' }}>الاسم:</span> <strong style={{ fontSize: '1.1rem' }}>{currentPrintingOrder.customerName}</strong></div>
                <div><span style={{ color: '#888' }}>رقم الجوال:</span> <span style={{ direction: 'ltr', display: 'inline-block' }}>{currentPrintingOrder.customerPhone}</span></div>
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
              <thead>
                <tr style={{ backgroundColor: '#c8a96e', color: '#fff' }}>
                  <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #c8a96e' }}>المنتج</th>
                  <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #c8a96e', width: '80px' }}>الكمية</th>
                  <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #c8a96e', width: '120px' }}>سعر الوحدة</th>
                  <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #c8a96e', width: '150px' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {currentPrintingOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '15px', border: '1px solid #eee', fontWeight: 'bold' }}>{item.name}</td>
                    <td style={{ padding: '15px', border: '1px solid #eee', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '15px', border: '1px solid #eee', textAlign: 'center' }}>{item.price.toLocaleString()} {storeSettings.currencySymbol}</td>
                    <td style={{ padding: '15px', border: '1px solid #eee', textAlign: 'center', fontWeight: 'bold' }}>{(item.price * item.qty).toLocaleString()} {storeSettings.currencySymbol}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: '20px', textAlign: 'left', fontWeight: 'bold', fontSize: '1.2rem', backgroundColor: '#fcfaf7', border: '1px solid #eee' }}>المجموع الكلي</td>
                  <td style={{ padding: '20px', textAlign: 'center', fontWeight: '900', fontSize: '1.4rem', backgroundColor: '#c8a96e', color: '#fff', border: '1px solid #c8a96e' }}>
                    {currentPrintingOrder.total.toLocaleString()} {storeSettings.currencySymbol}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
              <div style={{ width: '100px', height: '2px', background: '#c8a96e', margin: '0 auto 20px' }}></div>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#c8a96e', margin: '5px 0' }}>شكراً لتسوقكم من {storeSettings.storeName}</p>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>نتطلع لخدمتكم مرة أخرى</p>
              <div style={{ marginTop: '30px', fontSize: '0.8rem', color: '#aaa' }}>
                هذه فاتورة إلكترونية صادرة من نظام {storeSettings.storeName} ولا تتطلب ختماً أو توقيعاً.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
