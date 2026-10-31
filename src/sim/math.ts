export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const dist2 = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};
/** Shortest signed angle from a to b. */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const approachAngle = (a: number, b: number, maxStep: number) => {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
};
/** Yaw convention: yaw 0 faces -Z (forward), positive yaw turns left (counter-clockwise from above), matching three.js rotation.y. */
export const yawToDir = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export const dirToYaw = (x: number, z: number) => Math.atan2(-x, -z);
