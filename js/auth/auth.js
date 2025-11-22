class AuthManager {
    constructor() {
        this.currentUser = null;
        // ready Promise resolves after the first onAuthStateChanged callback fires
        this._readyResolve = null;
        this.ready = new Promise((resolve) => { this._readyResolve = resolve; });
        this.init();
    }

    init() {
        console.log('🔐 Auth Manager initializing...');
        this.setupAuthListener();
    }

    setupAuthListener() {
        if (!window.firebaseAuth) {
            console.error('❌ Firebase Auth not available');
            // Retry after a short delay
            setTimeout(() => this.setupAuthListener(), 1000);
            return;
        }

        // Listen for auth state; resolve `ready` after first event
        let firstEvent = true;
        firebaseAuth.onAuthStateChanged((user) => {
            console.log('🔄 Auth state changed:', user ? user.email : 'No user');
            if (user) {
                this.handleUserSignedIn(user);
            } else {
                this.handleUserSignedOut();
            }

            if (firstEvent) {
                firstEvent = false;
                if (this._readyResolve) this._readyResolve(true);
            }
        });
    }

    handleUserSignedIn(user) {
        this.currentUser = user;
        console.log('✅ User signed in:', user.email);
        this.updateUIForAuthenticated(user);
        
        // If we're on login/register pages, redirect after sign in
        if (window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('register.html')) {
            console.log('🔄 On auth page, initiating redirect...');
            setTimeout(() => {
                this.redirectAfterLogin();
            }, 1000);
        }
    }

    handleUserSignedOut() {
        this.currentUser = null;
        console.log('🚪 User signed out');
        this.updateUIForUnauthenticated();
        
        // If we're on protected pages, redirect to login
        if (window.location.pathname.includes('dashboard.html') || 
            window.location.pathname.includes('/admin/')) {
            console.log('🔒 Redirecting to login from protected page');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 500);
        }
    }

    async signIn(email, password) {
        try {
            console.log('🔐 Attempting sign in for:', email);
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            console.log('✅ Sign in successful');
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: this.getAuthErrorMessage(error) };
        }
    }

    async signUp(email, password, userData = {}) {
        try {
            console.log('👤 Starting user registration...');
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            console.log('✅ User created in Firebase Auth');
            
            // Update profile with display name
            if (userData.firstName && userData.lastName) {
                await userCredential.user.updateProfile({
                    displayName: `${userData.firstName} ${userData.lastName}`
                });
                console.log('📝 User profile updated');
            }

            // Save additional user data to Firestore
            if (firebaseDb) {
                try {
                    await firebaseDb.collection('users').doc(userCredential.user.uid).set({
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        email: email,
                        phone: userData.phone || '',
                        address: userData.address || '',
                        displayName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        role: 'customer',
                        isActive: true
                    });
                    console.log('💾 User data saved to Firestore');
                } catch (firestoreError) {
                    console.warn('⚠️ Could not save user data to Firestore:', firestoreError);
                    // Don't fail registration if Firestore save fails
                }
            } else {
                console.warn('⚠️ Firestore not available - skipping user data save');
            }

            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('❌ Signup error:', error);
            return { success: false, error: this.getAuthErrorMessage(error) };
        }
    }

    async signOut() {
        try {
            console.log('🚪 Signing out...');
            await firebaseAuth.signOut();
            console.log('✅ Sign out successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            console.log('📧 Sending password reset email...');
            await firebaseAuth.sendPasswordResetEmail(email);
            console.log('✅ Password reset email sent');
            return { success: true };
        } catch (error) {
            console.error('❌ Password reset error:', error);
            return { success: false, error: this.getAuthErrorMessage(error) };
        }
    }

    async updateProfile(userId, profileData) {
        try {
            console.log('📝 Updating user profile...');
            await firebaseDb.collection('users').doc(userId).update({
                ...profileData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Profile updated successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Profile update error:', error);
            return { success: false, error: error.message };
        }
    }

    getAuthErrorMessage(error) {
        console.log('🔍 Auth error code:', error.code);
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please use a different email.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please try again later.';
            default:
                return error.message || 'Authentication failed. Please try again.';
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Check user's role in Firestore to determine admin access
    async isAdmin() {
        if (!this.currentUser) {
            console.log('❌ No current user for admin check');
            return false;
        }
        
        try {
            console.log('👑 Checking admin role for user:', this.currentUser.uid);

            // 1) Check custom token claims (if set by backend)
            try {
                const idTokenResult = await firebaseAuth.currentUser.getIdTokenResult();
                if (idTokenResult && idTokenResult.claims && idTokenResult.claims.admin) {
                    console.log('🎯 Admin claim found in token');
                    return true;
                }
            } catch (claimErr) {
                console.warn('⚠ Could not read token claims:', claimErr);
            }

            // 2) Check Firestore users collection for role or isAdmin flag
            const db = window.firebaseDb || (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function' ? firebase.firestore() : null);
            if (!db) {
                console.warn('❌ Firestore not available while checking admin role');
                return false;
            }

            const doc = await db.collection('users').doc(this.currentUser.uid).get();
            if (!doc.exists) {
                console.log('❌ User document not found in Firestore');
                return false;
            }

            const data = doc.data();
            console.log('📋 User data from Firestore:', data);

            // Accept either role === 'admin' OR isAdmin === true OR is_admin flag
            const isAdmin = !!(data && (data.role === 'admin' || data.isAdmin === true || data.is_admin === true));
            console.log('🎯 Admin check result:', isAdmin);
            return isAdmin;
        } catch (err) {
            console.error('💥 Error checking admin role:', err);
            return false;
        }
    }

    async redirectAfterLogin() {
        console.log('🔄 Starting post-login redirect...');
        
        // Wait a moment to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const user = this.currentUser;
        if (!user) {
            console.error('❌ No user found for redirect');
            return;
        }

        try {
            // Check if user is admin
            const isAdmin = await this.isAdmin();
            console.log('👑 Redirect - Is admin?', isAdmin);
            
            let redirectUrl = 'dashboard.html'; // Default to user dashboard
            
            if (isAdmin) {
                // Redirect to admin dashboard inside admin folder
                redirectUrl = 'admin/dashboard.html';
                console.log('🎯 Redirecting to admin dashboard');
            } else {
                console.log('🎯 Redirecting to user dashboard');
            }
            
            console.log('📍 Final redirect URL:', redirectUrl);
            
            // Force redirect - don't rely on history
            window.location.replace(redirectUrl);
            
        } catch (error) {
            console.error('💥 Error during redirect check:', error);
            // Fallback to regular dashboard
            window.location.replace('dashboard.html');
        }
    }

    updateUIForAuthenticated(user) {
        console.log('🎨 Updating UI for authenticated user');
        
        // Update navigation
        const authElements = document.querySelectorAll('.auth-element');
        const userElements = document.querySelectorAll('.user-element');
        const adminElements = document.querySelectorAll('.admin-element');
        
        authElements.forEach(el => {
            if (el) el.style.display = 'none';
        });
        userElements.forEach(el => {
            if (el) el.style.display = 'block';
        });

        // Update user display name
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) {
            userDisplay.textContent = user.displayName || user.email;
            console.log('👤 Updated user display:', userDisplay.textContent);
        }

        // Update admin elements after checking role
        this.updateAdminUI();
    }

    async updateAdminUI() {
        try {
            const isAdmin = await this.isAdmin();
            console.log('👑 UI Update - Is admin?', isAdmin);
            
            const adminElements = document.querySelectorAll('.admin-element');
            adminElements.forEach(el => {
                if (el) {
                    el.style.display = isAdmin ? 'block' : 'none';
                }
            });
            
            console.log('🎨 Admin UI elements updated');
        } catch (error) {
            console.error('❌ Error updating admin UI:', error);
        }
    }

    updateUIForUnauthenticated() {
        console.log('🎨 Updating UI for unauthenticated user');
        
        // Update navigation
        const authElements = document.querySelectorAll('.auth-element');
        const userElements = document.querySelectorAll('.user-element');
        const adminElements = document.querySelectorAll('.admin-element');
        
        authElements.forEach(el => {
            if (el) el.style.display = 'block';
        });
        userElements.forEach(el => {
            if (el) el.style.display = 'none';
        });
        adminElements.forEach(el => {
            if (el) el.style.display = 'none';
        });

        console.log('🎨 Unauthenticated UI updated');
    }

    // Helper method to check and redirect if not authenticated
    async requireAuth(redirectUrl = 'login.html') {
        await this.ready;
        
        if (!this.isAuthenticated()) {
            console.log('🔒 Authentication required, redirecting to login');
            window.location.href = redirectUrl;
            return false;
        }
        
        return true;
    }

    // Helper method to check and redirect if not admin
    async requireAdmin(redirectUrl = 'dashboard.html') {
        await this.ready;
        
        const isAuthenticated = await this.requireAuth();
        if (!isAuthenticated) return false;
        
        const isAdmin = await this.isAdmin();
        if (!isAdmin) {
            console.log('🚫 Admin privileges required, redirecting');
            window.location.href = redirectUrl;
            return false;
        }
        
        return true;
    }
}

// Create global instance
window.authManager = new AuthManager();