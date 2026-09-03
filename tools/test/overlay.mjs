// 遮罩與點擊穿透測試。
// 這是為了抓「畫面全黑」那一類 bug 而寫的：只驗 element.hidden 屬性不夠，
// 必須驗「算繪後真的沒有畫出來」以及「畫面中央的最上層元素是誰」。
// 用法：node tools/test/overlay.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8791, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const { store, ctx } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);

    const topAt = (x = innerWidth / 2, y = innerHeight / 2) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'null';
      return el.id ? '#' + el.id : (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : el.tagName);
    };
    const painted = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
    };

    // ── 所有帶 hidden 屬性的元素都必須真的不算繪 ──
    await wait(200);
    const leaking = [...document.querySelectorAll('[hidden]')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.id || el.className || el.tagName);
    add('hidden 屬性的元素不會被畫出來', leaking.length === 0, leaking.join(', ') || '無洩漏');

    // ── 標題畫面 ──
    add('載入層在標題時已收起', !painted('#boot') && !painted('#fatal'));
    add('標題卡在最上層', topAt() === '.title-card', `實際 ${topAt()}`);

    // ── 進入房間後：畫面中央必須是 3D 畫布，點擊才能打到機關 ──
    store.newGame('rehearsal');
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await wait(500);
    add('標題畫面已收起', !painted('#screen'));
    add('遊戲中畫面中央是 3D 畫布', topAt() === '#scene', `實際 ${topAt()}`);
    add('關閉狀態的近景面板不攔截點擊', !painted('#panel-root'));
    add('HUD 不攔截點擊', getComputedStyle(document.getElementById('hud')).pointerEvents === 'none');

    // ── 近景面板開啟時應該在最上層 ──
    ctx.game.trigger('P01');
    await wait(300);
    const insidePanel = document.getElementById('panel-root')
      ?.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2));
    add('面板開啟時在最上層', insidePanel, `實際 ${topAt()}`);
    ctx.panel.close();
    await wait(400);
    add('面板關閉後點擊回到 3D 畫布', topAt() === '#scene', `實際 ${topAt()}`);

    // ── 線索本與暫停選單 ──
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
    await wait(300);
    add('線索本會真的顯示', painted('#panel-root') && /線索/.test(document.querySelector('.panel-title')?.textContent || ''));
    ctx.panel.close();
    await wait(400);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    await wait(300);
    add('暫停選單會真的顯示', painted('#screen') && /暫停/.test(document.getElementById('screen').textContent));
    document.querySelector('#screen .btn--lead')?.click();
    await wait(500);
    add('回到房間後選單完全收起', !painted('#screen') && topAt() === '#scene', `實際 ${topAt()}`);

    // ── HUD 元素預設不該佔位 ──
    add('字幕預設不算繪', !painted('.hud-subtitle'));
    add('進度條預設不算繪', !painted('.hud-meter'));
    add('幕次橫幅預設不算繪', !painted('.hud-banner'));

    return out;
  });
  return report('遮罩與點擊穿透', checks, errors);
});

process.exit(ok ? 0 : 1);
