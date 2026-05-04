// ===== User Authentication =====

// Check if user is logged in
const USER_TOKEN = localStorage.getItem('user_token');

if (USER_TOKEN && window.location.pathname !== '/profile.html') {
  // Verify token on page load
  fetch('/api/users/check', {
    headers: { 'X-User-Token': USER_TOKEN }
  })
  .then(r => r.json())
  .then(data => {
    if (data.authenticated) {
      updateUserUI(data.user);
    } else {
      localStorage.removeItem('user_token');
    }
  })
  .catch(() => {
    localStorage.removeItem('user_token');
  });
}

// Update UI based on user status
function updateUserUI(user) {
  const userMenu = document.getElementById('user-menu');
  const authLinks = document.querySelectorAll('.auth-link');

  if (user) {
    // User is logged in
    if (userMenu) {
      userMenu.innerHTML = `
        <div class="user-menu-dropdown">
          <button class="user-menu-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${user.name || user.email}
          </button>
          <div class="user-menu-content">
            <a href="/profile.html">Профиль</a>
            <a href="/orders.html">Мои заказы</a>
            <a href="#" id="logout-link">Выйти</a>
          </div>
        </div>
      `;

      // Logout handler
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        await userFetch('/api/users/logout', { method: 'POST' });
        localStorage.removeItem('user_token');
        window.location.reload();
      });
    }

    // Hide auth links
    authLinks.forEach(link => link.style.display = 'none');
  } else {
    // User is not logged in
    if (userMenu) {
      userMenu.innerHTML = `
        <a href="/login-user.html" class="auth-link">Войти</a>
        <a href="/register.html" class="auth-link">Регистрация</a>
      `;
    }
  }
}

// Helper: fetch with user token
function userFetch(url, options = {}) {
  const token = localStorage.getItem('user_token');
  if (token) {
    if (options.headers instanceof Headers) {
      options.headers.set('X-User-Token', token);
    } else {
      options.headers = options.headers || {};
      options.headers['X-User-Token'] = token;
    }
  }
  return fetch(url, options);
}

// ===== Registration Form =====
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    const errorDiv = document.getElementById('error-message');

    // Validation
    if (password !== passwordConfirm) {
      errorDiv.textContent = 'Пароли не совпадают';
      errorDiv.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
      errorDiv.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('user_token', data.token);
        window.location.href = '/';
      } else {
        errorDiv.textContent = data.error || 'Ошибка регистрации';
        errorDiv.classList.remove('hidden');
      }
    } catch (err) {
      errorDiv.textContent = 'Ошибка сети';
      errorDiv.classList.remove('hidden');
    }
  });
}

// ===== Login Form =====
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const errorDiv = document.getElementById('error-message');

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('user_token', data.token);
        window.location.href = '/';
      } else {
        errorDiv.textContent = data.error || 'Ошибка входа';
        errorDiv.classList.remove('hidden');
      }
    } catch (err) {
      errorDiv.textContent = 'Ошибка сети';
      errorDiv.classList.remove('hidden');
    }
  });
}

// ===== Favorites functionality =====
async function toggleFavorite(productId) {
  try {
    const res = await userFetch(`/api/users/favorites/${productId}`, {
      method: 'POST'
    });

    const data = await res.json();

    if (data.success) {
      // Update UI
      const favBtn = document.querySelector(`[data-product-id="${productId}"] .fav-btn`);
      if (favBtn) {
        favBtn.classList.toggle('active', data.action === 'added');
      }

      // Update favorites count
      updateFavoritesCount();
    }
  } catch (err) {
    console.error('Favorite toggle error:', err);
  }
}

async function updateFavoritesCount() {
  try {
    const res = await userFetch('/api/users/favorites');
    const favorites = await res.json();
    const count = favorites.length;

    const favCount = document.getElementById('fav-count');
    if (favCount) {
      favCount.textContent = count;
      favCount.classList.toggle('hidden', count === 0);
    }
  } catch (err) {
    console.error('Favorites count error:', err);
  }
}

// Initialize favorites count on page load
if (USER_TOKEN) {
  updateFavoritesCount();
}

// Make functions globally available
window.userFetch = userFetch;
window.toggleFavorite = toggleFavorite;
window.updateUserUI = updateUserUI;