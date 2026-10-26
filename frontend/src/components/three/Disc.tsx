"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

/**
 * The disc the objects sit on — present throughout (Acts 1 & 3), like the ring
 * the entities orbit in the reference (screenshots 4 & 6). Three parts:
 *   - RadarRings  : faint concentric technical circles
 *   - DiscField   : a thin annulus of dust particles (the disc "surface")
 *   - RadialSpokes: sunburst from the centre that lights up in the Agent reveal
 */

/** Faint concentric rings on the disc plane. */
export function RadarRings() {
  const rings = useMemo(() => {
    const radii = [9, 15, 22, 29, 36];
    return radii.map((radius, i) => {
      const pts: THREE.Vector3[] = [];
      const seg = 128;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: "#0e3a6e",
        transparent: true,
        opacity: 0.55 - i * 0.06,
      });
      return new THREE.Line(geo, mat);
    });
  }, []);

  return (
    <group>
      {rings.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

const RINGS = [9, 15, 22, 29, 36];

/** The dense particle disc — concentric rings + accents, spinning differentially. */
export function DiscField() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const count = 22000;
    const rand = mulberry32(0xd15c);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let r: number;
      if (rand() < 0.24) {
        r = RINGS[(rand() * RINGS.length) | 0] + (rand() - 0.5) * 2.2; // ring structure
      } else {
        r = 4 + Math.pow(rand(), 0.7) * 36; // annulus, denser inner
      }
      const a = rand() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (rand() - 0.5) * 1.6; // thin disc
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return { geometry: geo, uniforms: { uTime: { value: 0 } } };
  }, []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          uniform float uTime;
          attribute float aSeed;
          varying vec3 vColor;
          varying float vA;
          void main() {
            vec3 p = position;
            float r = length(p.xz);
            // differential rotation — inner particles stream faster
            float ang = uTime * (0.03 + 0.5 / (r + 3.0));
            float s = sin(ang), c = cos(ang);
            vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
            vec4 mv = modelViewMatrix * vec4(rp, 1.0);
            gl_Position = projectionMatrix * mv;
            float big = step(0.965, aSeed);
            gl_PointSize = (1.0 + big * 1.4) * (300.0 / -mv.z);
            vec3 col = mix(vec3(0.82, 0.88, 1.0), vec3(0.03, 0.28, 0.72), aSeed * 0.7);
            if (aSeed > 0.955)      col = vec3(0.00, 0.90, 1.00);
            else if (aSeed > 0.905) col = vec3(0.55, 0.20, 0.90);
            else if (aSeed > 0.865) col = vec3(1.00, 0.62, 0.16);
            vColor = col;
            vA = 0.45 + aSeed * 0.4;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vA;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float core = smoothstep(0.5, 0.0, d);
            float a = pow(core, 2.0) * vA;
            if (a < 0.02) discard;
            gl_FragColor = vec4(vColor + core * 0.12, a);
          }
        `}
      />
    </points>
  );
}

/** Sunburst spokes from the centre — light up as the Agent takes over (Act 3). */
export function RadialSpokes({ progress }: { progress: RefObject<number> }) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const geometry = useMemo(() => {
    const rand = mulberry32(0x5c0e);
    const count = 100;
    const positions = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const len = 12 + rand() * 26;
      const y = (rand() - 0.5) * 1.2;
      positions[i * 6 + 3] = Math.cos(a) * len;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = Math.sin(a) * len;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(() => {
    const on = THREE.MathUtils.smoothstep(progress.current, 0.62, 0.82);
    if (matRef.current) matRef.current.opacity = on * 0.26;
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#025ee8" transparent opacity={0} toneMapped={false} />
    </lineSegments>
  );
}
