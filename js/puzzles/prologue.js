// 序幕：邀請函首字 → 拉燈繩 → 影子時鐘 → 工具抽屜
// 這一段的任務是教會玩家三件事：房間會回應、順序有意義、機關可以直接操作。

import { el, wait } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { keypad } from '../ui/widgets.js';
import { ANSWERS } from '../config.js';
import { SCRIPT } from '../state/nodes.js';

const LETTER = [
  ['拉', '開這封信的人，應該是檔案修復小組。'],
  ['下', '一場排練，我不會到場。'],
  ['舞', '台的規矩你們知道：先給光，再給聲音。'],
  ['台', '上沒有觀眾，但這個房間一直在看。'],
  ['燈', '罩上的刻孔是我親手鑽的，別怪它太舊。'],
  ['繩', '子還掛在老位置。動手吧，我等這一次很久了。']
];

export function registerPrologue(ctx, reg) {
  const { store, hud, audio, world, interaction, controls, engine } = ctx;

  // ── P01 邀請函 ────────────────────────────────────────────
  reg('P01', () => {
    let picked = [];
    panel.open({
      id: 'P01',
      kicker: '序幕 · P01',
      title: '邀請函',
      subtitle: '每一行的第一個字，墨色都比其他字深一點。',
      render(body, api) {
        const lines = el('div.letter');
        const chips = [];
        LETTER.forEach(([head, rest], i) => {
          const chip = el('button.letter-head', {
            type: 'button', text: head,
            onclick: () => {
              if (picked.includes(i)) return;
              const expected = picked.length;
              if (i !== expected) {
                picked = [];
                chips.forEach((c) => c.classList.remove('is-read'));
                api.fail('順序亂了，從第一行重新讀。');
                return;
              }
              picked.push(i);
              chip.classList.add('is-read');
              audio.click();
              api.status(`讀到：${picked.map((k) => LETTER[k][0]).join('')}`);
              if (picked.length === LETTER.length) finish(api);
            }
          });
          chips.push(chip);
          lines.appendChild(el('p.letter-line', {}, [chip, el('span', { text: rest })]));
        });
        body.append(
          lines,
          el('p.letter-sign', { text: '——林默' }),
          panel.note('依序點出每行的第一個字。')
        );
      }
    });

    function finish(api) {
      api.ok('六個字連成一句：拉下舞台燈繩。');
      store.addClue('invitation');
      if (store.complete('P01')) {
        setTimeout(async () => {
          panel.close();
          hud.setObjective('拉下舞台燈繩：房間中央、吊燈旁垂下來的那一條');
          hud.toast('轉身往房間中央看，繩子的銅握把在發光');
          await hud.sequence([
            '「繩子還掛在老位置。」',
            '房間中央的吊燈旁垂下一條繩，銅製握把在黑暗裡微微發亮。'
          ], 3400);
        }, 1400);
      }
    }
  });

  // 舞台燈繩：P01 的回饋，也是 P02 的開關
  interaction.add(world.room.pullCord, {
    id: 'pull-cord',
    label: '舞台燈繩',
    hint: () => (store.isDone('P01') ? '拉下去' : '先讀邀請函'),
    distance: 2.6,
    hitBox: [0.4, 1.5, 0.4],       // 繩子本身只有 9 mm 寬，靠隱形命中框才點得到
    hitOffset: [0, 1.6, 0],
    onClick: () => ctx.game.trigger('P01-cord')
  });

  // 序幕導引：讀完信之後，讓黑暗中的握把自己發光
  if (store.isDone('P01') && !world.room.lampOn) world.room.setCordHint(true);
  store.on('node:done', ({ id }) => {
    if (id === 'P01') world.room.setCordHint(true);
  });

  reg('P01-cord', () => {
    if (!store.isDone('P01')) {
      hud.toast('桌上那封信還沒讀完');
      return;
    }
    const on = !world.room.lampOn;
    world.room.setLampOn(on);
    world.room.setCordHint(false);
    audio.latch();
    if (on) {
      hud.flash('ok');
      if (!store.isDone('P02')) {
        hud.setObjective('轉動燈罩，讓影子指向 03:15');
        hud.say('燈亮了。牆上的鐘面沒有指針，只有兩道影子。', 4200);
      }
    }
  });

  // ── P02 影子時鐘 ──────────────────────────────────────────
  let adjusting = false;
  let holdTime = 0;

  interaction.add(world.room.shade, {
    id: 'lamp-shade',
    label: '燈罩',
    hint: () => (world.room.lampOn ? '轉動它' : '燈還沒亮'),
    distance: 2.6,
    enabled: () => !store.isDone('P02'),
    onClick: () => ctx.game.trigger('P02')
  });

  function enterAdjust() {
    if (adjusting) return;
    adjusting = true;
    holdTime = 0;
    controls.enabled = false;
    interaction.setEnabled(false);
    document.body.classList.add('mode-adjust');
    hud.say('左右拖曳滑鼠轉動燈罩（A／D 微調、按住 Shift 快轉），按 Esc 離開。', 5200);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
  }

  function exitAdjust() {
    if (!adjusting) return;
    adjusting = false;
    controls.enabled = true;
    interaction.setEnabled(true);
    document.body.classList.remove('mode-adjust');
    hud.hideMeter();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey);
  }

  function onMove(e) {
    if (!adjusting) return;
    if (e.buttons & 1) world.room.nudgeShade(-e.movementX * 0.008 || 0);
  }

  function onKey(e) {
    if (!adjusting) return;
    if (e.code === 'Escape') { exitAdjust(); return; }
    // 一格 0.015 弧度 ≈ 鐘面 1.7 分鐘，必須小於判定窗（±3 分）才轉得進去
    const stepSize = e.shiftKey ? 0.06 : 0.015;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') world.room.nudgeShade(-stepSize);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') world.room.nudgeShade(stepSize);
  }

  reg('P02', () => {
    if (!world.room.lampOn) {
      hud.toast('先拉下燈繩');
      return;
    }
    enterAdjust();
  });

  engine.onUpdate((dt) => {
    if (!adjusting) return;
    const t = world.room.shadowTime();
    const target = ANSWERS.clockTarget;
    const diff = Math.abs(t.hoursFloat - (target.hour + target.minute / 60));
    const wrapped = Math.min(diff, 12 - diff);
    const near = Math.max(0, 1 - wrapped / 0.8);
    hud.showMeter('影子時鐘', near, `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`);

    if (wrapped < 0.05) {    // 約 ±3 分鐘，鍵盤與滑鼠都對得進來
      holdTime += dt;
      if (holdTime > 0.6) {
        world.room.revealClock();
        world.room.setShadeAngle(((target.hour + target.minute / 60) / 12) * Math.PI * 2);
        audio.success();
        hud.flash('ok');
        store.addClue('drawer-code');
        store.complete('P02');
        hud.say('鐘面浮出四個數字：0 3 1 5。', 4200);
        hud.setObjective('用 0315 打開桌下的工具抽屜');
        exitAdjust();
      }
    } else {
      holdTime = 0;
    }
  });

  // ── P03 工具抽屜 ──────────────────────────────────────────
  reg('P03', () => {
    if (store.isDone('P03')) {
      hud.toast('抽屜已經開著');
      return;
    }
    panel.open({
      id: 'P03',
      kicker: '序幕 · P03',
      title: '工具抽屜',
      subtitle: '四位數字鎖。抽屜側面寫著「排練時間」。',
      render(body, api) {
        const pad = keypad({
          length: 4,
          hint: '鐘面上的時間就是密碼。',
          onSubmit(value, actions) {
            if (value === ANSWERS.drawerCode) {
              api.ok('鎖扣彈開，抽屜內燈亮起。');
              open();
            } else {
              actions.clear();
              api.fail('紅燈閃了一下，輸入已清除。');
            }
          }
        });
        body.append(pad.root);
      }
    });

    function open() {
      world.desk.openDrawer();
      audio.drawer();
      ['uv-lamp', 'red-filter', 'baton', 'half-photo'].forEach((id) => store.addItem(id));
      store.complete('P03');
      world.room.setWorkLights(true);
      setTimeout(async () => {
        panel.close();
        hud.flash('ok');
        await hud.banner('第一幕 · 三種真相', '光、聲、物：三面牆同時開放');
        hud.setObjective('三條支線都可以開始：海報（西北）、電話（東牆）、天平（西牆）');
        hud.say('三面牆的工作燈亮了。UV 燈在手上，按 U 開關。', 5200);
      }, 1500);
    }
  });

  // 開場旁白（可跳過：任何點擊或空白鍵）
  reg('prologue-intro', async () => {
    hud.setCinematic(true);
    controls.frozen = true;
    let skip = false;
    const onSkip = (e) => {
      if (e.type === 'pointerdown' || ['Space', 'Escape', 'Enter'].includes(e.code)) skip = true;
    };
    window.addEventListener('keydown', onSkip);
    window.addEventListener('pointerdown', onSkip);
    hud.toast('點擊或按空白鍵可跳過開場');

    for (const line of SCRIPT.intro) {
      if (skip) break;
      hud.say(line, 3600);
      for (let t = 0; t < 34 && !skip; t++) await wait(100);
    }

    window.removeEventListener('keydown', onSkip);
    window.removeEventListener('pointerdown', onSkip);
    hud.clearSubtitle();
    controls.frozen = false;
    hud.setCinematic(false);
    hud.setObjective('讀桌上的邀請函');
    hud.say('工作室只剩桌燈。桌上有一封邀請函。', 4200);
  });
}
