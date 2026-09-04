// 最終抉擇：徽記總謎題 → 揭幕或落幕 → 集體謝幕
// 兩個結局都完成逃出，差別只在影片與尾聲；不把任一選擇判成失敗。

import { panel } from '../ui/panel.js';
import { keypad } from '../ui/widgets.js';
import { ANSWERS } from '../config.js';
import { SCRIPT } from '../state/nodes.js';
import { audio as A } from '../core/audio.js';
import { el, wait } from '../core/util.js';

export function registerFinale(ctx, reg) {
  const { store, hud, world, controls, menu } = ctx;
  const stage = world.stage;

  // ── F01 徽記總謎題 ────────────────────────────────────────
  reg('F01', () => {
    if (store.isDone('F01')) { hud.toast('櫃子已經開了，選一卷影片'); return; }
    store.addClue('finale-poem');

    panel.open({
      id: 'F01',
      kicker: '終幕牆 · F01',
      title: '徽記總謎題',
      subtitle: '「星先指路，日啟舞台，月最後落幕。」',
      render(body, api) {
        const marks = el('div.sigil-recap');
        [['☀ 太陽', 4], ['☾ 月亮', 7], ['✦ 星星', 2]].forEach(([name, digit]) => {
          marks.appendChild(el('div.sigil-recap-item', {}, [
            el('span.sigil-recap-name', { text: name }),
            el('span.sigil-recap-digit', { text: String(digit) })
          ]));
        });
        const pad = keypad({
          length: 3,
          hint: '詩句給的是排列順序。',
          onSubmit(value, actions) {
            if (value === ANSWERS.finaleCode) {
              api.ok('投影機與兩卷影片同時通電。');
              A.latch();
              store.complete('F01');
              hud.flash('ok');
              hud.setObjective('選一卷影片放進投影機：公開，或保護');
              setTimeout(() => panel.close(), 1600);
            } else {
              actions.clear();
              api.fail('沒有反應。三枚徽記的數字都還在。');
            }
          }
        });
        body.append(marks, pad.root);
      }
    });
  });

  // ── F02 揭幕或落幕 ────────────────────────────────────────
  reg('F02', async ({ reel } = {}) => {
    if (!store.isDone('F01') || store.isDone('F02')) return;

    store.setFlag('ending', reel);
    store.complete('F02');
    hud.setCinematic(true);
    controls.frozen = true;

    stage.playFilm();
    A.startDrone({ id: 'projector', freq: 2200, gain: 0.02, type: 'bandpass', noise: true });
    const script = SCRIPT.finale[reel === 'reveal' ? 'reveal' : 'protect'];
    await hud.banner(script.title, reel === 'reveal' ? '你們選擇公開證據' : '你們選擇保護他的行蹤');
    for (const line of script.lines) {
      hud.say(line, 4200);
      await wait(4000);
    }
    hud.clearSubtitle();
    A.stopDrone('projector');
    stage.stopFilm();
    controls.frozen = false;
    hud.setCinematic(false);
    stage.showBowMarks(true);
    hud.setObjective('站到弧線上，拉下兩側的幕繩');
    hud.say('出口的謝幕標記亮了。兩條幕繩要同時受力。', 4600);
  });

  // ── F03 集體謝幕 ──────────────────────────────────────────
  const pulled = [0, 0];

  reg('F03', async ({ rope } = {}) => {
    if (!store.isDone('F02') || store.isDone('F03')) return;
    pulled[rope] = performance.now();
    stage.pullCurtainRope(rope);
    A.tone({ freq: 180, dur: 0.4, gain: 0.12, type: 'triangle' });

    const other = rope === 0 ? 1 : 0;
    const gap = Math.abs(pulled[rope] - pulled[other]);
    const WINDOW = 3000;               // 一個人也拉得完的時間窗
    if (!pulled[other] || gap > WINDOW) {
      hud.toast(`${rope === 0 ? '左' : '右'}繩受力中 —— 三秒內拉下另一條`);
      hud.setObjective('趁左右兩條幕繩都還受力時拉下另一條');
      return;
    }

    store.complete('F03');
    hud.setCinematic(true);
    controls.frozen = true;
    A.curtain();
    stage.openCurtain();
    world.room.setSpotlight(true);
    hud.flash('ok');
    await wait(1200);
    A.applause(3.6);
    await hud.banner('謝幕', '第十三幕，完成');
    await wait(600);

    const ending = store.flag('ending', 'reveal');
    store.setEnding(ending);
    controls.frozen = false;
    hud.setCinematic(false);
    menu.showEnding(ending);
  });
}
