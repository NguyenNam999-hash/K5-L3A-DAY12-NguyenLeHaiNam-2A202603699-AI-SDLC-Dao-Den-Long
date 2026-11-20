# Credits

## Thư viện

| Thư viện | Giấy phép | Dùng cho |
|---|---|---|
| [three.js](https://threejs.org) | MIT | Renderer 3D |
| [Vite](https://vite.dev) | MIT | Dev server, build UI |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Ngôn ngữ |
| [Vitest](https://vitest.dev) | MIT | Unit test |
| [esbuild](https://esbuild.github.io) | MIT | Bundle CLI headless |
| [Playwright](https://playwright.dev) | Apache-2.0 | Chụp ảnh kiểm chứng (chỉ dev) |

## Nội dung

- Câu chuyện, nhân vật Mây, Bóng Mực, Đảo Bến: bản gốc của lab, phần mở rộng do tôi viết.
- Toàn bộ mô hình 3D (đảo, đèn, cây, đá, mây, nhân vật, Bóng Mực) dựng bằng hình khối Three.js trong code.
- Texture (quầng sáng, mây, sao) sinh bằng canvas lúc chạy; không dùng file ảnh ngoài.
- Âm thanh tạo bằng Web Audio (oscillator), không dùng file âm thanh ngoài.
- Font: font hệ thống của máy (system-ui, Georgia).
