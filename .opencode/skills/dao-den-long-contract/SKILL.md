---
name: dao-den-long-contract
description: Bảo vệ Test Contract v1.1 của game Đảo Đèn Lồng khi sửa lõi, headless, renderer hoặc test. Dùng khi thêm/sửa luật, tuning, snapshot, event, scenario, bản đồ ba Đêm, bot hay bằng chứng.
---

# Đảo Đèn Lồng — Contract v1.1

## Trước khi sửa

1. Đọc `docs/phase/PHASE-2.md` nếu đụng số liệu, tick order, snapshot/event hoặc bản đồ.
2. Đọc `docs/SPEC.md` (AC1–AC28) và `src/core/tuning.ts`.
3. Xác định thay đổi có làm đổi JSONL headless không. Nếu có, cập nhật `scripts/verify.mjs`.

## Bất biến

- 60 tick/s; bước `k` đọc input `k`, event ghi `tick = k + 1`; `night_start` ở tick 1.
- `src/core/**` thuần: không DOM, Three.js, Node API; ngẫu nhiên chỉ qua `Rng(seed)`.
- `TUNING` ↔ `game.contract.json` khớp tuyệt đối. Hằng số ngoài contract nằm trong `PHYSICS`.
- XZ cho khoảng cách gameplay; ngoại lệ: pulse 3D (5 m), nhặt/nạp cần chênh cao, safe zone cùng tầng.
- Điểm đom đóm cộng lúc nạp; thưởng thời gian/lửa chỉ khi thắng.
- Tạm dừng: `tick` tăng, `sim_tick`/thời gian/hồi chiêu/TTL/spawn đứng yên.
- Rơi khỏi đảo: −1 lửa, mất hết đom, chờ 60 tick, hồi sinh, bất tử 90 tick.
- Ba Đêm: 300/330/360 s; 5/6/7 đèn; `--night` chỉ 1/2/3.

## Sau khi sửa

```bash
npm test
npm run typecheck
npm run build
npm run verify
npm run bot
node scripts/shots.mjs   # nếu đổi hiển thị; mở ảnh ra xem
```

Chỉ tuyên bố xong khi `evidence/phase-2/` có output mới tương ứng.
