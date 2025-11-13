// ============================================
// API REST CLIENT - Pure JavaScript
// ============================================

$(function () {
    let toastInstance;

    // Cargar productos automáticamente al cargar la página
    loadProducts();

    // ============================================
    // EVENT HANDLERS
    // ============================================

    // FORMULARIO: Crear producto
    $('#productForm').on('submit', async function(e) {
        e.preventDefault();

        const productData = {
            name: $('#productName').val().trim(),
            category: $('#productCategory').val().trim(),
            quantity: parseInt($('#productQuantity').val()),
            price: parseFloat($('#productPrice').val()),
            clearance: $('#productClearance').is(':checked')
        };

        console.log('Creating product:', productData);

        // Validación básica
        if (!productData.name || !productData.category) {
            showToast('Please fill all required fields', 'warning');
            return;
        }

        if (isNaN(productData.quantity) || productData.quantity < 0) {
            showToast('Quantity must be a positive number', 'warning');
            return;
        }

        if (isNaN(productData.price) || productData.price < 0) {
            showToast('Price must be a positive number', 'warning');
            return;
        }

        showLoading();

        try {
            const newProduct = await createProduct(productData);
            console.log('Product created:', newProduct);
            showToast(`Product "${newProduct.name}" created successfully!`, 'success');

            // Limpiar formulario
            $('#productForm')[0].reset();

            // Recargar lista
            await loadProducts();
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message || 'Error creating product', 'danger');
            hideLoading();
        }
    });

    // BOTÓN: Refresh
    $('#refreshButton').on('click', function() {
        loadProducts();
    });

    // Event delegation para botones de eliminar
    $(document).on('click', '.delete-btn', async function() {
        const id = $(this).data('id');
        const category = $(this).data('category');

        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        showLoading();

        try {
            await deleteProduct(id, category);
            console.log('Product deleted:', { id, category });
            showToast('Product deleted successfully!', 'success');

            // Recargar lista
            await loadProducts();
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message || 'Error deleting product', 'danger');
            hideLoading();
        }
    });

    // ============================================
    // API CALLS - REST ENDPOINTS
    // ============================================

    // GET /api/products - Lista todos los productos
    async function loadProducts() {
        showLoading();

        try {
            const response = await fetch('/api/products', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error loading products');
            }

            const products = await response.json();
            console.log('Loaded products:', products);
            renderProducts(products);
            hideLoading();
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message || 'Error loading products', 'danger');
            hideLoading();
        }
    }

    // POST /api/products - Crea un nuevo producto
    async function createProduct(productData) {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error creating product');
        }

        return await response.json();
    }

    // DELETE /api/products/:id - Elimina un producto
    async function deleteProduct(id, category) {
        const response = await fetch(`/api/products/${id}?category=${encodeURIComponent(category)}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error deleting product');
        }

        return await response.json();
    }

    // ============================================
    // UI RENDERING
    // ============================================

    // Renderiza la lista de productos
    function renderProducts(products) {
        const container = $('#productsContainer');
        container.empty();

        $('#productCount').text(products.length);

        if (products.length === 0) {
            container.html(`
                <div class="col-12">
                    <div class="empty-state">
                        <i class="bi bi-inbox"></i>
                        <h5>No products yet</h5>
                        <p class="text-muted">Create your first product using the form above</p>
                    </div>
                </div>
            `);
            return;
        }

        products.forEach(product => {
            const card = createProductCard(product);
            container.append(card);
        });
    }

    // Crea una tarjeta de producto
    function createProductCard(product) {
        const clearanceBadge = product.clearance
            ? '<span class="badge bg-danger clearance-badge">CLEARANCE</span>'
            : '';

        const priceFormatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(product.price);

        return $(`
            <div class="col-md-6 col-lg-4">
                <div class="card product-card h-100 position-relative">
                    ${clearanceBadge}
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(product.name)}</h5>
                        <p class="card-text">
                            <small class="text-muted">
                                <i class="bi bi-tag me-1"></i>
                                ${escapeHtml(product.category)}
                            </small>
                        </p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <div>
                                <h4 class="mb-0">${priceFormatted}</h4>
                                <small class="text-muted">
                                    <i class="bi bi-box me-1"></i>
                                    Qty: ${product.quantity}
                                </small>
                            </div>
                            <button class="btn btn-outline-danger btn-sm delete-btn"
                                    data-id="${product.id}"
                                    data-category="${escapeHtml(product.category)}"
                                    title="Delete product">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-footer">
                        <small class="text-muted">
                            <i class="bi bi-key me-1"></i>
                            ID: ${product.id.substring(0, 8)}...
                        </small>
                    </div>
                </div>
            </div>
        `);
    }

    // ============================================
    // UTILIDADES
    // ============================================

    function showLoading() {
        $('#loadingSpinner').addClass('show');
        $('#productsContainer').hide();
    }

    function hideLoading() {
        $('#loadingSpinner').removeClass('show');
        $('#productsContainer').show();
    }

    function showToast(message, type = 'info') {
        const toastEl = document.getElementById('toast');
        const toastBody = document.getElementById('toastBody');

        // Colores según tipo
        const bgColors = {
            success: 'bg-success',
            danger: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        // Remover clases anteriores
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');
        toastEl.classList.add(bgColors[type] || 'bg-info');

        toastBody.textContent = message;

        if (!toastInstance) {
            toastInstance = new bootstrap.Toast(toastEl, {
                delay: 3000
            });
        }

        toastInstance.show();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
});
