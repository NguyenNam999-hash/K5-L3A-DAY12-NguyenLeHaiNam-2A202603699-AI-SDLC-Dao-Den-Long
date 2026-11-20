# Retro — Đảo Đèn Lồng, bốn phase với AI

Tác giả: Nguyễn Lê Hải Nam (2A202603699) · 2026-11-20 · Bản 1–2 trang

## Điều hiệu quả

**Đặc tả trước, code sau.** Mỗi phase bắt đầu bằng `docs/SPEC.md` và một design doc ngắn. Những chỗ mơ hồ
được ghi thành giả định đánh số (A1–A33). Khi AI đề xuất lệch giả định, tôi có mốc để từ chối ngay thay vì
tranh luận lại từ đầu.

**Hợp đồng bằng số.** `game.contract.json` + `TUNING` + test so khớp biến "AI sửa số ở một nơi" thành lỗi
đỏ trong vài giây. Phase 4 thêm `bench_cmd`/`soak_cmd` theo đúng cơ chế đó.

**Harness nhỏ, rõ.** `AGENTS.md` nêu 13 bất biến và 5 lệnh kiểm chứng. Skill `dao-den-long-contract` nhắc
lại đúng các bất biến ấy trước mỗi lần sửa. Hai thứ này tiết kiệm hơn mọi prompt dài.

**Kiểm chứng bằng ảnh, không bằng lời.** Quy tắc "chạy `scripts/shots.mjs` rồi mở ảnh" bắt được nhiều lỗi
mà test không thấy: chữ 14 px bị cắt, thẻ cài đặt cao hơn màn hình, nhãn kỹ năng xuống dòng.

## Điều không hiệu quả

**Đoán thay vì đo.** Tôi từng tin "200 Bóng Mực sẽ tụt FPS". Đo thật cho 218 fps; thời gian bị đe doạ
không hề mất. Ngược lại, RSS soak tăng 1.38× vì JIT, không phải rò rỉ — phải đo từng Đêm mới thấy.

**Viết test sau khi code.** Với `src/server`, tôi viết test trước nhưng chạy sau khi đã có code. Phải tạm
bỏ hai file để chứng kiến test đỏ rồi mới dám tin. Từ đó quy trình là: test đỏ → code → test xanh, mỗi
lần một mục.

**Sửa CSS bằng mắt ở 1280×720 muộn.** Sàn 18 px làm vỡ layout HUD. Nếu đo cỡ chữ ngay từ phase 2 thì đã
không phải chỉnh lại ba lần.

## AI sai ở đâu và cách phát hiện

| Lần | AI làm sai | Cách phát hiện |
| --- | --- | --- |
| Phase 2 | Bot thắng nhờ đứng trong vùng an toàn, không thắng bằng luật | Chạy `npm run bot`, đọc chuỗi sự kiện; sửa bot chứ không sửa luật |
| Phase 3 | Đèn đặt sẵn bị tính vào `successful_lights` | Snapshot so với contract, test đỏ |
| Phase 3 | Tương tác đèn khác tầng vẫn thành công | Scenario 17, kiểm tra chênh cao |
| Phase 4 | Benchmark đầu tiên không tắt VSync, `avg_fps` đúng 60 | Đọc `frames`/`dt`, thấy trần cứng; thêm cờ và đo lại |
| Phase 4 | `findLast` không có trong lib ES2022, typecheck đỏ | `npm run typecheck` chặn trước khi commit |
| Phase 4 | Gộp `peak_mem_mb` bằng RSS cây tiến trình, số 1.2 GB | Đối chiếu `ps`, ghi rõ cách đo trong BENCHMARK.md thay vì giấu |

Bài học: AI sai thường không phải cú pháp mà là **hiểu sai ý định**. Test theo hành vi và bằng chứng đo
được là thứ bắt lỗi đó.

## Harness nào giúp nhất

1. `AGENTS.md` — 13 bất biến, đặc biệt tick order, XZ, và "không đổi output headless". Giữ AI khỏi phá
   Phase 1–3.
2. Skill `dao-den-long-contract` — nhắc đúng file và lệnh cần chạy sau mỗi loại sửa.
3. `scripts/verify.mjs` — 30 kiểm tra trên CLI đã build; chạy 0.3 s nên không có lý do bỏ qua.
4. Playwright + ảnh chụp — thứ duy nhất bắt lỗi thị giác.
5. Ledger `.superpowers/sdd/.../progress.md` — mỗi task một dòng, kèm "Ruling" cho mọi chỗ lệch kế hoạch.

## Token và chi phí

Ước tính cho cả bốn phase, dùng agent trong terminal:

- Đọc ngữ cảnh + suy luận: ~900k token vào, ~90k token ra.
- Riêng Phase 4: ~300k vào, ~35k ra (nhiều vòng đo benchmark/soak và ảnh).
- Chi phí tương đương khoảng **5–8 USD** ở giá model tầm trung; phase 4 chiếm ~1/3.

Cách tiết kiệm đã dùng: grep trước khi đọc cả file; gom thay đổi rồi chạy test một lần; không dump JSONL
vào ngữ cảnh (`tail`, `grep`); ảnh chỉ chụp trạng thái cần xem; kế hoạch viết một lần thay vì hỏi lại.

## Nếu làm lại

1. Viết sàn cỡ chữ và kiểm tra contrast ngay phase 1, cùng ảnh chụp tự động.
2. Dựng benchmark sớm hơn (phase 2) để mọi thay đổi hiển thị có số đo.
3. Tách `Game` khỏi phần "trình diễn" sớm hơn nữa: `benchmark` flag đáng lẽ có từ đầu.
4. Dùng ledger và design doc ngay từ phase 1; phase 4 mới dùng thì hơi muộn.
5. Đặt ngưỡng soak theo `heapUsed` bên cạnh RSS để phân biệt JIT với rò rỉ ngay từ đầu.
