# Bằng chứng kiểm chứng — Phase 1

Mọi bằng chứng dưới đây được tạo bằng lệnh thật, lưu trong `evidence/phase-1/`.
Máy chạy: macOS 27.0, Node v24.14.0, Chromium headless 1440×900.

## Bảng yêu cầu → bằng chứng

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Logic game đúng (di chuyển, nhặt, nạp, pulse, sát thương, thắng/thua, điểm) | `npm test` (Vitest, 43 test) | `evidence/phase-1/test-report.txt` | **43/43 đạt** |
| Contract headless: tham số, tick model, snapshot/event/end, mã thoát | `npm run verify` | `evidence/phase-1/headless/verify-report.txt` + 10 file `.jsonl` | **10/10 đạt** |
| Tất định | Chạy 2 lần cùng seed rồi so byte | `headless/determinism-sha256.txt` | **hash giống hệt** |
| Chơi được tới thắng | Bot chơi tự động, rồi replay inputs qua CLI chính thức | `headless/bot-summary.json`, `headless/bot-run.jsonl` | **thắng ở tick 5 282, 2 775 điểm** |
| Hết đêm thì thua | Scenario `07-dawn.json` | `headless/07-dawn.jsonl` | thua `dawn` ở tick 60 |
| Hết lửa thì thua | Scenario `05-hit.json` + test | `headless/05-hit.jsonl` | thua `no_flames` |
| Đầu vào sai → mã thoát 2 | `scripts/verify.mjs` case 08 | `headless/verify-report.txt` | exit 2, lỗi ra stderr |
| HUD, đồ họa, màn kết quả | Playwright chụp màn hình | `ui/01-start.png` … `ui/04-win-overlay.png` | ảnh đúng, không lỗi console |
| Hiệu năng headless | Chạy đủ 18 000 tick (300 s mô phỏng) | `headless/perf-18000.txt` | **0,04 s** (~450× thời gian thực) |
| Hiệu năng giao diện | Đo requestAnimationFrame trong Chromium | `ui/fps.txt` | **~60 fps** |
| Build sạch | `npm run build` | `evidence/phase-1/build-log.txt` | thành công |

## Lệnh tái lập

```bash
npm ci
npm run build
npm test                 # 43 unit test
npm run verify           # 10 kiểm tra contract, ghi evidence/phase-1/headless/
npm run bot              # bot chơi; thắng thì exit 0 và ghi bot-inputs.json
node dist-node/headless/main.js --seed 7 --night 1 --ticks 18000 \
  --inputs evidence/phase-1/headless/bot-inputs.json \
  --out /tmp/bot-run.jsonl --snapshot-every 60
tail -1 /tmp/bot-run.jsonl
# {"type":"end","ticks":5282,"state":"won","score":2775}
```

Ảnh UI cần dev server:

```bash
npm run dev &
node scripts/shots.mjs
```

## Chi tiết từng bằng chứng

### 1. Unit test — 43 test

Phủ: dựng scenario (không cộng điểm cho đèn đặt sẵn), di chuyển theo `cam_yaw_deg`, chuẩn hóa vector,
giới hạn đảo, nhảy, nhặt theo `pickup_radius`, `carry_capacity`, nạp đèn (thiếu bao nhiêu nạp bấy nhiêu),
edge-trigger interact, thắng `all_lit`, pulse (giá, bán kính, push, cooldown, hết choáng), Bóng Mực đuổi,
sát thương + rơi ánh sáng + bất tử, vùng an toàn của đèn, thua `no_flames`, thua `dawn`, công thức điểm,
tính tất định, sinh quái theo thời gian.

### 2. Contract headless — 10 kiểm tra

`scripts/verify.mjs` chạy CLI đã build và kiểm tra cả cấu trúc lẫn luật:

| Case | Nội dung | Kết quả |
|---|---|---|
| 01-movement | 60 tick `move [0,1]`, yaw 0 → z = 6,000 | đạt |
| 02-pickup | nhặt đom đóm ở tick 35, `motes_active` về 0, +10 điểm | đạt |
| 03-deposit | `deposit` tick 1, `amount 3`, `lantern_lit` tick 1 | đạt |
| 04-pulse | `stunned_ids ["S1"]`, trừ 2 ánh sáng, đẩy 4 m, +25 | đạt |
| 05-hit | `player_hit` tick 1, `flames 2`, `dropped 2` | đạt |
| 06-win | `won`, `all_lit`, điểm 1 750 (100 + 1 500 + 150) | đạt |
| 07-dawn | dừng tick 60, `lost`, `dawn`, điểm 150 | đạt |
| 08-invalid-inputs | file inputs sai → exit **2** | đạt |
| 09-determinism | hai lần chạy 4 800 tick giống hệt từng byte | đạt |
| 10-idle | không input → người chơi không di chuyển | đạt |

Mỗi snapshot còn được kiểm tra: tick chia hết `--snapshot-every`, `sim_tick == tick`, đủ 5 đèn, `motes_active`
khớp mảng motes, toạ độ làm tròn 3 chữ số, `time_left_s >= 0`, mỗi sự kiện có tick nguyên ≥ 1 và không vượt
tick kết thúc, tối đa một `game_over`.

### 3. Tất định

```
9bb0c0f5…5703a  09-determinism-a.jsonl
9bb0c0f5…5703a  09-determinism-b.jsonl
```

Cùng `--seed 424242`, 4 800 tick, không scenario/inputs → file giống hệt.

### 4. Chơi được tới thắng

`npm run bot` điều khiển nhân vật bằng chính `GameCore`: chọn mục tiêu gần nhất, nạp đèn khi đủ, pulse khi
Bóng Mực lại gần. Kết quả `bot-summary.json`:

```json
{ "state": "won", "ticks": 5282, "score": 2775, "time_left_s": 211.967, "flames": 1,
  "stats": { "motes": 39, "lanterns": 5, "stuns": 31, "hits": 2 } }
```

File `bot-inputs.json` được nạp lại bằng CLI headless chính thức (`bot-run.jsonl`) và cho đúng kết quả trên.
Đây là bằng chứng chuỗi: logic thật → input thật → CLI thật → thắng.

### 5. Ảnh giao diện

| Ảnh | Chứng minh |
|---|---|
| `ui/01-start.png` | Màn mở đầu, hướng dẫn, nút Bắt đầu, không lỗi console |
| `ui/02-gameplay.png` | Camera 3D, Mây đội nón lá, HUD (lửa, ánh sáng 2/5, đèn 0/5, 04:57, điểm), đom đóm, gợi ý theo ngữ cảnh |
| `ui/03-lit-lanterns.png` | 3 đèn sáng: đảo ấm lên, vùng an toàn quanh đèn, Bóng Mực tím, HUD cập nhật |
| `ui/04-win-overlay.png` | Màn thắng + bảng điểm chi tiết + nút Chơi lại |

Ảnh 03 và 04 đặt trạng thái bằng dev hook `window.__dao` để chụp nhanh; đây là **ảnh minh hoạ giao diện**,
không phải bằng chứng thắng. Bằng chứng thắng là mục 4.

### 6. Hiệu năng

- Headless: 18 000 tick trong **0,04 s** (`perf-18000.txt`).
- Giao diện: **~60 fps** ở 1440×900 trong Chromium headless trên máy này (`ui/fps.txt`).

## Chưa kiểm chứng / hạn chế (ghi trung thực)

- **Âm thanh**: code chạy không lỗi trong Chromium headless nhưng headless không phát ra loa; chưa có kiểm chứng tự động cho việc nghe thật.
- **Nút "Chơi lại"**: đã thao tác tay thấy ván mới bắt đầu; chưa có test tự động cho nút này.
- **FPS** chỉ đo trên một máy (macOS, Chromium headless). Chưa đo trên máy khác hay GPU tích hợp yếu.
- **Độ khó** chưa được chơi thử bởi nhiều người; bot thắng với 1 ngọn lửa còn lại, người mới có thể thấy khó.
- **Số liệu token** trong `docs/AI-LOG.md` là ước tính, không phải đo tự động.
