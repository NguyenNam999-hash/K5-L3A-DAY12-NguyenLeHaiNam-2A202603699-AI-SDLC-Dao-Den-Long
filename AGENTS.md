# AGENTS.md — harness cho repo này

## Lệnh

```bash
npm ci
npm run build          # esbuild headless -> dist-node/, vite -> dist/
npm test               # vitest, 78 test
npm run typecheck      # tsc --noEmit
npm run verify         # chạy CLI đã build, 24 kiểm tra, ghi evidence/phase-2/headless/
npm run bot            # bot chơi Đêm 1, phải thắng thì mới exit 0
npm run dev            # vite + mở trình duyệt
```

## Bất biến — không được phá

1. `src/core/**` không import DOM, Three.js hay Node API. Chỉ logic thuần + `Rng`.
2. Tick cố định 1/60 s. Bước `k` đọc input tick `k`, sự kiện ghi `tick = k+1`, snapshot tick 0 trước input.
   `night_start` phát ở tick 1. Khi tạm dừng, `tick` vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn
   và TTL đứng yên; snapshot ghi `state: "paused"`.
3. Khoảng cách gameplay đo trên mặt phẳng XZ, đơn vị mét, `≤ r` là "trong bán kính". Ba ngoại lệ có chủ đích:
   - Tỏa Sáng dùng khoảng cách 3D tới tâm Bóng Mực (bán kính 5).
   - Nhặt đom đóm/bùa và tương tác đèn yêu cầu thêm chênh cao ≤ 1.5 m.
   - Vùng an toàn và phát hiện Bóng Mực chỉ tính khi cùng tầng (chênh cao ≤ 2 m).
4. `src/core/tuning.ts` là nguồn số contract duy nhất (`TUNING`). Sửa số phải sửa
   `game.contract.json` cùng lúc; `tests/contract.test.ts` sẽ đỏ nếu lệch. Hằng số vật lý ngoài contract
   nằm trong `PHYSICS` và **không** được đưa vào JSON.
5. Headless phải tất định: mọi ngẫu nhiên đi qua `Rng(seed)`, không dùng `Math.random`, `Date`, thứ tự
   object không ổn định. Renderer được phép dùng `Math.random` cho rung camera.
6. File scenario/inputs sai định dạng → exit 2 + stderr. Lỗi CLI → exit 1. Không được ném stack trace ra stdout.
7. Đầu ra JSONL: snapshot tick 0, snapshot mỗi `--snapshot-every`, event ngay khi xảy ra, dòng cuối `end`.
8. Toạ độ làm tròn 3 chữ số; `score` là số nguyên. `--night` chỉ nhận 1, 2, 3.
9. Sáng tạo thêm phải tắt hoặc vô hình trong headless, hoặc chỉ dùng tham số contract.
10. Không commit `.env`, token, API key. `node_modules/`, `dist*/` nằm trong `.gitignore`.
11. Ba Đêm có bản đồ chuẩn trong `src/core/nights.ts`; độ cao/va chạm thuần trong `src/core/terrain.ts`.
    Không hard-code lại tọa độ đèn/điểm sinh trong renderer hay test khác.
12. Điểm đom đóm cộng lúc nạp đèn (không phải lúc nhặt). Thưởng thời gian/lửa chỉ cộng khi thắng.
13. Rơi khỏi đảo (Y < −10) là một lần: −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh, bất tử 90 tick.

## Vòng làm việc

1. Đọc yêu cầu, ghi giả định vào `docs/SPEC.md` trước khi code.
2. Sửa lõi → chạy `npm test`. Sửa CLI/luật → chạy `npm run verify`.
3. Thay đổi hiển thị → chạy `node scripts/shots.mjs` và **xem ảnh**, không đoán.
4. Tuyên bố "xong" chỉ khi có output thật trong `evidence/phase-2/`.
5. Commit nhỏ, mỗi commit một việc. Tag `phase-N` khi hết giờ phase.

## Bản đồ file

- `src/core/game.ts` — toàn bộ luật chơi, `step()`, snapshot, event.
- `src/core/nights.ts` — dữ liệu ba Đêm: đảo, cầu, tầng, dốc, bục nhảy, đèn, điểm sinh, Bùa Gió.
- `src/core/terrain.ts` — `groundHeight`, `isSolid`; không phụ thuộc `Game`.
- `src/core/{tuning,scenario,parse,input-track,rng,types,validation}.ts`
- `src/headless/{main,run}.ts` — CLI.
- `src/render/{main,world,hud,minimap,settings,audio}.ts` — Three.js, chiến dịch, HUD, cài đặt, âm thanh.
- `tests/**`, `scripts/{verify.mjs,bot.ts,shots.mjs}`.
- `docs/superpowers/{specs,plans}/` — thiết kế và kế hoạch phase-2.

## Lưu ý token

- Không đọc lại toàn bộ file khi chỉ cần một hàm: dùng grep trước.
- Không chạy lại toàn bộ test sau mỗi dòng sửa; gom thay đổi rồi chạy một lần.
- Output dài (JSONL) đọc bằng `tail -1`, `grep`, hoặc script kiểm tra, không dump vào ngữ cảnh.
