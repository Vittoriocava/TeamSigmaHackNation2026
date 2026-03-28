"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";

export interface MapPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "fog" | "conquered" | "decaying" | "enemy" | "current";
  type?: string;
}

interface GameMapProps {
  pois: MapPOI[];
  center: [number, number];
  zoom?: number;
  onPoiClick?: (poi: MapPOI) => void;
  showFog?: boolean;
  userPosition?: [number, number] | null;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  fog: "#6B7280",
  conquered: "#10B981",
  decaying: "#F59E0B",
  enemy: "#EF4444",
  current: "#6C3CE1",
};

export function GameMap({
  pois,
  center,
  zoom = 19, // Zoom iniziale ravvicinato (quartiere)
  onPoiClick,
  showFog = true,
  userPosition,
  className = "",
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const fogLayerRef = useRef<L.GeoJSON | null>(null);

  const [currentPos, setCurrentPos] = useState<[number, number] | null>(userPosition || center);
  const [exploredAreas, setExploredAreas] = useState<[number, number][]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (userPosition) setCurrentPos(userPosition);
  }, [userPosition]);

  // 1. INIZIALIZZAZIONE MAPPA, PANES E OTTIMIZZAZIONI
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      minZoom: 13,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
      // FIX VISIVO: Renderizza l'SVG della nebbia molto oltre i bordi per scorrimenti fluidi
      renderer: L.svg({ padding: 5 }), 
    });

    // --- CREAZIONE DEI LIVELLI (Z-INDEX) ---
    map.createPane("fogPane");
    map.getPane("fogPane")!.style.zIndex = "390";
    
    map.createPane("poiPane");
    map.getPane("poiPane")!.style.zIndex = "410";
    
    map.createPane("userPane");
    map.getPane("userPane")!.style.zIndex = "420";

    // --- CARICAMENTO MAPPA BASE E OVER-FETCHING ---
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
      keepBuffer: 8, // Carica un'area enorme per scorrimenti fluidi
      updateWhenIdle: false, // Scarica mentre trascini
    }).addTo(map);

    mapInstance.current = map;

    // --- FIX PER IL BUG DELLE MATTONELLE TAGLIATE (Gray Tile Bug) ---
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapRef.current);

    // --- SIMULAZIONE GPS CON CLICK DA PC ---
    map.on("click", (e: L.LeafletMouseEvent) => {
      setCurrentPos([e.latlng.lat, e.latlng.lng]);
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstance.current = null;
      // Pulizia profonda per React Strict Mode
      fogLayerRef.current = null; 
      markersRef.current = [];
    };
  }, []);

  // 2. TRACCIAMENTO AREE ESPLORATE (Passi del giocatore)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog || !currentPos) return;

    setExploredAreas((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        const dist = map.distance(last, currentPos);
        // Salviamo ogni 25 metri per una scia fluida con cerchi da 100m
        if (dist < 25) return prev; 
      }
      return [...prev, currentPos];
    });
    
    // Centra la mappa sul giocatore quando si muove
    map.panTo(currentPos, { animate: true, duration: 0.5 });
  }, [currentPos, showFog]);

  // 3. DISEGNO DEL FOG OF WAR (Logica Torre di Zelda Integrata)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog) {
      setIsReady(true);
      return;
    }

    // Le coordinate del "mondo intero"
    let fogPolygon = turf.bboxPolygon([-180, -90, 180, 90]);

    // Raccogliamo tutti i "buchi" da fare nella nebbia
    let allHoles: any[] = [];

    // --- LOGICA A: Cerchi dei passi del giocatore (Raggio piccolo: 100m) ---
    if (exploredAreas.length > 0) {
      const walkingCircles = exploredAreas.map((pos) =>
        turf.circle([pos[1], pos[0]], 100, { units: "meters", steps: 32 })
      );
      allHoles = [...allHoles, ...walkingCircles];
    }

    // --- LOGICA B (TORRE DI ZELDA): Cerchi enormi dei POI conquistati (Raggio enorme: 1km) ---
    const conqueredPois = pois.filter(p => p.status === "conquered" || p.status === "current");
    if (conqueredPois.length > 0) {
      const poiCircles = conqueredPois.map((poi) =>
        turf.circle([poi.lng, poi.lat], 350, { units: "meters", steps: 64 }) // 1 km di luce!
      );
      allHoles = [...allHoles, ...poiCircles];
    }

    // --- FUSIONE E TAGLIO ---
    if (allHoles.length > 0) {
      // Fondiamo insieme tutti i cerchi (piccoli e grandi)
      let mergedExploration = allHoles[0];
      for (let i = 1; i < allHoles.length; i++) {
        mergedExploration = turf.union(turf.featureCollection([mergedExploration, allHoles[i]])) as any;
      }

      // Ritagliamo l'area esplorata fusa dalla nebbia gigante
      try {
        // FIX: Sintassi corretta per Turf.js v7+
        const featuresToIntersect = turf.featureCollection([fogPolygon, mergedExploration]);
        const difference = turf.difference(featuresToIntersect);
        
        if (difference) {
          fogPolygon = difference as any;
        }
      } catch (error) {
        console.error("Errore nel calcolo della nebbia:", error);
      }
    }

    // FIX FLICKER: Invece di rimuovere e rimettere il livello, aggiorniamo i dati al suo interno
    if (!fogLayerRef.current) {
      fogLayerRef.current = L.geoJSON(fogPolygon, {
        pane: "fogPane",
        style: {
          color: "transparent",
          fillColor: "#111827",
          fillOpacity: 0.85,
        },
      }).addTo(map);
    } else {
      fogLayerRef.current.clearLayers();
      fogLayerRef.current.addData(fogPolygon);
    }

    // Nascondiamo il loading screen all'avvio
    if (!isReady) {
      setTimeout(() => setIsReady(true), 150);
    }
  }, [exploredAreas, showFog, pois]); // Aggiunto 'pois' alle dipendenze per aggiornare la nebbia quando conquisti qualcosa

  // 4. GESTIONE MARKER POI (Sopra la nebbia)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const color = STATUS_COLORS[poi.status] || STATUS_COLORS.fog;

      const marker = L.circleMarker([poi.lat, poi.lng], {
        pane: "poiPane",
        radius: poi.status === "current" ? 12 : 8,
        fillColor: color,
        fillOpacity: 0.9, 
        color: "#ffffff",
        weight: poi.status === "current" ? 3 : 2,
        opacity: 1,
      }).addTo(map);

      // Tooltip dei nomi sempre visibili per guidare il giocatore nel buio
      marker.bindTooltip(poi.name, {
        permanent: true,
        direction: "top",
        className: "bg-gray-900 text-white border-none rounded-lg px-2 py-1 text-xs font-bold",
      });

      if (onPoiClick) marker.on("click", () => onPoiClick(poi));

      markersRef.current.push(marker);
    });
  }, [pois, showFog, onPoiClick]);

  // 5. MARKER DEL GIOCATORE (Sopra tutto)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !currentPos) return;

    const userMarker = L.circleMarker(currentPos, {
      pane: "userPane",
      radius: 8,
      fillColor: "#3B82F6",
      fillOpacity: 1,
      color: "#ffffff",
      weight: 3,
    }).addTo(map);

    const pulse = L.circleMarker(currentPos, {
      pane: "userPane",
      radius: 20,
      fillColor: "#3B82F6",
      fillOpacity: 0.2,
      stroke: false,
    }).addTo(map);

    return () => {
      userMarker.remove();
      pulse.remove();
    };
  }, [currentPos]);

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden ${className}`}>
      {/* SCHERMATA DI CARICAMENTO (svanisce dolcemente) */}
      <div 
        className={`absolute inset-0 z-50 flex items-center justify-center bg-[#111827] text-white transition-opacity duration-500 pointer-events-none ${
          isReady ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold tracking-widest text-gray-400 uppercase">Sincronizzazione GPS...</span>
        </div>
      </div>

      {/* CONTENITORE MAPPA (sfondo scuro forzato per mimetizzare i quadrati vuoti) */}
      <div 
        ref={mapRef} 
        className="w-full h-full bg-[#111827] [&_.leaflet-container]:bg-[#111827]" 
      />
    </div>
  );
}