# Đề xuất công nghệ

## Engine

- **Three.js**: engine 3D nhẹ, chạy trực tiếp trên macOS/Linux bằng trình duyệt.
- Ưu tiên **đồ họa stylized**, ánh sáng ấm, đảo tròn và particle đom đóm.

## Ngôn ngữ

- **TypeScript**.
- Hỗ trợ type an toàn và dễ kiểm soát trạng thái tick cùng JSON contract.

## Framework và công cụ

- **Vite**: khởi tạo và build nhanh.
- **Vitest**: unit test và test headless.
- **Node.js CLI**: chạy mô phỏng không GPU.
- Không dùng React vì mô hình game đơn giản; TypeScript module thuần giúp giảm overhead.

## Kiến trúc đề xuất

- `GameCore`: physics, tick, player, inventory, lantern và scoring.
- `ThreeRenderer`: model, camera, animation và hiệu ứng.
- `HeadlessRunner`: đọc CLI, scenario, inputs và ghi JSONL.
- `GameState`: `playing | won | lost`.

Logic game chạy chính xác **60 tick/giây**. Renderer chỉ phụ trách hiển thị trạng thái gameplay. File `game.contract.json` lưu toàn bộ tuning để tránh sai lệch giữa game có giao diện và chế độ headless.

## Sáng tạo bổ sung

### 1. Vòng nhìn vùng tối

- Ánh sáng lan tỏa theo các đèn đã thắp.
- Bóng Mực yếu hơn hoặc khó tiếp cận hơn trong vùng sáng.

### 2. Đom đóm nhiều loại

- Đom đóm vàng: tăng capacity và điểm.
- Đom đóm xanh: hồi nhẹ hoặc giảm cooldown pulse.

### 3. Bóng Mực có hành vi đa dạng

- `Wander`: lang thang.
- `Chase`: đuổi người chơi.
- `Stunned`: bị tạm thời xua lui.
- Luồng spawn dùng seed tái lập để đảm bảo deterministic.

### 4. Lantern Resonance

- Khi hai đèn gần nhau được thắp, tạo vùng sáng an toàn lớn hơn.
- Không thay đổi scoring hoặc contract baseline.

### 5. Hệ nhịp pulse

- Pulse tiêu thụ ánh sáng.
- Stun và đẩy Bóng Mực, đồng thời cộng điểm theo tuning.
- Hiển thị cooldown trực quan trên HUD.

### 6. Nhiệm vụ nhỏ

- Ví dụ thắp 3 đèn trước 2 phút hoặc thu thập liên tiếp không bị trúng đòn.
- Chỉ là bonus score và không làm sai điều kiện thắng/thua của contract.

### 7. Chế độ kể chuyện ngắn

- Lore xuất hiện theo tiến trình thắp đèn.
- Giới thiệu nhân vật phụ và câu chuyện của đảo trong không gian 3D.

### 8. Âm thanh procedural

- Dùng Web Audio để tạo gió, âm lantern, pickup và pulse.
- Tắt hoàn toàn khi chạy headless.

## Tiêu chí MVP

- Camera 3D và di chuyển.
- 5 đèn, pickup đom đóm và nạp ánh sáng.
- Bóng Mực chase/hit/pulse.
- Win, lose, replay và HUD.
- Headless CLI ổn định.
- Output JSONL đúng snapshot, event và end.
- Build và chạy bằng tối đa ba lệnh.
- Unit test cho movement, distance và interaction để giảm sai lệch gameplay.
