class ProductsManager {
    constructor() {
        this.db = firebaseDb;
        this.products = [];
        this.filteredProducts = [];
        this.currentPage = 1;
        this.productsPerPage = 12;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.sortBy = 'newest';
        this.init();
    }

    async init() {
        console.log('🔧 Products Manager initializing...');
        await this.setupEventListeners();
        await this.loadProducts();
        this.setupRealTimeListeners();
        console.log('✅ Products Manager initialized successfully');
    }

    async setupEventListeners() {
        // Basic filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.applyFiltersAndSort();
            });
        });

        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart')) {
                this.handleAddToCart(e.target.closest('.add-to-cart'));
            }
            if (e.target.closest('.quick-view-btn')) {
                this.handleQuickView(e.target.closest('.quick-view-btn'));
            }
            if (e.target.closest('.wishlist-btn')) {
                this.handleWishlist(e.target.closest('.wishlist-btn'));
            }
        });
    }

    initEnhancedFeatures() {
        // Search functionality
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.applyFiltersAndSort();
            });
        }

        // Sort functionality
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFiltersAndSort();
            });
        }

        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderProducts();
                this.setupPagination();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderProducts();
                this.setupPagination();
            }
        });

        console.log('✅ Enhanced features initialized');
    }

    async loadProducts() {
        try {
            console.log('📦 Loading products from Firebase...');
            
            const snapshot = await this.db.collection('products').get();
            
            this.products = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('📄 Product data:', data);
                
                // Clean up the data - remove extra quotation marks
                const cleanData = this.cleanProductData(data);
                
                this.products.push({
                    id: doc.id,
                    name: cleanData.name || 'Unnamed Product',
                    description: cleanData.description || '',
                    price: cleanData.price || 0,
                    category: cleanData.category || 'general',
                    type: cleanData.type || 'standard',
                    stock: cleanData.quantity || cleanData.stock || 0,
                    imageUrl: cleanData.imageUrl || cleanData.image || cleanData.ImageUrl || '',
                    images: cleanData.images || [],
                    isActive: cleanData.available !== false,
                    createdAt: cleanData.createdAt?.toDate() || new Date(),
                    updatedAt: cleanData.updatedAt?.toDate() || new Date(),
                    ...cleanData
                });
            });
            
            console.log(`✅ Loaded ${this.products.length} products from Firebase:`, this.products);
            this.applyFiltersAndSort();
            this.updateProductsCount();
            
        } catch (error) {
            console.error('❌ Error loading products from Firebase:', error);
            this.showProductsError('Failed to load products from database');
        }
    }

    // NEW METHOD: Clean product data by removing extra quotation marks
    cleanProductData(data) {
        const cleaned = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Remove surrounding quotes if they exist
                cleaned[key] = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }

    setupRealTimeListeners() {
        // Real-time product updates
        this.db.collection('products')
            .onSnapshot((snapshot) => {
                console.log('🔄 Products updated - reloading data');
                this.loadProducts();
            }, (error) => {
                console.error('❌ Error in products real-time listener:', error);
            });

        // Real-time cart updates
        const userId = authManager.getCurrentUser()?.uid;
        if (userId) {
            this.db.collection('carts')
                .doc(userId)
                .onSnapshot((doc) => {
                    console.log('🔄 Cart updated');
                    this.updateCartCount();
                });
        }
    }

    applyFiltersAndSort() {
        // Apply category and search filters
        this.filteredProducts = this.products.filter(product => {
            const matchesCategory = this.currentFilter === 'all' || 
                                  product.category === this.currentFilter;
            const matchesSearch = !this.searchTerm || 
                                product.name.toLowerCase().includes(this.searchTerm) ||
                                (product.description && product.description.toLowerCase().includes(this.searchTerm));
            
            return matchesCategory && matchesSearch;
        });
        
        // Apply sorting
        this.sortProducts();
        
        this.currentPage = 1;
        this.renderProducts();
        this.setupPagination();
    }

    sortProducts() {
        switch (this.sortBy) {
            case 'price-low':
                this.filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price-high':
                this.filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'name':
                this.filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'stock':
                this.filteredProducts.sort((a, b) => (b.stock || 0) - (a.stock || 0));
                break;
            case 'newest':
            default:
                this.filteredProducts.sort((a, b) => (b.createdAt || new Date()) - (a.createdAt || new Date()));
                break;
        }
    }

    updateProductsCount() {
        const totalProducts = this.products.length;
        const inStockProducts = this.products.filter(p => p.stock > 10).length;
        const lowStockProducts = this.products.filter(p => p.stock > 0 && p.stock <= 10).length;
        const categories = [...new Set(this.products.map(p => p.category).filter(Boolean))].length;

        // Update quick stats
        if (document.getElementById('totalProducts')) {
            document.getElementById('totalProducts').textContent = totalProducts;
            document.getElementById('inStockProducts').textContent = inStockProducts;
            document.getElementById('lowStockProducts').textContent = lowStockProducts;
            document.getElementById('categoriesCount').textContent = categories;
        }

        // Update products count text
        const productsCountElement = document.getElementById('productsCount');
        if (productsCountElement) {
            if (this.filteredProducts.length === this.products.length) {
                productsCountElement.textContent = `Showing ${this.filteredProducts.length} products`;
            } else {
                productsCountElement.textContent = `Showing ${this.filteredProducts.length} of ${this.products.length} products`;
            }
        }
    }

    renderProducts() {
        const container = document.getElementById('productsGrid');
        if (!container) return;

        if (this.filteredProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-egg"></i>
                    <h3>No Products Found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                    <button class="btn btn-primary" onclick="window.productsManager.resetFilters()">
                        Reset Filters
                    </button>
                </div>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.productsPerPage;
        const endIndex = startIndex + this.productsPerPage;
        const productsToShow = this.filteredProducts.slice(startIndex, endIndex);

        container.innerHTML = productsToShow.map(product => `
            <div class="product-card" data-category="${product.category}">
                <div class="product-badge-container">
                    ${product.stock <= 10 ? `
                        <span class="product-badge low-stock-badge">
                            <i class="fas fa-exclamation-triangle"></i> Low Stock
                        </span>
                    ` : ''}
                    ${this.isNewProduct(product) ? `
                        <span class="product-badge new-badge">
                            <i class="fas fa-star"></i> New
                        </span>
                    ` : ''}
                </div>
                <img src="${product.imageUrl || this.getDefaultEggImage(product.category)}" 
                     alt="${product.name}" class="product-image"
                     onerror="this.src='${this.getDefaultEggImage(product.category)}'">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description || 'Fresh farm eggs'}</p>
                    <div class="product-meta">
                        <span class="product-category">${this.formatCategory(product.category)}</span>
                        <span class="product-stock ${product.stock < 10 ? 'low-stock' : ''}">
                            ${product.stock} in stock
                        </span>
                    </div>
                    <div class="product-price">₱${product.price.toFixed(2)}</div>
                    <div class="product-actions">
                        <button class="btn btn-primary add-to-cart" data-product-id="${product.id}"
                                ${product.stock === 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> 
                            ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                        <button class="btn btn-outline quick-view-btn" data-product-id="${product.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline wishlist-btn" data-product-id="${product.id}">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // NEW METHOD: Get appropriate default image based on category
    getDefaultEggImage(category) {
        const baseUrl = 'https://cdn-icons-png.flaticon.com/512/2616/2616672.png'; // Generic egg icon
        
        // You can add more specific icons based on category if you want
        const categoryIcons = {
            'chicken': baseUrl,
            'duck': baseUrl, 
            'quail': baseUrl,
            'organic': baseUrl
        };
        
        return categoryIcons[category] || baseUrl;
    }

    setupPagination() {
        const pagination = document.getElementById('productsPagination');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!pagination) return;

        const totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    }

    isNewProduct(product) {
        if (!product.createdAt) return false;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return product.createdAt > oneWeekAgo;
    }

    async handleAddToCart(button) {
        if (!authManager.getCurrentUser()) {
            Helpers.showToast('Please login to add items to cart', 'warning');
            setTimeout(() => window.location.href = '../login.html', 1500);
            return;
        }

        const productId = button.dataset.productId;
        const product = this.products.find(p => p.id === productId);
        
        if (!product) {
            Helpers.showToast('Product not found', 'error');
            return;
        }

        if (product.stock === 0) {
            Helpers.showToast('Product is out of stock', 'warning');
            return;
        }

        try {
            await this.addToCart(product);
            Helpers.showToast('Product added to cart!', 'success');
        } catch (error) {
            console.error('❌ Error adding to cart:', error);
            Helpers.showToast('Failed to add product to cart', 'error');
        }
    }

    async handleQuickView(button) {
        const productId = button.dataset.productId;
        const product = this.products.find(p => p.id === productId);
        
        if (!product) {
            Helpers.showToast('Product not found', 'error');
            return;
        }

        this.showProductQuickView(product);
    }

    async handleWishlist(button) {
        if (!authManager.getCurrentUser()) {
            Helpers.showToast('Please login to manage wishlist', 'warning');
            return;
        }

        const productId = button.dataset.productId;
        const product = this.products.find(p => p.id === productId);
        
        if (!product) {
            Helpers.showToast('Product not found', 'error');
            return;
        }

        try {
            await this.toggleWishlist(product);
        } catch (error) {
            console.error('❌ Error updating wishlist:', error);
            Helpers.showToast('Failed to update wishlist', 'error');
        }
    }

    showProductQuickView(product) {
        const modalContent = document.getElementById('productModalContent');
        if (!modalContent) return;

        modalContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <img src="${product.imageUrl || this.getDefaultEggImage(product.category)}" 
                         alt="${product.name}" 
                         style="width: 100%; border-radius: 0.5rem;"
                         onerror="this.src='${this.getDefaultEggImage(product.category)}'">
                </div>
                <div>
                    <h3 style="margin-bottom: 0.5rem;">${product.name}</h3>
                    <div class="product-price" style="font-size: 1.5rem; margin-bottom: 1rem;">₱${(product.price || 0).toFixed(2)}</div>
                    
                    <div style="margin-bottom: 1rem;">
                        <span class="product-category">${this.formatCategory(product.category)}</span>
                        <span class="product-stock ${product.stock <= 10 ? 'low-stock' : ''}" style="margin-left: 1rem;">
                            ${product.stock} in stock
                        </span>
                    </div>
                    
                    <p style="color: var(--gray); margin-bottom: 1.5rem; line-height: 1.6;">${product.description || 'Fresh farm eggs'}</p>
                    
                    <div class="product-actions">
                        <button class="btn btn-primary add-to-cart" 
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

        document.getElementById('productModal').classList.add('active');
    }

    async addToCart(product) {
        const userId = authManager.getCurrentUser().uid;
        const cartRef = this.db.collection('carts').doc(userId);
        
        try {
            const cartDoc = await cartRef.get();
            
            if (cartDoc.exists) {
                const cartData = cartDoc.data();
                const existingItem = cartData.items.find(item => item.productId === product.id);
                
                if (existingItem) {
                    // Check if adding more would exceed stock
                    if (existingItem.quantity + 1 > product.stock) {
                        Helpers.showToast('Not enough stock available', 'warning');
                        return;
                    }
                    
                    await cartRef.update({
                        items: cartData.items.map(item => 
                            item.productId === product.id 
                                ? { 
                                    ...item, 
                                    quantity: item.quantity + 1,
                                    price: product.price,
                                    name: product.name,
                                    imageUrl: product.imageUrl || this.getDefaultEggImage(product.category)
                                }
                                : item
                        ),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    await cartRef.update({
                        items: [...cartData.items, { 
                            productId: product.id,
                            quantity: 1,
                            price: product.price,
                            name: product.name,
                            imageUrl: product.imageUrl || this.getDefaultEggImage(product.category),
                            addedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }],
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                await cartRef.set({
                    items: [{ 
                        productId: product.id,
                        quantity: 1,
                        price: product.price,
                        name: product.name,
                        imageUrl: product.imageUrl || this.getDefaultEggImage(product.category),
                        addedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            console.log('✅ Product added to cart successfully');
            
        } catch (error) {
            console.error('❌ Error adding to cart:', error);
            throw error;
        }
    }

    async toggleWishlist(product) {
        const userId = authManager.getCurrentUser().uid;
        const userRef = this.db.collection('users').doc(userId);
        
        try {
            const userDoc = await userRef.get();
            
            let wishlist = [];
            if (userDoc.exists && userDoc.data().wishlist) {
                wishlist = userDoc.data().wishlist;
            }

            const isInWishlist = wishlist.includes(product.id);
            
            if (isInWishlist) {
                await userRef.update({
                    wishlist: firebase.firestore.FieldValue.arrayRemove(product.id),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                Helpers.showToast('Removed from wishlist', 'success');
            } else {
                await userRef.update({
                    wishlist: firebase.firestore.FieldValue.arrayUnion(product.id),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                Helpers.showToast('Added to wishlist!', 'success');
            }
            
        } catch (error) {
            console.error('❌ Error updating wishlist:', error);
            throw error;
        }
    }

    async updateCartCount() {
        const cartCount = document.querySelector('.cart-count');
        if (!cartCount) return;

        try {
            const userId = authManager.getCurrentUser()?.uid;
            if (!userId) {
                cartCount.textContent = '0';
                return;
            }

            const cartDoc = await this.db.collection('carts').doc(userId).get();
            
            if (cartDoc.exists) {
                const cartData = cartDoc.data();
                const count = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
                cartCount.textContent = count;
            } else {
                cartCount.textContent = '0';
            }
        } catch (error) {
            console.error('❌ Error updating cart count:', error);
            cartCount.textContent = '0';
        }
    }

    resetFilters() {
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.sortBy = 'newest';
        this.currentPage = 1;
        
        // Reset UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'all') {
                btn.classList.add('active');
            }
        });
        
        const searchInput = document.getElementById('productSearch');
        if (searchInput) searchInput.value = '';
        
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = 'newest';
        
        this.applyFiltersAndSort();
        Helpers.showToast('Filters reset successfully', 'success');
    }

    showProductsError(message) {
        const container = document.getElementById('productsGrid');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                    <button onclick="window.productsManager.loadProducts()" class="btn btn-sm" style="margin-left: auto;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    formatCategory(category) {
        const categories = {
            'chicken': 'Chicken Eggs',
            'duck': 'Duck Eggs', 
            'quail': 'Quail Eggs',
            'organic': 'Organic',
            'premium': 'Premium',
            'free-range': 'Free Range',
            'general': 'General'
        };
        return categories[category] || category;
    }
}

// Initialize products manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for auth to be ready before initializing products
    if (typeof authManager !== 'undefined' && authManager.ready) {
        authManager.ready.then(() => {
            window.productsManager = new ProductsManager();
        });
    } else {
        // Fallback: initialize after a short delay
        setTimeout(() => {
            window.productsManager = new ProductsManager();
        }, 1000);
    }
});