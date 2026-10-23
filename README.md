# 月台圖鑑 Platform Atlas

three.js 手繪風等角月台：列車進站、開門、乘客上下車、出站，每班自動換一款車型。

- 95 款車型：JR 東日本／東海／西日本／九州／北海道／四國／貨物、台灣高鐵、臺鐵
- 車體以參數化斷面 loft 產生（`src/car.js` 的 `BODIES`、`NOSES`），塗裝、車窗、車門、擋風玻璃都在 shader 中繪製
- 車型資料在 `src/trains.js`：新增一筆物件即可加入新車型
- 純靜態網站，無需建置；three@0.170.0 透過 import map 從 jsDelivr 載入

本機預覽：任一靜態伺服器指向此資料夾，例如 `python -m http.server`。
網址參數 `?m=e5` 可直接開啟指定車型；← → 切換車型，空白鍵暫停。
