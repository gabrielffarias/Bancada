// Viewer Three.js: cena com iluminação de estúdio, animação sequencial (parafusos → tampa → peça),
// raio-X, destaque, rótulos e a tela do painel mostrando o código de erro.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel, disposeModel, poseAt } from './model-builder.js';

const HIGHLIGHT = new THREE.Color('#ff7a1a');
const PICK = new THREE.Color('#3da9ff');
const SCREW_GAP = 0.22; // s entre um parafuso e o próximo

const VIEWS = {
  iso: [1, 0.72, 1.35],
  front: [0.3, 0.35, 1],
  rear: [0.4, 0.45, -1],
  left: [-1, 0.35, 0.4],
  right: [1, 0.35, 0.4],
  top: [0.15, 1.3, 0.7],
};

export class Viewer {
  constructor(container, { onPick } = {}) {
    this.container = container;
    this.onPick = onPick;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.9;
    this.controls.addEventListener('start', () => { this.flying = false; this.busyUntil = 0; });

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(7, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 13, bottom: -5, near: 1, far: 50 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 0.6);
    rim.position.set(-9, 7, -8);
    this.scene.add(rim);

    // Piso: sombra + halo suave
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const halo = document.createElement('canvas');
    halo.width = halo.height = 256;
    const hg = halo.getContext('2d');
    const grad = hg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(120,150,200,0.22)');
    grad.addColorStop(1, 'rgba(120,150,200,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 256, 256);
    const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(halo), transparent: true, depthWrite: false }));
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 0.002;
    this.scene.add(haloMesh);
    const grid = new THREE.GridHelper(26, 52, 0x34405a, 0x1f2633);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.scene.add(grid);

    // Tela do painel
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 320;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.setScreen(null);

    this.model = null;
    this.highlight = new Set();
    this.ghost = new Set();
    this.xray = false;
    this.userXray = false;
    this.explode = 0;
    this.explodeTarget = 0;
    this.focusId = null;
    this.view = 'iso';
    this.picked = null;
    this.labels = [];
    this.flying = false;
    this.autoRotate = false;
    this.clock = new THREE.Clock();
    this.tmp = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this._bindPick();

    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    r.setAnimationLoop(() => this._tick());
  }

  setPrinter(printer) {
    if (this.model) {
      this.scene.remove(this.model.root);
      disposeModel(this.model);
    }
    this._clearLabels();
    this.model = buildModel(printer.parts);
    for (const p of this.model.parts.values()) {
      for (const m of p.meshes) {
        if (m.userData.screen) {
          m.material.map = this.screenTex;
          m.material.emissiveMap = this.screenTex;
          m.material.emissive.set('#ffffff');
          m.material.emissiveIntensity = 0.9;
          m.material.userData.glow = 0.9;
          m.material.color.set('#ffffff');
          m.material.needsUpdate = true;
        }
      }
    }
    this.scene.add(this.model.root);
    this.model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model.root);
    this.center = box.getCenter(new THREE.Vector3());
    this.size = box.getSize(new THREE.Vector3()).length();
    for (const p of this.model.parts.values()) {
      const wc = p.node.localToWorld(p.localCenter.clone()).sub(this.center);
      wc.y *= 0.6;
      p.explodeDir = wc.lengthSq() > 1e-6 ? wc.normalize() : new THREE.Vector3(0, 1, 0);
      p.explodeAmt = p.def.kind === 'shell' ? 2.4 : p.def.kind === 'screw' ? 2.6 : 1.4;
    }
    this.highlight = new Set();
    this.ghost = new Set();
    this.picked = null;
    this.focusId = null;
    this.view = 'iso';
    this.flyTo({ instant: true });
  }

  /** Desenha o código de erro na tela do painel. */
  setScreen(code) {
    const g = this.screenCanvas.getContext('2d');
    const W = 512, H = 320;
    g.fillStyle = code ? '#1a0c06' : '#06101f';
    g.fillRect(0, 0, W, H);
    if (code) {
      g.fillStyle = '#ff7a1a';
      g.fillRect(0, 0, W, 54);
      g.fillStyle = '#1a0c06';
      g.font = '700 30px system-ui, sans-serif';
      g.fillText('⚠  Chamar assistência', 22, 38);
      g.fillStyle = '#ffffff';
      g.font = '700 92px monospace';
      g.fillText(code.code, 22, 160);
      g.fillStyle = '#ffb27a';
      g.font = '500 28px system-ui, sans-serif';
      const words = code.title.split(' ');
      let line = '', yy = 220;
      for (const wd of words) {
        if (g.measureText(line + wd).width > W - 44) { g.fillText(line, 22, yy); line = ''; yy += 36; }
        line += wd + ' ';
      }
      g.fillText(line, 22, yy);
    } else {
      g.fillStyle = '#3d8bff';
      g.fillRect(22, 24, 140, 10);
      g.fillStyle = '#d8e6ff';
      g.font = '600 46px system-ui, sans-serif';
      g.fillText('Pronta', 22, 110);
      const tiles = ['Copiar', 'Digitalizar', 'Imprimir', 'Fax'];
      tiles.forEach((t, i) => {
        const x = 22 + (i % 2) * 238, y = 150 + Math.floor(i / 2) * 78;
        g.fillStyle = '#12233f';
        g.fillRect(x, y, 226, 64);
        g.fillStyle = '#9fc2ff';
        g.font = '500 26px system-ui, sans-serif';
        g.fillText(t, x + 16, y + 41);
      });
    }
    this.screenTex.needsUpdate = true;
  }

  /** Aplica o estado de um passo. `open` vem em ordem: peças abrem nessa sequência. */
  apply({ open = [], highlight = [], ghost = [], xray = false, focus = null, view = 'iso' } = {}) {
    if (!this.model) return;
    const parts = this.model.parts;
    const has = (id) => parts.has(id);
    const wanted = open.filter(has);
    const wantSet = new Set(wanted);
    const now = this.clock.elapsedTime;
    let t = 0;
    const extraHl = [];

    // Fechar: inverso do que estava aberto (peça volta, depois os parafusos)
    const closing = [...parts.values()].filter((p) => p.def.kind !== 'screw' && p.target === 1 && !wantSet.has(p.def.id)).reverse();
    for (const p of closing) {
      this._schedule(p, 0, now + t);
      t += p.duration * 0.7;
      (p.def.screws || []).forEach((sid, i) => this._schedule(parts.get(sid), 0, now + t + i * SCREW_GAP * 0.7));
      if (p.def.screws?.length) t += p.def.screws.length * SCREW_GAP * 0.7 + 0.5;
    }
    // Abrir: parafusos primeiro, um por um, depois a peça
    for (const id of wanted) {
      const p = parts.get(id);
      if (p.target === 1) continue;
      const screws = p.def.screws || [];
      screws.forEach((sid, i) => this._schedule(parts.get(sid), 1, now + t + i * SCREW_GAP));
      if (screws.length) {
        t += screws.length * SCREW_GAP + 0.75;
        extraHl.push(...screws);
      }
      this._schedule(p, 1, now + t);
      t += p.duration * 0.6;
    }
    this.busyUntil = now + t + 1.0;

    this.highlight = new Set([...highlight.filter(has), ...extraHl]);
    this.ghost = new Set(ghost.filter(has));
    this.xray = xray;
    this.picked = null;
    this.focusId = focus && has(focus) ? focus : null;
    this.view = view;
    this._clearLabels();
    for (const id of highlight.filter(has)) this._addLabel(id, 'hl');
    if (extraHl.length) this._addLabel(extraHl[0], 'hl', `Parafusos Phillips ×${extraHl.length}`);
    this.flyTo();
  }

  _schedule(p, target, at) {
    if (!p || p.target === target) return;
    p.target = target;
    p.from = p.prog;
    p.startAt = at;
  }

  pick(id, { fly = true } = {}) {
    if (!this.model?.parts.has(id)) return;
    this._clearLabels('pick');
    this.picked = id;
    this._addLabel(id, 'pick');
    if (fly) {
      this.focusId = id;
      this.flyTo();
    }
  }

  setXray(on) { this.userXray = on; }
  setExplode(on) { this.explodeTarget = on ? 1 : 0; this.flyTo(); }
  setAutoRotate(on) { this.autoRotate = on; }

  flyTo({ instant = false } = {}) {
    if (instant && this.model) {
      const { target, pos } = this._focusTarget();
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.flying = false;
      return;
    }
    this.flying = true;
    this.flyStart = performance.now();
    this.flyFromPos = this.camera.position.clone();
    this.flyFromTarget = this.controls.target.clone();
  }

  resetView() {
    this.focusId = null;
    this.view = 'iso';
    this.flyTo();
  }

  // ---------- internos ----------
  _focusTarget() {
    const p = this.focusId && this.model.parts.get(this.focusId);
    const dir = new THREE.Vector3(...(VIEWS[this.view] || VIEWS.iso)).normalize();
    const fit = (this.camera.aspect < 1 ? 1 / this.camera.aspect : 1) * (1 + 0.55 * this.explodeTarget);
    if (p) {
      const target = p.node.localToWorld(p.localCenter.clone());
      const dist = Math.max(p.radius * 3.2, this.size * 0.62) * fit;
      return { target, pos: target.clone().addScaledVector(dir, dist) };
    }
    const target = this.center.clone();
    return { target, pos: target.clone().addScaledVector(dir, this.size * 1.3 * fit) };
  }

  _addLabel(id, cls, text) {
    const p = this.model.parts.get(id);
    const el = document.createElement('div');
    el.className = `part-label ${cls}`;
    el.innerHTML = `<b>${text || p.def.name}</b>${!text && p.def.pn ? `<span>${p.def.pn}</span>` : ''}`;
    const obj = new CSS2DObject(el);
    obj.position.copy(p.localCenter);
    obj.position.y = p.localBox.max.y + 0.15;
    obj.userData.cls = cls;
    p.node.add(obj);
    this.labels.push(obj);
  }

  _clearLabels(onlyCls) {
    this.labels = this.labels.filter((l) => {
      if (onlyCls && l.userData.cls !== onlyCls) return true;
      l.parent?.remove(l);
      l.element.remove();
      return false;
    });
  }

  _bindPick() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!down || !this.model) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 6) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const meshes = [];
      for (const p of this.model.parts.values()) for (const m of p.meshes) if (m.material.opacity > 0.4) meshes.push(m);
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return;
      const id = hit.object.userData.partId;
      this.pick(id, { fly: false });
      this.onPick?.(this.model.parts.get(id).def);
    });
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    if (this.model) {
      const k = 1 - Math.exp(-dt * 6);
      this.explode += (this.explodeTarget - this.explode) * k;
      const xrayShell = this.xray || this.userXray;
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);

      for (const [id, p] of this.model.parts) {
        // progresso por tempo: anima de `from` até `target` a partir de `startAt`
        if (t >= p.startAt && p.prog !== p.target) {
          const u = Math.min(1, (t - p.startAt) / p.duration);
          p.prog = p.from + (p.target - p.from) * u;
        }
        const pos = poseAt(p, this.tmp);
        if (!p.parentPart && this.explode > 0.001) pos.addScaledVector(p.explodeDir, p.explodeAmt * this.explode);
        p.node.position.copy(pos);

        const ghosted = this.ghost.has(id) || (xrayShell && p.def.kind === 'shell');
        const hl = this.highlight.has(id);
        const pk = this.picked === id;
        for (const mat of p.mats) {
          const target = ghosted ? 0.1 : mat.userData.baseOpacity;
          mat.opacity += (target - mat.opacity) * k;
          mat.depthWrite = mat.opacity > 0.9;
          if (hl) { mat.emissive.copy(HIGHLIGHT); mat.emissiveIntensity = 0.3 + 0.5 * pulse; }
          else if (pk) { mat.emissive.copy(PICK); mat.emissiveIntensity = 0.45; }
          else if (mat.userData.glow) {
            if (!mat.emissiveMap) mat.emissive.copy(mat.color);
            else mat.emissive.set('#ffffff');
            mat.emissiveIntensity = mat.userData.glow;
          } else { mat.emissiveIntensity = 0; }
        }
      }

      const tracking = this.flying || (this.busyUntil && t < this.busyUntil && this.focusId);
      if (this.flying) {
        const { target, pos } = this._focusTarget();
        const elapsed = performance.now() - this.flyStart;
        const u = Math.min(1, elapsed / 1100);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        this.controls.target.lerpVectors(this.flyFromTarget, target, e);
        this.camera.position.lerpVectors(this.flyFromPos, pos, e);
        if (u >= 1 && !(this.busyUntil && t < this.busyUntil)) this.flying = false;
      } else if (tracking) {
        const { target, pos } = this._focusTarget();
        this.controls.target.lerp(target, k);
        this.camera.position.lerp(pos, k);
      } else if (this.autoRotate) {
        const off = this.camera.position.clone().sub(this.controls.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.25);
        this.camera.position.copy(this.controls.target).add(off);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}
