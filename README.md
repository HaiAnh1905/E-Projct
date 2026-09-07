# E-Projct
# 🛒 Xây dựng Web Quản trị Bán hàng bằng Angular

Dự án xây dựng một **Web Quản trị Bán hàng (Admin Dashboard)** đơn giản bằng Angular.
Mục tiêu là thực hành các kiến thức Frontend cốt lõi như **Component Lifecycle, Routing, Reactive Forms, State Management, Reusable Components và RxJS/Signals**.

---

## 🛠️ Yêu cầu Kỹ thuật

* **Framework:** Angular – ưu tiên sử dụng Standalone Components.
* **Data Handling:** Sử dụng Mock Data (JSON file) kết hợp với `localStorage` để lưu và biến đổi dữ liệu (thêm/sửa/xóa) ở Client-side.
* **UI Library:** Tự chọn một trong các thư viện:

  * Angular Material
  * TailwindCSS
  * Ng-Zorro
  * PrimeNG

---

# 📋 Danh sách Chức năng

## 🔐 1. Authentication – Đăng nhập

Xây dựng trang Login cho phép Admin truy cập vào hệ thống.

### Yêu cầu:

* Form gồm **Email** và **Password**.
* Sử dụng **Reactive Forms**.
* Validate:

  * Email đúng định dạng.
  * Password có độ dài hợp lệ.
* Giả lập đăng nhập bằng thông tin cố định, ví dụ:

  * Email: `admin@gmail.com`
  * Password: `123456`
* Nếu đăng nhập thành công:

  * Lưu một token giả lập vào `localStorage`.
* Sử dụng **CanActivate Guard** để bảo vệ các route bên trong.
* Nếu chưa đăng nhập → chuyển hướng về trang **Login**.

---

## 🖥️ 2. Layout & Navigation – Giao diện quản trị

Xây dựng Layout chính sau khi Admin đăng nhập.

### Sidebar Navigation

Cho phép chuyển đổi giữa các trang:

* 📊 Dashboard
* 📦 Quản lý sản phẩm
* 🧾 Quản lý đơn hàng

### Header

* 👤 Hiển thị thông tin Admin.
* 🚪 Có nút **Logout**.

### Logout

Khi Logout:

* Xóa token khỏi `localStorage`.
* Chuyển hướng về trang Login.

### Routing

* Sử dụng **Lazy Loading** cho các Route để tối ưu tốc độ tải.

---

## 📦 3. Product Management – Quản lý sản phẩm

Trang chính để thực hiện các thao tác **CRUD** với sản phẩm.

### 📋 Danh sách sản phẩm

Hiển thị danh sách sản phẩm dưới dạng **Table**.

Yêu cầu:

* Client-side Pagination.
* Có thể hiển thị khoảng **5 hoặc 10 sản phẩm mỗi trang**.
* 🔍 Search sản phẩm theo tên.
* 🏷️ Filter theo:

  * Danh mục (Category).
  * Trạng thái (Còn hàng / Hết hàng).
* ↕️ Sort theo:

  * Giá tăng/giảm.
  * Tên A-Z.

### 🔎 Tìm kiếm sản phẩm

* Tìm kiếm theo thời gian thực.
* Sử dụng `debounceTime` của **RxJS**.

### ➕ Thêm / ✏️ Chỉnh sửa sản phẩm

Có thể sử dụng **Modal** hoặc **Sub-route riêng** cho Form.

Form gồm:

* Tên sản phẩm.
* Giá.
* Danh mục.
* Trạng thái.
* Mô tả.

Sử dụng **Reactive Forms** để xử lý Form.

### ✅ Validation

* Tên sản phẩm: bắt buộc nhập.
* Giá: bắt buộc và phải `> 0`.
* Hiển thị thông báo lỗi rõ ràng bên dưới mỗi field.

### 💾 Lưu sản phẩm

Khi lưu:

* Cập nhật State.
* Cập nhật `localStorage`.
* Render lại danh sách ngay lập tức.
* Không cần Reload trang.

### 🗑️ Xóa sản phẩm

* Hiển thị **Confirm Dialog** trước khi xóa.
* Nếu xác nhận:

  * Xóa sản phẩm.
  * Cập nhật State.
  * Cập nhật `localStorage`.
  * Render lại danh sách.

---

## 🧾 4. Order Management – Quản lý đơn hàng

Xây dựng trang quản lý các đơn hàng có sẵn từ Mock Data.

### Yêu cầu:

* Hiển thị danh sách đơn hàng.
* Cho phép Admin thay đổi trạng thái đơn hàng.

### 🔄 Trạng thái đơn hàng

```text
Pending → Processing → Completed → Cancelled
```

* Khi thay đổi trạng thái, cập nhật trực tiếp vào `localStorage`.

---

## 📊 5. Dashboard – Thống kê

Trang Dashboard hiển thị các số liệu tổng quan về hoạt động bán hàng.

### Yêu cầu:

Tạo 4 thẻ thống kê:

* 📦 **Tổng số sản phẩm**
* 🧾 **Tổng số đơn hàng**
* 💰 **Tổng doanh thu** – tính tổng tiền của các đơn hàng có trạng thái `Completed`.
* 🔴 **Số sản phẩm hết hàng**

Các số liệu phải **tự động cập nhật** khi Admin thêm/sửa/xóa sản phẩm hoặc thay đổi đơn hàng ở các trang khác.


