"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { edgeParticles } from "./particleShapes";
import { AGENT } from "./nodes";

/**
 * The solution: a glowing particle agent at the centre of the disc. It ignites
 * as the flow re-routes through it (Act 3), spinning and pulsing while data
 * streams in and out (handled by DataStreams).
 */

const vertex = /* glsl */ `
  uniform float uTime;
  attribute float aRand;
  varying float vTw;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTw = 0.6 + 0.4 * sin(uTime * 3.0 + aRand * 6.2831);
    gl_PointSize = 3.0 * vTw * (300.0 / -mv.z);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vTw;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 1.6) * (0.6 + vTw * 0.4);
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor + core * 0.3, a);
  }
`;

export default function Agent({ progress }: { progress: RefObject<number> }) {
  const rootRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const positions = edgeParticles(new THREE.IcosahedronGeometry(3.2, 1), 5, 0.06, 99);
    const n = positions.length / 3;
    const rands = new Float32Array(n);
    for (let i = 0; i < n; i++) rands[i] = ((i * 7919) % 1000) / 1000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
    return {
      geometry: geo,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#bcd7ff") },
      },
    };
  }, []);

  useFrame((_, delta) => {
    const ignite = THREE.MathUtils.smoothstep(progress.current, 0.5, 0.72);
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 0.4;
      spinRef.current.rotation.x += delta * 0.12;
    }
    if (rootRef.current) {
      rootRef.current.scale.setScalar(0.2 + ignite * 0.9);
      rootRef.current.visible = ignite > 0.02;
    }
  });

  return (
    <group ref={rootRef} position={AGENT}>
      <group ref={spinRef}>
        <points geometry={geometry} frustumCulled={false}>
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={vertex}
            fragmentShader={fragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
}
