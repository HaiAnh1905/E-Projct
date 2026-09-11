import { ChangeDetectionStrategy, Component, signal, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './Login.html',
  styleUrl: './Login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  showPassword = signal(false);
  isSubmitted = signal(false);
  loginSuccess = signal(false);
  loginError = signal<string | null>(null);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(23)]],
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('auth_token');
      const email = localStorage.getItem('user_email');
      const role = localStorage.getItem('user_role') || (email === 'admin@gmail.com' ? 'admin' : 'user');
      if (token && email) {
        if (role === 'admin') {
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/home'], { replaceUrl: true });
        }
      }
    }
  }

  get emailControl() {
    return this.loginForm.get('email');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  togglePasswordVisibility() {
    this.showPassword.update((show) => !show);
  }

  onSubmit() {
    this.isSubmitted.set(true);
    this.loginError.set(null);
    this.loginSuccess.set(false);

    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      const cleanEmail = String(email).trim().toLowerCase();

      let role = 'user';
      let name = 'Nguyễn Văn A';
      if (cleanEmail === 'admin@gmail.com' && password === '12345679') {
        role = 'admin';
        name = 'Quản trị viên';
      } else if (password && password.length >= 8) {
        role = 'user';
        const prefix = cleanEmail.split('@')[0];
        const parts = prefix.split(/[._-]/);
        name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      } else {
        this.loginError.set('Mật khẩu phải từ 8 ký tự trở lên');
        return;
      }

      // Lưu mock token, email, role & user_name vào localStorage khi ở trên Browser
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('auth_token', 'mock_jwt_token_' + Date.now());
        localStorage.setItem('user_email', cleanEmail);
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_name', name);
      }

      this.loginSuccess.set(true);

      // Chuyển hướng sang trang Dashboard (Admin) hoặc Home (User)
      setTimeout(() => {
        if (role === 'admin') {
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/home'], { replaceUrl: true });
        }
      }, 600);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
