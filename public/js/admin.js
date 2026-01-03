let products = [];
let categories = [];
let promoCodes = [];
let users = [];
let orders = [];
let staffApps = [];
let settings = {};

document.addEventListener('DOMContentLoaded', function() {
  setupTabs();
  loadCategories();
  loadProducts();
  loadPromoCodes();
  loadUsers();
  loadOrders();
  loadStaffApps();
  loadSettings();
});

async function api(url, options) {
  options = options || {};
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body
    });
    if (res.status === 401) {
      window.location.href = '/admin/login';
      return { error: 'Unauthorized' };
    }
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Operation failed', 'error');
      return { error: data.error };
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    showToast('Network error', 'error');
    return { error: 'Network error' };
  }
}

function setupTabs() {
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
      var tab = item.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
      document.getElementById(tab + '-tab').classList.add('active');
    });
  });
}

// Categories
async function loadCategories() {
  var data = await api('/admin/categories');
  categories = data.categories || [];
  renderCategories();
  updateCategoryDropdown();
}

function renderCategories() {
  var tbody = document.getElementById('categoriesTable');
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No categories</td></tr>';
    return;
  }
  tbody.innerHTML = categories.map(function(c) {
    return '<tr>' +
      '<td>' + c.id + '</td>' +
      '<td>' + c.name + '</td>' +
      '<td>' + c.slug + '</td>' +
      '<td>' + c.display_order + '</td>' +
      '<td><span class="badge ' + (c.active ? 'badge-success' : 'badge-danger') + '">' + (c.active ? 'Yes' : 'No') + '</span></td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-secondary btn-small" onclick="editCategory(' + c.id + ')">Edit</button>' +
        '<button class="btn btn-danger btn-small" onclick="deleteCategory(' + c.id + ')">Delete</button>' +
      '</div></td></tr>';
  }).join('');
}

function updateCategoryDropdown() {
  var select = document.getElementById('productCategory');
  if (!select) return;
  select.innerHTML = categories.filter(function(c) { return c.active; }).map(function(c) {
    return '<option value="' + c.slug + '">' + c.name + '</option>';
  }).join('');
}

function showCategoryModal(category) {
  document.getElementById('categoryModalTitle').textContent = category ? 'Edit Category' : 'Add Category';
  document.getElementById('categoryId').value = category ? category.id : '';
  document.getElementById('categoryName').value = category ? category.name : '';
  document.getElementById('categorySlug').value = category ? category.slug : '';
  document.getElementById('categoryOrder').value = category ? category.display_order : 0;
  document.getElementById('categoryActive').value = category ? (category.active ? '1' : '0') : '1';
  document.getElementById('categoryModal').classList.add('open');
}

function closeCategoryModal() { document.getElementById('categoryModal').classList.remove('open'); }

function editCategory(id) {
  var category = categories.find(function(c) { return c.id === id; });
  if (category) showCategoryModal(category);
}

async function saveCategory(e) {
  e.preventDefault();
  var id = document.getElementById('categoryId').value;
  var data = {
    name: document.getElementById('categoryName').value,
    slug: document.getElementById('categorySlug').value,
    display_order: parseInt(document.getElementById('categoryOrder').value) || 0,
    active: document.getElementById('categoryActive').value === '1'
  };
  if (id) {
    await api('/admin/categories/' + id, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await api('/admin/categories', { method: 'POST', body: JSON.stringify(data) });
  }
  closeCategoryModal();
  loadCategories();
  showToast('Category saved!', 'success');
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  await api('/admin/categories/' + id, { method: 'DELETE' });
  loadCategories();
  showToast('Category deleted');
}

// Products
async function loadProducts() {
  var data = await api('/admin/products');
  products = data.products || [];
  renderProducts();
}

function renderProducts() {
  var tbody = document.getElementById('productsTable');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No products</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(function(p) {
    var origPrice = p.original_price ? '$' + p.original_price.toFixed(2) : '-';
    var imgUrl = p.image_url || '/images/placeholder.svg';
    return '<tr>' +
      '<td><img src="' + imgUrl + '" alt="' + p.name + '" onerror="this.src=\'/images/placeholder.svg\'"></td>' +
      '<td>' + p.name + '</td>' +
      '<td>' + p.category + '</td>' +
      '<td>$' + p.price.toFixed(2) + '</td>' +
      '<td>' + origPrice + '</td>' +
      '<td><span class="badge ' + (p.on_sale ? 'badge-success' : 'badge-danger') + '">' + (p.on_sale ? 'Yes' : 'No') + '</span></td>' +
      '<td class="command-cell" title="' + (p.minecraft_command || '') + '">' + (p.minecraft_command || '-') + '</td>' +
      '<td><span class="badge ' + (p.active ? 'badge-success' : 'badge-danger') + '">' + (p.active ? 'Yes' : 'No') + '</span></td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-secondary btn-small" onclick="editProduct(' + p.id + ')">Edit</button>' +
        '<button class="btn btn-danger btn-small" onclick="deleteProduct(' + p.id + ')">Delete</button>' +
      '</div></td></tr>';
  }).join('');
}

function showProductModal(product) {
  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('productId').value = product ? product.id : '';
  document.getElementById('productName').value = product ? product.name : '';
  document.getElementById('productCategory').value = product ? product.category : (categories[0] ? categories[0].slug : '');
  document.getElementById('productDescription').value = product ? (product.description || '') : '';
  document.getElementById('productPrice').value = product ? product.price : '';
  document.getElementById('productOriginalPrice').value = product ? (product.original_price || '') : '';
  document.getElementById('productOnSale').value = product ? (product.on_sale ? '1' : '0') : '0';
  document.getElementById('productImage').value = product ? (product.image_url || '') : '';
  document.getElementById('productCommand').value = product ? (product.minecraft_command || '') : '';
  document.getElementById('productActive').value = product ? (product.active ? '1' : '0') : '1';
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

function editProduct(id) {
  var product = products.find(function(p) { return p.id === id; });
  if (product) showProductModal(product);
}

async function saveProduct(e) {
  e.preventDefault();
  var id = document.getElementById('productId').value;
  var data = {
    name: document.getElementById('productName').value,
    category: document.getElementById('productCategory').value,
    description: document.getElementById('productDescription').value,
    price: parseFloat(document.getElementById('productPrice').value),
    original_price: parseFloat(document.getElementById('productOriginalPrice').value) || null,
    on_sale: document.getElementById('productOnSale').value === '1',
    image_url: document.getElementById('productImage').value,
    minecraft_command: document.getElementById('productCommand').value,
    active: document.getElementById('productActive').value === '1'
  };
  if (id) {
    await api('/admin/products/' + id, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await api('/admin/products', { method: 'POST', body: JSON.stringify(data) });
  }
  closeProductModal();
  loadProducts();
  showToast('Product saved!', 'success');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  await api('/admin/products/' + id, { method: 'DELETE' });
  loadProducts();
  showToast('Product deleted');
}

async function applySale() {
  var percentage = prompt('Enter sale percentage (e.g., 30):');
  if (!percentage) return;
  await api('/admin/apply-sale', { method: 'POST', body: JSON.stringify({ percentage: parseFloat(percentage) }) });
  loadProducts();
  showToast(percentage + '% sale applied!', 'success');
}

async function removeSales() {
  if (!confirm('Remove all sales?')) return;
  await api('/admin/remove-sales', { method: 'POST' });
  loadProducts();
  showToast('Sales removed');
}

// Promo Codes
async function loadPromoCodes() {
  var data = await api('/admin/promo-codes');
  promoCodes = data.promoCodes || [];
  renderPromoCodes();
}

function renderPromoCodes() {
  var tbody = document.getElementById('promoCodesTable');
  if (promoCodes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No promo codes</td></tr>';
    return;
  }
  tbody.innerHTML = promoCodes.map(function(p) {
    var expiresText = p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'Never';
    return '<tr>' +
      '<td>' + p.id + '</td>' +
      '<td><strong>' + p.code + '</strong></td>' +
      '<td>' + p.discount_percent + '%</td>' +
      '<td>' + (p.max_uses === 0 ? 'Unlimited' : p.max_uses) + '</td>' +
      '<td>' + p.used_count + '</td>' +
      '<td>' + expiresText + '</td>' +
      '<td><span class="badge ' + (p.active ? 'badge-success' : 'badge-danger') + '">' + (p.active ? 'Yes' : 'No') + '</span></td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-secondary btn-small" onclick="editPromoCode(' + p.id + ')">Edit</button>' +
        '<button class="btn btn-danger btn-small" onclick="deletePromoCode(' + p.id + ')">Delete</button>' +
      '</div></td></tr>';
  }).join('');
}

function showPromoModal(promo) {
  document.getElementById('promoModalTitle').textContent = promo ? 'Edit Promo Code' : 'Add Promo Code';
  document.getElementById('promoId').value = promo ? promo.id : '';
  document.getElementById('promoCode').value = promo ? promo.code : '';
  document.getElementById('promoDiscount').value = promo ? promo.discount_percent : '';
  document.getElementById('promoMaxUses').value = promo ? promo.max_uses : 0;
  document.getElementById('promoExpires').value = promo && promo.expires_at ? promo.expires_at.slice(0, 16) : '';
  document.getElementById('promoActive').value = promo ? (promo.active ? '1' : '0') : '1';
  document.getElementById('promoModal').classList.add('open');
}

function closePromoModal() { document.getElementById('promoModal').classList.remove('open'); }

function editPromoCode(id) {
  var promo = promoCodes.find(function(p) { return p.id === id; });
  if (promo) showPromoModal(promo);
}

async function savePromoCode(e) {
  e.preventDefault();
  var id = document.getElementById('promoId').value;
  var data = {
    code: document.getElementById('promoCode').value,
    discount_percent: parseInt(document.getElementById('promoDiscount').value),
    max_uses: parseInt(document.getElementById('promoMaxUses').value) || 0,
    expires_at: document.getElementById('promoExpires').value || null,
    active: document.getElementById('promoActive').value === '1'
  };
  if (id) {
    await api('/admin/promo-codes/' + id, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await api('/admin/promo-codes', { method: 'POST', body: JSON.stringify(data) });
  }
  closePromoModal();
  loadPromoCodes();
  showToast('Promo code saved!', 'success');
}

async function deletePromoCode(id) {
  if (!confirm('Delete this promo code?')) return;
  await api('/admin/promo-codes/' + id, { method: 'DELETE' });
  loadPromoCodes();
  showToast('Promo code deleted');
}

// Users
async function loadUsers() {
  var data = await api('/admin/users');
  users = data.users || [];
  renderUsers();
}

function renderUsers() {
  var tbody = document.getElementById('usersTable');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No users</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(function(u) {
    return '<tr>' +
      '<td>' + u.id + '</td>' +
      '<td>' + u.username + '</td>' +
      '<td>' + u.email + '</td>' +
      '<td><span class="badge badge-warning">' + u.player_type + '</span></td>' +
      '<td>$' + u.balance.toFixed(2) + '</td>' +
      '<td>$' + (u.total_spent || 0).toFixed(2) + '</td>' +
      '<td><button class="btn btn-primary btn-small" onclick="showBalanceModal(' + u.id + ', \'' + u.username + '\', ' + u.balance + ')">Add Balance</button></td>' +
    '</tr>';
  }).join('');
}

function showBalanceModal(userId, username, currentBalance) {
  document.getElementById('balanceUserId').value = userId;
  document.getElementById('balanceUserName').textContent = username + ' - Current: $' + currentBalance.toFixed(2);
  document.getElementById('balanceAmount').value = '';
  document.getElementById('balanceModal').classList.add('open');
}

function closeBalanceModal() { document.getElementById('balanceModal').classList.remove('open'); }

async function addBalance(e) {
  e.preventDefault();
  var userId = document.getElementById('balanceUserId').value;
  var amount = parseFloat(document.getElementById('balanceAmount').value);
  await api('/admin/users/' + userId + '/add-balance', { method: 'POST', body: JSON.stringify({ amount: amount }) });
  closeBalanceModal();
  loadUsers();
  showToast('$' + amount.toFixed(2) + ' added!', 'success');
}

// Orders
async function loadOrders() {
  var data = await api('/admin/orders');
  orders = data.orders || [];
  renderOrders();
}

function renderOrders() {
  var tbody = document.getElementById('ordersTable');
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-row">No orders</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(function(o) {
    var actionBtn = o.command_executed ? '' : '<button class="btn btn-secondary btn-small" onclick="markExecuted(' + o.id + ')">Mark Done</button>';
    return '<tr>' +
      '<td>#' + o.id + '</td>' +
      '<td>' + o.username + '</td>' +
      '<td><span class="badge badge-warning">' + o.player_type + '</span></td>' +
      '<td>' + o.product_name + '</td>' +
      '<td>' + o.quantity + '</td>' +
      '<td>$' + o.total_price.toFixed(2) + '</td>' +
      '<td class="command-cell" title="' + (o.minecraft_command || '') + '">' + (o.minecraft_command || '-') + '</td>' +
      '<td><span class="badge ' + (o.command_executed ? 'badge-success' : 'badge-warning') + '">' + (o.command_executed ? 'Yes' : 'No') + '</span></td>' +
      '<td>' + new Date(o.created_at).toLocaleDateString() + '</td>' +
      '<td>' + actionBtn + '</td></tr>';
  }).join('');
}

async function markExecuted(orderId) {
  await api('/admin/orders/' + orderId + '/executed', { method: 'POST' });
  loadOrders();
  showToast('Marked as executed');
}

// Staff Applications
async function loadStaffApps() {
  var data = await api('/admin/staff-applications');
  staffApps = data.applications || [];
  renderStaffApps();
}

function renderStaffApps() {
  var tbody = document.getElementById('staffAppsTable');
  if (staffApps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-row">No staff applications</td></tr>';
    return;
  }
  tbody.innerHTML = staffApps.map(function(a) {
    var statusClass = a.status === 'approved' ? 'badge-success' : a.status === 'rejected' ? 'badge-danger' : 'badge-warning';
    var reasonShort = a.reason.length > 40 ? a.reason.substring(0, 40) + '...' : a.reason;
    return '<tr>' +
      '<td>' + a.id + '</td>' +
      '<td><strong>' + a.ign + '</strong></td>' +
      '<td>' + a.age + '</td>' +
      '<td>' + a.discord + '</td>' +
      '<td>' + a.rank + '</td>' +
      '<td class="command-cell" title="' + a.reason + '">' + reasonShort + '</td>' +
      '<td><span class="badge ' + statusClass + '">' + a.status + '</span></td>' +
      '<td class="command-cell">' + (a.admin_notes || '-') + '</td>' +
      '<td>' + new Date(a.created_at).toLocaleDateString() + '</td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-secondary btn-small" onclick="editStaffApp(' + a.id + ')">View</button>' +
        '<button class="btn btn-danger btn-small" onclick="deleteStaffApp(' + a.id + ')">Delete</button>' +
      '</div></td></tr>';
  }).join('');
}

function editStaffApp(id) {
  var app = staffApps.find(function(a) { return a.id === id; });
  if (!app) return;
  document.getElementById('staffAppId').value = app.id;
  document.getElementById('staffAppIGN').value = app.ign;
  document.getElementById('staffAppAge').value = app.age;
  document.getElementById('staffAppDiscord').value = app.discord;
  document.getElementById('staffAppRank').value = app.rank;
  document.getElementById('staffAppReason').value = app.reason;
  document.getElementById('staffAppStatus').value = app.status || 'pending';
  document.getElementById('staffAppNotes').value = app.admin_notes || '';
  document.getElementById('staffAppModal').classList.add('open');
}

function closeStaffAppModal() { document.getElementById('staffAppModal').classList.remove('open'); }

async function saveStaffApp() {
  var id = document.getElementById('staffAppId').value;
  var data = {
    status: document.getElementById('staffAppStatus').value,
    admin_notes: document.getElementById('staffAppNotes').value
  };
  await api('/admin/staff-applications/' + id, { method: 'PUT', body: JSON.stringify(data) });
  closeStaffAppModal();
  loadStaffApps();
  showToast('Application updated!', 'success');
}

async function deleteStaffApp(id) {
  if (!confirm('Delete this application?')) return;
  await api('/admin/staff-applications/' + id, { method: 'DELETE' });
  loadStaffApps();
  showToast('Application deleted');
}

// Settings
async function loadSettings() {
  var data = await api('/admin/settings');
  settings = data.settings || {};
  
  var fields = [
    'sale_active', 'sale_text', 'sale_percentage', 'server_ip', 'discord_link',
    'discord_webhook', 'staff_webhook', 'payment_goal', 'payment_goal_current', 'payment_goal_text',
    'server_name', 'server_tagline', 'hero_badge', 'hero_title', 'hero_subtitle',
    'hero_description', 'owner_username', 'owner_quote', 'staff_apply_link', 'media_rank_link',
    'gamemodes', 'team_members', 'rules_client', 'rules_server', 'rules_discord'
  ];
  
  fields.forEach(function(field) {
    var el = document.getElementById('setting_' + field);
    if (el) el.value = settings[field] || '';
  });
}

async function saveSettings() {
  var fields = [
    'sale_active', 'sale_text', 'sale_percentage', 'server_ip', 'discord_link',
    'discord_webhook', 'staff_webhook', 'payment_goal', 'payment_goal_current', 'payment_goal_text',
    'server_name', 'server_tagline', 'hero_badge', 'hero_title', 'hero_subtitle',
    'hero_description', 'owner_username', 'owner_quote', 'staff_apply_link', 'media_rank_link',
    'gamemodes', 'team_members', 'rules_client', 'rules_server', 'rules_discord'
  ];
  
  var newSettings = {};
  fields.forEach(function(field) {
    var el = document.getElementById('setting_' + field);
    if (el) newSettings[field] = el.value;
  });
  
  await api('/admin/settings', { method: 'PUT', body: JSON.stringify(newSettings) });
  showToast('Settings saved!', 'success');
}

async function resetPaymentGoal() {
  if (!confirm('Reset payment goal?')) return;
  await api('/admin/reset-payment-goal', { method: 'POST' });
  document.getElementById('setting_payment_goal_current').value = '0';
  showToast('Payment goal reset');
}

function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeProductModal();
    closeCategoryModal();
    closePromoModal();
    closeBalanceModal();
    closeStaffAppModal();
  }
});
