// 聲音線：票根電話 → 聲紋唱片 → 五條鐘繩 → 靜默進度 → 月之留言 → 月亮徽記
// S03／S04 是本作最「空間」的兩個聲音謎題，都在 3D 場景裡直接進行。

import { el, wait } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { orderList, rotaryDial } from '../ui/widgets.js';
import { ANSWERS } from '../config.js';
import { SCRIPT } from '../state/nodes.js';
import { audio as A } from '../core/audio.js';

const TICKETS = [
  { id: 't1', year: 1944, title: '票根 · 一九四四年 十一月 三日', meta: '座位 2 排 12 號' },
  { id: 't2', year: 1937, title: '票根 · 一九三七年 六月 十二日', meta: '座位 4 排 03 號' },
  { id: 't3', year: 1941, title: '票根 · 一九四一年 二月 八日', meta: '座位 1 排 21 號' },
  { id: 't4', year: 1943, title: '票根 · 一九四三年 九月 廿一日', meta: '座位 7 排 07 號' }
];
const TICKET_ORDER = ['t2', 't3', 't4', 't1'];   // 依日期由早到晚 → 座位 4 1 7 2

// 五張唱片：voice = VOICE_SPECS 索引（0 最年輕），rope = 槽位號
const RECORDS = [
  { id: 'r1', title: '唱片 甲', meta: '槽位 3', voice: 4, rope: 3 },
  { id: 'r2', title: '唱片 乙', meta: '槽位 4', voice: 0, rope: 4 },
  { id: 'r3', title: '唱片 丙', meta: '槽位 1', voice: 3, rope: 1 },
  { id: 'r4', title: '唱片 丁', meta: '槽位 5', voice: 2, rope: 5 },
  { id: 'r5', title: '唱片 戊', meta: '槽位 2', voice: 1, rope: 2 }
];

export function registerSound(ctx, reg) {
  const { store, hud, audio, world, engine, controls, interaction } = ctx;
  const sound = world.sound;

  // ── S01 票根電話 ──────────────────────────────────────────
  reg('S01', () => {
    if (store.isDone('S01')) { playMessage(); return; }
    panel.open({
      id: 'S01',
      kicker: '聲音檔案區 · S01',
      title: '票根與轉盤電話',
      subtitle: '四張票根、四個座位號。先決定順序，再撥號。',
      wide: true,
      render(body, api) {
        const stage = el('div.two-col');
        const left = el('div');
        const right = el('div');

        const list = orderList({
          items: TICKETS.map((t) => ({ id: t.id, title: t.title, meta: t.meta })),
          submitLabel: '照這個順序排好',
          onSubmit(order, actions) {
            if (order.join() === TICKET_ORDER.join()) {
              const number = order.map((id) => TICKETS.find((t) => t.id === id).meta.match(/座位 (\d)/)[1]).join('');
              api.ok(`票根排好了，座位號連成 ${number}。`);
              right.replaceChildren(dialBlock(api, number));
              A.tone({ freq: 760, dur: 0.3, gain: 0.1, type: 'sine' });
            } else {
              actions.reset();
              api.fail('日期還沒排對，順序已重設。');
            }
          }
        });
        left.append(el('h3.panel-h3', { text: '一、依日期排序' }), list.root);
        right.append(el('h3.panel-h3', { text: '二、撥號' }), panel.note('先把票根排好，號碼才會出現。'));
        stage.append(left, right);
        body.append(stage);

        function dialBlock(api2, number) {
          const wrap = el('div');
          const dial = rotaryDial({
            length: 4,
            onSubmit(value, actions) {
              if (value === number && value === ANSWERS.phoneNumber) {
                api2.ok('電話接通了。');
                setTimeout(() => { panel.close(); playMessage(); }, 900);
              } else {
                actions.clear();
                api2.fail('只有嘟嘟聲。掛掉重撥。');
              }
            }
          });
          wrap.append(el('h3.panel-h3', { text: '二、撥號' }), dial.root);
          return wrap;
        }
      }
    });
  });

  async function playMessage() {
    store.addClue('phone-order');
    hud.setCinematic(true);
    await A.phoneRing(2);
    for (const line of SCRIPT.phoneMessage) {
      hud.say(line, 3400);
      A.speak(3, 2.4);
      await wait(3200);
    }
    hud.clearSubtitle();
    hud.setCinematic(false);
    store.addClue('voice-ages');
    if (store.complete('S01')) {
      hud.flash('ok');
      hud.setObjective('把五張唱片依聲音年齡排序（聲紋唱機）');
    }
  }

  // ── S02 聲紋唱片 ──────────────────────────────────────────
  reg('S02', () => {
    if (!store.isDone('S01')) {
      hud.say('唱機是空的。也許電話裡的人會說該放什麼。', 3400);
      return;
    }
    if (store.isDone('S02')) { hud.toast(`鐘繩順序：${ANSWERS.bellSequence.join('-')}`); return; }

    panel.open({
      id: 'S02',
      kicker: '聲音檔案區 · S02',
      title: '聲紋唱片',
      subtitle: '五段錄音，五個年紀。從最年輕排到最年長。',
      wide: true,
      render(body, api) {
        const shuffled = [RECORDS[0], RECORDS[2], RECORDS[3], RECORDS[1], RECORDS[4]];
        const list = orderList({
          items: shuffled.map((r) => ({
            id: r.id,
            title: r.title,
            meta: r.meta,
            action: { label: '試聽', onClick: () => A.speak(r.voice, 1.9) }
          })),
          slotLabels: ['最年輕', '第二', '第三', '第四', '最年長'],
          submitLabel: '放上唱盤',
          onSubmit(order, actions) {
            const correct = RECORDS.slice().sort((a, b) => a.voice - b.voice).map((r) => r.id);
            if (order.join() === correct.join()) {
              const ropes = order.map((id) => RECORDS.find((r) => r.id === id).rope);
              api.ok(`每放對一張就亮一格。槽位讀出來是 ${ropes.join('-')}。`);
              A.chord([0, 2, 4]);
              store.addClue('bell-order');
              store.complete('S02');
              hud.flash('ok');
              hud.setObjective('依 4-2-5-1-3 拉下五條鐘繩');
              setTimeout(() => {
                panel.close();
                hud.say('鐘繩就在唱機旁邊，天花板垂下來的那五條。', 4200);
              }, 2200);
            } else {
              actions.reset();
              api.fail('唱針跳了一下，順序已清除。');
            }
          }
        });
        body.append(list.root, panel.note('先按「試聽」聽出年紀，再用箭頭調整順序。'));
      }
    });
  });

  // ── S03 五條鐘繩 ──────────────────────────────────────────
  reg('S03-replay', async () => {
    if (!store.isDone('S02')) { hud.toast('還沒有可播的順序'); return; }
    hud.toast('重播音序');
    sound.showSequenceLights(ANSWERS.bellSequence, 620);
    await A.playBellSequence(ANSWERS.bellSequence, 0.62);
  });

  reg('S03', ({ rope } = {}) => {
    if (store.isDone('S03')) {
      sound.pullRope(rope);
      A.bell(rope);
      return;
    }
    if (!store.isDone('S02')) {
      sound.pullRope(rope);
      A.bell(rope);
      hud.say('鐘響了，但沒有人告訴你順序。', 3000);
      return;
    }

    sound.pullRope(rope);
    A.bell(rope);
    sound.flashRope(rope, true);
    setTimeout(() => sound.flashRope(rope, false), 380);

    const input = (store.flag('bellInput', []) || []).concat(rope + 1);
    const expected = ANSWERS.bellSequence;
    const ok = input.every((v, i) => v === expected[i]);

    if (!ok) {
      store.setFlag('bellInput', []);
      sound.errorFlash();
      A.error();
      hud.flash('fail');
      hud.toast('紅閃一下，輸入清除了');
      return;
    }

    store.setFlag('bellInput', input);
    hud.toast(`${input.join('-')}`);

    if (input.length === expected.length) {
      store.setFlag('bellInput', []);
      store.complete('S03');
      store.addClue('silence-hint');
      setTimeout(async () => {
        A.chord([0, 2, 4, 1], 0.05);
        hud.flash('ok');
        await hud.sequence(SCRIPT.bellChord, 3200);
        hud.setObjective('讓房間聽見寂靜（耳朵雕塑）');
      }, 500);
    }
  });

  // ── S04 靜默進度 ──────────────────────────────────────────
  let listening = false;
  let progress = 0;
  let grace = 0;
  let micMode = false;
  let lastTick = 0;

  function enterSilence() {
    if (listening) return;
    listening = true;
    progress = 0;
    grace = 0.9;
    interaction.setEnabled(false);
    document.body.classList.add('mode-silence');
    A.startDrone({ id: 'silence', freq: 52, gain: 0.05 });
    hud.say('不要移動、不要點擊。想改用麥克風判定就按 M；按 Esc 離開。', 5200);
    window.addEventListener('keydown', onKey);
  }

  function exitSilence(success = false) {
    if (!listening) return;
    listening = false;
    interaction.setEnabled(true);
    document.body.classList.remove('mode-silence');
    A.stopDrone('silence');
    hud.hideMeter();
    window.removeEventListener('keydown', onKey);
    if (!success) sound.setSilenceProgress(0);
  }

  async function onKey(e) {
    if (!listening) return;
    if (e.code === 'Escape') { exitSilence(); return; }
    if (e.code === 'KeyM' && !micMode) {
      const ok = await A.mic.start();
      micMode = ok;
      hud.toast(ok ? '麥克風已啟用：現在真的要安靜' : '沒有麥克風權限，改用「不動」判定');
    }
  }

  reg('S04', () => {
    if (store.isDone('S04')) {
      hud.toast('它已經聽夠了');
      return;
    }
    if (!store.isDone('S03')) {
      hud.say('雕塑一動也不動。也許要先讓鐘聲說完。', 3400);
      return;
    }
    enterSilence();
  });

  engine.onUpdate((dt, elapsed) => {
    if (!listening) return;
    if (grace > 0) { grace -= dt; hud.showMeter('靜默感測', 0, '準備'); return; }

    const moved = controls.moving || controls.idleTime < 0.28;
    const loud = micMode && A.mic.level() > 0.075;
    const quiet = !moved && !loud;

    progress += (quiet ? dt / ANSWERS.silenceSeconds : -dt * 0.7 / ANSWERS.silenceSeconds);
    progress = Math.max(0, Math.min(1, progress));
    sound.setSilenceProgress(progress);
    hud.showMeter(
      micMode ? '靜默感測 · 麥克風' : '靜默感測',
      progress,
      quiet ? `${(progress * ANSWERS.silenceSeconds).toFixed(1)} / ${ANSWERS.silenceSeconds} 秒` : '退回中'
    );

    if (quiet && elapsed - lastTick > 0.85) {
      lastTick = elapsed;
      A.silenceTick(progress);
    }

    if (progress >= 1) {
      exitSilence(true);
      sound.openCompartment();
      A.latch();
      A.success();
      hud.flash('ok');
      store.complete('S04');
      hud.setObjective('播放暗格裡的迷你留聲機');
      hud.say('LED 填滿。牆下方彈開一個暗格。', 4200);
    }
  });

  // ── S05 月之留言 ──────────────────────────────────────────
  reg('S05', async () => {
    if (store.isDone('S05')) { sound.revealMoonSigil(); return; }
    hud.setCinematic(true);
    controls.frozen = true;
    A.gramophoneHiss(true);
    for (const line of SCRIPT.gramophone) {
      hud.say(line, 3600);
      A.speak(3, 2.9);
      await wait(3400);
    }
    A.gramophoneHiss(false);
    hud.clearSubtitle();
    hud.setCinematic(false);
    controls.frozen = false;
    sound.revealMoonSigil();
    A.latch();
    store.complete('S05');
    hud.flash('ok');
    hud.setObjective('取走月亮徽記');
  });

  reg('S05-take', () => {
    if (store.hasSigil('moon')) return;
    if (!store.isDone('S05')) { hud.toast('留聲機還沒放完'); return; }
    sound.takeMoonSigil();
    store.addSigil('moon');
    store.addClue('moon-digit');
    A.chord([1, 3, 4]);
    hud.flash('ok');
    hud.toast('取得月亮徽記（背面刻著 7）');
  });
}
