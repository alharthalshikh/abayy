"use client";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";

export default function AboutPage() {
  const { settings } = useSettings();

  return (
    <main>
      <Navbar />

      {/* Hero Banner */}
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: 'url(/images/hero.png)' }}></div>
        <div className="page-hero-overlay"></div>
        <div className="page-hero-content">
          <nav className="breadcrumb">
            <Link href="/">الرئيسية</Link>
            <span>/</span>
            <span>من نحن</span>
          </nav>
          <h1>من نحن</h1>
          <p>قصتنا وشغفنا بالتميز</p>
        </div>
      </section>

      {/* About Content */}
      <section className="section" style={{ background: 'var(--white)' }}>
        <div className="section-container">
          <div className="about-content">
            {/* Story */}
            <div className="about-block">
              <div className="about-icon">✨</div>
              <h2>قصتنا</h2>
              <p>
                بدأت {settings.storeName} كحلم صغير نابع من شغف عميق بالأناقة والتميز. نؤمن بأن المرأة تستحق أن تشعر بالثقة والجمال في كل لحظة، ولهذا نقدم لها عبايات وحقائب مصممة بأيدٍ ماهرة تجمع بين الأصالة والعصرية.
              </p>
            </div>

            {/* Mission */}
            <div className="about-block">
              <div className="about-icon">🎯</div>
              <h2>رسالتنا</h2>
              <p>
                نسعى لأن نكون الوجهة الأولى للمرأة العربية الباحثة عن الفخامة والرقي. نلتزم بتقديم أعلى معايير الجودة في كل قطعة نصنعها، مع الحفاظ على الهوية العربية الأصيلة بلمسة عصرية فريدة.
              </p>
            </div>

            {/* Values */}
            <div className="about-values-grid">
              <div className="about-value-card">
                <span className="value-icon">👗</span>
                <h3>جودة فائقة</h3>
                <p>نختار أفخم الأقمشة ونهتم بأدق التفاصيل لنضمن لكِ تجربة استثنائية</p>
              </div>
              <div className="about-value-card">
                <span className="value-icon">🎨</span>
                <h3>تصاميم حصرية</h3>
                <p>كل تصميم هو قطعة فنية فريدة تعكس ذوقاً رفيعاً وأناقة لا تُضاهى</p>
              </div>
              <div className="about-value-card">
                <span className="value-icon">💎</span>
                <h3>فخامة مطلقة</h3>
                <p>من التغليف إلى التوصيل، كل تفصيلة مصممة لتمنحكِ تجربة تسوق راقية</p>
              </div>
              <div className="about-value-card">
                <span className="value-icon">🤝</span>
                <h3>خدمة مميزة</h3>
                <p>فريقنا جاهز دائماً لمساعدتك والإجابة على استفساراتك بكل سرور</p>
              </div>
            </div>

            {/* CTA */}
            <div className="about-cta">
              <h2>ابدئي رحلتك مع {settings.logoText}</h2>
              <p>اكتشفي تشكيلاتنا الحصرية واختاري ما يناسب ذوقك الرفيع</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/abayas" className="btn-primary" style={{ borderRadius: '10px' }}>تصفح العبايات</Link>
                <Link href="/bags" className="btn-outline" style={{ borderColor: 'var(--gold)', color: 'var(--gold)', borderRadius: '10px' }}>تصفح الحقائب</Link>
              </div>
            </div>
          </div>
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
          <p className="footer-copy">© {new Date().getFullYear()} {settings.storeName}. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </main>
  );
}
