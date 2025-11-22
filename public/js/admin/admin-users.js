class AdminUsersManager {
    constructor() {
        this.db = firebaseDb;
        this.users = [];
        this.userOrders = new Map();
        this.filters = {
            role: 'all',
            status: 'all',
            search: ''
        };
        this.init();
    }

    async init() {
        await this.loadUsers();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter events
        document.getElementById('roleFilter').addEventListener('change', (e) => {
            this.filters.role = e.target.value;
            this.applyFilters();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('searchUsers').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Modal close
        document.getElementById('userModalClose').addEventListener('click', () => {
            this.closeUserModal();
        });
    }

    async loadUsers() {
        try {
            const snapshot = await this.db.collection('users').get();
            this.users = [];
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const orderCount = await this.getUserOrderCount(doc.id);
                
                this.users.push({
                    id: doc.id,
                    ...data,
                    orderCount: orderCount,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            }
            
            this.renderUsers(this.users);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users');
        }
    }

    async getUserOrderCount(userId) {
        if (this.userOrders.has(userId)) {
            return this.userOrders.get(userId);
        }

        try {
            const snapshot = await this.db.collection('orders')
                .where('userId', '==', userId)
                .get();
            
            const count = snapshot.size;
            this.userOrders.set(userId, count);
            return count;
        } catch (error) {
            console.error('Error loading user orders:', error);
            return 0;
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTable');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div>
                        <strong>${user.displayName || 'No Name'}</strong>
                        <div style="font-size: 0.8rem; color: var(--gray);">
                            ID: ${user.id.slice(-8)}
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>
                    <select class="role-select form-select" data-user-id="${user.id}" style="width: 100px;">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <select class="status-select form-select" data-user-id="${user.id}" style="width: 100px;">
                        <option value="active" ${user.isActive !== false ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.isActive === false ? 'selected' : ''}>Inactive</option>
                    </select>
                </td>
                <td>
                    ${user.createdAt.toLocaleDateString()}
                    <div style="font-size: 0.8rem; color: var(--gray);">
                        ${Helpers.formatDate(user.createdAt)}
                    </div>
                </td>
                <td>
                    <span class="${user.orderCount > 0 ? 'text-success' : 'text-muted'}">
                        ${user.orderCount} orders
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary btn-sm view-user" data-user-id="${user.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-danger btn-sm delete-user" data-user-id="${user.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.attachUserEvents();
    }

    attachUserEvents() {
        // Role changes
        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const userId = e.target.dataset.userId;
                const newRole = e.target.value;
                this.updateUserRole(userId, newRole);
            });
        });

        // Status changes
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const userId = e.target.dataset.userId;
                const newStatus = e.target.value;
                this.updateUserStatus(userId, newStatus === 'active');
            });
        });

        // View user details
        document.querySelectorAll('.view-user').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.userId;
                this.viewUserDetails(userId);
            });
        });

        // Delete users
        document.querySelectorAll('.delete-user').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.userId;
                this.deleteUser(userId);
            });
        });
    }

    applyFilters() {
        let filteredUsers = this.users;

        // Apply role filter
        if (this.filters.role !== 'all') {
            filteredUsers = filteredUsers.filter(user => user.role === this.filters.role);
        }

        // Apply status filter
        if (this.filters.status !== 'all') {
            const isActive = this.filters.status === 'active';
            filteredUsers = filteredUsers.filter(user => 
                (isActive && user.isActive !== false) || 
                (!isActive && user.isActive === false)
            );
        }

        // Apply search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filteredUsers = filteredUsers.filter(user => 
                user.displayName?.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.phone?.toLowerCase().includes(searchTerm) ||
                user.id.toLowerCase().includes(searchTerm)
            );
        }

        this.renderUsers(filteredUsers);
    }

    async updateUserRole(userId, newRole) {
        try {
            await this.db.collection('users').doc(userId).update({
                role: newRole,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local data
            const userIndex = this.users.findIndex(user => user.id === userId);
            if (userIndex !== -1) {
                this.users[userIndex].role = newRole;
            }

            this.showMessage(`User role updated to ${newRole}`, 'success');
        } catch (error) {
            console.error('Error updating user role:', error);
            this.showError('Failed to update user role');
        }
    }

    async updateUserStatus(userId, isActive) {
        try {
            await this.db.collection('users').doc(userId).update({
                isActive: isActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local data
            const userIndex = this.users.findIndex(user => user.id === userId);
            if (userIndex !== -1) {
                this.users[userIndex].isActive = isActive;
            }

            this.showMessage(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        } catch (error) {
            console.error('Error updating user status:', error);
            this.showError('Failed to update user status');
        }
    }

    async viewUserDetails(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const modal = document.getElementById('userModal');
        const modalContent = document.getElementById('userModalContent');
        const modalTitle = document.getElementById('userModalTitle');

        modalTitle.textContent = `User Details: ${user.displayName || 'Unknown User'}`;

        // Load user's recent orders
        const recentOrders = await this.getUserRecentOrders(userId);

        modalContent.innerHTML = `
            <div style="padding: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h4>Profile Information</h4>
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem;">
                            <p><strong>Name:</strong> ${user.displayName || 'Not provided'}</p>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
                            <p><strong>Role:</strong> <span class="status-badge ${user.role === 'admin' ? 'status-delivered' : 'status-pending'}">${user.role}</span></p>
                            <p><strong>Status:</strong> <span class="status-badge ${user.isActive !== false ? 'status-delivered' : 'status-cancelled'}">${user.isActive !== false ? 'Active' : 'Inactive'}</span></p>
                            <p><strong>Member since:</strong> ${user.createdAt.toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div>
                        <h4>Address Information</h4>
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem;">
                            ${user.address ? `
                                <p><strong>Street:</strong> ${user.address.street || 'Not provided'}</p>
                                <p><strong>City:</strong> ${user.address.city || 'Not provided'}</p>
                                <p><strong>ZIP Code:</strong> ${user.address.zipCode || 'Not provided'}</p>
                            ` : '<p>No address information available</p>'}
                        </div>
                    </div>
                </div>

                <h4>Order History (${user.orderCount} total orders)</h4>
                ${recentOrders.length > 0 ? `
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${recentOrders.map(order => `
                            <div style="display: flex; justify-content: between; align-items: center; padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                                <div>
                                    <div style="font-weight: 500;">Order #${order.id.slice(-8)}</div>
                                    <div style="color: var(--gray); font-size: 0.9rem;">
                                        ${order.items.length} items • ${order.createdAt.toLocaleDateString()}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold;">₱${order.total.toFixed(2)}</div>
                                    <span class="status-badge status-${order.status}">${order.status}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--gray);">
                        <i class="fas fa-shopping-bag" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>No orders found for this user</p>
                    </div>
                `}

                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-warning" onclick="adminUsersManager.updateUserRole('${user.id}', 'admin')">
                            Make Admin
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="adminUsersManager.updateUserRole('${user.id}', 'user')">
                            Remove Admin
                        </button>
                    `}
                    
                    ${user.isActive !== false ? `
                        <button class="btn btn-danger" onclick="adminUsersManager.updateUserStatus('${user.id}', false)">
                            Deactivate User
                        </button>
                    ` : `
                        <button class="btn btn-success" onclick="adminUsersManager.updateUserStatus('${user.id}', true)">
                            Activate User
                        </button>
                    `}
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    async getUserRecentOrders(userId, limit = 5) {
        try {
            const snapshot = await this.db.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            
            const orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                orders.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            });
            return orders;
        } catch (error) {
            console.error('Error loading user orders:', error);
            return [];
        }
    }

    closeUserModal() {
        const modal = document.getElementById('userModal');
        modal.classList.remove('active');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This will permanently remove their account and cannot be undone.')) {
            return;
        }

        try {
            // Delete user document
            await this.db.collection('users').doc(userId).delete();
            
            // Delete user's cart
            await this.db.collection('cart').doc(userId).delete();
            
            // Remove from local data
            this.users = this.users.filter(user => user.id !== userId);
            
            this.showMessage('User deleted successfully!', 'success');
            this.renderUsers(this.users);
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError('Failed to delete user');
        }
    }

    showMessage(message, type) {
        Helpers.showToast(message, type);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize Admin Users Manager
window.adminUsersManager = new AdminUsersManager();