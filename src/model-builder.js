// Constrói o modelo 3D a partir de uma lista declarativa de peças.
//
// Peça: { id, name, pn?, kind: 'shell'|'internal'|'detail'|'screw', parent?, origin?, screws?: [ids],
//         meshes: [...], motion? }
// motion:
//   { type: 'hinge', axis: 'x'|'y'|'z', angle }       porta/tampa com dobradiça
//   { type: 'slide', to: [dx, dy, dz] }               gaveta, peça que sai
//   { type: 'screw', dir: [x, y, z], dist, turns }    parafuso: gira e sai na direção dir
// Mesh: { shape, at: [x,y,z], color, mat?, rot?, dir?, ... }
//   shape: box | rbox (arredondado) | cyl | gear | slots | tube | screw | recess
//   mat:   plastic | metal | rubber | pcb | glass | glow | paper | screen
// Unidade: decímetro (1 = 10 cm). +Z = frente da máquina, +Y = cima.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const UP = new THREE.Vector3(0, 1, 0);

// ---------- Texturas procedurais ----------
let grainTex = null;
function grain() {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set(3, 3);
  return grainTex;
}

const MAT = {
  plastic: { roughness: 0.52, metalness: 0.0, grain: true },
  metal: { roughness: 0.32, metalness: 0.9 },
  rubber: { roughness: 0.92, metalness: 0.0 },
  pcb: { roughness: 0.45, metalness: 0.1 },
  glass: { roughness: 0.05, metalness: 0.0 },
  glow: { roughness: 0.3, metalness: 0.0, glow: true },
  paper: { roughness: 0.95, metalness: 0.0 },
  screen: { roughness: 0.15, metalness: 0.0 },
};

function makeMaterial(m) {
  const preset = MAT[m.mat || 'plastic'];
  const mat = new THREE.MeshStandardMaterial({
    color: m.color || '#cccccc',
    roughness: m.rough ?? preset.roughness,
    metalness: m.metal ?? preset.metalness,
    transparent: true,
    opacity: m.opacity ?? 1,
  });
  if (preset.grain) { mat.roughnessMap = grain(); mat.bumpMap = grain(); mat.bumpScale = 0.15; }
  if (preset.glow) { mat.emissive.set(m.color); mat.emissiveIntensity = 0.8; mat.userData.glow = 0.8; }
  mat.userData.baseOpacity = m.opacity ?? 1;
  return mat;
}

// ---------- Geometrias ----------
function gearGeometry(r, teeth, depth) {
  const s = new THREE.Shape();
  const n = teeth * 2;
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const rr = i % 2 ? r * 0.82 : r;
    const p0 = [Math.cos(a0) * rr, Math.sin(a0) * rr];
    if (i === 0) s.moveTo(...p0); else s.lineTo(...p0);
    if (i < n) s.lineTo(Math.cos(a1 - 0.02) * rr, Math.sin(a1 - 0.02) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.12, bevelSize: r * 0.02, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  g.rotateX(-Math.PI / 2); // eixo do dente → Y
  return g;
}

function screwGeometry(len) {
  const head = new THREE.CylinderGeometry(0.052, 0.056, 0.032, 24);
  head.translate(0, 0.016, 0);
  const dome = new THREE.SphereGeometry(0.052, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.35, 1);
  dome.translate(0, 0.032, 0);
  const shank = new THREE.CylinderGeometry(0.019, 0.019, len, 12);
  shank.translate(0, -len / 2, 0);
  const pts = [];
  const turns = Math.max(4, Math.round(len / 0.012));
  for (let i = 0; i <= turns * 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.021, -0.008 - (i / (turns * 12)) * (len - 0.02), Math.sin(a) * 0.021));
  }
  const thread = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.005, 4, false);
  return mergeGeometries([head.toNonIndexed(), dome.toNonIndexed(), shank.toNonIndexed(), thread.toNonIndexed()]);
}

function recessGeometry() {
  const a = new THREE.BoxGeometry(0.06, 0.012, 0.012);
  const b = new THREE.BoxGeometry(0.012, 0.012, 0.06);
  a.translate(0, 0.046, 0);
  b.translate(0, 0.046, 0);
  return mergeGeometries([a, b]);
}

function makeGeometry(m) {
  switch (m.shape) {
    case 'rbox': {
      const r = Math.min(m.radius ?? 0.08, Math.min(...m.size) * 0.45);
      return new RoundedBoxGeometry(...m.size, 3, r);
    }
    case 'cyl': {
      const g = new THREE.CylinderGeometry(m.r2 ?? m.r, m.r, m.len, m.seg ?? 36);
      if (m.axis === 'x') g.rotateZ(-Math.PI / 2);
      if (m.axis === 'z') g.rotateX(Math.PI / 2);
      return g;
    }
    case 'gear': {
      const g = gearGeometry(m.r, m.teeth ?? 18, m.depth ?? 0.05);
      if (m.axis === 'x') g.rotateZ(-Math.PI / 2);
      if (m.axis === 'z') g.rotateX(Math.PI / 2);
      return g;
    }
    case 'slots': {
      const list = [];
      for (let i = 0; i < m.count; i++) {
        const b = new THREE.BoxGeometry(...m.size);
        b.translate(...m.step.map((s) => s * (i - (m.count - 1) / 2)));
        list.push(b);
      }
      return mergeGeometries(list);
    }
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(m.points.map((p) => new THREE.Vector3(...p)));
      return new THREE.TubeGeometry(curve, 48, m.r ?? 0.02, 8, false);
    }
    case 'screw': return screwGeometry(m.len ?? 0.14);
    case 'recess': return recessGeometry();
    default: return new THREE.BoxGeometry(...m.size);
  }
}

export function buildModel(partDefs) {
  const root = new THREE.Group();
  const parts = new Map();

  for (const def of partDefs) {
    const node = new THREE.Group();
    node.name = def.id;
    const first = def.meshes[0];
    const origin = new THREE.Vector3(...(def.origin || (first.shape === 'tube' ? first.points[0] : first.at)));
    const meshes = [];
    const mats = [];

    for (const m of def.meshes) {
      const geo = makeGeometry(m);
      const mat = makeMaterial(m);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = (m.opacity ?? 1) > 0.9 && m.shape !== 'tube';
      mesh.receiveShadow = true;
      if (m.shape === 'tube') mesh.position.copy(origin).negate();
      else mesh.position.set(...m.at).sub(origin);
      if (m.dir) mesh.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...m.dir).normalize());
      if (m.rot) mesh.rotation.set(...m.rot);
      if (m.screen) mesh.userData.screen = true;
      mesh.userData.partId = def.id;
      node.add(mesh);
      meshes.push(mesh);
      mats.push(mat);
    }
    parts.set(def.id, { def, node, origin, meshes, mats, prog: 0, target: 0, startAt: 0, from: 0 });
  }

  for (const p of parts.values()) {
    const parent = p.def.parent && parts.get(p.def.parent);
    if (parent) {
      parent.node.add(p.node);
      p.node.position.copy(p.origin).sub(parent.origin);
    } else {
      root.add(p.node);
      p.node.position.copy(p.origin);
    }
    p.parentPart = parent || null;
    p.basePos = p.node.position.clone();
    const mo = p.def.motion;
    p.duration = mo?.type === 'screw' ? 0.9 : mo?.type === 'hinge' ? 0.85 : 0.95;
    if (mo?.type === 'hinge') p.openQuat = new THREE.Quaternion().setFromAxisAngle(AXES[mo.axis], mo.angle);
    if (mo?.type === 'slide') p.openPos = p.basePos.clone().add(new THREE.Vector3(...mo.to));
    if (mo?.type === 'screw') p.screwDir = new THREE.Vector3(...mo.dir).normalize();
  }

  for (const p of parts.values()) {
    const box = new THREE.Box3();
    for (const mesh of p.meshes) {
      mesh.geometry.computeBoundingBox();
      mesh.updateMatrix();
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    p.localBox = box;
    p.localCenter = box.getCenter(new THREE.Vector3());
    p.radius = box.getSize(new THREE.Vector3()).length() / 2;
  }

  return { root, parts };
}

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const tmpQ = new THREE.Quaternion();

/** Aplica a pose de uma peça para o progresso p.prog (0 = fechada, 1 = aberta). */
export function poseAt(p, out) {
  const mo = p.def.motion;
  const u = p.prog;
  out.copy(p.basePos);
  p.node.quaternion.identity();
  if (!mo || u <= 0) return out;
  if (mo.type === 'hinge') {
    p.node.quaternion.slerp(p.openQuat, ease(u));
  } else if (mo.type === 'slide') {
    out.lerp(p.openPos, ease(u));
  } else if (mo.type === 'screw') {
    // 0–0.75: desrosqueia girando · 0.75–1: sai da peça
    const a = Math.min(u / 0.75, 1);
    const b = Math.max((u - 0.75) / 0.25, 0);
    const dist = (mo.dist ?? 0.14) * a + 0.45 * ease(b);
    out.addScaledVector(p.screwDir, dist);
    p.node.quaternion.copy(tmpQ.setFromAxisAngle(p.screwDir, -a * (mo.turns ?? 5) * Math.PI * 2));
  }
  return out;
}

export function disposeModel(model) {
  model.root.traverse((o) => {
    o.geometry?.dispose();
    if (o.material && o.material.map) o.material.map.dispose();
    o.material?.dispose();
  });
}
