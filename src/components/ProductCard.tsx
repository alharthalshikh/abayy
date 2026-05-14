"use client";
import Image from "next/image";
import { Product } from "@/types";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface ProductCardProps {
  product: Product;
}

import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";

export default function ProductCard({ product }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  const isSoldOut = product.quantity === 0;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        // Listen to favorites changes
        const userRef = doc(db, "users", user.uid);
        const unsubFavs = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const favorites = doc.data().favorites || [];
            setIsFavorite(favorites.includes(product.id));
          }
        });
        return () => unsubFavs();
      } else {
        setUserId(null);
        setIsFavorite(false);
      }
    });
    return () => unsubscribe();
  }, [product.id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) {
      showToast("يرجى تسجيل الدخول لإضافة المنتج للمفضلة", "info");
      setTimeout(() => router.push('/login'), 1500);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, {
        favorites: isFavorite ? arrayRemove(product.id) : arrayUnion(product.id)
      }, { merge: true });
      
      showToast(isFavorite ? "تمت الإزالة من المفضلة" : "تمت الإضافة للمفضلة ❤️", isFavorite ? "info" : "success");
    } catch (error) {
      console.error("Error updating favorites:", error);
      showToast("حدث خطأ ما", "error");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    if (product.quantity === 0) {
      showToast("عذراً، هذا المنتج غير متوفر حالياً", "error");
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((item: any) => item.id === product.id);
    
    if (existing) {
      if (existing.qty + 1 > product.quantity) {
        showToast(`لا يمكنك إضافة المزيد، الكمية في السلة وصلت للحد الأقصى المتوفر (${product.quantity})`, "error");
        return;
      }
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl,
        qty: 1,
        stock: product.quantity
      });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    showToast(`تمت إضافة "${product.name}" إلى السلة بنجاح! 🛍️`, "success");
  };

  const { settings } = useSettings();

  return (
    <div className="product-card" onClick={() => router.push(`/product/${product.id}`)} style={{ cursor: 'pointer' }}>
      <div className="product-image">
        <Image
          src={product.imageUrl || "/images/hero.png"}
          alt={product.name}
          fill
          sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 25vw"
          style={{ objectFit: 'cover' }}
        />
        <div className={`product-badge ${isSoldOut ? 'sold-out' : (product.oldPrice && product.oldPrice > product.price ? 'discount' : '')}`}>
          {isSoldOut ? 'نفذت الكمية' : (
            product.oldPrice && product.oldPrice > product.price 
              ? `خصم ${Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%`
              : 'جديد'
          )}
        </div>
        <button 
          className={`btn-wishlist ${isFavorite ? 'active' : ''}`}
          onClick={toggleFavorite}
          disabled={loading}
          title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
      <div className="product-details">
        <h4 className="product-name">{product.name}</h4>

        <div className="product-price-wrapper">
          <span className="product-price">{product.price} {settings.currencySymbol}</span>
          {product.oldPrice ? <span className="product-old-price">{product.oldPrice} {settings.currencySymbol}</span> : null}
        </div>
        <button
          className="btn-add-cart"
          disabled={isSoldOut}
          onClick={(e) => {
            e.stopPropagation();
            addToCart();
          }}
        >
          {isSoldOut ? "غير متوفر" : "أضف للسلة"}
        </button>
      </div>
    </div>
  );
}
