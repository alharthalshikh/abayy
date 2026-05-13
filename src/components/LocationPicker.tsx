"use client";
import { useEffect, useRef, useState } from "react";

interface LocationPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ lat, lng, onLocationChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Inject Leaflet CSS and JS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => initLeaflet();
      document.head.appendChild(script);
    } else if ((window as any).L) {
      initLeaflet();
    }

    function initLeaflet() {
      if (!mapRef.current || leafletMap.current) return;

      const L = (window as any).L;
      
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current).setView([lat, lng], 18);
      leafletMap.current = map;

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ar', {
        maxZoom: 20,
        attribution: 'Map data &copy; Google'
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', function (event: any) {
        const position = event.target.getLatLng();
        onLocationChange(
          parseFloat(position.lat.toFixed(6)),
          parseFloat(position.lng.toFixed(6))
        );
      });

      map.on('click', function (e: any) {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        onLocationChange(
          parseFloat(clickLat.toFixed(6)),
          parseFloat(clickLng.toFixed(6))
        );
      });

      setIsLoaded(true);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (leafletMap.current && markerRef.current && isLoaded) {
      const currentPos = markerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
        leafletMap.current.setView([lat, lng], leafletMap.current.getZoom());
        markerRef.current.setLatLng([lat, lng]);
      }
    }
  }, [lat, lng, isLoaded]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !isLoaded) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat: foundLat, lon: foundLng } = data[0];
        const newLat = parseFloat(foundLat);
        const newLng = parseFloat(foundLng);
        
        leafletMap.current.setView([newLat, newLng], 16);
        markerRef.current.setLatLng([newLat, newLng]);
        onLocationChange(newLat, newLng);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Search Bar Overlay */}
      <div style={{
        position: "absolute", top: 15, left: 15, right: 15,
        zIndex: 1000, display: "flex", gap: 8
      }}>
        <div style={{ display: 'flex', width: '100%', gap: 8 }}>
          <input 
            type="text" 
            placeholder="ابحث عن مكان (مثال: حي النرجس، الرياض)" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(new Event('submit') as any);
              }
            }}
            style={{
              flex: 1, padding: "10px 15px", borderRadius: "10px",
              border: "1px solid #ddd", boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              fontSize: "0.9rem", outline: "none"
            }}
          />
          <button 
            type="button"
            onClick={(e) => handleSearch(e as any)}
            disabled={isSearching}
            style={{
              padding: "10px 20px", background: "var(--gold)", color: "white",
              border: "none", borderRadius: "10px", fontWeight: "bold",
              cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
            }}
          >
            {isSearching ? "..." : "بحث"}
          </button>
        </div>
      </div>

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: 450,
          borderRadius: 14,
          border: "2px solid var(--gold)",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          zIndex: 1
        }}
      />
      {!isLoaded && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#fdfbf7", borderRadius: 14, zIndex: 10
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto 10px" }}></div>
            <p style={{ color: "#888", fontWeight: 600 }}>جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}
      <div style={{ 
        marginTop: 10, padding: "10px 15px", background: "rgba(200,169,110,0.1)", 
        borderRadius: 10, fontSize: "0.85rem", color: "var(--gold-dark)", fontWeight: 600,
        display: "flex", alignItems: "center", gap: 8
      }}>
        <span>💡</span>
        <span>اكتب اسم المكان في شريط البحث بالأعلى للوصول إليه بسرعة، ثم حرك الدبوس لتحديد الموقع بدقة.</span>
      </div>
    </div>
  );
}
