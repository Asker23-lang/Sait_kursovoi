(function () {
  // ===== Knowledge base =====
  const FAQ = [
    {
      keys: ['доставк', 'привез', 'привест', 'доставит', 'сколько идет', 'когда придет', 'срок'],
      answer: 'Доставка по Казахстану:\n• Алматы и Астана — бесплатно\n• Областные города (Шымкент, Караганда, Актобе) — 1 500 ₸\n• Остальные города — 2 500 ₸\n\nСроки: 1–3 дня по Алматы и Астане, 3–7 дней по регионам.'
    },
    {
      keys: ['оплат', 'платить', 'как платить', 'карт', 'наличн', 'sbp', 'сбп', 'stripe', 'стрипе'],
      answer: 'Доступные способы оплаты:\n• Банковская карта (Visa/Mastercard) через Stripe\n• СБП — оплата через приложение банка\n• Наличными при получении\n\nПосле оформления заказа вы выбираете удобный способ.'
    },
    {
      keys: ['верн', 'обмен', 'не подошл', 'отказ', 'отмен', 'cancel'],
      answer: 'Отменить заказ можно в разделе «Корзина → Мои заказы», пока статус «Новый» или «Ожидает оплаты».\n\nЕсли заказ уже в обработке — напишите нам в поддержку, постараемся помочь.'
    },
    {
      keys: ['размер', 'размер', 's ', 'm ', 'l ', 'xl', 'xxl', 'таблиц', 'маломерит', 'большемерит'],
      answer: 'Большинство наших моделей представлены в размерах S, M, L, XL, XXL.\n\nОверсайз-модели сидят свободно — если сомневаетесь, берите на размер меньше. Базовые модели — стандартная посадка, берите свой обычный размер.'
    },
    {
      keys: ['купон', 'промокод', 'скидк', 'акци', 'промо'],
      answer: 'Применить купон можно в корзине — введите код в поле «Введите код купона» и нажмите «Применить».\n\nСледите за акциями в нашем магазине — купоны появляются регулярно!'
    },
    {
      keys: ['состав', 'матери', 'ткань', 'хлопок', 'полиэстер', 'качеств'],
      answer: 'Мы используем качественные материалы: натуральный хлопок, смесовые и синтетические ткани для верхней одежды.\n\nСостав конкретного изделия указан в описании товара. Если описания нет — напишите нам, уточним.'
    },
    {
      keys: ['стирк', 'уход', 'стират'],
      answer: 'Общие рекомендации по уходу:\n• Стирать при 30–40°C\n• Не отбеливать\n• Деликатный отжим или без отжима\n• Сушить в расправленном виде, не на прямом солнце\n\nПодробности — на ярлыке изделия.'
    },
    {
      keys: ['заказ', 'статус', 'где мой', 'отслед', 'трек'],
      answer: 'Статус своего заказа можно отследить в разделе «Корзина → Мои заказы».\n\nЕсли вы авторизованы — все заказы отображаются в профиле. Для гостей — статус виден по device ID браузера.'
    },
    {
      keys: ['контакт', 'поддержк', 'написать', 'связат', 'телефон', 'email', 'почта', 'менедж'],
      answer: 'Связаться с нами можно по:\n• Email: support@kendrick.kz\n• Телефон: +7 (777) 000-00-00\n• Режим работы: пн–пт, 9:00–18:00 (Алматы)\n\nОтвечаем в течение нескольких часов в рабочее время.'
    },
    {
      keys: ['работ', 'часы', 'режим', 'время', 'выходн'],
      answer: 'Магазин работает круглосуточно — заказы принимаются онлайн 24/7.\n\nСлужба поддержки работает: пн–пт с 9:00 до 18:00 по времени Алматы.'
    },
    {
      keys: ['привет', 'здравств', 'добры', 'хай', 'hi', 'hello', 'салам'],
      answer: 'Привет! 👋 Я помощник магазина KENDRICK. Помогу с выбором одежды, расскажу про доставку, оплату и возвраты.\n\nЧем могу помочь?'
    },
    {
      keys: ['спасибо', 'благодар', 'спс', 'thanks'],
      answer: 'Пожалуйста! Если появятся ещё вопросы — всегда рад помочь. Приятных покупок! 😊'
    },
    {
      keys: ['новинк', 'новый', 'новые', 'поступлен', 'коллекци'],
      answer: 'Новинки и актуальная коллекция всегда на главной странице — отмечены тегом «Новинка».\n\nТакже следите за разделом «Хит» — там самые популярные модели.'
    },
    {
      keys: ['цен', 'дорого', 'дешево', 'стоимост', 'сколько стоит'],
      answer: 'Цены на все товары указаны в каталоге в тенге (₸). Диапазон:\n• Базовые вещи (футболки, лонгсливы) — от 4 990 ₸\n• Верхняя одежда (куртки, бомберы) — от 16 990 ₸\n\nПериодически проводим акции — следите за тегом «Скидка»!'
    },
  ];

  const DEFAULT_ANSWER = 'Не совсем понял вопрос 🙁 Попробуйте переформулировать или напишите нам напрямую:\n\n📧 support@kendrick.kz\n📞 +7 (777) 000-00-00 (пн–пт, 9–18)';

  function getAnswer(text) {
    const lower = text.toLowerCase();
    for (const item of FAQ) {
      if (item.keys.some(k => lower.includes(k))) {
        return item.answer;
      }
    }
    return DEFAULT_ANSWER;
  }

  // ===== Widget HTML =====
  const html = `
    <div id="ai-chat-widget">
      <button id="ai-chat-toggle" aria-label="Открыть чат с помощником" title="Помощник">
        <svg id="ai-icon-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <svg id="ai-icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div id="ai-chat-box" class="hidden">
        <div id="ai-chat-header">
          <div class="ai-header-info">
            <div class="ai-avatar">K</div>
            <div>
              <div class="ai-header-name">KENDRICK Помощник</div>
              <div class="ai-header-status">Онлайн</div>
            </div>
          </div>
          <button id="ai-chat-close-btn" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="ai-chat-messages">
          <div class="ai-msg ai-msg-bot">
            <div class="ai-msg-bubble">Привет! Я помощник магазина KENDRICK 👋\n\nМогу ответить на вопросы про:\n• Доставку и оплату\n• Размеры и состав\n• Заказы и возвраты\n• Акции и купоны\n\nЧем помочь?</div>
          </div>
        </div>

        <div id="ai-chat-footer">
          <textarea id="ai-chat-input" placeholder="Напишите вопрос..." rows="1" maxlength="300"></textarea>
          <button id="ai-chat-send" aria-label="Отправить">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);

  // ===== Logic =====
  let isOpen = false;

  const toggleBtn = document.getElementById('ai-chat-toggle');
  const closeBtn  = document.getElementById('ai-chat-close-btn');
  const chatBox   = document.getElementById('ai-chat-box');
  const messagesEl = document.getElementById('ai-chat-messages');
  const input     = document.getElementById('ai-chat-input');
  const sendBtn   = document.getElementById('ai-chat-send');
  const iconOpen  = document.getElementById('ai-icon-open');
  const iconClose = document.getElementById('ai-icon-close');

  function openChat() {
    isOpen = true;
    chatBox.classList.remove('hidden');
    iconOpen.style.display = 'none';
    iconClose.style.display = '';
    toggleBtn.classList.add('active');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    input.focus();
  }

  function closeChat() {
    isOpen = false;
    chatBox.classList.add('hidden');
    iconOpen.style.display = '';
    iconClose.style.display = 'none';
    toggleBtn.classList.remove('active');
  }

  toggleBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'bot'}`;
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-bot';
    div.innerHTML = '<div class="ai-msg-bubble ai-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    addMessage(text, 'user');
    const typingEl = addTyping();

    // Simulate a short thinking delay
    setTimeout(() => {
      typingEl.remove();
      addMessage(getAnswer(text), 'bot');
      sendBtn.disabled = false;
      input.focus();
    }, 600);
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
})();
