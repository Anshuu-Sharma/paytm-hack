import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

/**
 * Builders that turn a shape into a cloud of particles sitting along its edges
 * (plus a light surface scatter), so entities read as glowing wireframes made
 * of dots with crisp edges — the look from the reference screenshots — rather
 * than flat vector lines.
 */

/** Sample dense points along a geometry's hard edges, with a little jitter. */
export function edgeParticles(
  geo: THREE.BufferGeometry,
  density = 6,
  jitter = 0.04,
  seed = 1
): Float32Array {
  const edges = new THREE.EdgesGeometry(geo);
  const pos = edges.attributes.position;
  const rand = mulberry32(seed);
  const out: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 2) {
    a.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    b.set(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.round(len * density));
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      out.push(
        a.x + (b.x - a.x) * t + (rand() - 0.5) * jitter,
        a.y + (b.y - a.y) * t + (rand() - 0.5) * jitter,
        a.z + (b.z - a.z) * t + (rand() - 0.5) * jitter
      );
    }
  }
  edges.dispose();
  return new Float32Array(out);
}

/** A database-style cylinder: several stacked rings + a few vertical struts. */
export function cylinderParticles(
  radius: number,
  height: number,
  rings = 5,
  seg = 72,
  seed = 7
): Float32Array {
  const rand = mulberry32(seed);
  const out: number[] = [];
  const jitter = 0.03;

  for (let k = 0; k < rings; k++) {
    const y = -height / 2 + (height * k) / (rings - 1);
    for (let s = 0; s < seg; s++) {
      const ang = (s / seg) * Math.PI * 2;
      out.push(
        Math.cos(ang) * radius + (rand() - 0.5) * jitter,
        y + (rand() - 0.5) * jitter,
        Math.sin(ang) * radius + (rand() - 0.5) * jitter
      );
    }
  }
  // vertical struts
  const struts = 8;
  for (let s = 0; s < struts; s++) {
    const ang = (s / struts) * Math.PI * 2;
    for (let t = 0; t <= 18; t++) {
      const y = -height / 2 + (height * t) / 18;
      out.push(Math.cos(ang) * radius, y, Math.sin(ang) * radius);
    }
  }
  return new Float32Array(out);
}

export type ShapeKind = "cube" | "panel" | "cylinder" | "tower";

/** Return the particle positions for a named entity shape at a given scale. */
export function buildShape(kind: ShapeKind, scale: number, seed: number): Float32Array {
  switch (kind) {
    case "cube":
      return edgeParticles(new THREE.BoxGeometry(scale, scale, scale), 6, 0.05, seed);
    case "panel":
      return edgeParticles(
        new THREE.BoxGeometry(scale * 1.5, scale, scale * 0.18),
        7,
        0.04,
        seed
      );
    case "tower":
      return edgeParticles(
        new THREE.BoxGeometry(scale * 0.7, scale * 1.7, scale * 0.7),
        6,
        0.05,
        seed
      );
    case "cylinder":
      return cylinderParticles(scale * 0.55, scale * 1.15, 5, 72, seed);
  }
}
