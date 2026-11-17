// Gerador de multifuncional genérica: modelo simplificado e original (não é CAD de fabricante).
// Cada fabricante ajusta medidas, cores, acesso ao fusor e nomes via opções.
//
// IDs padronizados usados nos passos:
//   carcaça:  cabinet, tray1..N, frame-lower, frontDoor, front-strip, leftCover, rightCover,
//             rearCover, rear-lower, topPlate, column, scanner, adf, panel, feet
//   internos: lsu, drum, toner | toner-y/m/c/k, belt, fuser, heat-roller, pressure-roller,
//             heater, thermistor, thermostat, feed-roller, main-motor, main-pcb, psu, fan,
//             carriage, scan-motor, scan-belt, scan-lock, scan-cable, platen, rails
//   parafusos: <peça>-s1, <peça>-s2… (a peça lista os seus em `screws` e o viewer tira antes)

const box = (size, at, color, x = {}) => ({ shape: 'box', size, at, color, ...x });
const rbox = (size, at, color, x = {}) => ({ shape: 'rbox', size, at, color, ...x });
const cyl = (r, len, axis, at, color, x = {}) => ({ shape: 'cyl', r, len, axis, at, color, ...x });
const gear = (r, axis, at, color, x = {}) => ({ shape: 'gear', r, axis, at, color, ...x });
const slots = (count, size, step, at, color, x = {}) => ({ shape: 'slots', count, size, step, at, color, ...x });
const tube = (points, r, color, x = {}) => ({ shape: 'tube', points, r, color, ...x });

const STEEL = '#b9c0c9';
const BLACK = '#1b1d21';
const RUBBER = '#2a2c30';
const WHITE_NYLON = '#e9e4d8';

export function mfp(options = {}) {
  const c = {
    w: 4.8, d: 4.6,
    cabinetH: 0, trays: 1, trayH: 0.85,
    engineH: 2.7, gap: 1.0, scanH: 0.85, adfH: 0.75,
    shell: '#e8eaed', shell2: '#d5d9de', trim: '#3b4048', dark: '#23272e', handle: '#ff8a1f',
    colorToners: false,
    fuserAccess: 'rear', // 'rear' (tampa traseira) | 'right' (porta direita)
    rearRemovable: false, // tampa traseira parafusada
    names: {}, pn: {},
    ...options,
  };
  const { w, d } = c;
  const hw = w / 2, hd = d / 2;
  const N = (id, fallback) => c.names[id] || fallback;
  const P = [];
  const add = (part) => { if (c.pn[part.id]) part.pn = c.pn[part.id]; P.push(part); return part; };

  const screw = (id, at, dir, parent) => add({
    id, name: 'Parafuso Phillips', kind: 'screw', parent,
    meshes: [
      { shape: 'screw', at, dir, color: STEEL, mat: 'metal', len: 0.14 },
      { shape: 'recess', at, dir, color: '#15171a', mat: 'metal' },
    ],
    motion: { type: 'screw', dir, dist: 0.14, turns: 5 },
  });
  const screwsFor = (part, list) => {
    part.screws = list.map(([at, dir], i) => screw(`${part.id}-s${i + 1}`, at, dir).id);
  };

  // ---------- Base ----------
  let y = 0;
  if (c.cabinetH) {
    const ch = c.cabinetH, cb = 0.14;
    add({ id: 'cabinet', name: N('cabinet', 'Gabinete / pedestal'), kind: 'shell', meshes: [
      rbox([w, ch - cb, d - 0.1], [0, cb + (ch - cb) / 2, -0.05], c.trim, { radius: 0.06 }),
      box([0.012, ch - cb - 0.2, 0.01], [0, cb + (ch - cb) / 2, hd - 0.099], '#15181c'),
      rbox([0.06, 0.4, 0.04], [-0.18, cb + (ch - cb) * 0.6, hd - 0.08], '#4a5059', { radius: 0.02 }),
      rbox([0.06, 0.4, 0.04], [0.18, cb + (ch - cb) * 0.6, hd - 0.08], '#4a5059', { radius: 0.02 }),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cyl(0.07, 0.06, 'x', [sx * (hw - 0.35), 0.07, sz * (hd - 0.4)], RUBBER, { mat: 'rubber' })),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => rbox([0.14, 0.06, 0.18], [sx * (hw - 0.35), 0.13, sz * (hd - 0.4)], '#3a3f46', { radius: 0.02 })),
    ] });
    y = ch;
  } else {
    add({ id: 'feet', name: 'Pés de borracha', kind: 'detail', meshes:
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cyl(0.13, 0.1, 'y', [sx * (hw - 0.4), 0.05, sz * (hd - 0.4)], RUBBER, { mat: 'rubber' })) });
    y = 0.1;
  }

  const trayBase = y;
  for (let i = 0; i < c.trays; i++) {
    const id = `tray${i + 1}`;
    const h = c.trayH - 0.03;
    const cy = y + c.trayH / 2;
    const inner = d - 0.4;
    add({
      id, name: N(id, `Bandeja ${i + 1}`), kind: 'shell', origin: [0, cy, 0],
      meshes: [
        rbox([w - 0.18, h, 0.1], [0, cy, hd - 0.05], c.shell, { radius: 0.04 }),
        rbox([w * 0.34, 0.1, 0.03], [0, cy + h * 0.12, hd + 0.006], c.dark, { radius: 0.025 }),
        box([0.14, 0.05, 0.02], [w * 0.36, cy - h * 0.1, hd + 0.006], '#9aa3ad'),
        box([w - 0.34, 0.04, inner], [0, y + 0.08, 0.02], c.dark),
        box([0.04, h * 0.7, inner], [-hw + 0.2, y + 0.04 + h * 0.35, 0.02], c.dark),
        box([0.04, h * 0.7, inner], [hw - 0.2, y + 0.04 + h * 0.35, 0.02], c.dark),
        box([w - 0.34, h * 0.7, 0.04], [0, y + 0.04 + h * 0.35, -hd + 0.22], c.dark),
        rbox([0.05, h * 0.5, inner * 0.6], [-w * 0.33, y + 0.1 + h * 0.25, 0.1], c.handle, { radius: 0.02 }),
      ],
      motion: { type: 'slide', to: [0, 0, d * 0.6] },
    });
    add({ id: `${id}-paper`, name: 'Papel', kind: 'detail', parent: id,
      meshes: [rbox([w * 0.6, h * 0.42, d * 0.62], [0.05, y + 0.1 + h * 0.21, 0.1], '#f6f5ef', { mat: 'paper', radius: 0.01 })] });
    y += c.trayH;
  }
  const lowH = y - trayBase;
  add({ id: 'frame-lower', name: 'Chassi inferior', kind: 'shell', meshes: [
    rbox([0.09, lowH, d], [-hw + 0.045, trayBase + lowH / 2, 0], c.shell, { radius: 0.03 }),
    rbox([0.09, lowH, d], [hw - 0.045, trayBase + lowH / 2, 0], c.shell, { radius: 0.03 }),
    rbox([w - 0.18, lowH, 0.08], [0, trayBase + lowH / 2, -hd + 0.04], c.shell, { radius: 0.03 }),
  ] });

  // ---------- Corpo de impressão ----------
  const eb = y, eh = c.engineH, et = eb + eh, mid = eb + eh / 2;

  const fdB = eb + 0.05, fdH = eh * 0.8;
  add({ id: 'frontDoor', name: N('frontDoor', 'Porta frontal'), kind: 'shell', origin: [0, fdB, hd],
    meshes: [
      rbox([w - 0.18, fdH, 0.09], [0, fdB + fdH / 2, hd - 0.045], c.shell, { radius: 0.045 }),
      box([w - 0.4, 0.012, 0.01], [0, fdB + fdH * 0.6, hd + 0.001], c.shell2),
      rbox([w * 0.3, 0.075, 0.03], [0, fdB + fdH * 0.88, hd + 0.004], c.dark, { radius: 0.03 }),
      rbox([w * 0.5, 0.05, 0.05], [0, fdB + fdH * 0.4, hd - 0.11], c.handle, { radius: 0.02 }),
    ],
    motion: { type: 'hinge', axis: 'x', angle: 1.4 } });
  const topH = et - (fdB + fdH);
  add({ id: 'front-strip', name: 'Moldura frontal', kind: 'shell', meshes: [
    rbox([w - 0.18, topH, 0.09], [0, fdB + fdH + topH / 2, hd - 0.045], c.trim, { radius: 0.03 }),
    box([0.08, 0.03, 0.01], [hw - 0.4, fdB + fdH + topH / 2, hd + 0.001], '#2fe38a', { mat: 'glow' }),
    box([0.14, 0.05, 0.01], [-hw + 0.45, fdB + fdH + topH / 2, hd + 0.001], '#0d0f12'),
  ] });

  const sideCover = (sign) => {
    const x = sign * (hw - 0.045);
    const part = add({
      id: sign < 0 ? 'leftCover' : 'rightCover',
      name: N(sign < 0 ? 'leftCover' : 'rightCover', sign < 0 ? 'Tampa lateral esquerda' : 'Tampa lateral direita'),
      kind: 'shell',
      meshes: [
        rbox([0.09, eh - 0.03, d - 0.02], [x, mid, 0], c.shell, { radius: 0.04 }),
        slots(7, [0.02, 0.035, d * 0.32], [0, 0.085, 0], [sign * (hw + 0.002), mid + eh * 0.12, -hd * 0.4], '#2a2e35'),
        rbox([0.03, 0.09, 0.55], [sign * (hw + 0.004), eb + 0.4, hd * 0.45], c.dark, { radius: 0.03 }),
      ],
      motion: { type: 'slide', to: [sign * 1.9, 0, 0] },
    });
    screwsFor(part, [eb + 0.3, mid, et - 0.3].map((sy) => [[sign * hw, sy, -hd + 0.22], [sign, 0, 0]]));
  };
  sideCover(-1);
  if (c.fuserAccess === 'right') {
    add({ id: 'rightCover', name: N('rightCover', 'Porta direita'), kind: 'shell', origin: [hw, eb + 0.02, 0],
      meshes: [
        rbox([0.09, eh - 0.04, d - 0.2], [hw - 0.045, mid, 0], c.shell, { radius: 0.04 }),
        rbox([0.035, 0.09, 0.7], [hw + 0.006, eb + eh * 0.82, 0], c.dark, { radius: 0.03 }),
        slots(6, [0.02, 0.035, d * 0.3], [0, 0.085, 0], [hw + 0.002, mid - 0.2, -hd * 0.35], '#2a2e35'),
      ],
      motion: { type: 'hinge', axis: 'z', angle: -1.2 } });
  } else {
    sideCover(1);
  }

  if (c.rearRemovable) {
    const part = add({ id: 'rearCover', name: N('rearCover', 'Tampa traseira'), kind: 'shell',
      meshes: [
        rbox([w - 0.18, eh - 0.04, 0.08], [0, mid, -hd + 0.04], c.shell, { radius: 0.04 }),
        slots(9, [w * 0.45, 0.035, 0.02], [0, 0.085, 0], [0, mid + 0.4, -hd - 0.002], '#2a2e35'),
        rbox([0.32, 0.22, 0.04], [-hw + 0.6, eb + 0.35, -hd - 0.01], '#0f1114', { radius: 0.03 }),
        box([0.5, 0.3, 0.005], [hw - 0.8, eb + 0.5, -hd - 0.003], '#f2f2ee', { mat: 'paper' }),
      ],
      motion: { type: 'slide', to: [0, 0, -2.0] } });
    screwsFor(part, [[-1, 0.25], [1, 0.25], [-1, eh - 0.25], [1, eh - 0.25]].map(([sx, sy]) => [[sx * (hw - 0.25), eb + sy, -hd], [0, 0, -1]]));
  } else {
    const rh = eh * 0.6, rb = et - 0.04 - rh;
    add({ id: 'rearCover', name: N('rearCover', 'Tampa traseira'), kind: 'shell', origin: [0, rb, -hd],
      meshes: [
        rbox([w - 0.18, rh, 0.08], [0, rb + rh / 2, -hd + 0.04], c.shell, { radius: 0.04 }),
        rbox([w * 0.3, 0.07, 0.04], [0, rb + rh * 0.88, -hd - 0.01], c.trim, { radius: 0.025 }),
        slots(5, [w * 0.4, 0.03, 0.02], [0, 0.075, 0], [0, rb + rh * 0.45, -hd - 0.002], '#2a2e35'),
        rbox([w * 0.62, 0.05, 0.06], [0, rb + rh * 0.3, -hd + 0.12], c.handle, { radius: 0.02 }),
      ],
      motion: { type: 'hinge', axis: 'x', angle: -1.4 } });
    add({ id: 'rear-lower', name: 'Painel traseiro inferior', kind: 'shell', meshes: [
      rbox([w - 0.18, rb - eb, 0.08], [0, eb + (rb - eb) / 2, -hd + 0.04], c.shell, { radius: 0.03 }),
      rbox([0.3, 0.2, 0.04], [-hw + 0.55, eb + 0.3, -hd - 0.01], '#0f1114', { radius: 0.03 }),
      box([0.16, 0.14, 0.02], [hw - 0.6, eb + 0.32, -hd - 0.005], '#0f1114'),
      box([0.45, 0.28, 0.005], [0.1, eb + 0.32, -hd - 0.003], '#f2f2ee', { mat: 'paper' }),
    ] });
  }

  add({ id: 'topPlate', name: N('topPlate', 'Bandeja de saída'), kind: 'shell', meshes: [
    rbox([w, 0.1, d], [0, et - 0.05, 0], c.shell, { radius: 0.04 }),
    rbox([w * 0.72, 0.02, d * 0.62], [-0.1, et + 0.002, 0.1], c.shell2, { radius: 0.01 }),
    box([w * 0.42, 0.012, d * 0.5], [-0.25, et + 0.02, 0.05], '#f6f5ef', { mat: 'paper', rot: [0, 0.06, 0] }),
  ] });

  // ---------- Internos ----------
  add({ id: 'lsu', name: N('lsu', c.colorToners ? 'Cabeça de impressão LED' : 'Unidade laser (LSU)'), kind: 'internal', meshes: [
    box([w * 0.66, 0.28, d * 0.42], [0, et - 0.34, 0.15], '#7d858f', { mat: 'metal', rough: 0.45 }),
    box([w * 0.6, 0.012, 0.06], [0, et - 0.48, 0.3], '#7fd4ff', { mat: 'glow', opacity: 0.9 }),
    box([0.25, 0.08, 0.12], [w * 0.28, et - 0.2, -0.05], WHITE_NYLON),
  ] });

  if (c.colorToners) {
    const colors = [['y', 'amarelo', '#f2c200'], ['m', 'magenta', '#d6247a'], ['c', 'ciano', '#16a3d9'], ['k', 'preto', '#24262b']];
    colors.forEach(([k, label, col], i) => {
      const ty = eb + eh * 0.8 - i * 0.32, tz = hd - 0.45;
      add({ id: `toner-${k}`, name: N(`toner-${k}`, `Toner ${label} (${k.toUpperCase()})`), kind: 'internal', origin: [0, ty, tz],
        meshes: [
          rbox([w * 0.68, 0.22, 0.34], [0, ty, tz], col, { radius: 0.09, rough: 0.4 }),
          rbox([0.12, 0.24, 0.36], [w * 0.34 + 0.04, ty, tz], '#2b2e33', { radius: 0.05 }),
          box([w * 0.3, 0.005, 0.2], [-w * 0.1, ty + 0.112, tz], '#f4f4f0', { mat: 'paper' }),
        ],
        motion: { type: 'slide', to: [0, 0, d * 0.85] } });
    });
    const dy = eb + eh * 0.48, dz = -0.25;
    add({ id: 'drum', name: N('drum', 'Unidade de imagem (cilindros)'), kind: 'internal', origin: [0, dy, dz],
      meshes: [
        rbox([w * 0.72, 0.46, 1.4], [0, dy + 0.02, dz], '#2b2f36', { radius: 0.05 }),
        ...[-0.5, -0.17, 0.17, 0.5].map((oz) => cyl(0.1, w * 0.68, 'x', [0, dy - 0.25, dz + oz], '#1f8a6a', { mat: 'metal', metal: 0.4, rough: 0.25 })),
        ...[-0.5, -0.17, 0.17, 0.5].map((oz) => gear(0.13, 'x', [w * 0.37, dy - 0.25, dz + oz], WHITE_NYLON, { depth: 0.04 })),
      ],
      motion: { type: 'slide', to: [0, 0, d * 1.15] } });
    add({ id: 'belt', name: N('belt', 'Correia de transferência'), kind: 'internal', meshes: [
      rbox([w * 0.76, 0.12, d * 0.55], [0, eb + eh * 0.22, -0.2], '#121418', { radius: 0.06, rough: 0.25 }),
      cyl(0.08, w * 0.78, 'x', [0, eb + eh * 0.22, -0.2 + d * 0.275], STEEL, { mat: 'metal' }),
      cyl(0.08, w * 0.78, 'x', [0, eb + eh * 0.22, -0.2 - d * 0.275], STEEL, { mat: 'metal' }),
    ] });
  } else {
    const dy = eb + eh * 0.42, dz = hd * 0.3;
    add({ id: 'drum', name: N('drum', 'Unidade de tambor'), kind: 'internal', origin: [0, dy, dz],
      meshes: [
        rbox([w * 0.74, 0.4, 0.75], [0, dy + 0.02, dz], '#2b2f36', { radius: 0.06 }),
        cyl(0.17, w * 0.7, 'x', [0, dy - 0.2, dz - 0.15], '#1f8a6a', { mat: 'metal', metal: 0.4, rough: 0.25 }),
        gear(0.21, 'x', [w * 0.37, dy - 0.2, dz - 0.15], WHITE_NYLON, { depth: 0.05 }),
        rbox([w * 0.3, 0.06, 0.08], [0, dy + 0.24, dz + 0.3], c.handle, { radius: 0.03 }),
      ],
      motion: { type: 'slide', to: [0, 0, d * 0.95] } });
    const ty = eb + eh * 0.66, tz = hd * 0.55;
    add({ id: 'toner', name: N('toner', 'Cartucho de toner'), kind: 'internal', origin: [0, ty, tz],
      meshes: [
        cyl(0.21, w * 0.66, 'x', [0, ty, tz], '#25272c', { rough: 0.4 }),
        rbox([0.14, 0.48, 0.48], [-w * 0.33 - 0.04, ty, tz], '#33363c', { radius: 0.05 }),
        rbox([0.14, 0.48, 0.48], [w * 0.33 + 0.04, ty, tz], '#33363c', { radius: 0.05 }),
        rbox([w * 0.22, 0.07, 0.1], [0, ty + 0.25, tz + 0.12], c.handle, { radius: 0.03 }),
        box([w * 0.3, 0.13, 0.005], [-w * 0.1, ty, tz + 0.212], '#f4f4f0', { mat: 'paper' }),
      ],
      motion: { type: 'slide', to: [0, 0, d * 0.95] } });
  }

  // Fusor
  const along = c.fuserAccess === 'right' ? 'z' : 'x';
  const fy = et - 0.85;
  const L = along === 'x' ? w * 0.8 : d * 0.8;
  const fp = along === 'x' ? [0, fy, -hd + 0.5] : [hw - 0.55, fy, 0];
  const at = (a, up, b) => (along === 'x' ? [fp[0] + a, fp[1] + up, fp[2] + b] : [fp[0] + b, fp[1] + up, fp[2] + a]);
  const sz = (len, h, dep) => (along === 'x' ? [len, h, dep] : [dep, h, len]);
  const out = along === 'x' ? -0.25 : 0.25; // lado de onde o técnico puxa
  const fuser = add({ id: 'fuser', name: N('fuser', 'Unidade fusora (fusor)'), kind: 'internal', origin: fp,
    meshes: [
      rbox(sz(L, 0.5, 0.62), fp, '#3a3d43', { radius: 0.06, mat: 'metal', metal: 0.35, rough: 0.5 }),
      rbox(sz(0.14, 0.26, 0.32), at(-L / 2 - 0.05, 0.08, out), c.handle, { radius: 0.05 }),
      rbox(sz(0.14, 0.26, 0.32), at(L / 2 + 0.05, 0.08, out), c.handle, { radius: 0.05 }),
      gear(0.2, along, at(L / 2 + 0.02, 0.1, 0.05), WHITE_NYLON, { depth: 0.05 }),
      rbox(sz(0.22, 0.1, 0.14), at(-L / 2 + 0.3, 0.3, 0), WHITE_NYLON, { radius: 0.02 }),
      slots(6, sz(L * 0.12, 0.012, 0.02), along === 'x' ? [L * 0.15, 0, 0] : [0, 0, L * 0.15], at(0, 0.18, out * 1.24), '#1a1c20'),
    ],
    motion: { type: 'slide', to: along === 'x' ? [0, 0.25, -d * 0.9] : [w * 0.85, 0.25, 0] } });
  if (c.fuserScrews) screwsFor(fuser, [-1, 1].map((s) => [at(s * (L / 2 - 0.1), 0.27, out * 0.6), [0, 1, 0]]));
  add({ id: 'heat-roller', name: N('heat-roller', 'Rolo de aquecimento'), kind: 'detail', parent: 'fuser',
    meshes: [cyl(0.13, L * 0.92, along, at(0, 0.1, 0.05), '#a36f3c', { mat: 'metal', metal: 0.5, rough: 0.3 })] });
  add({ id: 'pressure-roller', name: N('pressure-roller', 'Rolo de pressão'), kind: 'detail', parent: 'fuser',
    meshes: [cyl(0.13, L * 0.92, along, at(0, -0.15, 0.05), '#3d4148', { mat: 'rubber', rough: 0.7 })] });
  add({ id: 'heater', name: N('heater', 'Lâmpada aquecedora'), kind: 'detail', parent: 'fuser',
    meshes: [cyl(0.04, L * 0.9, along, at(0, 0.1, 0.05), '#ff4a2a', { mat: 'glow' })] });
  add({ id: 'thermistor', name: N('thermistor', 'Termistor'), kind: 'detail', parent: 'fuser',
    meshes: [box(sz(0.12, 0.05, 0.08), at(L * 0.18, 0.26, 0.05), '#ffd23f'),
      tube([at(L * 0.18, 0.28, 0.05), at(L * 0.05, 0.36, 0.08), at(-L / 2 + 0.3, 0.33, 0)], 0.012, '#e8e8e8')] });
  add({ id: 'thermostat', name: N('thermostat', 'Termostato de segurança'), kind: 'detail', parent: 'fuser',
    meshes: [cyl(0.06, 0.06, 'y', at(-L * 0.18, 0.27, 0.05), STEEL, { mat: 'metal' })] });

  add({ id: 'feed-roller', name: N('feed-roller', 'Rolo de alimentação (pickup)'), kind: 'internal', meshes: [
    cyl(0.11, 0.5, 'x', [0, eb + 0.13, hd - 0.75], RUBBER, { mat: 'rubber' }),
    cyl(0.025, w * 0.6, 'x', [0, eb + 0.13, hd - 0.75], STEEL, { mat: 'metal' }),
  ] });

  // Motor principal: placa voltada para trás, engrenagens por dentro
  const mz = -hd + 0.32, mx = hw - 0.5, my = mid - 0.35;
  const motor = add({ id: 'main-motor', name: N('main-motor', 'Motor principal'), kind: 'internal', origin: [mx, my, mz],
    meshes: [
      box([0.62, 0.62, 0.035], [mx, my, mz], STEEL, { mat: 'metal', rough: 0.4 }),
      cyl(0.17, 0.2, 'z', [mx + 0.08, my - 0.08, mz - 0.12], '#9aa1aa', { mat: 'metal' }),
      cyl(0.1, 0.03, 'z', [mx + 0.08, my - 0.08, mz - 0.235], '#2a2d33'),
      gear(0.25, 'z', [mx - 0.1, my + 0.1, mz + 0.06], WHITE_NYLON, { depth: 0.05, teeth: 30 }),
      gear(0.1, 'z', [mx + 0.08, my - 0.08, mz + 0.06], '#2b2e33', { depth: 0.05, teeth: 12 }),
      box([0.16, 0.08, 0.06], [mx - 0.18, my - 0.24, mz - 0.05], WHITE_NYLON),
    ],
    motion: { type: 'slide', to: [0, 0, -1.6] } });
  screwsFor(motor, [[-0.24, 0.24], [0.24, 0.24], [0.24, -0.24]].map(([ox, oy]) => [[mx + ox, my + oy, mz - 0.018], [0, 0, -1]]));

  // Placa controladora
  const px = -hw + 0.18;
  add({ id: 'main-pcb', name: N('main-pcb', 'Placa controladora (main)'), kind: 'internal', origin: [px, mid, -0.2],
    meshes: [
      box([0.03, eh * 0.55, d * 0.55], [px, mid, -0.2], '#1d6b45', { mat: 'pcb' }),
      box([0.04, 0.26, 0.26], [px + 0.035, mid + 0.3, -0.45], BLACK),
      box([0.04, 0.16, 0.36], [px + 0.035, mid - 0.25, 0.1], BLACK),
      slots(6, [0.1, 0.22, 0.015], [0, 0, 0.04], [px + 0.08, mid + 0.3, -0.45], STEEL, { mat: 'metal' }),
      ...[[0.1, -0.7], [0.0, -0.75], [-0.1, -0.7], [-0.45, 0.35]].map(([oy, oz]) => cyl(0.03, 0.09, 'x', [px + 0.06, mid + oy, oz], '#2f5dd1', { mat: 'metal', metal: 0.5 })),
      box([0.05, 0.08, 0.3], [px + 0.04, mid + eh * 0.2, 0.2], WHITE_NYLON),
      box([0.05, 0.08, 0.2], [px + 0.04, mid - eh * 0.22, -0.55], WHITE_NYLON),
      box([0.02, 0.05, 0.05], [px + 0.025, mid - 0.05, 0.4], '#2fe38a', { mat: 'glow' }),
    ] });
  // Fonte com ventoinha e chicote até o fusor
  const sx = -w * 0.2, sy = eb + 0.28, sz2 = -hd + 0.42;
  const fuserPlug = at(-L / 2 + 0.3, 0.32, 0);
  add({ id: 'psu', name: N('psu', 'Fonte / placa de força'), kind: 'internal', origin: [sx, sy, sz2],
    meshes: [
      box([w * 0.36, 0.34, d * 0.32], [sx, sy, sz2], '#a9b0b9', { mat: 'metal', rough: 0.45 }),
      slots(8, [0.035, 0.012, d * 0.26], [0.07, 0, 0], [sx, sy + 0.172, sz2], '#2a2e35'),
      box([0.18, 0.08, 0.06], [sx + w * 0.12, sy + 0.2, sz2 + 0.1], WHITE_NYLON),
      tube([[sx + w * 0.12, sy + 0.22, sz2 + 0.1], [sx + w * 0.12, sy + 0.6, sz2 + 0.2], [fuserPlug[0] - 0.2, fuserPlug[1] - 0.3, fuserPlug[2] + 0.1], fuserPlug], 0.025, '#1b1d21'),
      tube([[sx + w * 0.05, sy + 0.22, sz2 + 0.05], [px + 0.3, mid - 0.6, -0.4], [px + 0.06, mid - eh * 0.22, -0.55]], 0.02, '#c43b3b'),
    ] });
  add({ id: 'fan', name: N('fan', 'Ventoinha'), kind: 'internal', meshes: [
    box([0.42, 0.42, 0.08], [-hw + 0.45, eb + eh * 0.45, -hd + 0.14], '#1d1f23'),
    gear(0.17, 'z', [-hw + 0.45, eb + eh * 0.45, -hd + 0.1], '#2d3036', { depth: 0.03, teeth: 7 }),
  ] });

  // ---------- Scanner ----------
  const sb = et + c.gap, st = sb + c.scanH;
  add({ id: 'column', name: 'Coluna do scanner', kind: 'shell', meshes: [
    rbox([w, c.gap + 0.1, d * 0.22], [0, et + c.gap / 2, -hd + d * 0.11], c.shell, { radius: 0.05 }),
  ] });
  add({ id: 'scanner', name: N('scanner', 'Unidade do scanner'), kind: 'shell', meshes: [
    rbox([w, c.scanH, d], [0, sb + c.scanH / 2, 0], c.shell, { radius: 0.06 }),
    rbox([w * 0.86, 0.02, d * 0.8], [-0.06, st + 0.002, 0.04], '#2b2f36', { radius: 0.01 }),
  ] });
  add({ id: 'platen', name: N('platen', 'Vidro de originais'), kind: 'detail', meshes: [
    box([w * 0.78, 0.02, d * 0.72], [-0.08, st + 0.014, 0.05], '#9fd3ff', { mat: 'glass', opacity: 0.45 }),
    box([w * 0.78, 0.022, 0.06], [-0.08, st + 0.015, -d * 0.36 + 0.05], '#f4f4f0', { mat: 'paper' }),
  ] });
  add({ id: 'rails', name: 'Trilhos do carro', kind: 'internal', meshes: [
    cyl(0.025, w * 0.86, 'x', [0, sb + 0.25, -d * 0.3], STEEL, { mat: 'metal' }),
    cyl(0.025, w * 0.86, 'x', [0, sb + 0.25, d * 0.35], STEEL, { mat: 'metal' }),
  ] });
  const cx = -w * 0.34, cy = sb + c.scanH * 0.5;
  add({ id: 'carriage', name: N('carriage', 'Carro do scanner (CCD + lâmpada)'), kind: 'internal', origin: [cx, cy, 0.05],
    meshes: [
      rbox([0.3, 0.22, d * 0.74], [cx, cy, 0.05], '#2b2f36', { radius: 0.04 }),
      box([0.06, 0.03, d * 0.7], [cx, cy + 0.125, 0.05], '#fff3b0', { mat: 'glow' }),
      box([0.16, 0.08, 0.14], [cx, cy - 0.05, -d * 0.3], WHITE_NYLON),
    ],
    motion: { type: 'slide', to: [w * 0.62, 0, 0] } });
  add({ id: 'scan-motor', name: N('scan-motor', 'Motor do scanner'), kind: 'internal', meshes: [
    cyl(0.11, 0.16, 'y', [hw - 0.45, sb + 0.17, -hd + 0.45], '#9aa1aa', { mat: 'metal' }),
    gear(0.08, 'y', [hw - 0.45, sb + 0.28, -hd + 0.45], WHITE_NYLON, { depth: 0.03, teeth: 12 }),
  ] });
  add({ id: 'scan-belt', name: N('scan-belt', 'Correia do scanner'), kind: 'internal', meshes: [
    rbox([w * 0.8, 0.03, 0.05], [0, sb + 0.28, -hd + 0.3], '#111317', { radius: 0.012, mat: 'rubber' }),
  ] });
  add({ id: 'scan-lock', name: N('scan-lock', 'Trava de transporte do scanner'), kind: 'internal', meshes: [
    rbox([0.18, 0.09, 0.24], [-hw + 0.32, sb + 0.06, hd - 0.6], c.handle, { radius: 0.03 }),
  ] });
  add({ id: 'scan-cable', name: N('scan-cable', 'Cabo flat do carro'), kind: 'internal', meshes: [
    tube([[cx, cy - 0.05, -d * 0.3], [cx + 0.6, sb + 0.08, -d * 0.2], [0.4, sb + 0.06, -d * 0.35], [px + 0.2, sb + 0.05, -hd + 0.5]], 0.018, '#d9d2b8'),
    tube([[px + 0.2, sb + 0.05, -hd + 0.5], [px + 0.15, et + 0.3, -hd + 0.4], [px + 0.06, mid + eh * 0.2, 0.2]], 0.018, '#d9d2b8'),
  ] });

  const adfB = st + 0.025;
  const ah = c.adfH;
  add({ id: 'adf', name: N('adf', 'Alimentador de originais (ADF)'), kind: 'shell', origin: [0, adfB, -hd],
    meshes: [
      rbox([w, ah * 0.55, d * 0.96], [0, adfB + ah * 0.275, -d * 0.02], c.shell, { radius: 0.05 }),
      rbox([w * 0.3, ah * 0.5, d * 0.92], [-hw + w * 0.15, adfB + ah * 0.75, -d * 0.04], c.shell, { radius: 0.06 }),
      rbox([w * 0.62, 0.05, d * 0.7], [w * 0.17, adfB + ah * 0.7, 0], c.shell2, { radius: 0.02, rot: [0, 0, -0.12] }),
      box([w * 0.42, 0.03, d * 0.55], [w * 0.15, adfB + ah * 0.76, 0], '#f6f5ef', { mat: 'paper', rot: [0, 0, -0.12] }),
      rbox([0.05, 0.12, d * 0.4], [-w * 0.05, adfB + ah * 0.78, 0], c.trim, { radius: 0.02 }),
      rbox([0.05, 0.12, d * 0.4], [w * 0.4, adfB + ah * 0.7, 0], c.trim, { radius: 0.02 }),
      rbox([w * 0.28, 0.03, 0.12], [-hw + w * 0.15, adfB + ah * 1.0, d * 0.35], c.dark, { radius: 0.015 }),
      ...[-1, 1].map((s) => rbox([0.3, 0.22, 0.18], [s * (hw - 0.6), adfB + 0.08, -hd + 0.06], c.trim, { radius: 0.04 })),
    ],
    motion: { type: 'hinge', axis: 'x', angle: -1.1 } });

  // Painel inclinado com tela (o viewer desenha o código de erro nela)
  const tilt = 0.55;
  const pc = [w * 0.16, sb + c.scanH * 0.42, hd + 0.26];
  const n = [0, Math.cos(tilt), Math.sin(tilt)];
  const v = [0, -Math.sin(tilt), Math.cos(tilt)];
  const onPanel = (a, b, up) => [pc[0] + a, pc[1] + n[1] * up + v[1] * b, pc[2] + n[2] * up + v[2] * b];
  add({ id: 'panel', name: N('panel', 'Painel de controle'), kind: 'shell', origin: pc,
    meshes: [
      rbox([w * 0.52, 0.09, 0.6], pc, c.dark, { rot: [tilt, 0, 0], radius: 0.04 }),
      box([w * 0.3, 0.008, 0.38], onPanel(-w * 0.06, -0.02, 0.048), '#0b1220', { rot: [tilt, 0, 0], mat: 'screen', screen: true }),
      ...[0, 1, 2].map((i) => cyl(0.04, 0.025, 'y', onPanel(w * 0.15 + i * 0.12, 0.12, 0.05), i === 2 ? '#2fa8ff' : '#3a3f47', { rot: [tilt, 0, 0], mat: i === 2 ? 'glow' : 'plastic' })),
      cyl(0.05, 0.025, 'y', onPanel(w * 0.21, -0.1, 0.05), '#2fe38a', { rot: [tilt, 0, 0], mat: 'glow' }),
    ] });

  return P;
}
