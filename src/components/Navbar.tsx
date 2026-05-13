"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useSettings } from "@/context/SettingsContext";
import { useTheme } from "@/context/ThemeContext";

import CartDrawer from "./CartDrawer";

export default function Navbar() {
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      // Check if user is admin
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""} ${isMenuOpen ? "menu-open" : ""}`}>
      <div className="navbar-inner">
        <button 
          className="mobile-toggle" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </button>

        <Link href="/" className="navbar-logo">
          {settings.logoText}
        </Link>

        <div className={`navbar-links ${isMenuOpen ? "active" : ""}`}>
          <Link href="/abayas" onClick={() => setIsMenuOpen(false)}>العبايات</Link>
          <Link href="/bags" onClick={() => setIsMenuOpen(false)}>الحقائب</Link>
          <Link href="/about" onClick={() => setIsMenuOpen(false)}>من نحن</Link>
          <Link href="/favorites" onClick={() => setIsMenuOpen(false)} className="nav-fav-link" style={{ position: 'relative' }}>
            المفضلة
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <FavoritesCounter />
          </Link>
          {isAdmin && (
            <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="admin-link">لوحة التحكم</Link>
          )}
        </div>

        <div className="navbar-actions">
          {authLoading ? (
            <div className="auth-loader-skeleton"></div>
          ) : user ? (
            <div className="user-profile-nav">
              <span className="user-name-hint">مرحباً، {user.displayName?.split(' ')[0] || 'عميلنا'}</span>
              <button onClick={handleLogout} className="btn-logout" title="تسجيل الخروج">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-login">تسجيل الدخول</Link>
          )}
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            title={theme === 'light' ? 'الوضع الليلي' : 'الوضع النهاري'}
            style={{
              background: 'none', border: 'none', color: '#f5f0ea', 
              cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            {theme === 'light' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="18.36" x2="5.64" y2="19.78"></line><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"></line></svg>
            )}
          </button>
          <button className="btn-cart" onClick={() => setIsCartOpen(true)}>
            سلة التسوق
            <CartCounter />
          </button>
        </div>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </nav>
  );
}

import { onSnapshot } from "firebase/firestore";
import { usePathname } from "next/navigation";

function FavoritesCounter() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const unsubscribeSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const favs = docSnap.data().favorites || [];
            setCount(favs.length);
          } else {
            setCount(0);
          }
        });
        return () => unsubscribeSnap();
      } else {
        setCount(0);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (count === 0 || pathname === '/favorites') return null;

  return (
    <span style={{
      position: 'absolute',
      top: '-8px',
      left: '-12px',
      background: '#ff4757',
      color: 'white',
      fontSize: '10px',
      fontWeight: 'bold',
      padding: '2px 6px',
      borderRadius: '10px',
      border: '2px solid var(--black)',
      zIndex: 5
    }}>
      {count}
    </span>
  );
}

function CartCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const total = cart.reduce((acc: number, item: any) => acc + item.qty, 0);
      setCount(total);
    };

    updateCount();
    window.addEventListener('cartUpdated', updateCount);
    return () => window.removeEventListener('cartUpdated', updateCount);
  }, []);

  if (count === 0) return null;
  return <span className="cart-badge">{count}</span>;
}
