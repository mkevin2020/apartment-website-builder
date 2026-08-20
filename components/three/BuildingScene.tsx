"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// Warm lit window pane — glows regardless of scene lighting.
function Pane({
  position,
  size,
  rotationY = 0,
  color = "#ffb865",
}: {
  position: [number, number, number];
  size: [number, number];
  rotationY?: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Slab({
  position,
  size,
  color = "#1c222c",
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.08} />
    </mesh>
  );
}

function Tree({
  position,
  foliage = "#2f6e4f",
  scale = 1,
}: {
  position: [number, number, number];
  foliage?: string;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.55, 6]} />
        <meshStandardMaterial color="#4a3728" roughness={1} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <icosahedronGeometry args={[0.26, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Cypress({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <coneGeometry args={[0.28, 1.6, 7]} />
        <meshStandardMaterial color="#1e4d38" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Bush({ position, color = "#35684a", r = 0.22 }: { position: [number, number, number]; color?: string; r?: number }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 8, 6]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
}

function GardenLamp({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
    </mesh>
  );
}

// The modern villa: stacked charcoal volumes, cantilevered floor, terraces,
// big warm windows — inspired by luxury real-estate renders.
function Villa() {
  const WALL = "#262c36";
  const WALL_LIGHT = "#343c49";
  const ROOF = "#151a22";

  return (
    <group position={[-0.4, 0.56, -0.4]}>
      {/* ── ground floor ── */}
      <Slab position={[0, 0.85, 0]} size={[4.9, 1.7, 3.6]} color={WALL} />
      {/* ground-floor glass front */}
      <Pane position={[-1.1, 0.8, 1.815]} size={[1.5, 1.15]} />
      <Pane position={[0.7, 0.8, 1.815]} size={[1.3, 1.15]} color="#ffc98a" />
      <Pane position={[1.9, 0.8, 1.815]} size={[0.55, 1.15]} color="#ffdcae" />
      {/* side windows */}
      <Pane position={[2.465, 0.85, -0.4]} size={[1.6, 1.0]} rotationY={Math.PI / 2} />
      <Pane position={[-2.465, 0.85, 0.3]} size={[1.2, 1.0]} rotationY={Math.PI / 2} color="#ffce93" />
      {/* entrance canopy + steps */}
      <Slab position={[1.9, 1.78, 1.4]} size={[1.5, 0.1, 1.3]} color={ROOF} />
      <Slab position={[1.9, 0.12, 2.6]} size={[1.3, 0.24, 1.5]} color="#3c4654" />
      <Slab position={[1.9, 0.3, 2.25]} size={[1.3, 0.14, 0.8]} color="#465162" />

      {/* ── second floor (cantilevered) ── */}
      <Slab position={[-0.55, 2.5, -0.15]} size={[3.8, 1.6, 3.1]} color={WALL_LIGHT} />
      {/* big glass band on the front */}
      <Pane position={[-0.55, 2.5, 1.415]} size={[3.3, 1.15]} color="#ffc98a" />
      <Pane position={[-2.465, 2.5, -0.15]} size={[2.4, 1.05]} rotationY={Math.PI / 2} color="#ffd8a6" />
      {/* balcony slab + glass railing */}
      <Slab position={[0.4, 1.76, 1.95]} size={[4.6, 0.1, 1.5]} color="#1f2630" />
      <mesh position={[0.4, 2.12, 2.66]}>
        <boxGeometry args={[4.6, 0.55, 0.05]} />
        <meshStandardMaterial color="#9db4c8" transparent opacity={0.25} roughness={0.15} metalness={0.3} />
      </mesh>
      {/* roof slab with overhang */}
      <Slab position={[-0.55, 3.38, -0.15]} size={[4.2, 0.14, 3.5]} color={ROOF} />
      {/* roof terrace greens + stair house */}
      <Slab position={[-1.7, 3.7, -0.9]} size={[1.1, 0.5, 1.1]} color={WALL} />
      <Pane position={[-1.7, 3.7, -0.34]} size={[0.7, 0.32]} color="#ffd9a0" />
      <Bush position={[0.6, 3.55, -0.9]} color="#2f6e4f" />
      <Bush position={[1.1, 3.52, -0.5]} color="#35684a" r={0.18} />

      {/* ── lounge wing (right, single storey) ── */}
      <Slab position={[3.1, 0.62, -0.7]} size={[1.6, 1.24, 2.2]} color={WALL_LIGHT} />
      <Pane position={[3.1, 0.62, 0.415]} size={[1.2, 0.85]} color="#ffca8c" />
      <Slab position={[3.1, 1.3, -0.7]} size={[1.9, 0.12, 2.5]} color={ROOF} />
    </group>
  );
}

// Landscaped square garden platform the villa sits on (diorama style).
function Garden() {
  return (
    <group>
      {/* stone base + grass top */}
      <Slab position={[0, 0.28, 0]} size={[10.6, 0.56, 10.6]} color="#39424f" />
      <Slab position={[0, 0.585, 0]} size={[10.2, 0.05, 10.2]} color="#27452f" />

      {/* path from entrance to the edge */}
      <Slab position={[1.5, 0.625, 3.6]} size={[1.1, 0.03, 3.4]} color="#57616f" />
      <GardenLamp position={[0.85, 0.72, 2.6]} />
      <GardenLamp position={[2.15, 0.72, 2.6]} />
      <GardenLamp position={[0.85, 0.72, 4.4]} />
      <GardenLamp position={[2.15, 0.72, 4.4]} />

      {/* pool (left front) with glowing water */}
      <Slab position={[-2.9, 0.6, 3.2]} size={[2.6, 0.08, 1.6]} color="#3c4654" />
      <mesh position={[-2.9, 0.66, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 1.3]} />
        <meshBasicMaterial color="#5fc4e8" toneMapped={false} />
      </mesh>

      {/* trees & greenery */}
      <Tree position={[4.3, 0.6, 3.9]} scale={1.15} />
      <Tree position={[-4.2, 0.6, -4.0]} scale={1.5} foliage="#295e43" />
      <Tree position={[4.1, 0.6, -4.1]} scale={1.25} foliage="#d97a1f" /> {/* amber accent tree */}
      <Tree position={[-4.35, 0.6, 1.1]} scale={0.95} />
      <Cypress position={[-3.6, 0.6, -2.2]} scale={1.3} />
      <Cypress position={[3.3, 0.6, -3.4]} scale={1.1} />
      <Bush position={[3.15, 0.72, 1.4]} />
      <Bush position={[3.7, 0.7, 2.2]} r={0.18} />
      <Bush position={[-1.3, 0.72, 4.35]} />
      <Bush position={[0.1, 0.7, 4.5]} r={0.18} color="#2f6e4f" />
      <Bush position={[-4.4, 0.72, 3.9]} />
    </group>
  );
}

export default function BuildingScene() {
  return (
    <Canvas
      // "percentage" = PCFShadowMap. Passing shadows as a boolean makes R3F pick
      // PCFSoftShadowMap, which three.js has deprecated (it warns on every render
      // and silently falls back to PCFShadowMap anyway).
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [16, 11, 16], fov: 35 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <fog attach="fog" args={["#070b14", 26, 60]} />
      {/* warm key light like the reference render + cool fill */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[7, 11, 5]} intensity={2.1} color="#ffd9a8" castShadow />
      <directionalLight position={[-9, 6, -7]} intensity={0.8} color="#86a8ff" />
      <pointLight position={[1.5, 2.5, 5]} intensity={25} color="#ffb46b" />

      <group position={[4.6, 0, 0]}>
        <Garden />
        <Villa />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.6} scale={30} blur={2.6} far={14} />
      </group>

      {/* near-black ground so the diorama floats in darkness like the reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[45, 48]} />
        <meshStandardMaterial color="#05080f" roughness={1} />
      </mesh>

      <Stars radius={85} depth={40} count={1200} factor={2.8} saturation={0} fade speed={0.5} />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.65}
        enableZoom={false}
        enablePan={false}
        target={[4.6, 1.5, 0]}
        minPolarAngle={Math.PI / 3.6}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}
