import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { ToastService } from '../../services/toast.service';
import { Product } from '../../models/product.model';
import { OrderStatus } from '../../models/order.model';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  userEmail = signal<string>('');
  userName = signal<string>('Khách hàng');
  userRole = signal<string>('user');
  isLoggedIn = signal<boolean>(false);

  products = signal<Product[]>([]);
  cartItems = signal<CartItem[]>([]);
  isCartOpen = signal<boolean>(false);

  totalCartQuantity = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0),
  );

  totalCartPrice = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  );

  ngOnInit() {
    this.products.set(this.productService.products().filter((p) => p.isActive));

    if (isPlatformBrowser(this.platformId)) {
      const email = localStorage.getItem('user_email');
      const role = localStorage.getItem('user_role');
      const name = localStorage.getItem('user_name');
      const token = localStorage.getItem('auth_token');

      this.isLoggedIn.set(!!(email && token));

      if (email) this.userEmail.set(email);
      if (role) this.userRole.set(role);
      if (name && name.trim()) {
        this.userName.set(name.trim());
      } else if (email && email.trim()) {
        const prefix = email.split('@')[0];
        const parts = prefix.split(/[._-]/);
        const derived = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        this.userName.set(derived || 'Khách hàng');
      }

      // Check if redirected back after login to complete order
      const shouldOpenCart =
        sessionStorage.getItem('open_cart_after_login') ||
        localStorage.getItem('open_cart_after_login');

      if (shouldOpenCart === 'true') {
        sessionStorage.removeItem('open_cart_after_login');
        localStorage.removeItem('open_cart_after_login');

        const savedCart =
          sessionStorage.getItem('user_cart') || localStorage.getItem('user_cart');
        if (savedCart) {
          try {
            const parsed = JSON.parse(savedCart);
            const allProducts = this.productService.products();
            const restoredItems: CartItem[] = [];

            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const pid = item.productId || item.product?.id;
                const foundProduct = allProducts.find((p) => p.id === pid);
                if (foundProduct) {
                  restoredItems.push({
                    product: foundProduct,
                    quantity: item.quantity || 1,
                  });
                }
              }
            }
            this.cartItems.set(restoredItems);
          } catch (e) {
            console.error('Failed to parse cart:', e);
          }
        }

        // Remove cart from storage after restoring for login redirect flow
        sessionStorage.removeItem('user_cart');
        localStorage.removeItem('user_cart');

        this.isCartOpen.set(true);
        if (this.cartItems().length > 0) {
          this.toastService.info(
            'Đăng nhập thành công! Giỏ hàng của bạn đã được giữ nguyên, hãy bấm "Đặt hàng ngay" để hoàn tất.',
            'Giỏ hàng đã sẵn sàng'
          );
        }
      } else {
        // Page reloaded or closed/reopened fresh -> clear cart
        sessionStorage.removeItem('user_cart');
        localStorage.removeItem('user_cart');
        this.cartItems.set([]);
      }
    }
  }

  private saveCart(items: CartItem[]) {
    this.cartItems.set(items);
    if (isPlatformBrowser(this.platformId)) {
      try {
        const lightweightCart = items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        }));
        sessionStorage.setItem('user_cart', JSON.stringify(lightweightCart));
      } catch (e) {
        console.error('Error saving cart to sessionStorage:', e);
      }
    }
  }

  addToCart(product: Product) {
    if (this.userRole() === 'admin') {
      this.toastService.warning('Tài khoản quản trị (Admin) không thể đặt hàng!');
      return;
    }
    if (!product.inStock || product.quantity <= 0) {
      this.toastService.warning(`Sản phẩm "${product.name}" hiện đang hết hàng!`);
      return;
    }

    const currentCart = [...this.cartItems()];
    const existingIndex = currentCart.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      const currentQty = currentCart[existingIndex].quantity;
      if (currentQty >= product.quantity) {
        this.toastService.warning(
          `Số lượng trong giỏ hàng đã đạt giới hạn tồn kho (${product.quantity})!`,
        );
        return;
      }
      currentCart[existingIndex] = {
        ...currentCart[existingIndex],
        quantity: currentQty + 1,
      };
    } else {
      currentCart.push({ product, quantity: 1 });
    }

    this.saveCart(currentCart);
    this.toastService.success(`Đã thêm "${product.name}" vào giỏ hàng!`);
  }

  openCartModal() {
    this.isCartOpen.set(true);
  }

  closeCartModal() {
    this.isCartOpen.set(false);
  }

  updateQuantity(productId: number, delta: number) {
    const currentCart = [...this.cartItems()];
    const index = currentCart.findIndex((item) => item.product.id === productId);

    if (index >= 0) {
      const item = currentCart[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        this.removeFromCart(productId);
        return;
      }

      if (newQty > item.product.quantity) {
        this.toastService.warning(
          `Không thể tăng quá số lượng tồn kho (${item.product.quantity})!`,
        );
        return;
      }

      currentCart[index] = { ...item, quantity: newQty };
      this.saveCart(currentCart);
    }
  }

  removeFromCart(productId: number) {
    const currentCart = this.cartItems().filter((item) => item.product.id !== productId);
    this.saveCart(currentCart);
    this.toastService.info('Đã xóa sản phẩm khỏi giỏ hàng.');
  }

  checkoutCart() {
    if (this.cartItems().length === 0) {
      this.toastService.warning('Giỏ hàng của bạn hiện đang trống!');
      return;
    }

    // Check authentication state
    const isBrowser = isPlatformBrowser(this.platformId);
    const email = isBrowser ? localStorage.getItem('user_email') : null;
    const token = isBrowser ? localStorage.getItem('auth_token') : null;

    if (!email || !token) {
      this.saveCart(this.cartItems());
      if (isBrowser) {
        sessionStorage.setItem('open_cart_after_login', 'true');
        localStorage.setItem('open_cart_after_login', 'true');
      }
      this.toastService.warning(
        'Vui lòng đăng nhập để tiến hành đặt hàng! Giỏ hàng của bạn sẽ được lưu lại.',
        'Yêu cầu đăng nhập'
      );
      this.closeCartModal();
      this.router.navigate(['/login']);
      return;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newOrderData = {
      orderCode: `DH-${Math.floor(89000 + Math.random() * 999)}`,
      userName: this.userName() || 'Khách hàng',
      customerEmail: this.userEmail() || email,
      customerPhone: '0912 345 678',
      shippingAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      orderDate: dateStr,
      deliveryDate: null,
      totalAmount: this.totalCartPrice(),
      status: 'pending' as OrderStatus,
      paymentMethod: 'Thanh toán khi nhận hàng (COD)',
      items: this.cartItems().map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
      })),
    };

    const createdOrder = this.orderService.addOrder(newOrderData);

    // Reset cart
    this.saveCart([]);
    this.closeCartModal();

    this.toastService.success(
      `Đặt hàng & Thanh toán thành công! Mã đơn hàng: ${createdOrder.orderCode}`,
      'Hoàn tất mua hàng',
    );
  }

  onLogout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_cart');
      localStorage.removeItem('open_cart_after_login');
      sessionStorage.removeItem('user_cart');
      sessionStorage.removeItem('open_cart_after_login');
    }
    this.isLoggedIn.set(false);
    this.saveCart([]);
    this.router.navigate(['/login']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}
