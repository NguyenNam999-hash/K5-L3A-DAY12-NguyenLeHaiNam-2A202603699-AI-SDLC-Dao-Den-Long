# Bằng chứng kiểm chứng — Phase 2 "Ba hòn đảo"

Mọi bằng chứng dưới đây được tạo bằng lệnh thật, lưu trong `evidence/phase-2/`.
Máy chạy: macOS, Node v24.14.0, Chromium headless 1280×720.

## Bảng yêu cầu → bằng chứng

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Logic v1.1: số chuẩn, 3 Đêm, lướt, bục nhảy, rơi, Bùa Gió, Gió Lạc, gió, tạm dừng | `npm test` (Vitest) | `test-report.txt` | **78/78 test đạt** |
| Contract headless v1.1: shape, event mới, 3 Đêm, tất định, hiệu năng | `npm run verify` | `headless/verify-report.txt` + 19 file `.jsonl` | **24/24 case đạt, 3 259 kiểm tra con** |
| Tất định | Hai lần chạy cùng seed rồi so byte | `headless/determinism-sha256.txt` | **hash giống hệt** |
| Chơi được tới thắng | Bot chơi Đêm 1, rồi replay inputs qua CLI chính thức | `headless/bot-summary.json`, `bot-replay.jsonl` | **thắng tick 13 415, 1 332 điểm, 3 lửa** |
| Đủ 3 Đêm | CLI `--night 2`, `--night 3`; test + verify `19`, `20` | `headless/19-night2.jsonl`, `20-night3.jsonl` | 6/7 đèn, thời lượng 330/360 s |
| Rơi khỏi đảo | Scenario `15-fall.json` | `headless/15-fall.jsonl` | `player_hit by=fall`, mất 1 lửa, hồi sinh |
| Bục nhảy | Scenario `16`, `21` | `headless/16-jump-pad.jsonl`, `21-night3-pad.jsonl` | đáp sang đảo B / tầng 2 |
| Gió Lạc cướp và thả | Scenario `12`, `13` | `headless/12-drifter-steal.jsonl`, `13-drifter-drop.jsonl` | cướp 3, pulse thả 3 |
| Bùa Gió | Scenario `11` | `headless/11-charm.jsonl` | nhặt tick 1, tốc độ 7.2 |
| Gió mạnh | Scenario `14` | `headless/14-wind.jsonl` | bật giây 30, tắt giây 35 |
| Tạm dừng | Scenario `09` | `headless/09-pause.jsonl` | `state=paused`, `sim_tick` đứng yên |
| Đầu vào sai → mã thoát 2 | verify case `08` | `headless/verify-report.txt` | exit 2, lỗi ra stderr |
| HUD, menu, 3 Đêm, Bình Minh | Playwright chụp màn hình | `ui/01-menu.png` … `ui/10-sunrise.png` | ảnh đúng, không lỗi console |
| Hiệu năng headless | Chạy đủ Đêm 3 (21 600 tick) | `verify-report.txt` (dòng `full-night-3`) | **~0,13–0,16 s** (< 30 s) |
| Hiệu năng giao diện | Đo requestAnimationFrame | `ui/fps.txt` | **~60 fps** ở 1280×720 |
| Build sạch | `npm run build` | `build-log.txt` | thành công |

## Lệnh tái lập

```bash
npm ci
npm run build
npm test                 # 78 unit test
npm run verify           # 24 case, ghi evidence/phase-2/headless/
npm run bot              # bot phải thắng; ghi bot-inputs.json + bot-summary.json
node dist-node/headless/main.js --seed 7 --night 1 --ticks 17900 \
  --inputs evidence/phase-2/headless/bot-inputs.json \
  --out /tmp/bot-replay.jsonl --snapshot-every 600
tail -1 /tmp/bot-replay.jsonl
# {"type":"end","ticks":13415,"state":"won","score":1332}
```

Ảnh UI cần dev server:

```bash
npx vite --port 5173
node scripts/shots.mjs
```

## Chi tiết từng bằng chứng

### 1. Unit test — 78 test

Phủ: contract v1.1; địa hình ba Đêm (đảo, cầu, tầng, dốc, tháp); di chuyển có gia tốc; nhảy; lướt trên
mặt đất và trên không; bục nhảy Đêm 2/3; vách tầng; rơi và hồi sinh; tạm dừng; nhặt đom đóm theo bán
kính + chênh cao; sức chứa 10; nạp đèn 10, nạp một phần, chọn gần nhất, chặn nạp xuyên tầng; điểm lúc
nạp; sinh đom đóm mỗi 240 tick; TTL đom rơi; pulse 3D, choáng, đẩy, điểm khi đang choáng; Bóng Mực
5 trạng thái, lịch sinh, detect/lose, drop 1/2, một hit mỗi tick, vùng an toàn; Gió Lạc; Bùa Gió; gió;
thắng/thua/điểm; tất định; parse scenario/inputs v1.1.

### 2. Contract headless — 24 case

| Case | Nội dung | Kết quả |
|---|---|---|
| 01-movement | 60 tick `move [0,1]` → z ≈ 5.75, tốc độ 6 | đạt |
| 02-pickup | nhặt đom đóm, không cộng điểm lúc nhặt | đạt |
| 03-deposit | nạp 10, thắp đèn, 200 điểm | đạt |
| 04-pulse | `stunned_ids ["S1"]`, −3 đom, +5 điểm | đạt |
| 05-hit | rơi 5, còn 5, tạo 5 đom rơi | đạt |
| 06-win | `won`, `all_lit`, 858 điểm | đạt |
| 07-dawn | dừng tick 60, thua `dawn`, 0 điểm | đạt |
| 08-invalid-inputs | file inputs sai → exit **2** | đạt |
| 09-pause | `paused` tick 6, `resumed` tick 21, `sim_tick` đứng yên | đạt |
| 10-dash | dash tick 1, đi 2.8 m trong 12 tick | đạt |
| 11-charm | `charm_picked` tick 1, tốc độ 7.2 | đạt |
| 12-drifter-steal | cướp 3, còn 2, drifter `flee` | đạt |
| 13-drifter-drop | pulse thả 3 đom rơi | đạt |
| 14-wind | gió bật giây 30, tắt sau 5 s | đạt |
| 15-fall | `player_hit by=fall`, còn 2 lửa | đạt |
| 16-jump-pad | đáp sang đảo B, y = 0 | đạt |
| 17-night3-ramp | dốc đưa lên tầng 1 (y = 3) | đạt |
| 18-dropped-mote | còn trước tick 9, mất sau TTL 10 | đạt |
| 19-night2 | 6 đèn, 20 đom, 1 Bùa Gió | đạt |
| 20-night3 | 7 đèn, 20 đom, 2 Bùa Gió | đạt |
| 21-night3-pad | bục đưa lên tầng 2 (y = 6) | đạt |
| 22-determinism | hai lần chạy 4 800 tick giống hệt từng byte | đạt |
| 23-idle | không input → không di chuyển | đạt |
| 24-performance | Đêm 3 đầy đủ 21 600 tick ≤ 30 s | đạt |

Mỗi snapshot còn được kiểm tra: tick chia hết `--snapshot-every`, `sim_tick ≤ tick`, `night` đúng,
trạng thái hợp lệ, đủ số đèn theo Đêm, `motes_active` khớp mảng, `motes/drifters/charms/wind` đúng shape,
toạ độ làm tròn 3 chữ số, trạng thái Bóng Mực/Gió Lạc đúng tên, event tick ≥ 1, tối đa một `game_over`,
đúng một `night_start`.

### 3. Tất định

```
259687cab52b4a20cedbe7eddeb7ce7ed07eaeb960cabd17d87aeb13eb45a0a1  22-determinism-a.jsonl
259687cab52b4a20cedbe7eddeb7ce7ed07eaeb960cabd17d87aeb13eb45a0a1  22-determinism-b.jsonl
```

Cùng `--seed 424242`, Đêm 2, 4 800 tick, không scenario/inputs → file giống hệt. Hash thật nằm trong
`headless/determinism-sha256.txt`.

### 4. Chơi được tới thắng

`npm run bot` dùng chính `Game` v1.1: trường thế hút mục tiêu/đẩy Bóng Mực, nạp đèn mỗi 5 đom đóm,
pulse khi Bóng Mực vào bán kính 4.8 m. Kết quả `bot-summary.json`:

```json
{ "state": "won", "ticks": 13415, "score": 1332, "time_left_s": 76.417, "flames": 3,
  "stats": { "motes": 50, "picked": 65, "lanterns": 5, "stuns": 6, "hits": 0, "falls": 0 } }
```

`bot-inputs.json` được nạp lại bằng CLI headless chính thức (`bot-replay.jsonl`) và cho đúng kết quả trên:
`{"type":"end","ticks":13415,"state":"won","score":1332}`.

### 5. Ảnh giao diện

| Ảnh | Chứng minh |
|---|---|
| `ui/01-menu.png` | Menu chính, nút bắt đầu hành trình + cài đặt |
| `ui/02-intro-night1.png` | Màn giới thiệu Đêm 1, lời Ông Đăng, mẹo chơi |
| `ui/03-night1.png` | Camera 3D, Mây, HUD v1.1 (lửa, 04:56, đèn 0/5, thanh 10 ô, hồi chiêu) |
| `ui/04-night1-lit.png` | 3 đèn sáng, vùng an toàn, Bóng Mực, đom rơi, HUD 7/10 |
| `ui/05-pause.png` | Tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `ui/06-settings.png` | Âm lượng + độ nhạy chuột + độ khó |
| `ui/07-settings-hard.png` | Chọn Khó, mô tả cập nhật |
| `ui/08-night2-bridge.png` | Đêm 2: cầu tre nối hai đảo, Gió Lạc, Bùa Gió |
| `ui/08b-night2-pad.png` | Toàn cảnh hai đảo + cầu + bục |
| `ui/09-night3.png` | Đêm 3: vách tầng, đèn trên tầng 1/2, gió mạnh, lá bay, thanh Bùa Gió |
| `ui/10-sunrise.png` | Màn Bình Minh + tổng điểm |

Script in thêm bằng chứng tạm dừng: `pause: ticks 393 -> 393` (tick không tăng khi mở menu tạm dừng),
`fps: 60`.

Ảnh dùng dev hook `window.__dao` để đặt vị trí/trạng thái chụp nhanh; đây là **ảnh minh hoạ giao diện**,
không phải bằng chứng thắng. Bằng chứng thắng là mục 4.

### 6. Hiệu năng

- Headless: Đêm 3 đầy đủ 21 600 tick trong **~0,13 s** (`verify-report.txt`).
- Giao diện: **~60 fps** ở 1280×720 trong Chromium headless trên máy này (`ui/fps.txt`).

## Chưa kiểm chứng / hạn chế (ghi trung thực)

- **Âm thanh**: code chạy không lỗi trong Chromium headless nhưng headless không phát ra loa; chưa có kiểm
  chứng tự động cho việc nghe thật.
- **Cảm giác chơi ba Đêm**: bot chỉ chứng minh Đêm 1 thắng được; Đêm 2/3 mới được kiểm bằng scenario và
  ảnh, chưa có bot thắng trọn.
- **FPS** chỉ đo trên một máy (macOS, Chromium headless). Chưa đo trên GPU tích hợp yếu.
- **Độ khó** chưa được nhiều người chơi thử; Khó nhân đôi trần Bóng Mực có thể rất khó.
- **Số liệu token** trong `docs/AI-LOG.md` là ước tính, không phải đo tự động.

---

# Bằng chứng kiểm chứng — Phase 3 "Đèn cạn dầu" (Contract v1.2)

Mọi bằng chứng dưới đây được tạo bằng lệnh thật, lưu trong `evidence/phase-3/`.
Máy chạy: macOS, Node v24.14.0, Chromium headless 1280×720.

## Bảng yêu cầu → bằng chứng

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Luật Phase 3: dầu, châm dầu, thắp lại, hút dầu, ngưỡng 30, bình minh, sức chứa, điểm mới | `npm test` (Vitest) | `test-report.txt` | **94/94 test đạt** |
| Contract headless v1.2: shape mới, event mới, scenario mới, 3 Đêm, tất định, hiệu năng | `npm run verify` | `headless/verify-report.txt` + 29 file `.jsonl` | **29/29 case đạt** |
| Tất định | Hai lần chạy cùng seed rồi băm SHA-256 | `headless/determinism-sha256.txt` | **hai hash giống hệt** |
| Chơi được tới thắng theo luật mới | Bot chơi Đêm 1, rồi replay inputs qua CLI chính thức | `headless/bot-summary.json`, `bot-replay.jsonl` | **thắng tick 14 400, 858 điểm, 3/5 đèn, 3 lửa** |
| Dầu đèn | Test `lantern fuel`; verify `03`, `25`, `26` | `headless/25-refuel.jsonl`, `26-lantern-out.jsonl` | châm 6 đom → 100 dầu; cạn dầu phát `lantern_out` |
| Bóng Mực hút dầu | Test `shade drain`; verify `27` | `headless/27-drain.jsonl` | `state=drain`, 3 event `fuel_drain` trong 180 tick |
| Thắp lại | Test relight; verify `28` | `headless/28-relight.jsonl` | 5 đom, `relight:true`, 65 điểm |
| Bình minh | Test ending; verify `06`, `07` | `headless/06-win.jsonl`, `07-dawn.jsonl` | 3/5 đèn → `dawn_survived` 597 điểm; 2/5 → `dawn`, 0 điểm |
| Sức chứa | Test capacity; verify `29` | `headless/29-capacity.jsonl` | `capacity=20`, mang 19 |
| Đầu vào sai → mã thoát 2 | verify case `08` | `headless/verify-report.txt` | exit 2, lỗi ra stderr |
| HUD thanh dầu, đèn yếu nhấp nháy | Playwright chụp màn hình | `ui/04d-lantern-fuel.png`, `ui/04c-low-fuel.png` | thanh dầu co theo `fuel`; pip đỏ nhấp nháy |
| Chế độ mù màu | Ảnh cài đặt + ảnh Đêm 1 | `ui/07b-settings-colorblind.png`, `ui/11-colorblind-night1.png`, `ui/12-colorblind-off-lantern.png` | Bóng Mực xanh `#00B3FF`, đèn tắt có giấy rách, pip rỗng nét đứt |
| Menu, 3 Đêm, Bình Minh, tạm dừng | Playwright chụp màn hình | `ui/01` … `ui/10` | ảnh đúng, không lỗi console |
| Hiệu năng headless | Chạy Đêm 3 dài 21 600 tick | `verify-report.txt` (dòng `full-night-3`) | **~0,24 s** (< 30 s) |
| Hiệu năng giao diện | Đo requestAnimationFrame | `ui/fps.txt` | **~60 fps** ở 1280×720 |
| Build sạch | `npm run build` | `build-log.txt` | thành công |

## Lệnh tái lập

```bash
npm ci
npm run build
npm test                 # 94 unit test
npm run verify           # 29 case, ghi evidence/phase-3/headless/
npm run bot              # bot phải thắng; ghi bot-inputs.json + bot-summary.json
node dist-node/headless/main.js --seed 7 --night 1 --ticks 14500 \
  --inputs evidence/phase-3/headless/bot-inputs.json \
  --out /tmp/bot-replay.jsonl --snapshot-every 600
tail -1 /tmp/bot-replay.jsonl
# {"type":"end","ticks":14400,"state":"won","score":858}
```

## Ghi chú test bị thay thế

Các test Phase 1–2 sau bị luật v1.2 làm sai và đã được cập nhật (không `skip`):

| Test cũ | Lý do | Test mới |
|---|---|---|
| Thời lượng 300/330/360 | Ticket đổi còn 240/270/300 | setup + headless duration |
| +10/đom, +100/đèn | Bảng điểm mới +5, +100/+40 | lanterns, ending |
| Thắng khi đèn cuối sáng | Bỏ thắng sớm | "không thắng sớm khi mọi đèn sáng" |
| Thắng ở hạn chót với mọi đèn | Cần 60% và thưởng theo dầu | ending bình minh |
| Sức chứa cố định 10 | Sức chứa tăng theo lần thắp | capacity |
| Vùng an toàn mọi đèn sáng | Đèn `fuel < 30` mất vùng | weak safe zone |

---

# Phase 4 — Release v1.0.0 (Contract v1.3)

Ngày: 2026-11-20 · Máy: Apple M1 Pro, 16 GB, macOS 27.0.0 · Node 22+

## Lệnh tái lập

```bash
npm ci
npm run build
npm test
npm run typecheck
npm run verify
npm run bench -- --seed 42 --duration 30 --out bench.json
npm run soak -- --seed 7 --nights 10 --out soak.json
node dist-node/app.js --export-leaderboard evidence/phase-4/leaderboard-export.json
node scripts/shots-phase4.mjs
```

## Kết quả đo

| Hạng mục | Kết quả | Ngưỡng | File |
|---|---|---|---|
| Unit test | **135 / 135** trong 14 file | tất cả xanh | `npm test` |
| Contract verify | **35 kiểm tra**, 0 lỗi | 0 lỗi | `evidence/phase-4/headless/verify-report.txt` |
| Benchmark | `avg_fps 217.95`, `p1_low_fps 158.77`, `p95 5.3 ms`, `load_ms 1230`, `frames 6539`, `peak_mem 1224 MB` | 60 / 30 / ≤10 000 | `bench.json`, `evidence/phase-4/bench.json` |
| Soak | 10 Đêm, `crashes 0`, RSS `56 → 63 MB` (1.13×), 0.3 s | 0 crash, ≤1.2× | `soak.json`, `evidence/phase-4/soak.json` |
| Leaderboard export | `{"entries":[...]}`, đúng thứ tự, file hỏng → rỗng | đúng schema | `evidence/phase-4/leaderboard-export.json` |
| Cỡ chữ UI | nhỏ nhất **18 px** (chữ lớn 22.5 px) ở 1280×720 | ≥ 18 px | ảnh `02`, `03` |

## Bằng chứng UI

`evidence/phase-4/ui/`:

| Ảnh | Nội dung |
|---|---|
| `01-menu.png` | Menu chính có nút Bảng xếp hạng |
| `02-settings.png` | Cài đặt: âm thanh, mù màu, độ khó, giảm chuyển động, chữ lớn, phím |
| `03-settings-large-text.png` | Tuỳ chọn chữ lớn ×1.25 |
| `04-hud-alerts.png` | Phụ đề "Gió sắp thổi", "Đèn L4 sắp cạn dầu"; HUD 18 px |
| `05-keybind-conflict.png` | Từ chối phím `W` trùng hành động "Tiến" |
| `06-keybind-settings.png` | Phím Nhảy đã đổi sang `J`, lưu sau khi tải lại |
| `07-leaderboard-empty.png` | Bảng xếp hạng trống |
| `08-result-score-form.png` | Lưu điểm sau khi thua, top 10 hiện ngay |
| `09-leaderboard.png` | Bảng xếp hạng từ menu |

## Demo

`docs/demo/demo.mp4` (dưới 5 phút): chơi Đêm 1, mở cài đặt đổi phím, xem bảng xếp hạng, chạy benchmark.

## Chưa kiểm chứng / hạn chế

- Số benchmark phụ thuộc GPU/máy; máy chấm của giảng viên là nguồn chính thức.
- `peak_mem_mb` cộng RSS theo tiến trình nên cao hơn bộ nhớ riêng thực tế.
- Nếu compositor khoá 60 Hz, `avg_fps ≈ 60` dù đã truyền cờ tắt VSync; vẫn đạt ngưỡng.
- Release GitHub cần tài khoản có quyền; nếu `gh` chưa đăng nhập, gói `release/` và ghi chú vẫn nằm trong repo.
