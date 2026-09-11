import { computed, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { INITIAL_ORDERS, Order, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private platformId = inject(PLATFORM_ID);
  private storageKey = 'admin_orders_data_v2';

  rawOrders = signal<Order[]>([]);
  orders: Signal<Order[]> = computed(() => this.rawOrders().filter((ord) => !ord.isDeleted));

  constructor() {
    this.loadOrders();
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('storage', (event) => {
        if (event.key === this.storageKey) {
          this.loadOrders();
        }
      });
    }
  }

  private parseDateTimestamp(dateStr: string | null | undefined): number {
    if (!dateStr || !dateStr.trim()) return 0;
    const trimmed = dateStr.trim();
    const normalized = trimmed.replace(' ', 'T');
    const timestamp = new Date(normalized).getTime();
    if (!isNaN(timestamp)) return timestamp;

    const matchIso = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const month = parseInt(matchIso[2], 10) - 1;
      const day = parseInt(matchIso[3], 10);
      const hour = matchIso[4] ? parseInt(matchIso[4], 10) : 0;
      const minute = matchIso[5] ? parseInt(matchIso[5], 10) : 0;
      return new Date(year, month, day, hour, minute).getTime();
    }
    return 0;
  }

  // Sanitizes all orders to ensure no order date, delivery date, or return date exceeds current time (Date.now())
  private sanitizeOrderList(list: Order[]): Order[] {
    const nowTime = Date.now();

    return list.map((ord) => {
      let orderTime = this.parseDateTimestamp(ord.orderDate);
      let deliveryTime = ord.deliveryDate ? this.parseDateTimestamp(ord.deliveryDate) : 0;

      let newOrderDate = ord.orderDate;
      let newDeliveryDate = ord.deliveryDate;

      // If orderDate is in the future (> Date.now()), clamp to current time
      if (orderTime > nowTime) {
        const dObj = new Date(nowTime);
        const pad = (n: number) => n.toString().padStart(2, '0');
        newOrderDate = `${dObj.getFullYear()}-${pad(dObj.getMonth() + 1)}-${pad(dObj.getDate())} ${pad(dObj.getHours())}:${pad(dObj.getMinutes())}`;
        orderTime = dObj.getTime();
      }

      const initialMatch = INITIAL_ORDERS.find((i) => i.id === ord.id);

      // deliveryDate is kept for both 'delivered' and 'returned' orders
      if (ord.status !== 'delivered' && ord.status !== 'returned') {
        newDeliveryDate = null;
      } else if (deliveryTime > nowTime) {
        const delTimeTarget = Math.min(
          nowTime,
          orderTime > 0 ? orderTime + 2 * 3600 * 1000 : nowTime,
        );
        const delObj = new Date(delTimeTarget);
        const pad = (n: number) => n.toString().padStart(2, '0');
        newDeliveryDate = `${delObj.getFullYear()}-${pad(delObj.getMonth() + 1)}-${pad(delObj.getDate())} ${pad(delObj.getHours())}:${pad(delObj.getMinutes())}`;
        deliveryTime = delTimeTarget;
      } else if (ord.status === 'returned') {
        let returnTime = ord.returnDate ? this.parseDateTimestamp(ord.returnDate) : nowTime;
        if (!newDeliveryDate || (deliveryTime > 0 && deliveryTime >= returnTime)) {
          if (
            initialMatch &&
            initialMatch.deliveryDate &&
            this.parseDateTimestamp(initialMatch.deliveryDate) < returnTime
          ) {
            newDeliveryDate = initialMatch.deliveryDate;
            deliveryTime = this.parseDateTimestamp(newDeliveryDate);
          } else {
            const baseTime = orderTime > 0 ? orderTime : Math.max(0, returnTime - 48 * 3600 * 1000);
            const delTimeTarget = Math.min(
              nowTime,
              Math.max(baseTime, returnTime - 24 * 3600 * 1000),
            );
            const delObj = new Date(delTimeTarget);
            const pad = (n: number) => n.toString().padStart(2, '0');
            newDeliveryDate = `${delObj.getFullYear()}-${pad(delObj.getMonth() + 1)}-${pad(delObj.getDate())} ${pad(delObj.getHours())}:${pad(delObj.getMinutes())}`;
            deliveryTime = delTimeTarget;
          }
        }
      } else if (!newDeliveryDate && ord.status === 'delivered') {
        if (initialMatch && initialMatch.deliveryDate) {
          newDeliveryDate = initialMatch.deliveryDate;
          deliveryTime = this.parseDateTimestamp(newDeliveryDate);
        } else {
          const delTimeTarget = Math.min(
            nowTime,
            orderTime > 0 ? orderTime + 2 * 3600 * 1000 : nowTime,
          );
          const delObj = new Date(delTimeTarget);
          const pad = (n: number) => n.toString().padStart(2, '0');
          newDeliveryDate = `${delObj.getFullYear()}-${pad(delObj.getMonth() + 1)}-${pad(delObj.getDate())} ${pad(delObj.getHours())}:${pad(delObj.getMinutes())}`;
          deliveryTime = delTimeTarget;
        }
      }

      let newReturnDate = ord.returnDate;
      if (ord.status !== 'returned') {
        newReturnDate = null;
      } else if (newReturnDate) {
        let returnTime = this.parseDateTimestamp(newReturnDate);
        const minTime = deliveryTime > 0 ? deliveryTime : orderTime;

        if (returnTime < minTime || returnTime > nowTime) {
          const retTimeTarget = Math.min(
            nowTime,
            minTime > 0 ? minTime + 2 * 3600 * 1000 : nowTime,
          );
          const retObj = new Date(retTimeTarget);
          const pad = (n: number) => n.toString().padStart(2, '0');
          newReturnDate = `${retObj.getFullYear()}-${pad(retObj.getMonth() + 1)}-${pad(retObj.getDate())} ${pad(retObj.getHours())}:${pad(retObj.getMinutes())}`;
        }
      }

      return {
        ...ord,
        orderDate: newOrderDate,
        deliveryDate: newDeliveryDate,
        returnDate: newReturnDate,
        isDeleted: !!ord.isDeleted,
        deletedAt: ord.deletedAt || null,
      };
    });
  }

  loadOrders() {
    if (isPlatformBrowser(this.platformId)) {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        try {
          const parsed: Order[] = JSON.parse(data);
          const sanitized = this.sanitizeOrderList(parsed);
          this.rawOrders.set(sanitized);
          this.saveOrders(sanitized);
          return;
        } catch (err) {
          console.error('Failed to parse localStorage orders:', err);
        }
      }
      const sanitizedInitial = this.sanitizeOrderList(INITIAL_ORDERS);
      this.saveOrders(sanitizedInitial);
    } else {
      const sanitizedInitial = this.sanitizeOrderList(INITIAL_ORDERS);
      this.rawOrders.set(sanitizedInitial);
    }
  }

  saveOrders(list: Order[]) {
    const sanitized = this.sanitizeOrderList(list);
    this.rawOrders.set(sanitized);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, JSON.stringify(sanitized));
    }
  }

  updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    deliveryDate?: string | null,
    cancelReason?: string | null,
    returnDate?: string | null,
    returnReason?: string | null,
  ) {
    const list = this.rawOrders().map((ord) => {
      if (ord.id === orderId) {
        let updatedDeliveryDate: string | null = null;
        let updatedReturnDate: string | null = null;
        const nowTime = Date.now();

        if (newStatus === 'delivered' || newStatus === 'returned') {
          if (deliveryDate && deliveryDate.trim()) {
            const inputTime = this.parseDateTimestamp(deliveryDate);
            if (inputTime > nowTime) {
              const now = new Date();
              const pad = (n: number) => n.toString().padStart(2, '0');
              updatedDeliveryDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            } else {
              updatedDeliveryDate = deliveryDate.trim();
            }
          } else if (ord.deliveryDate && this.parseDateTimestamp(ord.deliveryDate) <= nowTime) {
            updatedDeliveryDate = ord.deliveryDate;
          } else {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            updatedDeliveryDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
          }
        } else {
          updatedDeliveryDate = null;
        }

        if (newStatus === 'returned') {
          if (returnDate && returnDate.trim()) {
            const inputTime = this.parseDateTimestamp(returnDate);
            if (inputTime > nowTime) {
              const now = new Date();
              const pad = (n: number) => n.toString().padStart(2, '0');
              updatedReturnDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            } else {
              updatedReturnDate = returnDate.trim();
            }
          } else if (ord.returnDate && this.parseDateTimestamp(ord.returnDate) <= nowTime) {
            updatedReturnDate = ord.returnDate;
          } else {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            updatedReturnDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
          }
        } else {
          updatedReturnDate = null;
        }

        return {
          ...ord,
          status: newStatus,
          deliveryDate: updatedDeliveryDate,
          returnDate: updatedReturnDate,
          cancelReason:
            newStatus === 'cancelled'
              ? cancelReason?.trim() || ord.cancelReason || 'Khách hàng yêu cầu hủy đơn'
              : null,
          returnReason:
            newStatus === 'returned'
              ? returnReason?.trim() || ord.returnReason || 'Khách hàng trả lại sản phẩm'
              : null,
        };
      }
      return ord;
    });
    this.saveOrders(list);
  }

  softDeleteOrder(orderId: string): boolean {
    const target = this.rawOrders().find((ord) => ord.id === orderId);
    if (!target) return false;

    // Disallow soft delete for delivered orders (completed transaction)
    if (target.status === 'delivered') {
      return false;
    }

    // Disallow delete for non-cancelled and non-returned orders
    if (target.status !== 'cancelled' && target.status !== 'returned') {
      return false;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const deletedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const list = this.rawOrders().map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          isDeleted: true,
          deletedAt: deletedAt,
        };
      }
      return ord;
    });

    this.saveOrders(list);
    return true;
  }

  deleteOrder(orderId: string): boolean {
    return this.softDeleteOrder(orderId);
  }

  addOrder(newOrder: Omit<Order, 'id'>): Order {
    this.loadOrders();
    const list = this.rawOrders();
    const count = list.length + 1;
    const padCount = count.toString().padStart(3, '0');
    const created: Order = {
      ...newOrder,
      id: `ord-${Date.now()}`,
      orderCode: newOrder.orderCode || `DH-89${padCount}`,
      isDeleted: false,
    };
    this.saveOrders([created, ...list]);
    return created;
  }

  resetOrdersData() {
    const sanitizedInitial = this.sanitizeOrderList(INITIAL_ORDERS);
    this.saveOrders(sanitizedInitial);
  }
}
