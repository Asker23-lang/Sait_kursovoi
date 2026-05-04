// XSS protection
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== Cart helpers (localStorage) =====
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}
function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = total;
    el.classList.toggle('hidden', total === 0);
  });
}

// ===== Favorites helpers =====
function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}
function updateFavCount() {
  const count = getFavorites().length;
  document.querySelectorAll('#fav-count').forEach(el => {
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  });
}
function toggleFavorite(productId) {
  if (localStorage.getItem('user_token')) {
    return window.userFetch(`/api/users/favorites/${productId}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        const isNowFav = data.action === 'added';
        const el = document.getElementById('fav-count');
        if (el) {
          const current = parseInt(el.textContent) || 0;
          const next = isNowFav ? current + 1 : Math.max(0, current - 1);
          el.textContent = next;
          el.classList.toggle('hidden', next === 0);
        }
        return isNowFav;
      });
  }

  let favs = getFavorites();
  const wasFav = favs.includes(productId);
  if (wasFav) {
    favs = favs.filter(id => id !== productId);
  } else {
    favs.push(productId);
  }
  localStorage.setItem('favorites', JSON.stringify(favs));
  updateFavCount();
  return Promise.resolve(!wasFav);
}

// ===== Format price =====
function formatPrice(price) {
  return price.toLocaleString('ru-RU') + ' ₸';
}

// ===== Render products =====
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  let products;
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error();
    products = await res.json();
  } catch {
    grid.innerHTML = '<p style="text-align:center;padding:2rem;color:#888">Ошибка загрузки товаров</p>';
    return;
  }

  // Get favorites - use API if logged in, otherwise localStorage
  let favs = [];
  if (localStorage.getItem('user_token')) {
    try {
      const res = await window.userFetch('/api/users/favorites');
      const favorites = await res.json();
      favs = favorites.map(f => f.id);
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  } else {
    favs = getFavorites();
  }

  const inStock = products.filter(p => p.in_stock);

  // Update count
  const countEl = document.getElementById('product-count');
  if (countEl) {
    countEl.textContent = inStock.length + ' ' + pluralize(inStock.length, 'товар', 'товара', 'товаров');
  }

  grid.innerHTML = inStock
    .map(product => {
      const isFav = favs.includes(product.id);
      const tagsHtml = product.tags.map(t => {
        let cls = 'tag';
        if (t === 'Новинка') cls += ' tag-new';
        else if (t === 'Скидка') cls += ' tag-sale';
        else if (t === 'Хит') cls += ' tag-hit';
        return `<span class="${cls}">${t}</span>`;
      }).join('');

      const sizesHtml = product.sizes.map(s => `<span class="size-badge">${s}</span>`).join('');

      const imgSrc = product.image || `https://placehold.co/300x400/f0f0f0/999?text=${encodeURIComponent(product.name)}`;
      const stockBadge = (product.stock_quantity != null && product.stock_quantity <= 5)
        ? `<span class="stock-badge">Осталось ${product.stock_quantity} шт.</span>` : '';

      return `
        <div class="product-card" data-id="${product.id}">
          <div class="product-image">
            <img src="${imgSrc}" alt="${esc(product.name)}" loading="lazy">
            ${tagsHtml ? `<div class="product-tags">${tagsHtml}</div>` : ''}
            ${stockBadge}
            <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${product.id}" title="В избранное">
              ${isFav ? '&#9829;' : '&#9825;'}
            </button>
          </div>
          <div class="product-info">
            <h3 class="product-name">${esc(product.name)}</h3>
            ${product.description ? `<p class="product-desc">${esc(product.description)}</p>` : ''}
            <div class="product-sizes">${sizesHtml}</div>
            <div class="product-bottom">
              <span class="product-price">${formatPrice(product.price)}</span>
              <button class="btn btn-cart" data-id="${product.id}" data-name="${esc(product.name)}" data-price="${product.price}" data-sizes='${JSON.stringify(product.sizes)}' data-stock="${product.stock_quantity ?? ''}">
                В корзину
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

  // Event listeners (onclick prevents accumulation on reload)
  grid.onclick = (e) => {
    const favBtn = e.target.closest('.btn-fav');
    if (favBtn) {
      e.preventDefault();
      const id = parseInt(favBtn.dataset.id);
      toggleFavorite(id).then(isNowFav => {
        favBtn.classList.toggle('active', isNowFav);
        favBtn.innerHTML = isNowFav ? '&#9829;' : '&#9825;';
      });
      return;
    }

    const cartBtn = e.target.closest('.btn-cart');
    if (cartBtn) {
      openSizeModal(cartBtn.dataset);
    }
  };
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

// ===== Size selection modal =====
let pendingProduct = null;
let selectedSize = null;

function openSizeModal(data) {
  pendingProduct = {
    product_id: parseInt(data.id),
    product_name: data.name,
    price: parseFloat(data.price),
    sizes: JSON.parse(data.sizes),
    stock_quantity: data.stock !== '' ? parseInt(data.stock) : null,
  };
  selectedSize = null;

  const modal = document.getElementById('size-modal');
  const options = document.getElementById('size-options');
  const confirmBtn = document.getElementById('confirm-add');

  options.innerHTML = pendingProduct.sizes.map(s =>
    `<button type="button" class="size-btn" data-size="${s}">${s}</button>`
  ).join('');

  confirmBtn.disabled = true;
  modal.classList.remove('hidden');

  options.onclick = (e) => {
    const btn = e.target.closest('.size-btn');
    if (!btn) return;
    options.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSize = btn.dataset.size;
    confirmBtn.disabled = false;
  };
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('size-modal').classList.add('hidden');
});

document.getElementById('confirm-add').addEventListener('click', () => {
  if (!pendingProduct || !selectedSize) return;

  const cart = getCart();
  const existing = cart.find(
    i => i.product_id === pendingProduct.product_id && i.size === selectedSize
  );

  if (existing) {
    if (pendingProduct.stock_quantity !== null && existing.quantity >= pendingProduct.stock_quantity) return;
    existing.quantity++;
    existing.stock_quantity = pendingProduct.stock_quantity;
  } else {
    cart.push({
      product_id: pendingProduct.product_id,
      product_name: pendingProduct.product_name,
      price: pendingProduct.price,
      size: selectedSize,
      quantity: 1,
      stock_quantity: pendingProduct.stock_quantity,
    });
  }

  saveCart(cart);
  document.getElementById('size-modal').classList.add('hidden');
  flyToCart();
});

// Close modal on backdrop click
document.getElementById('size-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add('hidden');
  }
});

// ===== Slider =====
async function initSlider() {
  const track = document.getElementById('slider-track');
  if (!track) return;

  let slidesData = [];
  try {
    const res = await fetch('/api/products/slides');
    if (res.ok) slidesData = await res.json();
  } catch { /* use empty */ }

  if (slidesData.length === 0) return;

  track.innerHTML = slidesData.map(s => `
    <div class="slide">
      <img src="${s.image || ''}" alt="${esc(s.title)}">
      <div class="slide-overlay">
        ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
        ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
        ${s.btn_text ? `<a href="${esc(s.btn_link || '#products')}" class="btn-slide">${esc(s.btn_text)}</a>` : ''}
      </div>
    </div>
  `).join('');

  const slides = track.querySelectorAll('.slide');
  const dotsContainer = document.getElementById('slider-dots');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  let current = 0;
  let autoplayTimer;

  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsContainer.querySelectorAll('.slider-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
    resetAutoplay();
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  function resetAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => goTo(current + 1), 5000);
  }

  resetAutoplay();
}

// ===== Fly-to-cart animation =====
function flyToCart() {
  const cartLink = document.querySelector('.cart-link');
  if (!cartLink) return;

  const cartRect = cartLink.getBoundingClientRect();
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight / 2;

  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.style.cssText = `left:${startX}px;top:${startY}px;`;
  document.body.appendChild(dot);

  const endX = cartRect.left + cartRect.width / 2;
  const endY = cartRect.top + cartRect.height / 2;

  // Force reflow to start animation
  dot.getBoundingClientRect();
  dot.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.2)`;
  dot.style.opacity = '0';

  dot.addEventListener('transitionend', () => {
    dot.remove();
    // Bounce the cart icon
    const countEl = document.getElementById('cart-count');
    if (countEl) {
      countEl.classList.add('cart-bounce');
      countEl.addEventListener('animationend', () => countEl.classList.remove('cart-bounce'), { once: true });
    }
    cartLink.classList.add('cart-bounce');
    cartLink.addEventListener('animationend', () => cartLink.classList.remove('cart-bounce'), { once: true });
  });
}

// Init
updateCartCount();
updateFavCount();
loadProducts();
initSlider();

// ===== Product Modal =====
let currentProduct = null;

function openProductModal(productId) {
  const modal = document.getElementById('product-modal');
  const details = document.getElementById('product-details');

  // Find product data
  fetch(`/api/products/${productId}`)
    .then(res => res.json())
    .then(product => {
      currentProduct = product;
      renderProductModal(product);
      modal.classList.remove('hidden');
      loadProductReviews(productId);
    })
    .catch(err => {
      console.error('Error loading product:', err);
      alert('Ошибка загрузки товара');
    });
}

function renderProductModal(product) {
  const details = document.getElementById('product-details');
  const imgSrc = product.image || `https://placehold.co/600x800/f0f0f0/999?text=${encodeURIComponent(product.name)}`;

  // Get favorites state
  let isFav = false;
  if (localStorage.getItem('user_token')) {
    // Check via API
    window.userFetch('/api/users/favorites')
      .then(res => res.json())
      .then(favorites => {
        isFav = favorites.some(f => f.id === product.id);
        updateFavButton(isFav);
      })
      .catch(() => updateFavButton(false));
  } else {
    // Check localStorage
    const favs = getFavorites();
    isFav = favs.includes(product.id);
    updateFavButton(isFav);
  }

  function updateFavButton(fav) {
    const favBtn = details.querySelector('.btn-fav-large');
    if (favBtn) {
      favBtn.classList.toggle('active', fav);
    }
  }

  const tagsHtml = product.tags.map(t => {
    let cls = 'tag';
    if (t === 'Новинка') cls += ' tag-new';
    else if (t === 'Скидка') cls += ' tag-sale';
    else if (t === 'Хит') cls += ' tag-hit';
    return `<span class="${cls}">${t}</span>`;
  }).join('');

  const sizesHtml = product.sizes.map(s => `<button class="size-btn-large" data-size="${s}">${s}</button>`).join('');

  details.innerHTML = `
    <div class="product-details">
      <div>
        <img src="${imgSrc}" alt="${esc(product.name)}" class="product-image-large">
        ${tagsHtml ? `<div class="product-tags" style="margin-top:16px">${tagsHtml}</div>` : ''}
      </div>
      <div class="product-info-large">
        <h2>${esc(product.name)}</h2>
        <div class="product-price-large">${formatPrice(product.price)}</div>
        ${product.description ? `<div class="product-desc-large">${esc(product.description)}</div>` : ''}
        <div class="product-sizes-large">
          <h4>Размеры</h4>
          <div class="size-options-large">${sizesHtml}</div>
        </div>
        <div class="product-actions">
          <button class="btn-add-cart" data-id="${product.id}" data-name="${esc(product.name)}" data-price="${product.price}" data-sizes='${JSON.stringify(product.sizes)}'>
            Добавить в корзину
          </button>
          <button class="btn-fav-large ${isFav ? 'active' : ''}" data-id="${product.id}">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    </div>
    <div class="reviews-section">
      <div class="reviews-header">
        <h3 class="reviews-title">Отзывы</h3>
        <div class="reviews-stats">
          <div class="rating-summary">
            <div class="rating-summary-stars">★★★★★</div>
            <span class="rating-summary-text">4.5</span>
          </div>
          <span class="reviews-count">0 отзывов</span>
          ${localStorage.getItem('user_token') ? '<button class="add-review-btn" onclick="showReviewForm()">Написать отзыв</button>' : ''}
        </div>
      </div>
      <div id="reviews-list"></div>
    </div>
  `;

  // Event listeners for modal
  details.querySelector('.btn-add-cart').onclick = (e) => {
    const btn = e.target;
    openSizeModal(btn.dataset);
  };

  details.querySelector('.btn-fav-large').onclick = (e) => {
    const btn = e.target;
    const id = parseInt(btn.dataset.id);
    toggleFavorite(id).then(isNowFav => {
      btn.classList.toggle('active', isNowFav);
      btn.innerHTML = isNowFav ? '❤️' : '🤍';
    });
  };

  // Size selection
  const sizeBtns = details.querySelectorAll('.size-btn-large');
  sizeBtns.forEach(btn => {
    btn.onclick = () => {
      sizeBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });
}

// ===== Reviews =====
async function loadProductReviews(productId) {
  const container = document.getElementById('reviews-list');

  try {
    const res = await fetch(`/api/users/reviews/${productId}`);
    const { reviews, stats } = await res.json();

    if (reviews.length === 0) {
      container.innerHTML = '<div class="no-reviews">Пока нет отзывов. Будьте первым!</div>';
      return;
    }

    const ratingEl = document.querySelector('.rating-summary-text');
    const countEl = document.querySelector('.reviews-count');
    const starsEl = document.querySelector('.rating-summary-stars');

    if (ratingEl) ratingEl.textContent = stats.average.toFixed(1);
    if (countEl) countEl.textContent = `${stats.total} ${pluralize(stats.total, 'отзыв', 'отзыва', 'отзывов')}`;
    if (starsEl) {
      starsEl.innerHTML = '★'.repeat(Math.floor(stats.average)) + '☆'.repeat(5 - Math.floor(stats.average));
    }

    container.innerHTML = reviews
      .map(review => `
        <div class="review-item">
          <div class="review-header">
            <div class="review-author">${esc(review.user_name)}</div>
            <div class="review-date">${new Date(review.created_at).toLocaleDateString('ru-RU')}</div>
          </div>
          <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
          <div class="review-title">${esc(review.title)}</div>
          <div class="review-text">${esc(review.comment)}</div>
        </div>
      `).join('');
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#888">Ошибка загрузки отзывов</div>';
    console.error('Reviews load error:', err);
  }
}

function showReviewForm() {
  const reviewsList = document.getElementById('reviews-list');
  const formHtml = `
    <div class="review-form">
      <h3>Написать отзыв</h3>
      <form id="review-form">
        <div class="form-group">
          <label>Рейтинг</label>
          <div class="rating-input">
            <span class="rating-star" data-rating="1">★</span>
            <span class="rating-star" data-rating="2">★</span>
            <span class="rating-star" data-rating="3">★</span>
            <span class="rating-star" data-rating="4">★</span>
            <span class="rating-star" data-rating="5">★</span>
          </div>
        </div>
        <div class="form-group">
          <label for="review-title">Заголовок</label>
          <input type="text" id="review-title" required maxlength="100">
        </div>
        <div class="form-group">
          <label for="review-comment">Отзыв</label>
          <textarea id="review-comment" required maxlength="1000" rows="4"></textarea>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn-primary">Отправить</button>
          <button type="button" class="btn" onclick="hideReviewForm()">Отмена</button>
        </div>
      </form>
    </div>
  `;

  reviewsList.insertAdjacentHTML('afterbegin', formHtml);

  // Rating stars interaction
  let selectedRating = 0;
  const stars = document.querySelectorAll('.rating-star');
  stars.forEach((star, index) => {
    star.onclick = () => {
      selectedRating = index + 1;
      stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
    };
  });

  // Form submission
  document.getElementById('review-form').onsubmit = async (e) => {
    e.preventDefault();

    if (selectedRating === 0) {
      alert('Пожалуйста, выберите рейтинг');
      return;
    }

    const title = document.getElementById('review-title').value.trim();
    const comment = document.getElementById('review-comment').value.trim();

    if (!title || !comment) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    try {
      const res = await window.userFetch('/api/users/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: currentProduct.id,
          rating: selectedRating,
          title,
          comment
        })
      });

      if (res.ok) {
        hideReviewForm();
        loadProductReviews(currentProduct.id);
        alert('Отзыв отправлен на модерацию!');
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка отправки отзыва');
      }
    } catch (err) {
      alert('Ошибка сети');
      console.error('Review submit error:', err);
    }
  };
}

function hideReviewForm() {
  const form = document.querySelector('.review-form');
  if (form) form.remove();
}

// ===== Modal close handlers =====
document.getElementById('product-modal-close').onclick = () => {
  document.getElementById('product-modal').classList.add('hidden');
};

document.getElementById('product-modal').onclick = (e) => {
  if (e.target.id === 'product-modal') {
    document.getElementById('product-modal').classList.add('hidden');
  }
};

// Add click handler for product cards to open modal
document.getElementById('products-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (card && !e.target.closest('.btn-fav') && !e.target.closest('.btn-cart')) {
    const productId = parseInt(card.dataset.id);
    openProductModal(productId);
  }
});
