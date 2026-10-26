import type { ShapeKind } from "./particleShapes";

/**
 * The four failure-class entities, arranged in a ring, plus the central
 * solution Agent. Shared by the entity meshes and the data-stream particles so
 * their geometry stays in sync.
 */

export interface NodeDef {
  label: string;
  shape: ShapeKind;
  color: string;
  pos: [number, number, number];
  scale: number;
}

export const RING = 22;

export const NODES: NodeDef[] = [
  { label: "FAILED PAYMENTS", shape: "cube", color: "#00e5ff", pos: [RING, 5, 0], scale: 4.6 },
  { label: "ABANDONED CHECKOUTS", shape: "panel", color: "#4a9bff", pos: [0, 3, RING], scale: 5.2 },
  { label: "FAILED SUBSCRIPTIONS", shape: "cylinder", color: "#f5a623", pos: [-RING, 6, 0], scale: 5.0 },
  { label: "OVERDUE INVOICES", shape: "tower", color: "#9b6bff", pos: [0, 4, -RING], scale: 4.4 },
];

export const AGENT: [number, number, number] = [0, 1, 0];
