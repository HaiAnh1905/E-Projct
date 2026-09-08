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
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { ToastService } from '../../services/toast.service';
import { OrderService } from '../../services/order.service';
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
  private cloudinaryService = inject(CloudinaryService);
  private toastService = inject(ToastService);
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

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
  selectedActive = signal<string>('all');
  selectedSort = signal<string>('name-asc');

  // Debounced applied filter state
  appliedSearch = signal<string>('');
  appliedCategory = signal<string>('all');
  appliedStock = signal<string>('all');
  appliedActive = signal<string>('all');
  appliedSort = signal<string>('name-asc');

  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  // Modals & Form State
  isFormModalOpen = signal<boolean>(false);
  isDeleteModalOpen = signal<boolean>(false);
  isFormSubmitted = signal<boolean>(false);

  editingProduct = signal<Product | null>(null);
  deletingProduct = signal<Product | null>(null);

  // Image Management State
  existingImages = signal<string[]>([]);
  pendingImageFiles = signal<{ file: File; previewUrl: string }[]>([]);
  isUploadingImages = signal<boolean>(false);
  imageUrlInput = signal<string>('');

  initialProductModalState = signal<{
    isEdit: boolean;
    name: string;
    price: number | null;
    category: string;
    quantity: number;
    description: string;
    existingImages: string[];
    pendingFilesCount: number;
  }>({
    isEdit: false,
    name: '',
    price: null,
    category: 'Điện thoại',
    quantity: 10,
    description: '',
    existingImages: [],
    pendingFilesCount: 0,
  });

  // Track if form fields or images have been changed compared to initial state
  hasFormChanges = computed(() => {
    if (!this.isFormModalOpen()) return false;

    const initial = this.initialProductModalState();
    const isEdit = initial.isEdit;

    // For new product creation, allow submit if form is valid and user typed required values
    if (!isEdit) {
      return this.productForm.valid;
    }

    // For editing an existing product, check if any field or image set differs from initial state
    const formVals = this.productForm.value;

    const nameChanged = (formVals.name || '').trim() !== (initial.name || '').trim();
    const priceChanged = Number(formVals.price) !== Number(initial.price);
    const categoryChanged = formVals.category !== initial.category;
    const quantityChanged = Number(formVals.quantity) !== Number(initial.quantity);
    const descChanged = (formVals.description || '').trim() !== (initial.description || '').trim();

    const currentExisting = this.existingImages();
    const existingImagesChanged =
      currentExisting.length !== initial.existingImages.length ||
      currentExisting.some((img, idx) => img !== initial.existingImages[idx]);

    const pendingFilesAdded = this.pendingImageFiles().length > 0;

    const hasAnyChange =
      nameChanged ||
      priceChanged ||
      categoryChanged ||
      quantityChanged ||
      descChanged ||
      existingImagesChanged ||
      pendingFilesAdded;

    return hasAnyChange && this.productForm.valid;
  });

  addImageUrl() {
    const url = this.imageUrlInput().trim();
    if (!url) return;
    this.existingImages.set([...this.existingImages(), url]);
    this.imageUrlInput.set('');
  }

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
    isActive: [true, [Validators.required]],
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
    const active = this.appliedActive();
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

    if (active === 'active') {
      result = result.filter((p) => p.isActive);
    } else if (active === 'disabled') {
      result = result.filter((p) => !p.isActive);
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

  private querySub?: Subscription;

  ngOnInit() {
    this.querySub = this.route.queryParams.subscribe((params) => {
      if (params['stock']) {
        this.selectedStock.set(params['stock']);
        this.appliedStock.set(params['stock']);
      }
    });

    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query: string) => {
        this.appliedSearch.set(query);
        this.currentPage.set(1);
      });

    this.filterSub = this.filterSubject.pipe(debounceTime(300)).subscribe(() => {
      this.appliedCategory.set(this.selectedCategory());
      this.appliedStock.set(this.selectedStock());
      this.appliedActive.set(this.selectedActive());
      this.appliedSort.set(this.selectedSort());
      this.currentPage.set(1);
    });
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
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
    this.appliedCategory.set(category);
    this.currentPage.set(1);
  }

  onStockChange(stock: string) {
    this.selectedStock.set(stock);
    this.appliedStock.set(stock);
    this.currentPage.set(1);
  }

  onActiveChange(active: string) {
    this.selectedActive.set(active);
    this.appliedActive.set(active);
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
    this.selectedCategory.set('all');
    this.selectedStock.set('all');
    this.selectedActive.set('all');
    this.selectedSort.set('name-asc');

    this.appliedSearch.set('');
    this.appliedCategory.set('all');
    this.appliedStock.set('all');
    this.appliedActive.set('all');
    this.appliedSort.set('name-asc');
    this.currentPage.set(1);
  }

  // --- Image Handling ---

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const filesArray = Array.from(input.files);
    const newItems: { file: File; previewUrl: string }[] = [];

    let loadedCount = 0;
    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = (e.target?.result as string) || '';
        newItems.push({ file, previewUrl });
        loadedCount++;
        if (loadedCount === filesArray.length) {
          this.pendingImageFiles.set([...this.pendingImageFiles(), ...newItems]);
        }
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeExistingImage(index: number) {
    this.existingImages.set(this.existingImages().filter((_, i) => i !== index));
  }

  removePendingFile(index: number) {
    this.pendingImageFiles.set(this.pendingImageFiles().filter((_, i) => i !== index));
  }

  // --- CRUD Modal Actions ---

  openAddModal() {
    this.editingProduct.set(null);
    this.isFormSubmitted.set(false);
    this.existingImages.set([]);
    this.pendingImageFiles.set([]);
    this.isUploadingImages.set(false);
    this.imageUrlInput.set('');

    this.productForm.reset({
      name: '',
      price: null,
      category: 'Điện thoại',
      quantity: 10,
      isActive: true,
      description: '',
    });
    this.nameCtrl?.updateValueAndValidity();

    this.initialProductModalState.set({
      isEdit: false,
      name: '',
      price: null,
      category: 'Điện thoại',
      quantity: 10,
      description: '',
      existingImages: [],
      pendingFilesCount: 0,
    });

    this.isFormModalOpen.set(true);
  }

  openEditModal(product: Product) {
    this.editingProduct.set(product);
    this.isFormSubmitted.set(false);
    const initialImgs = [...(product.images || [])];
    this.existingImages.set(initialImgs);
    this.pendingImageFiles.set([]);
    this.isUploadingImages.set(false);
    this.imageUrlInput.set('');

    const initialQty = product.quantity ?? (product.inStock ? 10 : 0);

    this.productForm.patchValue({
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: initialQty,
      isActive: product.isActive,
      description: product.description,
    });
    this.nameCtrl?.updateValueAndValidity();

    this.initialProductModalState.set({
      isEdit: true,
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: initialQty,
      description: product.description || '',
      existingImages: initialImgs,
      pendingFilesCount: 0,
    });

    this.isFormModalOpen.set(true);
  }

  closeFormModal() {
    if (this.isUploadingImages()) return;
    this.isFormModalOpen.set(false);
    this.isFormSubmitted.set(false);
  }

  async onSaveProduct() {
    this.isFormSubmitted.set(true);
    if (!this.hasFormChanges() || this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isUploadingImages.set(true);

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
      images: this.existingImages(),
    };

    let productId: number;

    // STEP 1: Save product metadata to local storage first (as required by prompt)
    if (currentEdit) {
      productId = currentEdit.id;
      this.productService.updateProduct(productId, productData);
      this.toastService.success(`Cập nhật sản phẩm "${productData.name}" thành công!`);
    } else {
      const created = this.productService.addProduct(productData);
      productId = created.id;
      this.toastService.success(`Thêm sản phẩm "${productData.name}" thành công!`);
    }

    // STEP 2: Upload new image files to Cloudinary, retrieve returned URLs, and update product data
    const pending = this.pendingImageFiles();
    if (pending.length > 0) {
      try {
        const uploadPromises = pending.map((item) => this.cloudinaryService.uploadImage(item.file));
        const uploadedUrls = await Promise.all(uploadPromises);
        const finalImages = [...this.existingImages(), ...uploadedUrls.filter((url) => !!url)];

        // Update product with uploaded Cloudinary URLs
        this.productService.updateProduct(productId, { images: finalImages });
      } catch (err) {
        console.error('Error uploading images to Cloudinary:', err);
      }
    }

    this.isUploadingImages.set(false);
    this.closeFormModal();
  }

  // Validation rule for product deletion:
  // Cannot delete product if it exists in orders, UNLESS there are 0 orders OR exactly 1 order and that order is cancelled.
  deleteValidation = computed(() => {
    const target = this.deletingProduct();
    if (!target) return { allowed: true, reason: '', orderCount: 0 };

    const allOrders = this.orderService.orders();
    const matchingOrders = allOrders.filter((ord) =>
      ord.items.some(
        (item) => item.productName.trim().toLowerCase() === target.name.trim().toLowerCase(),
      ),
    );

    const orderCount = matchingOrders.length;
    if (orderCount === 0) {
      return { allowed: true, reason: '', orderCount: 0 };
    }

    if (orderCount === 1 && matchingOrders[0].status === 'cancelled') {
      return { allowed: true, reason: '', orderCount: 1 };
    }

    let reason = '';
    if (orderCount > 1) {
      reason = `Sản phẩm này đang thuộc về ${orderCount} đơn hàng trong hệ thống. Không được phép xóa sản phẩm khi có từ 2 đơn hàng trở lên chứa sản phẩm này.`;
    } else if (orderCount === 1 && matchingOrders[0].status !== 'cancelled') {
      const statusLabel = this.getOrderStatusLabel(matchingOrders[0].status);
      reason = `Sản phẩm này đang có trong 1 đơn hàng (Mã #${matchingOrders[0].orderCode}) ở trạng thái "${statusLabel}". Chỉ được phép xóa khi đơn hàng bị hủy hoặc không thuộc đơn hàng nào.`;
    }

    return { allowed: false, reason, orderCount };
  });

  private getOrderStatusLabel(status: string): string {
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
      default:
        return status;
    }
  }

  onToggleStatus(product: Product) {
    this.productService.toggleProductStatus(product.id);
    const newStatusLabel = !product.isActive ? 'Khả dụng' : 'Không khả dụng';
    this.toastService.info(`Đã chuyển trạng thái "${product.name}" sang ${newStatusLabel}.`);
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
    if (!target) {
      this.closeDeleteModal();
      return;
    }

    const val = this.deleteValidation();
    if (!val.allowed) {
      this.toastService.error(val.reason, 'Không thể xóa sản phẩm');
      return;
    }

    this.productService.deleteProduct(target.id);
    this.toastService.warning(`Đã xóa sản phẩm "${target.name}" thành công!`);
    this.closeDeleteModal();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}
