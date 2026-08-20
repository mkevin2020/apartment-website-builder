"use client";

import dynamic from "next/dynamic";

// Three.js only renders in the browser — load the scene client-side so the
// page itself still server-renders instantly (text first, 3D fades in).
const BuildingScene = dynamic(() => import("./BuildingScene"), {
  ssr: false,
  loading: () => null,
});

export function HeroBuilding() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <BuildingScene />
    </div>
  );
}
