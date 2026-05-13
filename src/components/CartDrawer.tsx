"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string; // Unified naming
  qty: number;
  stock: number;
}

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { showToast } = useToast();

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setItems(cart);
  };

  useEffect(() => {
    if (isOpen) {
      loadCart();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    const handleCartUpdate = () => loadCart();
    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const updateQty = (id: string, delta: number) => {
    let limitReached = false;
    const updated = items.map(item => {
      if (item.id === id) {
        if (delta > 0 && item.qty + delta > item.stock) {
          limitReached = true;
          showToast(`عذراً، الكمية المتوفرة هي ${item.stock} فقط`, "info");
          return item;
        }
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    });
    
    if (!limitReached) {
      setItems(updated);
      localStorage.setItem('cart', JSON.stringify(updated));
      window.dispatchEvent(new Event('cartUpdated'));
    }
  };

  const removeItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cartUpdated'));
    showToast("تم حذف المنتج من السلة", "info");
  };

  const { settings } = useSettings();
  const total = items.reduce((acc, item) => acc + (item.price * item.qty), 0);

  if (!isOpen) return null;

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-drawer" onClick={e => e.stopPropagation()}>
        <div className="cart-header">
          <h2>سلة التسوق ({items.length})</h2>
          <button className="btn-close-cart" onClick={onClose}>✕</button>
        </div>

        <div className="cart-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="empty-icon">🛍️</div>
              <p>سلتك فارغة حالياً</p>
              <button onClick={onClose} className="btn-shop-now">ابدأ التسوق</button>
            </div>
          ) : (
            <div className="cart-items-list">
              {items.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="item-img">
                    <Image src={item.image || '/images/hero.png'} alt={item.name} width={100} height={120} style={{ objectFit: 'cover' }} />
                  </div>
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <span className="item-price">{item.price} {settings.currencySymbol}</span>
                    <div className="item-controls">
                      <div className="qty-picker">
                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)}>+</button>
                      </div>
                      <button className="btn-remove" onClick={() => removeItem(item.id)}>حذف</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>المجموع الفرعي:</span>
              <span className="total-amount">{total} {settings.currencySymbol}</span>
            </div>
            <p className="shipping-hint">الضرائب ورسوم التوصيل تحسب عند الدفع</p>
            <Link href="/checkout" onClick={onClose} style={{ display: 'block', textDecoration: 'none' }}>
              <button className="btn-checkout">
                إتمام الطلب
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
