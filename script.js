let cart = JSON.parse(localStorage.getItem('cart')) || [];
let productsData = [];
let currentPage = 1;
const productsPerPage = 8;
let currentCategory = 'all';
let currentSort = 'default';
let zoomLevel = 1;
const MAX_ZOOM = 3;
const MIN_ZOOM = 0.5;
let appliedCoupon = null;

document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', function(event) {
        const modal = document.getElementById('productModal');
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });

    if (document.getElementById('products-container')) {
        loadProducts();
        setupSearch();
        setupCartButton();
        setupSorting();
        setupNewsletter();
    }
    
    if (document.getElementById('cart-items')) {
        renderCart();
        setupCartPage();
    }
    
    if (document.getElementById('checkout-form')) {
        document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
        setupPaymentMethodToggle();
        renderCheckoutItems();
        setupCoupon();
    }
    
    updateCartIcon();
});

async function loadProducts() {
    try {
        const container = document.getElementById('products-container');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading products...</div>';
        
        const [productsResponse, categoriesResponse] = await Promise.all([
            fetch('https://fakestoreapi.com/products'),
            fetch('https://fakestoreapi.com/products/categories')
        ]);
        
        if (!productsResponse.ok || !categoriesResponse.ok) {
            throw new Error('Failed to fetch data');
        }
        
        productsData = await productsResponse.json();
        const categories = await categoriesResponse.json();
        
        productsData = productsData.map(product => ({
            ...product,
            stock: Math.floor(Math.random() * 50) + 10 
        }));
        
        renderProducts(productsData);
        setupProductModal();
        setupCategoryFilters(categories);
        setupPagination(productsData.length);
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('products-container').innerHTML = 
            '<div class="error"><i class="fas fa-exclamation-circle"></i> Failed to load products. Please try again later.</div>';
    }
}



function renderProducts(products) {
    const container = document.getElementById('products-container');
    
    let sortedProducts = [...products];
    switch(currentSort) {
        case 'price-low':
            sortedProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            sortedProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name-asc':
            sortedProducts.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'name-desc':
            sortedProducts.sort((a, b) => b.title.localeCompare(a.title));
            break;
        default:
            break;
    }
    
    const startIndex = (currentPage - 1) * productsPerPage;
    const paginatedProducts = sortedProducts.slice(startIndex, startIndex + productsPerPage);
    
    container.innerHTML = paginatedProducts.map(product => `
        <div class="product" data-id="${product.id}">
            <div class="product-image-container">
                <img src="${product.image}" alt="${product.title}" class="product-image" loading="lazy">
                ${product.stock < 15 ? '<span class="low-stock">Low Stock</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <div class="product-rating">
                    ${generateStarRating(product.rating?.rate || 4.5)}
                    <span class="review-count">(${product.rating?.count || 24})</span>
                </div>
                <p class="product-price">$${product.price.toFixed(2)}</p>
                <button class="add-to-cart-btn" data-id="${product.id}">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const productId = parseInt(this.dataset.id);
            const product = products.find(p => p.id === productId); // Use the passed 'products' array
            if (product) {
                updateCartItem(product, 1);
                showAddedToCartNotification(product.title);
            }
        });
    });
}


function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    
    return stars;
}

function setupCategoryFilters(categories) {
    const filterContainer = document.getElementById('filter-container');
    const validCategories = categories.filter(cat => 
        productsData.some(p => p.category.toLowerCase() === cat.toLowerCase())
    );
    
    filterContainer.innerHTML = `
        <button class="filter-btn ${currentCategory === 'all' ? 'active' : ''}" 
                onclick="filterProducts('all')">
            <i class="fas fa-list category-icon"></i> All
        </button>
        ${validCategories.map(category => `
            <button class="filter-btn ${currentCategory === category ? 'active' : ''}" 
                    onclick="filterProducts('${category}')">
                <i class="${getCategoryIcon(category)} category-icon"></i> 
                ${category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
        `).join('')}
    `;
}

function getCategoryIcon(category) {
    switch(category) {
        case 'electronics': return 'fas fa-laptop';
        case 'jewelery': return 'fas fa-gem';
        case "men's clothing": return 'fas fa-tshirt';
        case "women's clothing": return 'fas fa-tshirt';
        default: return 'fas fa-shopping-bag';
    }
}

function filterProducts(category) {
    currentCategory = category;
    currentPage = 1;
    
    let filteredProducts = productsData;
    if (category !== 'all') {
        filteredProducts = productsData.filter(product => 
            product.category.toLowerCase() === category.toLowerCase()
        );
    }
    
    renderProducts(filteredProducts);
    setupPagination(filteredProducts.length);
    setupProductModal(); // Add this line
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const btnCategory = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        btn.classList.toggle('active', btnCategory === category);
    });
}

function setupPagination(totalProducts) {
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-btn" onclick="changePage(1)">1</button>
            ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${currentPage === i ? 'active' : ''}" 
                    onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
            <button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>
        `;
    }
    
    paginationHTML += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    currentPage = page;
    let filteredProducts = productsData;
    if (currentCategory !== 'all') {
        filteredProducts = productsData.filter(product => product.category === currentCategory);
    }
    renderProducts(filteredProducts);
    setupProductModal(); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupProductModal() {
    const products = document.querySelectorAll('.product');
    products.forEach(product => {
        product.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            
            const productId = this.dataset.id;
            const selectedProduct = productsData.find(p => p.id == productId);
            if (selectedProduct) showProductModal(selectedProduct);
        });
    });
}

function showProductModal(product) {
    const modal = document.getElementById('productModal');
    const modalImage = document.getElementById('modalProductImage');
    
    zoomLevel = 1;
    modalImage.style.transform = `scale(${zoomLevel})`;
    
    modalImage.src = product.image;
    modalImage.alt = product.title;
    document.getElementById('modalProductTitle').textContent = product.title;
    document.getElementById('modalProductPrice').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('modalProductStock').textContent = 
        product.stock > 15 ? 'In Stock' : `Only ${product.stock} left in stock`;
    document.getElementById('modalProductDescription').textContent = product.description;
    document.getElementById('modalProductCategory').textContent = 
        product.category.charAt(0).toUpperCase() + product.category.slice(1);
    
    const cartItem = cart.find(item => item.id === product.id);
    document.getElementById('productQuantity').value = cartItem ? cartItem.quantity : 1;
    
    document.getElementById('zoom-in').addEventListener('click', function(e) {
        e.stopPropagation();
        if (zoomLevel < MAX_ZOOM) {
            zoomLevel += 0.1;
            modalImage.style.transform = `scale(${zoomLevel})`;
        }
    });
    
    document.getElementById('zoom-out').addEventListener('click', function(e) {
        e.stopPropagation();
        if (zoomLevel > MIN_ZOOM) {
            zoomLevel -= 0.1;
            modalImage.style.transform = `scale(${zoomLevel})`;
        }
    });
    
    const quantityInput = document.getElementById('productQuantity');
    document.getElementById('incrementQty').addEventListener('click', () => {
        quantityInput.value = Math.min(parseInt(quantityInput.value) + 1, product.stock);
    });
    
    document.getElementById('decrementQty').addEventListener('click', () => {
        quantityInput.value = Math.max(1, parseInt(quantityInput.value) - 1);
    });
    
    quantityInput.addEventListener('change', function() {
        this.value = Math.max(1, Math.min(parseInt(this.value) || 1, product.stock));
    });
    
    document.getElementById('addToCartModal').addEventListener('click', () => {
        const newQuantity = parseInt(quantityInput.value);
        updateCartItem(product, newQuantity);
        showAddedToCartNotification(product.title);
        closeModal();
    });
    
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showAddedToCartNotification(productName) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${productName} added to cart</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    const productImage = document.getElementById('modalProductImage');
    if (productImage) {
        productImage.classList.remove('zoomed');
        productImage.style.transform = 'scale(1)';
    }
}

function updateCartItem(product, quantity) {
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex >= 0) {
        if (quantity > 0) {
            cart[existingIndex].quantity = quantity;
        } else {
            cart.splice(existingIndex, 1);
        }
    } else if (quantity > 0) {
        cart.push({...product, quantity});
    }
    
    updateCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    
    if (cart.length === 0 && document.getElementById('cart-items')) {
        document.getElementById('cart-items').style.display = 'none';
        document.getElementById('cart-summary').style.display = 'none';
        document.getElementById('empty-cart-message').style.display = 'flex';
    }
}

function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartIcon();
    
    if (document.getElementById('cart-items')) renderCart();
    if (document.getElementById('checkout-items')) renderCheckoutItems();
}

function updateCartIcon() {
    const badges = document.querySelectorAll('.cart-badge');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badges.forEach(badge => {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'block' : 'none';
    });
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const emptyMessage = document.getElementById('empty-cart-message');
    const cartSummary = document.getElementById('cart-summary');
    
    if (cart.length === 0) {
        container.style.display = 'none';
        cartSummary.style.display = 'none';
        emptyMessage.style.display = 'flex';
        return;
    }
    
    container.style.display = 'block';
    cartSummary.style.display = 'block';
    emptyMessage.style.display = 'none';
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 5.00;
    const total = subtotal + shipping;
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}" class="cart-image">
            <div class="cart-info">
                <h3>${item.title}</h3>
                <p>$${(item.price * item.quantity).toFixed(2)}</p>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="adjustQuantity(${item.id}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="adjustQuantity(${item.id}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `).join('');

    document.getElementById('subtotal-price').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('total-price').textContent = `$${total.toFixed(2)}`;
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 5.00;
    let discount = 0;
    
    if (appliedCoupon) {
        discount = appliedCoupon.type === 'percentage' ? 
            subtotal * (appliedCoupon.value / 100) : 
            appliedCoupon.value;
    }
    
    const total = subtotal + shipping - discount;
    
    container.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <img src="${item.image}" alt="${item.title}" class="checkout-image">
            <div class="checkout-item-info">
                <h4>${item.title}</h4>
                <p>${item.quantity} × $${item.price.toFixed(2)}</p>
            </div>
            <div class="checkout-item-price">
                $${(item.price * item.quantity).toFixed(2)}
            </div>
        </div>
    `).join('');

    document.getElementById('subtotal-price').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('discount-price').textContent = `-$${discount.toFixed(2)}`;
    document.getElementById('grand-total-price').textContent = `$${total.toFixed(2)}`;
}

function adjustQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity < 1) removeFromCart(productId);
        else updateCart();
    }
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    const performSearch = () => {
        const term = searchInput.value.toLowerCase().trim();
        document.querySelectorAll('.product').forEach(product => {
            const title = product.querySelector('.product-title').textContent.toLowerCase();
            product.style.display = title.includes(term) ? 'block' : 'none';
        });
    };
    
    searchInput.addEventListener('input', performSearch);
    searchBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function setupCartButton() {
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            if (cart.length === 0) {
                window.location.href = 'index.html';
            } else {
                window.location.href = 'cart.html';
            }
        });
    }
}

function setupCartPage() {
    const continueBtn = document.querySelector('.continue-shopping-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }
}

function setupPaymentMethodToggle() {
    const paymentMethods = document.querySelectorAll('input[name="payment"]');
    const creditCardFields = document.getElementById('credit-card-fields');
    
    paymentMethods.forEach(method => {
        method.addEventListener('change', function() {
            if (this.value === 'credit') {
                creditCardFields.style.display = 'block';
            } else {
                creditCardFields.style.display = 'none';
            }
        });
    });
}

function setupCoupon() {
    const applyBtn = document.getElementById('apply-coupon');
    const couponInput = document.getElementById('coupon-code');
    
    applyBtn.addEventListener('click', function() {
        const couponCode = couponInput.value.trim();
        
        if (couponCode === 'SAVE10') {
            appliedCoupon = { type: 'percentage', value: 10 };
            showNotification('Coupon applied: 10% off!', 'success');
            renderCheckoutItems();
        } else if (couponCode === 'FREESHIP') {
            appliedCoupon = { type: 'fixed', value: 5.00 };
            showNotification('Coupon applied: Free shipping!', 'success');
            renderCheckoutItems();
        } else if (couponCode) {
            showNotification('Invalid coupon code', 'error');
            appliedCoupon = null;
            renderCheckoutItems();
        }
    });
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function setupSorting() {
    const sortSelect = document.getElementById('sort-options');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            renderProducts(currentCategory === 'all' ? productsData : 
                productsData.filter(p => p.category === currentCategory));
        });
    }
}

function setupNewsletter() {
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            showNotification('Thanks for subscribing!', 'success');
            this.reset();
        });
    }
}

function handleCheckout(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const city = document.getElementById('city').value.trim();
    const zip = document.getElementById('zip').value.trim();
    const country = document.getElementById('country').value;
    
    if (!name || !email || !phone || !address || !city || !zip || !country) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    if (phone.replace(/\D/g, '').length < 10) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }
    
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    if (paymentMethod === 'credit') {
        const cardNumber = document.getElementById('card-number').value.trim();
        const expiry = document.getElementById('expiry').value.trim();
        const cvv = document.getElementById('cvv').value.trim();
        
        if (!cardNumber || !expiry || !cvv) {
            showNotification('Please fill in all credit card details', 'error');
            return;
        }
        
        if (cardNumber.replace(/\D/g, '').length !== 16) {
            showNotification('Please enter a valid card number', 'error');
            return;
        }
        
        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            showNotification('Please enter a valid expiry date (MM/YY)', 'error');
            return;
        }
        
  
        if (!/^\d{3,4}$/.test(cvv)) {
            showNotification('Please enter a valid CVV', 'error');
            return;
        }
    }
    
    if (!document.getElementById('terms').checked) {
        showNotification('Please agree to the terms and conditions', 'error');
        return;
    }
    
    showNotification('Order submitted successfully!', 'success');
    
    setTimeout(() => {
        cart = [];
        updateCart();
        window.location.href = 'index.html';
    }, 2000);
}