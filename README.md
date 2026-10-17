# Cờ Vua Chiến Binh (Chess Real Fight)

Game cờ vua 3D chạy trên trình duyệt. Quân cờ là các nhân vật trung cổ: di chuyển, giao chiến và ngã xuống bằng hoạt ảnh.

## Nhân vật

| Quân | Nhân vật | Đòn tấn công |
|---|---|---|
| Tốt | Lính bộ binh: mũ sắt, giáo, khiên huy hiệu | Đâm giáo |
| Mã | Hiệp sĩ giáp toàn thân cưỡi chiến mã; bờm, đuôi, chùm lông mũ bay theo gió | Ngựa chồm hai vó, chém kiếm; di chuyển bằng cú nhảy vọt |
| Tượng | Giáo sĩ: mũ giám mục, gậy mục tử gắn ngọc | Phóng cầu ánh sáng |
| Xe | Vệ binh khổng lồ: giáp nặng, mũ tháp canh | Búa chiến đập xuống, rung màn hình |
| Hậu | Nữ hoàng: vương miện, quyền trượng | Ba tia phép thuật |
| Vua | Nhà vua: giáp tấm, áo choàng viền lông chồn | Chém kiếm |

Khi Vua bị chiếu hết, Vua ngã xuống và quân bên thắng nhảy lên ăn mừng.

## Tính năng

- Chơi với máy (Stockfish, Elo 250–3200; không có mạng thì dùng engine dự phòng) hoặc hai người.
- Luật cờ đầy đủ: nhập thành (Vua và Xe cùng hành quân), bắt tốt qua đường, phong cấp có hiệu ứng biến hình,
  chiếu hết, hòa.
- Camera xoay / phóng to bằng chuột hoặc cảm ứng. Chế độ "Cận cảnh" tự áp sát mỗi trận đánh.
  Tốc độ hoạt ảnh 1x–3x.
- Âm thanh tổng hợp (bước chân, vó ngựa, kiếm chạm, phép thuật) và nhạc nền.

## Chạy

Mở `index.html` qua một máy chủ tĩnh bất kỳ (GitHub Pages là đủ). Không cần build.

## Cấu trúc

| File | Nội dung |
|---|---|
| `js/characters.js` | Dựng nhân vật bằng three.js, tư thế, bước đi, vải và bờm bay |
| `js/game.js` | Cảnh 3D, camera, điều khiển, diễn biến ván cờ, trận đánh, hiệu ứng, âm thanh |
| `js/chess.js`, `js/engine.js` | Luật cờ, engine dự phòng, bọc Stockfish |
| `js/music.js` | Nhạc nền tự tổng hợp |
| `js/three.min.js` | three.js r128 (giấy phép MIT, xem `js/three.LICENSE`) |
