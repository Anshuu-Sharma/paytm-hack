"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { buildShape } from "./particleShapes";
import { NODES, type NodeDef } from "./nodes";

/**
 * The four failure-class entities as glowing particle shapes (gateway cube,
 * checkout panel, mandate database, receivables tower), placed at the shared
 * ring positions. Data flow between them is handled by DataStreams.
 */

const glowVertex = /* glsl */ `
  uniform float uTime;
  attribute float aRand;
  varying float vTw;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTw = 0.7 + 0.3 * sin(uTime * 2.0 + aRand * 6.2831);
    gl_PointSize = 2.4 * vTw * (300.0 / -mv.z);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vTw;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 2.0) * (0.7 + vTw * 0.3);
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor + core * 0.25, a);
  }
`;

function EntityNode({ node, seed }: { node: NodeDef; seed: number }) {
  const spinRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const positions = buildShape(node.shape, node.scale, seed);
    const n = positions.length / 3;
    const rands = new Float32Array(n);
    for (let i = 0; i < n; i++) rands[i] = ((i * 9301 + 49297) % 233280) / 233280;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
    return {
      geometry: geo,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(node.color) },
      },
    };
  }, [node, seed]);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
    if (spinRef.current) spinRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group position={node.pos}>
      <group ref={spinRef}>
        <points geometry={geometry} frustumCulled={false}>
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={glowVertex}
            fragmentShader={glowFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
      <Html position={[0, node.scale * 0.95 + 2, 0]} center zIndexRange={[10, 0]}>
        <div className="scene-label">{node.label}</div>
      </Html>
    </group>
  );
}

export default function Entities() {
  return (
    <>
      {NODES.map((n, i) => (
        <EntityNode key={n.label} node={n} seed={i * 131 + 17} />
      ))}
    </>
  );
}
