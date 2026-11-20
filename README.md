# Đảo Đèn Lồng — Phase 3 "Đèn cạn dầu"

Game 3D góc nhìn thứ ba làm bằng **TypeScript + Three.js + Vite**, chạy trên macOS/Linux trong trình duyệt.
Ba Đêm nối tiếp: **Đảo Bến**, **Đảo Cau**, **Đảo Chuông**. Bạn là Mây, gom đom đóm để thắp và **giữ dầu**
cho các Đèn Lồng Lớn tới bình minh, trong khi Bóng Mực đuổi theo và hút cạn những ngọn đèn yếu.

![Gameplay](evidence/phase-3/ui/04-night1-lit.png)

## Chạy game (3 lệnh)

```bash
npm ci
npm run build
npm run dev
```

`npm run dev` tự mở `http://localhost:5173`. Cần Node.js 20 trở lên.

## Điều khiển

| Phím | Việc |
|---|---|
| `W A S D` | Di chuyển theo hướng camera |
| Chuột (nhấp vào màn chơi để khóa) | Xoay camera |
| `Space` | Nhảy (7 m/s, chỉ khi chạm đất) |
| `Shift` | Lướt 14 m/s trong 0.2 s, hồi chiêu 1.5 s |
| `Q` | Giữ để tạm dừng và nhìn từ trên cao (thả ra để chơi tiếp) |
| `E` | Thắp đèn / châm dầu cho Đèn Lồng Lớn gần nhất |
| `F` | Tỏa sáng: làm choáng và đẩy Bóng Mực, tốn 3 đom đóm |
| `M` | Bật/tắt âm thanh |
| `P` / `Esc` | Tạm dừng: Tiếp tục · Chơi lại Đêm · Cài đặt · Về menu |

## Ba Đêm

| Đêm | Đảo | Thời gian | Đèn | Cần sáng lúc bình minh | Đặc điểm |
|---|---|---|---|---|---|
| 1 | Đảo Bến | 240 s | 5 | 3 | Đảo tròn bán kính 40 m, rơi khỏi mép |
| 2 | Đảo Cau | 270 s | 6 | 4 | Hai đảo nối bằng cầu tre, 2 bục nhảy, Bùa Gió, Gió Lạc |
| 3 | Đảo Chuông | 300 s | 7 | 5 | Ba tầng, 2 dốc, tháp chuông, gió mạnh, 2 Bùa Gió |

Đèn mới thắp có **100 dầu** và hao **1 dầu/giây**. Tương tác `E` với đèn đang sáng để châm thêm
10 dầu mỗi đom đóm. Đèn đã từng sáng chỉ cần **5 đom đóm** để thắp lại; đèn mới cần 10.

Bóng Mực sợ vùng sáng bán kính 6 m quanh đèn có `fuel ≥ 30`. Đèn yếu hơn mất vùng an toàn; Bóng Mực
`wander` sẽ tới đứng cách 2 m và hút **5 dầu/giây** cho tới khi đèn tắt hoặc được châm lên 30.
Bị chạm mất 1 Ngọn Lửa, rơi nửa số đom đóm, bất tử 1.5 s. Rơi khỏi đảo mất hết đom đóm và hồi sinh
sau 1 s. Hết giờ mà chưa đủ đèn sáng, hoặc hết 3 Ngọn Lửa, là thua. Thắng cả ba Đêm để xem Bình Minh
và tổng điểm chiến dịch.

Mỗi lần thắp đèn thành công tăng sức chứa thêm 2 đom đóm, tối đa 20.

## Chế độ headless (Test Contract v1.2)

```bash
node dist-node/headless/main.js --seed 7 --night 1 --ticks 600 --out out.jsonl
node dist-node/headless/main.js --seed 3 --night 2 --ticks 120 \
  --scenario tests/scenarios/16-jump-pad.json --out pad.jsonl --snapshot-every 10
node dist-node/headless/main.js --seed 5 --night 3 --ticks 18000 --out night3.jsonl
```

- Logic chạy đúng 60 tick/giây, không GPU, không cửa sổ.
- Đầu ra JSONL: `snapshot` (tick 0 rồi mỗi `--snapshot-every`), `event` ngay khi xảy ra, dòng cuối `end`.
- File scenario/inputs sai định dạng: thoát mã **2**, lỗi ra `stderr`. Lỗi CLI: mã **1**.
- Cùng seed + scenario + inputs cho ra file giống hệt nhau (kiểm chứng byte).
- Full Đêm 3 (18 000 tick) chạy ~0.25 s, dưới giới hạn 30 s.

`game.contract.json` ở gốc repo khai toàn bộ tuning v1.2. Test `tests/contract.test.ts` chặn việc file
này lệch khỏi `src/core/tuning.ts`.

### Các con số tuning

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| `player_speed` | 6 m/s | tăng/giảm tốc trong 0.1 s |
| `carry_capacity` / `capacity_max` | 10 / 20 | nền + 2 mỗi lần thắp |
| `lantern_cost` / `relight_cost` | 10 / 5 | đèn mới / đèn đã từng sáng |
| `fuel_max` | 100 | |
| `fuel_decay_per_s` | 1 | tính 1/60 mỗi tick |
| `fuel_per_mote` | 10 | khi châm dầu |
| `drain_per_s` | 5 | mỗi Bóng Mực đang hút |
| `low_fuel_threshold` | 30 | dưới ngưỡng: mất vùng an toàn, bị hút |
| `win_ratio` | 0.6 | cần `ceil(0.6 × tổng)` đèn sáng lúc bình minh |
| `pickup_radius` | 1.0 m | XZ, chênh cao ≤ 1.5 m |
| `interact_radius` | 2.0 m | XZ, cùng tầng (chênh cao ≤ 1.5 m) |
| `pulse_cost` | 3 | |
| `pulse_radius` | 5 m | khoảng cách 3D tới tâm Bóng Mực |
| `dash_speed` / `dash_duration_s` / `dash_cooldown_s` | 14 m/s / 0.2 s / 1.5 s | |
| `night1_duration_s` / `night2_duration_s` / `night3_duration_s` | 240 / 270 / 300 | |
| `flames` | 3 | hồi đầy mỗi Đêm |
| `invuln_s` | 1.5 | 90 tick |
| `hit_drop_ratio` | 0.5 | rơi `floor(mang / 2)` |
| `pulse_stun_s` | 2 | 120 tick |
| `pulse_push_m` | 4 | trong 15 tick đầu |
| `pulse_cooldown_s` | 3 | |
| `safe_radius` | 6 | quanh mỗi đèn đủ dầu |
| `shade_speed` | 4.0 m/s | Đêm 3: 4.5 m/s |
| `shade_hit_radius` | 1.0 m | XZ, chênh cao ≤ 1.5 m |
| `fall_enabled` | true | rơi khỏi đảo |

Ngoài contract (trong `PHYSICS`): nhảy 7 m/s, trọng lực 20 m/s², gia tốc mặt đất 60 m/s², điều khiển
trên không 40%, trần đom đóm 30, TTL đom rơi 480 tick, Bùa Gió 600 tick, respawn 2700 tick.

## Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Nạp hoặc châm 1 đom đóm vào đèn | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Bóng Mực trúng Tỏa Sáng khi đang `drain` | +15 thêm |
| Khi thắng: mỗi đèn còn sáng | `+50 + floor(fuel)` |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Không còn thưởng thời gian. Điểm trong snapshot giữa màn là điểm sự kiện; hai khoản thưởng cuối màn
chỉ cộng khi **thắng**. Tổng điểm chiến dịch = tổng điểm các Đêm đã thắng.

Ví dụ thật (bot thắng Đêm 1, xem `evidence/phase-3/headless/bot-summary.json`):
`30 đom đóm × 5 + 3 đèn × 100 + 7 lần choáng × 5 + (89+69+65) thưởng đèn + 3 lửa × 50 = 858`.

## Giả định cho chỗ PHASE-3 còn mơ hồ

| # | Giả định |
|---|---|
| A22 | Dầu lưu bằng số nguyên 1/60; chỉ làm tròn một chữ số khi xuất snapshot/event. |
| A23 | Trừ dầu sau bộ đếm thời gian, trước di chuyển; đèn `fuel <= 0` tắt ngay sau bước trừ. |
| A24 | `deposited` là tiến độ lần thắp kế tiếp; về 0 khi đèn sáng hoặc tắt. |
| A25 | Đèn chưa sáng có `fuel: 0`; scenario `lit: true` thiếu `fuel` mặc định 100. |
| A26 | `successful_lights` chỉ tăng do người chơi thắp; đèn đặt sẵn không tính. |
| A27 | Sức chứa mới áp dụng ngay; nhặt đom dừng ở sức chứa. |
| A28 | Bóng Mực `drain` đứng yên nhưng vẫn gây sát thương khi chạm. |
| A29 | `fuel_drain` phát mỗi 60 tick cho từng Bóng Mực đang hút, sau khi trừ dầu. |
| A30 | Thưởng bình minh dùng `floor(fuel60 / 60)` chưa làm tròn hiển thị. |
| A31 | Chế độ mù màu chỉ đổi hiển thị, không đổi lõi hay output headless. |
| A32 | Giữ `Q` ≥ 180 ms để xem từ trên cao; nạp/châm dầu dùng `E`. Headless không đổi. |
| A33 | Bóng Mực `drain` vào `chase` khi Mây trong 6 m tính theo XZ; không xét tầng. |

## Sáng tạo của tôi

Phần thêm nằm ngoài lõi hoặc chỉ đọc trạng thái, nên đầu ra headless không đổi:

- **Ba hòn đảo dựng hoàn toàn bằng code**: cầu tre, ba tầng, dốc, bục nhảy phát sáng, tháp chuông.
- **Thanh dầu trên từng đèn** và **nhấp nháy 1 Hz** khi dầu dưới 30.
- **Đảo sáng dần** theo số đèn còn sáng; vùng an toàn chỉ hiện quanh đèn đủ dầu.
- **Chế độ mù màu**: Bóng Mực viền/mắt xanh lam `#00B3FF`, cảnh báo trắng kèm ⚠, đèn tắt xẹp 20%
  và có giấy bọc rách, đèn yếu nhấp nháy. Cài đặt được lưu.
- **Hiệu ứng**: vòng pulse lan tỏa, bất tử nhấp nháy, Bóng Mực có mắt và 4 vệt sương, Gió Lạc là dải lụa
  xám xanh, Bùa Gió đỏ viền vàng, lá bay khi gió mạnh, đom đóm rơi khác màu.
- **Âm thanh procedural** bằng Web Audio: nhạc nền đổi theo Đêm, hiệu ứng nhặt/nạp/châm/thắp/tắt đèn/
  pulse/bị đánh/nhảy/lướt/Bùa Gió/Gió Lạc/Bóng Mực xuất hiện/đếm ngược/thắng/thua.
- **HUD đầy đủ**: lửa, đồng hồ `mm:ss` đỏ ≤ 30 s, đèn k/n + điểm, thanh sức chứa động, hồi chiêu
  Lướt/Tỏa Sáng, nhắc `E`, mũi tên chỉ đèn đang cần, nhãn gió và Bùa Gió.
- **Giữ `Q` để xem từ trên cao**: đồng hồ game đứng yên, camera bay lên 40 m.
- **Chiến dịch 3 Đêm** với menu, màn giới thiệu lời Ông Đăng, màn kết quả từng Đêm, Bình Minh.
- **Tạm dừng** có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; cài đặt âm lượng, độ nhạy, độ khó,
  bảng màu lưu trong `localStorage`.
- **Mini-map v1.2**: vẽ đảo/cầu/tầng, đèn tắt rỗng, đèn sáng có vòng dầu, vùng an toàn, Bóng Mực,
  Gió Lạc, Bùa Gió, hướng gió.
- **Bot chơi tự động** (`npm run bot`) thắng Đêm 1 bằng cách pre-fill 3 đèn rồi thắp trong 90 giây cuối.

Ảnh minh họa: `evidence/phase-3/ui/01-menu.png` (menu), `02-intro-night1.png` (giới thiệu),
`04-night1-lit.png` (Đêm 1), `04c-low-fuel.png` (đèn yếu nhấp nháy), `04d-lantern-fuel.png` (cận cảnh thanh dầu),
`04b-overview.png` (nhìn từ trên cao), `05-pause.png`, `06-settings.png`, `07b-settings-colorblind.png`,
`08-night2-bridge.png`, `09-night3.png`, `10-sunrise.png`, `11-colorblind-night1.png`,
`12-colorblind-off-lantern.png`.

## Cấu trúc

```
src/core/        logic game thuần: tuning, physics, rng, scenario, nights, terrain, game, input-track
src/headless/    CLI đọc tham số, scenario, inputs và ghi JSONL
src/render/      Three.js: world theo Đêm, HUD, mini-map, cài đặt, âm thanh, chiến dịch 60 Hz
tests/           unit test + scenario mẫu cho từng tính năng
scripts/         verify.mjs (29 kiểm tra), bot.ts (chơi tự động), shots.mjs (ảnh UI)
evidence/        bằng chứng phase-1, phase-2 và phase-3
docs/            SPEC, EVIDENCE, AI-LOG, ADR, CHANGELOG, thiết kế + kế hoạch phase-2/3
```

## Kiểm chứng

```bash
npm test          # 94 unit test
npm run build
npm run verify    # 29 kiểm tra contract trên CLI đã build
npm run bot       # bot thắng Đêm 1, ghi evidence/phase-3/headless/bot-inputs.json
```

Kết quả và cách đọc: [docs/EVIDENCE.md](docs/EVIDENCE.md). Yêu cầu → tiêu chí nghiệm thu:
[docs/SPEC.md](docs/SPEC.md). Nhật ký dùng AI và retro: [docs/AI-LOG.md](docs/AI-LOG.md).
Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn.md](docs/adr/0001-lantern-fuel-and-dawn.md).
Thay đổi phá vỡ tương thích: [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Tài liệu của lab

Yêu cầu gốc và hướng dẫn lab vẫn giữ trong repo: [docs/phase/PHASE-1.md](docs/phase/PHASE-1.md),
[docs/phase/PHASE-2.md](docs/phase/PHASE-2.md), [docs/phase/PHASE-3.md](docs/phase/PHASE-3.md),
[GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [RUBRIC.md](RUBRIC.md), [RULES.md](RULES.md),
[SUBMISSION.md](SUBMISSION.md).

## Giấy phép và nguồn

Xem [CREDITS.md](CREDITS.md). Toàn bộ mô hình, texture và âm thanh được tạo bằng code, không dùng asset ngoài.
