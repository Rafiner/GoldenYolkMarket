class OrdersManager {
    constructor() {
        this.db = firebaseDb;
        this.orders = [];
        this.filters = {
            status: 'all',
            date: 'all'
        };
        this.init();
    }

    async init() {
        await this.loadOrders();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter changes
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.filters.date = e.target.value;
            this.applyFilters();
        });
    }

    async loadOrders() {
        try {
            const userId = authManager.getCurrentUser().uid;
            const snapshot = await this.db.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            
            this.orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.orders.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
            });
            
            this.renderOrders(this.orders);
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError('Failed to load orders');
        }
    }

    renderOrders(orders) {
        const container = document.getElementById('ordersList');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-shopping-bag"></i>
                        <h3>No Orders Found</h3>
                        <p>You haven't placed any orders yet</p>
                        <a href="index.html" class="btn btn-primary">Start Shopping</a>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="card order-card">
                <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0 0 0.5rem 0;">Order #${order.id.slice(-8)}</h3>
                        <p style="color: var(--gray); margin: 0;">
                            Placed on ${order.createdAt.toLocaleDateString()} at ${order.createdAt.toLocaleTimeString()}
                        </p>
                    </div>
                    <span class="status-badge status-${order.status}">${order.status}</span>
                </div>

                <div style="margin-bottom: 1rem;">
                    ${order.items.map(item => `
                        <div style="display: flex; justify-content: between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}" 
                                     alt="${item.name}" 
                                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 0.5rem;">
                                <div>
                                    <div style="font-weight: 500;">${item.name}</div>
                                    <div style="color: var(--gray); font-size: 0.9rem;">₱${item.price.toFixed(2)} × ${item.quantity}</div>
                                </div>
                            </div>
                            <div style="font-weight: bold;">₱${(item.price * item.quantity).toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="display: flex; justify-content: between; align-items: center; padding-top: 1rem; border-top: 2px solid #e5e7eb;">
                    <div>
                        <strong>Total: ₱${order.total.toFixed(2)}</strong>
                        <div style="font-size: 0.9rem; color: var(--gray);">
                            ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-outline btn-sm view-order-details" data-order-id="${order.id}">
                            View Details
                        </button>
                        ${order.status === 'pending' ? `
                            <button class="btn btn-danger btn-sm cancel-order" data-order-id="${order.id}">
                                Cancel Order
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        this.attachOrderEvents();
    }

    attachOrderEvents() {
        // View order details
        document.querySelectorAll('.view-order-details').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                this.viewOrderDetails(orderId);
            });
        });

        // Cancel orders
        document.querySelectorAll('.cancel-order').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                this.cancelOrder(orderId);
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
        if (this.filters.date !== 'all') {
            const now = new Date();
            let startDate;

            switch (this.filters.date) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }

            if (startDate) {
                filteredOrders = filteredOrders.filter(order => order.createdAt >= startDate);
            }
        }

        this.renderOrders(filteredOrders);
    }

    viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        // Create modal with order details
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Order Details #${order.id.slice(-8)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <strong>Order Date:</strong><br>
                            ${order.createdAt.toLocaleDateString()} ${order.createdAt.toLocaleTimeString()}
                        </div>
                        <div>
                            <strong>Status:</strong><br>
                            <span class="status-badge status-${order.status}">${order.status}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">
                        <strong>Order Summary:</strong>
                        ${order.items.map(item => `
                            <div style="display: flex; justify-content: between; margin-top: 0.5rem;">
                                <span>${item.name} × ${item.quantity}</span>
                                <span>₱${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `).join('')}
                        <div style="border-top: 1px solid #e5e7eb; margin-top: 0.5rem; padding-top: 0.5rem;">
                            <div style="display: flex; justify-content: between; font-weight: bold;">
                                <span>Total:</span>
                                <span>₱${order.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order?')) return;

        try {
            await this.db.collection('orders').doc(orderId).update({
                status: 'cancelled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Reload orders
            await this.loadOrders();
            this.showMessage('Order cancelled successfully', 'success');
        } catch (error) {
            console.error('Error cancelling order:', error);
            this.showMessage('Failed to cancel order', 'error');
        }
    }

    showError(message) {
        const container = document.getElementById('ordersList');
        if (container) {
            container.innerHTML = `
                <div class="card">
                    <div class="alert alert-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${message}</span>
                    </div>
                </div>
            `;
        }
    }

    showMessage(message, type) {
        Helpers.showToast(message, type);
    }
}

// Initialize Orders Manager
document.addEventListener('DOMContentLoaded', () => {
    new OrdersManager();
});