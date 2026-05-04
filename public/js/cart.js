// XSS protection
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== Custom confirm popup =====
function customConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-message').textContent = message;
    overlay.classList.add('active');

    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');

    function cleanup() {
      overlay.classList.remove('active');
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      overlay.removeEventListener('click', onOverlay);
    }
    function onYes() { cleanup(); resolve(true); }
    function onNo() { cleanup(); resolve(false); }
    function onOverlay(e) {
      if (e.target === overlay) { cleanup(); resolve(false); }
    }

    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
    overlay.addEventListener('click', onOverlay);
  });
}

// ===== Device ID =====
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// ===== Favorites count =====
function updateFavCount() {
  const count = JSON.parse(localStorage.getItem('favorites') || '[]').length;
  document.querySelectorAll('#fav-count').forEach(el => {
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  });
}

// ===== Cart helpers =====
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCart();
  calculateDelivery();
}
function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = total;
    el.classList.toggle('hidden', total === 0);
  });
}

// ===== Coupon system =====
let appliedCoupon = null;

async function applyCoupon() {
  const code = document.getElementById('coupon-code').value.trim().toUpperCase();
  const messageEl = document.getElementById('coupon-message');

  if (!code) {
    messageEl.textContent = 'Введите код купона';
    messageEl.className = 'coupon-message error';
    messageEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const result = await res.json();

    if (result.valid) {
      appliedCoupon = result.coupon;
      messageEl.textContent = `Купон применен: ${result.coupon.description}`;
      messageEl.className = 'coupon-message success';
      renderCart();
    } else {
      appliedCoupon = null;
      messageEl.textContent = result.error || 'Недействительный купон';
      messageEl.className = 'coupon-message error';
      renderCart();
    }
  } catch (err) {
    messageEl.textContent = 'Ошибка проверки купона';
    messageEl.className = 'coupon-message error';
  }

  messageEl.classList.remove('hidden');
}

function calculateDiscount(subtotal) {
  if (!appliedCoupon) return 0;
  if (appliedCoupon.min_order && subtotal < appliedCoupon.min_order) return 0;

  if (appliedCoupon.type === 'percent') {
    return Math.round(subtotal * appliedCoupon.value / 100);
  } else if (appliedCoupon.type === 'fixed') {
    return Math.min(appliedCoupon.value, subtotal);
  }

  return 0;
}

// ===== Delivery calculation =====
async function calculateDelivery() {
  const address = document.getElementById('address').value.trim();
  const deliveryEl = document.getElementById('delivery-cost');

  if (!address) {
    deliveryEl.textContent = 'Введите адрес';
    deliveryEl.className = '';
    return;
  }

  // Simple delivery calculation based on city
  const city = address.toLowerCase();
  let cost = 0;

  if (city.includes('алматы') || city.includes('астана') || city.includes('алма-ата')) {
    cost = 0; // Free delivery in major cities
  } else if (city.includes('шымкент') || city.includes('караганда') || city.includes('актобе')) {
    cost = 1500; // Regional cities
  } else {
    cost = 2500; // Other locations
  }

  deliveryEl.textContent = cost === 0 ? 'Бесплатно' : formatPrice(cost);
  deliveryEl.className = cost === 0 ? 'delivery-free' : '';

  renderCart(); // Recalculate totals
}

// ===== Saved addresses =====
async function loadSavedAddresses() {
  const token = localStorage.getItem('user_token');
  if (!token) return;

  try {
    const res = await window.userFetch('/api/users/addresses');
    const addresses = await res.json();

    if (addresses.length > 0) {
      const container = document.getElementById('saved-addresses');
      const select = document.getElementById('address-select');

      container.classList.remove('hidden');
      select.innerHTML = '<option value="">Выберите сохраненный адрес</option>' +
        addresses.map(addr => `<option value="${esc(addr.address)}">${esc(addr.address)}</option>`).join('');

      select.addEventListener('change', (e) => {
        document.getElementById('address').value = e.target.value;
        calculateDelivery();
      });
    }
  } catch (err) {
    console.error('Error loading addresses:', err);
  }
}

async function saveAddress(address) {
  const token = localStorage.getItem('user_token');
  if (!token) return;

  try {
    await window.userFetch('/api/users/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
  } catch (err) {
    console.error('Error saving address:', err);
  }
}

// ===== Cart persistence for logged users =====
async function saveCartToServer() {
  const token = localStorage.getItem('user_token');
  if (!token) {
    alert('Войдите в аккаунт, чтобы сохранить корзину');
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    alert('Корзина пуста');
    return;
  }

  try {
    await window.userFetch('/api/users/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart })
    });
    alert('Корзина сохранена!');
  } catch (err) {
    alert('Ошибка сохранения корзины');
  }
}

async function loadCartFromServer() {
  const token = localStorage.getItem('user_token');
  if (!token) return;

  try {
    const res = await window.userFetch('/api/users/cart');
    const data = await res.json();

    if (data.cart && data.cart.length > 0) {
      // Merge with local cart
      const localCart = getCart();
      const mergedCart = [...localCart];

      for (const serverItem of data.cart) {
        const existing = mergedCart.find(item =>
          item.product_id === serverItem.product_id && item.size === serverItem.size
        );
        if (!existing) {
          mergedCart.push(serverItem);
        }
      }

      saveCart(mergedCart);
    }
  } catch (err) {
    console.error('Error loading cart from server:', err);
  }
}

function formatPrice(price) {
  return price.toLocaleString('ru-RU') + ' ₸';
}

// ===== Render cart =====
function renderCart() {
  const cart = getCart();
  const emptyEl = document.getElementById('cart-empty');
  const contentEl = document.getElementById('cart-content');
  const successEl = document.getElementById('order-success');

  if (successEl && !successEl.classList.contains('hidden')) return;

  if (cart.length === 0) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const itemsEl = document.getElementById('cart-items');
  itemsEl.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <h3>${esc(item.product_name)}</h3>
        <div class="cart-item-meta">
          <span class="cart-item-size">Размер: ${esc(item.size)}</span>
          <span class="cart-item-price">${formatPrice(item.price)}</span>
        </div>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="qty-btn" data-index="${index}" data-action="minus">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" data-index="${index}" data-action="plus" ${item.stock_quantity != null && item.quantity >= item.stock_quantity ? 'disabled title="Нет больше на складе"' : ''}>+</button>
        </div>
        <span class="cart-item-subtotal">${formatPrice(item.price * item.quantity)}</span>
        <button class="btn-remove" data-index="${index}" title="Удалить">&times;</button>
      </div>
    </div>
  `).join('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = calculateDiscount(subtotal);
  const deliveryText = document.getElementById('delivery-cost').textContent;
  const deliveryCost = deliveryText === 'Бесплатно' || deliveryText === 'Введите адрес' ? 0 :
                      parseInt(deliveryText.replace(/\D/g, '')) || 0;
  const total = subtotal - discount + deliveryCost;

  document.getElementById('items-count').textContent = cart.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);

  // Show/hide coupon discount
  const couponRow = document.querySelector('.coupon-discount');
  const discountEl = document.getElementById('coupon-discount-amount');
  if (discount > 0) {
    couponRow.classList.remove('hidden');
    discountEl.textContent = `-${formatPrice(discount)}`;
  } else {
    couponRow.classList.add('hidden');
  }

  document.getElementById('cart-total').textContent = formatPrice(total);
  document.getElementById('btn-total').textContent = formatPrice(total);

  // Update submit button text based on payment method
  updateSubmitButton();

  // Event delegation
  itemsEl.onclick = (e) => {
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
      const idx = parseInt(qtyBtn.dataset.index);
      const action = qtyBtn.dataset.action;
      const cart = getCart();
      if (action === 'plus') {
        if (cart[idx].stock_quantity != null && cart[idx].quantity >= cart[idx].stock_quantity) return;
        cart[idx].quantity++;
      } else {
        cart[idx].quantity--;
        if (cart[idx].quantity <= 0) cart.splice(idx, 1);
      }
      saveCart(cart);
      return;
    }

    const removeBtn = e.target.closest('.btn-remove');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.index);
      const cart = getCart();
      cart.splice(idx, 1);
      saveCart(cart);
    }
  };
}

// ===== Input filters =====
document.getElementById('name').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^a-zA-Zа-яА-ЯёЁәғқңөұүһіӘҒҚҢӨҰҮҺІ\s\-]/g, '');
});

document.getElementById('phone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\d\+\(\)\-\s]/g, '');
});
// ===== Coupon events =====
document.getElementById('apply-coupon').addEventListener('click', applyCoupon);
document.getElementById('coupon-code').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') applyCoupon();
});

// ===== Address events =====
document.getElementById('address').addEventListener('input', calculateDelivery);
document.getElementById('new-address-btn').addEventListener('click', () => {
  document.getElementById('address-select').value = '';
  document.getElementById('address').value = '';
  document.getElementById('address').focus();
});

// ===== Cart actions =====
document.getElementById('save-cart-btn').addEventListener('click', saveCartToServer);
document.getElementById('clear-cart-btn').addEventListener('click', () => {
  if (confirm('Очистить корзину?')) {
    saveCart([]);
  }
});
// ===== Payment method switching =====
function updateSubmitButton() {
  const method = document.querySelector('input[name="payment_method"]:checked');
  const submitBtn = document.getElementById('submit-btn');

  if (!method) return;

  if (method.value === 'card') {
    submitBtn.childNodes[0].textContent = 'Перейти к оплате ';
  } else if (method.value === 'sbp') {
    submitBtn.childNodes[0].textContent = 'Оплатить через СБП ';
  } else {
    submitBtn.childNodes[0].textContent = 'Оформить заказ ';
  }
}

// Payment method radio buttons
document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    radio.closest('.payment-option').classList.add('selected');
    updateSubmitButton();
  });
});

// ===== Order form submission =====
document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const cart = getCart();

  if (cart.length === 0) return;

  const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;

  const data = {
    customer_name: form.customer_name.value.trim(),
    customer_phone: form.customer_phone.value.trim(),
    customer_email: form.customer_email.value.trim(),
    customer_address: form.customer_address.value.trim(),
    payment_method: paymentMethod,
    order_comment: form.order_comment.value.trim(),
    items: cart,
    device_id: getDeviceId(),
    coupon_code: appliedCoupon ? appliedCoupon.code : null,
    delivery_cost: document.getElementById('delivery-cost').textContent === 'Бесплатно' ? 0 :
                  parseInt(document.getElementById('delivery-cost').textContent.replace(/\D/g, '')) || 0
  };

  // Save address if requested
  if (document.getElementById('save-address').checked && data.customer_address) {
    await saveAddress(data.customer_address);
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Обработка...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.success) {
      if (result.checkout_url) {
        // Card payment — redirect to Stripe Checkout
        // Don't clear cart yet (user might cancel on Stripe page)
        window.location.href = result.checkout_url;
      } else {
        // SBP / Cash — immediate success
        localStorage.removeItem('cart');
        updateCartCount();
        document.getElementById('cart-content').classList.add('hidden');
        document.getElementById('order-success').classList.remove('hidden');
        document.getElementById('order-id').textContent = result.order_id;
        loadMyOrders();
      }
    } else {
      alert(result.error || 'Ошибка при оформлении заказа');
      submitBtn.disabled = false;
      updateSubmitButton();
    }
  } catch {
    alert('Ошибка соединения с сервером');
    submitBtn.disabled = false;
    updateSubmitButton();
  }
});

// ===== Handle Stripe return =====
async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  const sessionId = params.get('session_id');

  if (payment === 'success' && sessionId) {
    try {
      const res = await fetch('/api/orders/verify-payment?session_id=' + encodeURIComponent(sessionId));
      const data = await res.json();

      if (data.success) {
        // Payment verified — clear cart and show success
        localStorage.removeItem('cart');
        updateCartCount();
        document.getElementById('cart-empty').classList.add('hidden');
        document.getElementById('cart-content').classList.add('hidden');
        document.getElementById('order-success').classList.remove('hidden');
        document.getElementById('order-id').textContent = data.order_id;
        loadMyOrders();
      } else {
        alert('Оплата не подтверждена. Попробуйте позже или свяжитесь с нами.');
      }
    } catch {
      alert('Ошибка проверки оплаты');
    }
    // Clean URL
    window.history.replaceState({}, '', '/cart.html');
  } else if (payment === 'cancelled') {
    // User cancelled on Stripe — just clean URL, cart is preserved
    window.history.replaceState({}, '', '/cart.html');
  }
}

// ===== My Orders =====
async function loadMyOrders() {
  const section = document.getElementById('my-orders');
  const list = document.getElementById('my-orders-list');
  if (!section || !list) return;

  const deviceId = getDeviceId();
  const filter = document.getElementById('orders-filter').value;
  const dateFrom = document.getElementById('orders-date-from').value;
  const dateTo = document.getElementById('orders-date-to').value;

  const params = new URLSearchParams({
    device_id: deviceId,
    status: filter,
    date_from: dateFrom,
    date_to: dateTo
  });

  try {
    const res = await fetch('/api/orders/my?' + params);
    const data = await res.json();
    if (!data.success || !data.orders || data.orders.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = data.orders.map(order => {
      const date = new Date(order.created_at + 'Z').toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const statusClass = getOrderStatusClass(order.status);
      const statusText = getOrderStatusText(order.status);

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-num">Заказ #${order.id}</div>
              <div class="order-date">${date}</div>
            </div>
            <div class="order-status ${statusClass}">${statusText}</div>
          </div>

          <div class="order-items">
            ${order.items.map(item => `
              <div class="order-item">
                <span>${esc(item.product_name)} (${esc(item.size)}) × ${item.quantity}</span>
                <span>${formatPrice(item.price * item.quantity)}</span>
              </div>
            `).join('')}
          </div>

          <div class="order-total">
            <strong>Итого: ${formatPrice(order.total)}</strong>
          </div>

          <div class="order-actions">
            <button class="btn-reorder" onclick="reorder(${order.id})">Повторить заказ</button>
            ${order.status === 'доставлен' ? `<button class="btn-rate" onclick="rateOrder(${order.id})">Оценить товары</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
    list.innerHTML = '<p style="text-align:center;color:#888;">Ошибка загрузки заказов</p>';
  }
}

function getOrderStatusClass(status) {
  const classes = {
    'новый': 'status-pending',
    'ожидает оплаты': 'status-pending',
    'в обработке': 'status-processing',
    'отправлен': 'status-shipped',
    'доставлен': 'status-delivered',
    'отменён': 'status-cancelled'
  };
  return classes[status] || 'status-pending';
}

function getOrderStatusText(status) {
  const texts = {
    'новый': 'Новый',
    'ожидает оплаты': 'Ожидает оплаты',
    'в обработке': 'В обработке',
    'отправлен': 'Отправлен',
    'доставлен': 'Доставлен',
    'отменён': 'Отменён'
  };
  return texts[status] || status;
}

async function reorder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (data.success) {
      // Add items to cart
      const currentCart = getCart();
      const newCart = [...currentCart, ...data.items];
      saveCart(newCart);
      alert('Товары добавлены в корзину');
      window.location.href = '/cart.html';
    } else {
      alert(data.error || 'Ошибка повторного заказа');
    }
  } catch (err) {
    alert('Ошибка сети');
  }
}

function rateOrder(orderId) {
  // This would open a modal for rating products
  alert('Функция оценки товаров будет добавлена в следующем обновлении');
}

// ===== Filters =====
document.getElementById('apply-filters')?.addEventListener('click', loadMyOrders);
document.getElementById('orders-filter')?.addEventListener('change', loadMyOrders);

// ===== Init =====
updateCartCount();
updateFavCount();
renderCart();
loadSavedAddresses();
loadCartFromServer();
handleStripeReturn();
loadMyOrders();

// Toggle order details + cancel
document.getElementById('my-orders-list')?.addEventListener('click', async (e) => {
  // Resume payment
  const payBtn = e.target.closest('.my-order-pay');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = 'Загрузка...';
    try {
      const r = await fetch(`/api/orders/resume-payment?order_id=${payBtn.dataset.id}&device_id=${encodeURIComponent(getDeviceId())}`);
      const d = await r.json();
      if (d.success && d.checkout_url) {
        window.location.href = d.checkout_url;
        return;
      }
      alert(d.error || 'Ошибка');
    } catch { alert('Ошибка соединения'); }
    payBtn.disabled = false;
    payBtn.textContent = 'Продолжить оплату';
    return;
  }

  // Cancel
  const cancelBtn = e.target.closest('.my-order-cancel');
  if (cancelBtn) {
    if (!await customConfirm('Вы уверены, что хотите отменить заказ?')) return;
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Отмена...';
    try {
      const r = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(cancelBtn.dataset.id), device_id: getDeviceId() })
      });
      const d = await r.json();
      if (d.success) { loadMyOrders(); return; }
      alert(d.error || 'Ошибка');
    } catch { alert('Ошибка соединения'); }
    cancelBtn.disabled = false;
    cancelBtn.textContent = 'Отменить заказ';
    return;
  }

  // Toggle
  const order = e.target.closest('.my-order');
  if (!order || e.target.closest('.my-order-body')) return;
  order.classList.toggle('open');
});

