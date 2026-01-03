// State
let currentUser = null;
let cart = [];
let products = [];
let categories = [];
let settings = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadCategories();
  loadProducts();
  loadStats();
  checkAuth();
  setup3DEffect();
  
  // Refresh stats every 10 seconds
  setInterval(loadStats, 10000);
});

// API Helper
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  return res.json();
}

// Load settings
async function loadSettings() {
  const data = await api('/shop/settings');
  settings = data.settings;
  
  if (settings.sale_active === '1') {
    document.getElementById('saleBanner').style.display = 'block';
    document.getElementById('saleText').textContent = settings.sale_text || '30% OFF WINTER SALE';
  } else {
    document.getElementById('saleBanner').style.display = 'none';
  }
  
  if (settings.discord_link) {
    document.getElementById('discordLink').href = settings.discord_link;
    document.getElementById('supportDiscord').href = settings.discord_link;
    document.getElementById('balanceDiscordBtn').href = settings.discord_link;
  }
}

// Load categories
async function loadCategories() {
  const data = await api('/shop/categories');
  categories = data.categories || [];
  renderCategories();
}

// Render categories in sidebar
function renderCategories() {
  const nav = document.querySelector('.category-nav');
  nav.innerHTML = '<a href="#" class="category-link active" data-category="all">Home</a>';
  
  categories.forEach(cat => {
    nav.innerHTML += '<a href="#" class="category-link" data-category="' + cat.slug + '">' + cat.name + '</a>';
  });
  
  setupCategoryLinks();
}

// Load products
async function loadProducts(category) {
  if (!category || category === 'all') {
    // Don't show products on homepage
    document.getElementById('productsGrid').innerHTML = '';
    return;
  }
  const data = await api('/shop/products?category=' + category);
  products = data.products;
  renderProducts();
}

// Render products with animation
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  
  if (products.length === 0) {
    grid.innerHTML = '<p class="no-products">No products available in this category.</p>';
    return;
  }
  
  grid.innerHTML = products.map((product, index) => {
    const imgUrl = product.image_url || '/images/placeholder.svg';
    let priceHtml = '';
    if (product.on_sale && product.original_price) {
      priceHtml = '<span class="original-price">$' + product.original_price.toFixed(2) + '</span>' +
                  '<span class="sale-price">$' + product.price.toFixed(2) + '</span>';
    } else {
      priceHtml = '<span class="regular-price">$' + product.price.toFixed(2) + '</span>';
    }
    
    return '<div class="product-card" style="animation-delay: ' + (index * 0.05) + 's" onclick="openProductModal(' + product.id + ')">' +
      '<img src="' + imgUrl + '" alt="' + product.name + '" class="product-image" onerror="this.src=\'/images/placeholder.svg\'">' +
      '<div class="product-info">' +
        '<h3 class="product-name">' + product.name + '</h3>' +
        '<div class="product-price">' + priceHtml + '</div>' +
        '<button class="add-to-cart" onclick="event.stopPropagation(); addToCart(' + product.id + ')">Add to Basket</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Product Modal
function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const imgUrl = product.image_url || '/images/placeholder.svg';
  document.getElementById('productDetailImage').src = imgUrl;
  document.getElementById('productDetailImage').onerror = function() { this.src = '/images/placeholder.svg'; };
  document.getElementById('productDetailName').textContent = product.name;
  
  let priceHtml = '';
  if (product.on_sale && product.original_price) {
    priceHtml = '<span class="original-price">$' + product.original_price.toFixed(2) + '</span>' +
                '<span class="sale-price">$' + product.price.toFixed(2) + '</span>';
  } else {
    priceHtml = '<span class="regular-price">$' + product.price.toFixed(2) + '</span>';
  }
  document.getElementById('productDetailPrice').innerHTML = priceHtml;
  
  // Parse description - support HTML and images
  let desc = product.description || 'No description available.';
  document.getElementById('productDetailDescription').innerHTML = desc;
  
  document.getElementById('productDetailAddBtn').onclick = function() {
    addToCart(productId);
  };
  
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

// 3D Effect removed - simple image display
function setup3DEffect() {
  // Disabled
}

// Load stats
async function loadStats() {
  const data = await api('/shop/stats');
  
  // Top supporter
  const topBox = document.getElementById('topCustomerContent');
  if (data.topSupporter) {
    const bodyUrl = getPlayerBody(data.topSupporter.username);
    topBox.innerHTML = '<img src="' + bodyUrl + '" alt="' + data.topSupporter.username + '" class="top-customer-body" onerror="this.src=\'https://mc-heads.net/body/MHF_Steve/100\'">' +
      '<div class="top-customer-name">' + data.topSupporter.username + '</div>' +
      '<div class="top-customer-info">Paid the most this month</div>';
  } else {
    topBox.innerHTML = '<p class="no-data">No purchases yet this month</p>';
  }
  
  // Recent purchases
  const recentBox = document.getElementById('recentPayments');
  if (data.recentPurchases && data.recentPurchases.length > 0) {
    recentBox.innerHTML = data.recentPurchases.map(function(p) {
      const headUrl = getPlayerHead(p.username);
      const time = formatTime(p.created_at);
      return '<div class="recent-item">' +
        '<img src="' + headUrl + '" alt="' + p.username + '" class="recent-avatar" onerror="this.src=\'https://mc-heads.net/avatar/MHF_Steve/40\'">' +
        '<div class="recent-info">' +
          '<div class="recent-name">' + p.username + '</div>' +
          '<div class="recent-product">' + p.product_name + '</div>' +
        '</div>' +
        '<div class="recent-time">' + time + '</div>' +
      '</div>';
    }).join('');
  } else {
    recentBox.innerHTML = '<p class="no-data">No recent payments</p>';
  }
  
  // Payment goal
  const goal = data.paymentGoal;
  const percentage = Math.min((goal.current / goal.goal) * 100, 100);
  document.getElementById('goalProgress').style.width = percentage + '%';
  document.getElementById('goalText').textContent = Math.round(percentage) + '% completed';
}

function getPlayerHead(username) {
  return 'https://mc-heads.net/avatar/' + username + '/40';
}

function getPlayerBody(username) {
  return 'https://mc-heads.net/body/' + username + '/100';
}

function formatTime(dateStr) {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + 'd ago';
  return date.toLocaleDateString();
}

function setupCategoryLinks() {
  document.querySelectorAll('.category-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.category-link').forEach(function(l) { l.classList.remove('active'); });
      link.classList.add('active');
      const category = link.dataset.category;
      loadProducts(category);
      document.getElementById('welcomeBox').style.display = category === 'all' ? 'block' : 'none';
    });
  });
}

async function checkAuth() {
  try {
    const data = await api('/auth/me');
    if (data.user) {
      currentUser = data.user;
      updateUserUI();
      loadCart();
    }
  } catch (e) {}
}

function updateUserUI() {
  const userArea = document.getElementById('userArea');
  const cartUser = document.getElementById('cartUser');
  const cartBalance = document.getElementById('cartBalance');
  
  if (currentUser) {
    userArea.innerHTML = '<div class="user-info"><div class="user-details">' +
      '<span class="user-name">' + currentUser.username + '</span>' +
      '<span class="user-balance">$' + currentUser.balance.toFixed(2) + '</span>' +
      '</div><a href="/auth/logout" class="logout-btn">Logout</a></div>';
    cartUser.innerHTML = '<span>' + currentUser.username + '</span>';
    cartBalance.textContent = 'Balance: $' + currentUser.balance.toFixed(2);
    cartBalance.style.display = 'block';
  } else {
    userArea.innerHTML = '<a href="/auth/login" class="login-btn">Login</a>';
    cartUser.innerHTML = '<span>Guest</span>';
    cartBalance.style.display = 'none';
  }
}

async function addToCart(productId) {
  if (!currentUser) {
    window.location.href = '/auth/login';
    return;
  }
  
  try {
    const data = await api('/shop/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId: productId, quantity: 1 })
    });
    
    if (data.success) {
      loadCart();
      showToast('Added to cart!', 'success');
    } else {
      showToast(data.error || 'Failed to add to cart', 'error');
    }
  } catch (e) {
    showToast('Failed to add to cart', 'error');
  }
}

async function loadCart() {
  if (!currentUser) return;
  
  try {
    const data = await api('/shop/cart');
    cart = data.items || [];
    updateCartUI();
  } catch (e) {}
}

function updateCartUI() {
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartItemsCount = document.getElementById('cartItemsCount');
  const cartTotal = document.getElementById('cartTotal');
  
  const totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
  cartCount.textContent = totalItems;
  cartItemsCount.textContent = totalItems + ' Item' + (totalItems !== 1 ? 's' : '');
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
    cartTotal.textContent = '$0.00';
    return;
  }
  
  let total = 0;
  cartItems.innerHTML = cart.map(function(item) {
    total += item.price * item.quantity;
    return '<div class="cart-item"><div class="cart-item-header">' +
      '<span class="cart-item-name">' + item.name + '</span>' +
      '<span class="cart-item-price">$' + item.price.toFixed(2) + '</span></div>' +
      '<div class="cart-item-controls">' +
      '<button class="qty-btn" onclick="updateCartQty(' + item.id + ', ' + (item.quantity - 1) + ')">-</button>' +
      '<span class="cart-item-qty">' + item.quantity + '</span>' +
      '<button class="qty-btn" onclick="updateCartQty(' + item.id + ', ' + (item.quantity + 1) + ')">+</button>' +
      '<button class="remove-item" onclick="removeFromCart(' + item.id + ')">X</button></div></div>';
  }).join('');
  
  cartTotal.textContent = '$' + total.toFixed(2);
}

async function updateCartQty(cartId, quantity) {
  await api('/shop/cart/update', { method: 'POST', body: JSON.stringify({ cartId: cartId, quantity: quantity }) });
  loadCart();
}

async function removeFromCart(cartId) {
  await api('/shop/cart/remove', { method: 'POST', body: JSON.stringify({ cartId: cartId }) });
  loadCart();
}

function toggleCart() {
  document.getElementById('cartSidebar').classList.toggle('open');
  document.getElementById('cartOverlay').classList.toggle('open');
}

function checkout() {
  if (!currentUser) {
    window.location.href = '/auth/login';
    return;
  }
  
  if (cart.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }
  
  window.location.href = '/checkout.html';
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('open');
}

function closeBalanceModal() {
  document.getElementById('balanceModal').classList.remove('open');
}

function copyIP() {
  navigator.clipboard.writeText('skybattle.fun');
  const ipEl = document.querySelector('.server-ip');
  ipEl.classList.add('copied');
  document.querySelector('.copy-tooltip').textContent = 'Copied!';
  showToast('Server IP copied!', 'success');
  
  setTimeout(function() {
    ipEl.classList.remove('copied');
    document.querySelector('.copy-tooltip').textContent = 'Click to Copy';
  }, 2000);
}

function showToast(message, type) {
  type = type || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeSuccessModal();
    closeBalanceModal();
    closeProductModal();
    if (document.getElementById('cartSidebar').classList.contains('open')) {
      toggleCart();
    }
  }
});
