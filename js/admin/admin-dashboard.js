class AdminDashboard {
    constructor() {
        this.db = firebaseDb;
        this.stats = {
            totalUsers: 0, totalProducts: 0, totalOrders: 0, totalRevenue: 0,
            activeProducts: 0, pendingOrders: 0, newCustomers: 0, outOfStock: 0
        };
        this.recentOrders = [];
        this.lowStockItems = [];
        this.init();
    }

    async init() {
        console.log('🔧 AdminDashboard initializing...');
        
        const hasAccess = await this.checkAdminAccess();
        if (!hasAccess) {
            console.log('❌ Admin access denied');
            return;
        }
        
        console.log('✅ Admin access granted');
        await this.loadDashboardData();
        this.setupRealTimeListeners();
        this.setupEventListeners();
    }

    async checkAdminAccess() {
        await authManager.ready;
        console.log('👤 Current user:', authManager.getCurrentUser());
        
        if (!authManager.isAuthenticated()) {
            console.log('❌ User not authenticated');
            Helpers.showToast('Please login to access admin panel', 'warning');
            window.location.href = '../login.html';
            return false;
        }
        
        const isAdmin = await authManager.isAdmin();
        console.log('👑 Is admin?', isAdmin);
        
        if (!isAdmin) {
            console.log('❌ User is not admin');
            Helpers.showToast('Access denied. Admin privileges required.', 'error');
            window.location.href = '../index.html';
            return false;
        }
        
        return true;
    }

    setupEventListeners() {
        // Bulk actions
        document.getElementById('applyBulkAction')?.addEventListener('click', () => {
            this.handleBulkAction();
        });
        
        // Quick report generation
        document.querySelectorAll('.btn-warning').forEach(btn => {
            if (btn.textContent.includes('Generate Report')) {
                btn.addEventListener('click', () => {
                    this.generateReport();
                });
            }
        });
    }

    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            await Promise.all([
                this.loadUsers(),
                this.loadProducts(),
                this.loadOrders(),
                this.loadRecentOrders(),
                this.loadLowStockItems()
            ]);
            
            this.updateDashboardStats();
            this.renderRecentOrders();
            this.renderLowStockItems();
            this.calculatePerformanceMetrics();
            await this.loadSalesChart();
            console.log('✅ Dashboard data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadUsers() {
        try {
            console.log('👥 Loading users...');
            const snapshot = await this.db.collection('users').get();
            this.stats.totalUsers = snapshot.size;
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const newCustomers = snapshot.docs.filter(doc => {
                const userData = doc.data();
                const createdAt = userData.createdAt?.toDate() || new Date();
                return createdAt >= thirtyDaysAgo;
            });
            
            this.stats.newCustomers = newCustomers.length;
            console.log(`✅ Loaded ${this.stats.totalUsers} users, ${this.stats.newCustomers} new customers`);
        } catch (error) {
            console.error('❌ Error loading users:', error);
        }
    }

    async loadProducts() {
        try {
            console.log('📦 Loading products...');
            const snapshot = await this.db.collection('products').get();
            this.stats.totalProducts = snapshot.size;
            
            let activeCount = 0, outOfStockCount = 0;
            
            snapshot.forEach(doc => {
                const productData = doc.data();
                if (productData.isActive !== false) activeCount++;
                if (productData.stock === 0) outOfStockCount++;
            });
            
            this.stats.activeProducts = activeCount;
            this.stats.outOfStock = outOfStockCount;
            console.log(`✅ Loaded ${this.stats.totalProducts} products, ${this.stats.activeProducts} active, ${this.stats.outOfStock} out of stock`);
        } catch (error) {
            console.error('❌ Error loading products:', error);
        }
    }

    async loadOrders() {
        try {
            console.log('📋 Loading orders...');
            const snapshot = await this.db.collection('orders').get();
            this.stats.totalOrders = snapshot.size;
            
            let pendingCount = 0, totalRevenue = 0;
            
            snapshot.forEach(doc => {
                const orderData = doc.data();
                if (orderData.status === 'pending') pendingCount++;
                if (orderData.status === 'delivered') totalRevenue += orderData.total || 0;
            });
            
            this.stats.pendingOrders = pendingCount;
            this.stats.totalRevenue = totalRevenue;
            console.log(`✅ Loaded ${this.stats.totalOrders} orders, ${this.stats.pendingOrders} pending, Revenue: ₱${this.stats.totalRevenue.toFixed(2)}`);
        } catch (error) {
            console.error('❌ Error loading orders:', error);
        }
    }

    async loadRecentOrders() {
        try {
            console.log('🔄 Loading recent orders...');
            const snapshot = await this.db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
            
            this.recentOrders = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const userData = await this.getUserData(data.userId);
                
                this.recentOrders.push({
                    id: doc.id,
                    ...data,
                    user: userData,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            }
            console.log(`✅ Loaded ${this.recentOrders.length} recent orders`);
        } catch (error) {
            console.error('❌ Error loading recent orders:', error);
        }
    }

    async loadLowStockItems() {
        try {
            console.log('⚠️ Loading low stock items...');
            const snapshot = await this.db.collection('products')
                .where('stock', '<=', 10)
                .where('isActive', '==', true)
                .orderBy('stock', 'asc')
                .limit(5)
                .get();
            
            this.lowStockItems = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.lowStockItems.push({ id: doc.id, ...data });
            });
            console.log(`✅ Loaded ${this.lowStockItems.length} low stock items`);
        } catch (error) {
            console.error('❌ Error loading low stock items:', error);
        }
    }

    async getUserData(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) return userDoc.data();
            return { displayName: 'Unknown User', email: 'N/A' };
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            return { displayName: 'Error Loading User', email: 'N/A' };
        }
    }

    updateDashboardStats() {
        console.log('📈 Updating dashboard stats...');
        document.getElementById('totalUsers').textContent = this.stats.totalUsers;
        document.getElementById('totalProducts').textContent = this.stats.totalProducts;
        document.getElementById('totalOrders').textContent = this.stats.totalOrders;
        document.getElementById('totalRevenue').textContent = `₱${this.stats.totalRevenue.toFixed(2)}`;
        document.getElementById('activeProductsCount').textContent = this.stats.activeProducts;
        document.getElementById('pendingOrdersCount').textContent = this.stats.pendingOrders;
        document.getElementById('newCustomersCount').textContent = this.stats.newCustomers;
        document.getElementById('outOfStockCount').textContent = this.stats.outOfStock;
        console.log('✅ Dashboard stats updated');
    }

    renderRecentOrders() {
        const container = document.getElementById('recentOrders');
        if (!container) {
            console.log('❌ Recent orders container not found');
            return;
        }

        if (this.recentOrders.length === 0) {
            container.innerHTML = `<div class="empty-state">No recent orders</div>`;
            console.log('ℹ️ No recent orders to display');
            return;
        }

        container.innerHTML = this.recentOrders.map(order => `
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                        <strong>Order #${order.id.slice(-8)}</strong>
                        <div style="font-size: 0.8rem; color: var(--gray);">${order.user?.displayName || 'Unknown User'}</div>
                    </div>
                    <span class="status-badge status-${order.status}">${order.status}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.9rem;">${order.items?.length || 0} items • ${order.createdAt.toLocaleDateString()}</span>
                    <span style="font-weight: bold;">₱${(order.total || 0).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
        console.log('✅ Recent orders rendered');
    }

    renderLowStockItems() {
        const container = document.getElementById('lowStockItems');
        if (!container) {
            console.log('❌ Low stock items container not found');
            return;
        }

        if (this.lowStockItems.length === 0) {
            container.innerHTML = `<div class="empty-state">All products are well stocked</div>`;
            console.log('ℹ️ No low stock items to display');
            return;
        }

        container.innerHTML = this.lowStockItems.map(product => `
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                        <strong>${product.name}</strong>
                        <div style="font-size: 0.8rem; color: var(--gray);">${product.category} • ${product.type || 'Standard'}</div>
                    </div>
                    <span style="color: var(--warning); font-weight: bold;">${product.stock}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>₱${(product.price || 0).toFixed(2)}</span>
                    <a href="products.html?edit=${product.id}" class="btn btn-sm btn-outline">Restock</a>
                </div>
            </div>
        `).join('');
        console.log('✅ Low stock items rendered');
    }

    calculatePerformanceMetrics() {
        const avgOrderValue = this.stats.totalOrders > 0 ? this.stats.totalRevenue / this.stats.totalOrders : 0;
        const conversionRate = this.stats.totalUsers > 0 ? (this.stats.totalOrders / this.stats.totalUsers * 100) : 0;
        
        document.getElementById('avgOrderValue').textContent = `₱${avgOrderValue.toFixed(2)}`;
        document.getElementById('conversionRate').textContent = `${conversionRate.toFixed(1)}%`;
        console.log('📊 Performance metrics calculated');
    }

    async loadSalesChart() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const snapshot = await this.db.collection('orders')
                .where('createdAt', '>=', thirtyDaysAgo)
                .where('status', '==', 'delivered')
                .get();
            
            const dailySales = {};
            snapshot.forEach(doc => {
                const order = doc.data();
                const date = order.createdAt.toDate().toISOString().split('T')[0];
                dailySales[date] = (dailySales[date] || 0) + (order.total || 0);
            });
            
            this.renderSalesChart(dailySales);
        } catch (error) {
            console.error('Error loading sales chart:', error);
        }
    }

    renderSalesChart(dailySales) {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not loaded, skipping chart rendering');
            return;
        }

        const chartContainer = document.createElement('div');
        chartContainer.innerHTML = `
            <div class="card">
                <h2>Sales Overview (Last 30 Days)</h2>
                <div class="chart-container">
                    <canvas id="salesChart" height="250"></canvas>
                </div>
            </div>
        `;
        
        // Insert after performance metrics
        const performanceCard = document.querySelector('.card');
        if (performanceCard) {
            performanceCard.parentNode.insertBefore(chartContainer, performanceCard.nextSibling);
        }
        
        // Initialize chart
        setTimeout(() => {
            this.initializeChart(dailySales);
        }, 100);
    }

    initializeChart(dailySales) {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        const dates = Object.keys(dailySales).sort();
        const sales = dates.map(date => dailySales[date]);
        
        new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString()),
                datasets: [{
                    label: 'Daily Sales',
                    data: sales,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    setupRealTimeListeners() {
        console.log('👂 Setting up real-time listeners...');
        
        let updateTimeout;
        const debouncedUpdate = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.loadDashboardData();
            }, 1000);
        };

        this.db.collection('orders').onSnapshot(() => debouncedUpdate());
        this.db.collection('products').onSnapshot(() => debouncedUpdate());
        this.db.collection('users').onSnapshot(() => debouncedUpdate());
        
        console.log('✅ Real-time listeners set up');
    }

    async handleBulkAction() {
        const bulkAction = document.getElementById('bulkAction');
        const selectedCount = document.getElementById('selectedCount');
        
        if (!bulkAction || !selectedCount) return;

        const action = bulkAction.value;
        const count = parseInt(selectedCount.textContent);
        
        if (!action || count === 0) {
            Helpers.showToast('Please select an action and orders', 'warning');
            return;
        }

        // In a real implementation, you'd get selected order IDs
        const selectedOrderIds = []; // This would come from checkboxes
        
        if (selectedOrderIds.length === 0) {
            Helpers.showToast('No orders selected', 'warning');
            return;
        }

        try {
            await this.bulkUpdateOrderStatus(selectedOrderIds, action);
        } catch (error) {
            console.error('Error in bulk action:', error);
            Helpers.showToast('Failed to update orders', 'error');
        }
    }

    async bulkUpdateOrderStatus(orderIds, newStatus) {
        try {
            const batch = this.db.batch();
            orderIds.forEach(orderId => {
                const orderRef = this.db.collection('orders').doc(orderId);
                batch.update(orderRef, {
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
            Helpers.showToast(`Updated ${orderIds.length} orders to ${newStatus}`, 'success');
        } catch (error) {
            console.error('Error bulk updating orders:', error);
            Helpers.showToast('Failed to update orders', 'error');
        }
    }

    generateReport() {
        console.log('📄 Generating report...');
        const reportData = {
            generatedAt: new Date().toLocaleString(),
            totalUsers: this.stats.totalUsers, 
            totalProducts: this.stats.totalProducts,
            totalOrders: this.stats.totalOrders, 
            totalRevenue: this.stats.totalRevenue,
            activeProducts: this.stats.activeProducts, 
            pendingOrders: this.stats.pendingOrders,
            lowStockItems: this.lowStockItems.length,
            recentOrders: this.recentOrders.map(order => ({
                id: order.id,
                customer: order.user?.displayName,
                total: order.total,
                status: order.status,
                date: order.createdAt.toLocaleDateString()
            }))
        };

        const dataStr = JSON.stringify(reportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `golden-yolk-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        Helpers.showToast('Report generated successfully!', 'success');
        console.log('✅ Report generated');
    }

    exportToCSV() {
        const ordersData = this.recentOrders.map(order => ({
            'Order ID': order.id,
            'Customer': order.user?.displayName || 'Unknown',
            'Total': order.total,
            'Status': order.status,
            'Date': order.createdAt.toLocaleDateString(),
            'Items': order.items?.length || 0
        }));

        if (ordersData.length === 0) {
            Helpers.showToast('No data to export', 'warning');
            return;
        }

        const headers = Object.keys(ordersData[0]);
        const csvContent = [
            headers.join(','),
            ...ordersData.map(row => 
                headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        Helpers.showToast('CSV exported successfully!', 'success');
    }

    showError(message) {
        console.error('💥 Dashboard error:', message);
        Helpers.showToast(message, 'error');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminDashboard = new AdminDashboard();
});