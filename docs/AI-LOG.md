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
