"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import { useStore } from "@/lib/store";

export interface MapPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "fog" | "conquered" | "decaying" | "enemy" | "current" | "poi-suggestion";
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
  allowClickMovement?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  fog: "#6B7280",
  conquered: "#10B981",
  decaying: "#F59E0B",
  enemy: "#EF4444",
  current: "#6C3CE1",
  "poi-suggestion": "#06B6D4",
};

export function GameMap({
  pois,
  center,
  zoom = 19,
  onPoiClick,
  showFog = true,
  userPosition,
  className = "",
  allowClickMovement = true,
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const fogLayerRef = useRef<L.GeoJSON | null>(null);

  const setUserPositionStore = useStore((state) => state.setUserPosition);

  const [currentPos, setCurrentPos] = useState<[number, number] | null>(userPosition || center);
  const [exploredAreas, setExploredAreas] = useState<[number, number][]>([]);
  const [isReady, setIsReady] = useState(false);

  // Sync GPS position if it changes
  useEffect(() => {
    if (userPosition) setCurrentPos(userPosition);
  }, [userPosition]);

  // 1. MAP INITIALIZATION
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      minZoom: 13,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
      renderer: L.svg({ padding: 5 }),
    });

    map.createPane("fogPane");
    map.getPane("fogPane")!.style.zIndex = "390";

    map.createPane("poiPane");
    map.getPane("poiPane")!.style.zIndex = "410";

    map.createPane("userPane");
    map.getPane("userPane")!.style.zIndex = "420";

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
      maxNativeZoom: 19,
      keepBuffer: 8,
      updateWhenIdle: false,
    }).addTo(map);

    mapInstance.current = map;

    // Fix gray tile bug
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstance.current = null;
      fogLayerRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // 1.5 CLICK-TO-MOVE SIMULATOR
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      setCurrentPos([e.latlng.lat, e.latlng.lng]);
      setUserPositionStore({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    if (allowClickMovement) {
      map.on("click", handleMapClick);
    } else {
      map.off("click", handleMapClick);
    }

    return () => {
      map.off("click", handleMapClick);
    };
  }, [allowClickMovement, isReady]);

  // 2. EXPLORED AREA TRACKING
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog || !currentPos) return;

    setExploredAreas((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        const dist = map.distance(last, currentPos);
        if (dist < 25) return prev;
      }
      return [...prev, currentPos];
    });

    map.panTo(currentPos, { animate: true, duration: 0.5 });
  }, [currentPos, showFog]);

  // 3. FOG OF WAR DRAWING
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showFog) {
      setIsReady(true);
      return;
    }

    let fogPolygon = turf.bboxPolygon([-180, -90, 180, 90]);
    let allHoles: any[] = [];

    // Player footsteps (100m radius)
    if (exploredAreas.length > 0) {
      const walkingCircles = exploredAreas.map((pos) =>
        turf.circle([pos[1], pos[0]], 100, { units: "meters", steps: 32 })
      );
      allHoles = [...allHoles, ...walkingCircles];
    }

    // Conquered territories (350m radius — Zelda tower effect)
    const conqueredPois = pois.filter(p => p.status === "conquered" || p.status === "current");
    if (conqueredPois.length > 0) {
      const poiCircles = conqueredPois.map((poi) =>
        turf.circle([poi.lng, poi.lat], 350, { units: "meters", steps: 64 })
      );
      allHoles = [...allHoles, ...poiCircles];
    }

    // Unowned POIs — small beacon in the fog (30m)
    const unownedPois = pois.filter(p => p.status === "fog" || p.status === "enemy" || p.status === "decaying");
    if (unownedPois.length > 0) {
      const smallPoiCircles = unownedPois.map((poi) =>
        turf.circle([poi.lng, poi.lat], 30, { units: "meters", steps: 32 })
      );
      allHoles = [...allHoles, ...smallPoiCircles];
    }

    // Merge and cut holes in fog
    if (allHoles.length > 0) {
      let mergedExploration = allHoles[0];
      for (let i = 1; i < allHoles.length; i++) {
        mergedExploration = turf.union(turf.featureCollection([mergedExploration, allHoles[i]])) as any;
      }

      try {
        const featuresToIntersect = turf.featureCollection([
          fogPolygon as any,
          mergedExploration as any
        ]);
        const difference = turf.difference(featuresToIntersect as any);

        if (difference) {
          fogPolygon = difference as any;
        }
      } catch (error) {
        console.error("Fog calculation error:", error);
      }
    }

    // Update fog layer without flicker
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

    if (!isReady) {
      setTimeout(() => setIsReady(true), 150);
    }
  }, [exploredAreas, showFog, pois]);

  // 4. POI MARKERS
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const color = STATUS_COLORS[poi.status] || STATUS_COLORS.fog;
      const isSuggestion = poi.status === "poi-suggestion";

      const marker = L.circleMarker([poi.lat, poi.lng], {
        pane: isSuggestion ? "userPane" : "poiPane",
        radius: isSuggestion ? 5 : poi.status === "current" ? 12 : 8,
        fillColor: color,
        fillOpacity: isSuggestion ? 0.7 : 0.9,
        color: isSuggestion ? "#06B6D4" : "#ffffff",
        weight: isSuggestion ? 1 : poi.status === "current" ? 3 : 2,
        opacity: 1,
      }).addTo(map);

      marker.bindTooltip(poi.name, {
        permanent: true,
        direction: "top",
        className: "bg-gray-900 text-white border-none rounded-lg px-2 py-1 text-xs font-bold",
      });

      if (onPoiClick) marker.on("click", () => onPoiClick(poi));

      markersRef.current.push(marker);
    });
  }, [pois, showFog, onPoiClick]);

  // 5. PLAYER MARKER
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
      {/* Loading screen */}
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

      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-full bg-[#111827] [&_.leaflet-container]:bg-[#111827]"
      />
    </div>
  );
}
