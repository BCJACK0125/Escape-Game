// 互動層：Raycaster 命中偵測、hover 提示、距離門檻、點擊分派。
// 世界物件只要 interaction.add(obj, { label, onClick }) 就會自動獲得
// 游標高亮、HUD 名稱提示與 E 鍵操作。

import THREE from './three.js';
import { INTERACT } from '../config.js';
import { clamp } from './util.js';

export function createInteraction({ engine, camera, controls, hud, audio }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 12;
  const registry = [];          // { object, opts }
  const byId = new Map();
  let globalEnabled = true;
  let hovered = null;
  let pulse = 0;

  function prepareHighlight(root) {
    root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.material || mesh.userData.__noHighlight) return;
      if (!mesh.userData.__matCloned) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
        mesh.userData.__matCloned = true;
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.userData.__base = mats.map((m) => ({
        emissive: m.emissive ? m.emissive.clone() : null,
        intensity: m.emissiveIntensity ?? 1
      }));
    });
  }

  function applyHighlight(root, amount) {
    root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.userData.__base) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m, i) => {
        const base = mesh.userData.__base[i];
        if (!base || !m.emissive) return;
        if (amount <= 0) {
          if (base.emissive) m.emissive.copy(base.emissive);
          m.emissiveIntensity = base.intensity;
        } else {
          if (base.emissive) m.emissive.copy(base.emissive).lerp(new THREE.Color(0xffd98a), 0.55 * amount);
          m.emissiveIntensity = base.intensity + INTERACT.hoverBoost * amount;
        }
      });
    });
  }

  const api = {
    add(object, opts = {}) {
      const entry = { object, opts: Object.assign({ distance: INTERACT.maxDistance, highlight: true }, opts) };
      if (entry.opts.highlight) prepareHighlight(object);
      object.userData.interactive = entry.opts;
      registry.push(entry);
      if (opts.id) byId.set(opts.id, entry);
      return entry;
    },

    remove(object) {
      const i = registry.findIndex((e) => e.object === object);
      if (i >= 0) {
        applyHighlight(registry[i].object, 0);
        if (registry[i].opts.id) byId.delete(registry[i].opts.id);
        registry.splice(i, 1);
      }
    },

    get(id) { return byId.get(id); },

    /** 更新某個互動點的文案或可用性 */
    update(id, patch) {
      const entry = byId.get(id);
      if (entry) Object.assign(entry.opts, patch);
    },

    setEnabled(v) {
      globalEnabled = v;
      if (!v) api.clearHover();
    },

    clearHover() {
      if (hovered) applyHighlight(hovered.object, 0);
      hovered = null;
      hud?.setPrompt(null);
      document.body.classList.remove('cursor-interact');
    },

    get hovered() { return hovered; },

    /** 以畫面中央為準心觸發（螢幕上的「互動」鈕、E 鍵都走這裡） */
    activateCenter() { activate(CENTER); },

    /** 給謎題用：主動觸發某個互動點 */
    trigger(id) {
      const entry = byId.get(id);
      if (entry?.opts.onClick) entry.opts.onClick({ object: entry.object, forced: true });
    }
  };

  function available(entry) {
    if (entry.opts.hidden) return false;
    if (entry.object.visible === false) return false;
    let p = entry.object.parent;
    while (p) { if (p.visible === false) return false; p = p.parent; }
    if (typeof entry.opts.enabled === 'function' && !entry.opts.enabled()) return false;
    return true;
  }

  const CENTER = new THREE.Vector2(0, 0);

  function pickTarget(ndcOverride) {
    const objects = registry.filter(available).map((e) => e.object);
    if (!objects.length) return null;
    raycaster.setFromCamera(ndcOverride || (controls.locked ? CENTER : controls.pointerNDC), camera);
    const hits = raycaster.intersectObjects(objects, true);
    if (!hits.length) return null;
    const hit = hits[0];
    let node = hit.object;
    while (node && !registry.some((e) => e.object === node)) node = node.parent;
    if (!node) return null;
    const entry = registry.find((e) => e.object === node);
    return { entry, distance: hit.distance, point: hit.point };
  }

  engine.onUpdate((dt) => {
    pulse += dt * 3.4;
    if (!globalEnabled) return;

    const found = pickTarget();
    const nextTarget = found?.entry || null;

    if (nextTarget !== hovered) {
      if (hovered) applyHighlight(hovered.object, 0);
      hovered = nextTarget;
      if (hovered) audio?.hover?.();
    }

    if (!hovered) {
      hud?.setPrompt(null);
      document.body.classList.remove('cursor-interact');
      return;
    }

    const tooFar = found.distance > hovered.opts.distance;
    applyHighlight(hovered.object, tooFar ? 0.25 : 0.8 + Math.sin(pulse) * 0.2);
    document.body.classList.toggle('cursor-interact', !tooFar);
    hud?.setPrompt({
      label: typeof hovered.opts.label === 'function' ? hovered.opts.label() : hovered.opts.label,
      hint: typeof hovered.opts.hint === 'function' ? hovered.opts.hint() : hovered.opts.hint,
      tooFar,
      locked: !!hovered.opts.lockedNote && !!hovered.opts.lockedNote()
    });
  });

  function activate(ndcOverride) {
    if (!globalEnabled) return;
    const found = pickTarget(ndcOverride);
    if (!found) return;
    if (!ndcOverride && found.entry !== hovered) return;
    const entry = found.entry;
    if (found.distance > entry.opts.distance) {
      hud?.toast('再走近一點');
      return;
    }
    entry.opts.onClick?.({ object: entry.object, point: found.point, distance: found.distance });
  }

  controls.onTap(({ ndc }) => activate(controls.locked ? CENTER : ndc));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) activate(CENTER);
  });

  return api;
}
