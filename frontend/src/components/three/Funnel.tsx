"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

/**
 * The transitional vortex — a spiral cone of particles that fades in as the
 * peer-to-peer crosstalk gets engulfed (Act 2) and fades out as the Agent takes
 * over (Act 3). Purely atmospheric; the actual re-routing lives in DataStreams.
 */

const COUNT = 1400;

export default function Funnel({ progress }: { progress: RefObject<number> }) {
  const spinRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const rand = mulberry32(0xf00d);
    const positions = new Float32Array(COUNT * 3);
    const rands = new Float32Array(COUNT);
    const topR = 30;
    const depth = 34;
    const turns = 3.5;
    for (let i = 0; i < COUNT; i++) {
      const t = i / COUNT; // 0 at wide top → 1 at narrow bottom
      const r = topR * (1 - t) * (0.85 + rand() * 0.15);
      const ang = t * Math.PI * 2 * turns + rand() * 0.3;
      positions[i * 3] = Math.cos(ang) * r;
      positions[i * 3 + 1] = 6 - t * depth;
      positions[i * 3 + 2] = Math.sin(ang) * r;
      rands[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
    return {
      geometry: geo,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    };
  }, []);

  useFrame((_, delta) => {
    const funnel =
      THREE.MathUtils.smoothstep(progress.current, 0.34, 0.5) *
      (1 - THREE.MathUtils.smoothstep(progress.current, 0.6, 0.76));
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uOpacity.value = funnel;
    }
    if (spinRef.current) spinRef.current.rotation.y += delta * 0.6;
  });

  return (
    <group ref={spinRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            uniform float uTime;
            attribute float aRand;
            varying float vTw;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mv;
              vTw = 0.6 + 0.4 * sin(uTime * 2.5 + aRand * 6.2831);
              gl_PointSize = 1.8 * vTw * (300.0 / -mv.z);
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
              gl_FragColor = vec4(vec3(0.35, 0.55, 1.0) + core * 0.2, a);
            }
          `}
        />
      </points>
    </group>
  );
}
