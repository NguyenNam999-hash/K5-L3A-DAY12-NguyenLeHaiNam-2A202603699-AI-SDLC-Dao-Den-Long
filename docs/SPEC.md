# Spec Phase 1 — Đảo Đèn Lồng

Nguồn: `PHASE-1.md` (PRD-0 + Test Contract v1.0). Tài liệu này chốt tiêu chí nghiệm thu và giả định.
Mọi giả định đánh số A1–A12 khớp với README.

## Mục tiêu

Một màn 3D chơi được từ đầu tới thắng hoặc thua, cộng chế độ headless tất định để chấm tự động.

## Tiêu chí nghiệm thu

| # | Yêu cầu | Cách kiểm chứng | Trạng thái |
|---|---|---|---|
| AC1 | Có 5 Đèn Lồng Lớn, thắp đủ thì thắng | `tests/scenarios/06-win.json` + unit test "wins when the last lantern is lit" | đạt |
| AC2 | Nhân vật đi lại, nhảy, camera 3D góc nhìn thứ ba | Ảnh `evidence/phase-1/ui/02-gameplay.png`; test movement/jump | đạt |
| AC3 | Đom đóm rải rác, nhặt được, có giới hạn mang theo | Scenario 02 + test pickup/capacity | đạt |
| AC4 | Nạp ánh sáng vào đèn, thắp khi đủ 3 | Scenario 03 + test deposit | đạt |
| AC5 | Bóng Mực sinh ra, đuổi người chơi, chạm thì mất lửa | Scenario 05 + test chase/hit | đạt |
| AC6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | Scenario 04 + test pulse (cost, cooldown, stun, push) | đạt |
| AC7 | HUD hiển thị lửa, ánh sáng, đèn, thời gian, điểm, gợi ý | Ảnh UI 02/03 | đạt |
| AC8 | Thắng/thua có màn kết quả và chơi lại được | Ảnh `04-win-overlay.png`; nút "Chơi lại" tạo ván mới | đạt (chơi lại bằng thao tác tay, không có test tự động) |
| AC9 | `game.contract.json` đúng schema, tuning khớp game | `tests/contract.test.ts` | đạt |
| AC10 | Headless đúng tham số, tick model, JSONL 3 loại bản ghi | `scripts/verify.mjs` (10 kiểm tra) | đạt |
| AC11 | Lỗi định dạng scenario/inputs thoát mã 2 | verify case 08 + unit test headless | đạt |
| AC12 | Tất định: cùng seed/scenario/inputs ra cùng output | verify case 09 so sánh byte | đạt |
| AC13 | Chơi hết Đêm 1 tới thắng được | Bot thắng ở tick 5 282; replay qua CLI chính thức | đạt |
| AC14 | Cài và chạy tối đa 3 lệnh | `npm ci && npm run build && npm run dev` | đạt |

## Quyết định thiết kế

1. **Tách lõi khỏi hiển thị.** `src/core/game.ts` không import DOM hay Three.js. Renderer chỉ đọc trạng thái và
   gọi `step()` ở tần số cố định 60 Hz, nên hành vi headless và có giao diện giống nhau.
2. **Một nguồn số liệu.** `src/core/tuning.ts` là nguồn duy nhất; `game.contract.json` phải khớp (test chặn lệch).
3. **RNG có seed** (mulberry32) cho sinh đom đóm/Bóng Mực và mọi id, đảm bảo tất định.
4. **Va chạm theo mặt phẳng XZ** đúng contract; độ cao chỉ để hiển thị.
5. **Không có rơi khỏi đảo** (`fall_enabled = false`) để giảm bề mặt lỗi; mép đảo là hàng rào mềm bán kính 34 m.

## Mô hình tick (đã cài đúng contract)

- Snapshot tick 0 sau khi dựng scenario, trước input.
- Bước `k` đọc input tick `k`, tạo trạng thái `k+1`; sự kiện ghi `tick = k + 1`.
- `--ticks N` chạy đúng N bước trừ khi game kết thúc sớm.
- `time_left_s = duration − steps / 60`.
- Hành động `jump`/`interact`/`pulse` kích hoạt khi false → true.

## Ngoài phạm vi Phase 1

Nhiều đêm, nhiệm vụ phụ, câu chuyện theo tiến trình, Bóng Mực nhiều loại, đom đóm nhiều loại, dash.
Không có phần nào trong số này ảnh hưởng đầu ra headless.
