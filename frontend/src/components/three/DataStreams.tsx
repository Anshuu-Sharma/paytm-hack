"use client";

/* This component streams particle positions into a GPU buffer every frame —
   intentionally imperative Three.js work. The buffers live in a ref and are
   passed to the geometry, which the React Compiler's ref rule flags; that's
   expected here. */
/* eslint-disable react-hooks/refs */

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";
import { NODES, AGENT } from "./nodes";

/**
 * The data flowing through the system, told in three acts driven by scroll:
 *
 *   Act 1 (mesh)   — packets travel between the 4 nodes along curved/straight
 *                    paths at random: uncoordinated peer-to-peer crosstalk.
 *   Act 2 (funnel) — a vortex engulfs that crosstalk, spiralling it inward/down.
 *   Act 3 (hub)    — flow re-routes through the central Agent (in and out of it).
 *
 * Each packet is drawn as a short fading tail of points sampled slightly behind
 * it along the same path, so it reads as a streak rather than a speck.
 */

const COUNT = 520; // logical packets
const TAIL = 6; // points per tail
const GAP = 0.035; // tail spacing in path-space (kept short)
const VERTS = COUNT * TAIL;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

interface StreamState {
  positions: Float32Array;
  colors: Float32Array;
  aTail: Float32Array;
  src: Int32Array;
  dst: Int32Array;
  tt: Float32Array;
  speed: Float32Array;
  bend: Float32Array;
  arcH: Float32Array;
}

// ~45% travel in straight lines, the rest curve — random amount and direction.
function randomBend(r: number): number {
  return r < 0.45 ? 0 : (r < 0.72 ? 1 : -1) * (0.35 + Math.abs(r - 0.5)) * 1.6;
}
// Widely variable speed, biased toward slower packets.
function randomSpeed(r: number): number {
  return 0.1 + Math.pow(r, 1.6) * 0.8;
}

function buildStreams(): StreamState {
  const rand = mulberry32(0xda7a);
  const positions = new Float32Array(VERTS * 3);
  const colors = new Float32Array(VERTS * 3);
  const aTail = new Float32Array(VERTS);
  const src = new Int32Array(COUNT);
  const dst = new Int32Array(COUNT);
  const tt = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const bend = new Float32Array(COUNT);
  const arcH = new Float32Array(COUNT);

  const white = new THREE.Color("#e8f1ff");
  for (let i = 0; i < COUNT; i++) {
    const a = (rand() * NODES.length) | 0;
    let b = (rand() * NODES.length) | 0;
    if (b === a) b = (b + 1) % NODES.length;
    src[i] = a;
    dst[i] = b;
    tt[i] = rand();
    speed[i] = randomSpeed(rand());
    bend[i] = randomBend(rand());
    arcH[i] = rand() * 3;

    const c = new THREE.Color(NODES[a].color).lerp(white, 0.5);
    for (let j = 0; j < TAIL; j++) {
      const idx = i * TAIL + j;
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
      aTail[idx] = j / (TAIL - 1); // 0 = head, 1 = tail end
    }
  }
  return { positions, colors, aTail, src, dst, tt, speed, bend, arcH };
}

export default function DataStreams({ progress }: { progress: RefObject<number> }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const smoothed = useRef(0);

  const stateRef = useRef<StreamState | null>(null);
  if (stateRef.current === null) stateRef.current = buildStreams();
  const { positions, colors, aTail, src, dst, tt, speed, bend, arcH } = stateRef.current;

  useFrame((_, delta) => {
    smoothed.current += (progress.current - smoothed.current) * Math.min(1, delta * 2.5);
    const p = smoothed.current;

    const hub = THREE.MathUtils.smoothstep(p, 0.46, 0.72);
    const funnel =
      THREE.MathUtils.smoothstep(p, 0.36, 0.5) *
      (1 - THREE.MathUtils.smoothstep(p, 0.6, 0.74));

    const ax = AGENT[0], ay = AGENT[1], az = AGENT[2];

    for (let i = 0; i < COUNT; i++) {
      tt[i] += speed[i] * delta * 0.3;
      if (tt[i] >= 1) {
        tt[i] -= 1;
        let b = (Math.random() * NODES.length) | 0;
        if (b === src[i]) b = (b + 1) % NODES.length;
        dst[i] = b;
        bend[i] = randomBend(Math.random());
        arcH[i] = Math.random() * 3;
        speed[i] = randomSpeed(Math.random());
      }

      const s = NODES[src[i]].pos;
      const d = NODES[dst[i]].pos;

      // quadratic-bezier control point (per packet, independent of t)
      const mx = (s[0] + d[0]) * 0.5;
      const mz = (s[2] + d[2]) * 0.5;
      const chordX = d[0] - s[0];
      const chordZ = d[2] - s[2];
      const plen = Math.hypot(chordX, chordZ) || 1;
      const perpX = -chordZ / plen;
      const perpZ = chordX / plen;

      const peerCx = mx + perpX * bend[i] * plen * 0.5;
      const peerCy = (s[1] + d[1]) * 0.5 + arcH[i];
      const peerCz = mz + perpZ * bend[i] * plen * 0.5;

      // hub mode pulls the control toward the Agent → curves in/out of centre
      const cX = peerCx + (ax - peerCx) * hub;
      const cY = peerCy + (ay - peerCy) * hub;
      const cZ = peerCz + (az - peerCz) * hub;

      // draw the head + short trailing tail behind it
      for (let j = 0; j < TAIL; j++) {
        const t = ease(clamp01(tt[i] - j * GAP));
        const u = 1 - t;
        let x = u * u * s[0] + 2 * u * t * cX + t * t * d[0];
        let y = u * u * s[1] + 2 * u * t * cY + t * t * d[1];
        let z = u * u * s[2] + 2 * u * t * cZ + t * t * d[2];

        if (funnel > 0.001) {
          const r = Math.hypot(x, z);
          const ang = Math.atan2(z, x) + funnel * 7.0 * (1 - t);
          const nr = r * (1 - funnel * 0.75);
          x = Math.cos(ang) * nr;
          z = Math.sin(ang) * nr;
          y -= funnel * 14 * (1 - t);
        }

        const idx = (i * TAIL + j) * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }
    }

    if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aTail" args={[aTail, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{}}
        vertexShader={`
          attribute vec3 aColor;
          attribute float aTail;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vColor = aColor;
            vFade = pow(1.0 - aTail, 1.5);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (2.7 - aTail * 1.5) * (300.0 / -mv.z);
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float core = smoothstep(0.5, 0.0, d);
            float a = pow(core, 1.8) * vFade;
            if (a < 0.02) discard;
            gl_FragColor = vec4(vColor + core * 0.2, a);
          }
        `}
      />
    </points>
  );
}
