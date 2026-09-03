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
export class Raycaster {
  constructor() { this.far = Infinity; this.ray = { origin: new V3(), direction: new V3() }; }
  setFromCamera() {}
  intersectObjects() { return window.__stubHits || []; }
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
