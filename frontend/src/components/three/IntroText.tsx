"use client";

/* Imperative per-frame buffer work (text particles morphing) — the ref rule
   doesn't model this. */
/* eslint-disable react-hooks/refs */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";
import { introEnterT, introPhase } from "@/lib/intro";

/** Sample bright pixels of rendered text into 3D points (the "REX" wordmark). */
function sampleText(text: string): Float32Array {
  const W = 1200;
  const H = 380;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.font = "700 250px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 8);

  const data = ctx.getImageData(0, 0, W, H).data;
  const rand = mulberry32(0x12ab);
  const scale = 0.09; // large wordmark
  const pts: number[] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 130) {
        pts.push(
          (x - W / 2) * scale + (rand() - 0.5) * 0.05,
          (H / 2 - y) * scale + (rand() - 0.5) * 0.05,
          (rand() - 0.5) * 0.8
        );
      }
    }
  }
  return new Float32Array(pts);
}

interface IntroState {
  formed: Float32Array;
  scatter: Float32Array;
  positions: Float32Array;
  rands: Float32Array;
  n: number;
}

function build(): IntroState {
  const formed = sampleText("R.E.X");
  const n = formed.length / 3;
  const scatter = new Float32Array(n * 3);
  const rands = new Float32Array(n);
  const rand = mulberry32(0x77cd);
  for (let i = 0; i < n; i++) {
    // explode outward to a shell as the wordmark disperses into the system
    const r = 34 + rand() * 34;
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    scatter[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    scatter[i * 3 + 1] = Math.cos(ph) * r * 0.5;
    scatter[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    rands[i] = rand();
  }
  return { formed, scatter, positions: new Float32Array(formed), rands, n };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function IntroText() {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const stateRef = useRef<IntroState | null>(null);
  if (stateRef.current === null) stateRef.current = build();
  const { formed, scatter, positions, rands, n } = stateRef.current;

  useFrame((_, delta) => {
    const phase = introPhase();
    if (pointsRef.current) pointsRef.current.visible = phase !== "entered";
    if (phase === "entered") return;

    const raw = introEnterT();
    const e = easeInOut(raw);
    const time = performance.now() * 0.001;

    for (let i = 0; i < n; i++) {
      const idx = i * 3;
      // gentle shimmer while formed, then lerp out to the scatter shell
      const sh = (1 - e) * Math.sin(time * 1.5 + rands[i] * 6.2831) * 0.12;
      positions[idx] = formed[idx] + (scatter[idx] - formed[idx]) * e;
      positions[idx + 1] = formed[idx + 1] + (scatter[idx + 1] - formed[idx + 1]) * e + sh;
      positions[idx + 2] = formed[idx + 2] + (scatter[idx + 2] - formed[idx + 2]) * e;
    }
    if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      // hold the wordmark briefly, then fade it out as it bursts
      const f = raw < 0.15 ? 0 : raw > 0.95 ? 1 : (raw - 0.15) / 0.8;
      matRef.current.uniforms.uOpacity.value = 1 - f * f * (3 - 2 * f);
    }
  });

  return (
    <points ref={pointsRef} position={[0, 8, 0]} frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRand" args={[rands, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 }, uOpacity: { value: 1 } }}
        vertexShader={`
          uniform float uTime;
          attribute float aRand;
          varying float vTw;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            vTw = 0.65 + 0.35 * sin(uTime * 2.2 + aRand * 6.2831);
            gl_PointSize = 1.9 * vTw * (300.0 / -mv.z);
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          varying float vTw;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float core = smoothstep(0.5, 0.0, d);
            float a = pow(core, 1.8) * uOpacity * vTw;
            if (a < 0.02) discard;
            gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) + core * 0.1, a);
          }
        `}
      />
    </points>
  );
}
