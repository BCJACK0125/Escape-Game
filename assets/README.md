# assets/ — 目前是空的，這是刻意的

這個專案不含任何 `.glb`、圖檔或音檔：

- **模型**：程序化幾何組裝（見 `js/world/*.js`）
- **貼圖**：Canvas 2D 即時繪製（見 `js/world/materials.js`）
- **音效**：Web Audio 即時合成（見 `js/core/audio.js`）
- **字體**：系統明體／黑體堆疊

所以整個遊戲的傳輸量等於程式碼大小，也不會發生「資源沒推上 GitHub」的部署事故。

---

## 如果要改用 .glb / .gltf

替換點只有一層：`js/world/materials.js` 與各個 `js/world/*.js` 建立 mesh 的地方。
`js/puzzles/*.js` 完全不需要動，因為它只呼叫 `gallery.setPortraitCover(0, 'left')`
這類外觀方法。

### 資源預算

| 項目 | 建議上限 |
|---|---|
| 首屏總下載（含 three.js） | 3 MB |
| 單一模型（Draco 後） | 300 KB |
| 全場三角面 | 250 k |
| 貼圖尺寸 | 主要道具 1024²、次要 512²、小物 256² |
| Draw call | 150 |

### 建議流程

```bash
npm i -g @gltf-transform/cli

# 幾何壓縮（meshopt 解碼比 Draco 快，優先選它）
gltf-transform meshopt in.glb out.glb

# 貼圖轉 KTX2（PNG 的 1/5–1/8，且顯存佔用一起降）
gltf-transform etc1s out.glb final.glb --quality 200

# 檢查結果
gltf-transform inspect final.glb
```

載入端需要 `KTX2Loader` 與 transcoder、`GLTFLoader`，以及對應的 meshopt decoder；
這三個都在 three.js 的 `examples/jsm` 底下，記得跟 `js/core/three.js` 鎖同一個版本（0.160.0）。

### 分波載入

```
第 1 波（阻擋進入房間）：房間外殼、中央自動機、序幕長桌
第 2 波（進房後背景載入）：三條支線的道具
第 3 波（節點解鎖時才載）：終幕櫃、投影機、影片膠卷
```

三條支線可並行載入——執行計畫本身就是三線並行，玩家不可能同時站在三面牆前。
第 1 波接到載入畫面進度條；進房前呼叫 `renderer.compile(scene, camera)` 預編譯 shader。

### 檔名與快取

`.glb` 檔名帶內容 hash（例如 `chair.a3f21.glb`），才能安全地設長快取。
GitHub Pages 對靜態檔案會給 ETag，換檔名是最省事的破快取方式。

### 貼圖注意事項

- 只有顏色貼圖設 `texture.colorSpace = THREE.SRGBColorSpace`；
  法線／粗糙度／AO 保持 linear，否則整個畫面會霧掉。
- metalness／roughness／AO 塞進同一張貼圖的 RGB 三通道（glTF 原本就這樣設計）。
- 同類道具（三張海報、三幅肖像）共用一張 2048² 圖集，draw call 從 6 降到 1。
- `anisotropy` 給 4 就夠，給 16 對斜視角地板沒有明顯差異卻更慢。
