# E-Projct
Xây dựng một trang Web Quản trị Bán hàng (Admin Dashboard) đơn giản bằng Angular. Dự án này giúp bạn thực hành toàn bộ kiến thức Frontend cốt lõi: Component Lifecycle, Routing, Reactive Forms, State Management, Reusable Components và RxJS/Signals. 
🛠 Yêu cầu Kỹ thuật (Technical Stack) 
Framework: Angular (Ưu tiên dùng Standalone Components). 
Data Handling: Dùng Mock Data (JSON file) + localStorage để lưu và biến đổi dữ liệu (thêm/sửa/xóa) ngay ở Client-side. 
UI Library: Bạn được tự chọn Angular Material, TailwindCSS, Ng-Zorro hoặc PrimeNG. 📋 
Danh sách Feature & Bài tập chi tiết 
1. Authentication (Giả lập Đăng nhập) 
Mô tả: Trang Login cho phép truy cập vào hệ thống. 
Yêu cầu: Form gồm Email và Password (Sử dụng Reactive Forms + Validate định dạng Email, độ dài Password). 
Giả lập đăng nhập: Kiểm tra thông tin cố định (ví dụ: admin@gmail.com / 123456). 
Nếu đúng, lưu một token giả lập vào localStorage. 
Sử dụng CanActivate Guard để bảo vệ các route bên trong (nếu chưa "login" thì quay về trang Login). 
2. Layout & Navigation 
Mô tả: Khung giao diện chính sau khi đăng nhập. Yêu cầu: Sidebar Navigation: Chuyển đổi qua lại giữa các trang (Dashboard, Quản lý Sản phẩm, Quản lý Đơn hàng). 
Header: Hiển thị thông tin Admin và nút Logout (xoá token khỏi localStorage và đẩy về trang Login). 
Sử dụng Lazy Loading cho các Route để tối ưu tốc độ tải. 
3. Quản lý Sản phẩm (Product Management - CRUD)
Mô tả: Trang chức năng chính để thao tác dữ liệu. 
Yêu cầu: Danh sách (List View): Hiển thị danh sách sản phẩm dạng Table (Có phân trang Client-side, ví dụ: 5/10 sản phẩm 1 trang). 
Ô Search Input: Tìm kiếm sản phẩm theo tên theo thời gian thực (Real-time search dùng debounceTime của RxJS). 
Filter: Lọc theo Danh mục (Category) hoặc Trạng thái (Còn hàng/Hết hàng). 
Sort: Sắp xếp theo Giá (Tăng/Giảm) hoặc Tên (A-Z). 
Thêm mới / Chỉnh sửa (Form View): Tạo Modal hoặc Sub-route riêng cho Form. 
Xử lý Form phức tạp với Reactive Forms: Tên, Giá, Danh mục (Dropdown), Trạng thái (Radio/Checkbox), Mô tả. 
Validation: Bắt buộc nhập Tên, Giá phải > 0. Hiển thị thông báo lỗi rõ ràng bên dưới field. 
Khi lưu: Cập nhật lại State/localStorage và render lại danh sách lập tức không cần Reload trang. 
Xóa (Delete): Bật Confirm Dialog (Modal hỏi lại trước khi xóa). 
4. Quản lý Đơn hàng (Order Management) 
Mô tả: Quản lý và đổi trạng thái đơn hàng. 
Yêu cầu: Xem danh sách các đơn hàng có sẵn từ Mock Data.
Cho phép Admin đổi trạng thái đơn hàng: Pending -> Processing -> Completed -> Cancelled. Cập nhật trạng thái trực tiếp vào localStorage. 
5. Dashboard / Thống kê đơn giản 
Mô tả: Trang tổng quan hiển thị các chỉ số kinh doanh. 
Yêu cầu: Tạo 4 thẻ Metric đơn giản: Tổng số sản phẩm. Tổng số đơn hàng. Tổng doanh thu (tính tổng tiền các đơn Completed). Số sản phẩm đã hết hàng. Các số liệu này phải tự động cập nhật (Dynamic) khi bạn thêm/sửa/xóa Sản phẩm hoặc Đơn hàng ở các trang khác.

