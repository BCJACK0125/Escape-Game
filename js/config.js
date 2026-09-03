// 全域設定：房間尺寸、玩家參數、答案常數。
// 所有「魔術數字」集中在此，方便調整難度與空間比例。

export const ROOM = {
  width: 12,      // x: -6 .. 6
  depth: 8,       // z: -4 .. 4
  height: 3.6,
  get halfW() { return this.width / 2; },
  get halfD() { return this.depth / 2; }
};

export const PLAYER = {
  eyeHeight: 1.62,
  radius: 0.34,
  walkSpeed: 2.5,
  runSpeed: 4.0,
  accel: 12,
  damping: 9,
  lookSpeed: 0.0026,     // 拖曳靈敏度（弧度／像素）
  lockLookSpeed: 0.0021, // 鎖定滑鼠時的靈敏度
  pitchLimit: 1.35,
  bobAmount: 0.022,
  bobSpeed: 9.5,
  spawn: { x: -1.0, z: 3.3, yaw: 1.47 }  // 站在幕前，面向西南角的長桌（桌燈是開場唯一亮源）
};

export const INTERACT = {
  maxDistance: 3.4,
  hoverBoost: 0.55
};

// 遊戲時間（分鐘）。0 = 無時限（排練模式）
export const TIME_MODES = {
  standard: 60,
  friendly: 75,
  rehearsal: 0
};

// 謎題答案 —— 與實體版執行計畫完全一致
export const ANSWERS = {
  drawerCode: '0315',              // P02 影子時鐘 03:15
  clockTarget: { hour: 3, minute: 15 },
  portraitOrder: ['left', 'right', 'both'],   // L01 → L02
  mirrorAngles: [30, 60, 45],      // L03/L04 → L05
  phoneNumber: '4172',             // S01 票根依日期排序後的座位號
  bellSequence: [4, 2, 5, 1, 3],   // S02 → S03 五條鐘繩
  silenceSeconds: 8,               // S04
  wandDirections: ['N', 'E', 'S', 'W'], // M03 → M04
  restore: { chair: 'left', umbrella: 'open', mirror: 'tilt' }, // G02 → G03
  perspectiveDigits: '25143',      // G04
  footsteps: [2, 5, 1, 4, 3],      // G05
  finaleCode: '247'                // F01 星2 日4 月7
};

export const SIGILS = {
  star: { id: 'star', name: '星星徽記', digit: 2, color: 0x9fb7d8, line: 'M' },
  sun: { id: 'sun', name: '太陽徽記', digit: 4, color: 0xe8c063, line: 'L' },
  moon: { id: 'moon', name: '月亮徽記', digit: 7, color: 0xa9bed6, line: 'S' }
};

// 三線並行的視覺主色（HUD 與燈光共用）
export const LINE_COLORS = {
  L: 0xe8c063,  // 光影畫廊 — 金
  S: 0x8fa9c4,  // 聲音檔案區 — 月藍
  M: 0xb8794a,  // 機關工作檯 — 銅木
  G: 0xc8a44d   // 中央自動機 — 黃銅
};

export const QUALITY = {
  maxPixelRatio: 1.75,
  shadowMapSize: 1024
};

export const SAVE_KEY = 'act13:save:v1';
export const SETTINGS_KEY = 'act13:settings:v1';
