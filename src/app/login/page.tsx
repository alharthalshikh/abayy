'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Mail, Eye, EyeOff, ChevronLeft, User, Phone, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';

import { useSettings } from '@/context/SettingsContext';

export default function LoginPage() {
  const { settings } = useSettings();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle animation for the premium background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        o: Math.random() * 0.5 + 0.1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 169, 110, ${p.o})`; ctx.fill();
      });
      
      // Connect nearby particles with faint lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(200, 169, 110, ${0.08 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isFirebaseConfigured()) {
      setError('الرجاء إعداد Firebase أولاً (API Keys)');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('كلمات المرور غير متطابقة');
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Update profile name
        await updateProfile(user, { displayName: formData.name });

        // Save to Firestore (non-blocking - don't fail login if Firestore is offline)
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: 'user',
            createdAt: serverTimestamp()
          });
        } catch (firestoreErr) {
          console.warn('Could not save user to Firestore:', firestoreErr);
        }
      }
      
      // Redirect to home or dashboard
      router.push('/');
    } catch (err: any) {
      console.error(err);
      let message = 'حدث خطأ غير متوقع';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'هذا البريد الإلكتروني مسجل بالفعل';
      } else if (err.code === 'auth/weak-password') {
        message = 'كلمة المرور ضعيفة جداً';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError('الرجاء إعداد Firebase أولاً (API Keys)');
      return;
    }

    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        // If popup is blocked by COOP, try redirect
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
      const user = result.user;

      // Save to Firestore (non-blocking)
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            role: 'user',
            createdAt: serverTimestamp()
          });
        }
      } catch (firestoreErr) {
        console.warn('Could not save user to Firestore:', firestoreErr);
      }

      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError('فشل تسجيل الدخول بواسطة جوجل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-container">
      <canvas ref={canvasRef} className="lp-bg-canvas" />
      
      {/* Dynamic Background Elements */}
      <div className="lp-light lp-light-1" />
      <div className="lp-light lp-light-2" />

      <div className="lp-content">
        {/* Left Side: Branding (Hidden on mobile) */}
        <div className="lp-info-side">
          <div className="lp-info-inner">
            <div className="lp-logo-box">
              <div className="lp-logo-glow" />
              <div className="lp-logo-text">{settings.logoText.slice(0, 2).toUpperCase()}</div>
            </div>
            <h1 className="lp-brand-name">{settings.storeName}</h1>

            <p className="lp-brand-tagline">فخامة تليق بكِ، تصاميم تجسد الأناقة والتميز.</p>
            
            <div className="lp-features-list">
              <div className="lp-feature-item">
                <div className="lp-feature-icon">✨</div>
                <div>
                  <h4>تصاميم حصرية</h4>
                  <p>قطع فنية مصممة خصيصاً لذوقك الرفيع.</p>
                </div>
              </div>
              <div className="lp-feature-item">
                <div className="lp-feature-icon">💎</div>
                <div>
                  <h4>خامات فاخرة</h4>
                  <p>نختار أجود أنواع الأقمشة لضمان الراحة والأناقة.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="lp-form-side">
          <div className="lp-card">
            <div className="lp-card-header">
              <div className="lp-tabs">
                <button 
                  className={`lp-tab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => setMode('login')}
                >
                  تسجيل الدخول
                </button>
                <button 
                  className={`lp-tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => setMode('signup')}
                >
                  إنشاء حساب
                </button>
                <div className="lp-tab-active-bg" style={{ transform: mode === 'login' ? 'translateX(0)' : 'translateX(-100%)' }} />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="lp-form">
              <h2 className="lp-welcome-text">
                <Sparkles size={20} className="lp-header-sparkle" />
                {mode === 'login' ? 'مرحباً بكِ مجدداً' : 'انضمي إلى عالمنا'}
                <Sparkles size={20} className="lp-header-sparkle" />
              </h2>
              <p className="lp-welcome-sub">
                {mode === 'login' ? 'سجلي دخولك لتجربة تسوق فريدة' : 'أنشئي حسابك للتمتع بمميزات حصرية'}
              </p>

              {error && (
                <div className="lp-error-box">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {mode === 'signup' && (
                <div className="lp-input-group">
                  <label><User size={16} /> الاسم بالكامل</label>
                  <input 
                    type="text" 
                    placeholder="اسمك الكريم" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              )}

              <div className="lp-input-group">
                <label><Mail size={16} /> البريد الإلكتروني</label>
                <input 
                  type="email" 
                  placeholder="example@email.com" 
                  required 
                  dir="ltr" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              {mode === 'signup' && (
                <div className="lp-input-group">
                  <label><Phone size={16} /> رقم الجوال</label>
                  <input 
                    type="tel" 
                    placeholder="05xxxxxxxx" 
                    dir="ltr" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              )}

              <div className="lp-input-group">
                <label><Lock size={16} /> كلمة المرور</label>
                <div className="lp-password-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    required 
                    dir="ltr"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    style={{ paddingRight: '50px' }}
                  />
                  <button type="button" className="lp-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="lp-input-group">
                  <label><Lock size={16} /> تأكيد كلمة المرور</label>
                  <div className="lp-password-wrapper">
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      required 
                      dir="ltr"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    />
                    <button type="button" className="lp-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="lp-forgot-pass">
                  <button type="button">نسيتِ كلمة المرور؟</button>
                </div>
              )}

              <button type="submit" className="lp-submit-btn" disabled={loading}>
                {loading ? <span className="lp-loader" /> : (
                  <>{mode === 'login' ? 'دخول' : 'إنشاء الحساب'} <Sparkles size={18} /></>
                )}
              </button>

              <div className="lp-divider">
                <span>أو المتابعة بواسطة</span>
              </div>

              <div className="lp-social-btns">
                <button type="button" className="lp-social-btn" onClick={handleGoogleLogin} disabled={loading}>
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
              </div>
            </form>

            <Link href="/" className="lp-back-link">
              <ChevronLeft size={16} /> العودة للمتجر
            </Link>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .lp-container {
          min-height: 100vh;
          background-color: #0c0c0c;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: var(--font-cairo), sans-serif;
        }

        .lp-bg-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }

        .lp-light {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.1;
          z-index: 2;
        }

        .lp-light-1 {
          width: 500px;
          height: 500px;
          background: #c8a96e;
          top: -100px;
          right: -100px;
          animation: lp-float-bg 10s infinite ease-in-out;
        }

        .lp-light-2 {
          width: 400px;
          height: 400px;
          background: #e8d5a3;
          bottom: -100px;
          left: -100px;
          animation: lp-float-bg 15s infinite ease-in-out reverse;
        }

        .lp-header-sparkle {
          color: #c8a96e;
          display: inline-block;
          vertical-align: middle;
          margin: 0 10px;
          opacity: 0.8;
          animation: lp-sparkle-pulse 2s infinite ease-in-out;
        }

        @keyframes lp-sparkle-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes lp-float-bg {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 40px); }
        }

        .lp-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1100px;
          display: flex;
          padding: 40px;
        }

        .lp-info-side {
          flex: 1;
          display: flex;
          align-items: center;
          padding-left: 80px;
          color: white;
        }

        .lp-logo-box {
          width: 80px;
          height: 80px;
          background: #1a1a1a;
          border: 2px solid #c8a96e;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 30px;
          border-radius: 12px;
        }

        .lp-logo-glow {
          position: absolute;
          inset: -10px;
          background: #c8a96e;
          filter: blur(20px);
          opacity: 0.2;
        }

        .lp-logo-text {
          font-family: var(--font-playfair), serif;
          font-size: 32px;
          font-weight: 700;
          color: #c8a96e;
          z-index: 2;
        }

        .lp-brand-name {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #c8a96e 0%, #fff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .lp-brand-tagline {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 50px;
          line-height: 1.6;
        }

        .lp-features-list {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .lp-feature-item {
          display: flex;
          gap: 20px;
        }

        .lp-feature-icon {
          width: 45px;
          height: 45px;
          background: rgba(200, 169, 110, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #c8a96e;
          flex-shrink: 0;
        }

        .lp-feature-item h4 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .lp-feature-item p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .lp-form-side {
          width: 450px;
          flex-shrink: 0;
        }

        .lp-card {
          background: rgba(26, 26, 26, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 30px;
          padding: 40px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
          animation: lp-slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes lp-slideIn {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .lp-tabs {
          display: flex;
          background: rgba(0, 0, 0, 0.4);
          padding: 6px;
          border-radius: 18px;
          margin-bottom: 35px;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .lp-tab {
          flex: 1;
          padding: 12px 0;
          font-size: 15px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
        }

        .lp-tab.active {
          color: #000;
        }

        .lp-tab-active-bg {
          position: absolute;
          top: 6px;
          bottom: 6px;
          right: 6px;
          width: calc(50% - 6px);
          background: linear-gradient(135deg, #c8a96e 0%, #e8d5a3 100%);
          border-radius: 14px;
          z-index: 1;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .lp-welcome-text {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #fff 0%, #c8a96e 50%, #fff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
          filter: drop-shadow(0 2px 10px rgba(200, 169, 110, 0.2));
        }

        .lp-welcome-sub {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          margin-bottom: 40px;
          position: relative;
          padding-bottom: 15px;
        }

        .lp-welcome-sub::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #c8a96e, transparent);
        }

        .lp-error-box {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.2);
          color: #f44336;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 25px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          animation: lp-shake 0.4s ease;
        }

        @keyframes lp-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .lp-input-group {
          margin-bottom: 24px;
        }

        .lp-input-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(200, 169, 110, 0.8);
          margin-bottom: 12px;
          padding-right: 5px;
        }

        .lp-input-group input {
          width: 100%;
          background: rgba(10, 10, 10, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 15px;
          padding: 16px 20px;
          color: white;
          font-size: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .lp-input-group input:focus {
          outline: none;
          border-color: #c8a96e;
          background: rgba(200, 169, 110, 0.03);
          box-shadow: 0 0 0 4px rgba(200, 169, 110, 0.05);
          transform: translateY(-1px);
        }

        .lp-password-wrapper {
          position: relative;
        }

        .lp-eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          color: #c8a96e;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
          cursor: pointer;
          z-index: 10;
        }

        .lp-eye-btn:hover {
          color: #fff;
          background: rgba(200, 169, 110, 0.2);
        }

        /* Autofill styles to prevent white background from browser */
        .lp-input-group input:-webkit-autofill,
        .lp-input-group input:-webkit-autofill:hover, 
        .lp-input-group input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1a inset;
          transition: background-color 5000s ease-in-out 0s;
        }

        .lp-forgot-pass {
          text-align: left;
          margin-top: -10px;
          margin-bottom: 25px;
        }

        .lp-forgot-pass button {
          background: none;
          color: #c8a96e;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .lp-submit-btn {
          width: 100%;
          background: #c8a96e;
          color: #000;
          font-size: 16px;
          font-weight: 800;
          padding: 16px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 25px rgba(200, 169, 110, 0.2);
          cursor: pointer;
          border: none;
        }

        .lp-submit-btn:hover {
          transform: translateY(-2px);
          background: #e8d5a3;
          box-shadow: 0 15px 35px rgba(200, 169, 110, 0.4);
        }

        .lp-social-btn {
          width: 100%;
          background: white;
          color: #000;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 700;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
        }

        .lp-back-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 35px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 14px;
          font-weight: 600;
          transition: color 0.3s ease;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .lp-info-side { display: none; }
          .lp-form-side { width: 100%; max-width: 450px; }
          .lp-content { justify-content: center; }
        }
      ` }} />
    </div>
  );
}
