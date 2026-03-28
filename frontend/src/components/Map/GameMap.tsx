"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf"; // Importiamo la nuova libreria

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
  zoom = 14,
  onPoiClick,
  showFog = true,
  userPosition,
  className = "",
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const fogLayerRef = useRef<L.GeoJSON | null>(null); // Aggiornato per usare GeoJSON

  const [currentPos, setCurrentPos] = useState<[number, number] | null>(userPosition || center);
  const [exploredAreas, setExploredAreas] = useState<[number, number][]>([]);

  useEffect(() => {
    if (userPosition) setCurrentPos(userPosition);
  }, [userPosition]);

  // 1. INIZIALIZZAZIONE MAPPA
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      minZoom: 12, // <--- ECCO IL LIMITE DI ZOOM OUT (12 = circa una città intera)
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    map.on("click", (e: L.LeafletMouseEvent) => {
      setCurrentPos([e.latlng.lat, e.latlng.lng]);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // 2. TRACCIAMENTO AREE ESPLORATE
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog || !currentPos) return;

    setExploredAreas((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        const dist = map.distance(last, currentPos);
        if (dist < 100) return prev;
      }
      return [...prev, currentPos];
    });
  }, [currentPos, showFog]);

  // 3. DISEGNO DEL FOG OF WAR (Fusione perfetta con Turf.js)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog) return;

    if (fogLayerRef.current) {
      map.removeLayer(fogLayerRef.current);
    }

    // Creiamo il "mondo oscurato"
    let fogPolygon = turf.bboxPolygon([-180, -90, 180, 90]);

    if (exploredAreas.length > 0) {
      // Creiamo tutti i cerchi (Turf usa [Longitudine, Latitudine]!)
      const circles = exploredAreas.map((pos) =>
        turf.circle([pos[1], pos[0]], 500, { units: "meters", steps: 32 })
      );

      // Fondiamo insieme tutti i cerchi in un'unica forma pulita senza accavallamenti
      let mergedExploration = circles[0];
      for (let i = 1; i < circles.length; i++) {
        mergedExploration = turf.union(turf.featureCollection([mergedExploration, circles[i]])) as any;
      }

      // Ritagliamo l'area esplorata fusa dal quadrato scuro gigante
      const difference = turf.difference(turf.featureCollection([fogPolygon, mergedExploration]));
      if (difference) {
        fogPolygon = difference as any;
      }
    }

    // Disegniamo la nebbia calcolata
    fogLayerRef.current = L.geoJSON(fogPolygon, {
      style: {
        color: "transparent",
        fillColor: "#111827",
        fillOpacity: 0.85,
      },
    }).addTo(map);
  }, [exploredAreas, showFog]);

  // 4. GESTIONE MARKER POI
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const color = STATUS_COLORS[poi.status] || STATUS_COLORS.fog;
      const isFog = poi.status === "fog";

      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: poi.status === "current" ? 12 : 8,
        fillColor: color,
        fillOpacity: isFog && showFog ? 0.3 : 0.8,
        color: color,
        weight: poi.status === "current" ? 3 : 1,
        opacity: isFog && showFog ? 0.4 : 1,
      }).addTo(map);

      marker.bindTooltip(poi.name, {
        permanent: false,
        direction: "top",
        className: "bg-gray-900 text-white border-none rounded-lg px-2 py-1 text-xs",
      });

      if (onPoiClick) marker.on("click", () => onPoiClick(poi));

      markersRef.current.push(marker);
    });
  }, [pois, showFog, onPoiClick]);

  // 5. MARKER DEL GIOCATORE
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !currentPos) return;

    const userMarker = L.circleMarker(currentPos, {
      radius: 8,
      fillColor: "#3B82F6",
      fillOpacity: 1,
      color: "#ffffff",
      weight: 3,
    }).addTo(map);

    const pulse = L.circleMarker(currentPos, {
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

  return <div ref={mapRef} className={`w-full h-full rounded-2xl ${className}`} />;
}