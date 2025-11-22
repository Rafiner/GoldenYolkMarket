class AdminOrdersManager {
    constructor() {
        this.db = firebaseDb;
        this.orders = [];
        this.users = new Map();
        this.filters = {
            status: 'all',
            date: '',
            search: ''
        };
        this.init();
    }

    async init() {
        await this.loadOrders();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter events
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.filters.date = e.target.value;
            this.applyFilters();
        });

        document.getElementById('searchOrders').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Modal close
        document.getElementById('orderModalClose').addEventListener('click', () => {
            this.closeOrderModal();
        });
    }

    async loadOrders() {
        try {
            const snapshot = await this.db.collection('orders')
                .orderBy('createdAt', 'desc')
                .get();
            
            this.orders = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const userData = await this.getUserData(data.userId);
                
                this.orders.push({
                    id: doc.id,
                    ...data,
                    user: userData,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
            }
            
            this.renderOrders(this.orders);
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError('Failed to load orders');
        }
    }

    async getUserData(userId) {
        if (this.users.has(userId)) {
            return this.users.get(userId);
        }

        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                this.users.set(userId, userData);
                return userData;
            }
            return { displayName: 'Unknown User', email: 'N/A' };
        } catch (error) {
            console.error('Error loading user data:', error);
            return { displayName: 'Error Loading User', email: 'N/A' };
        }
    }

    renderOrders(orders) {
        const tbody = document.getElementById('ordersTable');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <i class="fas fa-shopping-bag"></i>
                            <p>No orders found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>
                    <strong>#${order.id.slice(-8)}</strong>
                </td>
                <td>
                    <div>
                        <strong>${order.user?.displayName || 'Unknown User'}</strong>
                        <div style="font-size: 0.8rem; color: var(--gray);">
                            ${order.user?.email || 'N/A'}
                        </div>
                    </div>
                </td>
                <td>
                    ${order.items.length} items
                    <div style="font-size: 0.8rem; color: var(--gray);">
                        ${order.items.slice(0, 2).map(item => item.name).join(', ')}
                        ${order.items.length > 2 ? '...' : ''}
                    </div>
                </td>
                <td>
                    <strong>₱${order.total?.toFixed(2) || '0.00'}</strong>
                </td>
                <td>
                    <select class="status-select form-select" data-order-id="${order.id}" style="width: 120px;">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="packed" ${order.status === 'packed' ? 'selected' : ''}>Packed</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    ${order.createdAt.toLocaleDateString()}
                    <div style="font-size: 0.8rem; color: var(--gray);">
                        ${order.createdAt.toLocaleTimeString()}
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary btn-sm view-order" data-order-id="${order.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-danger btn-sm delete-order" data-order-id="${order.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.attachOrderEvents();
    }

    attachOrderEvents() {
        // Status changes
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const orderId = e.target.dataset.orderId;
                const newStatus = e.target.value;
                this.updateOrderStatus(orderId, newStatus);
            });
        });

        // View order details
        document.querySelectorAll('.view-order').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.orderId;
                this.viewOrderDetails(orderId);
            });
        });

        // Delete orders
        document.querySelectorAll('.delete-order').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.orderId;
                this.deleteOrder(orderId);
            });
        });
    }

    applyFilters() {
        let filteredOrders = this.orders;

        // Apply status filter
        if (this.filters.status !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.status === this.filters.status);
        }

        // Apply date filter
        if (this.filters.date) {
            const filterDate = new Date(this.filters.date);
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate.toDateString() === filterDate.toDateString();
            });
        }

        // Apply search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filteredOrders = filteredOrders.filter(order => 
                order.id.toLowerCase().includes(searchTerm) ||
                order.user?.displayName?.toLowerCase().includes(searchTerm) ||
                order.user?.email?.toLowerCase().includes(searchTerm) ||
                order.items.some(item => item.name.toLowerCase().includes(searchTerm))
            );
        }

        this.renderOrders(filteredOrders);
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            await this.db.collection('orders').doc(orderId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local data
            const orderIndex = this.orders.findIndex(order => order.id === orderId);
            if (orderIndex !== -1) {
                this.orders[orderIndex].status = newStatus;
                this.orders[orderIndex].updatedAt = new Date();
            }

            this.showMessage(`Order status updated to ${newStatus}`, 'success');
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showError('Failed to update order status');
        }
    }

    async viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('orderModal');
        const modalContent = document.getElementById('orderModalContent');
        const modalTitle = document.getElementById('orderModalTitle');

        modalTitle.textContent = `Order Details #${order.id.slice(-8)}`;

        modalContent.innerHTML = `
            <div style="padding: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h4>Customer Information</h4>
                        <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">
                            <p><strong>Name:</strong> ${order.user?.displayName || 'N/A'}</p>
                            <p><strong>Email:</strong> ${order.user?.email || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${order.user?.phone || 'N/A'}</p>
                            ${order.user?.address ? `
                                <p><strong>Address:</strong> ${order.user.address.street || ''} ${order.user.address.city || ''} ${order.user.address.zipCode || ''}</p>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <h4>Order Information</h4>
                        <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">
                            <p><strong>Order Date:</strong> ${order.createdAt.toLocaleString()}</p>
                            <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
                            <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Cash on Delivery'}</p>
                            <p><strong>Last Updated:</strong> ${order.updatedAt.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <h4>Order Items</h4>
                <div style="margin-bottom: 2rem;">
                    ${order.items.map(item => `
                        <div style="display: flex; justify-content: between; align-items: center; padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <img src="${item.image || 'https://via.placeholder.com/60x60?text=No+Image'}" 
                                     alt="${item.name}" 
                                     style="width: 60px; height: 60px; object-fit: cover; border-radius: 0.5rem;">
                                <div>
                                    <div style="font-weight: 500;">${item.name}</div>
                                    <div style="color: var(--gray); font-size: 0.9rem;">
                                        ₱${item.price.toFixed(2)} × ${item.quantity}
                                    </div>
                                </div>
                            </div>
                            <div style="font-weight: bold; font-size: 1.1rem;">
                                ₱${(item.price * item.quantity).toFixed(2)}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem;">
                    <div style="display: flex; justify-content: between; margin-bottom: 0.5rem;">
                        <span>Subtotal:</span>
                        <span>₱${order.subtotal?.toFixed(2) || order.total.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: between; margin-bottom: 0.5rem;">
                        <span>Shipping Fee:</span>
                        <span>₱${order.shipping?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div style="display: flex; justify-content: between; font-weight: bold; font-size: 1.2rem; padding-top: 0.5rem; border-top: 2px solid #e5e7eb;">
                        <span>Total:</span>
                        <span>₱${order.total.toFixed(2)}</span>
                    </div>
                </div>

                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-primary" onclick="adminOrdersManager.updateOrderStatus('${order.id}', 'delivered')">
                        Mark as Delivered
                    </button>
                    <button class="btn btn-danger" onclick="adminOrdersManager.updateOrderStatus('${order.id}', 'cancelled')">
                        Cancel Order
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        modal.classList.remove('active');
    }

    async deleteOrder(orderId) {
        if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.collection('orders').doc(orderId).delete();
            
            // Remove from local data
            this.orders = this.orders.filter(order => order.id !== orderId);
            
            this.showMessage('Order deleted successfully!', 'success');
            this.renderOrders(this.orders);
        } catch (error) {
            console.error('Error deleting order:', error);
            this.showError('Failed to delete order');
        }
    }

    showMessage(message, type) {
        Helpers.showToast(message, type);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize Admin Orders Manager
window.adminOrdersManager = new AdminOrdersManager();