# Changelog

## Phase 3 — "Đèn cạn dầu" (Contract v1.2)

Phá vỡ tương thích so với Contract v1.1. Danh sách dưới đây là các thay đổi khiến output headless,
scenario, snapshot, event hoặc điểm số cũ không còn đúng.

### Luật chơi

- **Đèn có nhiên liệu.** Đèn sáng tiêu hao 1 đơn vị dầu/giây, tối đa 100. Đèn cạn dầu tắt và mất
  tiến độ nạp (`deposited = 0`).
- **Châm dầu.** Tương tác với đèn đang sáng để nạp thêm; `used = min(đang mang, ceil((100 − fuel) / 10))`.
- **Thắp lại.** Đèn đã từng sáng chỉ cần 5 đom đóm thay vì 10.
- **Bóng Mực hút dầu.** Trạng thái mới `drain`: đứng cách đèn yếu (`fuel < 30`) ≤ 2 m và hút
  5 dầu/giây. Đèn yếu mất vùng an toàn; đúng 30 vẫn còn.
- **Không còn thắng sớm.** Thắp đủ đèn không kết thúc Đêm.
- **Thắng lúc bình minh.** Hết giờ với số đèn sáng ≥ `ceil(0.6 × tổng)`; lý do mới `dawn_survived`.
- **Sức chứa tăng.** `capacity = min(20, 10 + 2 × successful_lights)`.

### Số liệu

- `contract_version` từ `1.1` lên `1.2`.
- `night1_duration_s` 300 → **240**; `night2_duration_s` 330 → **270**; `night3_duration_s` 360 → **300**.
- Thêm tuning: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`,
  `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- Bảng `score` đổi hoàn toàn: bỏ `per_lantern`, `per_second_left`; thêm `per_first_light`,
  `per_relight`, `per_drain_stun`, `per_dawn_lantern`; `per_mote` 10 → 5.

### Snapshot

- Mỗi đèn thêm `fuel` (một chữ số thập phân), `ever_lit`, `relit_count`. Đèn tắt có `fuel: 0`.
- `player.capacity`.
- `shades[].state` có thêm `drain`.

### Scenario

- Đèn nhận `lit`, `fuel`, `ever_lit`. Đèn `lit: true` không có `fuel` mặc định 100.
- `player.successful_lights`.
- `shades[].target_lantern_id`.

### Event

- Mới: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`,
  `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick khi đang hút).
- `lantern_lit` thêm `relight: true|false`.
- `game_over.reason` thêm `dawn_survived`; bỏ `all_lit`.

### Công cụ và bằng chứng

- `scripts/verify.mjs` chuyển sang `evidence/phase-3/headless/`, thêm case `25–29`.
- Bot viết lại cho luật bình minh: pre-fill 3 đèn, thắp trong 90 giây cuối, thắng Đêm 1.
- `scripts/shots.mjs` ghi ảnh vào `evidence/phase-3/ui/`.
- Test cũ bị luật mới làm sai đã được cập nhật (thời lượng, điểm, điều kiện thắng, sức chứa);
  không có test nào bị `skip`.
