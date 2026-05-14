"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface StoreSettings {
  storeName: string;
  currency: string;
  currencySymbol: string;
  whatsappNumber: string;
  footerText: string;
  termsAndConditions: string;
  logoText: string;
  logo?: string;
  // Shipping settings
  fixedDeliveryFee: number;
  freeDeliveryThreshold: number;
  pricePerKm: number;
  minimumOrder: number;
  storeLat: number;
  storeLng: number;
  // Social links
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
  facebook?: string;
}

interface SettingsContextType {
  settings: StoreSettings;
  loading: boolean;
}

const defaultSettings: StoreSettings = {
  storeName: "أثير للعبايات",
  currency: "ريال سعودي",
  currencySymbol: "ر.س",
  whatsappNumber: "966500000000",
  footerText: "ATHEER ABAYA. All Rights Reserved.",
  termsAndConditions: "",
  logoText: "ATHEER",
  logo: "",
  fixedDeliveryFee: 25,
  freeDeliveryThreshold: 500,
  pricePerKm: 5,
  minimumOrder: 100,
  storeLat: 24.7136,
  storeLng: 46.6753
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage for instant load
  useEffect(() => {
    const saved = localStorage.getItem('store_settings_cache');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing settings cache:", e);
      }
    }
  }, []);

  useEffect(() => {
    // Listen to store config
    const unsubStore = onSnapshot(doc(db, "settings", "store_config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({
          ...prev,
          storeName: data.storeName || prev.storeName,
          currency: data.currency || prev.currency,
          currencySymbol: data.currencySymbol || prev.currencySymbol,
          whatsappNumber: data.whatsappNumber || prev.whatsappNumber,
          footerText: data.footerText || prev.footerText,
          termsAndConditions: data.termsAndConditions || prev.termsAndConditions,
          logoText: data.logoText || prev.logoText || data.storeName,
          logo: data.logo || prev.logo
        }));
      }
    });

    // Listen to shipping config
    const unsubShipping = onSnapshot(doc(db, "settings", "shipping_config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({
          ...prev,
          fixedDeliveryFee: data.fixedDeliveryFee ?? prev.fixedDeliveryFee,
          freeDeliveryThreshold: data.freeDeliveryThreshold ?? prev.freeDeliveryThreshold,
          pricePerKm: data.pricePerKm ?? prev.pricePerKm,
          minimumOrder: data.minimumOrder ?? prev.minimumOrder,
          storeLat: data.storeLat ?? prev.storeLat,
          storeLng: data.storeLng ?? prev.storeLng,
          instagram: data.instagram,
          snapchat: data.snapchat,
          tiktok: data.tiktok,
          facebook: data.facebook,
        }));
      }
      setLoading(false);
    });

    return () => {
      unsubStore();
      unsubShipping();
    };
  }, []);

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (settings !== defaultSettings) {
      localStorage.setItem('store_settings_cache', JSON.stringify(settings));
    }
  }, [settings]);


  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
