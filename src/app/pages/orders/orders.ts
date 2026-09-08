import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { ToastService } from '../../services/toast.service';
import { Order, OrderStatus } from '../../models/order.model';

@Component({
  selector: 'app-orders-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private toastService = inject(ToastService);

  private searchSubject = new Subject<string>();
  private filterSubject = new Subject<void>();

  private searchSub?: Subscription;
  private filterSub?: Subscription;

  // Search input UI signal
  searchQuery = signal<string>('');

  // Pending filter UI selections
  selectedStatus = signal<string>('all');
  selectedSort = signal<string>('date-desc');

  // Debounced applied filter state
  appliedSearch = signal<string>('');
  appliedStatus = signal<string>('all');
  appliedSort = signal<string>('date-desc');

  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  // Modals State
  selectedOrderForDetail = signal<Order | null>(null);
  selectedOrderForStatus = signal<Order | null>(null);
  deletingOrder = signal<Order | null>(null);

  // Form signal bindings for status modal
  newStatus = signal<OrderStatus>('pending');
  newDeliveryDate = signal<string>('');
  cancelReasonInput = signal<string>('');
  returnReasonInput = signal<string>('');
  returnDateInput = signal<string>('');

  initialStatusModalState = signal<{
    status: OrderStatus;
    deliveryDate: string;
    cancelReason: string;
    returnReason: string;
    returnDate: string;
  }>({
    status: 'pending',
    deliveryDate: '',
    cancelReason: '',
    returnReason: '',
    returnDate: '',
  });

  // Track if any form fields have been modified compared to initial state
  hasFormChanges = computed(() => {
    const order = this.selectedOrderForStatus();
    if (!order) return false;

    const initial = this.initialStatusModalState();
    const currentStatus = this.newStatus();
    const currentDeliveryDate = this.newDeliveryDate().trim();
    const currentCancelReason = this.cancelReasonInput().trim();
    const currentReturnReason = this.returnReasonInput().trim();
    const currentReturnDate = this.returnDateInput().trim();

    if (currentStatus !== initial.status) {
      return true;
    }

    if (currentStatus === 'delivered') {
      return currentDeliveryDate !== initial.deliveryDate.trim();
    }

    if (currentStatus === 'cancelled') {
      return currentCancelReason !== initial.cancelReason.trim();
    }

    if (currentStatus === 'returned') {
      return (
        currentReturnReason !== initial.returnReason.trim() ||
        currentReturnDate !== initial.returnDate.trim()
      );
    }

    return false;
  });

  allOrders = computed<Order[]>(() => this.orderService.orders());

  // Check stock availability for status transition
  stockValidation = computed(() => {
    const order = this.selectedOrderForStatus();
    const targetStatus = this.newStatus();
    if (!order) return { isBlocked: false, outOfStockItems: [] as string[] };

    const currentStatus = order.status;
    const isMovingForward =
      (currentStatus === 'pending' || currentStatus === 'processing') &&
      (targetStatus === 'shipped' || targetStatus === 'delivered');

    if (!isMovingForward) {
      return { isBlocked: false, outOfStockItems: [] as string[] };
    }

    const allProducts = this.productService.products();
    const outOfStockItems: string[] = [];

    for (const item of order.items) {
      const matchedProd = allProducts.find(
        (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
      );
      if (!matchedProd || matchedProd.quantity <= 0 || matchedProd.quantity < item.quantity) {
        const available = matchedProd ? matchedProd.quantity : 0;
        outOfStockItems.push(`${item.productName} (Còn ${available}, cần ${item.quantity})`);
      }
    }

    return {
      isBlocked: outOfStockItems.length > 0,
      outOfStockItems,
    };
  });

  // Validation against future delivery dates
  futureDateValidation = computed(() => {
    if (this.newStatus() === 'delivered' && this.newDeliveryDate().trim()) {
      const inputTime = this.parseOrderDate(this.newDeliveryDate());
      const now = Date.now();
      if (inputTime > now) {
        return {
          isBlocked: true,
          message: 'Ngày hàng được giao không được vượt quá thời điểm hiện tại.',
        };
      }
    }
    return { isBlocked: false, message: '' };
  });

  // Validation for cancellation reason when status is changed to cancelled
  cancelReasonValidation = computed(() => {
    if (this.newStatus() === 'cancelled') {
      const reason = this.cancelReasonInput().trim();
      if (!reason) {
        return { isBlocked: true, message: 'Vui lòng nhập lý do hủy đơn hàng.' };
      }
    }
    return { isBlocked: false, message: '' };
  });

  // Helper method to check if selecting a targetStatus is disabled for current order status
  isStatusOptionDisabled(targetStatus: OrderStatus): boolean {
    const order = this.selectedOrderForStatus();
    if (!order) return false;

    const current = order.status;

    // Same status is always allowed
    if (targetStatus === current) return false;

    // Terminal statuses (cancelled or returned) cannot be changed to any other status
    if (current === 'cancelled' || current === 'returned') return true;

    // 'returned' can ONLY be selected if current status is 'delivered'
    if (targetStatus === 'returned') {
      return current !== 'delivered';
    }

    // 'cancelled' can ONLY be selected BEFORE 'delivered' (i.e., not allowed if current is 'delivered')
    if (targetStatus === 'cancelled') {
      return current === 'delivered';
    }

    // Forward progression sequence: pending (0) -> processing (1) -> shipped (2) -> delivered (3)
    const statusOrderMap: Record<OrderStatus, number> = {
      pending: 0,
      processing: 1,
      shipped: 2,
      delivered: 3,
      cancelled: 99,
      returned: 99,
    };

    const currentRank = statusOrderMap[current] ?? 0;
    const targetRank = statusOrderMap[targetStatus] ?? 0;

    // Cannot move backward to a previous step in the pipeline
    return targetRank < currentRank;
  }

  // Unified Status Transition Validation Computed Signal
  statusTransitionValidation = computed(() => {
    const order = this.selectedOrderForStatus();
    const targetStatus = this.newStatus();
    if (!order) return { isBlocked: false, message: '' };

    if (this.isStatusOptionDisabled(targetStatus)) {
      const currentLabel = this.getStatusLabel(order.status);
      const targetLabel = this.getStatusLabel(targetStatus);

      if (order.status === 'cancelled' || order.status === 'returned') {
        return {
          isBlocked: true,
          message: `Đơn hàng đã ở trạng thái cuối "${currentLabel}". Không thể thay đổi sang trạng thái khác.`,
        };
      }

      if (targetStatus === 'returned') {
        return {
          isBlocked: true,
          message: 'Chỉ có thể chọn Trả hàng khi đơn hàng đang ở trạng thái "Đã giao hàng".',
        };
      }

      if (targetStatus === 'cancelled') {
        return {
          isBlocked: true,
          message: 'Không thể Hủy đơn sau khi đơn hàng đã ở trạng thái "Đã giao hàng".',
        };
      }

      return {
        isBlocked: true,
        message: `Không thể chuyển lùi từ trạng thái "${currentLabel}" về "${targetLabel}". Quy trình phải đi tiến: Chờ xử lý ➔ Đang xử lý ➔ Đang giao hàng ➔ Đã giao hàng.`,
      };
    }

    return { isBlocked: false, message: '' };
  });

  // Validation for return reason when status is changed to returned
  returnReasonValidation = computed(() => {
    if (this.newStatus() === 'returned') {
      const reason = this.returnReasonInput().trim();
      if (!reason) {
        return { isBlocked: true, message: 'Vui lòng nhập lý do trả hàng.' };
      }
    }
    return { isBlocked: false, message: '' };
  });

  // Validation against return dates before order date or delivery date, or in the future
  returnDateValidation = computed(() => {
    if (this.newStatus() === 'returned') {
      const order = this.selectedOrderForStatus();
      const returnInput = this.returnDateInput().trim();
      if (!order) return { isBlocked: false, message: '' };

      const minDateStr = order.deliveryDate || order.orderDate;
      const minTime = this.parseOrderDate(minDateStr);
      const now = Date.now();

      const returnTime = returnInput ? this.parseOrderDate(returnInput) : now;

      if (returnTime > now) {
        return {
          isBlocked: true,
          message: 'Ngày trả hàng không được vượt quá thời điểm hiện tại.',
        };
      }

      if (minTime > 0 && returnTime < minTime) {
        const dateTypeLabel = order.deliveryDate ? 'Ngày giao hàng' : 'Ngày đặt hàng';
        return {
          isBlocked: true,
          message: `Ngày trả hàng (${returnInput || 'Thời gian hiện tại'}) không được trước ${dateTypeLabel} (${minDateStr}).`,
        };
      }
    }
    return { isBlocked: false, message: '' };
  });

  // Statistics Summary
  totalOrdersCount = computed(() => this.allOrders().length);

  pendingOrdersCount = computed(
    () =>
      this.allOrders().filter((o) => o.status === 'pending' || o.status === 'processing').length,
  );

  deliveredOrdersCount = computed(
    () => this.allOrders().filter((o) => o.status === 'delivered').length,
  );

  totalRevenue = computed(() =>
    this.allOrders()
      .filter((o) => o.status !== 'cancelled' && o.status !== 'returned')
      .reduce((sum, o) => sum + o.totalAmount, 0),
  );

  // Helper to parse date string safely into timestamp
  private parseOrderDate(dateStr: string | null | undefined): number {
    if (!dateStr || !dateStr.trim()) return 0;
    const trimmed = dateStr.trim();

    // Standard ISO YYYY-MM-DD HH:mm or YYYY-MM-DD
    const normalized = trimmed.replace(' ', 'T');
    const timestamp = new Date(normalized).getTime();
    if (!isNaN(timestamp)) return timestamp;

    // Parse YYYY-MM-DD HH:mm manually
    const matchIso = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const month = parseInt(matchIso[2], 10) - 1;
      const day = parseInt(matchIso[3], 10);
      const hour = matchIso[4] ? parseInt(matchIso[4], 10) : 0;
      const minute = matchIso[5] ? parseInt(matchIso[5], 10) : 0;
      return new Date(year, month, day, hour, minute).getTime();
    }

    // Parse DD/MM/YYYY HH:mm
    const matchDmy = trimmed.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const month = parseInt(matchDmy[2], 10) - 1;
      const year = parseInt(matchDmy[3], 10);
      const hour = matchDmy[4] ? parseInt(matchDmy[4], 10) : 0;
      const minute = matchDmy[5] ? parseInt(matchDmy[5], 10) : 0;
      return new Date(year, month, day, hour, minute).getTime();
    }

    return 0;
  }

  // Filtered & Sorted Orders
  filteredOrders = computed(() => {
    let result = [...this.allOrders()];
    const search = this.appliedSearch().trim().toLowerCase();
    const status = this.appliedStatus();
    const sort = this.appliedSort();

    if (search) {
      result = result.filter(
        (o) =>
          o.orderCode.toLowerCase().includes(search) ||
          o.userName.toLowerCase().includes(search) ||
          o.customerPhone.includes(search),
      );
    }

    if (status !== 'all') {
      if (status === 'processing') {
        result = result.filter((o) => o.status === 'pending' || o.status === 'processing');
      } else {
        result = result.filter((o) => o.status === status);
      }
    }

    result.sort((a, b) => {
      if (sort === 'date-desc') {
        return this.parseOrderDate(b.orderDate) - this.parseOrderDate(a.orderDate);
      }
      if (sort === 'date-asc') {
        return this.parseOrderDate(a.orderDate) - this.parseOrderDate(b.orderDate);
      }
      if (sort === 'delivery-desc') {
        return this.parseOrderDate(b.deliveryDate) - this.parseOrderDate(a.deliveryDate);
      }
      if (sort === 'delivery-asc') {
        return this.parseOrderDate(a.deliveryDate) - this.parseOrderDate(b.deliveryDate);
      }
      if (sort === 'price-desc') {
        return b.totalAmount - a.totalAmount;
      }
      if (sort === 'price-asc') {
        return a.totalAmount - b.totalAmount;
      }
      return 0;
    });

    return result;
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredOrders().length / this.pageSize()) || 1;
  });

  paginatedOrders = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    return this.filteredOrders().slice(startIndex, startIndex + size);
  });

  startIndex = computed(() => {
    if (this.filteredOrders().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredOrders().length);
  });

  ngOnInit() {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.appliedSearch.set(query);
        this.currentPage.set(1);
      });

    this.filterSub = this.filterSubject.pipe(debounceTime(200)).subscribe(() => {
      this.appliedStatus.set(this.selectedStatus());
      this.appliedSort.set(this.selectedSort());
      this.currentPage.set(1);
    });
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
    this.filterSub?.unsubscribe();
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.searchSubject.next(input.value);
  }

  onStatusChange(status: string) {
    this.selectedStatus.set(status);
    this.appliedStatus.set(status);
    this.currentPage.set(1);
  }

  onMetricClick(status: string) {
    this.selectedStatus.set(status);
    this.appliedStatus.set(status);
    this.currentPage.set(1);
  }

  onSortChange(sort: string) {
    this.selectedSort.set(sort);
    this.appliedSort.set(sort);
    this.currentPage.set(1);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedStatus.set('all');
    this.selectedSort.set('date-desc');

    this.appliedSearch.set('');
    this.appliedStatus.set('all');
    this.appliedSort.set('date-desc');
    this.currentPage.set(1);
  }

  // --- Modal Actions ---

  openDetailModal(order: Order) {
    this.selectedOrderForDetail.set(order);
  }

  closeDetailModal() {
    this.selectedOrderForDetail.set(null);
  }

  openStatusModal(order: Order) {
    this.selectedOrderForStatus.set(order);

    const initStatus = order.status;
    const initDeliveryDate = order.deliveryDate || '';
    const initCancelReason =
      order.cancelReason || (order.status === 'cancelled' ? 'Khách hàng yêu cầu hủy đơn' : '');
    const initReturnReason =
      order.returnReason || (order.status === 'returned' ? 'Khách hàng trả lại sản phẩm' : '');
    const initReturnDate =
      order.returnDate ||
      (order.status === 'returned' ? (order.deliveryDate || order.orderDate) : '');

    this.newStatus.set(initStatus);
    this.newDeliveryDate.set(initDeliveryDate);
    this.cancelReasonInput.set(initCancelReason);
    this.returnReasonInput.set(initReturnReason);
    this.returnDateInput.set(initReturnDate);

    this.initialStatusModalState.set({
      status: initStatus,
      deliveryDate: initDeliveryDate,
      cancelReason: initCancelReason,
      returnReason: initReturnReason,
      returnDate: initReturnDate,
    });
  }

  onModalStatusChange(status: OrderStatus) {
    this.newStatus.set(status);
    const order = this.selectedOrderForStatus();
    if (!order) return;

    if (status === 'returned') {
      if (!this.returnReasonInput().trim()) {
        this.returnReasonInput.set(order.returnReason || 'Khách hàng trả lại sản phẩm');
      }
      if (!this.returnDateInput().trim()) {
        this.returnDateInput.set(
          order.returnDate || order.deliveryDate || order.orderDate || '',
        );
      }
    } else if (status === 'cancelled') {
      if (!this.cancelReasonInput().trim()) {
        this.cancelReasonInput.set(order.cancelReason || 'Khách hàng yêu cầu hủy đơn');
      }
    } else if (status === 'delivered') {
      if (!this.newDeliveryDate().trim()) {
        this.newDeliveryDate.set(order.deliveryDate || '');
      }
    }
  }

  closeStatusModal() {
    this.selectedOrderForStatus.set(null);
  }

  saveStatusUpdate() {
    const target = this.selectedOrderForStatus();
    if (!target) return;

    if (!this.hasFormChanges()) return;

    if (
      this.stockValidation().isBlocked ||
      this.futureDateValidation().isBlocked ||
      this.cancelReasonValidation().isBlocked ||
      this.returnReasonValidation().isBlocked ||
      this.returnDateValidation().isBlocked ||
      this.statusTransitionValidation().isBlocked
    ) {
      let msg = 'Không thể cập nhật trạng thái do vi phạm điều kiện chuyển trạng thái đơn hàng.';
      if (this.statusTransitionValidation().isBlocked) msg = this.statusTransitionValidation().message;
      if (this.cancelReasonValidation().isBlocked) msg = this.cancelReasonValidation().message;
      if (this.returnReasonValidation().isBlocked) msg = this.returnReasonValidation().message;
      if (this.returnDateValidation().isBlocked) msg = this.returnDateValidation().message;
      this.toastService.error(msg);
      return;
    }

    const currentStatus = target.status;
    const nextStatus = this.newStatus();

    // CASE 1: Order is cancelled
    if (nextStatus === 'cancelled') {
      const reason = this.cancelReasonInput().trim();
      const wasShippedOrDelivered = currentStatus === 'shipped' || currentStatus === 'delivered';

      if (wasShippedOrDelivered) {
        // Restore stock (increase product quantity in inventory)
        const currentProducts = this.productService.products();
        for (const item of target.items) {
          const prod = currentProducts.find(
            (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
          );
          if (prod) {
            const newQty = prod.quantity + item.quantity;
            this.productService.updateProduct(prod.id, {
              quantity: newQty,
              inStock: true,
            });
          }
        }
      }

      this.orderService.updateOrderStatus(target.id, 'cancelled', null, reason);

      if (wasShippedOrDelivered) {
        this.toastService.warning(
          `Đã hủy đơn hàng #${target.orderCode} (Lý do: ${reason}) và hoàn trả lại số lượng sản phẩm vào kho!`,
        );
      } else {
        this.toastService.warning(`Đã hủy đơn hàng #${target.orderCode} (Lý do: ${reason})!`);
      }

      this.closeStatusModal();
      return;
    }

    // CASE 2: Order is returned
    if (nextStatus === 'returned') {
      const reason = this.returnReasonInput().trim();
      const returnDate = this.returnDateInput().trim() || null;

      // Automatically restore stock (increase product quantity in inventory)
      if (currentStatus !== 'returned') {
        const currentProducts = this.productService.products();
        for (const item of target.items) {
          const prod = currentProducts.find(
            (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
          );
          if (prod) {
            const newQty = prod.quantity + item.quantity;
            this.productService.updateProduct(prod.id, {
              quantity: newQty,
              inStock: true,
            });
          }
        }
      }

      this.orderService.updateOrderStatus(target.id, 'returned', null, null, returnDate, reason);

      this.toastService.warning(
        `Đã chuyển đơn hàng #${target.orderCode} sang Trả hàng (Lý do: ${reason}) và tự động cộng lại số lượng sản phẩm vào kho!`,
      );

      this.closeStatusModal();
      return;
    }

    // CASE 3: Transition from pre-fulfillment (pending/processing) to fulfillment (shipped/delivered)
    const isDeductingStock =
      (currentStatus === 'pending' || currentStatus === 'processing') &&
      (nextStatus === 'shipped' || nextStatus === 'delivered');

    if (isDeductingStock) {
      const allProducts = this.productService.products();
      for (const item of target.items) {
        const prod = allProducts.find(
          (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
        );
        if (prod) {
          const newQty = Math.max(0, prod.quantity - item.quantity);
          this.productService.updateProduct(prod.id, {
            quantity: newQty,
            inStock: newQty > 0,
          });
        }
      }
    }

    const delivery = this.newDeliveryDate().trim() || null;
    const statusLabel = this.getStatusLabel(nextStatus);
    this.orderService.updateOrderStatus(target.id, nextStatus, delivery);

    if (isDeductingStock) {
      this.toastService.success(
        `Đã cập nhật trạng thái đơn hàng #${target.orderCode} thành "${statusLabel}" và tự động giảm số lượng sản phẩm trong kho!`,
      );
    } else {
      this.toastService.success(
        `Đã cập nhật trạng thái đơn hàng #${target.orderCode} thành "${statusLabel}"!`,
      );
    }

    this.closeStatusModal();
  }

  deleteValidation = computed(() => {
    const target = this.deletingOrder();
    if (!target) return { allowed: true, message: '' };

    if (target.status === 'delivered') {
      return {
        allowed: false,
        message:
          'Đơn hàng đã phát sinh giao dịch (Đã giao hàng thành công) KHÔNG được phép xóa để đảm bảo toàn vẹn dữ liệu giao dịch & báo cáo doanh thu.',
      };
    }

    if (target.status !== 'cancelled' && target.status !== 'returned') {
      return {
        allowed: false,
        message: `Đơn hàng đang ở trạng thái "${this.getStatusLabel(target.status)}". Chỉ được phép Xóa đối với các đơn hàng ở trạng thái "Đã hủy" hoặc "Trả hàng".`,
      };
    }

    return { allowed: true, message: '' };
  });

  openDeleteModal(order: Order) {
    this.deletingOrder.set(order);
  }

  closeDeleteModal() {
    this.deletingOrder.set(null);
  }

  confirmDeleteOrder() {
    const target = this.deletingOrder();
    if (target) {
      if (!this.deleteValidation().allowed) {
        this.toastService.error(this.deleteValidation().message);
        return;
      }

      const success = this.orderService.softDeleteOrder(target.id);
      if (success) {
        this.toastService.warning(`Đã thực hiện Xóa đơn hàng #${target.orderCode} thành công!`);
      } else {
        this.toastService.error(`Không thể xóa đơn hàng #${target.orderCode}.`);
      }
    }
    this.closeDeleteModal();
  }

  // Helpers
  get maxAllowedDatetime(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  minAllowedReturnDatetime = computed(() => {
    const order = this.selectedOrderForStatus();
    if (!order) return '';
    const baseDate = order.deliveryDate || order.orderDate;
    return this.formatForDatetimeLocal(baseDate);
  });

  splitDate(dateStr: string | null | undefined): { date: string; time: string } {
    if (!dateStr || !dateStr.trim()) return { date: '', time: '' };
    const trimmed = dateStr.trim().replace('T', ' ');
    const parts = trimmed.split(' ');
    if (parts.length >= 2) {
      return { date: parts[0], time: parts[1] };
    }
    return { date: trimmed, time: '' };
  }

  formatForDatetimeLocal(dateStr: string | null | undefined): string {
    if (!dateStr || !dateStr.trim()) return '';
    const trimmed = dateStr.trim();
    if (trimmed.includes('T')) return trimmed.slice(0, 16);
    const match = trimmed.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (match) {
      return `${match[1]}T${match[2]}`;
    }
    return trimmed;
  }

  onDeliveryDatePicked(val: string) {
    if (!val) {
      this.newDeliveryDate.set('');
      return;
    }
    this.newDeliveryDate.set(val.replace('T', ' '));
  }

  onReturnDatePicked(val: string) {
    if (!val) {
      this.returnDateInput.set('');
      return;
    }
    this.returnDateInput.set(val.replace('T', ' '));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'pending':
        return 'Chờ xử lý';
      case 'processing':
        return 'Đang xử lý';
      case 'shipped':
        return 'Đang giao hàng';
      case 'delivered':
        return 'Đã giao hàng';
      case 'cancelled':
        return 'Đã hủy';
      case 'returned':
        return 'Trả hàng';
      default:
        return status;
    }
  }
}
