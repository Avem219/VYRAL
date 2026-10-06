"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { ExploreNode } from "@/app/explore/page";

type CenterIdentity = { displayName: string; username: string; avatarUrl: string | null; accentColor: string };

export default function UniverseScene({ nodes, center, paused, onSelect }: { nodes: ExploreNode[]; center: CenterIdentity; paused: boolean; onSelect: (n: ExploreNode) => void }) {
  return <Canvas camera={{ position: [0, 5.5, 22], fov: 54 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
    <color attach="background" args={["#07080a"]}/><fog attach="fog" args={["#07080a", 18, 58]}/><ambientLight intensity={0.45}/><pointLight position={[0, 4, 5]} intensity={30} color="#e11d2e"/><pointLight position={[-12, 6, -8]} intensity={18} color="#d6b36a"/>
    <Stars radius={65} depth={35} count={1100} factor={1.7} saturation={0} fade speed={paused ? 0 : .18}/>
    <CenterNode center={center} paused={paused}/><OrbitRings paused={paused}/><ConnectionLines nodes={nodes}/>{nodes.map((n) => <IdentityNode key={n.id} node={n} paused={paused} onSelect={onSelect}/>) }
    <OrbitControls enablePan={false} minDistance={7} maxDistance={42} autoRotate={!paused} autoRotateSpeed={0.22} enableDamping dampingFactor={0.06}/>
  </Canvas>;
}

function CenterNode({ center, paused }: { center: CenterIdentity; paused: boolean }) { const ref=useRef<THREE.Group>(null); useFrame((state)=>{ if(ref.current && !paused){ref.current.rotation.y=state.clock.elapsedTime*.18; ref.current.rotation.x=Math.sin(state.clock.elapsedTime*.45)*.08;} }); return <group ref={ref}><mesh><icosahedronGeometry args={[1.15,1]}/><meshStandardMaterial color={center.accentColor || "#e11d2e"} emissive="#6f0d17" emissiveIntensity={1.1} roughness={.22} metalness={.75}/></mesh><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.65,.018,8,96]}/><meshBasicMaterial color="#d6b36a" transparent opacity={.7}/></mesh><Html center distanceFactor={11} style={{pointerEvents:"none"}}><div className="px-3 py-2 text-center bg-black/55 border border-white/10 backdrop-blur-md min-w-[110px]"><div className="text-[10px] uppercase tracking-[.18em] text-gold">You</div><div className="text-xs text-white font-semibold mt-1">{center.displayName}</div><div className="text-[10px] text-white/50">@{center.username}</div></div></Html></group>; }

function OrbitRings({ paused }: { paused: boolean }) { const a=useRef<THREE.Group>(null); useFrame((_,d)=>{if(a.current&&!paused)a.current.rotation.y+=d*.025}); return <group ref={a}>{[3.2,5.4,8.2,11.5].map((r,i)=><mesh key={r} rotation={[Math.PI/2,0,0]}><ringGeometry args={[r,r+.006,128]}/><meshBasicMaterial color={i===0?"#e11d2e":"#31343a"} transparent opacity={i===0?.3:.16}/></mesh>)}</group>; }

function ConnectionLines({ nodes }: { nodes: ExploreNode[] }) { const lines=useMemo(()=>nodes.filter(n=>n.sharedInterestCount>0).map(n=>[new THREE.Vector3(0,0,0),new THREE.Vector3(...n.position)]),[nodes]); return <>{lines.map((points,i)=><Line key={i} points={points} color="#6b5b3b" lineWidth={.5} transparent opacity={.24}/>)}</>; }

function IdentityNode({ node, paused, onSelect }: { node: ExploreNode; paused: boolean; onSelect: (n: ExploreNode)=>void }) { const [hovered,setHovered]=useState(false); const ref=useRef<THREE.Group>(null); useFrame((state)=>{if(ref.current&&!paused)ref.current.position.y=Math.sin(state.clock.elapsedTime*.7+node.position[0])*.18}); return <group position={node.position} ref={ref}><mesh onPointerOver={()=>setHovered(true)} onPointerOut={()=>setHovered(false)} onClick={()=>onSelect(node)} scale={hovered?1.3:1}><octahedronGeometry args={[.42,0]}/><meshStandardMaterial color={node.accentColor||"#eceef0"} emissive={node.accentColor||"#eceef0"} emissiveIntensity={hovered?.65:.18} roughness={.35} metalness={.5}/></mesh>{hovered&&<Html center distanceFactor={11} style={{pointerEvents:"none"}}><div className="px-2 py-1 bg-black/70 border border-white/10 text-[10px] text-white whitespace-nowrap">{node.displayName}</div></Html>}</group>; }
