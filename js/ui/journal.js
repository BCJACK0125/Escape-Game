// 線索本（I 鍵）與提示系統（H 鍵）。
// 提示分三級、不限次數，並包裝成林默透過轉盤電話留下的「排練備忘」，
// 讓求助不打斷角色扮演。

import { el, formatClock } from '../core/util.js';
import { panel } from '../ui/panel.js';
import { CLUES, ITEMS, NODES, LINES, getNode } from '../state/nodes.js';
import { audio } from '../core/audio.js';

export function createJournal({ store, hud }) {
  let tab = 'clues';

  function render(body) {
    body.replaceChildren(tabs(), content());
  }

  function tabs() {
    const defs = [
      ['clues', '線索'],
      ['items', '道具'],
      ['progress', '進度'],
      ['hints', '排練備忘']
    ];
    return el('div.tabs', {}, defs.map(([id, label]) => el('button.tab', {
      type: 'button',
      class: `tab${tab === id ? ' is-active' : ''}`,
      text: label,
      onclick: () => {
        tab = id;
        audio.softClick();
        const body = document.querySelector('#panel-root .panel-body');
        if (body) render(body);
      }
    })));
  }

  function content() {
    if (tab === 'clues') return cluesView();
    if (tab === 'items') return itemsView();
    if (tab === 'progress') return progressView();
    return hintsView();
  }

  function cluesView() {
    const found = store.state.clues;
    if (!found.length) return el('p.panel-note', { text: '還沒有記下任何線索。任何看起來像答案的東西，找到就會自動記進來。' });
    return el('ul.clue-list', {}, found.map((id) => {
      const c = CLUES[id];
      if (!c) return el('span');
      return el('li.clue-item', {}, [
        el('span.clue-line', { text: LINES[c.line]?.name || '', style: { color: LINES[c.line]?.color } }),
        el('div', {}, [
          el('p.clue-title', { text: c.title }),
          el('p.clue-text', { text: c.text })
        ])
      ]);
    }));
  }

  function itemsView() {
    const held = Object.keys(store.state.items);
    if (!held.length) return el('p.panel-note', { text: '手上還沒有東西。' });
    return el('ul.clue-list', {}, held.map((id) => {
      const it = ITEMS[id];
      if (!it) return el('span');
      return el('li.clue-item', {}, [
        el('span.clue-line', { text: it.key ? `按 ${it.key}` : '道具' }),
        el('div', {}, [
          el('p.clue-title', { text: it.name }),
          el('p.clue-text', { text: it.desc })
        ])
      ]);
    }));
  }

  function progressView() {
    const wrap = el('div.progress-lines');
    for (const line of Object.values(LINES)) {
      const nodes = NODES.filter((n) => n.line === line.id);
      const done = nodes.filter((n) => store.isDone(n.id)).length;
      wrap.appendChild(el('div.progress-line', {}, [
        el('div.progress-head', {}, [
          el('span.progress-name', { text: `${line.name}　${line.place}`, style: { color: line.color } }),
          el('span.progress-count', { text: `${done} / ${nodes.length}` })
        ]),
        el('div.progress-dots', {}, nodes.map((n) => el('span.progress-dot', {
          class: `progress-dot${store.isDone(n.id) ? ' is-done' : store.isOpen(n.id) ? ' is-open' : ''}`,
          title: `${n.id} ${n.title}`
        })))
      ]));
    }
    wrap.appendChild(el('p.panel-note', {
      text: `已完成 ${store.progress().done} / ${store.progress().total} 個節點　已用時 ${formatClock(store.state.elapsed)}`
    }));
    return wrap;
  }

  function hintsView() {
    const active = store.activeNodes();
    const wrap = el('div.hint-list');
    wrap.appendChild(el('p.panel-note', { text: '提示不限次數，但一次只給一級。先確認方向，再連結線索，最後才是動作。' }));
    if (!active.length) {
      wrap.appendChild(el('p.panel-note', { text: '目前沒有進行中的節點。' }));
      return wrap;
    }
    for (const node of active) {
      const used = store.hintLevel(node.id);
      const card = el('div.hint-card', {}, [
        el('div.hint-head', {}, [
          el('span.hint-id', { text: node.id, style: { color: LINES[node.line]?.color } }),
          el('span.hint-title', { text: node.title })
        ]),
        el('p.hint-sees', { text: node.sees })
      ]);
      for (let i = 0; i < used; i++) {
        card.appendChild(el('p.hint-text', { text: `第 ${i + 1} 級　${node.hints[i]}` }));
      }
      if (used < node.hints.length) {
        card.appendChild(el('button.btn.btn--ghost', {
          type: 'button',
          text: used === 0 ? '聽第 1 級提示' : `聽第 ${used + 1} 級提示`,
          onclick: () => {
            const res = store.useHint(node.id);
            audio.dialClick();
            audio.speak(2, 1.1);
            const body = document.querySelector('#panel-root .panel-body');
            if (body) render(body);
            if (res) hud.toast(`排練備忘 · 第 ${res.level} 級`);
          }
        }));
      } else {
        card.appendChild(el('p.panel-note', { text: '這個節點的提示已經全部聽完。' }));
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  const api = {
    open(which = 'clues') {
      tab = which;
      panel.open({
        id: 'journal',
        kicker: '檔案修復小組',
        title: '線索本',
        subtitle: '所有找到的東西都會自動記在這裡。',
        wide: true,
        tall: true,
        closeLabel: '收起',
        render(body) { render(body); }
      });
    },
    toggle(which = 'clues') {
      if (panel.id === 'journal') panel.close();
      else api.open(which);
    },
    openHints() { api.open('hints'); }
  };

  return api;
}
