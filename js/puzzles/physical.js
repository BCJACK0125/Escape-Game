// 物理線：道具天平 → 磁取杖尖 → 組裝魔杖 → 感測牆 → 星之核心 → 星星徽記
// M02 是唯一的即時操作小遊戲（滑鼠帶著磁鐵走），其餘都是短推理 + 明確回饋。

import { el } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { ANSWERS } from '../config.js';
import { audio as A } from '../core/audio.js';
import { clamp, deg } from '../core/util.js';

const PROPS = [
  { id: 'rabbit', name: '兔', weight: 3 },
  { id: 'dove', name: '鴿', weight: 2 },
  { id: 'hat', name: '帽', weight: 2 },
  { id: 'coin1', name: '硬幣', weight: 1 },
  { id: 'coin2', name: '硬幣', weight: 1 }
];

// 磁取杖尖的縫隙地圖：# 牆、. 通道、S 起點、E 出口
const MAZE = [
  '##########',
  '#S...#...#',
  '###.#.#.##',
  '#...#.#..#',
  '#.###.##.#',
  '#.....#..#',
  '#.####.#.#',
  '#....#.#.#',
  '####.#..E#',
  '##########'
];

export function registerPhysical(ctx, reg) {
  const { store, hud, world, engine, interaction } = ctx;
  const bench = world.workbench;

  // ── M01 道具天平 ──────────────────────────────────────────
  reg('M01-sheet', () => {
    store.addClue('balance-sheet');
    hud.say('排練單：兔 ＝ 帽 ＋ 硬幣；鴿 ＝ 硬幣 ＋ 硬幣。', 4600);
  });

  reg('M01', () => {
    if (store.isDone('M01')) { hud.toast('鎖扣已經開了'); return; }
    store.addClue('balance-sheet');

    panel.open({
      id: 'M01',
      kicker: '機關工作檯 · M01',
      title: '道具天平',
      subtitle: '依排練單的重量關係，讓兩側平衡兩秒。',
      wide: true,
      render(body, api) {
        const placement = {};   // id -> 'left' | 'right' | null
        let holdTimer = null;
        let hold = 0;

        const beam = el('div.balance-beam');
        const leftPan = el('div.balance-pan');
        const rightPan = el('div.balance-pan');
        const readout = el('p.balance-readout');
        const chipRow = el('div.chip-row');

        function sums() {
          let l = 0, r = 0;
          for (const p of PROPS) {
            if (placement[p.id] === 'left') l += p.weight;
            if (placement[p.id] === 'right') r += p.weight;
          }
          return { l, r };
        }

        function render() {
          const { l, r } = sums();
          const tilt = clamp((r - l) * 5, -14, 14);
          beam.style.transform = `rotate(${tilt}deg)`;
          leftPan.replaceChildren(...PROPS.filter((p) => placement[p.id] === 'left').map((p) => el('span.pan-item', { text: p.name })));
          rightPan.replaceChildren(...PROPS.filter((p) => placement[p.id] === 'right').map((p) => el('span.pan-item', { text: p.name })));
          readout.textContent = `左 ${l}　右 ${r}`;
          chipRow.replaceChildren(...PROPS.map((p) => el('button.chip', {
            type: 'button',
            class: `chip${placement[p.id] ? ' is-' + placement[p.id] : ''}`,
            text: `${p.name}${placement[p.id] ? `（${placement[p.id] === 'left' ? '左' : '右'}）` : ''}`,
            onclick: () => {
              placement[p.id] = placement[p.id] === 'left' ? 'right' : placement[p.id] === 'right' ? null : 'left';
              A.click();
              render();
            }
          })));

          const used = PROPS.filter((p) => placement[p.id]).length;
          const balanced = l > 0 && l === r && used >= 3;
          bench.setBalanceTilt(clamp((r - l) / 4, -1, 1));

          if (balanced) {
            if (!holdTimer) {
              hold = 0;
              holdTimer = setInterval(() => {
                hold += 0.1;
                api.status(`平衡中… ${hold.toFixed(1)} / 2.0 秒`);
                if (hold >= 2) {
                  clearInterval(holdTimer);
                  holdTimer = null;
                  done(api);
                }
              }, 100);
            }
          } else if (holdTimer) {
            clearInterval(holdTimer);
            holdTimer = null;
            api.status('');
          }
        }

        body.append(
          el('div.balance-stage', {}, [
            el('div.balance-arm', {}, [beam, el('div.balance-pans', {}, [leftPan, rightPan])]),
            readout
          ]),
          el('h3.panel-h3', { text: '道具（點一下切換：左 → 右 → 收起）' }),
          chipRow,
          panel.note('兔 ＝ 帽 ＋ 硬幣；鴿 ＝ 硬幣 ＋ 硬幣。')
        );
        render();

        function done(api2) {
          api2.ok('達標兩秒，玻璃櫃的鎖扣彈開。');
          A.latch();
          store.addItem('case-key');
          store.complete('M01');
          bench.unlockCase();
          hud.flash('ok');
          hud.setObjective('用磁鐵把玻璃櫃裡的杖尖帶出來');
          setTimeout(() => panel.close(), 1800);
        }
      },
      onClose() { bench.setBalanceTilt(0); }
    });
  });

  // ── M02 磁取杖尖 ──────────────────────────────────────────
  reg('M02', () => {
    if (!store.hasItem('case-key')) {
      hud.say('櫃子鎖著。天平那邊的鎖扣還沒開。', 3400);
      return;
    }
    if (store.hasItem('wand-tip')) { hud.toast('杖尖已經拿出來了'); return; }

    panel.open({
      id: 'M02',
      kicker: '機關工作檯 · M02',
      title: '磁取杖尖',
      subtitle: '在玻璃外面移動磁鐵，杖尖會跟著走。只有那道窄縫能通過。',
      render(body, api) {
        const size = 320;
        const cell = size / MAZE.length;
        const canvas = el('canvas.maze', { width: size, height: size });
        const g = canvas.getContext('2d');

        let start = { x: 0, y: 0 };
        let exit = { x: 0, y: 0 };
        MAZE.forEach((row, r) => {
          [...row].forEach((c, q) => {
            if (c === 'S') start = { x: (q + 0.5) * cell, y: (r + 0.5) * cell };
            if (c === 'E') exit = { x: (q + 0.5) * cell, y: (r + 0.5) * cell };
          });
        });

        const tip = { x: start.x, y: start.y };
        const magnet = { x: start.x, y: start.y, active: false };
        let solved = false;

        const wall = (x, y) => {
          const q = Math.floor(x / cell);
          const r = Math.floor(y / cell);
          if (r < 0 || r >= MAZE.length || q < 0 || q >= MAZE[0].length) return true;
          return MAZE[r][q] === '#';
        };
        const blocked = (x, y) => {
          const rad = cell * 0.22;
          return wall(x - rad, y - rad) || wall(x + rad, y - rad) || wall(x - rad, y + rad) || wall(x + rad, y + rad);
        };

        canvas.addEventListener('pointermove', (e) => {
          const rect = canvas.getBoundingClientRect();
          magnet.x = ((e.clientX - rect.left) / rect.width) * size;
          magnet.y = ((e.clientY - rect.top) / rect.height) * size;
          magnet.active = true;
        });
        canvas.addEventListener('pointerleave', () => { magnet.active = false; });

        let last = performance.now();
        function frame(now) {
          if (!canvas.isConnected) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;

          if (magnet.active && !solved) {
            const dx = magnet.x - tip.x;
            const dy = magnet.y - tip.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1 && dist < cell * 3.4) {
              const step = Math.min(dist, 82 * dt);
              const nx = tip.x + (dx / dist) * step;
              const ny = tip.y + (dy / dist) * step;
              if (!blocked(nx, tip.y)) tip.x = nx;
              if (!blocked(tip.x, ny)) tip.y = ny;
            }
            if (Math.hypot(tip.x - exit.x, tip.y - exit.y) < cell * 0.45) {
              solved = true;
              done(api);
            }
          }

          // 繪製
          g.clearRect(0, 0, size, size);
          g.fillStyle = '#120f16';
          g.fillRect(0, 0, size, size);
          MAZE.forEach((row, r) => {
            [...row].forEach((c, q) => {
              if (c === '#') {
                g.fillStyle = '#2b2430';
                g.fillRect(q * cell, r * cell, cell, cell);
                g.strokeStyle = 'rgba(0,0,0,.5)';
                g.strokeRect(q * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1);
              }
            });
          });
          g.fillStyle = 'rgba(200,164,77,.22)';
          g.beginPath();
          g.arc(exit.x, exit.y, cell * 0.42, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#c8a44d';
          g.font = '500 11px system-ui, sans-serif';
          g.textAlign = 'center';
          g.fillText('出口', exit.x, exit.y + 3);

          if (magnet.active) {
            g.strokeStyle = 'rgba(143,196,255,.5)';
            g.lineWidth = 2;
            g.beginPath();
            g.arc(magnet.x, magnet.y, cell * 3.4, 0, Math.PI * 2);
            g.stroke();
            g.fillStyle = '#8fc4ff';
            g.beginPath();
            g.arc(magnet.x, magnet.y, 6, 0, Math.PI * 2);
            g.fill();
          }

          g.fillStyle = solved ? '#f5e6b8' : '#d8c9a0';
          g.beginPath();
          g.moveTo(tip.x, tip.y - cell * 0.28);
          g.lineTo(tip.x + cell * 0.14, tip.y + cell * 0.2);
          g.lineTo(tip.x - cell * 0.14, tip.y + cell * 0.2);
          g.closePath();
          g.fill();

          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        body.append(canvas, panel.note('把滑鼠移到玻璃上，磁場範圍內的杖尖會被吸過去。'));

        function done(api2) {
          api2.ok('杖尖滑出縫隙，掉進手裡。');
          A.latch();
          store.addItem('wand-tip');
          bench.removeWandTip();
          store.complete('M02');
          hud.flash('ok');
          hud.setObjective('把三段魔杖組裝起來');
          setTimeout(() => panel.close(), 1600);
        }
      }
    });
  });

  // ── M03 組裝魔杖 ──────────────────────────────────────────
  reg('M03', () => {
    if (!store.hasItem('wand-tip')) {
      hud.say('少了最後一段，接不起來。', 3200);
      return;
    }
    if (store.hasItem('wand')) {
      hud.toast(`刻痕讀出：${ANSWERS.wandDirections.map((d) => ({ N: '北', E: '東', S: '南', W: '西' }[d])).join(' → ')}`);
      return;
    }

    panel.open({
      id: 'M03',
      kicker: '機關工作檯 · M03',
      title: '組裝魔杖',
      subtitle: '三段都能轉。讓木紋連成一條線，刻痕才讀得出來。',
      wide: true,
      render(body, api) {
        const rot = [1, 3, 2];   // 初始都不對
        const row = el('div.wand-row');

        function render() {
          row.replaceChildren(...rot.map((r, i) => {
            const seg = el('button.wand-seg', {
              type: 'button',
              class: `wand-seg${r === 0 ? ' is-aligned' : ''}`,
              onclick: () => {
                rot[i] = (rot[i] + 1) % 4;
                A.softClick();
                render();
                if (rot.every((v) => v === 0)) done(api);
              }
            }, [
              el('span.wand-grain', { style: { transform: `translateY(${(r % 4) * 12 - 12}px) rotate(${r * 4}deg)` } }),
              el('span.wand-notch', { style: { top: `${[8, 30, 52, 74][r]}%` } }),
              el('span.wand-index', { text: `第 ${i + 1} 段` })
            ]);
            return seg;
          }));
        }
        render();
        body.append(row, panel.note('點一下轉 90°。三段的木紋接成同一條斜線就對了。'));

        function done(api2) {
          api2.ok('三段咬合。邊緣的刻痕連成：北 → 東 → 南 → 西。');
          A.success();
          store.addItem('wand');
          store.addClue('wand-directions');
          store.complete('M03');
          bench.assembleWand();
          hud.flash('ok');
          hud.setObjective('用杖尖依北、東、南、西碰觸感測牆的節點');
          setTimeout(() => panel.close(), 2200);
        }
      }
    });
  });

  // ── M04 感測牆 ────────────────────────────────────────────
  reg('M04', ({ dir, index } = {}) => {
    if (!store.hasItem('wand')) {
      hud.say('節點沒有反應。它認的是杖尖，不是手指。', 3400);
      return;
    }
    if (store.isDone('M04')) return;

    const seq = store.flag('wandSeq', []) || [];
    const expected = ANSWERS.wandDirections[seq.length];

    if (!dir || dir !== expected) {
      store.setFlag('wandSeq', []);
      bench.resetNodes();
      bench.errorFlash();
      A.error();
      hud.flash('fail');
      hud.toast('這不是下一個方位，序列清除');
      return;
    }

    const next = seq.concat(dir);
    store.setFlag('wandSeq', next);
    bench.litNode(index, true);
    A.tone({ freq: 480 + next.length * 90, dur: 0.28, gain: 0.1, type: 'triangle' });
    hud.toast(`${next.map((d) => ({ N: '北', E: '東', S: '南', W: '西' }[d])).join('→')}`);

    if (next.length === ANSWERS.wandDirections.length) {
      store.complete('M04');
      bench.allNodesOn();
      world.automaton.openSide();
      A.success();
      A.latch();
      hud.flash('ok');
      hud.setObjective('把魔杖放進自動機的側腹凹槽');
      hud.say('齒輪開始運轉，自動機的側腹打開了。', 4200);
    }
  });

  // ── M05 星之核心 ──────────────────────────────────────────
  reg('M05', () => {
    if (!store.isDone('M04')) {
      hud.say('側腹關得很緊。', 2800);
      return;
    }
    if (store.hasSigil('star')) { hud.toast('核心已經被取走'); return; }
    if (!store.hasItem('wand')) { hud.toast('需要完整的魔杖'); return; }

    world.automaton.setWandInSlot();
    world.automaton.nod();
    A.latch();
    A.chord([2, 4, 0]);
    store.complete('M05');
    store.addSigil('star');
    store.addClue('star-digit');
    hud.flash('ok');
    hud.say('胸口打開，裡面是一枚刻著 2 的星星徽記。', 4200);
    hud.setObjective(store.sigilCount() >= 3 ? '把三枚徽記放進中央自動機' : '繼續找其他兩枚徽記');
  });
}
