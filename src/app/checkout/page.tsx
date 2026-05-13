"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";
import dynamic from "next/dynamic";

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  stock: number;
}

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false, loading: () => <div style={{height:300,borderRadius:14,background:'#f5f0ea',display:'flex',alignItems:'center',justifyContent:'center'}}>⏳ جاري تحميل الخريطة...</div> });

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
    lat: 0,
    lng: 0
  });
  const [showMap, setShowMap] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [distance, setDistance] = useState(0);

  const { showToast } = useToast();
  const router = useRouter();
  const { settings } = useSettings();

  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
      router.push('/');
    }
    setItems(cart);
  }, [router]);

  useEffect(() => {
    if (settings.storeLat && settings.storeLng && formData.lat !== 0 && formData.lng !== 0) {
      const d = calculateDistance(settings.storeLat, settings.storeLng, formData.lat, formData.lng);
      setDistance(d);
    } else {
      setDistance(0);
    }
  }, [formData.lat, formData.lng, settings.storeLat, settings.storeLng]);

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  
  const isFreeShipping = settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold;
  const distanceFee = distance * (settings.pricePerKm || 0);
  const shipping = isFreeShipping ? 0 : (settings.fixedDeliveryFee + distanceFee);
  const total = subtotal + shipping;
  const isUnderMinOrder = subtotal < (settings.minimumOrder || 0);

  const reverseGeocode = async (lat: number, lng: number) => {
    // Immediate coordinate fallback to ensure field is never empty
    const currentCity = formData.city;
    setFormData(prev => ({ 
      ...prev, 
      address: `جاري جلب العنوان... (${lat.toFixed(5)}, ${lng.toFixed(5)})`, 
      lat, lng 
    }));

    try {
      setIsLocating(true);
      showToast("⏳ جاري البحث عن تفاصيل العنوان...", "info");
      
      // Helper for fetch with timeout
      const fetchWithTimeout = async (url: string, options: any = {}, timeout = 3000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          return response;
        } catch (e) {
          clearTimeout(id);
          throw e;
        }
      };

      // 1. Try BigDataCloud (Fastest & most accessible)
      try {
        const response = await fetchWithTimeout(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ar`
        );
        const bdcData = await response.json();
        if (bdcData && (bdcData.city || bdcData.locality)) {
          const city = bdcData.city || bdcData.locality || bdcData.principalSubdivision || formData.city;
          const fallbackAddr = bdcData.label || `${city}، الموقع المحدد على الخريطة`;
          setFormData(prev => ({ ...prev, city, address: fallbackAddr, lat, lng }));
          showToast("✅ تم تحديث الموقع بسرعة", "success");
          return;
        }
      } catch (e) {
        console.log("BDC failed");
      }

      // 2. Try Maps.co (Detailed)
      try {
        const response = await fetchWithTimeout(
          `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}&api_key=6733a1e58284b397228330jif2c9749` 
        );
        const data = await response.json();
        if (data && data.display_name) {
          setFormData(prev => ({ ...prev, address: data.display_name, lat, lng }));
          showToast("✅ تم جلب العنوان (بديل)", "success");
          return;
        }
      } catch (e) {
        console.log("Maps.co failed");
      }

      // 3. Try Nominatim (Last Resort)
      try {
        const response = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`,
          { headers: { 'User-Agent': 'AtheerStore/1.0' } }
        );
        const data = await response.json();
        if (data && data.display_name) {
          const addr = data.address;
          const city = addr.city || addr.town || addr.village || addr.city_district || addr.state || formData.city;
          setFormData(prev => ({ ...prev, city, address: data.display_name, lat, lng }));
          showToast("✅ تم تحديث العنوان بدقة", "success");
          return;
        }
      } catch (e) {
        console.log("Nominatim skipped");
      }
      
      // Final Fallback: Coordinates
      setFormData(prev => ({ 
        ...prev, 
        address: `موقع GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (${currentCity})`, 
        lat, lng 
      }));
    } catch (error) {
      console.error("Geocode error:", error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleAutoLocate = () => {
    if (!navigator.geolocation) {
      showToast("المتصفح لا يدعم تحديد الموقع", "error");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        reverseGeocode(latitude, longitude);
        setIsLocating(false);
        showToast("✅ تم تحديد موقعك بنجاح", "success");
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
        showToast("❌ فشل في تحديد الموقع، يرجى تفعيل الـ GPS", "error");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address) {
      showToast("يرجى إكمال جميع البيانات المطلوبة", "error");
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        customer: formData,
        items: items,
        subtotal,
        shipping,
        total,
        status: "pending",
        createdAt: new Date(),
        userId: auth.currentUser?.uid || "guest"
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);
      
      const message = `طلب جديد من المتجر! 🛍️\n\nالاسم: ${formData.name}\nالجوال: ${formData.phone}\nالمدينة: ${formData.city}\nالعنوان: ${formData.address}\nالموقع: https://www.google.com/maps?q=${formData.lat},${formData.lng}\n\nالطلبات:\n${items.map(i => `- ${i.name} (${i.qty}x)`).join('\n')}\n\nالإجمالي: ${total} ${settings.currencySymbol}`;
      const waUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(message)}`;
      
      showToast("تم إرسال طلبك بنجاح! 🎉", "success");
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cartUpdated'));
      
      setTimeout(() => {
        window.open(waUrl, '_blank');
        router.push(`/checkout/success?id=${docRef.id}`);
      }, 1500);

    } catch (error) {
      console.error("Order error:", error);
      showToast("حدث خطأ أثناء معالجة الطلب", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', transition: 'background-color 0.4s ease' }}>
      <Navbar />

      <section className="section" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="section-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '40px', alignItems: 'start' }}>
          
          {/* Checkout Form */}
          <div className="checkout-card" style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '30px', boxShadow: '0 10px 40px var(--shadow-color)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>بيانات التوصيل</h2>
              <div style={{ width: '40px', height: '4px', background: 'var(--gold)', borderRadius: '2px' }}></div>
            </div>
            
            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}>الاسم بالكامل *</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="اكتب اسمك هنا"
                  autoComplete="off"
                  style={{ width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', transition: '0.3s' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}>رقم الجوال *</label>
                  <input 
                    type="tel" 
                    required
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="رقم الجوال"
                    autoComplete="off"
                    style={{ width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}>المدينة</label>
                  <input 
                    type="text" 
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                    placeholder="المدينة"
                    autoComplete="off"
                    style={{ width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Location Selection Buttons */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '5px' }}>
                <button 
                  type="button"
                  onClick={handleAutoLocate}
                  disabled={isLocating}
                  style={{ 
                    flex: 1, padding: '14px', background: '#f5f0ea', color: 'var(--gold-dark)', 
                    borderRadius: '12px', border: '1px solid var(--gold)', fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {isLocating ? "⏳ جاري التحديد..." : "📍 تحديد موقعي الحالي"}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowMap(true)}
                  style={{ 
                    flex: 1, padding: '14px', background: '#fff', color: 'var(--charcoal)', 
                    borderRadius: '12px', border: '1px solid #ddd', fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  🗺️ تحديد من الخريطة
                </button>
              </div>

              {distance > 0 && formData.city !== "" && (
                <div style={{ 
                  padding: '12px 18px', background: 'rgba(39, 174, 96, 0.08)', borderRadius: '12px', 
                  fontSize: '14px', color: '#27ae60', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                  border: '1px solid rgba(39, 174, 96, 0.2)'
                }}>
                  <span>📏 تبعد عن المتجر حوالي:</span>
                  <span style={{ fontSize: '16px' }}>{distance.toFixed(1)} كم</span>
                </div>
              )}

              {showMap && (
                <div style={{ 
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                  background: 'rgba(0,0,0,0.8)', zIndex: 10000, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' 
                }}>
                  <div style={{ 
                    background: 'white', borderRadius: '30px', width: '100%', maxWidth: '700px', 
                    overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' 
                  }}>
                    <div style={{ padding: '20px 30px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>حدد موقع التوصيل بدقة</h3>
                      <button 
                        onClick={() => setShowMap(false)}
                        style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#888' }}
                      >✕</button>
                    </div>
                    <div style={{ height: '450px' }}>
                      <LocationPicker 
                        lat={formData.lat || 24.7136} 
                        lng={formData.lng || 46.6753} 
                        onLocationChange={(lat, lng) => reverseGeocode(lat, lng)} 
                      />
                    </div>
                    <div style={{ padding: '20px 30px', background: '#fcfcfc' }}>
                      <button 
                        onClick={() => setShowMap(false)}
                        style={{ 
                          width: '100%', padding: '15px', background: 'var(--black)', color: 'var(--gold)', 
                          borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' 
                        }}
                      >تأكيد الموقع</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}>العنوان بالتفصيل *</label>
                <div style={{ position: 'relative' }}>
                  <textarea 
                    required
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    placeholder="سيتم جلب العنوان تلقائياً عند تحديد الموقع..."
                    rows={3}
                    style={{ 
                      width: '100%', padding: '16px', paddingLeft: isLocating ? '40px' : '16px',
                      borderRadius: '15px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', 
                      color: 'var(--text-primary)', outline: 'none', resize: 'none', transition: '0.3s' 
                    }}
                  />
                  {isLocating && (
                    <div style={{ 
                      position: 'absolute', left: '15px', top: '15px', 
                      fontSize: '12px', color: 'var(--gold-dark)', fontWeight: 700 
                    }}>
                      جاري جلب العنوان...
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}>ملاحظات للطلب (اختياري)</label>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="مثال: يرجى الاتصال قبل الوصول بـ 10 دقائق"
                  rows={2}
                  style={{ width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }}
                />
              </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => router.push('/')}
                    style={{ 
                      flex: 0.4, padding: '20px', background: '#f5f5f5', color: '#666', 
                      borderRadius: '16px', border: 'none', fontSize: '16px', fontWeight: 700, 
                      cursor: 'pointer', transition: '0.3s transform'
                    }}
                  >
                    إلغاء الطلب
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading || isUnderMinOrder}
                    style={{ 
                      flex: 1, padding: '20px', background: isUnderMinOrder ? '#ccc' : 'var(--black)', color: 'var(--gold)', 
                      borderRadius: '16px', border: 'none', fontSize: '18px', fontWeight: 800, 
                      cursor: isUnderMinOrder ? 'not-allowed' : 'pointer', boxShadow: isUnderMinOrder ? 'none' : '0 15px 30px rgba(0,0,0,0.15)',
                      transition: '0.3s transform'
                    }}
                    onMouseOver={(e) => !isUnderMinOrder && (e.currentTarget.style.transform = 'translateY(-3px)')}
                    onMouseOut={(e) => !isUnderMinOrder && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {loading ? "⏳ جاري المعالجة..." : isUnderMinOrder ? `الحد الأدنى للطلب ${settings.minimumOrder} ${settings.currencySymbol}` : "إتمام الطلب عبر واتساب 🛍️"}
                  </button>
                </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="summary-card" style={{ background: 'var(--bg-card)', padding: '35px', borderRadius: '30px', boxShadow: '0 10px 40px var(--shadow-color)', border: '1px solid var(--border-color)', position: 'sticky', top: '120px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '25px', color: 'var(--text-primary)' }}>ملخص المشتريات</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: '75px', height: '90px', borderRadius: '15px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 5px 15px rgba(0,0,0,0.05)' }}>
                    <Image src={item.image || '/images/hero.png'} alt={item.name} fill style={{ objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>{item.name}</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>{item.qty} × {item.price} {settings.currencySymbol}</span>
                      <span style={{ fontWeight: 800, color: 'var(--gold-dark)' }}>{item.price * item.qty} {settings.currencySymbol}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px dashed #eee', paddingTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>قيمة المنتجات</span>
                <span style={{ fontWeight: 600 }}>{subtotal} {settings.currencySymbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>رسوم التوصيل {distance > 0 && `(${distance.toFixed(1)} كم)`}</span>
                <span style={{ fontWeight: 600, color: formData.city === "" ? "#888" : '#27ae60' }}>
                  {formData.city === "" ? "يتم التحديد بعد تحديد الموقع" : (shipping === 0 ? "مجاني" : `${shipping.toFixed(0)} ${settings.currencySymbol}`)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '20px', borderTop: '2px solid var(--border-color)' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>الإجمالي النهائي</span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--gold-dark)' }}>{total} {settings.currencySymbol}</span>
              </div>
            </div>

            <div style={{ marginTop: '35px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'center' }}>
                ✨ شكراً لثقتك بنا، سيتم إرسال طلبك فوراً وتأكيد التفاصيل معك عبر الواتساب.
              </p>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
