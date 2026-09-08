import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  userEmail = signal<string>('user@gmail.com');
  userRole = signal<string>('user');

  products = signal<Product[]>([]);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const email = localStorage.getItem('user_email');
      const role = localStorage.getItem('user_role');
      if (email) this.userEmail.set(email);
      if (role) this.userRole.set(role);
    }
    this.products.set(this.productService.products().filter((p) => p.isActive));
  }

  onLogout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
    }
    this.router.navigate(['/login']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}
