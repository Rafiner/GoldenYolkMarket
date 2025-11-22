class RegisterManager {
    constructor() {
        this.init();
    }

    init() {
        console.log('Register Manager starting...');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            console.log('Form event listener added');
        } else {
            console.error('Register form not found!');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        // Get form data
        const userData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value
        };

        console.log('Form data:', userData);

        // Validate form
        const errors = this.validateForm(userData);
        if (errors.length > 0) {
            this.showAlert(errors[0], 'error');
            return;
        }

        try {
            await this.registerUser(userData);
        } catch (error) {
            console.error('Registration failed:', error);
            this.showAlert(error.message, 'error');
        }
    }

    validateForm(userData) {
        const errors = [];

        if (!userData.firstName?.trim() || userData.firstName.trim().length < 2) {
            errors.push('First name must be at least 2 characters long');
        }

        if (!userData.lastName?.trim() || userData.lastName.trim().length < 2) {
            errors.push('Last name must be at least 2 characters long');
        }

        if (!userData.email || !this.validateEmail(userData.email)) {
            errors.push('Please enter a valid email address');
        }

        if (!userData.password || userData.password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        if (userData.password !== userData.confirmPassword) {
            errors.push('Passwords do not match');
        }

        const termsChecked = document.getElementById('terms')?.checked;
        if (!termsChecked) {
            errors.push('Please agree to the Terms of Service and Privacy Policy');
        }

        return errors;
    }

    async registerUser(userData) {
        const button = document.querySelector('#registerForm button[type="submit"]');
        const originalText = button.innerHTML;

        try {
            // Show loading
            this.showLoading(button);
            this.hideAlert();

            console.log('Starting registration process...');

            // Wait a moment to ensure authManager is ready
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use authManager for registration
            const result = await authManager.signUp(
                userData.email, 
                userData.password, 
                userData
            );

            if (result.success) {
                console.log('Registration complete!');
                this.showAlert('Account created successfully! Redirecting...', 'success');

                // Redirect to home page
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        } finally {
            this.hideLoading(button, originalText);
        }
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showLoading(button) {
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        button.disabled = true;
    }

    hideLoading(button) {
        const originalText = button.dataset.originalText;
        if (originalText) {
            button.innerHTML = originalText;
        }
        button.disabled = false;
    }

    showAlert(message, type = 'error') {
        // Remove existing alerts
        const existingAlert = document.getElementById('authAlert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.id = 'authAlert';
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 16px 0;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
        `;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Insert before the form
        const form = document.getElementById('registerForm');
        if (form) {
            form.parentNode.insertBefore(alertDiv, form);
        }
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    hideAlert() {
        const alert = document.getElementById('authAlert');
        if (alert) {
            alert.remove();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing RegisterManager');
        new RegisterManager();
    });
} else {
    console.log('DOM already loaded, initializing RegisterManager');
    new RegisterManager();
}