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
