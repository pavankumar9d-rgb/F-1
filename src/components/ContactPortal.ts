export class ContactPortal {
  private form: HTMLFormElement | null;
  private successBox: HTMLElement | null;

  constructor() {
    this.form = document.getElementById('accessRequestForm') as HTMLFormElement | null;
    this.successBox = document.getElementById('formSuccessBox');
  }

  public init(): void {
    if (!this.form) return;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private handleSubmit(): void {
    if (!this.form) return;
    let isValid = true;

    // Full Name
    const nameInput = document.getElementById('fullName') as HTMLInputElement | null;
    const nameGroup = nameInput?.closest('.form-group');
    if (!nameInput?.value.trim() || nameInput.value.trim().length < 2) {
      nameGroup?.classList.add('has-error');
      nameInput?.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      nameGroup?.classList.remove('has-error');
      nameInput?.setAttribute('aria-invalid', 'false');
    }

    // Email
    const emailInput = document.getElementById('emailAddress') as HTMLInputElement | null;
    const emailGroup = emailInput?.closest('.form-group');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput || !emailRegex.test(emailInput.value.trim())) {
      emailGroup?.classList.add('has-error');
      emailInput?.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      emailGroup?.classList.remove('has-error');
      emailInput?.setAttribute('aria-invalid', 'false');
    }

    // Phone
    const phoneInput = document.getElementById('phoneNumber') as HTMLInputElement | null;
    const phoneGroup = phoneInput?.closest('.form-group');
    if (!phoneInput || !phoneInput.value.trim() || phoneInput.value.trim().length < 6) {
      phoneGroup?.classList.add('has-error');
      phoneInput?.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      phoneGroup?.classList.remove('has-error');
      phoneInput?.setAttribute('aria-invalid', 'false');
    }

    // Chassis Select
    const carSelect = document.getElementById('carSelect') as HTMLSelectElement | null;
    const carGroup = carSelect?.closest('.form-group');
    if (!carSelect?.value) {
      carGroup?.classList.add('has-error');
      carSelect?.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      carGroup?.classList.remove('has-error');
      carSelect?.setAttribute('aria-invalid', 'false');
    }

    if (isValid && this.form && this.successBox) {
      this.form.style.display = 'none';
      this.successBox.classList.add('active');
      const summary = document.getElementById('successSummary');
      if (summary && nameInput && carSelect) {
        summary.textContent = `Access dossier registered for ${nameInput.value.trim()} • Assigned Chassis: ${carSelect.value}. Nocturne Flight Ops will establish contact within 2 hours.`;
      }
    }
  }
}
