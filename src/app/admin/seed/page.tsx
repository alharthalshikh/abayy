"use client";
import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const products = [
  {
    name: "عباية ملكي كريب فاخرة",
    price: 450,
    oldPrice: 550,
    category: "abaya",
    description: "عباية سوداء بقماش الكريب الملكي الفاخر، تتميز بقصة كلاسيكية أنيقة تناسب جميع المناسبات.",
    quantity: 10,
    imageUrl: "/images/hero.png",
    featured: true,
  },
  {
    name: "عباية مخمل شتوية مطرزة",
    price: 620,
    oldPrice: 750,
    category: "abaya",
    description: "عباية مخملية دافئة بتطريز يدوي دقيق على الأكمام، تصميم عصري يجمع بين الدفء والفخامة.",
    quantity: 5,
    imageUrl: "/images/hero.png",
    featured: true,
  },
  {
    name: "حقيبة يد جلد تمساح",
    price: 350,
    oldPrice: 420,
    category: "bag",
    description: "حقيبة يد فاخرة مصنوعة من الجلد بنقشة التمساح، مجهزة بمسكة ذهبية أنيقة.",
    quantity: 4,
    imageUrl: "/images/bags.png",
    featured: true,
  },
  {
    name: "حقيبة سهرة ميني ذهبية",
    price: 220,
    category: "bag",
    description: "حقيبة سهرة صغيرة مرصعة بلمسات ذهبية، مثالية لإكمال إطلالتك في المناسبات الكبرى.",
    quantity: 6,
    imageUrl: "/images/bags.png",
    featured: true,
  },
  {
    name: "عباية كاجوال عملية",
    price: 280,
    category: "abaya",
    description: "عباية يومية مريحة بقماش خفيف وعملي، مثالية للدوام والخروجات السريعة.",
    quantity: 15,
    imageUrl: "/images/hero.png",
    featured: false,
  },
  {
    name: "عباية بشت انسيابية",
    price: 390,
    oldPrice: 450,
    category: "abaya",
    description: "عباية بتصميم البشت العربي الواسع، قماش انسيابي يعطي شعوراً بالراحة والتميز.",
    quantity: 8,
    imageUrl: "/images/hero.png",
    featured: false,
  },
  {
    name: "حقيبة كروس كلاسيك",
    price: 180,
    oldPrice: 250,
    category: "bag",
    description: "حقيبة عملية بكتف طويل، تصميم كلاسيكي يناسب مختلف الأذواق.",
    quantity: 12,
    imageUrl: "/images/bags.png",
    featured: false,
  },
  {
    name: "حقيبة تسوق كبيرة واسعة",
    price: 290,
    category: "bag",
    description: "حقيبة واسعة تتسع لجميع احتياجاتك، مصنوعة من خامات عالية الجودة ومقاومة للاستخدام اليومي.",
    quantity: 0,
    imageUrl: "/images/bags.png",
    featured: false,
  }
];

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSeed = async () => {
    setLoading(true);
    try {
      for (const product of products) {
        await addDoc(collection(db, "products"), {
          ...product,
          createdAt: new Date()
        });
      }
      setDone(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (error) {
      console.error("Seed error:", error);
      alert("حدث خطأ أثناء إضافة المنتجات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Navbar />
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c0c0c', color: '#fff', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--gold)', marginBottom: 20 }}>تجهيز المتجر بالمنتجات</h1>
        <p style={{ color: '#999', marginBottom: 30, maxWidth: 500 }}>سيتم إضافة 8 منتجات فاخرة (عبايات وحقائب) إلى متجرك الآن لتجربة التسوق.</p>
        
        {!done ? (
          <button 
            onClick={handleSeed} 
            disabled={loading}
            style={{ padding: '16px 40px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '18px', cursor: 'pointer' }}
          >
            {loading ? "⏳ جاري الإضافة..." : "🚀 ابدأ الإضافة الآن"}
          </button>
        ) : (
          <div style={{ color: '#4CAF50', fontWeight: 700 }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
            <p>تمت إضافة المنتجات بنجاح! جاري تحويلك للرئيسية...</p>
          </div>
        )}
      </div>
    </main>
  );
}
