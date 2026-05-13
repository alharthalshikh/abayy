"use client";
import { useState, useEffect } from "react";
import { Product } from "@/types";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import ProductCard from "./ProductCard";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        if (!isFirebaseConfigured()) {
          throw new Error("Firebase not configured");
        }
        const q = query(collection(db, "products"), where("featured", "==", true), limit(4));
        const querySnapshot = await getDocs(q);
        const prods = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        if (prods.length === 0) {
          setProducts([]);
        } else {
          setProducts(prods);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="products-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="product-card" style={{ opacity: 0.4 }}>
            <div className="product-image" style={{ background: '#eee' }}></div>
            <div className="product-details">
              <div style={{ height: 16, background: '#eee', borderRadius: 4, marginBottom: 8, width: '70%' }}></div>
              <div style={{ height: 20, background: '#eee', borderRadius: 4, width: '40%' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="products-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
