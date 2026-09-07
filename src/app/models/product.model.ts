export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  quantity: number;
  inStock: boolean;
  isActive: boolean;
  description: string;
}

export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: 'iPhone 16 Pro Max 256GB', price: 34990000, category: 'Điện thoại', quantity: 25, inStock: true, isActive: true, description: 'Thiết kế Titan sa mạc, chip A18 Pro mạnh mẽ.' },
  { id: 2, name: 'Samsung Galaxy S24 Ultra 512GB', price: 31990000, category: 'Điện thoại', quantity: 18, inStock: true, isActive: true, description: 'Quyền năng Galaxy AI, camera 200MP đột phá.' },
  { id: 3, name: 'MacBook Pro 14 M3 Pro 18GB/512GB', price: 49990000, category: 'Laptop', quantity: 8, inStock: true, isActive: true, description: 'Hiệu năng đỉnh cao cho lập trình viên và sáng tạo.' },
  { id: 4, name: 'Dell XPS 13 9340 i7 16GB/1TB', price: 42500000, category: 'Laptop', quantity: 0, inStock: false, isActive: false, description: 'Mỏng nhẹ cao cấp, màn hình OLED 3K siêu nét.' },
  { id: 5, name: 'iPad Pro 11 M4 WiFi 256GB', price: 28990000, category: 'Máy tính bảng', quantity: 12, inStock: true, isActive: true, description: 'Màn hình Ultra Retina XDR, thiết kế siêu mỏng.' },
  { id: 6, name: 'Apple Watch Series 10 GPS 46mm', price: 11490000, category: 'Đồng hồ', quantity: 30, inStock: true, isActive: true, description: 'Màn hình hiển thị lớn hơn, mỏng nhẹ thời trang.' },
  { id: 7, name: 'AirPods Pro 2 USB-C', price: 5690000, category: 'Tai nghe', quantity: 45, inStock: true, isActive: true, description: 'Chống ồn chủ động đỉnh cao, âm thanh spatial audio.' },
  { id: 8, name: 'Sony WH-1000XM5 Black', price: 7990000, category: 'Tai nghe', quantity: 0, inStock: false, isActive: true, description: 'Tai nghe chụp tai chống ồn tốt nhất phân khúc.' },
  { id: 9, name: 'Xiaomi 14 Ultra 16GB/512GB', price: 29990000, category: 'Điện thoại', quantity: 10, inStock: true, isActive: true, description: 'Ống kính Leica thế hệ mới, sạc siêu nhanh 90W.' },
  { id: 10, name: 'Asus ROG Zephyrus G16 2024', price: 54990000, category: 'Laptop', quantity: 5, inStock: true, isActive: true, description: 'Laptop Gaming mỏng nhẹ, chip RTX 4070 mạnh mẽ.' },
  { id: 11, name: 'Sạc Anker Prime 67W GaN', price: 1250000, category: 'Phụ kiện', quantity: 60, inStock: true, isActive: true, description: 'Củ sạc siêu nhỏ gọn 3 cổng sạc nhanh.' },
  { id: 12, name: 'Chuột không dây Logitech MX Master 3S', price: 2450000, category: 'Phụ kiện', quantity: 22, inStock: true, isActive: true, description: 'Chuột công bách học yên tĩnh cho dân văn phòng.' },
  { id: 13, name: 'Bàn phím cơ Keychron K2 Pro Wireless', price: 2190000, category: 'Phụ kiện', quantity: 0, inStock: false, isActive: false, description: 'Bàn phím cơ Bluetooth QMK/VIA tùy biến.' },
  { id: 14, name: 'Đồng hồ Garmin Fenix 7 Pro Sapphire', price: 22490000, category: 'Đồng hồ', quantity: 7, inStock: true, isActive: true, description: 'Đồng hồ thể thao chuyên nghiệp dùng năng lượng mặt trời.' },
  { id: 15, name: 'Tai nghe Marshall Motif II A.N.C', price: 4890000, category: 'Tai nghe', quantity: 14, inStock: true, isActive: true, description: 'Âm thanh chất lượng cao, thiết kế đậm chất rock.' }
];
