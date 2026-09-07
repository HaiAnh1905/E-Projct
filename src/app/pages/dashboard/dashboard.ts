import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-page',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  stats = [
    { type: 'products', title: 'Tổng sản phẩm', value: '124', bg: '#6366f1' },
    { type: 'orders', title: 'Tổng đơn hàng', value: '48', bg: '#a855f7' },
    { type: 'revenue', title: 'Tổng doanh thu', value: '15,850,000đ', bg: '#10b981' },
    { type: 'outofstock', title: 'Sản phẩm hết hàng', value: '3', bg: '#ef4444' },
  ];
}
