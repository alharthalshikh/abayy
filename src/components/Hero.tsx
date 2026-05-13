"use client";
import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg">
        <Image
          src="/images/hero.png"
          alt="Premium Abaya Collection"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
      <div className="hero-overlay"></div>

      <div className="hero-content">
        <p className="hero-subtitle">فخامة تليق بك</p>
        <h1 className="hero-title">
          أناقة العباية
          <span>بلمسة عصرية</span>
        </h1>
        <p className="hero-desc">
          اكتشفي مجموعتنا الحصرية من العبايات والحقائب المصممة بعناية لتبرز جمالك في كل مناسبة
        </p>
        <div className="hero-buttons">
          <Link href="/abayas" className="btn-primary">تسوقي الآن</Link>
          <Link href="/#collection" className="btn-outline">عرض المجموعات</Link>
        </div>
      </div>
    </section>
  );
}
