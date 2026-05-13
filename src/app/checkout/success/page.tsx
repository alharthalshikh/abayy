"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');

  return (
    <div style={{ paddingTop: '150px', paddingBottom: '100px' }}>
      <div style={{ 
        width: '100px', height: '100px', background: '#f0fff4', borderRadius: '50%', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px' 
      }}>
        <span style={{ fontSize: '3rem' }}>🎉</span>
      </div>

      <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--black)', marginBottom: '16px' }}>شكراً لكِ، تم استلام طلبك!</h1>
      <p style={{ color: '#666', fontSize: '18px', maxWidth: '500px', margin: '0 auto 30px', lineHeight: 1.6 }}>
        يسعدنا اختيارك لمتجر أثير. لقد تم تسجيل طلبك بنجاح وسنقوم بالتواصل معك قريباً لتأكيد التوصيل.
      </p>

      {orderId && (
        <div style={{ background: '#f8f8f8', padding: '20px', borderRadius: '16px', display: 'inline-block', marginBottom: '40px', border: '1px dashed #ddd' }}>
          <span style={{ display: 'block', fontSize: '14px', color: '#888', marginBottom: '4px' }}>رقم الطلب الخاص بك</span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gold-dark)', letterSpacing: '1px' }}>#{orderId.slice(-6).toUpperCase()}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <Link href="/" style={{ padding: '16px 32px', background: 'var(--black)', color: 'white', borderRadius: '12px', fontWeight: 700, textDecoration: 'none' }}>
          العودة للمتجر
        </Link>
        <Link href="/favorites" style={{ padding: '16px 32px', border: '1px solid #ddd', color: '#555', borderRadius: '12px', fontWeight: 700, textDecoration: 'none' }}>
          مشاهدة المفضلة
        </Link>
      </div>

      <div style={{ marginTop: '60px', padding: '20px', background: '#fff9f0', display: 'inline-block', borderRadius: '12px' }}>
        <p style={{ color: '#8b6e3f', fontSize: '14px' }}>
          💡 نصيحة: يمكنك تصوير هذه الشاشة للاحتفاظ برقم الطلب.
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', textAlign: 'center' }}>
      <Navbar />
      <Suspense fallback={
        <div style={{ paddingTop: '200px' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p>جاري تحميل بيانات الطلب...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
