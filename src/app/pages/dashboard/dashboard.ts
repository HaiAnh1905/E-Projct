import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { Order } from '../../models/order.model';

export interface CategoryChartConfig {
  name: string;
  color: string;
  bgLight: string;
}

export interface DayRevenueData {
  day: number;
  dateStr: string;
  totalRevenue: number;
  categoryRevenue: Record<string, number>;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  // Raw Signals from Services
  products = computed(() => this.productService.products());
  orders = computed<Order[]>(() => this.orderService.orders());

  // Dynamic Calculated Metrics
  totalProductsCount = computed(() => this.products().length);

  outOfStockCount = computed(() =>
    this.products().filter((p) => p.quantity <= 0 || !p.inStock).length
  );

  totalOrdersCount = computed(() => this.orders().length);

  pendingOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'pending' || o.status === 'processing').length
  );

  deliveredOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'delivered').length
  );

  totalRevenue = computed(() =>
    this.orders()
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.totalAmount, 0)
  );

  // Dynamic Dashboard Metric Cards
  stats = computed(() => [
    {
      type: 'products',
      title: 'Tổng sản phẩm',
      value: this.totalProductsCount().toString(),
      subtext: `${this.products().filter((p) => p.isActive).length} sản phẩm đang khả dụng`,
      bg: '#6366f1',
      link: '/products',
    },
    {
      type: 'orders',
      title: 'Tổng đơn hàng',
      value: this.totalOrdersCount().toString(),
      subtext: `${this.pendingOrdersCount()} đơn đang chờ/đang xử lý`,
      bg: '#a855f7',
      link: '/orders',
    },
    {
      type: 'revenue',
      title: 'Tổng doanh thu',
      value: this.formatCurrency(this.totalRevenue()),
      subtext: `Từ ${this.deliveredOrdersCount()} đơn giao thành công`,
      bg: '#10b981',
      action: 'scrollToChart',
    },
    {
      type: 'outofstock',
      title: 'Sản phẩm hết hàng',
      value: this.outOfStockCount().toString(),
      subtext: 'Số sản phẩm có số lượng = 0',
      bg: '#ef4444',
      link: '/products',
      queryParams: { stock: 'outOfStock' },
    },
  ]);

  onStatCardClick(stat: any) {
    if (stat.action === 'scrollToChart') {
      const chartElem = document.getElementById('revenue-chart-card');
      if (chartElem) {
        chartElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (stat.link) {
      if (stat.queryParams) {
        this.router.navigate([stat.link], { queryParams: stat.queryParams });
      } else {
        this.router.navigate([stat.link]);
      }
    }
  }

  // ==========================================
  // MONTHLY REVENUE LINE CHART SYSTEM
  // ==========================================

  readonly categoryConfigs: CategoryChartConfig[] = [
    { name: 'Tất cả danh mục', color: '#6366f1', bgLight: '#e0e7ff' },
    { name: 'Điện thoại', color: '#4f46e5', bgLight: '#eeeffe' },
    { name: 'Laptop', color: '#0ea5e9', bgLight: '#e0f2fe' },
    { name: 'Máy tính bảng', color: '#8b5cf6', bgLight: '#f3e8ff' },
    { name: 'Tai nghe', color: '#f59e0b', bgLight: '#fef3c7' },
    { name: 'Đồng hồ', color: '#ec4899', bgLight: '#fce7f3' },
    { name: 'Phụ kiện', color: '#10b981', bgLight: '#dcfce7' },
  ];

  selectedYear = signal<number>(2026);
  selectedMonth = signal<number>(9); // September 2026
  selectedCategory = signal<string>('all'); // 'all' or category name
  hoveredDayIndex = signal<number | null>(null);

  // Month & Year dropdown handlers with explicit numeric parsing
  onMonthChange(val: any) {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.selectedMonth.set(num);
    }
  }

  onYearChange(val: any) {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.selectedYear.set(num);
    }
  }

  private parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
    if (!dateStr) return null;

    // Format 1: ISO YYYY-MM-DD (e.g. "2026-09-07" or "2026-09-07 10:15")
    const matchIso = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchIso) {
      return {
        year: parseInt(matchIso[1], 10),
        month: parseInt(matchIso[2], 10),
        day: parseInt(matchIso[3], 10),
      };
    }

    // Format 2: DMY DD/MM/YYYY (e.g. "07/09/2026" or "10:15 07/09/2026")
    const matchDmy = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (matchDmy) {
      return {
        day: parseInt(matchDmy[1], 10),
        month: parseInt(matchDmy[2], 10),
        year: parseInt(matchDmy[3], 10),
      };
    }

    return null;
  }

  // Product Category Map lookup
  productCategoryMap = computed(() => {
    const map = new Map<string, string>();
    for (const prod of this.products()) {
      map.set(prod.name, prod.category);
    }
    return map;
  });

  // Calculate days in selected month (e.g. 30 for Sept 2026)
  daysInMonthCount = computed(() => {
    const y = Number(this.selectedYear());
    const m = Number(this.selectedMonth());
    return new Date(y, m, 0).getDate();
  });

  // Array of days [1, 2, 3, ..., N]
  daysList = computed(() => {
    const count = this.daysInMonthCount();
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  // Calculate daily revenue per category for DELIVERED orders in selected month
  monthlyDailyData = computed<DayRevenueData[]>(() => {
    const targetYear = Number(this.selectedYear());
    const targetMonth = Number(this.selectedMonth());
    const totalDays = this.daysInMonthCount();
    const catMap = this.productCategoryMap();

    // Initialize daily slots
    const dailyMap: DayRevenueData[] = Array.from({ length: totalDays }, (_, idx) => {
      const dayNum = idx + 1;
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const monthStr = targetMonth < 10 ? `0${targetMonth}` : `${targetMonth}`;
      return {
        day: dayNum,
        dateStr: `${dayStr}/${monthStr}/${targetYear}`,
        totalRevenue: 0,
        categoryRevenue: {
          'Điện thoại': 0,
          'Laptop': 0,
          'Máy tính bảng': 0,
          'Tai nghe': 0,
          'Đồng hồ': 0,
          'Phụ kiện': 0,
        },
      };
    });

    // Filter only DELIVERED orders
    const deliveredOrders = this.orders().filter((o) => o.status === 'delivered');

    for (const order of deliveredOrders) {
      // Parse delivery date or fallback to order date
      const dateStringToParse = order.deliveryDate || order.orderDate;
      if (!dateStringToParse) continue;

      const parsedDate = this.parseDateParts(dateStringToParse);
      if (!parsedDate) continue;

      const { year, month, day } = parsedDate;

      // Match selected month and year
      if (year === targetYear && month === targetMonth && day >= 1 && day <= totalDays) {
        // Enforce strict check: Block any dates strictly in the future beyond TODAY
        const today = new Date();
        const isFuture =
          year > today.getFullYear() ||
          (year === today.getFullYear() && month > today.getMonth() + 1) ||
          (year === today.getFullYear() && month === today.getMonth() + 1 && day > today.getDate());

        if (isFuture) {
          continue;
        }

        const daySlot = dailyMap[day - 1];

        // Process order items to attribute revenue to specific category
        for (const item of order.items) {
          const category = catMap.get(item.productName) || 'Khác';
          const itemTotal = item.price * item.quantity;

          daySlot.totalRevenue += itemTotal;
          if (daySlot.categoryRevenue[category] !== undefined) {
            daySlot.categoryRevenue[category] += itemTotal;
          } else {
            daySlot.categoryRevenue[category] = itemTotal;
          }
        }
      }
    }

    return dailyMap;
  });

  // Calculate monthly total revenue for selected category filter
  filteredMonthlyTotalRevenue = computed(() => {
    const data = this.monthlyDailyData();
    const cat = this.selectedCategory();

    if (cat === 'all') {
      return data.reduce((sum, d) => sum + d.totalRevenue, 0);
    } else {
      return data.reduce((sum, d) => sum + (d.categoryRevenue[cat] || 0), 0);
    }
  });

  // Monthly stats list for category legend cards
  categoryMonthlyStats = computed(() => {
    const data = this.monthlyDailyData();
    const categories = ['Điện thoại', 'Laptop', 'Máy tính bảng', 'Tai nghe', 'Đồng hồ', 'Phụ kiện'];

    return categories.map((cat) => {
      const sum = data.reduce((acc, d) => acc + (d.categoryRevenue[cat] || 0), 0);
      const cfg = this.categoryConfigs.find((c) => c.name === cat) || {
        color: '#6366f1',
        bgLight: '#e0e7ff',
      };
      return {
        name: cat,
        revenue: sum,
        color: cfg.color,
        bgLight: cfg.bgLight,
      };
    });
  });

  // SVG Chart Geometry Specs
  readonly svgWidth = 900;
  readonly svgHeight = 320;
  readonly chartLeft = 70;
  readonly chartRight = 880;
  readonly chartTop = 30;
  readonly chartBottom = 260;
  readonly plotWidth = 810; // 880 - 70
  readonly plotHeight = 230; // 260 - 30

  // Active Category Color
  activeCategoryColor = computed(() => {
    const cat = this.selectedCategory();
    const cfg = this.categoryConfigs.find((c) => (cat === 'all' ? c.name === 'Tất cả danh mục' : c.name === cat));
    return cfg ? cfg.color : '#6366f1';
  });

  // Max Revenue Value for Y-Axis Scaling
  chartMaxRevenue = computed(() => {
    const data = this.monthlyDailyData();
    const cat = this.selectedCategory();

    let maxVal = 0;
    for (const d of data) {
      const val = cat === 'all' ? d.totalRevenue : (d.categoryRevenue[cat] || 0);
      if (val > maxVal) maxVal = val;
    }

    if (maxVal === 0) return 50000000; // 50M fallback

    // Round up to nice step
    const step = 20000000; // 20 million steps
    return Math.ceil(maxVal / step) * step;
  });

  // Y-Axis Gridlines
  yAxisGridlines = computed(() => {
    const maxVal = this.chartMaxRevenue();
    const steps = 4;
    const lines = [];

    for (let i = 0; i <= steps; i++) {
      const val = (maxVal / steps) * i;
      const y = this.chartBottom - (i / steps) * this.plotHeight;
      lines.push({
        value: val,
        formatted: this.formatShortCurrency(val),
        y: y,
      });
    }

    return lines;
  });

  // SVG Data Points Array
  chartPoints = computed(() => {
    const data = this.monthlyDailyData();
    const cat = this.selectedCategory();
    const totalDays = this.daysInMonthCount();
    const maxVal = this.chartMaxRevenue();

    return data.map((d, index) => {
      const val = cat === 'all' ? d.totalRevenue : (d.categoryRevenue[cat] || 0);
      const x = this.chartLeft + (index / (totalDays - 1)) * this.plotWidth;
      const y = this.chartBottom - (val / maxVal) * this.plotHeight;

      return {
        day: d.day,
        dateStr: d.dateStr,
        value: val,
        totalDayRevenue: d.totalRevenue,
        categoryBreakdown: d.categoryRevenue,
        x: x,
        y: y,
      };
    });
  });

  // SVG Line Smooth Path (Cubic Bezier)
  chartLinePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';

    let path = `M ${pts[0].x},${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;

      path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
    }

    return path;
  });

  // SVG Gradient Area Path
  chartAreaPath = computed(() => {
    const lineD = this.chartLinePath();
    const pts = this.chartPoints();
    if (!lineD || pts.length === 0) return '';

    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const bottomY = this.chartBottom;

    return `${lineD} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  });

  // Multi-Category Overlay Lines (for 'all' mode)
  multiCategoryLines = computed(() => {
    if (this.selectedCategory() !== 'all') return [];

    const categories = ['Điện thoại', 'Laptop', 'Máy tính bảng', 'Tai nghe', 'Đồng hồ', 'Phụ kiện'];
    const totalDays = this.daysInMonthCount();
    const maxVal = this.chartMaxRevenue();
    const data = this.monthlyDailyData();

    return categories.map((cat) => {
      const cfg = this.categoryConfigs.find((c) => c.name === cat) || { color: '#6366f1' };
      const pts = data.map((d, index) => {
        const val = d.categoryRevenue[cat] || 0;
        const x = this.chartLeft + (index / (totalDays - 1)) * this.plotWidth;
        const y = this.chartBottom - (val / maxVal) * this.plotHeight;
        return { x, y };
      });

      let path = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
      }

      return {
        name: cat,
        color: cfg.color,
        path: path,
      };
    });
  });

  // --- Widget 1: Orders Pagination & Lazy Loading ---
  readonly orderPageSize = 5;
  orderPage = signal<number>(1);
  isLoadingOrders = signal<boolean>(false);

  totalOrderPages = computed(() =>
    Math.ceil(this.orders().length / this.orderPageSize) || 1
  );

  paginatedRecentOrders = computed(() => {
    const page = Math.min(this.orderPage(), this.totalOrderPages());
    const start = (page - 1) * this.orderPageSize;
    return this.orders().slice(start, start + this.orderPageSize);
  });

  changeOrderPage(delta: number) {
    const newPage = this.orderPage() + delta;
    if (newPage >= 1 && newPage <= this.totalOrderPages()) {
      this.isLoadingOrders.set(true);
      this.orderPage.set(newPage);
      setTimeout(() => this.isLoadingOrders.set(false), 200);
    }
  }

  // --- Widget 2: Inventory Stock Pagination & Lazy Loading ---
  readonly stockPageSize = 4;
  stockPage = signal<number>(1);
  isLoadingStock = signal<boolean>(false);

  lowStockProductsAll = computed(() =>
    this.products().filter((p) => p.quantity <= 5)
  );

  totalStockPages = computed(() =>
    Math.ceil(this.lowStockProductsAll().length / this.stockPageSize) || 1
  );

  paginatedLowStockProducts = computed(() => {
    const page = Math.min(this.stockPage(), this.totalStockPages());
    const start = (page - 1) * this.stockPageSize;
    return this.lowStockProductsAll().slice(start, start + this.stockPageSize);
  });

  changeStockPage(delta: number) {
    const newPage = this.stockPage() + delta;
    if (newPage >= 1 && newPage <= this.totalStockPages()) {
      this.isLoadingStock.set(true);
      this.stockPage.set(newPage);
      setTimeout(() => this.isLoadingStock.set(false), 200);
    }
  }

  // Filter Category Handler
  setCategoryFilter(categoryName: string) {
    this.selectedCategory.set(categoryName);
  }

  // ==========================================
  // CHART 1: ORDER STATUS DISTRIBUTION (PIE/DOUGHNUT CHART)
  // ==========================================

  orderStatusCounts = computed(() => {
    const list = this.orders();
    const counts = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };

    for (const o of list) {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    }
    return counts;
  });

  orderStatusPieData = computed(() => {
    const counts = this.orderStatusCounts();
    const total = this.orders().length;

    const items = [
      { key: 'delivered', label: 'Giao hàng thành công', count: counts.delivered, color: '#10b981' },
      { key: 'shipped', label: 'Đang giao hàng', count: counts.shipped, color: '#8b5cf6' },
      { key: 'processing', label: 'Đang xử lý', count: counts.processing, color: '#3b82f6' },
      { key: 'pending', label: 'Chờ xử lý', count: counts.pending, color: '#f59e0b' },
      { key: 'returned', label: 'Trả hàng', count: counts.returned, color: '#ef4444' },
      { key: 'cancelled', label: 'Đã hủy', count: counts.cancelled, color: '#64748b' },
    ];

    if (total === 0) {
      return items.map((it) => ({ ...it, percentage: 0, percentVal: 0 }));
    }

    return items.map((it) => {
      const percentage = parseFloat(((it.count / total) * 100).toFixed(1));
      return {
        ...it,
        percentage,
        percentVal: it.count / total,
      };
    });
  });

  pieConicGradient = computed(() => {
    const data = this.orderStatusPieData();
    const total = this.orders().length;
    if (total === 0) return 'conic-gradient(#e2e8f0 0% 100%)';

    let current = 0;
    const parts: string[] = [];

    for (const item of data) {
      if (item.count > 0) {
        const next = current + item.percentVal * 100;
        parts.push(`${item.color} ${current.toFixed(2)}% ${next.toFixed(2)}%`);
        current = next;
      }
    }

    return parts.length > 0 ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)';
  });

  // ==========================================
  // CHART 2: ORDER COUNT OVER TIME (7 DAYS WEEKLY BAR CHART: T2 - CN)
  // ==========================================

  weeklyOrderCountData = computed(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Distance to Monday (T2)
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

    const weekDayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const ordersList = this.orders();

    const days = weekDayLabels.map((label, idx) => {
      const d = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + idx);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dateStr = `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}`;

      let count = 0;
      let deliveredCount = 0;

      for (const ord of ordersList) {
        if (!ord.orderDate) continue;
        const parsed = this.parseDateParts(ord.orderDate);
        if (!parsed) continue;

        if (parsed.year === year && parsed.month === month && parsed.day === day) {
          count++;
          if (ord.status === 'delivered') {
            deliveredCount++;
          }
        }
      }

      return {
        label,
        fullDayName: idx === 6 ? 'Chủ nhật' : `Thứ ${idx + 2}`,
        dateStr,
        day,
        month,
        year,
        count,
        deliveredCount,
        isToday: year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate(),
      };
    });

    let maxCount = Math.max(...days.map((d) => d.count), 4);
    if (maxCount > 5 && maxCount % 2 !== 0) {
      maxCount += 1;
    }

    let yTicks: number[] = [];
    if (maxCount <= 6) {
      for (let v = maxCount; v >= 0; v--) {
        yTicks.push(v);
      }
    } else {
      const step = Math.ceil(maxCount / 4);
      maxCount = step * 4;
      for (let i = 4; i >= 0; i--) {
        yTicks.push(i * step);
      }
    }

    const totalWeekOrders = days.reduce((sum, d) => sum + d.count, 0);

    return {
      days,
      maxCount,
      yTicks,
      totalWeekOrders,
      weekRangeStr: `${days[0].dateStr} - ${days[6].dateStr}/${days[6].year}`,
    };
  });

  topSellingProductsAll = computed(() => {
    const ordersList = this.orders().filter((o) => o.status !== 'cancelled');
    const salesMap = new Map<string, { name: string; category: string; totalSold: number; totalRevenue: number }>();
    const prodCatMap = this.productCategoryMap();

    for (const ord of ordersList) {
      for (const item of ord.items) {
        const pName = item.productName;
        const cat = prodCatMap.get(pName) || 'Sản phẩm';
        const qty = item.quantity;
        const rev = item.price * qty;

        const existing = salesMap.get(pName);
        if (existing) {
          existing.totalSold += qty;
          existing.totalRevenue += rev;
        } else {
          salesMap.set(pName, {
            name: pName,
            category: cat,
            totalSold: qty,
            totalRevenue: rev,
          });
        }
      }
    }

    const sorted = Array.from(salesMap.values()).sort((a, b) => b.totalSold - a.totalSold || b.totalRevenue - a.totalRevenue);
    const maxSold = sorted.length > 0 ? sorted[0].totalSold : 1;

    return sorted.map((p, idx) => ({
      ...p,
      rank: idx + 1,
      percentOfMax: Math.round((p.totalSold / maxSold) * 100),
    }));
  });

  displayedTopSellingProducts = computed(() => {
    return this.topSellingProductsAll().slice(0, 6);
  });

  // Helpers
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatShortCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return (amount / 1000000000).toFixed(1) + ' tỷ';
    }
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(0) + ' tr';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + ' k';
    }
    return amount.toString();
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'shipped': return 'Đang giao hàng';
      case 'delivered': return 'Giao hàng thành công';
      case 'returned': return 'Trả hàng';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  }
}
