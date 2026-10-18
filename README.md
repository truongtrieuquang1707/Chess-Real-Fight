# Cờ Vua Chiến Binh (Chess Real Fight)

Game cờ vua 3D chạy trên trình duyệt. Quân cờ là các nhân vật trung cổ: di chuyển, giao chiến và ngã xuống bằng hoạt ảnh.

## Hai đạo quân

- **Đội Trắng: hiệp sĩ thánh.** Giáp bạc viền vàng, mũ có cánh và mào lông, huy hiệu hoa huệ, mắt xanh băng sau khe mũ.
- **Đội Đen: quân đoàn bóng tối.** Giáp thép đen phủ gai, mũ có sừng, huy hiệu đầu lâu, mắt đỏ rực,
  áo choàng rách tả tơi.

| Quân | Nhân vật | Di chuyển | Đòn tấn công |
|---|---|---|---|
| Tốt | Lính cầm kích, khiên huy hiệu | Bước nặng tung bụi | Đâm kích |
| Mã | Hiệp sĩ đại kiếm cưỡi chiến mã bọc giáp | Phi nước đại cuốn bụi, nhảy vọt khi đi chữ L | Ngựa chồm hai vó, chém kiếm |
| Tượng | Pháp sư chiến trận đội mũ trùm | Lướt bay trên vòng phép | Phóng cầu ánh sáng |
| Xe | Vệ binh khổng lồ: búa gai, khiên tháp | Mỗi bước rung mặt đất | Đập búa, rung màn hình |
| Hậu | Nữ hoàng chiến binh: đại kiếm, cầu phép | Lướt bay trên vòng phép | Ba tia phép thuật |
| Vua | Lãnh chúa: đại kiếm phát sáng, vương miện gai | Bước nặng, rung đất | Chém đại kiếm |

## Giao chiến nhiều hiệp

Quân bị ăn không đứng yên chịu trận: càng quý càng chống trả lâu và hiểm.

1. **Đối mặt:** hai bên quay mặt vào nhau và gầm chiến (quân bị ăn có giá trị từ 3 trở lên cũng gầm lại); bên tấn công lao vào trận.
2. **Các hiệp giao đấu:** bên tấn công ra đòn, bên kia giơ khiên đỡ (tia lửa, lóe sáng, màn hình rung, dừng hình ngắn),
   bị đẩy lùi; rồi bên bị ăn phản công và bên tấn công phải đỡ. Quân yếu bị ăn (Tốt) chỉ chống trả một hiệp;
   quân quý (Xe, Hậu) đánh trả hai hiệp.
3. **Sức mạnh thể hiện theo giá trị quân:** đòn phản công nặng hay nhẹ tùy tỉ lệ giá trị hai bên. Tốt ăn Hậu thì
   Hậu đánh trả rất nặng, hất văng và làm Tốt khuỵu gối, còn Hậu ăn Tốt thì Tốt chỉ cầm cự yếu ớt.
   Hai bên đều không còn xứng tầm nhau thì có hộp thoại "Lính thách đấu Nữ hoàng!".
4. **Giằng co lưỡi kiếm** (khi quân bị ăn là Xe hoặc Hậu): hai bên ép sát, vũ khí chạm nhau, tia lửa bắn liên tục,
   bên tấn công dần lấn át và đẩy đối phương ngã nhào.
5. **Đòn quyết định:** thời gian chậm lại; quân quý bị hạ sẽ khuỵu xuống, mắt tắt dần rồi mới đổ.
6. Chạy nhanh hơn bằng nút tốc độ 2x / 3x.

Vua bị chiếu hết thì khuỵu xuống rồi ngã, quân bên thắng ăn mừng.

## Tính năng

- Chơi với máy (Stockfish, Elo 250–3200; không có mạng thì dùng engine dự phòng) hoặc hai người.
- Luật cờ đầy đủ: nhập thành (Vua và Xe cùng hành quân), bắt tốt qua đường, phong cấp có hiệu ứng biến hình,
  chiếu hết, hòa.
- Camera xoay / phóng to bằng chuột hoặc cảm ứng. Chế độ "Cận cảnh" tự áp sát mỗi trận đánh.
  Tốc độ hoạt ảnh 1x–3x.
- Bàn cờ 2D mini ở bên phải: bấm đi quân trực tiếp, kéo góc hoặc bấm +/− để đổi kích thước, xoay hướng, thu gọn.
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

Hình quân trên bàn 2D mini: bộ *Cburnett* của Colin M.L. Burnett (CC BY-SA 3.0), lấy từ Lichess.
