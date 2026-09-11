import {
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
  signal,
  OnInit,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  public toastService = inject(ToastService);

  userName = signal<string>('Quản trị viên');
  isSidebarOpen = signal<boolean>(true);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const name = localStorage.getItem('user_name');
      const email = localStorage.getItem('user_email');
      if (name && name.trim()) {
        this.userName.set(name.trim());
      } else if (email && email.trim()) {
        const prefix = email.split('@')[0];
        const parts = prefix.split(/[._-]/);
        const derived = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        this.userName.set(derived || 'Quản trị viên');
      }
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update((v) => !v);
  }

  onLogout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_name');
    }
    this.router.navigate(['/login']);
  }
}
