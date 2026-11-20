# Spec Phase 2 — "Ba hòn đảo"

Nguồn: `docs/phase/PHASE-2.md` (Contract v1.1) + `docs/superpowers/specs/2026-11-20-phase-2-design.md`.
Tài liệu này chốt tiêu chí nghiệm thu, giả định và cách kiểm chứng.

## Mục tiêu

Đồng bộ toàn bộ số liệu chuẩn v1.1, mở rộng thành ba Đêm chơi liên tiếp trong trình duyệt, thêm Lướt,
Bùa Gió, Gió Lạc, gió mạnh, rơi khỏi đảo và tạm dừng; giữ lõi headless tất định để chấm tự động.

## Tiêu chí nghiệm thu

| # | Yêu cầu | Cách kiểm chứng | Trạng thái |
|---|---|---|---|
| AC1 | Tuning khớp Phần 1, contract `1.1`, có 5 khóa mới | `tests/contract.test.ts`, `npm run verify` | đạt |
| AC2 | Bản đồ Đêm 1/2/3 đúng tọa độ, cầu, tầng, dốc, bục nhảy, tháp | `tests/terrain.test.ts`, ảnh `08/09` | đạt |
| AC3 | Di chuyển 6 m/s, tăng/giảm tốc ≤ 0.1 s, nhảy 7 m/s, `g = 20` | `tests/core.test.ts` movement/jump | đạt |
| AC4 | Lướt 14 m/s × 12 tick, hồi 1.5 s, giữ độ cao trên không | test dash + air dash; scenario `10-dash` | đạt |
| AC5 | Bục nhảy phóng đúng vận tốc, đáp sang đảo/tầng đích | test jump pads; scenario `16`, `21` | đạt |
| AC6 | Rơi khỏi đảo: −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh, bất tử 90 tick | test fall; scenario `15-fall` | đạt |
| AC7 | Đom đóm: 20 ban đầu, trần 30, sinh mỗi 240 tick, TTL 480 cho đom rơi | test economy; scenario `18` | đạt |
| AC8 | Đèn: 10 đom đóm, nạp một phần, nhớ tiến độ, chọn gần nhất | test lanterns; scenario `03` | đạt |
| AC9 | Điểm: +10 lúc nạp, +100 đèn, +5 mỗi Bóng Mực trúng pulse, thưởng thắng | test ending; scenario `06` | đạt |
| AC10 | Bóng Mực: lịch sinh, 5 trạng thái, detect 12/lose 18, hit drop 1/2, recoil | test shades; scenario `04`, `05`, `19`, `20` | đạt |
| AC11 | Vùng an toàn bán kính 6, đẩy Bóng Mực ra, chặn sát thương | test safe zone; scenario `04` | đạt |
| AC12 | Tỏa Sáng: 3 đom, bán kính 3D 5, choáng 120 tick, đẩy 4 m/15 tick | test pulse; scenario `04` | đạt |
| AC13 | Gió Lạc: sinh tick 1200, idle/chase/flee, cướp 3, pulse làm rơi | test drifters; scenario `12`, `13` | đạt |
| AC14 | Bùa Gió: 600 tick, tốc độ 7.2, lướt không hồi chiêu, respawn 2700 | test charm; scenario `11` | đạt |
| AC15 | Gió mạnh Đêm 3: chu kỳ 30 s, 5 s, cảnh báo 2 s, đẩy 2 m/s | test wind; scenario `14` | đạt |
| AC16 | Tạm dừng: tick tăng, `sim_tick`/thời gian/hồi chiêu/spawn đứng yên | test pause; scenario `09` | đạt |
| AC17 | Snapshot v1.1: `night`, `wind`, player mở rộng, `motes`, `drifters`, `charms` | `scripts/verify.mjs` shape check | đạt |
| AC18 | Event mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed` | verify + scenario mỗi event | đạt |
| AC19 | `--night` nhận 1/2/3; thời lượng 300/330/360 | headless test + verify `19`, `20` | đạt |
| AC20 | Chuỗi 3 Đêm: menu → giới thiệu → chơi → kết quả → Đêm kế; thắng 3 → Bình Minh | ảnh `01`, `02`, `10`; `Campaign` trong `src/render/main.ts` | đạt |
| AC21 | Tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | ảnh `05-pause.png` | đạt |
| AC22 | Cài đặt âm lượng + độ nhạy chuột, lưu giữa các lần mở | `Settings` + `localStorage`; ảnh `06` | đạt |
| AC23 | Âm thanh: nhạc nền đêm + hiệu ứng nhặt/thắp/tỏa/bị đánh/nhảy/lướt/thắng/thua/spawn/đếm ngược | `src/render/audio.ts`; nghe thủ công | đạt |
| AC24 | HUD đầy đủ: lửa, `mm:ss` đỏ ≤ 30 s, đèn k/n + điểm, 10 ô, hồi chiêu, nhắc E, mũi tên ngoài màn hình | ảnh `03/04/09` | đạt |
| AC25 | Bảng màu chuẩn, ambient `0.15 + 0.55 × đèn sáng / tổng` | `src/render/world.ts`; ảnh UI | đạt |
| AC26 | Tất định byte-for-byte; Đêm đầy đủ ≤ 30 s | verify `22-determinism`, `24-performance` | đạt |
| AC27 | Bot thắng Đêm 1 rồi replay được qua CLI | `npm run bot`, `bot-replay.jsonl` | đạt |
| AC28 | ≥ 30 FPS ở 1280×720 | `evidence/phase-2/ui/fps.txt` (60 fps headless Chromium) | đạt |

## Quyết định thiết kế

1. Một lớp `Game` duy nhất cho cả ba Đêm; dữ liệu bản đồ ở `nights.ts`, truy vấn độ cao thuần ở `terrain.ts`.
2. `tuning.ts` chỉ chứa khóa contract; hằng số vật lý ngoài contract nằm trong `PHYSICS` cùng file nhưng
   không đưa vào `game.contract.json`.
3. Mọi ngẫu nhiên đi qua `Rng(seed)`; renderer chỉ đọc trạng thái lõi.
4. Tick theo đúng 12 bước của PHASE-2; event ghi `tick = k + 1`; `night_start` phát ở tick 1.
5. Tương tác đèn dùng bán kính XZ 2.0 m + chênh cao ≤ 1.5 m để không nạp xuyên tầng.
6. Điểm đom đóm cộng lúc **nạp** vào đèn (chữ "nạp" của Contract v1.1).
7. Thưởng thời gian và lửa chỉ cộng khi thắng.
8. Tạm dừng trong trình duyệt ngừng gọi `step()`; lõi vẫn hỗ trợ input `pause` cho headless.

## Giả định (A13–A20)

| # | Giả định |
|---|---|
| A13 | "Mỗi đom đóm nạp" tính điểm lúc nạp vào đèn, không phải lúc nhặt. |
| A14 | Hướng mặt ban đầu theo hướng xuất phát của Đêm (+Z); sau đó là hướng di chuyển khác 0 gần nhất. |
| A15 | Điều khiển trên không = 40% gia tốc mặt đất; lướt trên không khoá `y` trong 12 tick. |
| A16 | Tâm Bóng Mực ở `groundHeight + 1.0`; Gió Lạc ở `groundHeight + 1.6`. |
| A17 | Vùng an toàn và phát hiện Bóng Mực dùng XZ; chỉ chặn khi cùng tầng (`|Δy| ≤ 2`). |
| A18 | Bóng Mực `spawning` 30 tick, `wander` 2 m/s; recoil 60 tick đẩy 2 m. |
| A19 | Gió mạnh bắt đầu ở giây 30, 60, …; cảnh báo từ giây 28; hướng RNG mỗi cơn. |
| A20 | `fall_enabled = true` giữ trong contract; hằng số vật lý ngoài contract không có trong JSON. |
| A21 | Giữ `Q` ≥ 180 ms khi đang chơi thì renderer ngừng gọi `step()`, đưa camera lên 40 m nhìn xuống; thả `Q` là chơi tiếp. Nạp ánh sáng dùng `E`. Headless không đổi. |

## Ngoài phạm vi

Asset ngoài, nhiều người chơi, lưu tiến trình chiến dịch qua lần mở game (chỉ cài đặt được lưu), chơi trên
thiết bị di động cảm ứng.

## Bằng chứng

`evidence/phase-2/`: ảnh UI, JSONL của 24 kiểm tra verify, output bot + replay, báo cáo test/build.

---

# Spec Phase 3 — "Đèn cạn dầu" (Contract v1.2)

Nguồn: `docs/phase/PHASE-3.md` (Change Request) + `docs/adr/0001-lantern-fuel-and-dawn.md`.
Phase 2 vẫn là nền; phần dưới chỉ ghi phần bị thay thế hoặc thêm mới.

## Tiêu chí nghiệm thu Phase 3

| # | Yêu cầu | Cách kiểm chứng | Trạng thái |
|---|---|---|---|
| AC29 | Dầu đèn: tối đa 100, hao 1/giây, tính theo tick; snapshot một chữ số thập phân | `tests/core.test.ts` fuel; verify `03`, `26` | đạt |
| AC30 | Châm dầu `used = min(carried, ceil((100-fuel)/10))`; đèn đầy dầu không được chọn | test refuel; verify `25` | đạt |
| AC31 | Đèn cạn dầu tắt, `deposited = 0`, phát `lantern_out`, nhớ `ever_lit` | test out; verify `26` | đạt |
| AC32 | Thắp lại đèn đã từng sáng tốn 5 đom đóm, +40 điểm, tăng `relit_count` | test relight; verify `28` | đạt |
| AC33 | Đèn `fuel < 30` mất vùng an toàn; đúng 30 vẫn an toàn | test weak safe zone | đạt |
| AC34 | Bóng Mực `wander` chọn đèn yếu gần nhất, vào `drain` khi ≤ 2 m, hút 5/giây | test drain; verify `27` | đạt |
| AC35 | `drain` chuyển `chase` (Mây ≤ 6 m), `stunned` (Tỏa Sáng), `wander` (đèn tắt / fuel ≥ 30 / xa > 2 m) | test drain transitions | đạt |
| AC36 | Châm đèn lên ≥ 30 khi có Bóng Mực trong 6 m thì đẩy ra mép, không sát thương 30 tick | test safe zone + `keepOutOfLanternLight` | đạt |
| AC37 | Thời lượng 240/270/300; thắng khi hết giờ với `lit ≥ ceil(0.6 × tổng)`; không thắng sớm | test ending; verify `06`, `07` | đạt |
| AC38 | Hết Ngọn Lửa thua `no_flames` trước mọi lý do khác, kể cả tick cuối | test no_flames; `checkEnd` | đạt |
| AC39 | Điểm mới: +5/đom, +100/+40 đèn, +5/+15 Tỏa Sáng, bình minh `+50+floor(fuel)`/đèn, +50/lửa; bỏ thưởng thời gian | test ending; verify `06` | đạt |
| AC40 | Sức chứa `10 + 2 × successful_lights`, tối đa 20; reset mỗi Đêm | test capacity; verify `29` | đạt |
| AC41 | Snapshot v1.2 có `fuel`, `ever_lit`, `relit_count`, `player.capacity`, state `drain` | `scripts/verify.mjs` shape check | đạt |
| AC42 | Event mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`; reason `dawn_survived` | verify `25`–`28` | đạt |
| AC43 | Scenario nhận `lantern.fuel/ever_lit`, `player.successful_lights`, `shade.target_lantern_id`; sai kiểu exit 2 | `tests/parse.test.ts`, `tests/headless.test.ts` | đạt |
| AC44 | Chế độ mù màu lưu trong `localStorage`: Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + ⚠, đèn tắt xẹp 20% + giấy rách, đèn yếu nhấp nháy | `src/render/{settings,world,hud}.ts`, `styles.css`; ảnh `07b`, `11` | đạt |
| AC45 | HUD hiện sức chứa động, thanh dầu trên đèn, đèn yếu nhấp nháy | ảnh `04`, `04c` | đạt |
| AC46 | Bot thắng Đêm 1 theo luật bình minh và replay được qua CLI | `npm run bot`, `evidence/phase-3/headless/bot-*` | đạt |

## Giả định Phase 3 (A22–A31)

| # | Giả định |
|---|---|
| A22 | Dầu lưu bằng số nguyên 1/60 (`fuel60`); chỉ làm tròn khi xuất snapshot/event. |
| A23 | Bước trừ dầu chạy sau bộ đếm thời gian và trước di chuyển; đèn `fuel <= 0` tắt ngay sau bước đó. |
| A24 | `deposited` là tiến độ của lần thắp kế tiếp; về 0 khi đèn sáng hoặc tắt. |
| A25 | Đèn chưa sáng không có dầu (`fuel: 0`); scenario đặt `lit: true` mà thiếu `fuel` thì được 100. |
| A26 | `successful_lights` chỉ tăng khi thắp mới hoặc thắp lại do người chơi; đèn đặt sẵn không tính. |
| A27 | `capacity` áp dụng ngay sau lần thắp; nhặt đom đóm dừng ở `capacity`. |
| A28 | Bóng Mực `drain` vẫn gây sát thương khi chạm Mây (không bất tử), nhưng đứng yên. |
| A29 | `fuel_drain` phát ở các tick `sim_tick % 60 == 0`, sau khi trừ dầu, cho từng Bóng Mực đang hút. |
| A30 | Thưởng bình minh dùng `floor(fuel)` trên giá trị `fuel60 / 60` chưa làm tròn hiển thị. |
| A31 | Chế độ mù màu chỉ đổi hiển thị, không đổi logic lõi hay output headless. |

## Tiêu chí nghiệm thu Phase 4 (AC47–AC53)

| # | Tiêu chí | Cách kiểm | Trạng thái |
|---|---|---|---|
| AC47 | `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` chạy cảnh chuẩn 1280×720 (200 Bóng Mực, 100 đom, L1–L3 sáng), 3 s khởi động, xuất đủ 10 trường, tự thoát mã 0 | `bench.json`, `evidence/phase-4/`, verify `35` | đạt (217.95 fps / p1 158.77 / load 1230 ms) |
| AC48 | Benchmark tắt sinh thêm, sát thương, nhặt đom, hao dầu, kết thúc Đêm; Bóng Mực vẫn `wander`; không input; camera quỹ đạo 30 m / 15 m / 15 s | `tests/bench-mode.test.ts`, `src/bench/main.ts` | đạt |
| AC49 | Soak 10 Đêm một tiến trình, seed `7+i`, input 30 tick/5%/3%/2%/10%, xuất `soak.json`; crash 0; RSS cuối ≤ 1.2× đầu | `tests/soak.test.ts`, `soak.json`, verify `31` | đạt (0 crash, 56→63 MB) |
| AC50 | Bảng xếp hạng top 10 trên đĩa, tên 3–12 `[A-Za-z0-9_]`, điểm giảm dần, hoà giữ thứ tự, đủ 5 trường, xem từ menu, lưu sau khi mở lại | `tests/leaderboard.test.ts`, `tests/server.test.ts`, `tests/leaderboard-store.test.ts`, ảnh `07`–`09` | đạt |
| AC51 | `--export-leaderboard out.json` xuất `{"entries":[...]}` đúng thứ tự; file hỏng đọc thành rỗng | verify `32`, `33` | đạt |
| AC52 | Đổi phím 9 hành động, báo trùng, khôi phục mặc định, lưu; phụ đề Bóng Mực/gió/10 giây/đèn yếu; giảm chuyển động; chữ ≥ 18 px và tuỳ chọn ×1.25 | `tests/keybinds.test.ts`, `tests/alerts.test.ts`, ảnh `02`–`06` | đạt |
| AC53 | Contract 1.3 có `bench_cmd`, `soak_cmd`; README/CHANGELOG/CREDITS/LICENSE/retro/demo đủ; tag `phase-4` + Release `v1.0.0` | verify `30`, `34`; `git tag`; GitHub Release | đạt (xem EVIDENCE) |

## Giả định Phase 4 (A34–A39)

| # | Giả định |
|---|---|
| A34 | Chế độ benchmark chỉ là cờ trình diễn, mặc định tắt; mọi scenario cũ giữ nguyên output byte-for-byte. |
| A35 | Cảnh benchmark không vẽ HUD DOM; "đầy đủ hiệu ứng và ánh sáng" hiểu là cảnh 3D + `world.update`. |
| A36 | `peak_mem_mb` là tổng RSS cây tiến trình Chromium, lấy mẫu 250 ms; `null` nếu HĐH không có `ps`. |
| A37 | `load_ms` tính từ lúc tiến trình benchmark bắt đầu tới khung hình đầu tiên, sai số polling ≤ 50 ms. |
| A38 | Soak chạy một Đêm khởi động nóng bị bỏ và gọi GC trước cả hai mốc RSS, để loại chi phí biên dịch JIT khỏi phép đo rò rỉ. |
| A39 | Khi phục vụ tĩnh không có API, bảng xếp hạng dùng `localStorage`; khi có `dist-node/app.js`, file `data/leaderboard.json` là nguồn chính. |
