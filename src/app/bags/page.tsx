"use client";
import { useState, useEffect } from "react";
import { Product } from "@/types";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";

export default function BagsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    const fetchBags = async () => {
      try {
        if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
        const q = query(collection(db, "products"), where("category", "==", "bag"));
        const querySnapshot = await getDocs(q);
        const fetchedProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        if (fetchedProducts.length === 0) {
          setProducts([]);
        } else {
          setProducts(fetchedProducts);
        }
      } catch (error) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBags();
  }, []);

  return (
    <main>
      <Navbar />

      {/* Hero Banner */}
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: 'url(/images/bags.png)' }}></div>
        <div className="page-hero-overlay"></div>
        <div className="page-hero-content">
          <nav className="breadcrumb">
            <Link href="/">الرئيسية</Link>
            <span>/</span>
            <span>الحقائب</span>
          </nav>
          <h1>الحقائب</h1>
          <p>أكملي إطلالتك مع مجموعتنا المختارة من الحقائب العصرية</p>
        </div>
      </section>

      {/* Products */}
      <section className="section products-section">
        <div className="section-container">
          <div className="products-header">
            <div className="products-header-right">
              <h2>جميع الحقائب</h2>
              <p>{products.length} منتج</p>
            </div>
          </div>

          {loading ? (
            <div className="products-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="product-card" style={{ opacity: 0.4 }}>
                  <div className="product-image" style={{ background: '#eee' }}></div>
                  <div className="product-details">
                    <div style={{ height: 16, background: '#eee', borderRadius: 4, marginBottom: 8, width: '70%' }}></div>
                    <div style={{ height: 20, background: '#eee', borderRadius: 4, width: '40%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👜</div>
              <h3>لا توجد حقائب حالياً</h3>
              <p>سيتم إضافة تشكيلات جديدة قريباً</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="section-container">
          <h2 className="footer-logo">{settings.logoText}</h2>
          <div className="footer-links">
            <Link href="/abayas">العبايات</Link>
            <Link href="/bags">الحقائب</Link>
            <Link href="/about">من نحن</Link>
          </div>
          <div className="footer-divider"></div>
          <p className="footer-copy">© {new Date().getFullYear()} {settings.footerText}</p>
        </div>
      </footer>
    </main>
  );
}
