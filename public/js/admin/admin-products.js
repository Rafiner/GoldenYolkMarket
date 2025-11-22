class AdminProductsManager {
    constructor() {
        this.db = firebaseDb;
        this.storage = firebaseStorage;
        this.products = [];
        this.currentProduct = null;
        this.init();
    }

    init() {
        this.loadProducts();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add product button
        document.getElementById('addProductBtn').addEventListener('click', () => this.openProductModal());
        
        // Modal events
        document.getElementById('modalClose').addEventListener('click', () => this.closeProductModal());
        document.getElementById('cancelProduct').addEventListener('click', () => this.closeProductModal());
        
        // Form submission
        document.getElementById('productForm').addEventListener('submit', (e) => this.saveProduct(e));
        
        // Image upload
        document.getElementById('imageUploadArea').addEventListener('click', () => {
            document.getElementById('imageUpload').click();
        });
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('removeImage').addEventListener('click', () => this.removeImage());
    }

    async loadProducts() {
        try {
            const snapshot = await this.db.collection('products').get();
            this.products = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // FIXED: Clean data and use correct field names
                const cleanData = this.cleanProductData(data);
                
                this.products.push({
                    id: doc.id,
                    name: cleanData.name || 'Unnamed Product',
                    description: cleanData.description || '',
                    price: cleanData.price || 0,
                    category: cleanData.category || 'general',
                    type: cleanData.type || 'standard',
                    // FIXED: Use 'quantity' field instead of 'stock'
                    stock: cleanData.quantity || cleanData.stock || 0,
                    // FIXED: Handle multiple possible image field names
                    imageUrl: cleanData.imageUrl || cleanData.image || cleanData.ImageUrl || '',
                    images: cleanData.images || [],
                    // FIXED: Use 'available' field instead of 'isActive'
                    isActive: cleanData.available !== false,
                    createdAt: cleanData.createdAt?.toDate() || new Date(),
                    ...cleanData
                });
            });
            
            this.renderProducts();
        } catch (error) {
            console.error('Error loading products:', error);
            this.showError('Failed to load products');
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

    renderProducts() {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-egg"></i>
                        <h3>No Products Found</h3>
                        <p>Get started by adding your first product</p>
                        <button class="btn btn-primary" onclick="adminProductsManager.openProductModal()">
                            <i class="fas fa-plus"></i>
                            Add Your First Product
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.products.map(product => `
            <div class="product-card admin">
                <div class="product-header">
                    <h3>${product.name}</h3>
                    <span class="product-status ${product.isActive ? 'active' : 'inactive'}">
                        ${product.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                
                <img src="${product.imageUrl || product.images[0] || this.getDefaultEggImage(product.category)}" 
                     alt="${product.name}" 
                     class="product-image"
                     onerror="this.src='${this.getDefaultEggImage(product.category)}'">
                
                <div class="product-details">
                    <p class="product-description">${product.description || 'No description available'}</p>
                    <div class="product-meta">
                        <span><strong>Category:</strong> ${this.formatCategory(product.category)}</span>
                        <span><strong>Type:</strong> ${product.type || 'Standard'}</span>
                        <span><strong>Stock:</strong> <span class="${product.stock < 10 ? 'low-stock' : ''}">${product.stock}</span></span>
                    </div>
                    <div class="product-price-stock">
                        <span class="price">₱${product.price.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="product-actions">
                    <button class="btn btn-primary btn-sm edit-product" data-product-id="${product.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm delete-product" data-product-id="${product.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn btn-secondary btn-sm toggle-product" 
                            data-product-id="${product.id}"
                            data-active="${product.isActive}">
                        <i class="fas fa-power-off"></i> 
                        ${product.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>
        `).join('');

        this.attachProductEvents();
    }

    // NEW METHOD: Get appropriate default image
    getDefaultEggImage(category) {
        return 'https://cdn-icons-png.flaticon.com/512/2616/2616672.png'; // Generic egg icon
    }

    attachProductEvents() {
        // Edit buttons
        document.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                this.editProduct(productId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-product').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                this.deleteProduct(productId);
            });
        });

        // Toggle activation
        document.querySelectorAll('.toggle-product').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.productId;
                const isActive = e.target.closest('button').dataset.active === 'true';
                this.toggleProduct(productId, !isActive);
            });
        });
    }

    openProductModal(product = null) {
        this.currentProduct = product;
        const modal = document.getElementById('productModal');
        const title = document.getElementById('modalTitle');
        
        if (product) {
            title.textContent = 'Edit Product';
            this.populateProductForm(product);
        } else {
            title.textContent = 'Add New Product';
            this.resetProductForm();
        }
        
        modal.classList.add('active');
    }

    closeProductModal() {
        const modal = document.getElementById('productModal');
        modal.classList.remove('active');
        this.currentProduct = null;
        this.resetProductForm();
    }

    populateProductForm(product) {
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        // FIXED: Use 'stock' field (which maps to 'quantity' in database)
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productType').value = product.type || '';
        document.getElementById('productDescription').value = product.description || '';
        // FIXED: Use 'isActive' (which maps to 'available' in database)
        document.getElementById('productActive').checked = product.isActive !== false;

        // Handle image preview
        if (product.imageUrl || (product.images && product.images[0])) {
            const imageUrl = product.imageUrl || product.images[0];
            document.getElementById('previewImage').src = imageUrl;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('imageUploadArea').style.display = 'none';
        }
    }

    resetProductForm() {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('productActive').checked = true;
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('imageUploadArea').style.display = 'block';
        document.getElementById('imageUpload').value = '';
    }

    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image size should be less than 5MB');
            return;
        }

        try {
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImage').src = e.target.result;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('imageUploadArea').style.display = 'none';
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error handling image upload:', error);
            this.showError('Failed to process image');
        }
    }

    removeImage() {
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('imageUploadArea').style.display = 'block';
        document.getElementById('imageUpload').value = '';
    }

    async saveProduct(e) {
        e.preventDefault();
        
        const formData = this.getFormData();
        const validation = this.validateProductForm(formData);
        
        if (!validation.isValid) {
            this.showError(validation.message);
            return;
        }

        try {
            let imageUrl = '';
            
            // Upload image if a new one was selected
            const imageFile = document.getElementById('imageUpload').files[0];
            if (imageFile) {
                // FIXED: Use the uploadImage helper function
                imageUrl = await this.uploadImageToFirebase(imageFile, 'products/');
            } else if (this.currentProduct && (this.currentProduct.imageUrl || this.currentProduct.images[0])) {
                // Keep existing image if no new image was uploaded
                imageUrl = this.currentProduct.imageUrl || this.currentProduct.images[0];
            }

            // FIXED: Use correct field names for your Firebase database
            const productData = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                category: formData.category,
                type: formData.type,
                // FIXED: Use 'quantity' field in database, but 'stock' in form
                quantity: parseInt(formData.stock),
                // FIXED: Use 'available' field in database, but 'isActive' in form
                available: formData.isActive,
                imageUrl: imageUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (this.currentProduct) {
                // Update existing product
                await this.db.collection('products').doc(this.currentProduct.id).update(productData);
                this.showMessage('Product updated successfully!', 'success');
            } else {
                // Add new product
                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await this.db.collection('products').add(productData);
                this.showMessage('Product added successfully!', 'success');
            }

            this.closeProductModal();
            await this.loadProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            this.showError('Failed to save product: ' + error.message);
        }
    }

    // NEW METHOD: Upload image to Firebase Storage
    async uploadImageToFirebase(file, path) {
        return new Promise((resolve, reject) => {
            const storageRef = this.storage.ref();
            const fileRef = storageRef.child(path + Date.now() + '_' + file.name);
            
            const uploadTask = fileRef.put(file);
            
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    // Progress tracking can be added here
                },
                (error) => {
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.openProductModal(product);
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.collection('products').doc(productId).delete();
            this.showMessage('Product deleted successfully!', 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showError('Failed to delete product');
        }
    }

    async toggleProduct(productId, isActive) {
        try {
            // FIXED: Use 'available' field in database
            await this.db.collection('products').doc(productId).update({
                available: isActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showMessage(`Product ${isActive ? 'activated' : 'deactivated'} successfully!`, 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('Error toggling product:', error);
            this.showError('Failed to update product');
        }
    }

    getFormData() {
        return {
            name: document.getElementById('productName').value.trim(),
            description: document.getElementById('productDescription').value.trim(),
            price: document.getElementById('productPrice').value,
            stock: document.getElementById('productStock').value,
            category: document.getElementById('productCategory').value,
            type: document.getElementById('productType').value.trim(),
            isActive: document.getElementById('productActive').checked
        };
    }

    validateProductForm(data) {
        if (!data.name || !data.price || !data.stock || !data.category) {
            return { isValid: false, message: 'Please fill in all required fields' };
        }

        if (data.price <= 0) {
            return { isValid: false, message: 'Price must be greater than 0' };
        }

        if (data.stock < 0) {
            return { isValid: false, message: 'Stock cannot be negative' };
        }

        return { isValid: true, message: '' };
    }

    formatCategory(category) {
        const categories = {
            'chicken': 'Chicken Eggs',
            'duck': 'Duck Eggs',
            'quail': 'Quail Eggs',
            'organic': 'Organic',
            'free-range': 'Free Range',
            'premium': 'Premium',
            'brown': 'Brown Eggs',
            'standard': 'Standard'
        };
        return categories[category] || category;
    }

    showMessage(message, type) {
        if (typeof Helpers !== 'undefined' && Helpers.showToast) {
            Helpers.showToast(message, type);
        } else {
            alert(message); // Fallback if Helpers is not available
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize Admin Products Manager
document.addEventListener('DOMContentLoaded', function() {
    window.adminProductsManager = new AdminProductsManager();
});