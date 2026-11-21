# Giấc ngủ – ứng dụng tra cứu cuốn sách

Ứng dụng được biên tập từ tệp **Giac ngu _ 2026.11.21.docx** do người dùng cung cấp, theo cuốn **Giấc ngủ – Liều thuốc bổ cho cuộc sống**, BS. Minh Tuấn – Khánh Hương tổng hợp, biên soạn; Nhà xuất bản Hồng Đức, 2013.

## Dùng ngay trên máy tính

Mở **Mo_Ung_Dung_Giac_Ngu.html** bằng Chrome, Edge hoặc Safari. Tệp này chứa sẵn giao diện, dữ liệu sách, biểu tượng và bản Word nguồn; không cần cài thư viện, tạo tài khoản hay khởi động máy chủ để đọc và tìm kiếm.

Nếu máy chỉ mở bản xem trước tệp, hãy chọn **Mở bằng trình duyệt**. Khả năng lưu ghi chú khi mở một tệp HTML phụ thuộc chính sách của trình duyệt. Ứng dụng sẽ thông báo nếu chỉ giữ được dữ liệu trong phiên hiện tại; hãy xuất bản sao trước khi đóng.

## Dùng trên điện thoại

Mở địa chỉ HTTPS của ứng dụng sau khi triển khai lên Vercel. Vào **Tùy chọn → Cài hoặc xem hướng dẫn**.

- **Android:** mở bằng Chrome, menu ⋮, chọn **Cài đặt và tạo lối tắt → Cài đặt** hoặc **Thêm vào màn hình chính**, tùy phiên bản.
- **iPhone:** mở bằng Safari, chọn **Chia sẻ → Thêm vào Màn hình chính**, bật **Mở dưới dạng ứng dụng web** nếu có, rồi chọn **Thêm**.

Để dùng ngoại tuyến, mở ứng dụng khi có mạng và chờ nhãn **Sẵn sàng ngoại tuyến**. Văn bản, mục lục, giao diện và tệp Word nguồn được lưu trên thiết bị. Bộ nhớ này có thể bị xóa khi bạn xóa dữ liệu trình duyệt hoặc hệ điều hành thu hồi dung lượng. Hãy giữ bản sao ghi chú riêng.

## Cách tra cứu

1. Nhập từ khóa có dấu hoặc không dấu, chẳng hạn `mat ngu`, `ngu trua`, `dong ho sinh hoc`.
2. Chọn **Toàn bộ nội dung** hoặc **Chỉ tiêu đề**. Các từ nhập được kết hợp cùng nhau; dùng dấu ngoặc kép để tìm nguyên cụm, ví dụ `"đồng hồ sinh học"`.
3. Lọc theo phần và mục chính nếu cần. Sắp xếp theo mức phù hợp hoặc theo thứ tự sách.
4. Chạm một kết quả để đọc tiểu mục. Chọn **Đọc trọn mục chính** để đọc phần liên quan liền mạch; tiểu mục đang tìm sẽ được đưa vào vị trí đọc.
5. Mở **Mục lục** để duyệt 5 phần và 58 mục chính. Mục lục gốc và số trang sách được giữ ở cuối trang này.

Có **355 mục tra cứu**, gồm **58 mục chính và 297 tiểu mục**. Các mục con được đánh số trong một đoạn hoặc gạch đầu dòng vẫn nằm trong nội dung mục cha, đúng như bản nguồn.

## Dấu trang, ghi chú và cỡ chữ

- Chạm biểu tượng dấu trang để giữ một mục trong **Đã lưu**.
- Viết vào **Ghi chú riêng** ở cuối nội dung; ghi chú tự lưu và không sửa lời văn trong sách.
- **Đã lưu** có ba danh sách: đã đánh dấu, vừa xem, có ghi chú.
- **Tùy chọn** cho phép chọn giao diện sáng/tối/theo thiết bị và cỡ chữ đọc từ 16 đến 26 px.
- Dùng **Xuất bản sao lưu** để lấy tệp JSON. Trên thiết bị khác, dùng **Nhập và gộp bản sao**; các ghi chú khác nhau được giữ lại khi gộp.

Dữ liệu riêng nằm trong trình duyệt trên thiết bị hiện tại, chưa tự đồng bộ. Mỗi địa chỉ web hoặc bản HTML mở trên máy có vùng lưu riêng. **Xuất bản sao trước khi đổi địa chỉ ứng dụng, đổi máy hoặc xóa dữ liệu trình duyệt.** Tệp sao lưu của sách này được phân biệt với ứng dụng các cuốn sách khác.

## Tài liệu nguồn và cách biên tập

- Toàn bộ 500 đoạn có nội dung trong Word được giữ ở các mục, tiêu đề phần hoặc phụ lục nguồn; cả hai bảng mục lục và thông tin xuất bản được bảo toàn.
- 355 tiêu đề và 366 khối thân bài đã được đối chiếu với Word. Dấu xuống dòng, thứ tự và những chỗ đánh số không liên tục của bản nguồn được giữ nguyên.
- Số trang hiển thị là **trang bắt đầu của mục chính theo mục lục sách**, không phải vị trí chính xác của từng tiểu mục hoặc số trang Word.
- `source/Giac_Ngu_Nguon.docx` là bản sao nguyên vẹn của tệp được cung cấp. Có thể tải trong **Tùy chọn → Tải tệp Word nguồn**.
- Nội dung sức khỏe phản ánh tài liệu xuất bản năm 2013, chưa được cập nhật hoặc thẩm định lại về y khoa. Ứng dụng phục vụ tra cứu tài liệu.

## Đưa lên Vercel

Gói này là ứng dụng tĩnh, không cần cơ sở dữ liệu, API key hay dịch vụ AI.

### Vercel Drop

1. Mở <https://vercel.com/drop>.
2. Tải lên tệp ZIP của ứng dụng, với `index.html` nằm ngay ở cấp đầu của ZIP.
3. Nếu đã đăng nhập, chọn tài khoản hoặc nhóm sở hữu dự án, đặt tên dự án rồi triển khai.
4. Mở đường dẫn được Vercel trả về và làm theo hướng dẫn cài trên điện thoại ở trên.

Vercel cho phép dùng thử ứng dụng tĩnh chưa gắn tài khoản, nhưng đường dẫn đó có thời hạn. Muốn dùng ổn định lâu dài, cần triển khai hoặc nhận dự án trong tài khoản Vercel của bạn. Không coi liên kết dùng thử là địa chỉ chính thức để giữ ghi chú lâu dài.

### Qua Git

Đưa toàn bộ thư mục vào kho mã của bạn và nhập dự án trên Vercel. `vercel.json` đặt ứng dụng là static, không có lệnh cài đặt hoặc build, thư mục đầu ra là `.`. Giữ các đường dẫn ở gốc tên miền.

## Chạy và bảo trì mã nguồn

Yêu cầu Node.js 18 trở lên để chạy máy chủ phát triển hoặc tạo lại bản HTML. Ứng dụng đã đóng gói không cần Node.js khi sử dụng.

```bash
npm start
npm test
npm run check
npm run portable
```

- `index.html`, `styles.css`, `app.js`: giao diện.
- `data/book.json`: toàn bộ nội dung và cấu trúc sách.
- `lib/search.mjs`: tìm kiếm tiếng Việt.
- `lib/storage.mjs`: dấu trang, ghi chú và sao lưu.
- `sw.js`, `manifest.webmanifest`, `icons/`: cài đặt và ngoại tuyến.
- `scripts/serve.mjs`: máy chủ phát triển tại địa chỉ được in ra khi chạy.
- `scripts/build-portable.mjs`: tạo lại `Mo_Ung_Dung_Giac_Ngu.html` với nội dung nhúng.

Khi sửa nội dung hoặc giao diện, cập nhật phiên bản trong `sw.js` và `data/book.json`, chạy kiểm tra rồi tạo lại bản HTML. Giữ nguyên ID của mục để dấu trang và ghi chú còn gắn đúng nội dung. Sửa Word nguồn không tự cập nhật `data/book.json`.

## Kiểm tra đã thực hiện

Đối chiếu độc lập nội dung Word, mục lục và cấu trúc cha/con; 18 kiểm tra tự động về tìm kiếm và lưu dữ liệu; kiểm tra giao diện trong trình duyệt ở chiều rộng 320 và 390 px cùng màn hình máy tính. Đã kiểm tra đọc trọn mục, giữ ghi chú sau mở lại và sau cập nhật, chế độ tối, bản nội dung nhúng, trạng thái lưu ngoại tuyến. Chưa thử cài đặt trên một điện thoại vật lý hoặc chế độ máy bay thực tế.

## Tài liệu nền tảng

- Vercel Drop: <https://vercel.com/docs/drop>
- Chrome trên Android: <https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=vi>
- Safari trên iPhone: <https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27>

Phiên bản giao: **2026-11-21-giacngu-v1-final**.
