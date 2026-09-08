import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);

  show(message: string, type: ToastType = 'info', title?: string, duration: number = 3500) {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let defaultTitle = 'Thông báo';
    if (type === 'success') defaultTitle = 'Thành công';
    if (type === 'error') defaultTitle = 'Có lỗi xảy ra';
    if (type === 'warning') defaultTitle = 'Cảnh báo';

    const toast: ToastMessage = {
      id,
      type,
      title: title || defaultTitle,
      message,
      duration,
    };

    // Add new toast to top of stack
    this.toasts.update((current) => [toast, ...current]);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  success(message: string, title?: string) {
    this.show(message, 'success', title);
  }

  error(message: string, title?: string) {
    this.show(message, 'error', title);
  }

  warning(message: string, title?: string) {
    this.show(message, 'warning', title);
  }

  info(message: string, title?: string) {
    this.show(message, 'info', title);
  }

  remove(id: string) {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
