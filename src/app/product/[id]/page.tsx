"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/types";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const docRef = doc(db, "products", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(productData);
          fetchSimilarProducts(productData.category, docSnap.id);
        } else {
          showToast("المنتج غير موجود", "error");
          router.push("/abayas");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, router]);

  const fetchSimilarProducts = async (category: string, currentId: string) => {
    try {
      const q = query(
        collection(db, "products"),
        where("category", "==", category),
        limit(5)
      );
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter(p => p.id !== currentId);
      setSimilarProducts(fetched.slice(0, 4));
    } catch (error) {
      console.error("Error fetching similar products:", error);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (quantity > product.quantity) {
      showToast(`عذراً، الكمية المتوفرة حالياً هي ${product.quantity} فقط`, "error");
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((item: any) => item.id === product.id);
    const currentQtyInCart = existing ? existing.qty : 0;

    if (currentQtyInCart + quantity > product.quantity) {
      showToast(`لا يمكنك إضافة المزيد، الكمية في السلة ستتجاوز المخزون المتوفر (${product.quantity})`, "error");
      return;
    }

    if (existing) {
      existing.qty += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl,
        qty: quantity,
        stock: product.quantity
      });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    showToast("تمت إضافة المنتج للسلة بنجاح", "success");
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div className="loader-gold"></div>
      </div>
    );
  }

  if (!product) return null;

  const discount = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;

  return (
    <main style={{ background: '#fff' }}>
      <Navbar />
      
      <div className="section-container" style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        <nav className="breadcrumb" style={{ marginBottom: '30px' }}>
          <Link href="/">الرئيسية</Link>
          <span>/</span>
          <Link href={product.category === 'abaya' ? '/abayas' : '/bags'}>
            {product.category === 'abaya' ? 'العبايات' : 'الحقائب'}
          </Link>
          <span>/</span>
          <span className="current">{product.name}</span>
        </nav>

        <div className="product-details-grid">
          <div className="product-gallery">
            <div className="main-image-wrap">
              {discount > 0 && <span className="product-badge discount">خصم {discount}%</span>}
              <img src={product.imageUrl} alt={product.name} className="main-product-image" />
            </div>
          </div>

          <div className="product-info-panel">
            <h1 className="product-title">{product.name}</h1>
            <div className="product-meta">
              <span className={`stock-status ${product.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                {product.quantity > 0 ? `متوفر: ${product.quantity} قطعة` : 'نفد من المخزون'}
              </span>
              <span className="category-tag">{product.category === 'abaya' ? '👗 عباية' : '👜 حقيبة'}</span>
            </div>

            <div className="product-price-section">
              <span className="current-price">{product.price} {settings.currencySymbol}</span>
              {product.oldPrice && <span className="old-price">{product.oldPrice} {settings.currencySymbol}</span>}
            </div>

            <div className="product-description">
              <h3>عن المنتج</h3>
              <p>{product.description || "لا يوجد وصف متوفر لهذا المنتج حالياً."}</p>
            </div>

            {product.quantity > 0 && (
              <div className="purchase-controls">
                <div className="quantity-selector">
                  <button onClick={() => {
                    if (quantity > 1) {
                      setQuantity(quantity - 1);
                    }
                  }}>−</button>
                  <input type="number" value={quantity} readOnly />
                  <button onClick={() => {
                    if (quantity < product.quantity) {
                      setQuantity(quantity + 1);
                    } else {
                      showToast(`عذراً، لا يوجد سوى ${product.quantity} قطع متوفرة من هذا المنتج`, "info");
                    }
                  }}>+</button>
                </div>
                <button className="btn-add-cart-large" onClick={handleAddToCart}>
                  إضافة للسلة 🛒
                </button>
              </div>
            )}

            <div className="product-features-small">
              <div className="feature-item"><span>🚚</span> توصيل سريع لجميع المناطق</div>
              <div className="feature-item"><span>🛡️</span> ضمان جودة القماش والخياطة</div>
              <div className="feature-item"><span>💳</span> دفع آمن عند الاستلام</div>
            </div>
          </div>
        </div>

        {similarProducts.length > 0 && (
          <div className="similar-products-section" style={{ marginTop: '100px' }}>
            <div className="section-header" style={{ textAlign: 'right', marginBottom: '40px' }}>
              <h2 className="section-title">منتجات مشابهة قد تعجبك</h2>
              <div className="section-subtitle">اخترنا لكِ تشكيلة من نفس التصنيف</div>
            </div>
            <div className="products-grid">
              {similarProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="footer" style={{ borderTop: '1px solid rgba(200, 169, 110, 0.1)' }}>
        <div className="section-container">
          <h2 className="footer-logo">{settings.logoText}</h2>
          <p className="footer-copy">© {new Date().getFullYear()} {settings.footerText}</p>
        </div>
      </footer>

      <style jsx>{`
        .product-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: start;
        }
        .main-image-wrap {
          position: relative;
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          aspect-ratio: 4/5;
        }
        .main-product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .product-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--black);
          margin-bottom: 15px;
        }
        .product-meta {
          display: flex;
          gap: 15px;
          margin-bottom: 25px;
        }
        .stock-status {
          font-size: 0.9rem;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
        }
        .in-stock { background: #e6f7ed; color: #27ae60; }
        .out-of-stock { background: #fee7e7; color: #eb5757; }
        .category-tag {
          font-size: 0.9rem;
          color: #888;
        }
        .product-price-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 35px;
        }
        .current-price {
          font-size: 2.2rem;
          font-weight: 900;
          color: var(--gold-dark);
        }
        .old-price {
          font-size: 1.4rem;
          text-decoration: line-through;
          color: #aaa;
        }
        .product-description {
          margin-bottom: 40px;
          line-height: 1.8;
          color: #555;
        }
        .product-description h3 {
          font-size: 1.1rem;
          color: var(--black);
          margin-bottom: 10px;
          font-weight: 700;
        }
        .purchase-controls {
          display: flex;
          gap: 20px;
          margin-bottom: 40px;
        }
        .quantity-selector {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 12px;
          overflow: hidden;
        }
        .quantity-selector button {
          padding: 12px 20px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 1.2rem;
          transition: background 0.3s;
        }
        .quantity-selector button:hover { background: #f5f5f5; }
        .quantity-selector input {
          width: 50px;
          text-align: center;
          border: none;
          border-left: 1px solid #ddd;
          border-right: 1px solid #ddd;
          font-weight: 700;
        }
        .btn-add-cart-large {
          flex: 1;
          background: var(--black);
          color: var(--gold);
          border: none;
          padding: 15px 30px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .btn-add-cart-large:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.2);
          background: #1a1a1a;
        }
        .product-features-small {
          display: grid;
          gap: 12px;
          border-top: 1px solid #eee;
          padding-top: 30px;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.95rem;
          color: #666;
        }
        .breadcrumb {
          display: flex;
          gap: 10px;
          color: #888;
          font-size: 0.9rem;
        }
        .breadcrumb a:hover { color: var(--gold-dark); }
        .breadcrumb .current { color: var(--black); font-weight: 600; }

        @media (max-width: 992px) {
          .product-details-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .product-gallery { max-width: 500px; margin: 0 auto; width: 100%; }
        }
      `}</style>
    </main>
  );
}
