# Nhật ký dùng AI — Phase 1

Công cụ: OpenCode (agent) + model DeepSeek V4.1 Flash, một phiên chính. Harness: `AGENTS.md` trong repo này.

## Cách làm

1. Đọc `README.md`, `PHASE-1.md` (PRD-0 + Test Contract), `Đề-xuất-công-nghệ.md`, `GUIDE.md`, `CHECKPOINTS.md`.
2. Chốt công nghệ theo đề xuất có sẵn: TypeScript + Three.js + Vite + Vitest, lõi game tách khỏi renderer.
3. Viết `docs/SPEC.md` (tiêu chí nghiệm thu + giả định A1–A12) **trước** khi viết code.
4. Viết lõi + CLI headless + test trước, chạy test tới khi xanh.
5. Viết renderer, chụp ảnh bằng Playwright, chỉnh ánh sáng dựa trên ảnh thật.
6. Kiểm chứng bằng `verify.mjs` và bot chơi tự động; lưu toàn bộ bằng chứng vào `evidence/`.
7. Viết README, EVIDENCE, CREDITS; commit nhỏ; gắn tag `phase-1`.

## AI làm gì, tôi làm gì

| Việc | Ai làm |
|---|---|
| Bóc yêu cầu bắt buộc khỏi PRD mơ hồ, chọn giả định | tôi chốt, agent đề xuất |
| Thiết kế kiến trúc lõi/headless/renderer | agent đề xuất, tôi duyệt |
| Code lõi, CLI, test, renderer | agent viết |
| Quyết định con số tuning và luật chơi còn mơ hồ | tôi chốt (A1–A12) |
| Chạy test, chạy CLI, chụp ảnh, đọc output | tôi chạy và đọc |
| Phát hiện lỗi và yêu cầu sửa | tôi |

## Lỗi AI đã mắc và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| `as const` làm `TUNING.flames` thành kiểu literal `3`, gán số bị lỗi type | `tsc --noEmit` | bỏ `as const` |
| Còn dòng gán biến không tồn tại `syncLanternsInitial = …` | đọc diff + typecheck | xoá |
| Bot đặt `MAX_TICKS = 4800` (80 s) trong khi đêm dài 300 s → "thua" sai | đọc `bot-summary.json` thấy `time_left_s: 220` | đổi 18 000 tick |
| Test thắng dựng scenario cả 5 đèn đã sáng nên không có đèn nào để thắp | test đỏ | sửa scenario còn 1 đèn chưa sáng |
| Sinh Bóng Mực ban đầu cách người chơi 18 m → người đứng yên chết sau 9 s | đọc `11-full-night.jsonl` | đẩy spawn ban đầu ra 24–32 m |
| Thưởng thời gian cộng cả khi thua → đứng yên 9 s được 1 455 điểm | đọc output headless | chỉ cộng thưởng thời gian khi thắng |
| CSS `.overlay { display: grid }` đè `[hidden]` → nút Bắt đầu bị chặn click | Playwright timeout + thông báo "subtree intercepts pointer events" | thêm `[hidden] { display: none !important }` |
| Cảnh quá tối, nhân vật thành bóng đen | xem ảnh chụp đầu tiên | tăng ambient/moon, đèn cầm tay, thêm rim light, giảm vignette |
| Đèn cầm tay đặt trong thân nhân vật làm mặt trước tối | xem ảnh | dời đèn lên trên và ra trước |

## Harness đã chỉnh

- Thêm `AGENTS.md` ngắn với lệnh build/test/verify và các bất biến (tick 60 Hz, tuning một nguồn, headless không import renderer).
- Thêm `scripts/verify.mjs`: biến contract thành kiểm tra chạy được, thay vì dựa vào việc agent nhớ.
- Thêm `scripts/bot.ts` + `npm run bot`: kiểm tra "chơi được tới thắng" tự động, không phụ thuộc đánh giá cảm tính.
- Thêm `scripts/shots.mjs`: chụp ảnh UI và bắt lỗi console/404, vì lỗi giao diện không hiện trong unit test.

## Token và chi phí (ước tính)

Không có công cụ đo token trong phiên, nên đây là ước tính thô:

- Tổng ngữ cảnh tích luỹ (đọc tài liệu + code + output test/JSONL): khoảng **90k–130k token đầu vào**.
- Đầu ra (code, test, tài liệu): khoảng **25k–35k token**.
- Chi phí ước tính: dưới **0,5 USD** ở mức giá của model dùng thử; nếu tính theo gói thì khoảng 1 phiên.

Cách tiết kiệm đã dùng:

- Viết spec + tiêu chí nghiệm thu trước, nên không phải viết lại kiến trúc.
- Test và verify chạy sớm, lỗi lộ ra từ output chứ không phải từ suy đoán.
- Dùng scenario cố định thay vì chơi tay để kiểm tra luật.
- Không đưa toàn bộ file vào ngữ cảnh khi chỉ cần một phần (dùng grep/đọc theo dòng).

## Retro

- **Hiệu quả**: tách lõi khỏi renderer và viết test trước giúp mọi thay đổi đồ hoạ về sau không làm sai contract.
- **Chưa tốt**: hai vòng lặp chỉnh sáng/ánh sáng tốn thời gian; lẽ ra nên chụp ảnh sớm hơn nữa.
- **Nếu làm lại**: dựng `verify.mjs` ngay sau khi có CLI, trước khi viết renderer; đặt giới hạn thời gian cho phần làm đẹp.
- **Bài học**: "agent bảo chạy rồi" không đủ; mọi tuyên bố trong README đều có file bằng chứng tương ứng.

---

# Nhật ký Phase 2 — "Ba hòn đảo"

## Cách làm

1. Đọc `README.md`, `docs/phase/PHASE-2.md`, toàn bộ lõi + renderer Phase 1.
2. Dùng skill `brainstorming`: viết thiết kế `docs/superpowers/specs/2026-11-20-phase-2-design.md`,
   chốt ba điểm mơ hồ (điểm lúc nạp, tương tác đèn theo tầng, giữ `fall_enabled`).
3. Dùng skill `writing-plans`: kế hoạch `docs/superpowers/plans/2026-11-20-phase-2.md`, 11 task.
4. Thực thi native: contract + lõi → headless + test → renderer/chiến dịch → bot → bằng chứng → tài liệu.

## Thay đổi lớn

- `TUNING` thay toàn bộ bằng số v1.1; tách `PHYSICS` cho hằng số ngoài contract.
- Thêm `nights.ts` (dữ liệu ba Đêm) và `terrain.ts` (độ cao/va chạm thuần).
- Viết lại `Game.step()` theo 12 bước của PHASE-2: tạm dừng, gió, lướt, bục nhảy, rơi, đom rơi TTL,
  Bóng Mực 5 trạng thái, Gió Lạc, Bùa Gió.
- Snapshot/event/scenario/input lên v1.1; `night_start` phát tick 1.
- Renderer thành chiến dịch 3 Đêm: menu, giới thiệu, tạm dừng, cài đặt lưu bền, Bình Minh; world dựng
  theo Đêm; HUD đầy đủ; nhạc nền procedural; mini-map v1.1.
- `verify.mjs` lên 24 case, gồm Đêm 2/3, tất định và hiệu năng.
- Bot v1.1 dùng trường thế (hút mục tiêu, đẩy mọi Bóng Mực gần), nạp mỗi 5 đom đóm; thắng Đêm 1.

## Lỗi phát hiện và sửa

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| `Hud` truy vấn `#menu-btn` trong khi HTML đặt `#to-menu-btn` → app trắng | Playwright `pageerror` | đổi selector |
| Trọng lực trừ hai lần khi lướt trên không | test "air dash keeps height" đỏ | chỉ trừ khi hết dash |
| Đẩy pulse cộng dồn `4/15 × pushTicksLeft` → 32 m | đọc vị trí Bóng Mực sau 15 tick | đẩy cố định `4/15` mỗi tick |
| Nhiều Bóng Mực cùng chạm trong một tick → mất nhiều lửa | test "một hit mỗi tick" | dừng vòng lặp khi đã bất tử |
| Bot pulse khi Bóng Mực ở 6 m nhưng bán kính chỉ 5 → tốn 3 đom mà không trúng | log `pulse stunned_ids: []` | hạ ngưỡng xuống 4.8 m |
| Bot chạy vòng quanh vành đảo, Bóng Mực đón đầu | log vị trí mỗi 120 tick | trường thế + chạy thẳng ra xa khi < 5 m |
| Camera tụt vào vách tầng 3, màn hình đen | xem ảnh `09-night3` lần đầu | kiểm tra độ cao dọc tia camera, kéo camera lại gần |
| Vách/tầng Đêm 3 gần như đen | xem ảnh | thêm emissive nhẹ, tăng hemisphere/directional, đổi màu đá |
| Nạp đèn dùng khoảng cách 3D làm hụt bán kính 2 m trên cùng tầng | rà lại contract + test biên | XZ 2.0 m + chênh cao ≤ 1.5 m |
| `validation.ts` ném `Error` thường nên test parse không bắt được `FormatError` | test parse đỏ | dùng chung `FormatError` |

## Harness đã chỉnh

- `AGENTS.md`: thêm bất biến v1.1 (3 Đêm, tầng, lướt, rơi, tạm dừng), lệnh `typecheck`, bản đồ file mới.
- `docs/SPEC.md`: bảng AC1–AC28 cho từng mục Phần 3; giả định A1–A12 mới.
- `docs/superpowers/specs/`: thiết kế Phase 2; `docs/superpowers/plans/`: kế hoạch 11 task.
- `scripts/verify.mjs`: 24 case, kiểm tra shape v1.1 và hiệu năng.
- `scripts/bot.ts`: bot v1.1 thắng Đêm 1, ghi bằng chứng phase-2.
- `scripts/shots.mjs`: chụp 10 ảnh phase-2 ở 1280×720, in FPS và kiểm tra tick đứng yên khi tạm dừng.

## Token và chi phí (ước tính)

- Đầu vào tích luỹ: khoảng **150k–220k token** (đọc spec, code cũ, output test/verify/ảnh).
- Đầu ra: khoảng **40k–55k token** (code, test, tài liệu).
- Chi phí ước tính: dưới **1 USD** ở mức giá model dùng thử.

## Retro Phase 2

- **Hiệu quả**: giữ một lớp `Game`, đưa bản đồ vào dữ liệu; nhờ vậy ba Đêm dùng chung luật và test.
- **Chưa tốt**: chỉnh sáng/địa hình Đêm 3 mất vài vòng ảnh; lẽ ra nên dựng camera cao + đèn mẫu trước.
- **Nếu làm lại**: viết test địa hình + tick order trước cả renderer; đặt ngân sách thời gian cho phần nhìn.
- **Bài học**: log ngắn trong bot (vị trí, threat, pulse) rẻ hơn nhiều so với đoán vì sao bot thua.

---

# Nhật ký Phase 3 — "Đèn cạn dầu" (Contract v1.2)

## Cách làm

1. Đọc `README.md`, `docs/phase/PHASE-3.md`, toàn bộ lõi `src/core`, headless, test và các màn render.
2. Viết ADR trước khi sửa luật: chốt mô hình `fuel60` số nguyên, thứ tự trừ dầu, ngưỡng an toàn,
   trạng thái `drain` và luật bình minh.
3. Sửa `tuning.ts` + `game.contract.json` cùng lúc, rồi mới sửa `game.ts`.
4. Cập nhật test cũ bị luật mới làm sai; thêm test cho dầu, châm dầu, thắp lại, hút dầu, sức chứa,
   bình minh và mù màu.
5. Mở rộng `verify.mjs` lên 29 case, thêm scenario `25`–`29` và chuyển bằng chứng sang `evidence/phase-3/`.
6. Viết lại bot theo chiến lược pre-fill 3 đèn rồi thắp trong 90 giây cuối.
7. Cập nhật renderer: thanh dầu, nhấp nháy, giấy rách, bảng màu mù màu, HUD sức chứa, màn kết quả.
8. Chạy test, typecheck, build, verify, bot, replay, shots; đọc ảnh trước khi tuyên bố xong.

## Lỗi phát hiện và sửa

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Dầu dùng số thực sẽ lệch sau 14 400 tick | tính tay 1/60 + yêu cầu tất định | lưu `fuel60` nguyên, chỉ chia khi xuất |
| Châm dầu ở tick 1 cần thêm 1 đom do dầu đã hao trước khi tương tác | test refuel đỏ | giữ đúng thứ tự Ticket (trừ dầu trước), sửa kỳ vọng test thành `ceil` tại thời điểm chọn |
| Test "đèn đầy dầu không chọn" không dựng được trạng thái đầy sau 1 tick | test đỏ | bỏ test không khả thi, kiểm tra bằng nhánh `used = 0` và test châm một phần |
| Vùng an toàn đúng 30 bị mất sau 1 tick | test biên đỏ | kiểm tra tại snapshot tick 0 thay vì sau 5 tick |
| Bot cũ thắng bằng `all_lit` nên không còn đúng | `npm run bot` exit 1 | viết lại bot theo pre-fill + thắp cuối |
| Bot đứng yên ở đèn vì "carried 0" vẫn chọn đèn | log `t=...` cho thấy vị trí không đổi | chỉ chọn đèn khi đang mang đom |
| Bot nạp 1 đom rồi quay lại liên tục | log vị trí + carried | đặt ngưỡng chuyến 5 đom |
| Bot phân tán tiến độ sang 5 đèn | log `interact` | ghim mục tiêu tới khi đèn sáng |
| Bot bỏ đèn đang cần thắp để châm đèn khác | dòng `lantern_out` sát bình minh | tắt châm dầu khi chưa đủ 3 đèn |
| Bot lao vào Bóng Mực khi đang "pressing" | 3 lần `player_hit` trong 177 s | cho né khi Bóng Mực < 2.3 m, bật Tỏa Sáng < 3 m |
| Bot thắp đèn quá sớm nên cháy hết trước bình minh | log `lantern_out` | chỉ thắp trong 90 giây cuối, ưu tiên 3/5 |
| HUD hiện 10 ô dù sức chứa tăng | xem ảnh Night 1 sau khi thắp | `ensureCarryCells(game.capacity)` |
| Đèn tắt vẫn vẽ vùng an toàn trên mini-map | so ảnh với luật mới | chỉ vẽ khi `fuel >= 30` |

## Harness đã chỉnh

- `docs/SPEC.md`: thêm AC29–AC46 và giả định A22–A33.
- `docs/adr/0001-lantern-fuel-and-dawn.md`: quyết định thiết kế.
- `docs/CHANGELOG.md`: breaking changes Phase 3.
- `scripts/verify.mjs`: 29 case, output `evidence/phase-3/headless/`.
- `scripts/bot.ts`: bot v1.2 pre-fill, thắng tick 14 400.
- `scripts/shots.mjs`: 17 ảnh phase-3, thêm ảnh dầu thấp, cận cảnh thanh dầu, mù màu.
- `README.md`: luật, số liệu, điểm, lệnh và đường dẫn bằng chứng mới.

## Token và chi phí (ước tính)

- Đầu vào tích luỹ: khoảng **260k–340k token** (đọc lõi 1 200 dòng, renderer, test, tài liệu, log bot).
- Đầu ra: khoảng **55k–70k token** (code, test, 4 tài liệu, log).
- Chi phí ước tính: dưới **1.5 USD** ở mức giá model dùng thử.

## Retro Phase 3

- **Hiệu quả**: sửa lõi trước, chạy test ngay; nhờ vậy 7 test đỏ lộ ra trong một lần chạy thay vì sửa mò.
- **Chưa tốt**: bot mất nhiều vòng vì vừa phải học luật mới vừa phải né Bóng Mực; lẽ ra nên dựng
  biểu đồ trạng thái (thời điểm thắp, dầu, số lần bị đánh) trước khi chỉnh tham số.
- **Nếu làm lại**: viết bot "pre-fill rồi thắp cuối" ngay từ đầu, và đặt test cho luật thắng trước renderer.
- **Bài học**: log ngắn có mốc tick rẻ hơn đoán; ảnh chụp cận cảnh mới thấy thanh dầu, ảnh toàn cảnh thì không.

## Retro Phase 4

Phase 4 dùng skill `brainstorming` → design doc → `writing-plans` → `executing-plans` (native), cùng
skill `dao-den-long-contract`. Ledger ghi 12 task và 9 "Ruling" cho các chỗ lệch kế hoạch.

- **Đo trước khi tối ưu:** benchmark thật cho 218 fps; không phải gộp draw call.
- **Hai lỗi tự tạo:** (1) test rò rỉ RSS 1.38× do JIT, sửa bằng Đêm khởi động nóng + GC; (2) `findLast`
  không có trong ES2022, typecheck bắt.
- **Một vi phạm TDD:** viết test server trước nhưng chạy sau khi có code; đã tạm bỏ file để xác nhận đỏ,
  ghi vào retro.
- **Harness hiệu quả nhất:** `AGENTS.md` (13 bất biến), skill contract, `verify.mjs`, ảnh Playwright.
- Chi tiết đầy đủ và ước tính token: [RETRO.md](RETRO.md).
