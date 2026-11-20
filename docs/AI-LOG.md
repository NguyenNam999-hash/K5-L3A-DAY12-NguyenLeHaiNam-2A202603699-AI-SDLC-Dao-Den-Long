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
