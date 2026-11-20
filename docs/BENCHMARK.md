# Benchmark — cách đo và đọc số

Tài liệu này mô tả bài benchmark của Contract v1.3. Số chuẩn nằm ở [`bench.json`](../bench.json);
bản sao trong `evidence/phase-4/bench.json`.

## Lệnh

```bash
npm ci
npm run build
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
# hoặc: npm run bench -- --seed 42 --duration 30 --out bench.json
```

Lần đầu cần Chromium cho Playwright:

```bash
npx playwright install chromium
```

Script tự tìm theo thứ tự: Chromium của Playwright → Chrome for Testing trong cache → kênh `chrome`
của máy. Không có trình duyệt nào thì in một dòng hướng dẫn và thoát mã 1.

## Cảnh chuẩn

| Thành phần | Giá trị |
| --- | --- |
| Cửa sổ | 1280×720, không toàn màn hình, `deviceScaleFactor = 1` |
| Đêm | 1 (Đảo Bến) |
| Bóng Mực | 200, trạng thái `wander`, vành bán kính 20–38 m, `Rng(42)` |
| Đom đóm | 100, bán kính 8–38 m |
| Đèn | L1–L3 sáng, dầu 100; L4–L5 tắt |
| Mây | đứng yên tại `(0,0,0)`, không input |
| Camera | quỹ đạo tâm `(0,0,0)`, bán kính 30 m, cao 15 m, bắt đầu `(30,15,0)`, ngược chiều kim đồng hồ, 15 s/vòng |
| Khởi động | 3 s đầu không đo |
| Đo | đúng `--duration` giây rồi tự thoát |

Trong cảnh benchmark, `Game` bật `benchmark: true`: không sinh thêm thực thể, không sát thương, không
nhặt đom, không hao/hút dầu, không kết thúc Đêm. Bóng Mực vẫn chạy luật `wander`. HUD DOM không được vẽ
để phép đo chỉ còn cảnh 3D; đây là khác biệt có chủ đích so với lúc chơi.

## Công thức

- `avg_fps = 1000 × N / Σ dt_i`
- `k = max(1, ceil(0.01 × N))`, lấy `k` `dt` lớn nhất, `p1_low_fps = 1000 / trung bình(k giá trị đó)`
- `frame_ms_p95` = phân vị 95 kiểu nearest-rank trên `dt` đã sắp tăng
- `load_ms` = từ lúc tiến trình Node bắt đầu tới khung hình đầu tiên của cảnh (sai số ≤ 50 ms do polling)
- `peak_mem_mb` = tổng RSS lớn nhất của cây tiến trình Chromium, lấy mẫu mỗi 250 ms trong lúc đo.
  Shared page bị tính theo từng tiến trình nên con số cao hơn bộ nhớ riêng thực tế. Trên Windows không
  có `ps` thì trường này là `null`.
- `vsync_off` = script đã truyền `--disable-gpu-vsync --disable-frame-rate-limit`. Một số compositor vẫn
  khoá 60 Hz; khi đó `avg_fps ≈ 60` và vẫn đạt ngưỡng.

## Ngưỡng

| Trường | Ngưỡng |
| --- | --- |
| `avg_fps` | ≥ 60 |
| `p1_low_fps` | ≥ 30 |
| `load_ms` | ≤ 10 000 |

## Máy đo tham khảo

| Mục | Giá trị |
| --- | --- |
| Máy | MacBook Pro 14" (2021), Apple M1 Pro, 16 GB |
| Hệ điều hành | macOS 27.0.0 (Darwin 27.0.0, arm64) |
| Trình duyệt | Chromium 153.0.8010.12 (Playwright 1.65), WebGL2 qua ANGLE/Metal |
| Nguồn | cắm điện, chế độ hiệu năng cao |
| Ngày đo | 2026-11-20 |

Kết quả lần đo gần nhất: `avg_fps 217.95`, `p1_low_fps 158.77`, `frame_ms_p95 5.3`, `load_ms 1230`,
`frames 6539`, `peak_mem_mb 1224`.

Máy chấm của giảng viên là nguồn số chính thức; số trên chỉ để tham khảo và phát hiện hồi quy.

## Soak test

```bash
node dist-node/headless/soak.js --seed 7 --nights 10 --out soak.json
```

- Đêm `i`: `night = ((i-1) % 3) + 1`, `seed = 7 + i`.
- Mỗi 30 tick đổi hướng; mỗi tick 5% nhảy, 3% lướt, 2% Tỏa Sáng, 10% tương tác.
- Một Đêm khởi động nóng bị bỏ đi trước khi lấy `mem_start_mb`, để RSS phản ánh bộ nhớ trò chơi chứ
  không phải mã máy ảo vừa biên dịch. Cả hai mốc đều gọi GC trước khi đọc RSS.
- Ngưỡng: `crashes = 0`, `mem_end_mb ≤ 1.2 × mem_start_mb`.
