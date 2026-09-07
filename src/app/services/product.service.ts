import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { INITIAL_PRODUCTS, Product } from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private platformId = inject(PLATFORM_ID);
  private storageKey = 'admin_products_data';

  products = signal<Product[]>([]);

  constructor() {
    this.loadProducts();
  }

  private loadProducts() {
    if (isPlatformBrowser(this.platformId)) {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        try {
          const parsed: Product[] = JSON.parse(data);
          const migrated = parsed.map((p) => {
            const qty = typeof p.quantity === 'number' ? p.quantity : (p.inStock ? 10 : 0);
            return {
              ...p,
              quantity: qty,
              inStock: qty > 0,
              isActive: typeof p.isActive === 'boolean' ? p.isActive : true,
              images: Array.isArray(p.images) ? p.images : [],
            };
          });
          this.products.set(migrated);
          return;
        } catch {
          console.error('Failed to parse localStorage products');
        }
      }
      this.products.set(INITIAL_PRODUCTS);
      this.saveProducts(INITIAL_PRODUCTS);
    } else {
      this.products.set(INITIAL_PRODUCTS);
    }
  }

  saveProducts(list: Product[]) {
    this.products.set(list);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    }
  }

  addProduct(newProduct: Omit<Product, 'id'>): Product {
    const list = this.products();
    const maxId = list.reduce((max, p) => (p.id > max ? p.id : max), 0);
    const product: Product = {
      id: maxId + 1,
      ...newProduct,
    };
    this.saveProducts([product, ...list]);
    return product;
  }

  updateProduct(id: number, updatedData: Partial<Omit<Product, 'id'>>) {
    const list = this.products().map((p) => (p.id === id ? { ...p, ...updatedData } : p));
    this.saveProducts(list);
  }

  toggleProductStatus(id: number) {
    const list = this.products().map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    this.saveProducts(list);
  }

  deleteProduct(id: number) {
    const list = this.products().filter((p) => p.id !== id);
    this.saveProducts(list);
  }
}
