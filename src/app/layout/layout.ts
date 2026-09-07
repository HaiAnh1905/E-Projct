import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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

  adminEmail = signal<string>('admin@gmail.com');
  isSidebarOpen = signal<boolean>(true);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const email = localStorage.getItem('user_email');
      if (email) {
        this.adminEmail.set(email);
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
    }
    this.router.navigate(['/login']);
  }
}
