import { db } from "./src/lib/firebase.js";
import { collection, addDoc } from "firebase/firestore";

const products = [
  // Abayas
  {
    name: "عباية ملكي كريب فاخرة",
    price: 450,
    oldPrice: 550,
    category: "abaya",
    description: "عباية سوداء بقماش الكريب الملكي الفاخر، تتميز بقصة كلاسيكية أنيقة تناسب جميع المناسبات.",
    quantity: 10,
    imageUrl: "/images/hero.png",
    featured: true,
    createdAt: new Date()
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
    createdAt: new Date()
  },
  {
    name: "عباية كاجوال عملية",
    price: 280,
    category: "abaya",
    description: "عباية يومية مريحة بقماش خفيف وعملي، مثالية للدوام والخروجات السريعة.",
    quantity: 15,
    imageUrl: "/images/hero.png",
    featured: false,
    createdAt: new Date()
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
    createdAt: new Date()
  },
  // Bags
  {
    name: "حقيبة يد جلد تمساح",
    price: 350,
    oldPrice: 420,
    category: "bag",
    description: "حقيبة يد فاخرة مصنوعة من الجلد بنقشة التمساح، مجهزة بمسكة ذهبية أنيقة.",
    quantity: 4,
    imageUrl: "/images/bags.png",
    featured: true,
    createdAt: new Date()
  },
  {
    name: "حقيبة سهرة ميني ذهبية",
    price: 220,
    category: "bag",
    description: "حقيبة سهرة صغيرة مرصعة بلمسات ذهبية، مثالية لإكمال إطلالتك في المناسبات الكبرى.",
    quantity: 6,
    imageUrl: "/images/bags.png",
    featured: true,
    createdAt: new Date()
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
    createdAt: new Date()
  },
  {
    name: "حقيبة تسوق كبيرة واسعة",
    price: 290,
    category: "bag",
    description: "حقيبة واسعة تتسع لجميع احتياجاتك، مصنوعة من خامات عالية الجودة ومقاومة للاستخدام اليومي.",
    quantity: 0,
    imageUrl: "/images/bags.png",
    featured: false,
    createdAt: new Date()
  }
];

async function seed() {
  console.log("Starting to seed products...");
  for (const product of products) {
    try {
      const docRef = await addDoc(collection(db, "products"), product);
      console.log("Added product:", product.name, "with ID:", docRef.id);
    } catch (e) {
      console.error("Error adding product:", e);
    }
  }
  console.log("Finished seeding!");
}

seed();
