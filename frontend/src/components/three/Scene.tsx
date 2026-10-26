"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Entities from "./Entities";
import DataStreams from "./DataStreams";
import Funnel from "./Funnel";
import Agent from "./Agent";
import IntroText from "./IntroText";
import { RadarRings, DiscField, RadialSpokes } from "./Disc";
import { introEnterT, introPhase, useIntroPhase } from "@/lib/intro";

/**
 * Three acts driven by scroll:
 *   1. the 4 nodes exchange data peer-to-peer (mesh crosstalk)
 *   2. a funnel engulfs that crosstalk
 *   3. the disc re-forms with the REX agent at the centre, routing all flow
 *
 * The whole assembly drifts slowly; the camera cranes from a mesh view, down
 * into the funnel, and out to the final hub disc.
 */

// Camera journey:
//   top-down (screenshot 2) → drop to a SIDE view to watch the funnel/spiral
//   form → rise to a ~45° angle and stop (screenshot 8).
const KEYS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0.0, pos: [0, 62, 4], look: [0, 0, 0] },   // top view
  { p: 0.22, pos: [0, 36, 42], look: [0, 0, 0] }, // dropping toward the side
  { p: 0.4, pos: [0, 10, 54], look: [0, -3, 0] }, // side view — funnel starting
  { p: 0.55, pos: [0, 7, 50], look: [0, -9, 0] }, // side view — spiral descending
  { p: 0.72, pos: [0, 18, 46], look: [0, 2, 0] },  // rising as the Agent forms
  // Final framing (screenshot 8): disc sits low & wide, look aimed high so the
  // top of the frame is open for the headline.
  { p: 0.86, pos: [0, 24, 50], look: [0, 10, 0] },
  { p: 1.0, pos: [0, 22, 48], look: [0, 11, 0] },
];

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Where the camera sits while the REX wordmark is shown, before entering.
const INTRO_POS: [number, number, number] = [0, 8, 62];
const INTRO_LOOK: [number, number, number] = [0, 8, 0];

function CameraRig({ progress }: { progress: RefObject<number> }) {
  const { camera } = useThree();
  const smoothed = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(...KEYS[0].pos), []);
  const look = useMemo(() => new THREE.Vector3(...KEYS[0].look), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const introPos = useMemo(() => new THREE.Vector3(...INTRO_POS), []);
  const introLook = useMemo(() => new THREE.Vector3(...INTRO_LOOK), []);

  useFrame((_, delta) => {
    // Intro gate: hold on the wordmark, then fly to the top view as it disperses.
    const phase = introPhase();
    if (phase !== "entered") {
      const eT = phase === "entering" ? smootherstep(introEnterT()) : 0;
      a.set(...KEYS[0].pos);
      pos.lerpVectors(introPos, a, eT);
      a.set(...KEYS[0].look);
      look.lerpVectors(introLook, a, eT);
      camera.position.copy(pos);
      camera.lookAt(look);
      return;
    }

    smoothed.current += (progress.current - smoothed.current) * Math.min(1, delta * 2.5);
    const p = smoothed.current;

    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    const t = smootherstep(Math.min(1, Math.max(0, (p - k0.p) / (k1.p - k0.p))));

    a.set(...k0.pos);
    b.set(...k1.pos);
    pos.lerpVectors(a, b, t);
    a.set(...k0.look);
    b.set(...k1.look);
    look.lerpVectors(a, b, t);

    const time = performance.now() * 0.0004;
    camera.position.set(pos.x + Math.sin(time) * 0.5, pos.y + Math.cos(time * 0.8) * 0.35, pos.z);
    camera.lookAt(look);
  });

  return null;
}

function Assembly({ progress }: { progress: RefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.03;
    // As the wordmark bursts, the system grows out of the centre so it reads as
    // "born from REX" rather than popping in fully-formed.
    const phase = introPhase();
    const reveal = phase === "entering" ? smootherstep(introEnterT()) : 1;
    groupRef.current.scale.setScalar(0.08 + 0.92 * reveal);
  });
  return (
    <group ref={groupRef}>
      {/* the disc the objects sit on (present throughout) */}
      <RadarRings />
      <DiscField />
      <RadialSpokes progress={progress} />

      <Entities />
      <DataStreams progress={progress} />
      <Funnel progress={progress} />
      <Agent progress={progress} />
    </group>
  );
}

export default function Scene({ progress }: { progress: RefObject<number> }) {
  const phase = useIntroPhase();
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 50, 140]} />
      <ambientLight intensity={0.2} />

      <CameraRig progress={progress} />
      {/* the system (and its DOM labels) only exists once we've entered */}
      {phase !== "intro" && <Assembly progress={progress} />}
      <IntroText />
    </>
  );
}
