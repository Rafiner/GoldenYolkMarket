// Global Helpers utility
window.Helpers = {
    validateEmail: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    validatePassword: function(password) {
        return password.length >= 6;
    },

    sanitizeInput: function(input) {
        return input.trim();
    },

    formatDate: function(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatCurrency: function(amount) {
        return '₱' + parseFloat(amount).toFixed(2);
    },

    showToast: function(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            max-width: 300px;
            display: flex;
            align-items: center;
            gap: 10px;
            background: ${this.getToastColor(type)};
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        `;

        // Add CSS animation
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    },

    getToastIcon: function(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    getToastColor: function(type) {
        const colors = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    },

    showLoading: function(button) {
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
        return originalText;
    },

    hideLoading: function(button, originalText) {
        button.innerHTML = originalText;
        button.disabled = false;
    },

    showAlert: function(message, type = 'error', containerId = null) {
        // Remove existing alerts with same container
        const existingAlert = document.getElementById('dynamicAlert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.id = 'dynamicAlert';
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 16px 0;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
        `;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Insert in specified container or before the form
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.prepend(alertDiv);
            }
        } else {
            // Try to find a form to insert before
            const form = document.querySelector('form');
            if (form) {
                form.parentNode.insertBefore(alertDiv, form);
            } else {
                document.body.prepend(alertDiv);
            }
        }
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
        
        return alertDiv;
    },

    hideAlert: function() {
        const alert = document.getElementById('dynamicAlert');
        if (alert) {
            alert.remove();
        }
    },

    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Form validation helpers
    validateForm: function(formData, rules) {
        const errors = [];
        
        for (const field in rules) {
            const value = formData[field];
            const rule = rules[field];
            
            if (rule.required && (!value || value.trim() === '')) {
                errors.push(rule.required);
            } else if (rule.email && !this.validateEmail(value)) {
                errors.push(rule.email);
            } else if (rule.minLength && value.length < rule.minLength) {
                errors.push(rule.minLength);
            } else if (rule.match && value !== formData[rule.match]) {
                errors.push(rule.matchMessage);
            }
        }
        
        return errors;
    },

    // Local storage helpers
    setLocalStorage: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('LocalStorage error:', error);
            return false;
        }
    },

    getLocalStorage: function(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('LocalStorage error:', error);
            return null;
        }
    },

    removeLocalStorage: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('LocalStorage error:', error);
            return false;
        }
    },

    // ==================== IMAGE UPLOAD FUNCTIONS ====================

    /**
     * Initialize image upload functionality
     * @param {Object} options - Configuration options
     * @param {string} options.uploadAreaId - ID of the upload area element
     * @param {string} options.previewId - ID of the preview element
     * @param {string} options.inputId - ID of the file input element
     * @param {Function} options.onUpload - Callback when image is uploaded
     * @param {number} options.maxSize - Maximum file size in MB (default: 5)
     * @param {Array} options.allowedTypes - Allowed file types (default: ['image/jpeg', 'image/png', 'image/jpg'])
     */
    initImageUpload: function(options) {
        const {
            uploadAreaId,
            previewId,
            inputId,
            onUpload,
            maxSize = 5,
            allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        } = options;

        const uploadArea = document.getElementById(uploadAreaId);
        const preview = document.getElementById(previewId);
        const fileInput = document.getElementById(inputId);

        if (!uploadArea || !fileInput) {
            console.error('Image upload elements not found');
            return;
        }

        // Set up drag and drop
        this.setupDragAndDrop(uploadArea, fileInput);

        // Set up click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files[0], preview, maxSize, allowedTypes, onUpload);
        });

        console.log('✅ Image upload initialized for:', uploadAreaId);
    },

    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop: function(uploadArea, fileInput) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                fileInput.files = files;
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        }, false);
    },

    /**
     * Handle file selection and validation
     */
    handleFileSelection: function(file, previewElement, maxSize, allowedTypes, onUpload) {
        if (!file) return;

        // Validate file type
        if (!allowedTypes.includes(file.type)) {
            this.showToast(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`, 'error');
            return;
        }

        // Validate file size
        const maxSizeBytes = maxSize * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            this.showToast(`File too large. Maximum size: ${maxSize}MB`, 'error');
            return;
        }

        // Create preview
        this.createImagePreview(file, previewElement);

        // Call upload callback if provided
        if (typeof onUpload === 'function') {
            onUpload(file);
        }
    },

    /**
     * Create image preview
     */
    createImagePreview: function(file, previewElement) {
        if (!previewElement) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            previewElement.innerHTML = `
                <div style="text-align: center;">
                    <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                    <div style="margin-top: 10px; font-size: 0.9rem; color: var(--gray);">
                        ${file.name} (${this.formatFileSize(file.size)})
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" onclick="Helpers.removeImagePreview(this)" style="margin-top: 10px;">
                        <i class="fas fa-times"></i> Remove
                    </button>
                </div>
            `;
            previewElement.style.display = 'block';
        };
        
        reader.readAsDataURL(file);
    },

    /**
     * Remove image preview
     */
    removeImagePreview: function(button) {
        const previewContainer = button.closest('.image-preview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
            
            // Clear file input
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    },

    /**
     * Format file size
     */
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Upload image to Firebase Storage
     * @param {File} file - The image file to upload
     * @param {string} path - Storage path (e.g., 'products/', 'users/')
     * @param {Function} onProgress - Progress callback
     * @param {Function} onComplete - Completion callback
     * @param {Function} onError - Error callback
     */
    uploadToFirebase: function(file, path = 'images/', onProgress = null, onComplete = null, onError = null) {
        return new Promise((resolve, reject) => {
            // Check if Firebase Storage is available
            if (typeof firebase === 'undefined' || !firebase.storage) {
                const error = 'Firebase Storage is not available';
                if (onError) onError(error);
                reject(error);
                return;
            }

            const storage = firebase.storage();
            const storageRef = storage.ref();
            
            // Generate unique filename
            const timestamp = Date.now();
            const fileExtension = file.name.split('.').pop();
            const fileName = `${path}${timestamp}.${fileExtension}`;
            const fileRef = storageRef.child(fileName);

            // Upload file
            const uploadTask = fileRef.put(file);

            // Listen for state changes, errors, and completion
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress monitoring
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload is ${progress}% done`);
                    
                    if (typeof onProgress === 'function') {
                        onProgress(progress);
                    }
                },
                (error) => {
                    // Handle unsuccessful uploads
                    console.error('Upload error:', error);
                    this.showToast('Failed to upload image', 'error');
                    
                    if (typeof onError === 'function') {
                        onError(error);
                    }
                    reject(error);
                },
                () => {
                    // Handle successful uploads
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        console.log('File available at', downloadURL);
                        this.showToast('Image uploaded successfully', 'success');
                        
                        if (typeof onComplete === 'function') {
                            onComplete(downloadURL);
                        }
                        resolve(downloadURL);
                    });
                }
            );
        });
    },

    /**
     * Compress image before upload
     * @param {File} file - Original image file
     * @param {number} maxWidth - Maximum width
     * @param {number} quality - Image quality (0.1 to 1.0)
     * @returns {Promise} Compressed file
     */
    compressImage: function(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress image
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                
                img.onerror = (error) => {
                    reject(error);
                };
            };
            
            reader.onerror = (error) => {
                reject(error);
            };
        });
    },

    /**
     * Generate image upload HTML
     * @param {Object} options - Configuration options
     */
    generateImageUploadHTML: function(options = {}) {
        const {
            uploadAreaId = 'imageUploadArea',
            previewId = 'imagePreview',
            inputId = 'imageInput',
            label = 'Upload Image',
            sublabel = 'Click or drag & drop to upload',
            multiple = false
        } = options;

        return `
            <div class="form-group">
                <label class="form-label">${label}</label>
                <div id="${uploadAreaId}" class="image-upload-area" style="cursor: pointer;">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: var(--gray); margin-bottom: 0.5rem;"></i>
                    <p style="margin: 0; color: var(--gray);">${sublabel}</p>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--gray);">
                        PNG, JPG, JPEG up to 5MB
                    </p>
                </div>
                <input type="file" id="${inputId}" accept="image/*" ${multiple ? 'multiple' : ''} style="display: none;">
                <div id="${previewId}" class="image-preview" style="display: none; margin-top: 1rem;"></div>
            </div>
        `;
    },

    /**
     * Validate image file
     */
    validateImage: function(file, maxSize = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']) {
        const errors = [];

        if (!allowedTypes.includes(file.type)) {
            errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
        }

        const maxSizeBytes = maxSize * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            errors.push(`File too large. Maximum size: ${maxSize}MB`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
};

// Add CSS styles for image upload
if (!document.querySelector('#image-upload-styles')) {
    const style = document.createElement('style');
    style.id = 'image-upload-styles';
    style.textContent = `
        .image-upload-area {
            border: 2px dashed var(--gray-light);
            border-radius: 0.5rem;
            padding: 2rem;
            text-align: center;
            transition: all 0.3s;
            background: white;
        }

        .image-upload-area:hover {
            border-color: var(--primary);
            background: var(--primary-light);
        }

        .image-upload-area.drag-over {
            border-color: var(--primary);
            background: var(--primary-light);
            transform: scale(1.02);
        }

        .image-preview {
            text-align: center;
            padding: 1rem;
            border: 1px solid var(--gray-light);
            border-radius: 0.5rem;
            background: white;
        }

        .image-preview img {
            max-width: 100%;
            max-height: 300px;
            border-radius: 0.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);
}

// Fallback for older browsers
if (typeof window.Helpers === 'undefined') {
    console.log('🔧 Creating fallback Helpers...');
    window.Helpers = {
        validateEmail: function(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        showToast: function(message, type) {
            alert(`${type.toUpperCase()}: ${message}`);
        },
        validatePassword: function(password) {
            return password.length >= 6;
        },
        initImageUpload: function() {
            console.warn('Image upload not supported in this browser');
        }
    };
}