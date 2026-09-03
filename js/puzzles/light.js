// 光影線：UV 海報 → 肖像閉眼 → 鏡後星圖 → 濾片解讀 → 稜鏡導光 → 太陽徽記
// L01／L02／L05 在 3D 空間直接操作；L03／L04 是需要精細對位的近景面板。

import { el } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { ANSWERS } from '../config.js';
import { sameArray } from '../core/util.js';

const COVER_LABEL = { left: '左眼', right: '右眼', both: '雙眼' };

export function registerLight(ctx, reg) {
  const { store, hud, audio, world, engine, camera, scene } = ctx;
  const gallery = world.gallery;

  // ── UV 燈：U 鍵開關，會改變海報貼圖並在前方打出紫光 ─────────
  let uvLight = null;
  function setUV(on) {
    store.setFlag('uvOn', on);
    gallery.setUV(on);
    if (!uvLight) {
      uvLight = new ctx.THREE.PointLight(0x8a4dff, 0, 7, 2);
      scene.add(uvLight);
    }
    uvLight.intensity = on ? 18 : 0;
    document.body.classList.toggle('uv-on', on);
    audio.softClick();
    hud.toast(on ? 'UV 燈：開' : 'UV 燈：關');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyU' || e.repeat) return;
    if (!store.hasItem('uv-lamp')) { hud.toast('還沒有 UV 燈'); return; }
    setUV(!store.flag('uvOn', false));
  });

  engine.onUpdate(() => {
    if (uvLight && uvLight.intensity > 0) {
      uvLight.position.copy(camera.position);
    }
  });

  // ── L01 UV 海報 ───────────────────────────────────────────
  reg('L01', ({ poster } = {}) => {
    if (!store.hasItem('uv-lamp')) {
      hud.say('白光下只是三張舊海報。抽屜裡的燈也許看得更多。', 3600);
      return;
    }
    if (!store.flag('uvOn', false)) {
      hud.toast('按 U 打開 UV 燈');
      return;
    }
    const seen = new Set(store.flag('postersSeen', []));
    if (typeof poster === 'number') seen.add(poster);
    store.setFlag('postersSeen', [...seen]);
    audio.tone({ freq: 880, dur: 0.16, gain: 0.08, type: 'sine' });
    hud.say(`第 ${poster + 1} 張海報浮出一個眼睛姿勢：${COVER_LABEL[ANSWERS.portraitOrder[poster]]}。`, 3400);

    if (seen.size >= 3 && !store.isDone('L01')) {
      store.addClue('portrait-order');
      store.complete('L01');
      gallery.showPortraitSpots(true);
      audio.success();
      hud.flash('ok');
      hud.setObjective('依海報順序遮住三幅肖像的眼睛（北牆）');
      hud.say('三張海報連起來：遮左眼、遮右眼、遮雙眼。', 4200);
    }
  });

  // ── L02 肖像閉眼 ──────────────────────────────────────────
  reg('L02', ({ portrait, cover } = {}) => {
    const step = store.flag('portraitStep', 0);
    const expectedCover = ANSWERS.portraitOrder[step];
    if (portrait !== step || cover !== expectedCover) {
      store.setFlag('portraitStep', 0);
      gallery.resetPortraits();
      gallery.errorFlash?.();
      audio.error();
      hud.flash('fail');
      hud.toast('順序不對，三幅肖像都恢復了');
      return;
    }
    gallery.setPortraitCover(portrait, cover);
    audio.tone({ freq: 620 + step * 120, dur: 0.3, gain: 0.12, type: 'triangle' });
    const next = step + 1;
    store.setFlag('portraitStep', next);

    if (next >= 3) {
      gallery.litMirrorBack(true);
      audio.success();
      hud.flash('ok');
      store.complete('L02');
      hud.setObjective('看看單向鏡後面亮著什麼（北牆右側）');
      hud.say('鏡子後面亮起來了。', 3400);
    } else {
      hud.toast(`第 ${next} 幅完成`);
    }
  });

  // ── L03 鏡後星圖 ──────────────────────────────────────────
  const CHART_A = [[92, 64], [188, 122], [126, 196]];
  const CHART_B = [[236, 78], [176, 168], [268, 202]];

  reg('L03', () => {
    if (!store.isDone('L02')) {
      hud.say('鏡子只照得出你自己。', 3000);
      return;
    }
    if (store.isDone('L03')) { ctx.game.trigger('L04'); return; }

    panel.open({
      id: 'L03',
      kicker: '光影畫廊 · L03',
      title: '鏡後星圖',
      subtitle: '星圖分成兩半。把兩片透明片拖到對應的圓環上。',
      wide: true,
      render(body, api) {
        const stage = el('div.chart-stage');
        const base = el('div.chart-base');
        // 底圖：雜訊星點 + 六個目標圓環
        for (let i = 0; i < 60; i++) {
          const x = (i * 97) % 340 + 8;
          const y = (i * 53) % 240 + 8;
          base.appendChild(el('span.chart-dot', { style: { left: `${x}px`, top: `${y}px`, opacity: String(0.18 + (i % 5) * 0.06) } }));
        }
        [...CHART_A, ...CHART_B].forEach(([x, y], i) => {
          base.appendChild(el('span.chart-ring', {
            style: { left: `${x}px`, top: `${y}px` },
            dataset: { group: i < 3 ? 'a' : 'b' }
          }));
        });
        stage.appendChild(base);

        const sheets = [
          { id: 'a', label: '透明片 甲', stars: CHART_A, start: [-74, 46] },
          { id: 'b', label: '透明片 乙', stars: CHART_B, start: [88, -38] }
        ];
        const placed = { a: false, b: false };

        for (const sheet of sheets) {
          const node = el('div.chart-sheet', { dataset: { id: sheet.id } }, [
            el('span.chart-sheet-label', { text: sheet.label })
          ]);
          sheet.stars.forEach(([x, y]) => {
            node.appendChild(el('span.chart-star', { style: { left: `${x}px`, top: `${y}px` } }));
          });
          let pos = { x: sheet.start[0], y: sheet.start[1] };
          const apply = () => { node.style.transform = `translate(${pos.x}px, ${pos.y}px)`; };
          apply();

          let dragging = false;
          let origin = { x: 0, y: 0 };
          node.addEventListener('pointerdown', (e) => {
            if (placed[sheet.id]) return;
            dragging = true;
            origin = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            node.setPointerCapture(e.pointerId);
            node.classList.add('is-dragging');
          });
          node.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            pos = { x: e.clientX - origin.x, y: e.clientY - origin.y };
            apply();
          });
          const drop = () => {
            if (!dragging) return;
            dragging = false;
            node.classList.remove('is-dragging');
            if (Math.hypot(pos.x, pos.y) < 18) {
              pos = { x: 0, y: 0 };
              apply();
              placed[sheet.id] = true;
              node.classList.add('is-placed');
              audio.tone({ freq: 720, dur: 0.24, gain: 0.1, type: 'sine' });
              api.status(`${sheet.label} 對上了。`);
              if (placed.a && placed.b) done(api);
            } else {
              api.status('還沒對上，星點要落進圓環。');
            }
          };
          node.addEventListener('pointerup', drop);
          node.addEventListener('pointercancel', drop);
          stage.appendChild(node);
        }

        body.append(stage, panel.note('拖曳兩片透明片；對上後只會剩下三顆星與它們的刻度。'));
      }
    });

    function done(api) {
      api.ok('疊合後只剩三顆星，每顆旁邊都有一個刻度——但被紅藍雜訊蓋住了。');
      store.addClue('starmap');
      store.complete('L03');
      hud.setObjective('用紅濾片讀出鏡架刻度');
      setTimeout(() => { panel.close(); ctx.game.trigger('L04'); }, 1800);
    }
  });

  // ── L04 濾片解讀 ──────────────────────────────────────────
  reg('L04', () => {
    if (!store.isDone('L03')) { ctx.game.trigger('L03'); return; }
    let filterOn = false;

    panel.open({
      id: 'L04',
      kicker: '光影畫廊 · L04',
      title: '刻度上的紅藍雜訊',
      subtitle: '三顆星旁的刻度互相干擾，需要濾掉一種顏色。',
      render(body, api) {
        const rows = el('div.filter-rows');
        const noise = [
          { real: '30', fake: '80' },
          { real: '60', fake: '05' },
          { real: '45', fake: '19' }
        ];
        noise.forEach((n, i) => {
          rows.appendChild(el('div.filter-row', {}, [
            el('span.filter-label', { text: `鏡架 ${i + 1}` }),
            el('span.filter-stack', {}, [
              el('span.filter-fake', { text: n.fake }),
              el('span.filter-real', { text: n.real })
            ])
          ]));
        });

        const toggle = panel.button(store.hasItem('red-filter') ? '蓋上紅濾片' : '手上沒有紅濾片', () => {
          if (!store.hasItem('red-filter')) { api.fail('抽屜裡那片紅色的東西還沒拿。'); return; }
          filterOn = !filterOn;
          rows.classList.toggle('is-filtered', filterOn);
          toggle.textContent = filterOn ? '移開紅濾片' : '蓋上紅濾片';
          audio.softClick();
          if (filterOn && !store.isDone('L04')) done(api);
        });

        body.append(rows, el('div.panel-actions', {}, [toggle]),
          panel.note('紅色雜訊會被濾片吃掉，剩下的才是刻度。'));
      }
    });

    function done(api) {
      api.ok('刻度清楚了：30、60、45。');
      store.addClue('mirror-angles');
      store.complete('L04');
      gallery.setEmitter(true);
      hud.setObjective('把三面鏡架轉成 30° / 60° / 45°（北牆左側光學台）');
      hud.say('光學台的發射器亮了。三面鏡架各有刻度。', 4200);
    }
  });

  // ── L05 稜鏡導光 ──────────────────────────────────────────
  reg('L05', ({ mirror } = {}) => {
    if (!store.isDone('L04')) {
      hud.toast('先讀出鏡架該轉幾度');
      return;
    }
    if (store.isDone('L05')) return;

    const angle = gallery.rotateMirror(mirror, 15);
    store.setFlag('mirrorAngles', gallery.angles.slice());
    audio.tone({ freq: 420 + angle, dur: 0.12, gain: 0.06, type: 'square', filter: { freq: 1600 } });
    hud.toast(`鏡架 ${mirror + 1}：${angle}°`);

    const reach = gallery.beamReach();
    if (reach > 1) audio.tone({ freq: 900 + reach * 120, dur: 0.2, gain: 0.07, type: 'sine' });

    if (sameArray(gallery.angles, ANSWERS.mirrorAngles)) {
      gallery.openFrame();
      audio.success();
      audio.latch();
      hud.flash('ok');
      store.complete('L05');
      hud.setObjective('取走太陽徽記');
      hud.say('光束打中感光靶，畫框彈開了。', 4000);
    }
  });

  reg('L05-take', () => {
    if (store.hasSigil('sun')) return;
    if (!store.isDone('L05')) { hud.toast('畫框還沒彈開'); return; }
    gallery.takeSigil();
    store.addSigil('sun');
    store.addClue('sun-digit');
    audio.chord([0, 2, 4]);
    hud.flash('ok');
    hud.toast('取得太陽徽記（背面刻著 4）');
    hud.setObjective(nextObjective(store));
  });
}

function nextObjective(store) {
  const held = store.sigilCount();
  if (held >= 3) return '把三枚徽記放進中央自動機';
  const missing = [];
  if (!store.hasSigil('sun')) missing.push('光');
  if (!store.hasSigil('moon')) missing.push('聲');
  if (!store.hasSigil('star')) missing.push('物');
  return `還缺 ${missing.join('、')} 的徽記`;
}
