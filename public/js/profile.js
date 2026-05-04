// ===== Profile Page =====

// Check authentication
const USER_TOKEN = localStorage.getItem('user_token');
if (!USER_TOKEN) {
  window.location.href = '/login-user.html';
}

// Load profile data
async function loadProfile() {
  try {
    const res = await userFetch('/api/users/profile');
    const profile = await res.json();

    document.getElementById('profile-info').innerHTML = `
      <div class="profile-field">
        <label>Email:</label>
        <span>${profile.email}</span>
      </div>
      <div class="profile-field">
        <label>Имя:</label>
        <span>${profile.name || 'Не указано'}</span>
      </div>
      <div class="profile-field">
        <label>Телефон:</label>
        <span>${profile.phone || 'Не указано'}</span>
      </div>
      <div class="profile-field">
        <label>Дата регистрации:</label>
        <span>${new Date(profile.created_at).toLocaleDateString('ru-RU')}</span>
      </div>
      <div class="profile-field">
        <label>Последний вход:</label>
        <span>${profile.last_login ? new Date(profile.last_login).toLocaleString('ru-RU') : 'Никогда'}</span>
      </div>
    `;

    // Fill edit form
    document.getElementById('edit-name').value = profile.name || '';
    document.getElementById('edit-phone').value = profile.phone || '';

  } catch (err) {
    document.getElementById('profile-info').innerHTML = '<div class="error">Ошибка загрузки профиля</div>';
    console.error('Profile load error:', err);
  }
}

// Load user orders
async function loadOrders() {
  try {
    const res = await userFetch('/api/users/orders');
    const orders = await res.json();

    if (orders.length === 0) {
      document.getElementById('orders-list').innerHTML = '<p>У вас пока нет заказов</p>';
      return;
    }

    const ordersHtml = orders.map(order => `
      <div class="order-card">
        <div class="order-header">
          <span class="order-number">Заказ #${order.id}</span>
          <span class="order-status status-${order.status}">${order.status}</span>
        </div>
        <div class="order-details">
          <div class="order-info">
            <span>Дата: ${new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
            <span>Товаров: ${order.items_count}</span>
            <span>Сумма: ${order.total} ₸</span>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('orders-list').innerHTML = ordersHtml;

  } catch (err) {
    document.getElementById('orders-list').innerHTML = '<div class="error">Ошибка загрузки заказов</div>';
    console.error('Orders load error:', err);
  }
}

// Edit profile functionality
document.getElementById('edit-profile-btn').addEventListener('click', () => {
  document.getElementById('profile-edit').classList.remove('hidden');
  document.getElementById('edit-profile-btn').style.display = 'none';
});

document.getElementById('cancel-edit').addEventListener('click', () => {
  document.getElementById('profile-edit').classList.add('hidden');
  document.getElementById('edit-profile-btn').style.display = 'block';
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('edit-name').value.trim();
  const phone = document.getElementById('edit-phone').value.trim();

  try {
    const res = await userFetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });

    const updated = await res.json();

    // Update display
    loadProfile();

    // Hide edit form
    document.getElementById('profile-edit').classList.add('hidden');
    document.getElementById('edit-profile-btn').style.display = 'block';

  } catch (err) {
    alert('Ошибка сохранения профиля');
    console.error('Profile update error:', err);
  }
});

// Initialize
loadProfile();
loadOrders();