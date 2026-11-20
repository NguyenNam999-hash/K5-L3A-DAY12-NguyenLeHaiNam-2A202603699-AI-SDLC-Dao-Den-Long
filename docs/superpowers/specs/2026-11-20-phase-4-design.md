# Phase 4 — "Bình minh: phát hành v1.0.0" — Design

Ngày: 2026-11-20 · Contract: **v1.3** · Nhánh: `PHASE-4`

## 1. Mục tiêu

Đưa Đảo Đèn Lồng từ "chạy được" thành bản phát hành v1.0.0:

1. Benchmark tái lập được trên cảnh chuẩn, xuất `bench.json`.
2. Soak test 10 Đêm trong một tiến trình, xuất `soak.json`.
3. Bảng xếp hạng cục bộ bền vững trên đĩa, xuất được bằng CLI.
4. Dễ tiếp cận: đổi phím, phụ đề/chỉ báo hình ảnh, giảm chuyển động, cỡ chữ.
5. Đóng gói: README, CHANGELOG 4 phase, CREDITS, LICENSE, Release `v1.0.0`, retro, video demo.

## 2. Ràng buộc

- Luật chơi, tuning và đầu ra headless của Phase 1–3 **không đổi**. Mọi test ẩn cũ phải còn xanh.
- `src/core/**` thuần: không DOM, Three.js, Node API.
- `game.contract.json` khớp `TUNING`; thêm `bench_cmd`, `soak_cmd`.
- Benchmark và soak phải tự chạy bằng một lệnh, tự thoát, mã 0 khi thành công.
- Không commit dữ liệu người chơi (`data/`), `node_modules/`, `dist*/`.

## 3. Phương án đã chọn

### 3.1 Benchmark

| Phương án | Đánh giá |
| --- | --- |
| **A. Playwright + trang bench thật (chọn)** | Dùng đúng `createWorld`, `Game`, Three.js, WebGL2. Node điều khiển, đo, ghi JSON. Tự động, tái lập. |
| B. Trang bench tải JSON thủ công | Không có CLI, không đạt DoD. |
| C. headless-gl trong Node | Không phải renderer thật, khác GPU/ANGLE, loại. |

Chọn A.

### 3.2 Bảng xếp hạng

| Phương án | Đánh giá |
| --- | --- |
| **A. Server tĩnh `dist-node/app.js` + `data/leaderboard.json` (chọn)** | Một kho dữ liệu cho cả UI và `--export-leaderboard`. Tự chạy sau build. |
| B. Chỉ localStorage | CLI export không có gì để đọc. |
| C. JSON commit sẵn, sửa tay | Người chơi không lưu được điểm. |

Chọn A. Khi phục vụ tĩnh (GitHub Pages), UI rơi về `localStorage`.

## 4. Thiết kế chi tiết

### 4.1 Core: chế độ benchmark (không đổi headless mặc định)

`GameOptions.benchmark?: boolean` — mặc định `false`.

Khi `true`:

- Không sinh thêm Bóng Mực/đom đóm/Drifter (spawn bị chặn).
- Không nhặt đom đóm, không nhặt Bùa, không tương tác, không Tỏa Sáng.
- Không trừ dầu (hao tự nhiên lẫn hút của Bóng Mực), không sát thương, không rơi.
- Không kiểm tra điều kiện thắng/thua; `timeLeft()` vẫn chạy nhưng không kết thúc.
- Bóng Mực `wander` giữ nguyên luật di chuyển; bỏ chuyển trạng thái `chase` để cảnh ổn định.
- Sự kiện vẫn phát (`night_start`) nhưng không ảnh hưởng đo.

Cảnh chuẩn:

- Đêm 1, `seed 42`.
- `random_motes=false`, `random_shades=false`, `random_drifters=false`, `wind_enabled=false`.
- 200 Bóng Mực `wander`, rải đều vành đảo bán kính 20–38 m, `Rng(42)`; 100 đom đóm rải đều bán kính 8–38 m.
- `L1`–`L3` sáng, `fuel=100`; `L4`–`L5` tắt.
- Mây đứng tại `(0,0,0)`; camera quỹ đạo tâm `(0,0,0)`, bán kính 30, `Y=15`, bắt đầu `(30,15,0)`, ngược chiều kim đồng hồ nhìn từ trên xuống, 15 s/vòng.

Trang `bench.html` (`src/bench/main.ts`):

- `renderer` giống game thật (antialias, ACES, pixelRatio 1).
- Mỗi khung: `game.step(IDLE_INPUT)` theo accumulator 60 Hz, `world.update(game, elapsed)`, HUD cập nhật, render.
- 3 s đầu không đo. Sau đó gom `dt` của rAF trong `--duration` giây, dừng, đặt `window.__bench = { ... }`.
- `load_ms` đo từ lúc tiến trình Node bắt đầu tới khung đo đầu tiên.

`scripts/bench.mjs`:

```
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
```

- Khởi động server tĩnh nội bộ phục vụ `dist/` (không cần `npm run dev`).
- Chromium 1280×720, `--disable-gpu-vsync --disable-frame-rate-limit`; fallback: Chromium Playwright → Chrome for Testing cache → kênh `chrome`.
- Đọc `window.__bench`, lấy RSS lớn nhất của cây tiến trình Chromium bằng `ps` (macOS/Linux), `null` nếu không đọc được.
- Tính `avg_fps = 1000·N/Σdt`, `p1_low_fps` theo `k=max(1,ceil(0.01N))`, `frame_ms_p95`.
- Ghi JSON đúng schema, exit 0. Lỗi → exit 1, stderr.

### 4.2 Soak

`src/headless/soak.ts` → `dist-node/headless/soak.js`.

```
node dist-node/headless/soak.js --seed 7 --nights 10 --out soak.json
```

- Đêm `i` (1-based): `night = ((i-1) % 3) + 1`, `seed = 7 + i`.
- Chạy headless tới khi `state != playing` hoặc hết thời lượng chuẩn, tối đa `duration×60` tick.
- Input sinh bằng `Rng(seed)`:
  - mỗi 30 tick đổi hướng (`moveX/moveZ ∈ {-1,0,1}`);
  - mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác;
  - `camYawDeg` đổi cùng hướng.
- Không ghi JSONL. Thu `{ result, score, ticks }`.
- `mem_start_mb` = RSS sau khi dựng xong Đêm 1 (trước khi mô phỏng), `mem_end_mb` = RSS sau khi bỏ tham chiếu và dựng lại Đêm cuối.
- `crashes` = số Đêm ném lỗi (bọc try/catch từng Đêm).
- `duration_s` = thời gian tường.
- Exit 0 kể cả khi thua; exit 1 khi tham số sai.

### 4.3 Bảng xếp hạng

Core thuần `src/core/leaderboard.ts`:

```ts
export interface LeaderboardEntry {
  name: string; score: number; nights_won: 0|1|2|3; achieved_at: string; seed: number;
}
export function validateName(raw: string): string | null;   // 3–12, [A-Za-z0-9_]
export function normalizeEntry(raw: unknown): LeaderboardEntry | null;
export function insertEntry(list: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[];
```

- `insertEntry`: thêm, sắp `score` giảm dần, hoà thì mục đến trước đứng trên (stable sort), cắt top 10.
- `achieved_at` do tầng gọi sinh (`new Date().toISOString()`), core không đọc đồng hồ.

Lưu trữ:

- `src/render/leaderboard-store.ts`: `GET/POST /api/leaderboard`; nếu lỗi/404 → `localStorage` key `dao-den-long.leaderboard.v1`.
- `src/server/app.ts` (Node): server tĩnh `dist/`, route:
  - `GET /api/leaderboard` → `{ entries }`;
  - `POST /api/leaderboard` → validate, chèn, ghi `data/leaderboard.json`, trả `{ entries }`;
  - `--export-leaderboard <file>` → đọc kho, ghi `{"entries":[...]}`, exit 0, không mở server.
  - `--port <n>` (mặc định 4173), `--no-open`.
- UI: sau thắng Đêm 3 (Bình Minh) hoặc thua bất kỳ Đêm nào → khối nhập tên trong overlay kết quả. Lưu xong hiện top 10. Menu chính có nút "Bảng xếp hạng" mở overlay riêng.
- Điểm lưu = `totalScore` (tổng các Đêm đã thắng), `nights_won` = số Đêm thắng trong chiến dịch hiện tại, `seed` = `baseSeed`.

### 4.4 Dễ tiếp cận

`src/render/keybinds.ts`:

- Hành động: `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `jump`, `dash`, `interact`, `pulse`, `pause`.
- Mặc định `KeyW/KeyS/KeyA/KeyD/Space/ShiftLeft/KeyE/KeyF/KeyP`; `Escape` luôn là tạm dừng phụ, không đổi.
- `detectConflict(bindings, action, code)` trả hành động đang giữ phím.
- Lưu `localStorage` `dao-den-long.keys.v1`; nút "Khôi phục mặc định".
- UI trong Cài đặt: mỗi hàng một nút "Nhấn phím…" bắt `keydown`, báo trùng màu đỏ, không gán khi trùng.
- `main.ts` đọc input qua `keybinds.codeFor(action)`; HUD và màn pause hiển thị phím động.

Phụ đề / chỉ báo hình ảnh (`src/render/alerts.ts` + HUD):

- Dòng chữ nổi 4 s: "Bóng Mực xuất hiện", "Gió sắp thổi", "Còn 10 giây", "Đèn L2 sắp cạn dầu".
- Mũi tên mép màn hình chỉ hướng Bóng Mực mới nhất khi ngoài khung nhìn.
- Đèn `fuel < 30`: dòng nhắc + nhấp nháy đã có ở world.
- Không đổi lõi.

Giảm chuyển động:

- `reduceMotion` trong settings: tắt rung camera (`shake`) và chớp màn hình (`flash`); tắt nhấp nháy 1 Hz của đèn yếu (đổi sang màu cảnh báo tĩnh).
- Không đổi gameplay.

Cỡ chữ:

- Gốc 18 px tại 1280×720; kiểm tra bằng script đo computed font-size của các nút/nhãn chính.
- Tuỳ chọn "Chữ lớn" nhân `--font-scale: 1.25`.

### 4.5 Contract v1.3

`game.contract.json`:

```json
{
  "contract_version": "1.3",
  "bench_cmd": "node scripts/bench.mjs",
  "soak_cmd": "node dist-node/headless/soak.js",
  "run_cmd": "node dist-node/app.js",
  ...
}
```

`tests/contract.test.ts`: kỳ vọng `1.3`, có `bench_cmd` chứa `bench`, `soak_cmd` chứa `soak`, `run_cmd` chứa `app.js`.

`scripts/verify.mjs`: thêm kiểm tra Phase 4:

1. contract 1.3 + 2 lệnh mới;
2. soak 2 Đêm chạy được, schema đúng, `crashes=0`;
3. leaderboard core: tên hợp lệ/không hợp lệ, top 10, hoà điểm giữ thứ tự;
4. export leaderboard từ kho tạm;
5. bench: chỉ kiểm tra CLI trả usage/JSON khi `--duration 1` (đo ngắn, không chấm ngưỡng);
6. font-size ≥ 18 px qua Playwright (nếu Chromium sẵn sàng, ngược lại SKIP có ghi lý do).

### 4.6 Đóng gói

- `LICENSE` MIT, `CREDITS.md` bổ sung công cụ AI, `CHANGELOG.md` mục 1.0.0 cho cả 4 phase.
- `README.md`: mô tả, ảnh, yêu cầu, cài đặt, điều khiển động, test/headless/bench/soak/leaderboard, ngưỡng đo, ghi chú VSync.
- `docs/BENCHMARK.md`: cấu hình máy đo, cách đọc số, giới hạn.
- `docs/RETRO.md`: retro 1–2 trang.
- `docs/demo/demo.mp4` < 5 phút: chơi thật + test/verify/bench.
- `bench.json`, `soak.json` ở gốc; bản sao trong `evidence/phase-4/`.
- Git tag `phase-4`, `v1.0.0`; GitHub Release nếu `gh` đã đăng nhập, kèm `dist/` nén và hướng dẫn.

## 5. Không làm

- Không thêm backend động, tài khoản, hay bảng xếp hạng trực tuyến.
- Không đổi tuning, tick order, snapshot/event.
- Không thêm asset ngoài; âm thanh/hình ảnh vẫn sinh bằng code.
- Không dùng `Math.random`/`Date` trong `src/core/**`.

## 6. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
| --- | --- |
| 200 Bóng Mực làm tụt FPS dưới 60 vì draw call | Đo trước; nếu cần, gộp wisps/eyes bằng `InstancedMesh` và dùng material dùng chung, giữ nguyên hình dáng. |
| Chromium không tắt được VSync | Ghi `vsync_off` theo cờ đã dùng và ghi chú trong README; ngưỡng 60 vẫn đạt khi khoá 60 Hz. |
| Máy chấm thiếu browser Playwright | `bench.mjs` fallback Chrome hệ thống; README ghi `npx playwright install chromium`. |
| `ps` không có trên Windows | `peak_mem_mb = null` + giải thích; các trường khác vẫn đúng. |
| Soak phình bộ nhớ do giữ sự kiện | Mỗi Đêm dùng `Game` mới, xả mảng sự kiện mỗi tick; đo RSS thật. |
| Test ẩn Phase 1–3 | Chạy lại toàn bộ `npm test` + `npm run verify`; không đổi mặc định core. |
