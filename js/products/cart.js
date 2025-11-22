class CartManager {
    constructor() {
        this.db = firebaseDb;
        this.cart = [];
        this.init();
    }

    async init() {
        await this.loadCart();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quantity-increase')) {
                this.increaseQuantity(e.target.dataset.productId);
            } else if (e.target.classList.contains('quantity-decrease')) {
                this.decreaseQuantity(e.target.dataset.productId);
            } else if (e.target.classList.contains('remove-item')) {
                this.removeItem(e.target.dataset.productId);
            }
        });

        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.checkout());
        }
    }

    async loadCart() {
        if (!authManager.getCurrentUser()) {
            this.showLoginRequired();
            return;
        }

        try {
            const userId = authManager.getCurrentUser().uid;
            const cartDoc = await this.db.collection('cart').doc(userId).get();
            
            if (cartDoc.exists) {
                this.cart = cartDoc.data().items || [];
            } else {
                this.cart = [];
            }
            
            this.renderCart();
            this.updateCartSummary();
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showError('Failed to load cart');
        }
    }

    renderCart() {
        const container = document.getElementById('cartItems');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>Your cart is empty</h3>
                    <p>Add some delicious eggs to get started!</p>
                    <a href="index.html" class="btn btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }

        container.innerHTML = this.cart.map(item => `
            <div class="cart-item card">
                <div style="display: grid; grid-template-columns: 100px 1fr auto auto; gap: 1rem; align-items: center;">
                    <img src="${item.image || 'https://via.placeholder.com/100x100?text=No+Image'}" 
                         alt="${item.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 0.5rem;">
                    
                    <div>
                        <h4>${item.name}</h4>
                        <p class="text-muted">${item.category}</p>
                        <div class="product-price">₱${item.price.toFixed(2)}</div>
                    </div>
                    
                    <div class="quantity-controls">
                        <button class="btn btn-sm quantity-decrease" data-product-id="${item.productId}">-</button>
                        <span class="quantity-display" style="padding: 0 1rem;">${item.quantity}</span>
                        <button class="btn btn-sm quantity-increase" data-product-id="${item.productId}">+</button>
                    </div>
                    
                    <div style="text-align: right;">
                        <div class="item-total" style="font-weight: bold; margin-bottom: 0.5rem;">
                            ₱${(item.price * item.quantity).toFixed(2)}
                        </div>
                        <button class="btn btn-danger btn-sm remove-item" data-product-id="${item.productId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async increaseQuantity(productId) {
        await this.updateQuantity(productId, 1);
    }

    async decreaseQuantity(productId) {
        const item = this.cart.find(item => item.productId === productId);
        if (item && item.quantity > 1) {
            await this.updateQuantity(productId, -1);
        } else {
            await this.removeItem(productId);
        }
    }

    async updateQuantity(productId, change) {
        try {
            const itemIndex = this.cart.findIndex(item => item.productId === productId);
            if (itemIndex === -1) return;

            this.cart[itemIndex].quantity += change;
            
            if (this.cart[itemIndex].quantity < 1) {
                this.cart.splice(itemIndex, 1);
            }

            await this.saveCart();
            this.renderCart();
            this.updateCartSummary();
            if (window.productsManager) productsManager.updateCartCount();
        } catch (error) {
            console.error('Error updating quantity:', error);
            this.showError('Failed to update quantity');
        }
    }

    async removeItem(productId) {
        try {
            this.cart = this.cart.filter(item => item.productId !== productId);
            await this.saveCart();
            this.renderCart();
            this.updateCartSummary();
            if (window.productsManager) productsManager.updateCartCount();
        } catch (error) {
            console.error('Error removing item:', error);
            this.showError('Failed to remove item');
        }
    }

    async saveCart() {
        if (!authManager.getCurrentUser()) return;

        try {
            const userId = authManager.getCurrentUser().uid;
            const cartRef = this.db.collection('cart').doc(userId);
            
            if (this.cart.length === 0) {
                await cartRef.delete();
            } else {
                await cartRef.set({
                    items: this.cart,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error saving cart:', error);
            throw error;
        }
    }

    updateCartSummary() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal > 500 ? 0 : 50;
        const total = subtotal + shipping;

        const subtotalEl = document.getElementById('cartSubtotal');
        const shippingEl = document.getElementById('cartShipping');
        const totalEl = document.getElementById('cartTotal');
        const itemCountEl = document.getElementById('itemCount');

        if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2);
        if (shippingEl) shippingEl.textContent = shipping.toFixed(2);
        if (totalEl) totalEl.textContent = total.toFixed(2);
        if (itemCountEl) itemCountEl.textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = this.cart.length === 0;
        }
    }

    async checkout() {
        if (!authManager.getCurrentUser()) {
            Helpers.showToast('Please login to checkout', 'warning');
            return;
        }

        if (this.cart.length === 0) {
            Helpers.showToast('Your cart is empty', 'warning');
            return;
        }

        try {
            const userId = authManager.getCurrentUser().uid;
            
            const order = {
                userId: userId,
                items: this.cart,
                subtotal: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                shipping: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) > 500 ? 0 : 50,
                total: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 
                       (this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) > 500 ? 0 : 50),
                status: 'pending',
                paymentMethod: 'cod',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('orders').add(order);

            this.cart = [];
            await this.saveCart();
            
            Helpers.showToast('Order placed successfully!', 'success');
            this.renderCart();
            this.updateCartSummary();
            if (window.productsManager) productsManager.updateCartCount();

            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 2000);

        } catch (error) {
            console.error('Checkout error:', error);
            Helpers.showToast('Failed to place order', 'error');
        }
    }

    showLoginRequired() {
        const container = document.getElementById('cartItems');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lock"></i>
                    <h3>Login Required</h3>
                    <p>Please login to view your cart</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <a href="login.html" class="btn btn-primary">Login</a>
                        <a href="register.html" class="btn btn-secondary">Register</a>
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        Helpers.showToast(message, 'error');
    }
}

window.cartManager = new CartManager();