"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExploreNode } from "@/app/explore/page";

export default function UniverseScene({
  nodes,
  onSelect,
}: {
  nodes: ExploreNode[];
  onSelect: (n: ExploreNode) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 6, 22], fov: 55 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#0a0a0c"]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 10, 10]} intensity={40} color="#e11d2e" />
      <fog attach="fog" args={["#0a0a0c", 20, 55]} />

      <CenterNode />
      <ConnectionLines nodes={nodes} />
      {nodes.map((n) => (
        <IdentityNode key={n.id} node={n} onSelect={onSelect} />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}

function CenterNode() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[1.1, 0]} />
      <meshStandardMaterial color="#e11d2e" emissive="#7d1019" emissiveIntensity={0.8} roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

function ConnectionLines({ nodes }: { nodes: ExploreNode[] }) {
  // Only draw a line where there is a real signal (shared interests) —
  // connection lines represent actual similarity, not decoration.
  const lines = useMemo(
    () =>
      nodes
        .filter((n) => n.sharedInterestCount > 0)
        .map((n) => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...n.position)]),
    [nodes]
  );
  return (
    <>
      {lines.map((points, i) => (
        <Line key={i} points={points} color="#3a3a40" lineWidth={0.6} transparent opacity={0.35} />
      ))}
    </>
  );
}

function IdentityNode({ node, onSelect }: { node: ExploreNode; onSelect: (n: ExploreNode) => void }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime + node.position[0]) * 0.15;
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={ref}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onSelect(node)}
        scale={hovered ? 1.35 : 1}
      >
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial
          color={node.accentColor || "#eceef0"}
          emissive={node.accentColor || "#eceef0"}
          emissiveIntensity={hovered ? 0.6 : 0.2}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      {hovered && (
        <Html center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="px-2 py-1 bg-graphite border border-charcoal text-[11px] text-offwhite whitespace-nowrap">
            {node.displayName}
          </div>
        </Html>
      )}
    </group>
  );
}
