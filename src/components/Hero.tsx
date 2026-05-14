"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

export default function Hero() {
  const [banners, setBanners] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "banners"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(bannerList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-slide logic
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading) return <div className="hero-skeleton"></div>;
  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <section className="hero">
      <div className="hero-slider">
        {banners.map((banner, index) => (
          <div 
            key={banner.id} 
            className={`hero-slide ${index === currentIndex ? 'active' : ''}`}
            style={{ opacity: index === currentIndex ? 1 : 0, transition: 'opacity 1s ease-in-out' }}
          >
            <div className="hero-bg">
              <Image
                src={banner.image || "/images/hero.png"}
                alt={banner.title || "Premium Abaya Collection"}
                fill
                priority={index === 0}
                sizes="100vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="hero-overlay"></div>

            <div className="hero-content">
              <p className="hero-subtitle">{banner.subtitle || "فخامة تليق بك"}</p>
              <h1 className="hero-title">
                {banner.title || "أناقة العباية"}
                <span>{banner.description || "بلمسة عصرية"}</span>
              </h1>
              <div className="hero-buttons">
                <Link href={banner.link || "/abayas"} className="btn-primary">تسوقي الآن</Link>
                <Link href="/#collection" className="btn-outline">عرض المجموعات</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="hero-dots">
          {banners.map((_, index) => (
            <button 
              key={index} 
              className={`hero-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}


