class UserDashboard {
    constructor() {
        this.db = firebaseDb;
        this.orders = [];
        this.userData = null;
        this.products = [];
        this.filteredProducts = [];
        this.cartItems = [];
        this.currentPage = 1;
        this.productsPerPage = 8;
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.init();
    }

    async init() {
        await authManager.ready;
        
        if (!authManager.isAuthenticated()) {
            window.location.href = '../login.html';
            return;
        }

        await this.loadUserData();
        await this.loadProducts();
        await this.loadRecentOrders();
        await this.loadCartItems();
        this.updateStats();
        this.updateOrderStatusOverview();
        this.setupRealTimeListeners();
        this.setupEventListeners();
        
        console.log('✅ User dashboard initialized successfully');
    }

    async loadUserData() {
        try {
            const userId = authManager.getCurrentUser().uid;
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (userDoc.exists) {
                this.userData = userDoc.data();
                this.updateWelcomeMessage();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateWelcomeMessage() {
        const welcomeElement = document.getElementById('welcomeMessage');
        if (welcomeElement && this.userData?.displayName) {
            const firstName = this.userData.displayName.split(' ')[0];
            const hour = new Date().getHours();
            let greeting = 'Welcome Back';
            
            if (hour < 12) greeting = 'Good Morning';
            else if (hour < 18) greeting = 'Good Afternoon';
            else greeting = 'Good Evening';
            
            welcomeElement.textContent = `${greeting}, ${firstName}!`;
        }
    }

    async loadProducts() {
    try {
        // FIXED: Remove the where filter and use correct field names
        const snapshot = await this.db.collection('products').get();
        
        this.products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            this.products.push({ 
                id: doc.id, 
                name: data.name || 'Unnamed Product',
                description: data.description || '',
                price: data.price || 0,
                category: data.category || 'general',
                // FIXED: Use 'quantity' field
                stock: data.quantity || data.stock || 0,
                imageUrl: data.imageUrl || data.image || '',
                // FIXED: Use 'available' field
                isActive: data.available !== false,
                createdAt: data.createdAt?.toDate() || new Date(),
                ...data
            });
        });
        
        this.filteredProducts = [...this.products];
        this.renderProducts();
        this.setupPagination();
        
    } catch (error) {
        console.error('Error loading products:', error);
        this.showProductsError('Failed to load products');
    }
}

    filterProducts() {
        this.filteredProducts = this.products.filter(product => {
            const matchesCategory = this.currentCategory === 'all' || 
                                  product.category === this.currentCategory;
            const matchesSearch = !this.searchTerm || 
                                product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                                product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
        
        this.currentPage = 1;
        this.renderProducts();
        this.setupPagination();
    }

    renderProducts() {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (this.filteredProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-egg"></i>
                    <h3>No Products Found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.productsPerPage;
        const endIndex = startIndex + this.productsPerPage;
        const productsToShow = this.filteredProducts.slice(startIndex, endIndex);

        container.innerHTML = `
            <div class="products-grid">
                ${productsToShow.map(product => `
                    <div class="product-card">
                        <div class="product-badge-container">
                            ${product.stock <= 10 ? `
                                <span class="product-badge low-stock-badge">
                                    <i class="fas fa-exclamation-triangle"></i> Low Stock
                                </span>
                            ` : ''}
                            ${product.isNew ? `
                                <span class="product-badge new-badge">
                                    <i class="fas fa-star"></i> New
                                </span>
                            ` : ''}
                        </div>
                        <img src="${product.imageUrl || '../images/placeholder.jpg'}" 
                             alt="${product.name}" class="product-image"
                             onerror="this.src='../images/placeholder.jpg'">
                        <div class="product-info">
                            <h3 class="product-name">${product.name}</h3>
                            <p class="product-description">${product.description || 'Fresh farm eggs'}</p>
                            
                            <div class="product-meta">
                                <span class="product-category">${product.category || 'Eggs'}</span>
                                <span class="product-stock ${product.stock <= 10 ? 'low-stock' : ''}">
                                    ${product.stock} in stock
                                </span>
                            </div>
                            
                            <div class="product-price">₱${(product.price || 0).toFixed(2)}</div>
                            
                            <div class="product-actions">
                                <button class="btn btn-primary btn-sm add-to-cart-btn" 
                                        data-product-id="${product.id}"
                                        ${product.stock === 0 ? 'disabled' : ''}>
                                    <i class="fas fa-cart-plus"></i> 
                                    ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                                </button>
                                <button class="btn btn-outline btn-sm quick-view-btn" 
                                        data-product-id="${product.id}">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-outline btn-sm wishlist-btn" 
                                        data-product-id="${product.id}">
                                    <i class="fas fa-heart"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.attachProductEvents();
    }

    setupPagination() {
        const pagination = document.getElementById('productsPagination');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        const totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;

        prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderProducts();
                this.setupPagination();
            }
        };

        nextBtn.onclick = () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderProducts();
                this.setupPagination();
            }
        };
    }

    async loadRecentOrders() {
        try {
            const userId = authManager.getCurrentUser().uid;
            const snapshot = await this.db.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(5)
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
            
            this.renderRecentOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError('Failed to load orders');
        }
    }

    async loadCartItems() {
        try {
            const userId = authManager.getCurrentUser().uid;
            const cartDoc = await this.db.collection('carts').doc(userId).get();
            
            if (cartDoc.exists) {
                const cartData = cartDoc.data();
                this.cartItems = cartData.items || [];
                this.renderCartPreview();
            }
        } catch (error) {
            console.error('Error loading cart items:', error);
        }
    }

    renderCartPreview() {
        const cartPreview = document.getElementById('cartPreview');
        const cartItemsPreview = document.getElementById('cartItemsPreview');

        if (this.cartItems.length === 0) {
            cartPreview.style.display = 'none';
            return;
        }

        cartPreview.style.display = 'block';
        
        // Show only 3 items in preview
        const previewItems = this.cartItems.slice(0, 3);
        const totalItems = this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = this.calculateCartTotal();

        cartItemsPreview.innerHTML = `
            <div style="margin-bottom: 1rem;">
                ${previewItems.map(item => `
                    <div style="display: flex; justify-content: between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--gray-light);">
                        <span style="flex: 1; font-size: 0.9rem;">${item.name || 'Product'}</span>
                        <span style="font-weight: bold;">${item.quantity} × ₱${(item.price || 0).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                <span>Total (${totalItems} items):</span>
                <span>₱${totalPrice.toFixed(2)}</span>
            </div>
        `;
    }

    calculateCartTotal() {
        return this.cartItems.reduce((total, item) => {
            return total + (item.price || 0) * (item.quantity || 1);
        }, 0);
    }

    renderRecentOrders() {
        const container = document.getElementById('recentOrders');
        if (!container) return;

        if (this.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h3>No Orders Yet</h3>
                    <p>Start shopping to see your orders here</p>
                    <button class="btn btn-primary" onclick="window.userDashboard.scrollToProducts()">
                        Start Shopping
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.orders.map(order => `
            <div class="order-item">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0;">Order #${order.id.slice(-8)}</h4>
                        <p style="color: var(--gray); margin: 0.25rem 0;">
                            ${order.items?.length || 0} items • ${order.createdAt.toLocaleDateString()}
                        </p>
                        ${this.renderOrderProgress(order)}
                    </div>
                    <div style="text-align: right;">
                        <span class="status-badge status-${order.status}">${order.status}</span>
                        <div style="font-weight: bold; margin-top: 0.5rem;">₱${(order.total || 0).toFixed(2)}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap;">
                    <a href="order-details.html?id=${order.id}" class="btn btn-sm btn-outline">
                        <i class="fas fa-info-circle"></i> Details
                    </a>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-sm btn-danger cancel-order" data-order-id="${order.id}">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                    ${order.status === 'delivered' ? `
                        <button class="btn btn-sm btn-success reorder-btn" data-order-id="${order.id}">
                            <i class="fas fa-redo"></i> Reorder
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        this.attachOrderEvents();
    }

    renderOrderProgress(order) {
        const steps = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'];
        const currentIndex = steps.indexOf(order.status);
        const progressPercentage = ((currentIndex + 1) / steps.length) * 100;
        
        return `
            <div style="margin: 1rem 0;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--gray); margin-bottom: 0.5rem;">
                    ${steps.map(step => `
                        <span style="text-align: center; flex: 1;">
                            <i class="fas fa-${this.getStepIcon(step)}" 
                               style="color: ${steps.indexOf(step) <= currentIndex ? 'var(--primary)' : 'var(--gray-light)'}"></i>
                            <div style="margin-top: 0.25rem; font-size: 0.7rem;">${step}</div>
                        </span>
                    `).join('')}
                </div>
                <div style="background: var(--gray-light); height: 6px; border-radius: 3px; position: relative;">
                    <div style="background: var(--primary); height: 100%; width: ${progressPercentage}%; border-radius: 3px; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
    }

    getStepIcon(step) {
        const icons = {
            pending: 'clock',
            confirmed: 'check-circle',
            packed: 'box',
            shipped: 'shipping-fast',
            delivered: 'check-double'
        };
        return icons[step] || 'circle';
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.filterProducts();
            });
        });

        // Search functionality
        document.getElementById('productSearch').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.filterProducts();
        });

        this.attachOrderEvents();
        this.attachProductEvents();
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const result = await authManager.signOut();
            if (result.success) {
                window.location.href = '../index.html';
            }
        });
    }

    attachOrderEvents() {
        document.querySelectorAll('.cancel-order').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.orderId;
                this.cancelOrder(orderId);
            });
        });

        document.querySelectorAll('.reorder-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.orderId;
                this.reorderItems(orderId);
            });
        });
    }

    attachProductEvents() {
        // Add to cart buttons
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                this.addToCart(productId);
            });
        });

        // Quick view buttons
        document.querySelectorAll('.quick-view-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                this.showProductQuickView(productId);
            });
        });

        // Wishlist buttons
        document.querySelectorAll('.wishlist-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                this.toggleWishlist(productId);
            });
        });
    }

    async showProductQuickView(productId) {
        try {
            const productDoc = await this.db.collection('products').doc(productId).get();
            if (!productDoc.exists) {
                Helpers.showToast('Product not found', 'error');
                return;
            }

            const product = { id: productDoc.id, ...productDoc.data() };
            const modalContent = document.getElementById('productModalContent');
            
            modalContent.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <img src="${product.imageUrl || '../images/placeholder.jpg'}" 
                             alt="${product.name}" 
                             style="width: 100%; border-radius: 0.5rem;"
                             onerror="this.src='../images/placeholder.jpg'">
                    </div>
                    <div>
                        <h3 style="margin-bottom: 0.5rem;">${product.name}</h3>
                        <div class="product-price" style="font-size: 1.5rem; margin-bottom: 1rem;">₱${(product.price || 0).toFixed(2)}</div>
                        
                        <div style="margin-bottom: 1rem;">
                            <span class="product-category">${product.category || 'Eggs'}</span>
                            <span class="product-stock ${product.stock <= 10 ? 'low-stock' : ''}" style="margin-left: 1rem;">
                                ${product.stock} in stock
                            </span>
                        </div>
                        
                        <p style="color: var(--gray); margin-bottom: 1.5rem;">${product.description || 'Fresh farm eggs'}</p>
                        
                        <div class="product-actions">
                            <button class="btn btn-primary add-to-cart-btn" 
                                    data-product-id="${product.id}"
                                    ${product.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-cart-plus"></i> 
                                ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                            </button>
                            <button class="btn btn-outline wishlist-btn" data-product-id="${product.id}">
                                <i class="fas fa-heart"></i> Add to Wishlist
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Re-attach events for modal buttons
            setTimeout(() => {
                this.attachProductEvents();
            }, 100);

            document.getElementById('productModal').classList.add('active');
            
        } catch (error) {
            console.error('Error loading product details:', error);
            Helpers.showToast('Failed to load product details', 'error');
        }
    }

    async addToCart(productId) {
        try {
            const productDoc = await this.db.collection('products').doc(productId).get();
            if (!productDoc.exists) {
                Helpers.showToast('Product not found', 'error');
                return;
            }

            const product = productDoc.data();
            if (product.stock === 0) {
                Helpers.showToast('Product is out of stock', 'warning');
                return;
            }

            const userId = authManager.getCurrentUser().uid;
            const cartRef = this.db.collection('carts').doc(userId);
            const cartDoc = await cartRef.get();
            
            if (cartDoc.exists) {
                const cartData = cartDoc.data();
                const existingItem = cartData.items.find(item => item.productId === productId);
                
                if (existingItem) {
                    // Check if adding more would exceed stock
                    if (existingItem.quantity + 1 > product.stock) {
                        Helpers.showToast('Not enough stock available', 'warning');
                        return;
                    }
                    
                    await cartRef.update({
                        items: cartData.items.map(item => 
                            item.productId === productId 
                                ? { 
                                    ...item, 
                                    quantity: item.quantity + 1,
                                    price: product.price,
                                    name: product.name,
                                    imageUrl: product.imageUrl
                                }
                                : item
                        )
                    });
                } else {
                    await cartRef.update({
                        items: [...cartData.items, { 
                            productId, 
                            quantity: 1,
                            price: product.price,
                            name: product.name,
                            imageUrl: product.imageUrl,
                            addedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }]
                    });
                }
            } else {
                await cartRef.set({
                    items: [{ 
                        productId, 
                        quantity: 1,
                        price: product.price,
                        name: product.name,
                        imageUrl: product.imageUrl,
                        addedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            Helpers.showToast('Product added to cart!', 'success');
            await this.loadCartItems();
            this.renderProducts(); // Update add to cart buttons if needed
            
        } catch (error) {
            console.error('Error adding to cart:', error);
            Helpers.showToast('Failed to add product to cart', 'error');
        }
    }

    async toggleWishlist(productId) {
        try {
            const userId = authManager.getCurrentUser().uid;
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            let wishlist = [];
            if (userDoc.exists && userDoc.data().wishlist) {
                wishlist = userDoc.data().wishlist;
            }

            const isInWishlist = wishlist.includes(productId);
            
            if (isInWishlist) {
                // Remove from wishlist
                await userRef.update({
                    wishlist: firebase.firestore.FieldValue.arrayRemove(productId)
                });
                Helpers.showToast('Removed from wishlist', 'success');
            } else {
                // Add to wishlist
                await userRef.update({
                    wishlist: firebase.firestore.FieldValue.arrayUnion(productId)
                });
                Helpers.showToast('Added to wishlist!', 'success');
            }
            
        } catch (error) {
            console.error('Error updating wishlist:', error);
            Helpers.showToast('Failed to update wishlist', 'error');
        }
    }

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order?')) return;

        try {
            await this.db.collection('orders').doc(orderId).update({
                status: 'cancelled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await this.loadRecentOrders();
            this.updateStats();
            this.updateOrderStatusOverview();
            Helpers.showToast('Order cancelled successfully', 'success');
        } catch (error) {
            console.error('Error cancelling order:', error);
            Helpers.showToast('Failed to cancel order', 'error');
        }
    }

    async reorderItems(orderId) {
        try {
            const order = this.orders.find(o => o.id === orderId);
            if (!order || !order.items) {
                Helpers.showToast('Could not find order items', 'error');
                return;
            }

            const userId = authManager.getCurrentUser().uid;
            const cartRef = this.db.collection('carts').doc(userId);
            const cartDoc = await cartRef.get();
            
            let currentCart = [];
            if (cartDoc.exists) {
                currentCart = cartDoc.data().items || [];
            }

            // Add all items from the order to cart
            const updatedCart = [...currentCart];
            for (const orderItem of order.items) {
                const productDoc = await this.db.collection('products').doc(orderItem.productId).get();
                if (productDoc.exists) {
                    const product = productDoc.data();
                    const existingItemIndex = updatedCart.findIndex(item => item.productId === orderItem.productId);
                    
                    if (existingItemIndex > -1) {
                        const newQuantity = updatedCart[existingItemIndex].quantity + (orderItem.quantity || 1);
                        if (newQuantity <= product.stock) {
                            updatedCart[existingItemIndex].quantity = newQuantity;
                        }
                    } else {
                        updatedCart.push({
                            productId: orderItem.productId,
                            quantity: orderItem.quantity || 1,
                            price: product.price,
                            name: product.name,
                            imageUrl: product.imageUrl,
                            addedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }

            await cartRef.set({
                items: updatedCart,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            Helpers.showToast('Items added to cart!', 'success');
            await this.loadCartItems();
            
        } catch (error) {
            console.error('Error reordering items:', error);
            Helpers.showToast('Failed to add items to cart', 'error');
        }
    }

    updateStats() {
        const totalOrders = this.orders.length;
        const pendingOrders = this.orders.filter(order => 
            ['pending', 'confirmed', 'packed'].includes(order.status)
        ).length;
        const deliveredOrders = this.orders.filter(order => 
            order.status === 'delivered'
        ).length;
        const totalSpent = this.orders
            .filter(order => order.status === 'delivered')
            .reduce((sum, order) => sum + (order.total || 0), 0);

        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        document.getElementById('deliveredOrders').textContent = deliveredOrders;
        document.getElementById('totalSpent').textContent = `₱${totalSpent.toFixed(2)}`;
    }

    updateOrderStatusOverview() {
        const pendingCount = this.orders.filter(order => order.status === 'pending').length;
        const confirmedCount = this.orders.filter(order => order.status === 'confirmed').length;
        const shippedCount = this.orders.filter(order => order.status === 'shipped').length;
        const deliveredCount = this.orders.filter(order => order.status === 'delivered').length;

        // Update the overview counters if they exist
        if (document.getElementById('pendingCount')) {
            document.getElementById('pendingCount').textContent = pendingCount;
            document.getElementById('confirmedCount').textContent = confirmedCount;
            document.getElementById('shippedCount').textContent = shippedCount;
            document.getElementById('deliveredCount').textContent = deliveredCount;
        }
    }

    setupRealTimeListeners() {
        const userId = authManager.getCurrentUser().uid;
        
        // Listen for order updates
        this.db.collection('orders')
            .where('userId', '==', userId)
            .onSnapshot(() => {
                console.log('🔄 Orders updated - reloading data');
                this.loadRecentOrders();
                this.updateStats();
                this.updateOrderStatusOverview();
            });

        // Listen for cart updates
        this.db.collection('carts')
            .doc(userId)
            .onSnapshot(() => {
                console.log('🔄 Cart updated');
                this.loadCartItems();
            });

        // Listen for product updates (stock changes)
        this.db.collection('products')
            .where('isActive', '==', true)
            .onSnapshot(() => {
                console.log('🔄 Products updated - reloading data');
                this.loadProducts();
            });
    }

    scrollToProducts() {
        document.getElementById('productsSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    showError(message) {
        const container = document.getElementById('recentOrders');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                    <button onclick="window.userDashboard.loadRecentOrders()" class="btn btn-sm" style="margin-left: auto;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    showProductsError(message) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                    <button onclick="window.userDashboard.loadProducts()" class="btn btn-sm" style="margin-left: auto;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.userDashboard = new UserDashboard();
});