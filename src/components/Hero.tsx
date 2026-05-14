"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, limit, onSnapshot } from "firebase/firestore";

export default function Hero() {
  const [banner, setBanner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "banners"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setBanner({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <section className="hero">
      <div className="hero-bg">
        <Image
          src={banner?.image || "/images/hero.png"}
          alt={banner?.title || "Premium Abaya Collection"}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
      <div className="hero-overlay"></div>

      <div className="hero-content">
        <p className="hero-subtitle">{banner?.subtitle || "فخامة تليق بك"}</p>
        <h1 className="hero-title">
          {banner?.title || "أناقة العباية"}
          <span>{banner?.description || "بلمسة عصرية"}</span>
        </h1>
        <div className="hero-buttons">
          <Link href={banner?.link || "/abayas"} className="btn-primary">تسوقي الآن</Link>
          <Link href="/#collection" className="btn-outline">عرض المجموعات</Link>
        </div>
      </div>
    </section>
  );
}

