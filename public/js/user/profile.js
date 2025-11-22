class ProfileManager {
    constructor() {
        this.db = firebaseDb;
        this.auth = firebaseAuth;
        this.profileForm = document.getElementById('profileForm');
        this.passwordForm = document.getElementById('passwordForm');
        this.alert = document.getElementById('profileAlert');
        this.message = document.getElementById('profileMessage');
        this.init();
    }

    async init() {
        await this.loadUserProfile();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.profileForm.addEventListener('submit', (e) => this.updateProfile(e));
        this.passwordForm.addEventListener('submit', (e) => this.changePassword(e));
    }

    async loadUserProfile() {
        try {
            const userId = authManager.getCurrentUser().uid;
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                this.populateForm(userData);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showAlert('Failed to load profile data', 'error');
        }
    }

    populateForm(userData) {
        // Split display name into first and last name
        const names = (userData.displayName || '').split(' ');
        document.getElementById('firstName').value = names[0] || '';
        document.getElementById('lastName').value = names.slice(1).join(' ') || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('phone').value = userData.phone || '';
        document.getElementById('address').value = userData.address?.street || '';
        document.getElementById('city').value = userData.address?.city || '';
        document.getElementById('zipCode').value = userData.address?.zipCode || '';
    }

    async updateProfile(e) {
        e.preventDefault();
        
        const formData = this.getProfileFormData();
        const validation = this.validateProfileForm(formData);
        
        if (!validation.isValid) {
            this.showAlert(validation.message, 'error');
            return;
        }

        try {
            const userId = authManager.getCurrentUser().uid;
            const result = await authManager.updateProfile(userId, {
                displayName: `${formData.firstName} ${formData.lastName}`,
                phone: formData.phone,
                address: {
                    street: formData.address,
                    city: formData.city,
                    zipCode: formData.zipCode
                }
            });

            if (result.success) {
                this.showAlert('Profile updated successfully!', 'success');
            } else {
                this.showAlert(result.error, 'error');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.showAlert('Failed to update profile', 'error');
        }
    }

    async changePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showAlert('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showAlert('New password must be at least 6 characters long', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showAlert('New passwords do not match', 'error');
            return;
        }

        try {
            const user = authManager.getCurrentUser();
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            
            // Re-authenticate user
            await user.reauthenticateWithCredential(credential);
            
            // Update password
            await user.updatePassword(newPassword);
            
            this.showAlert('Password updated successfully!', 'success');
            this.passwordForm.reset();
        } catch (error) {
            console.error('Password change error:', error);
            
            if (error.code === 'auth/wrong-password') {
                this.showAlert('Current password is incorrect', 'error');
            } else {
                this.showAlert('Failed to change password', 'error');
            }
        }
    }

    getProfileFormData() {
        return {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            zipCode: document.getElementById('zipCode').value.trim()
        };
    }

    validateProfileForm(data) {
        if (!data.firstName || !data.lastName) {
            return { isValid: false, message: 'First name and last name are required' };
        }
        return { isValid: true, message: '' };
    }

    showAlert(message, type) {
        this.message.textContent = message;
        this.alert.className = `alert alert-${type}`;
        this.alert.style.display = 'flex';
        
        setTimeout(() => {
            this.alert.style.display = 'none';
        }, 5000);
    }
}

// Initialize Profile Manager
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});