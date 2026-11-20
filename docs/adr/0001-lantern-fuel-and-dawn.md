# ADR 0001 — Đèn có dầu và luật thắng "giữ sáng tới bình minh"

- Trạng thái: chấp nhận
- Ngày: 2026-11-20
- Phase: 3 ("Đèn cạn dầu"), Contract v1.2

## Bối cảnh

Playtest Phase 2 cho thấy người chơi giỏi thắp hết đèn trong khoảng 2 phút rồi Đêm kết thúc ngay.
Không còn căng thẳng ở cuối Đêm, và "thắng khi tất cả đèn sáng" biến mục tiêu thành một danh sách
việc cần làm hơn là một cuộc giữ gìn.

Change Request Phase 3 đổi mục tiêu thành **giữ đủ đèn còn sáng khi bình minh lên**. Đèn thắp rồi vẫn
có thể cạn dầu và tắt.

## Quyết định

### 1. Mô hình trạng thái đèn

Mỗi đèn giữ thêm ba trường:

| Trường | Ý nghĩa |
|---|---|
| `fuel60` | Dầu còn lại, đơn vị **1/60 đơn vị** (0…6000). Số nguyên nên hao hụt theo tick không trôi. |
| `everLit` | Đã từng sáng trong Đêm này. Quyết định giá thắp lại (5 thay vì 10). |
| `relitCount` | Số lần thắp lại. |

`fuel` trong snapshot/event là `fuel60 / 60`, làm tròn **một chữ số thập phân**. Đèn tắt luôn có
`fuel: 0`; `deposited` giữ nguyên nghĩa "đom đóm đã đặt vào đèn chưa sáng" và bị xoá khi đèn tắt.

Hao hụt mỗi tick:

```text
fuel60 -= 1                      // 1.0 đơn vị/giây
fuel60 -= 5 × số Bóng Mực drain  // 5.0 đơn vị/giây mỗi con, cộng dồn
```

Bước trừ dầu chạy ngay sau bộ đếm thời gian, trước khi người chơi di chuyển. Ngay sau bước đó, đèn
`fuel60 <= 0` tắt, `deposited = 0`, phát `lantern_out`.

### 2. Châm dầu và thắp lại

- Đèn đang sáng nhận `used = min(đang mang, ceil((100 − fuel) / 10))`.
- Đèn đầy dầu không phải mục tiêu hợp lệ, nên không phát sự kiện và không cộng điểm.
- Đèn chưa từng sáng cần 10 đom đóm; đèn đã từng sáng chỉ cần 5.
- Một lần thắp thành công (mới hoặc lại) đặt `fuel = 100`, `deposited = 0`, tăng `successful_lights`.
- Sức chứa = `min(20, 10 + 2 × successful_lights)`.

Chọn mục tiêu tương tác dùng XZ 2 m + chênh cao ≤ 1.5 m như Phase 2, chỉ xét đèn nhận được
(chưa sáng, hoặc sáng nhưng chưa đầy dầu), gần nhất, hoà thì id nhỏ hơn.

### 3. Bóng Mực hút dầu

- Vùng an toàn chỉ còn quanh đèn sáng có `fuel >= 30`. Đúng 30 vẫn an toàn.
- Bóng Mực `wander` chọn đèn yếu (`fuel < 30`) gần nhất; không có thì đi về đèn tắt gần nhất.
- Cách đèn ≤ 2 m (XZ) thì chuyển `drain`, đứng yên, hút 5 đơn vị/giây.
- `drain` chuyển `chase` khi Mây vào 6 m, `stunned` khi trúng Tỏa Sáng, `wander` khi đèn tắt,
  khi đèn được châm lên ≥ 30, hoặc khi cách đèn > 2 m.
- Đèn vừa thắp / vừa được châm lên ≥ 30 vẫn dùng cơ chế đẩy cũ: Bóng Mực bị đẩy ra mép vùng 6 m và
  không gây sát thương trong 30 tick.

### 4. Luật thắng

- Thời lượng Đêm 1/2/3: 240/270/300 giây.
- Thắng khi hết giờ, Mây còn sống và số đèn đang sáng ≥ `ceil(0.6 × tổng đèn)` (3/5, 4/6, 5/7).
- Không còn thắng sớm khi thắp đủ đèn.
- Hết Ngọn Lửa luôn thua `no_flames`, kể cả ở tick cuối.
- Lý do kết thúc: `dawn_survived`, `dawn`, `no_flames`.

### 5. Điểm

Điểm theo sự kiện: +5 mỗi đom đóm nạp, +100 lần thắp đầu, +40 lần thắp lại, +5 mỗi Bóng Mực trúng
Tỏa Sáng, +15 thêm nếu trước đó đang `drain`. Khi thắng: mỗi đèn còn sáng `+50 + floor(fuel)`,
mỗi Ngọn Lửa còn lại +50. Bỏ hoàn toàn thưởng thời gian.

## Hệ quả

- `src/core/game.ts` là nơi duy nhất giữ `fuel60`; renderer chỉ đọc `game.fuelOf(lantern)`.
- `game.contract.json` lên `1.2`, thêm 11 khoá tuning và đổi ba thời lượng.
- Snapshot đổi shape: thêm `fuel`, `ever_lit`, `relit_count`, `player.capacity`; trạng thái
  `drain` xuất hiện trong `shades[].state`.
- Event mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
- Bot Phase 2 (thắng bằng cách thắp hết đèn) không còn đúng; bot Phase 3 giữ 3/5 đèn tới bình minh.

## Phương án bị loại

1. **Dùng số thực cho dầu.** Bị loại vì 1/60 không biểu diễn chính xác; sau 14 400 tick sai số
   có thể làm `fuel <= 0` lệch một tick và phá tính tất định byte-for-byte.
2. **Cho đèn tắt hẳn và mất `ever_lit`.** Bị loại vì Change Request yêu cầu thắp lại rẻ hơn (5 đom)
   và snapshot phải nhớ `ever_lit`.
3. **Giữ thắng sớm khi đủ đèn.** Bị loại vì mục tiêu mới là giữ đèn tới bình minh; thắng sớm sẽ
   bỏ qua toàn bộ áp lực cuối Đêm.
4. **Cho Bóng Mực hút mọi đèn.** Bị loại vì Ticket chỉ cho `wander` chọn đèn yếu; `chase` phải
   đuổi Mây và không đổi mục tiêu.
