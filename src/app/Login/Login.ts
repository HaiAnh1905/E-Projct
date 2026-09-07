import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './Login.html',
  styleUrl: './Login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  isSubmitted = signal(false);
  loginSuccess = signal(false);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(23)]]
  });

  get emailControl() {
    return this.loginForm.get('email');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  togglePasswordVisibility() {
    this.showPassword.update(show => !show);
  }

  onSubmit() {
    this.isSubmitted.set(true);
    if (this.loginForm.valid) {
      console.log('Login Data:', this.loginForm.value);
      this.loginSuccess.set(true);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}

