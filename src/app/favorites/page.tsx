"use client";
import { useState, useEffect } from "react";
import { Product } from "@/types";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";

export default function FavoritesPage() {
    const { settings } = useSettings();
    const [favorites, setFavorites] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [hasIds, setHasIds] = useState(false);
  
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          
          // Listen to favorites array in user doc
          const userRef = doc(db, "users", currentUser.uid);
          const unsubFavs = onSnapshot(userRef, async (docSnap) => {
            setLoading(true);
            try {
              if (docSnap.exists()) {
                const favIds = docSnap.data().favorites || [];
                setHasIds(favIds.length > 0);
                
                if (favIds.length > 0) {
                  // Fetch ACTUAL products
                  const productsRef = collection(db, "products");
                  const querySnapshot = await getDocs(productsRef);
                  let allProds = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
                  
                  // If DB is empty, include Fallback products (to match homepage)
                  if (allProds.length === 0) {
                    allProds = [
                      { id: "1", name: "عباية ملكي سوداء", price: 450, oldPrice: 550, category: "abaya", description: "عباية فاخرة بتطريز ذهبي", quantity: 5, imageUrl: "/images/hero.png", featured: true },
                      { id: "2", name: "حقيبة كلاسيك جلد", price: 320, category: "bag", description: "حقيبة جلد طبيعي فاخر", quantity: 3, imageUrl: "/images/bags.png", featured: true },
                      { id: "3", name: "عباية مخمل راقية", price: 580, oldPrice: 700, category: "abaya", description: "عباية مخمل بلمسات عصرية", quantity: 2, imageUrl: "/images/hero.png", featured: true },
                      { id: "4", name: "حقيبة سهرة ذهبية", price: 275, category: "bag", description: "حقيبة سهرة أنيقة", quantity: 0, imageUrl: "/images/bags.png", featured: true },
                    ];
                  }
                  
                  // Filter locally with robust matching
                  const filtered = allProds.filter(p => {
                    const normalizedFavIds = favIds.map((id: string) => String(id).trim());
                    return normalizedFavIds.includes(String(p.id).trim());
                  });
                  setFavorites(filtered);
                } else {
                  setFavorites([]);
                }
              } else {
                setFavorites([]);
                setHasIds(false);
              }
            } catch (err) {
              console.error("Error fetching favorites:", err);
              setFavorites([]);
            } finally {
              setLoading(false);
            }
          });
          return () => unsubFavs();
      } else {
        setUser(null);
        setFavorites([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <main>
      <Navbar />

      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundColor: 'var(--black)' }}></div>
        <div className="page-hero-overlay"></div>
        <div className="page-hero-content">
          <nav className="breadcrumb">
            <Link href="/">الرئيسية</Link>
            <span>/</span>
            <span>المفضلة</span>
          </nav>
          <h1>قائمة أمنياتي</h1>
          <p>المنتجات التي نالت إعجابك وترغبين في اقتنائها</p>
        </div>
      </section>

      <section className="section">
        <div className="section-container">
          {loading ? (
            <div className="products-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="product-card skeleton" style={{ opacity: 0.4 }}>
                  <div className="product-image" style={{ background: '#eee' }}></div>
                  <div className="product-details"><div style={{ height: 20, background: '#eee', borderRadius: 4 }}></div></div>
                </div>
              ))}
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>🔒</div>
              <h3>يرجى تسجيل الدخول</h3>
              <p style={{ color: '#999', marginBottom: 30 }}>يجب تسجيل الدخول لمشاهدة قائمة المفضلة الخاصة بك</p>
              <Link href="/login" className="btn-primary">تسجيل الدخول</Link>
            </div>
          ) : favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>❤️</div>
              <h3>قائمة المفضلة فارغة</h3>
              <p style={{ color: '#999', marginBottom: 30 }}>لم تقمي بإضافة أي منتجات للمفضلة بعد</p>
              <Link href="/abayas" className="btn-primary">اكتشفي العبايات</Link>
            </div>
          ) : (
            <div className="products-grid">
              {favorites.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="section-container">
          <h2 className="footer-logo">{settings.logoText}</h2>
          <p className="footer-copy">© {new Date().getFullYear()} {settings.storeName}. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </main>
  );
}
