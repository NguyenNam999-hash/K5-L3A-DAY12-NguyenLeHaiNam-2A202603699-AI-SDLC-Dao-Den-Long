# Đảo Đèn Lồng v1.0.0 — Bình minh

Bản phát hành đầu tiên đủ điều kiện chơi và chấm: ba Đêm, Contract v1.3, benchmark, soak test, bảng xếp
hạng cục bộ, đổi phím và các tuỳ chọn dễ tiếp cận.

## Chạy bản phát hành

Yêu cầu: Node.js 20 trở lên, trình duyệt hỗ trợ WebGL2.

```bash
unzip dao-den-long-v1.0.0.zip
cd dao-den-long-v1.0.0
node dist-node/app.js
# mở http://127.0.0.1:4173
```

`dist-node/app.js` phục vụ `dist/`, mở trình duyệt và ghi bảng xếp hạng vào `data/leaderboard.json`.
Tuỳ chọn: `--port 8080`, `--no-open`, `--data <file>`, `--export-leaderboard <file>`.

Nếu chỉ có thư mục `dist/`, phục vụ tĩnh bằng bất kỳ web server nào; bảng xếp hạng sẽ dùng `localStorage`.

## Nội dung

- `dist/` — UI đã build (index + bench).
- `dist-node/` — CLI headless, soak runner, app server.
- `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`.

## Bằng chứng

- 134 unit test, 35 kiểm tra contract.
- Benchmark trên Apple M1 Pro: 217.95 fps trung bình, p1 158.77, load 1230 ms, p95 5.3 ms.
- Soak 10 Đêm: 0 crash, RSS 56 → 63 MB.

Chi tiết: `README.md`, `docs/BENCHMARK.md`, `docs/EVIDENCE.md`, `docs/RETRO.md` trong repo.
