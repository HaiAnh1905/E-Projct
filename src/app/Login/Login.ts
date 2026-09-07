import { ChangeDetectionStrategy, Component, signal, inject, PLATFORM_ID } from '@angular/core';
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
export class Login {
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
      if (email !== 'admin@gmail.com' || password !== '12345679') {
        this.loginError.set('Sai tài khoản hoặc mật khẩu');
        return;
      }

      // Lưu mock token & email vào localStorage khi ở trên Browser
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('auth_token', 'mock_jwt_token_' + Date.now());
        localStorage.setItem('user_email', email);
      }

      this.loginSuccess.set(true);

      // Chuyển hướng sang trang Dashboard sau khi đăng nhập thành công
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 600);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}

