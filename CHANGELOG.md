# Changelog

Mọi thay đổi đáng chú ý của Đảo Đèn Lồng. Định dạng theo Keep a Changelog, phiên bản theo SemVer.

## [1.0.0] — 2026-11-20 (Phase 4 — "Bình minh: phát hành v1.0.0")

### Added

- `npm run bench` (`scripts/bench.mjs`) chạy cảnh chuẩn 1280×720 qua Playwright/Chromium: Đêm 1, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng 100 dầu, camera quỹ đạo 30 m/15 s, 3 s khởi động, xuất `bench.json`.
- `GameOptions.benchmark`: đóng băng sinh thực thể, sát thương, nhặt đom, hao dầu và điều kiện kết thúc; Bóng Mực vẫn `wander`.
- `npm run soak` / `dist-node/headless/soak.js`: 10 Đêm liên tiếp trong một tiến trình, input ngẫu nhiên theo seed, xuất `soak.json` (RSS đầu/cuối, số crash).
- Bảng xếp hạng cục bộ top 10: tên 3–12 ký tự `[A-Za-z0-9_]`, điểm giảm dần, hoà giữ thứ tự, lưu `data/leaderboard.json` qua `node dist-node/app.js` và `localStorage` khi phục vụ tĩnh.
- `--export-leaderboard <file>` xuất `{"entries":[...]}` đúng thứ tự.
- Server tĩnh `dist-node/app.js` phục vụ `dist/` + API `/api/leaderboard`.
- Đổi phím cho 9 hành động, phát hiện trùng phím, khôi phục mặc định, lưu riêng.
- Phụ đề/chỉ báo: Bóng Mực xuất hiện (kèm mũi tên mép màn hình), gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu.
- Tuỳ chọn Giảm chuyển động (tắt rung camera, chớp màn hình, nhấp nháy đèn yếu) và Chữ lớn ×1.25.
- Sàn cỡ chữ UI 18 px tại 1280×720, đo tự động bằng Playwright.
- `LICENSE` MIT, `docs/BENCHMARK.md`, `docs/RETRO.md`, `docs/demo/demo.mp4`.
- `scripts/verify.mjs` thêm 6 kiểm tra Phase 4 (contract, soak, export, corrupt file, release assets, bench report).

### Changed

- Contract `1.3`: thêm `bench_cmd`, `soak_cmd`; `run_cmd` đổi sang `node dist-node/app.js`.
- `npm run build` dựng thêm `dist-node/app.js` và `dist/bench.html`.
- HUD hiển thị phím theo cấu hình người chơi; màn tạm dừng và dòng điều khiển cập nhật động.
- Toàn bộ cỡ chữ CSS đi qua `--font-scale`, sàn 18 px.

### Fixed

- Thẻ cài đặt cao hơn 720 px bị cắt đỉnh khi cuộn; nay cuộn trong thẻ.
- Nhãn kỹ năng bị xuống dòng khi chữ tăng lên 18 px.
- Phụ đề và gợi ý `E` chồng lên thanh đom đóm.

## [0.3.0] — 2026-11-20 (Phase 3 — "Đèn cạn dầu")

### Added

- Dầu cho từng Đèn Lồng Lớn (100 dầu, hao 1/giây), châm 10 dầu mỗi đom đóm, thắp lại tốn 5.
- Vùng an toàn bán kính 6 m quanh đèn `fuel ≥ 30`; Bóng Mực hút 5 dầu/giây khi đèn yếu.
- Ba Đêm nối tiếp với thắng/thua theo tỉ lệ 60% đèn còn sáng lúc bình minh, màn Bình Minh và tổng điểm chiến dịch.
- Ba bản đồ: Đảo Bến, Đảo Cau (cầu tre, bục nhảy, Bùa Gió, Gió Lạc), Đảo Chuông (ba tầng, dốc, tháp chuông).
- HUD thanh dầu, minimap v1.2, chế độ mù màu, âm thanh procedural theo Đêm.
- Headless Contract v1.2: snapshot `fuel`, `ever_lit`, `relit_count`, sự kiện `lantern_lit`, `lantern_out`, `fuel_drain`, `relight`.
- Bot tự chơi thắng Đêm 1 (`npm run bot`).

## [0.2.0] — 2026-11-19 (Phase 2)

### Added

- Lõi mô phỏng 60 tick/giây tất định: di chuyển, nhảy, lướt, nhặt/nạp đom đóm, Tỏa Sáng, Bóng Mực, Drifter, Bùa Gió, gió, rơi khỏi đảo.
- Headless CLI `dist-node/headless/main.js` xuất JSONL (snapshot/event/end), mã thoát 0/1/2/3.
- Test Contract v1.1, 15 scenario mẫu, verify 24 kiểm tra, bot, ảnh UI.
- Ba Đêm dữ liệu chuẩn trong `src/core/nights.ts`, địa hình thuần trong `terrain.ts`.

## [0.1.0] — 2026-11-18 (Phase 1)

### Added

- Khung TypeScript + Three.js + Vite, cảnh Đảo Bến dựng bằng code.
- Nhân vật Mây, đom đóm, Đèn Lồng Lớn, vòng lặp 60 Hz, HUD cơ bản.
- Test đầu tiên cho tuning và địa hình.
