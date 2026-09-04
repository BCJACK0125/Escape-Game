// 中央合流：三徽記 → 日誌差異 → 還原布景 → 視角合字 → 腳步序列
// G04 與 G05 完全靠身體：站對位置、看對方向、用走位輸入答案。

import { el, wait } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { ANSWERS } from '../config.js';
import { SCRIPT } from '../state/nodes.js';
import { audio as A } from '../core/audio.js';
import { VIEWPOINT } from '../world/stage.js';

// 三份排練稿：甲乙相同，丙有三處改字
const JOURNAL = {
  labels: ['稿 甲', '稿 乙', '稿 丙'],
  tokens: [
    { a: '第十三幕開始前', c: '第十三幕開始前' },
    { a: '椅子朝右', c: '椅子朝左', key: 'chair' },
    { a: '傘收著', c: '傘打開', key: 'umbrella' },
    { a: '鏡面正對觀眾', c: '鏡面斜對觀眾', key: 'mirror' },
    { a: '燈光只留一盞', c: '燈光只留一盞' },
    { a: '我從左邊上台', c: '我從左邊上台' }
  ]
};

export function registerConverge(ctx, reg) {
  const { store, hud, world, engine, camera, controls } = ctx;
  const stage = world.stage;
  const automaton = world.automaton;

  // ── G01 三徽記合流 ────────────────────────────────────────
  reg('G01', async () => {
    if (store.isDone('G01')) {
      if (!store.isDone('G02')) automaton.offerJournal();
      return;
    }
    if (store.sigilCount() < 3) {
      hud.toast(`還缺 ${3 - store.sigilCount()} 枚徽記`);
      hud.say('三個槽的形狀都不一樣，各自只配一枚徽記。', 3600);
      return;
    }

    hud.setCinematic(true);
    controls.frozen = true;
    for (const kind of ['sun', 'moon', 'star']) {
      automaton.setSlot(kind, true);
      A.tone({ freq: 330 + Math.random() * 260, dur: 0.5, gain: 0.12, type: 'triangle' });
      await wait(700);
    }
    automaton.awaken();
    A.chord([0, 2, 4], 0.09);
    await wait(900);
    automaton.nod();
    automaton.offerJournal();
    store.complete('G01');
    controls.frozen = false;
    hud.setCinematic(false);
    hud.flash('ok');
    await hud.banner('第二幕 · 重演', '把房間恢復成最後一場表演開始前');
    await hud.sequence(SCRIPT.journalReveal, 3200);
    hud.setObjective('比較三份排練日誌');
  });

  // ── G02 日誌差異 ──────────────────────────────────────────
  reg('G02', () => {
    if (!store.isDone('G01')) { hud.toast('自動機還沒醒'); return; }
    if (store.isDone('G02')) {
      hud.toast('日誌指示：椅左、傘開、鏡斜');
      return;
    }

    panel.open({
      id: 'G02',
      kicker: '中央合流 · G02',
      title: '三份排練日誌',
      subtitle: '三份稿子幾乎一樣。點出稿丙被改掉的地方。',
      wide: true,
      render(body, api) {
        const found = new Set();
        const cols = el('div.journal-cols');

        JOURNAL.labels.forEach((label, ci) => {
          const col = el('div.journal-col', {}, [el('p.journal-head', { text: label })]);
          JOURNAL.tokens.forEach((tk, ti) => {
            const text = ci === 2 ? tk.c : tk.a;
            if (ci === 2) {
              col.appendChild(el('button.journal-token', {
                type: 'button', text,
                onclick: () => {
                  if (!tk.key) {
                    api.fail('這一句三份都一樣。');
                    return;
                  }
                  if (found.has(tk.key)) return;
                  found.add(tk.key);
                  A.click();
                  col.children[ti + 1].classList.add('is-found');
                  api.status(`找到 ${found.size} / 3 處改字。`);
                  if (found.size === 3) done(api);
                }
              }));
            } else {
              col.appendChild(el('p.journal-token.is-static', { text }));
            }
          });
          cols.appendChild(col);
        });

        body.append(cols, panel.note('三處改字連起來就是房間該有的樣子。'));
      }
    });

    function done(api) {
      api.ok('改字讀成：椅左、傘開、鏡斜。');
      A.success();
      store.addClue('journal-diff');
      store.complete('G02');
      stage.showOutlines(true);
      automaton.takeJournal();
      hud.flash('ok');
      hud.setObjective('把椅、傘、鏡調成日誌寫的姿態');
      setTimeout(() => panel.close(), 2000);
    }
  });

  // ── G03 還原布景 ──────────────────────────────────────────
  reg('G03', ({ prop } = {}) => {
    if (!store.isDone('G02')) { hud.toast('還不知道該擺成什麼樣'); return; }
    if (store.isDone('G03')) return;

    const value = stage.toggleProp(prop);
    A.softClick();
    const wanted = ANSWERS.restore[prop];
    if (value === wanted) {
      A.tone({ freq: 560, dur: 0.3, gain: 0.1, type: 'triangle' });
      hud.toast(`${{ chair: '椅', umbrella: '傘', mirror: '鏡' }[prop]} 就位`);
    }

    if (stage.isRestored()) {
      store.complete('G03');
      world.room.setSpotlight(true);
      stage.showMarker(true);
      stage.showStrokes(true);
      stage.showOutlines(false);
      A.success();
      hud.flash('ok');
      setTimeout(async () => {
        await hud.sequence(SCRIPT.perspectiveHint, 3200);
        hud.setObjective('站進聚光燈圓點，面向北牆');
      }, 600);
    }
  });

  // ── G04 視角合字 ──────────────────────────────────────────
  let holdAlign = 0;
  const forward = { x: 0, y: 0, z: 0 };

  engine.onUpdate((dt) => {
    if (!store.isDone('G03') || store.isDone('G04')) return;
    const dx = camera.position.x - VIEWPOINT.x;
    const dz = camera.position.z - VIEWPOINT.z;
    const dist = Math.hypot(dx, dz);

    const dir = camera.getWorldDirection ? camera.getWorldDirection(ctx.tmpVec) : null;
    if (dir) { forward.x = dir.x; forward.y = dir.y; forward.z = dir.z; }
    const facing = -forward.z;            // 與 -Z 的一致度
    const posScore = Math.max(0, 1 - dist / 0.75);
    const dirScore = Math.max(0, (facing - 0.9) / 0.1);
    const score = Math.min(1, posScore * dirScore);

    stage.setAlignment(score);

    if (dist < 1.8) {
      hud.showMeter('視角合字', score, score > 0.98 ? '對上了' : (posScore < 0.4 ? '再走進圓點' : '把視線放平、正對北牆'));
    } else {
      hud.hideMeter();
    }

    if (dist < 0.4 && facing > 0.992) {
      holdAlign += dt;
      if (holdAlign > 0.7) {
        holdAlign = 0;
        stage.lockDigits();
        stage.showPlates(true);
        store.addClue('perspective');
        store.complete('G04');
        A.chord([3, 1, 4], 0.07);
        hud.flash('ok');
        hud.hideMeter();
        hud.say(`散落的線段合成五個數字：${ANSWERS.perspectiveDigits.split('').join('-')}`, 5200);
        hud.setObjective('依 2-5-1-4-3 站上五個腳印，每個停一下');
      }
    } else {
      holdAlign = Math.max(0, holdAlign - dt * 2);
    }
  });

  // ── G05 腳步序列 ──────────────────────────────────────────
  // 判定是「站上去停一下」而不是「碰到就算」，
  // 否則走去下一個腳印時會刷過旁邊的腳印，被判成踩錯。
  let onPlate = null;
  let dwell = 0;
  let counted = false;

  engine.onUpdate((dt) => {
    if (!store.isDone('G04') || store.isDone('G05')) return;
    const n = stage.plateUnder(camera.position.x, camera.position.z);

    if (n !== onPlate) {
      onPlate = n;
      dwell = 0;
      counted = false;
      return;
    }
    if (n == null || counted) return;

    const seqNow = store.flag('footSeq', []) || [];
    const isWrong = n !== ANSWERS.footsteps[seqNow.length];

    dwell += dt;
    stage.setPlateDwell(n, Math.min(1, dwell / 0.75), isWrong);
    if (isWrong && dwell > 0.3 && dwell < 0.32) hud.toast('這不是下一個腳印');
    if (dwell < 0.75) return;      // 站定才算一步；路過不會誤觸
    counted = true;

    const seq = seqNow;
    const expected = ANSWERS.footsteps[seq.length];

    if (n !== expected) {
      store.setFlag('footSeq', []);
      stage.resetPlates();
      stage.plateErrorFlash();
      A.error();
      hud.flash('fail');
      hud.toast(`踩到 ${n}，序列清除`);
      return;
    }

    const next = seq.concat(n);
    store.setFlag('footSeq', next);
    stage.litPlate(n, true);
    A.drum();
    hud.toast(next.join('-'));

    if (next.length === ANSWERS.footsteps.length) {
      store.setFlag('footSeq', []);
      store.complete('G05');
      stage.openNiche();
      A.latch();
      A.success();
      hud.flash('ok');
      setTimeout(async () => {
        await hud.banner('第三幕 · 選擇', '終幕櫃開了');
        hud.setObjective('終幕櫃：先解開三位數，再選一卷影片');
      }, 700);
    }
  });
}
