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
    if (store.challenge) { openLetterPlain(); return; }
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
      store.setFlag('letterRead', true);
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

  // 挑戰模式的信：就是一封信。首字的墨色只深一點點，要自己看出來，
  // 讀懂之後去「做」那句話——拉下燈繩本身就是答案。
  function openLetterPlain() {
    store.setFlag('letterRead', true);
    store.addClue('letter');
    panel.open({
      id: 'P01',
      kicker: '序幕 · P01',
      title: '邀請函',
      subtitle: '林默的親筆信。紙很舊，墨色深淺不一。',
      render(body) {
        const lines = el('div.letter.letter--plain');
        LETTER.forEach(([head, rest]) => {
          lines.appendChild(el('p.letter-line', {}, [el('span.letter-ink', { text: head }), el('span', { text: rest })]));
        });
        body.append(lines, el('p.letter-sign', { text: '——林默' }));
      },
      onClose() {
        if (!store.isDone('P01')) hud.setObjective('信裡藏著一句話');
      }
    });
  }

  // 舞台燈繩：P01 的答案（挑戰模式）／回饋（引導模式），也是 P02 的開關
  interaction.add(world.room.pullCord, {
    id: 'pull-cord',
    label: () => (store.challenge && !store.isDone('P01') ? '垂下來的繩子' : '舞台燈繩'),
    hint: () => (store.isDone('P01') || store.challenge ? '拉下去' : '先讀邀請函'),
    distance: 2.6,
    // 繩子本身只有 9 mm 寬，靠隱形命中框才點得到。
    // 命中框只包住握把一帶（1.0–1.9 m）：原本 1.5 m 高的框會一路伸到燈罩旁，
    // 站在繩邊抬頭看燈罩時，射線會先打到繩子，燈罩就點不到了。
    hitBox: [0.36, 0.9, 0.36],
    hitOffset: [0, 1.45, 0],
    // 燈亮著、影子時鐘還沒解開時，玩家要操作的是燈罩，繩子先讓開
    enabled: () => !(world.room.lampOn && !store.isDone('P02')),
    onClick: () => ctx.game.trigger('P01-cord')
  });

  // 序幕導引：引導模式讀完信就讓握把發光；挑戰模式要聽到第 2 級備忘才亮
  const cordGlow = () => !world.room.lampOn && !store.isDone('P02')
    && (store.challenge ? store.hintLevel('P01') >= 2 : store.isDone('P01'));
  if (cordGlow()) world.room.setCordHint(true);
  store.on('node:done', () => { if (cordGlow()) world.room.setCordHint(true); });
  store.on('hint', () => { if (cordGlow()) world.room.setCordHint(true); });

  reg('P01-cord', () => {
    if (!store.isDone('P01')) {
      if (!store.challenge) { hud.toast('桌上那封信還沒讀完'); return; }
      if (!store.flag('letterRead', false)) {
        audio.softClick();
        hud.say('繩子很緊，上面好像卡著什麼。也許該先弄清楚它是做什麼用的。', 3800);
        return;
      }
      // 讀過信、自己想通了：拉繩就是解答
      store.addClue('invitation');
      store.complete('P01');
    }
    const on = !world.room.lampOn;
    world.room.setLampOn(on);
    world.room.setCordHint(false);
    audio.latch();
    if (on) {
      hud.flash('ok');
      if (!store.isDone('P02')) {
        hud.setObjective(store.pick('燈亮了，牆上的鐘面多了兩道影子', '轉動燈罩，讓影子指向 03:15'));
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

  // 拖曳以 clientX 的差值計算（觸控裝置不一定提供 movementX）
  let dragX = null;
  let dragId = null;

  function enterAdjust() {
    if (adjusting) return;
    adjusting = true;
    holdTime = 0;
    controls.enabled = false;
    interaction.setEnabled(false);
    document.body.classList.add('mode-adjust');
    const touchMode = document.documentElement.classList.contains('touch-mode');
    hud.say(touchMode
      ? '在畫面上左右拖曳轉動燈罩，或按住下方的 ◀ ▶ 微調。'
      : '左右拖曳滑鼠轉動燈罩（A／D 微調、按住 Shift 快轉），按 Esc 離開。', 5200);
    hud.setModeBar([
      { id: 'ccw', label: '◀', sub: 'A', onHold: () => world.room.nudgeShade(-0.015) },
      { id: 'cw', label: '▶', sub: 'D', onHold: () => world.room.nudgeShade(0.015) },
      { id: 'exit', label: '退開', sub: 'Esc', lead: true, onPress: () => exitAdjust() }
    ]);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
  }

  function exitAdjust() {
    if (!adjusting) return;
    adjusting = false;
    dragX = null;
    dragId = null;
    controls.enabled = true;
    interaction.setEnabled(true);
    document.body.classList.remove('mode-adjust');
    hud.hideMeter();
    hud.setModeBar(null);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
  }

  const canvas = engine.renderer.domElement;
  function onDown(e) {
    dragId = e.pointerId;
    dragX = e.clientX;
  }
  function onMove(e) {
    if (!adjusting || dragX === null || e.pointerId !== dragId) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    // 觸控的手指移動距離通常比滑鼠短，給一點加乘
    const gain = e.pointerType === 'touch' ? 0.011 : 0.008;
    world.room.nudgeShade(-dx * gain);
  }
  function onUp(e) {
    if (e.pointerId === dragId) { dragX = null; dragId = null; }
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
        hud.setObjective(store.pick('鐘面浮出了四個數字', '用 0315 打開桌下的工具抽屜'));
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
          hint: store.pick('', '鐘面上的時間就是密碼。'),
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
        await ctx.cinema.interlude({
          kicker: '第 一 幕',
          title: '三種真相',
          sub: '光、聲、物——三面牆同時開放'
        });
        hud.setObjective(store.pick('三面牆的工作燈都亮了', '三條支線都可以開始：海報（西北）、電話（東牆）、天平（西牆）'));
        const touchMode = document.documentElement.classList.contains('touch-mode');
        hud.say(store.pick(
          '三面牆的工作燈亮了。抽屜裡的東西都收進了右上角的道具列：點一下拿在手上，再去點想試的地方。',
          `三面牆的工作燈亮了。UV 燈在手上，${touchMode ? '點右下的「UV」' : '按 U'}開關。`
        ), 6200);
      }, 1500);
    }
  });

  // 回到房間後的旁白：前導片已經交代完背景，這裡不鎖住玩家，邊聽邊看四周。
  // 玩家一動手（點到東西、開面板）旁白就讓位。
  reg('prologue-intro', async () => {
    hud.setObjective('讀桌上的邀請函（桌燈下）');
    let cut = false;
    const stop = () => { cut = true; };
    const offPanel = panel.onOpenChange((open) => { if (open) stop(); });

    await wait(900);   // 等房間從黑畫面淡入
    for (const line of SCRIPT.intro) {
      if (cut || store.isDone('P01')) break;
      hud.say(line, 3400);
      for (let t = 0; t < 31 && !cut; t++) await wait(100);
    }
    offPanel();
    if (cut || store.isDone('P01')) return;
    const touchMode = document.documentElement.classList.contains('touch-mode');
    hud.say(touchMode
      ? '拖曳畫面看四周，左下搖桿走路；對準邀請函後點「互動」。'
      : '拖曳滑鼠看四周、WASD 走路；對準邀請函後點擊或按 E。', 5600);
  });
}
