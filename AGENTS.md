# AGENTS.md — harness cho repo này

## Lệnh

```bash
npm ci
npm run build          # esbuild headless -> dist-node/, vite -> dist/
npm test               # vitest, 43 test
npm run verify         # chạy CLI đã build + kiểm tra contract, ghi evidence/phase-1/headless/
npm run bot            # bot chơi tự động, phải thắng thì mới exit 0
npm run dev            # vite + mở trình duyệt
```

## Bất biến — không được phá

1. `src/core/**` không import DOM, Three.js hay Node API. Chỉ logic thuần + `Rng`.
2. Tick cố định 1/60 s. Bước `k` đọc input tick `k`, sự kiện ghi `tick = k+1`, snapshot tick 0 trước input.
3. Khoảng cách gameplay đo trên mặt phẳng XZ, đơn vị mét, `≤ r` là "trong bán kính".
4. `src/core/tuning.ts` là nguồn số duy nhất. Sửa số phải sửa `game.contract.json` cùng lúc; `tests/contract.test.ts` sẽ đỏ nếu lệch.
5. Headless phải tất định: mọi ngẫu nhiên đi qua `Rng(seed)`, không dùng `Math.random`, `Date`, thứ tự object không ổn định.
6. File scenario/inputs sai định dạng → exit 2 + stderr. Không được ném stack trace ra stdout.
7. Đầu ra JSONL: snapshot tick 0, snapshot mỗi `--snapshot-every`, event ngay khi xảy ra, dòng cuối `end`.
8. Toạ độ làm tròn 3 chữ số; `score` là số nguyên.
9. Sáng tạo thêm phải tắt hoặc vô hình trong headless, hoặc chỉ dùng tham số contract.
10. Không commit `.env`, token, API key. `node_modules/`, `dist*/` nằm trong `.gitignore`.

## Vòng làm việc

1. Đọc yêu cầu, ghi giả định vào `docs/SPEC.md` trước khi code.
2. Sửa lõi → chạy `npm test`. Sửa CLI/luật → chạy `npm run verify`.
3. Thay đổi hiển thị → chạy `node scripts/shots.mjs` và **xem ảnh**, không đoán.
4. Tuyên bố "xong" chỉ khi có output thật trong `evidence/phase-1/`.
5. Commit nhỏ, mỗi commit một việc. Tag `phase-N` khi hết giờ phase.

## Bản đồ file

- `src/core/game.ts` — toàn bộ luật chơi, `step()`, snapshot, event.
- `src/core/{tuning,scenario,parse,input-track,rng,types,validation}.ts`
- `src/headless/{main,run}.ts` — CLI.
- `src/render/{main,world,hud,audio}.ts` — Three.js, HUD, âm thanh.
- `tests/**`, `scripts/{verify.mjs,bot.ts,shots.mjs}`.

## Lưu ý token

- Không đọc lại toàn bộ file khi chỉ cần một hàm: dùng grep trước.
- Không chạy lại toàn bộ test sau mỗi dòng sửa; gom thay đổi rồi chạy một lần.
- Output dài (JSONL) đọc bằng `tail -1`, `grep`, hoặc script kiểm tra, không dump vào ngữ cảnh.
