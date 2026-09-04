// 測試替身：只實作本專案用到的 three.js API，不做任何繪製。
// 用途是在無頭瀏覽器裡跑完整流程，抓出邏輯與 DOM 錯誤（不驗證畫面）。
export const REVISION = 'stub';

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  setScalar(s) { return this.set(s, s, s); }
}
class V2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  clone() { return new V2(this.x, this.y); }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
}
class Euler extends V3 {
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class Col {
  constructor(hex = 0xffffff) { this.setHex(hex); }
  setHex(h) { this.hex = h; return this; }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  copy(c) { this.hex = c.hex; return this; }
  clone() { return new Col(this.hex); }
  lerp() { return this; }
  multiplyScalar() { return this; }
  set(v) { if (typeof v === 'number') this.hex = v; return this; }
  getHex() { return this.hex; }
}

class Obj3D {
  constructor() {
    this.position = new V3();
    this.rotation = new Euler();
    this.scale = new V3(1, 1, 1);
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.userData = {};
    this.name = '';
    this.castShadow = false;
    this.receiveShadow = false;
    this.matrixAutoUpdate = true;
  }
  add(...objs) { objs.forEach((o) => { if (o) { o.parent = this; this.children.push(o); } }); return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) { this.children.splice(i, 1); o.parent = null; } return this; }
  traverse(fn) { fn(this); this.children.forEach((c) => c.traverse(fn)); }
  lookAt() { return this; }
  getWorldPosition(t = new V3()) { return t.copy(this.position); }
  updateMatrixWorld() {}
}

class Geo {
  constructor(type, args) { this.type = type; this.parameters = args; this.attributes = {}; }
  translate() { return this; }
  dispose() {}
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  setFromPoints(points) { this.points = points; return this; }
  computeVertexNormals() {}
}
const geo = (type) => class extends Geo { constructor(...args) { super(type, args); } };

class Mat {
  constructor(type, opts = {}) {
    this.type = type;
    Object.assign(this, opts);
    this.color = opts.color instanceof Col ? opts.color : new Col(opts.color ?? 0xffffff);
    this.emissive = opts.emissive instanceof Col ? opts.emissive : new Col(opts.emissive ?? 0x000000);
    this.emissiveIntensity = opts.emissiveIntensity ?? 1;
    this.opacity = opts.opacity ?? 1;
    this.needsUpdate = false;
  }
  clone() { const m = new Mat(this.type, {}); Object.assign(m, this); m.color = this.color.clone(); m.emissive = this.emissive.clone(); return m; }
  dispose() {}
}
const mat = (type) => class extends Mat { constructor(opts) { super(type, opts); } };

export const Scene = class extends Obj3D { constructor() { super(); this.background = null; this.fog = null; } };
export const Group = class extends Obj3D {};
export const Mesh = class extends Obj3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; this.isMesh = true; }
};
export const Points = class extends Mesh {};
export const Line = class extends Mesh {};
export const LineSegments = class extends Mesh {};

export const PerspectiveCamera = class extends Obj3D {
  constructor(fov, aspect, near, far) { super(); Object.assign(this, { fov, aspect, near, far }); }
  updateProjectionMatrix() {}
  getWorldDirection(t = new V3()) {
    const { x: pitch, y: yaw } = this.rotation;
    return t.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }
};

class Light extends Obj3D {
  constructor(color, intensity = 1, distance = 0, decay = 2) {
    super();
    this.isLight = true;
    this.color = new Col(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    this.shadow = { mapSize: new V2(512, 512), camera: {}, bias: 0 };
  }
}
export const AmbientLight = class extends Light {};
export const HemisphereLight = class extends Light {};
export const DirectionalLight = class extends Light { constructor(...a) { super(...a); this.target = new Obj3D(); } };
export const PointLight = class extends Light {};
export const SpotLight = class extends Light {
  constructor(color, intensity, distance, angle, penumbra, decay) {
    super(color, intensity, distance, decay);
    this.angle = angle; this.penumbra = penumbra;
    this.target = new Obj3D();
  }
};

export const BoxGeometry = geo('BoxGeometry');
export const PlaneGeometry = geo('PlaneGeometry');
export const CylinderGeometry = geo('CylinderGeometry');
export const SphereGeometry = geo('SphereGeometry');
export const ConeGeometry = geo('ConeGeometry');
export const TorusGeometry = geo('TorusGeometry');
export const CircleGeometry = geo('CircleGeometry');
export const RingGeometry = geo('RingGeometry');
export const BufferGeometry = geo('BufferGeometry');

export const MeshStandardMaterial = mat('MeshStandardMaterial');
export const MeshBasicMaterial = mat('MeshBasicMaterial');
export const LineBasicMaterial = mat('LineBasicMaterial');
export const PointsMaterial = mat('PointsMaterial');

export class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; }
}
export class CanvasTexture {
  constructor(canvas) { this.image = canvas; this.repeat = new V2(1, 1); this.needsUpdate = false; }
  dispose() {}
}
export class Fog { constructor(color, near, far) { Object.assign(this, { color, near, far }); } }
export class Clock {
  constructor() { this.elapsedTime = 0; this.last = 0; }
  start() { this.last = performance.now(); }
  getDelta() { const now = performance.now(); const d = (now - this.last) / 1000; this.last = now; this.elapsedTime += d; return d; }
}
// ── 幾何尺寸推算（供射線求交用）──────────────────────────────
function geoExtents(geo) {
  const p = geo?.parameters || [];
  const n = (i, d) => (typeof p[i] === 'number' ? p[i] : d);
  switch (geo?.type) {
    case 'BoxGeometry': return [n(0, 1), n(1, 1), n(2, 1)];
    case 'PlaneGeometry': return [n(0, 1), n(1, 1), 0.02];
    case 'CylinderGeometry': { const r = Math.max(n(0, 1), n(1, 1)); return [2 * r, n(2, 1), 2 * r]; }
    case 'SphereGeometry': { const r = n(0, 1); return [2 * r, 2 * r, 2 * r]; }
    case 'ConeGeometry': { const r = n(0, 1); return [2 * r, n(1, 1), 2 * r]; }
    case 'TorusGeometry': { const r = n(0, 1) + n(1, 0.1); return [2 * r, 2 * r, 2 * n(1, 0.1)]; }
    case 'CircleGeometry': { const r = n(0, 1); return [2 * r, 2 * r, 0.02]; }
    case 'RingGeometry': { const r = n(1, 1); return [2 * r, 2 * r, 0.02]; }
    default: return [0.2, 0.2, 0.2];
  }
}

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function eulerMat(rot, order = 'XYZ') {
  const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
  const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
  const cz = Math.cos(rot.z), sz = Math.sin(rot.z);
  const RX = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const RY = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const RZ = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return order === 'YXZ' ? mul(mul(RY, RX), RZ) : mul(mul(RX, RY), RZ);
}
function mul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}
function apply(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}
/** 累積父階層的位移、旋轉與縮放，得到世界矩陣與位置 */
export function worldOf(obj) {
  const chain = [];
  let o = obj;
  while (o) { chain.unshift(o); o = o.parent; }
  let m = IDENT;
  let p = [0, 0, 0];
  for (const node of chain) {
    const sc = node.scale || { x: 1, y: 1, z: 1 };
    const local = apply(m, [node.position.x * sc.x, node.position.y * sc.y, node.position.z * sc.z]);
    p = [p[0] + local[0], p[1] + local[1], p[2] + local[2]];
    m = mul(m, eulerMat(node.rotation));
  }
  return { m, p };
}
/** 世界空間的軸對齊邊界盒（用旋轉後的絕對值展開，保守但夠用） */
export function worldBox(mesh) {
  const { m, p } = worldOf(mesh);
  const e = geoExtents(mesh.geometry).map((v) => Math.abs(v) / 2);
  const sc = mesh.scale || { x: 1, y: 1, z: 1 };
  const local = [e[0] * Math.abs(sc.x), e[1] * Math.abs(sc.y), e[2] * Math.abs(sc.z)];
  const half = [0, 1, 2].map((row) =>
    Math.abs(m[row * 3]) * local[0] + Math.abs(m[row * 3 + 1]) * local[1] + Math.abs(m[row * 3 + 2]) * local[2]);
  return { center: p, half };
}

function rayBox(origin, dir, box) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const lo = box.center[i] - box.half[i];
    const hi = box.center[i] + box.half[i];
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < lo || origin[i] > hi) return null;
    } else {
      let t1 = (lo - origin[i]) / dir[i];
      let t2 = (hi - origin[i]) / dir[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class Raycaster {
  constructor() {
    this.far = Infinity;
    this.near = 0;
    this.ray = { origin: new V3(), direction: new V3(0, 0, -1) };
  }

  setFromCamera(ndc, camera) {
    const { m, p } = worldOf(camera);
    const cm = mul(IDENT, eulerMat(camera.rotation, 'YXZ'));
    const forward = apply(cm, [0, 0, -1]);
    const right = apply(cm, [1, 0, 0]);
    const up = apply(cm, [0, 1, 0]);
    const tanV = Math.tan(((camera.fov || 60) * Math.PI) / 360);
    const tanH = tanV * (camera.aspect || 1.6);
    const d = [0, 1, 2].map((i) =>
      forward[i] + right[i] * tanH * (ndc?.x || 0) + up[i] * tanV * (ndc?.y || 0));
    const len = Math.hypot(...d) || 1;
    this.ray.origin.set(p[0], p[1], p[2]);
    this.ray.direction.set(d[0] / len, d[1] / len, d[2] / len);
    void m;
  }

  intersectObjects(objects, recursive = true) {
    // 測試可以用 window.__stubHits 覆寫，維持既有測試的相容性
    if (window.__stubHits && window.__stubHits.length) return window.__stubHits;

    const origin = [this.ray.origin.x, this.ray.origin.y, this.ray.origin.z];
    const dir = [this.ray.direction.x, this.ray.direction.y, this.ray.direction.z];
    const hits = [];
    const visit = (node) => {
      if (!node || node.visible === false) return;
      // three.js r160 的 Raycaster 不會因為材質 visible:false 就跳過，隱形命中框才有用
      if (node.isMesh && node.geometry) {
        const t = rayBox(origin, dir, worldBox(node));
        if (t !== null && t <= this.far) {
          hits.push({
            object: node,
            distance: t,
            point: new V3(origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t)
          });
        }
      }
      if (recursive) (node.children || []).forEach(visit);
    };
    (objects || []).forEach(visit);
    return hits.sort((a, b) => a.distance - b.distance);
  }
}
export class WebGLRenderer {
  constructor(opts = {}) {
    this.domElement = opts.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (this.domElement) this.domElement.classList.add('stub-canvas');
    this.shadowMap = { enabled: false, type: 0 };
    this.toneMapping = 0;
    this.toneMappingExposure = 1;
    this.outputColorSpace = '';
    this.info = { render: {} };
  }
  setPixelRatio() {}
  setSize() {}
  render() { window.__stubFrames = (window.__stubFrames || 0) + 1; }
  dispose() {}
}

export const Vector3 = V3;
export const Vector2 = V2;
export const Color = Col;
export const Object3D = Obj3D;
export const ColorManagement = { enabled: false };
export const SRGBColorSpace = 'srgb';
export const PCFSoftShadowMap = 2;
export const ACESFilmicToneMapping = 4;
export const DoubleSide = 2;
export const FrontSide = 0;
export const RepeatWrapping = 1000;
export const MathUtils = { degToRad: (d) => (d * Math.PI) / 180, clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
