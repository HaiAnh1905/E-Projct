import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-orders-page',
  imports: [],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {}
