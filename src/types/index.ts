export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'abaya' | 'bag';
  imageUrl: string;
  quantity: number;
  oldPrice?: number;
  lowStockThreshold?: number;
  featured: boolean;
  createdAt?: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
}
