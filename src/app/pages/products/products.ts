import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-products-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './products.html',
  styleUrl: './products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private fb = inject(FormBuilder);

  // RxJS Subjects for real-time debounced search & debounced filter selection
  private searchSubject = new Subject<string>();
  private filterSubject = new Subject<void>();

  private searchSub?: Subscription;
  private filterSub?: Subscription;

  // Search input UI signal
  searchQuery = signal<string>('');

  // Pending filter UI selections
  selectedCategory = signal<string>('all');
  selectedStock = signal<string>('all');
  selectedSort = signal<string>('name-asc');

  // Debounced applied filter state
  appliedSearch = signal<string>('');
  appliedCategory = signal<string>('all');
  appliedStock = signal<string>('all');
  appliedSort = signal<string>('name-asc');

  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  // Modals & Form State
  isFormModalOpen = signal<boolean>(false);
  isDeleteModalOpen = signal<boolean>(false);
  isFormSubmitted = signal<boolean>(false);

  editingProduct = signal<Product | null>(null);
  deletingProduct = signal<Product | null>(null);

  // Custom Validator to check duplicate product name
  private uniqueProductNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const nameInput = String(control.value).trim().toLowerCase();
      if (!nameInput) return null;

      const currentEditingId = this.editingProduct()?.id;
      const exists = this.productService.products().some((p) => {
        if (currentEditingId && p.id === currentEditingId) {
          return false;
        }
        return p.name.trim().toLowerCase() === nameInput;
      });

      return exists ? { nameExists: true } : null;
    };
  }

  // Reactive Form for Add / Edit Product
  productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), this.uniqueProductNameValidator()]],
    price: [null, [Validators.required, Validators.min(1)]],
    category: ['Điện thoại', [Validators.required]],
    quantity: [10, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  get nameCtrl() {
    return this.productForm.get('name');
  }

  get priceCtrl() {
    return this.productForm.get('price');
  }

  get quantityCtrl() {
    return this.productForm.get('quantity');
  }

  // Raw products list
  allProducts = computed(() => this.productService.products());

  // Distinct categories for filter dropdown
  categories = computed(() => {
    const list = this.allProducts().map((p) => p.category);
    return Array.from(new Set(list));
  });

  // Filtered & Sorted Products based on DEBOUNCED applied filters
  filteredProducts = computed(() => {
    let result = [...this.allProducts()];
    const search = this.appliedSearch().trim().toLowerCase();
    const category = this.appliedCategory();
    const stock = this.appliedStock();
    const sort = this.appliedSort();

    if (search) {
      result = result.filter((p) => p.name.toLowerCase().includes(search));
    }

    if (category !== 'all') {
      result = result.filter((p) => p.category === category);
    }

    if (stock === 'inStock') {
      result = result.filter((p) => p.inStock);
    } else if (stock === 'outOfStock') {
      result = result.filter((p) => !p.inStock);
    }

    result.sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'name-desc') return b.name.localeCompare(a.name);
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      return 0;
    });

    return result;
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredProducts().length / this.pageSize()) || 1;
  });

  paginatedProducts = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    return this.filteredProducts().slice(startIndex, startIndex + size);
  });

  startIndex = computed(() => {
    if (this.filteredProducts().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredProducts().length);
  });

  ngOnInit() {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.appliedSearch.set(query);
        this.currentPage.set(1);
      });

    this.filterSub = this.filterSubject
      .pipe(debounceTime(300))
      .subscribe(() => {
        this.appliedCategory.set(this.selectedCategory());
        this.appliedStock.set(this.selectedStock());
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

  onCategoryChange(category: string) {
    this.selectedCategory.set(category);
    this.filterSubject.next();
  }

  onStockChange(stock: string) {
    this.selectedStock.set(stock);
    this.filterSubject.next();
  }

  onSortChange(sort: string) {
    this.selectedSort.set(sort);
    this.filterSubject.next();
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
    this.selectedCategory.set('all');
    this.selectedStock.set('all');
    this.selectedSort.set('name-asc');

    this.appliedSearch.set('');
    this.appliedCategory.set('all');
    this.appliedStock.set('all');
    this.appliedSort.set('name-asc');
    this.currentPage.set(1);
  }

  // --- CRUD Modal Actions ---

  openAddModal() {
    this.editingProduct.set(null);
    this.isFormSubmitted.set(false);
    this.productForm.reset({
      name: '',
      price: null,
      category: 'Điện thoại',
      quantity: 10,
      description: '',
    });
    this.nameCtrl?.updateValueAndValidity();
    this.isFormModalOpen.set(true);
  }

  openEditModal(product: Product) {
    this.editingProduct.set(product);
    this.isFormSubmitted.set(false);
    this.productForm.patchValue({
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: product.quantity ?? (product.inStock ? 10 : 0),
      description: product.description,
    });
    this.nameCtrl?.updateValueAndValidity();
    this.isFormModalOpen.set(true);
  }

  closeFormModal() {
    this.isFormModalOpen.set(false);
    this.isFormSubmitted.set(false);
  }

  onSaveProduct() {
    this.isFormSubmitted.set(true);
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValues = this.productForm.value;
    const qty = Math.max(0, Number(formValues.quantity));
    const currentEdit = this.editingProduct();

    const productData: Omit<Product, 'id'> = {
      name: formValues.name.trim(),
      price: Number(formValues.price),
      category: formValues.category,
      quantity: qty,
      inStock: qty > 0,
      isActive: currentEdit ? currentEdit.isActive : true,
      description: (formValues.description || '').trim(),
    };

    if (currentEdit) {
      this.productService.updateProduct(currentEdit.id, productData);
    } else {
      this.productService.addProduct(productData);
    }

    this.closeFormModal();
  }

  onToggleStatus(product: Product) {
    this.productService.toggleProductStatus(product.id);
  }

  openDeleteModal(product: Product) {
    this.deletingProduct.set(product);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.deletingProduct.set(null);
  }

  onConfirmDelete() {
    const target = this.deletingProduct();
    if (target) {
      this.productService.deleteProduct(target.id);
    }
    this.closeDeleteModal();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}
