# Thiết kế Phase 2 — "Ba hòn đảo"

Nguồn: `docs/phase/PHASE-2.md` (Contract v1.1). Tài liệu này chốt cách làm, các quyết định còn mở và
giả định kỹ thuật. Sau khi được duyệt, `docs/SPEC.md` sẽ được cập nhật theo tài liệu này.

## Ý định

Giữ nguyên kiến trúc "một lõi tất định, hai vỏ (headless + Three.js)" của Phase 1, nhưng thay toàn bộ
số liệu bằng chuẩn v1.1, thêm Đêm 2/Đêm 3, Lướt, Bùa Gió, Gió Lạc, gió mạnh, rơi khỏi đảo, tạm dừng
và chiến dịch 3 Đêm. Đầu ra headless phải đúng Contract v1.1 và giữ tính tất định theo seed.

## Mục tiêu

- Tuning và bản đồ khớp Phần 1–2 của PHASE-2.
- `--night` nhận 1, 2, 3; snapshot/event/scenario/input đúng Phần 4.
- Ba Đêm chơi được liên tiếp trong trình duyệt, có menu, giới thiệu Đêm, tạm dừng, cài đặt lưu bền,
  HUD đầy đủ, âm thanh, màn Bình Minh.
- Mỗi tính năng mới có ít nhất một scenario headless + unit test.
- Chạy một Đêm đầy đủ ≤ 30 s trong headless; UI ≥ 30 FPS ở 1280×720.

## Không làm

- Không thêm asset ngoài; mọi mô hình/âm thanh vẫn sinh bằng code.
- Không đổi định dạng JSONL cũ ngoài các trường Contract v1.1 yêu cầu.
- Không dùng `Math.random`/`Date` trong `src/core/**`.

## Cách tiếp cận

Đã cân nhắc:

1. **Viết lại lõi từ đầu** — sạch nhưng bỏ phí các bất biến tick/scenario/JSONL đang chạy đúng, rủi ro
   regression cao. Loại.
2. **Tách mỗi Đêm thành một lớp `Game` riêng** — dễ đọc nhưng nhân ba logic va chạm/điểm/sự kiện, dễ
   lệch hành vi. Loại.
3. **Mở rộng `Game` hiện tại, đưa dữ liệu bản đồ vào module cấu hình thuần** — chọn cách này.

Cấu trúc sau thay đổi:

```
src/core/tuning.ts        số liệu contract v1.1 + hằng số vật lý ngoài contract
src/core/nights.ts        dữ liệu 3 Đêm: đảo, cầu, tầng, dốc, bục nhảy, đèn, điểm sinh, gió
src/core/terrain.ts       groundHeight/isSolid/insideMap thuần, không phụ thuộc Game
src/core/game.ts          tick order v1.1, player/shade/drifter/charm/wind
src/core/types.ts         snapshot/event/input v1.1
src/core/scenario.ts      scenario v1.1, vẫn đọc được scenario v1.0
src/core/parse.ts         validate scenario/inputs mới, lỗi → FormatError
src/core/input-track.ts   thêm dash/pause
src/headless/run.ts       --night 1|2|3, duration theo Đêm
src/render/*              world dựng theo Đêm, campaign/menu/pause/settings/HUD/audio mới
```

## Quyết định kỹ thuật

### 1. Bản đồ và độ cao

`terrain.ts` trả về `groundHeight(x, z): number | null` (`null` = biển mây) và `solid(x, y, z)` cho
tháp chuông. Mỗi Đêm là một `NightMap` trong `nights.ts`.

- Đêm 1: đĩa bán kính 40 m, `y = 0`; ngoài 40 m là `null`.
- Đêm 2: hai đĩa bán kính 28 m tâm `(0,0)` và `(70,0)`; cầu chữ nhật `x ∈ [26,44]`, `z ∈ [-2,2]`;
  ngoài các vùng đó là `null`. Bục nhảy là vùng tròn bán kính 1 m.
- Đêm 3: đĩa bán kính 45 m; tầng 0 `y=0`; vành khăn `12 ≤ r ≤ 24`, `z > 0` là `y=3`; đĩa `r ≤ 8` là
  `y=6`; hai dốc góc 30°/150°, rộng 3 m, `r ∈ [24,30]`, cao tuyến tính 0→3; tháp chuông `r ≤ 2`
  trên tầng 2 là vật cản đứng.

Đi lên mặt cao hơn 0.5 m bị chặn (vách đứng); đi ra khỏi mép thì rơi xuống mặt thấp hơn. Rơi khỏi
bản đồ là `y < -10`.

### 2. Vật lý người chơi

- Gia tốc mặt đất `60 m/s²` (đạt 6 m/s trong 0.1 s), giảm tốc cùng độ lớn.
- Trên không: hệ số điều khiển `0.4`, không đổi hướng phóng bục nhảy.
- Nhảy: `vy = 7`, `g = 20`, chỉ khi `grounded`.
- Lướt: 14 m/s theo hướng đang di chuyển, nếu đứng yên thì hướng mặt; 12 tick; hồi chiêu 1.5 s tính
  từ lúc bắt đầu; trên không giữ nguyên `y`; không bất tử; nhấn lại khi đang lướt bị bỏ qua.
- Bục nhảy: chạm bục khi đang đứng trên đó → đặt `vy` và vận tốc ngang theo PHASE-2, giữ tới khi chạm
  đất; phím di chuyển không ghi đè vận tốc ngang này (lướt vẫn được).
- Hướng mặt: hướng di chuyển khác 0 gần nhất; nếu chưa từng di chuyển thì `cam_yaw_deg` (mặc định +Z).

### 3. Đom đóm, đèn, điểm

- 20 đom đóm đầu tại 20 điểm sinh khác nhau do RNG chọn; trần 30; tick 240, 480, … sinh 1 con tại
  điểm trống nếu dưới trần.
- Đom đóm rơi có `kind = "dropped"`, TTL 480 tick, nhặt được từ tick sau, không tính vào trần sinh.
- Nhặt: XZ ≤ 1.0 m **và** `|py − groundHeight(mote)| ≤ 1.5`; đầy 10 thì không nhặt.
- Đèn: nạp `min(đang mang, còn thiếu)` khi bấm `E` trong 2.0 m (dùng khoảng cách 3D tới tâm đèn để
  tầng không bị nạp nhầm); chọn đèn chưa sáng gần nhất, hòa thì id nhỏ hơn.
- Điểm: +10 mỗi đom đóm **nạp vào đèn**, +100 mỗi đèn, +5 mỗi Bóng Mực trúng mỗi lần Tỏa Sáng (kể cả
  đang choáng), thắng: `floor(giây còn lại) × 2 + 50 × lửa còn lại`.

### 4. Bóng Mực

- Trạng thái đúng tên: `spawning` → `wander` → `chase` → `recoil` → `stunned`.
- Sinh 2 con ở tick 300, sau đó 1 con mỗi 7 s (Đêm 2) / 6 s (Đêm 3) / 8 s (Đêm 1), trần 6/8/10.
- `spawning` 30 tick không sát thương; `wander` lang thang 2 m/s; phát hiện 12 m → `chase` 4.0 m/s
  (Đêm 3: 4.5); xa 18 m → `wander`.
- Chạm: XZ ≤ 1.0 và chênh cao ≤ 1.5; tối đa 1 lần mất lửa mỗi tick; bóng bị đẩy lùi 2 m trong 60 tick.
- Tỏa Sáng: tâm `py + 0.8`, bán kính 3D 5 m; choáng 120 tick; 15 tick đầu đẩy lùi tổng 4 m; làm mới
  khi trúng lại; không chết.
- Vùng an toàn: bán kính 6 m quanh đèn sáng, chỉ tính khi cùng tầng (`|Δy| ≤ 2`); bóng vào trong bị
  đẩy ra mép trong tối đa 30 tick và không gây sát thương trong lúc đó.

### 5. Gió Lạc, Bùa Gió, gió mạnh

- Gió Lạc chỉ Đêm 2/3; `idle` 2 m/s → `chase` khi mang ≥ 5 và cách ≤ 15 m → `flee` sau khi cướp
  `min(3, mang)`; `flee` 7 m/s xa Mây 240 tick rồi biến mất. Mỗi con cướp 1 lần.
- Tỏa Sáng trúng Gió Lạc `chase` → `flee` không cướp; trúng `flee` đang mang đồ → thả toàn bộ thành
  đom đóm rơi, biến mất sau 120 tick. Không mất lửa; bỏ qua vùng an toàn và bất tử.
- Bùa Gió: nhặt như đom đóm; 600 tick; tốc độ 7.2; Lướt không hồi chiêu; xuất hiện lại sau 2700 tick.
- Gió mạnh Đêm 3: chu kỳ 30 s, kéo dài 5 s, cảnh báo 2 s trước, hướng RNG mỗi cơn, đẩy 2 m/s.

### 6. Tạm dừng và input

- `dash` và `pause` kích hoạt khi `false → true`.
- Khi tạm dừng: tick tăng, `sim_tick`/thời gian/hồi chiêu/spawn/TTL đứng yên, snapshot `state:
  "paused"`, phát `paused`/`resumed` đúng một lần mỗi chuyển trạng thái.
- Input track vẫn cập nhật `pause` trong lúc dừng để bắt được chuyển `true → false → true`.

### 7. Snapshot, event, scenario

- Snapshot gốc thêm `night`, `wind {active, dir_deg}`.
- `player` thêm `vel [vx,vy,vz]`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`.
- `motes` thành `{id,pos,kind,ttl_s}`; thêm `drifters {id,pos,state,stolen}` và
  `charms {id,available,respawn_s}`.
- Event mới đúng tên: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`,
  `paused`, `resumed`; `player_hit` khi rơi có thêm `lost`.
- Scenario đọc thêm `player.invuln_ticks/dash_cd_ticks/pulse_cd_ticks/charm_ticks`,
  `shades[].state/state_ticks_left`, `drifters`, `charms`, `random_drifters`, `wind_enabled`.
  Scenario v1.0 vẫn đọc được; mảng `drifters`/`charms` thay danh sách mặc định.
- `night_start` phát ở tick 1 để mọi event đều có tick ≥ 1.

### 8. Trình duyệt

- `Campaign` giữ Đêm hiện tại, điểm từng Đêm, tổng điểm; menu chính → giới thiệu (tên đảo, lời Ông
  Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh.
- `paused` dùng phím `Esc`/`P`; menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu.
- Cài đặt: âm lượng, độ nhạy chuột, lưu `localStorage`; độ khó Phase 1 vẫn giữ như tuỳ chọn UI.
- HUD: lửa, đồng hồ mm:ss (đỏ nhấp nháy ≤ 30 s), đèn k/n + điểm, thanh 10 ô, hồi chiêu Lướt/Tỏa
  Sáng, nhắc `E — Nạp ánh sáng (x/10)`, mũi tên chỉ đèn ngoài màn hình.
- Bảng màu đúng Phần 3.8; ambient `0.15 + 0.55 × đèn sáng / tổng`.
- World dựng theo `nights.ts`: cầu tre, hai đảo, ba tầng, dốc, bục nhảy, tháp chuông, Gió Lạc, Bùa
  Gió, lá báo gió; dọn tài nguyên khi đổi Đêm.
- Âm thanh: nhạc nền đêm + hiệu ứng nhặt/thắp/tỏa/bị đánh/nhảy/lướt/thắng/thua/Bóng Mực xuất
  hiện/đếm ngược 10 s.

## Giả định (A13–A20)

| # | Giả định |
|---|---|
| A13 | "Mỗi đom đóm nạp" tính điểm lúc nạp vào đèn, không phải lúc nhặt. |
| A14 | Hướng mặt ban đầu = `cam_yaw_deg`; sau đó là hướng di chuyển khác 0 gần nhất. |
| A15 | Điều khiển trên không = 40% gia tốc mặt đất; lướt trên không khoá `y` trong 12 tick. |
| A16 | Bóng Mực có tâm ở `groundHeight + 1.0`; Gió Lạc ở `groundHeight + 1.6`. |
| A17 | Vùng an toàn và phát hiện Bóng Mực dùng XZ; chỉ chặn khi cùng tầng (`|Δy| ≤ 2`). |
| A18 | `spawning` 30 tick, `wander` 2 m/s; recoil 60 tick đẩy 2 m. |
| A19 | Gió mạnh bắt đầu ở giây 30, 60, …; cảnh báo từ giây 28; hướng RNG mỗi cơn. |
| A20 | `fall_enabled` giữ trong contract với giá trị `true`; ngoài contract, hằng số vật lý nằm ở `tuning.ts` nhưng không đưa vào `game.contract.json`. |

## Kiểm chứng

- `npm test`: unit test lõi + contract + headless; mỗi tính năng mới có test riêng.
- `npm run verify`: chạy CLI đã build cho cả 3 Đêm, kiểm tra shape v1.1, event mới, tất định byte,
  hiệu năng ≤ 30 s/Đêm.
- `npm run bot`: bot thắng Đêm 1 với số v1.1, ghi inputs vào `evidence/phase-2/`.
- `node scripts/shots.mjs`: ảnh menu/Đêm 1/Đêm 2/Đêm 3/tạm dừng/cài đặt/Bình Minh, lưu
  `evidence/phase-2/ui/` và được xem bằng mắt.
- `docs/EVIDENCE.md`, `README.md`, `AGENTS.md`, `docs/SPEC.md` cập nhật; lịch sử git có commit riêng
  cho tài liệu/harness.

## Việc để người duyệt quyết

Không còn câu hỏi chặn. Ba điểm dưới đây là **đề xuất**, có thể sửa trước khi code:

1. Điểm đom đóm tính lúc **nạp** (A13) — đúng chữ "nạp" của Contract v1.1.
2. Tương tác đèn dùng khoảng cách **3D** để tầng không bị nạp nhầm.
3. Giữ khóa `fall_enabled` trong contract (giá trị `true`) để không phá scenario/kiểm tra cũ.
