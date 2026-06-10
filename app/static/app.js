const api = "/api/v1";
const authDialog = document.querySelector("#auth-dialog");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubmit = document.querySelector("#auth-submit");
const authMessage = document.querySelector("#auth-message");
const authState = document.querySelector("#auth-state");
const resultList = document.querySelector("#result-list");
const resultSummary = document.querySelector("#result-summary");
const cityFilter = document.querySelector("#city-filter");
const searchPanel = document.querySelector(".search-panel");
const toggleFiltersButton = document.querySelector("#toggle-filters");
const catalogSort = document.querySelector("#catalog-sort");
const concertDetailDialog = document.querySelector("#concert-detail-dialog");
const concertDetailContent = document.querySelector("#concert-detail-content");
const homeConcertGrid = document.querySelector("#home-concert-grid");
const homeRecommendGrid = document.querySelector("#home-recommend-grid");
const homeRecommendationsBadge = document.querySelector("#home-recommendations-badge");
const homeHighlightGrid = document.querySelector("#home-highlight-grid");
const searchForm = document.querySelector("#search-form");
const loadTicketsButton = document.querySelector("#load-tickets");
const externalSearchButton = document.querySelector("#external-search");
const suggestInputs = document.querySelectorAll("[data-suggest-list]");
const cabinetSubtitle = document.querySelector("#cabinet-subtitle");
const cabinetContent = document.querySelector("#cabinet-content");
const logoutButton = document.querySelector("#logout-button");
const heroLoginButton = document.querySelector("#hero-login-button");
const heroSignupButton = document.querySelector("#hero-signup-button");
const topbarLoginButton = document.querySelector("#topbar-login-button");
const topbarSignupButton = document.querySelector("#topbar-signup-button");
const localeButtons = document.querySelectorAll("[data-locale]");
const pageQuery = new URLSearchParams(window.location.search);

let authMode = "login";
let token = localStorage.getItem("waves_token") || "";
let currentUser = null;
let currentLanguage = pageQuery.get("lang") || localStorage.getItem("waves_language") || document.documentElement.lang || "ru";
let featuredConcertsState = [];
let recommendedConcertsState = [];
let externalHighlightsState = [];
let resultState = { mode: "empty", data: [], message: "" };
let catalogState = [];
let checkoutState = { concert: null, quantity: 1, sourceMessage: null };
const toastRegion = document.createElement("div");

toastRegion.className = "toast-region";
toastRegion.setAttribute("aria-live", "polite");
document.body.append(toastRegion);

function createCheckoutDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "auth-dialog checkout-dialog";
  dialog.id = "checkout-dialog";
  dialog.innerHTML = `
    <article class="auth-card checkout-card">
      <button class="close-button" type="button" id="close-checkout" aria-label="Close">x</button>
      <div id="checkout-content"></div>
    </article>
  `;
  document.body.append(dialog);
  return dialog;
}

const checkoutDialog = document.querySelector("#checkout-dialog") || createCheckoutDialog();
const checkoutContent = checkoutDialog?.querySelector("#checkout-content");

if (!["ru", "en"].includes(currentLanguage)) {
  currentLanguage = "ru";
}
localStorage.setItem("waves_language", currentLanguage);

const I18N = {
  ru: {
    "titles.home": "Waves | Афиша концертов",
    "titles.concerts": "Waves | Афиша",
    "titles.cabinet": "Waves | Кабинет",
    "nav.home": "Главная",
    "nav.concerts": "Афиша",
    "nav.cabinet": "Кабинет",
    "nav.about": "О сервисе",
    "auth.login": "войти",
    "auth.login_title": "Вход",
    "auth.login_button": "Войти",
    "auth.register_title": "Регистрация",
    "auth.register_button": "Создать аккаунт",
    "auth.signup": "регистрация",
    "auth.logout": "выйти",
    "auth.email": "Email",
    "auth.password": "Пароль",
    "auth.first_name": "Имя",
    "auth.last_name": "Фамилия",
    "auth.authorized": "авторизован",
    "roles.guest": "гость",
    "roles.registered_user": "пользователь",
    "roles.musician": "музыкант",
    "roles.manager": "менеджер",
    "roles.admin": "администратор",
    "statuses.planned": "запланирован",
    "statuses.completed": "завершен",
    "statuses.cancelled": "отменен",
    "home.kicker": "платформа для поиска концертов",
    "home.hero_title": "Ваш универсальный помощник",
    "home.hero_text": "Waves — это сервис для организации музыкальных туров и планирования концертов.",
    "home.metric_concerts": "ближайших концертов в каталоге",
    "home.metric_sources": "внешних источника афиш",
    "home.metric_roles": "рабочие роли в одном кабинете",
    "home.local_title": "Ближайшие концерты",
    "home.local_text": "Живая витрина событий из каталога Waves. Отсюда можно сразу перейти к покупке.",
    "home.all_concerts": "Смотреть всю афишу",
    "home.loading_local_title": "Загружаем концерты...",
    "home.loading_local_text": "Подтягиваем ближайшие события из базы",
    "home.recommended_title": "Подборка для вас",
    "home.recommended_text": "Рекомендательный микросервис ранжирует концерты по городу, жанру, цене и доступности билетов.",
    "home.loading_recommended_title": "Собираем персональную подборку...",
    "home.loading_recommended_text": "Анализируем афишу, город и доступные билеты",
    "home.recommended_empty": "Пока не удалось собрать персональную подборку.",
    "home.external_title": "Внешние афиши и находки",
    "home.external_text": "Дополняем внутренний каталог подборкой событий из KudaGo и Ticketmaster.",
    "home.loading_external": "Загружаем внешние афиши...",
    "home.notes_search_title": "Поиск",
    "home.notes_search_text": "Подбор концертов по городу, жанру и названию группы. Поля поддерживают ручной ввод и подсказки.",
    "home.notes_tickets_title": "Билеты",
    "home.notes_tickets_text": "Гости и авторизованные пользователи могут покупать билеты через checkout-форму с контактами и оплатой.",
    "home.notes_admin_title": "Администрация",
    "home.notes_admin_text": "Администратор управляет пользователями, ролями и создает группы для менеджеров.",
    "home.feature_search_title": "Поиск концертов",
    "home.feature_search_text": "Найти концерты, посмотреть афиши и перейти к покупке билетов.",
    "home.feature_cabinet_title": "Личный кабинет",
    "home.feature_cabinet_text": "Открыть кабинет пользователя или администратора после входа.",
    "home.external_empty": "Внешние афиши пока не найдены.",
    "concerts.title": "Афиша и поиск концертов",
    "concerts.subtitle": "Ищите концерты по городу, жанру, датам и названию группы.",
    "concerts.filters": "Фильтры",
    "concerts.filters_toggle_show": "Показать фильтры",
    "concerts.filters_toggle_hide": "Скрыть фильтры",
    "concerts.city": "Город",
    "concerts.city_placeholder": "Введите или выберите город",
    "concerts.genre": "Жанр",
    "concerts.genre_placeholder": "Введите или выберите жанр",
    "concerts.artist": "Артист / группа",
    "concerts.artist_placeholder": "Queen, Pyrokinesis...",
    "concerts.from": "С",
    "concerts.to": "По",
    "concerts.search_local": "Искать в базе",
    "concerts.search_external": "Искать во внешних источниках",
    "concerts.results": "Результаты",
    "concerts.sort": "Сортировка",
    "concerts.sort_date": "Сначала ближайшие",
    "concerts.sort_price_low": "Сначала дешевле",
    "concerts.sort_price_high": "Сначала дороже",
    "concerts.sort_tickets": "Больше билетов",
    "concerts.my_tickets": "мои билеты",
    "concerts.summary_start": "Введите город, чтобы начать поиск",
    "cabinet.title": "Личный кабинет Waves",
    "cabinet.subtitle": "Единая рабочая зона для зрителя, музыканта, менеджера и администратора.",
    "cabinet.workspace": "Рабочее пространство",
    "cabinet.login_prompt": "Войдите, чтобы открыть кабинет",
    "cabinet.continue_prompt": "Войдите или зарегистрируйтесь, чтобы продолжить.",
    "common.request_failed": "Сервер не смог выполнить запрос. Проверьте, что PostgreSQL запущен и миграции применены.",
    "common.no_results": "Концерты не найдены",
    "common.no_external_results": "Во внешних источниках ничего не найдено",
    "common.loading_concerts": "Загружаем концерты...",
    "common.loading_external": "Ищем концерты во внешних источниках...",
    "common.loading_tickets": "Загружаем билеты...",
    "common.loading_local_home": "Загружаем ближайшие концерты...",
    "common.loading_external_home": "Загружаем внешние афиши...",
    "common.loading_cabinet": "Загружаем рабочее пространство...",
    "common.open_event": "Открыть событие",
    "common.buy": "Купить",
    "common.buy_ticket": "Купить билет",
    "common.tickets_left": "{count} осталось",
    "common.tickets_total": "{available}/{total} билетов",
    "common.date_tba": "Дата уточняется",
    "common.no_tickets": "У вас пока нет билетов.",
    "common.ticket_purchased": "Билет успешно куплен",
    "common.search_start": "Введите город, чтобы начать поиск концертов",
    "common.search_all": "Искать концерты",
    "common.go_home": "На главную",
    "common.profile": "Профиль",
    "common.save": "Сохранить",
    "common.refresh": "Обновить",
    "common.loading": "Загрузка...",
    "common.validation_failed": "Проверьте заполнение полей и попробуйте снова.",
    "checkout.title": "Оформление билета",
    "checkout.subtitle_guest": "Гость тоже может завершить покупку: укажите контакты и данные оплаты.",
    "checkout.subtitle_user": "Покупка сохранится в вашем кабинете, а данные заказа останутся в истории.",
    "checkout.summary": "Детали заказа",
    "checkout.quantity": "Количество",
    "checkout.total": "Сумма",
    "checkout.customer_name": "Имя и фамилия",
    "checkout.customer_email": "Email для заказа",
    "checkout.customer_phone": "Телефон",
    "checkout.cardholder": "Имя на карте",
    "checkout.card_number": "Номер карты",
    "checkout.card_expiry": "Срок действия",
    "checkout.card_cvc": "CVC / CVV",
    "checkout.privacy": "Для безопасности сохраняются только последние 4 цифры карты. Полный номер и CVC не хранятся.",
    "checkout.submit": "Оплатить и получить билет",
    "checkout.processing": "Проводим оплату...",
    "checkout.success_guest": "Покупка завершена. Сохраните QR-код и email заказа.",
    "checkout.success_user": "Покупка завершена. Билет сохранен в личном кабинете.",
    "checkout.open_cabinet": "Открыть кабинет",
    "checkout.continue": "Продолжить просмотр",
    "checkout.qr": "Код билета",
    "checkout.saved_to_account": "Билет сохранен в аккаунте",
  },
  en: {
    "titles.home": "Waves | Concert Discovery",
    "titles.concerts": "Waves | Concerts",
    "titles.cabinet": "Waves | Cabinet",
    "nav.home": "Home",
    "nav.concerts": "Concerts",
    "nav.cabinet": "Cabinet",
    "nav.about": "About",
    "auth.login": "log in",
    "auth.login_title": "Log in",
    "auth.login_button": "Log in",
    "auth.register_title": "Sign up",
    "auth.register_button": "Create account",
    "auth.signup": "sign up",
    "auth.logout": "log out",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.first_name": "First name",
    "auth.last_name": "Last name",
    "auth.authorized": "authorized",
    "roles.guest": "guest",
    "roles.registered_user": "user",
    "roles.musician": "musician",
    "roles.manager": "manager",
    "roles.admin": "admin",
    "statuses.planned": "planned",
    "statuses.completed": "completed",
    "statuses.cancelled": "cancelled",
    "home.kicker": "concert discovery platform",
    "home.hero_title": "Your live music command center",
    "home.hero_text": "Waves helps audiences, managers, and musicians discover shows, plan tours, and manage tickets in one place.",
    "home.metric_concerts": "upcoming catalog concerts",
    "home.metric_sources": "external poster sources",
    "home.metric_roles": "workspace roles in one account",
    "home.local_title": "Upcoming catalog concerts",
    "home.local_text": "A live storefront of upcoming events from the Waves catalog, ready for purchase.",
    "home.all_concerts": "Browse full lineup",
    "home.loading_local_title": "Loading concerts...",
    "home.loading_local_text": "Fetching the nearest upcoming shows from the database",
    "home.recommended_title": "Recommended for you",
    "home.recommended_text": "The recommendation microservice ranks concerts by city, genre, ticket price, and availability.",
    "home.loading_recommended_title": "Building your shortlist...",
    "home.loading_recommended_text": "Analyzing lineup, city preferences, and ticket stock",
    "home.recommended_empty": "We could not build a personalized shortlist yet.",
    "home.external_title": "External posters and discoveries",
    "home.external_text": "We complement the internal catalog with selections from KudaGo and Ticketmaster.",
    "home.loading_external": "Loading external posters...",
    "home.notes_search_title": "Search",
    "home.notes_search_text": "Find concerts by city, genre, or band name with assisted suggestions and fast filters.",
    "home.notes_tickets_title": "Tickets",
    "home.notes_tickets_text": "Guests and signed-in users can buy tickets through a checkout form with contact and payment details.",
    "home.notes_admin_title": "Administration",
    "home.notes_admin_text": "Admins manage users, roles, and create bands for managers.",
    "home.feature_search_title": "Concert discovery",
    "home.feature_search_text": "Find concerts, preview posters, and move directly to ticket purchase.",
    "home.feature_cabinet_title": "Personal cabinet",
    "home.feature_cabinet_text": "Open a role-based workspace for users, musicians, managers, and admins.",
    "home.external_empty": "No external highlights are available yet.",
    "concerts.title": "Concert discovery and listings",
    "concerts.subtitle": "Search for concerts by city, genre, date range, and band name.",
    "concerts.filters": "Filters",
    "concerts.filters_toggle_show": "Show filters",
    "concerts.filters_toggle_hide": "Hide filters",
    "concerts.city": "City",
    "concerts.city_placeholder": "Enter or choose a city",
    "concerts.genre": "Genre",
    "concerts.genre_placeholder": "Enter or choose a genre",
    "concerts.artist": "Artist / band",
    "concerts.artist_placeholder": "Queen, Pyrokinesis...",
    "concerts.from": "From",
    "concerts.to": "To",
    "concerts.search_local": "Search catalog",
    "concerts.search_external": "Search external sources",
    "concerts.results": "Results",
    "concerts.sort": "Sort by",
    "concerts.sort_date": "Nearest first",
    "concerts.sort_price_low": "Lowest price",
    "concerts.sort_price_high": "Highest price",
    "concerts.sort_tickets": "Most tickets left",
    "concerts.my_tickets": "my tickets",
    "concerts.summary_start": "Enter a city to begin your search",
    "cabinet.title": "Waves personal cabinet",
    "cabinet.subtitle": "A unified workspace for audience members, musicians, managers, and admins.",
    "cabinet.workspace": "Workspace",
    "cabinet.login_prompt": "Log in to open your cabinet",
    "cabinet.continue_prompt": "Log in or sign up to continue.",
    "common.request_failed": "The server could not complete the request. Check that PostgreSQL is running and migrations are applied.",
    "common.no_results": "No concerts found",
    "common.no_external_results": "No events were found in external sources",
    "common.loading_concerts": "Loading concerts...",
    "common.loading_external": "Searching external sources...",
    "common.loading_tickets": "Loading tickets...",
    "common.loading_local_home": "Loading upcoming concerts...",
    "common.loading_external_home": "Loading external posters...",
    "common.loading_cabinet": "Loading workspace...",
    "common.open_event": "Open event",
    "common.buy": "Buy",
    "common.buy_ticket": "Buy ticket",
    "common.tickets_left": "{count} left",
    "common.tickets_total": "{available}/{total} tickets",
    "common.date_tba": "Date TBA",
    "common.no_tickets": "You do not have tickets yet.",
    "common.ticket_purchased": "Ticket purchased successfully",
    "common.search_start": "Enter a city to start searching for concerts",
    "common.search_all": "Search concerts",
    "common.go_home": "Home",
    "common.profile": "Profile",
    "common.save": "Save",
    "common.refresh": "Refresh",
    "common.loading": "Loading...",
    "common.validation_failed": "Check the form fields and try again.",
    "checkout.title": "Ticket checkout",
    "checkout.subtitle_guest": "Guests can complete the purchase too: add contact details and payment information.",
    "checkout.subtitle_user": "The purchase will be saved to your account and stay in your order history.",
    "checkout.summary": "Order summary",
    "checkout.quantity": "Quantity",
    "checkout.total": "Total",
    "checkout.customer_name": "Full name",
    "checkout.customer_email": "Order email",
    "checkout.customer_phone": "Phone",
    "checkout.cardholder": "Name on card",
    "checkout.card_number": "Card number",
    "checkout.card_expiry": "Expiry date",
    "checkout.card_cvc": "CVC / CVV",
    "checkout.privacy": "For safety, only the last 4 digits of the card are stored. The full number and CVC are never saved.",
    "checkout.submit": "Pay and get ticket",
    "checkout.processing": "Processing payment...",
    "checkout.success_guest": "Purchase complete. Save the ticket QR code and order email.",
    "checkout.success_user": "Purchase complete. The ticket has been saved to your account.",
    "checkout.open_cabinet": "Open cabinet",
    "checkout.continue": "Keep browsing",
    "checkout.qr": "Ticket code",
    "checkout.saved_to_account": "Ticket saved to account",
  },
};

function t(key, params = {}) {
  const template = I18N[currentLanguage]?.[key] ?? I18N.ru[key] ?? key;
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replaceAll(`{${paramKey}}`, String(value)),
    template,
  );
}

function pageKey() {
  return document.body.dataset.page || "home";
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t(`titles.${pageKey()}`);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  localeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === currentLanguage);
  });
  if (authTitle && authSubmit) {
    authTitle.textContent = authMode === "register" ? t("auth.register_title") : t("auth.login_title");
    authSubmit.textContent = authMode === "register" ? t("auth.register_button") : t("auth.login_button");
  }
  syncFilterToggleButton();
}

function setMessage(text) {
  if (authMessage) {
    authMessage.textContent = text;
  }
}

function setResultSummary(text = "") {
  if (resultSummary) {
    resultSummary.textContent = text;
  }
}

function setAuthState(label) {
  if (authState) {
    authState.textContent = label || (token ? t("auth.authorized") : t("roles.guest"));
  }
}

function updateUrlParameter(name, value) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(name, value);
  } else {
    url.searchParams.delete(name);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function setElementVisibility(element, isVisible) {
  if (!element) {
    return;
  }
  element.hidden = !isVisible;
  element.style.display = isVisible ? "" : "none";
}

function syncAuthButtons() {
  const buttonSets = [
    [heroLoginButton, heroSignupButton],
    [topbarLoginButton, topbarSignupButton],
  ];

  for (const [loginButton, signupButton] of buttonSets) {
    if (!loginButton || !signupButton) {
      continue;
    }
    if (currentUser) {
      loginButton.textContent = t("nav.cabinet");
      setElementVisibility(signupButton, false);
    } else {
      loginButton.textContent = t("auth.login");
      setElementVisibility(signupButton, true);
      signupButton.textContent = t("auth.signup");
    }
    setElementVisibility(loginButton, true);
  }
  if (logoutButton) {
    logoutButton.textContent = t("auth.logout");
    setElementVisibility(logoutButton, Boolean(currentUser));
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(text, tone = "neutral") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.textContent = text;
  toastRegion.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function setStatusLine(element, text, tone = "neutral") {
  if (!element) {
    return;
  }
  element.textContent = text || "";
  element.dataset.tone = text ? tone : "";
}

function setButtonBusy(button, isBusy, busyLabel = t("common.loading")) {
  if (!button) {
    return;
  }
  if (!button.dataset.idleLabel) {
    button.dataset.idleLabel = button.textContent.trim();
  }
  button.disabled = isBusy;
  button.classList.toggle("is-busy", isBusy);
  button.textContent = isBusy ? busyLabel : button.dataset.idleLabel;
}

function errorMessageFromPayload(data, fallbackMessage) {
  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }
  if (Array.isArray(data?.detail) && data.detail.length) {
    return data.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.msg) {
          return item.msg;
        }
        if (Array.isArray(item?.loc) && item.loc.length > 0) {
          return `${item.loc[item.loc.length - 1]}: ${item.msg || t("common.validation_failed")}`;
        }
        return item?.type || t("common.validation_failed");
      })
      .join("; ");
  }
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  return fallbackMessage;
}

function roleTitle(role) {
  return t(`roles.${role}`);
}

function statusTitle(status) {
  return t(`statuses.${status}`);
}

function openAuth(mode) {
  if (!authDialog || !authForm) {
    return;
  }
  authMode = mode;
  updateUrlParameter("auth", mode);
  authForm.classList.toggle("is-register", mode === "register");
  authTitle.textContent = mode === "register" ? t("auth.register_title") : t("auth.login_title");
  authSubmit.textContent = mode === "register" ? t("auth.register_button") : t("auth.login_button");
  authForm.reset();
  setMessage("");
  if (!authDialog.open) {
    authDialog.showModal();
  }
}

function requestHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      ...requestHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const fallbackMessage =
      response.status >= 500
        ? t("common.request_failed")
        : text || response.statusText || "Request failed";
    if (response.status === 401 && token) {
      token = "";
      currentUser = null;
      localStorage.removeItem("waves_token");
      syncAuthButtons();
      setAuthState(t("roles.guest"));
    }
    throw new Error(errorMessageFromPayload(data, fallbackMessage));
  }
  return data;
}

function normalizeText(value) {
  return value.trim().toLowerCase().replace("ё", "е");
}

function findClosestOption(input) {
  const listId = input.dataset.suggestList;
  const list = document.getElementById(listId);
  const query = normalizeText(input.value);
  if (!list || !query) {
    return "";
  }

  const options = Array.from(list.options).map((option) => option.value);
  return (
    options.find((option) => normalizeText(option) === query) ||
    options.find((option) => normalizeText(option).startsWith(query)) ||
    options.find((option) => normalizeText(option).includes(query)) ||
    ""
  );
}

suggestInputs.forEach((input) => {
  input.addEventListener("blur", () => {
    const closest = findClosestOption(input);
    if (closest) {
      input.value = closest;
    }
  });
});

function formatDate(value) {
  return new Intl.DateTimeFormat(currentLanguage === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrice(value) {
  return new Intl.NumberFormat(currentLanguage === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function recommendationReasonLabel(reason) {
  const labels = {
    same_city: currentLanguage === "ru" ? "ваш город" : "your city",
    genre_match: currentLanguage === "ru" ? "подходит по жанру" : "genre match",
    artist_match: currentLanguage === "ru" ? "любимый артист" : "artist match",
    within_budget: currentLanguage === "ru" ? "в вашем бюджете" : "within budget",
    good_ticket_stock: currentLanguage === "ru" ? "много билетов" : "good availability",
    soon: currentLanguage === "ru" ? "скоро" : "soon",
    catalog_match: currentLanguage === "ru" ? "подходит по афише" : "catalog match",
  };
  return labels[reason] || reason;
}

function preferredCity() {
  return localStorage.getItem("waves_preferred_city") || "";
}

function persistPreferredCity(city) {
  const normalized = String(city || "").trim();
  if (!normalized) {
    return;
  }
  localStorage.setItem("waves_preferred_city", normalized);
  if (homeRecommendationsBadge) {
    homeRecommendationsBadge.textContent = normalized;
  }
}

function priceInputValue(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(0) : "0";
}

function toMinorUnits(value) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
}

function toDateBoundary(value, endOfDay = false) {
  return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
}

function toDateTimeLocalValue(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalValue(value) {
  return value ? new Date(value).toISOString() : null;
}

function defaultCheckoutName() {
  if (!currentUser?.profile) {
    return "";
  }
  return [currentUser.profile.first_name, currentUser.profile.last_name].filter(Boolean).join(" ").trim();
}

function checkoutDialogHtml(concert, quantity) {
  const totalPrice = Number(concert.price || 0) * Number(quantity || 1);
  return `
    <form class="checkout-form" id="checkout-form" method="dialog">
      <div class="checkout-head">
        <div>
          <h2>${escapeHtml(t("checkout.title"))}</h2>
          <p class="panel-subtitle">${escapeHtml(currentUser ? t("checkout.subtitle_user") : t("checkout.subtitle_guest"))}</p>
        </div>
      </div>
      <section class="checkout-summary">
        <strong>${escapeHtml(t("checkout.summary"))}</strong>
        <div class="result-meta">
          <span>${escapeHtml(concert.band_name)}</span>
          <span>${escapeHtml(concert.title)}</span>
          <span>${formatDate(concert.date_time)}</span>
          <span>${escapeHtml(concert.city)}</span>
          <span>${escapeHtml(concert.venue)}</span>
        </div>
        <div class="checkout-summary-grid">
          <div class="cabinet-stat">
            <strong>${quantity}</strong>
            <span>${escapeHtml(t("checkout.quantity"))}</span>
          </div>
          <div class="cabinet-stat">
            <strong>${formatPrice(totalPrice)}</strong>
            <span>${escapeHtml(t("checkout.total"))}</span>
          </div>
        </div>
      </section>
      <input name="concert_id" type="hidden" value="${escapeHtml(concert.id)}" />
      <input name="quantity" type="hidden" value="${quantity}" />
      <div class="checkout-grid">
        <label>
          ${escapeHtml(t("checkout.customer_name"))}
          <input name="customer_name" type="text" value="${escapeHtml(defaultCheckoutName())}" required />
        </label>
        <label>
          ${escapeHtml(t("checkout.customer_email"))}
          <input name="customer_email" type="email" value="${escapeHtml(currentUser?.email || "")}" required />
        </label>
        <label>
          ${escapeHtml(t("checkout.customer_phone"))}
          <input name="customer_phone" type="tel" placeholder="+7 999 123-45-67" required />
        </label>
        <label>
          ${escapeHtml(t("checkout.cardholder"))}
          <input name="payment_cardholder" type="text" value="${escapeHtml(defaultCheckoutName())}" required />
        </label>
        <label class="wide">
          ${escapeHtml(t("checkout.card_number"))}
          <input name="payment_card_number" type="text" inputmode="numeric" autocomplete="cc-number" placeholder="2200 7000 1234 5678" required />
        </label>
        <label>
          ${escapeHtml(t("checkout.card_expiry"))}
          <input name="payment_expiry" type="text" inputmode="numeric" placeholder="MM/YY" required />
        </label>
        <label>
          ${escapeHtml(t("checkout.card_cvc"))}
          <input name="payment_cvc" type="password" inputmode="numeric" autocomplete="cc-csc" placeholder="123" required />
        </label>
      </div>
      <p class="checkout-hint">${escapeHtml(t("checkout.privacy"))}</p>
      <button class="primary-button wide" type="submit" id="checkout-submit">${escapeHtml(t("checkout.submit"))}</button>
      <p class="form-message" id="checkout-status" aria-live="polite"></p>
    </form>
  `;
}

function checkoutSuccessHtml(ticket) {
  return `
    <div class="checkout-success">
      <h2>${escapeHtml(ticket.saved_to_account ? t("checkout.success_user") : t("checkout.success_guest"))}</h2>
      <div class="checkout-summary">
        <div class="result-meta">
          <span>${escapeHtml(ticket.customer_name)}</span>
          <span>${escapeHtml(ticket.customer_email)}</span>
          <span>${escapeHtml(ticket.payment_brand)} •••• ${escapeHtml(ticket.payment_last4)}</span>
          ${ticket.saved_to_account ? `<span>${escapeHtml(t("checkout.saved_to_account"))}</span>` : ""}
        </div>
        <div class="cabinet-stat">
          <strong>${escapeHtml(ticket.qr_code_data)}</strong>
          <span>${escapeHtml(t("checkout.qr"))}</span>
        </div>
      </div>
      <div class="form-actions">
        ${ticket.saved_to_account ? `<a class="primary-button link-button" href="/cabinet">${escapeHtml(t("checkout.open_cabinet"))}</a>` : ""}
        <button class="ghost-button" type="button" id="checkout-continue">${escapeHtml(t("checkout.continue"))}</button>
      </div>
    </div>
  `;
}

async function openCheckout(concertId, quantity, sourceMessage = null) {
  if (!checkoutDialog || !checkoutContent) {
    return;
  }
  if (concertDetailDialog?.open) {
    concertDetailDialog.close();
  }
  checkoutState = { concert: null, quantity, sourceMessage };
  checkoutContent.innerHTML = stateCardHtml(currentLanguage === "ru" ? "Подготавливаем checkout..." : "Preparing checkout...", "loading");
  if (!checkoutDialog.open) {
    checkoutDialog.showModal();
  }
  try {
    const concert = await request(`/concerts/${concertId}`, { headers: {} });
    checkoutState = { concert, quantity, sourceMessage };
    checkoutContent.innerHTML = checkoutDialogHtml(concert, quantity);
  } catch (error) {
    checkoutContent.innerHTML = stateCardHtml(error.message, "error");
  }
}

function stateCardHtml(text, tone = "neutral") {
  const labels = {
    loading: currentLanguage === "ru" ? "Загрузка" : "Loading",
    success: currentLanguage === "ru" ? "Готово" : "Done",
    error: currentLanguage === "ru" ? "Ошибка" : "Error",
    empty: currentLanguage === "ru" ? "Пока пусто" : "Nothing here yet",
    neutral: currentLanguage === "ru" ? "Состояние" : "Status",
  };

  return `
    <div class="result-card no-poster state-card state-card--${tone}">
      <div class="result-card-body">
        <span class="state-card-label">${escapeHtml(labels[tone] || labels.neutral)}</span>
        <strong>${escapeHtml(text)}</strong>
      </div>
    </div>
  `;
}

function renderEmpty(text) {
  if (resultList) {
    resultState = { mode: "empty", data: [], message: text };
    resultList.classList.remove("result-list--lineup");
    resultList.innerHTML = stateCardHtml(text, "empty");
  }
  if (catalogSort) {
    catalogSort.disabled = false;
  }
}

function renderHomeConcertsPlaceholder(text) {
  if (homeConcertGrid) {
    homeConcertGrid.innerHTML = stateCardHtml(text, "loading");
  }
}

function renderHomeRecommendationsPlaceholder(text) {
  if (homeRecommendGrid) {
    homeRecommendGrid.innerHTML = stateCardHtml(text, "loading");
  }
}

function syncFilterToggleButton() {
  if (!toggleFiltersButton || !searchPanel) {
    return;
  }
  toggleFiltersButton.textContent = searchPanel.classList.contains("is-collapsed")
    ? t("concerts.filters_toggle_show")
    : t("concerts.filters_toggle_hide");
}

function renderCabinetMessage(text, tone = "error") {
  if (cabinetContent) {
    cabinetContent.innerHTML = stateCardHtml(text, tone);
  }
}

function buildConcertPayload(formData) {
  return {
    title: formData.get("title"),
    venue: formData.get("venue"),
    city: formData.get("city"),
    date_time: fromDateTimeLocalValue(formData.get("date_time")),
    tickets_total: Number(formData.get("tickets_total")),
    tickets_available: Number(formData.get("tickets_available")),
    price: toMinorUnits(formData.get("price")),
    description: String(formData.get("description") || ""),
    poster_url: String(formData.get("poster_url") || ""),
    external_url: String(formData.get("external_url") || ""),
    status: formData.get("status"),
  };
}

function validateConcertPayload(payload) {
  if (!payload.date_time) {
    return currentLanguage === "ru" ? "Укажите дату и время концерта." : "Please provide a concert date and time.";
  }
  if (payload.tickets_available > payload.tickets_total) {
    return currentLanguage === "ru"
      ? "Доступных билетов не может быть больше общего количества."
      : "Available tickets cannot exceed the total ticket count.";
  }
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    return currentLanguage === "ru" ? "Укажите корректную цену билета." : "Provide a valid ticket price.";
  }
  if (payload.status === "planned" && new Date(payload.date_time).getTime() <= Date.now()) {
    return currentLanguage === "ru"
      ? "Запланированный концерт должен быть назначен на будущее время."
      : "A planned concert must be scheduled in the future.";
  }
  return "";
}

function userDisplayName(user) {
  const name = [user.profile?.first_name, user.profile?.last_name].filter(Boolean).join(" ").trim();
  return name || user.email;
}

function summarizeTickets(tickets) {
  const now = Date.now();
  const totalOrders = tickets.length;
  const totalTickets = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  const upcomingTickets = tickets.filter((ticket) => new Date(ticket.concert.date_time).getTime() > now);
  const nextConcert = upcomingTickets
    .slice()
    .sort((left, right) => new Date(left.concert.date_time) - new Date(right.concert.date_time))[0];

  return {
    totalOrders,
    totalTickets,
    upcomingEvents: upcomingTickets.length,
    nextConcert,
  };
}

function summarizeManagedWorkspace(bands, concerts, statsByBand) {
  const bandCount = bands.length;
  const activeConcerts = concerts.filter(
    (concert) => concert.status === "planned" && new Date(concert.date_time).getTime() > Date.now(),
  );
  const projectedRevenue = Object.values(statsByBand).reduce((sum, stats) => sum + (stats?.revenue || 0), 0);
  const soldTickets = Object.values(statsByBand).reduce((sum, stats) => sum + (stats?.future_tickets_sold || 0), 0);
  const cityCount = new Set(activeConcerts.map((concert) => concert.city)).size;

  return {
    bandCount,
    activeConcerts: activeConcerts.length,
    projectedRevenue,
    soldTickets,
    cityCount,
  };
}

function featureListHtml(items) {
  return `
    <div class="tag-list">
      ${items.map((item) => `<span class="tag-chip">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function cabinetCard({ title, subtitle = "", body = "", wide = false, featured = false, span = "" }) {
  return `
    <section class="cabinet-card${wide ? " cabinet-card--wide" : ""}${featured ? " cabinet-card--featured" : ""}${span ? ` cabinet-card--span-${span}` : ""}">
      <div class="cabinet-card-head">
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<p class="panel-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${body}
    </section>
  `;
}

function profileMetaHtml(user) {
  return `
    <div class="result-meta">
      <span>${escapeHtml(userDisplayName(user))}</span>
      <span>${escapeHtml(user.email)}</span>
      <span>${roleTitle(user.role)}</span>
    </div>
  `;
}

function managerSummaryCard(summary) {
  return cabinetCard({
    title: currentLanguage === "ru" ? "Панель менеджера" : "Manager overview",
    subtitle:
      currentLanguage === "ru"
        ? "Быстрый срез по группам, концертам и ожидаемой выручке без переходов между блоками."
        : "A fast snapshot of bands, concerts, and projected revenue without jumping between sections.",
    featured: true,
    body: `
      <div class="cabinet-stats">
        <div class="cabinet-stat">
          <strong>${summary.bandCount}</strong>
          <span>${currentLanguage === "ru" ? "групп в работе" : "bands managed"}</span>
        </div>
        <div class="cabinet-stat">
          <strong>${summary.activeConcerts}</strong>
          <span>${currentLanguage === "ru" ? "активных концертов" : "active concerts"}</span>
        </div>
        <div class="cabinet-stat">
          <strong>${summary.cityCount}</strong>
          <span>${currentLanguage === "ru" ? "городов в афише" : "cities on the schedule"}</span>
        </div>
        <div class="cabinet-stat">
          <strong>${summary.soldTickets}</strong>
          <span>${currentLanguage === "ru" ? "билетов уже занято" : "tickets already committed"}</span>
        </div>
        <div class="cabinet-stat">
          <strong>${formatPrice(summary.projectedRevenue)}</strong>
          <span>${currentLanguage === "ru" ? "ожидаемая выручка" : "projected revenue"}</span>
        </div>
        <div class="cabinet-stat">
          <strong>${currentLanguage === "ru" ? "1 экран" : "1 workspace"}</strong>
          <span>${currentLanguage === "ru" ? "всё ключевое под рукой" : "your core operations in one view"}</span>
        </div>
      </div>
    `,
  });
}

function musicianFullName(musician) {
  return [musician.first_name, musician.last_name].filter(Boolean).join(" ").trim() || roleTitle("musician");
}

function candidateLabel(candidate) {
  const fullName = [candidate.profile?.first_name, candidate.profile?.last_name].filter(Boolean).join(" ").trim();
  return fullName ? `${fullName} · ${candidate.email}` : candidate.email;
}

function rosterMarkup(musicians, options = {}) {
  const { editable = false, bandId = "", candidates = [] } = options;
  if (!musicians.length) {
    return `
      <div class="result-meta"><span>${escapeHtml(currentLanguage === "ru" ? "Состав пока не добавлен." : "No roster assigned yet.")}</span></div>
      ${editable ? rosterManagementFormMarkup(bandId, candidates) : ""}
    `;
  }

  return `
    <div class="tag-list">
      ${musicians
        .map((musician) => {
          const fullName = musicianFullName(musician);
          if (!editable) {
            return `<span class="tag-chip">${escapeHtml(fullName)}</span>`;
          }
          return `
            <span class="tag-chip tag-chip--interactive">
              <span>${escapeHtml(fullName)}</span>
              <button
                class="tag-chip-action roster-remove"
                type="button"
                data-band-id="${bandId}"
                data-user-id="${musician.id}"
                aria-label="${escapeHtml(currentLanguage === "ru" ? `Убрать ${fullName}` : `Remove ${fullName}`)}"
              >
                x
              </button>
            </span>
          `;
        })
        .join("")}
    </div>
    ${editable ? rosterManagementFormMarkup(bandId, candidates) : ""}
  `;
}

function rosterManagementFormMarkup(bandId, candidates) {
  const options = candidates
    .map((candidate) => `<option value="${candidate.id}">${escapeHtml(candidateLabel(candidate))}</option>`)
    .join("");
  const emptyMessage =
    currentLanguage === "ru"
      ? "Свободных пользователей для добавления пока нет."
      : "No available users can be added right now.";

  return `
    <form class="roster-management-form" data-band-id="${bandId}">
      <label class="wide">
        ${escapeHtml(currentLanguage === "ru" ? "Добавить музыканта" : "Add musician")}
        <select name="user_id" ${candidates.length ? "" : "disabled"}>
          <option value="">${escapeHtml(currentLanguage === "ru" ? "Выберите пользователя" : "Choose a user")}</option>
          ${options}
        </select>
      </label>
      <button class="ghost-button" type="submit" ${candidates.length ? "" : "disabled"}>
        ${escapeHtml(currentLanguage === "ru" ? "Добавить в группу" : "Add to band")}
      </button>
      <p class="status-line wide">${candidates.length ? "" : escapeHtml(emptyMessage)}</p>
    </form>
    <form class="roster-email-form" data-band-id="${bandId}">
      <label class="wide">
        ${escapeHtml(currentLanguage === "ru" ? "Найти музыканта по email" : "Find musician by email")}
        <input name="email" type="email" placeholder="musician@example.com" required />
      </label>
      <button class="ghost-button" type="submit">
        ${escapeHtml(currentLanguage === "ru" ? "Добавить по email" : "Add by email")}
      </button>
      <p class="status-line wide"></p>
    </form>
  `;
}

function bandManagementCardHtml(band, stats, roster, candidates) {
  return `
    <article class="result-card no-poster band-management-card">
      <div class="result-card-body">
        <div class="band-management-head">
          <div>
            <strong>${escapeHtml(band.name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(band.genre)}</span>
              <span>${escapeHtml(band.city || (currentLanguage === "ru" ? "город не указан" : "city not specified"))}</span>
              ${
                stats
                  ? `<span>${stats.future_tickets_sold} ${escapeHtml(currentLanguage === "ru" ? "продано" : "sold")}</span><span>${formatPrice(stats.revenue)} ${escapeHtml(currentLanguage === "ru" ? "выручка" : "revenue")}</span>`
                  : ""
              }
            </div>
          </div>
        </div>
        <form class="cabinet-form band-profile-form" data-band-id="${band.id}">
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Название группы" : "Band name")}
            <input name="name" type="text" value="${escapeHtml(band.name)}" required />
          </label>
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Жанр" : "Genre")}
            <input name="genre" type="text" value="${escapeHtml(band.genre)}" required />
          </label>
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Базовый город" : "Home city")}
            <input name="city" type="text" value="${escapeHtml(band.city || "")}" placeholder="${escapeHtml(currentLanguage === "ru" ? "Москва" : "Moscow")}" />
          </label>
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Обложка / постер" : "Cover / poster URL")}
            <input name="cover_url" type="url" value="${escapeHtml(band.cover_url || "")}" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Сайт группы" : "Band website")}
            <input name="website_url" type="url" value="${escapeHtml(band.website_url || "")}" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(currentLanguage === "ru" ? "Instagram / соцсеть" : "Instagram / social link")}
            <input name="instagram_url" type="url" value="${escapeHtml(band.instagram_url || "")}" placeholder="https://..." />
          </label>
          <label class="wide">
            ${escapeHtml(currentLanguage === "ru" ? "Описание группы" : "Band description")}
            <textarea name="description" rows="4" placeholder="${escapeHtml(currentLanguage === "ru" ? "Расскажите о группе, составе, стиле и медиа-ссылках" : "Describe the band, lineup, style, and media links")}">${escapeHtml(band.description || "")}</textarea>
          </label>
          <div class="wide form-actions">
            <button class="primary-button" type="submit">${escapeHtml(currentLanguage === "ru" ? "Сохранить профиль группы" : "Save band profile")}</button>
            <p class="status-line band-profile-status"></p>
          </div>
        </form>
      </div>
    </article>
  `;
}

function bandCardsHtml(bands, rostersByBand, options = {}) {
  const { statsByBand = {}, editable = false, candidatesByBand = {} } = options;
  if (!bands.length) {
    return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(currentLanguage === "ru" ? "Пока нет групп." : "No bands yet.")}</span></div>`;
  }

  return bands
    .map((band) => {
      const roster = rostersByBand[band.id] || [];
      const stats = statsByBand[band.id];
      const candidates = candidatesByBand[band.id] || [];
      if (editable) {
        return bandManagementCardHtml(band, stats, roster, candidates);
      }
      return `
        <article class="result-card no-poster">
          <div class="result-card-body">
            <strong>${escapeHtml(band.name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(band.genre)}</span>
              ${
                stats
                  ? `<span>${stats.future_tickets_sold} ${escapeHtml(currentLanguage === "ru" ? "продано" : "sold")}</span><span>${formatPrice(stats.revenue)} ${escapeHtml(currentLanguage === "ru" ? "ожидаемая выручка" : "projected revenue")}</span>`
                  : ""
              }
            </div>
            ${rosterMarkup(roster, { editable: false, bandId: band.id, candidates })}
          </div>
        </article>
      `;
    })
    .join("");
}

function scheduleConcertsHtml(concerts) {
  if (!concerts.length) {
    return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(currentLanguage === "ru" ? "Ближайших концертов пока нет." : "No upcoming concerts yet.")}</span></div>`;
  }

  return concerts
    .map(
      (concert) => `
        <article class="result-card no-poster">
          <div class="result-card-body">
            <strong>${escapeHtml(concert.band_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(concert.title)}</span>
              <span>${escapeHtml(concert.city)}</span>
              <span>${escapeHtml(concert.venue)}</span>
              <span>${formatDate(concert.date_time)}</span>
              <span>${t("common.tickets_total", { available: concert.tickets_available, total: concert.tickets_total })}</span>
              <span>${statusTitle(concert.status)}</span>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function managedConcertsHtml(concerts) {
  if (!concerts.length) {
    return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(currentLanguage === "ru" ? "Вы еще не создали концерты." : "You have not created concerts yet.")}</span></div>`;
  }

  const now = Date.now();
  const groups = [
    {
      key: "planned",
      title: currentLanguage === "ru" ? "Запланированные" : "Planned",
      items: concerts.filter((concert) => concert.status === "planned" && new Date(concert.date_time).getTime() > now),
    },
    {
      key: "completed",
      title: currentLanguage === "ru" ? "Прошедшие" : "Past",
      items: concerts.filter((concert) => concert.status === "completed" || (concert.status === "planned" && new Date(concert.date_time).getTime() <= now)),
    },
    {
      key: "cancelled",
      title: currentLanguage === "ru" ? "Отмененные" : "Cancelled",
      items: concerts.filter((concert) => concert.status === "cancelled"),
    },
  ];

  const concertFormHtml = (concert) => `
        <article class="result-card no-poster">
          <form class="cabinet-form manager-concert-edit-form" data-concert-id="${concert.id}">
            <div class="wide">
              <strong>${escapeHtml(concert.band_name)}</strong>
              <div class="result-meta">
                <span>${statusTitle(concert.status)}</span>
                <span>${t("common.tickets_total", { available: concert.tickets_available, total: concert.tickets_total })}</span>
              </div>
            </div>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Название" : "Title")}
              <input name="title" type="text" value="${escapeHtml(concert.title)}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Площадка" : "Venue")}
              <input name="venue" type="text" value="${escapeHtml(concert.venue)}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Город" : "City")}
              <input name="city" type="text" value="${escapeHtml(concert.city)}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Дата и время" : "Date and time")}
              <input name="date_time" type="datetime-local" value="${toDateTimeLocalValue(concert.date_time)}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Всего билетов" : "Total tickets")}
              <input name="tickets_total" type="number" min="1" value="${concert.tickets_total}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Доступно сейчас" : "Available now")}
              <input name="tickets_available" type="number" min="0" value="${concert.tickets_available}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Цена билета, ₽" : "Ticket price, RUB")}
              <input name="price" type="number" min="0" step="0.01" value="${priceInputValue(concert.price)}" required />
            </label>
            <label>
              ${escapeHtml(currentLanguage === "ru" ? "Статус" : "Status")}
              <select name="status">
                ${["planned", "completed", "cancelled"]
                  .map((status) => `<option value="${status}" ${concert.status === status ? "selected" : ""}>${statusTitle(status)}</option>`)
                  .join("")}
              </select>
            </label>
            <div class="wide form-actions">
              <button class="primary-button" type="submit">${t("common.save")}</button>
              <button class="ghost-button cancel-managed-concert" type="button" data-concert-id="${concert.id}">${escapeHtml(currentLanguage === "ru" ? "Отменить концерт" : "Cancel concert")}</button>
            </div>
            <p class="status-line wide"></p>
          </form>
        </article>
      `;

  return groups
    .map(
      (group) => `
        <section class="status-group status-group--${group.key}">
          <div class="status-group-head">
            <h4>${escapeHtml(group.title)}</h4>
            <span>${group.items.length}</span>
          </div>
          <div class="ticket-list">
            ${
              group.items.length
                ? group.items.map(concertFormHtml).join("")
                : `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(currentLanguage === "ru" ? "В этой группе пока нет концертов." : "No concerts in this group yet.")}</span></div>`
            }
          </div>
        </section>
      `,
    )
    .join("");
}

function concertCardHtml(concert, options = {}) {
  const buyLabel = options.buyLabel || t("common.buy");
  const posterUrl = concert.poster_url || "/static/assets/poster-lowve.svg";
  const showPoster = options.showPoster !== false;

  return `
    <article class="result-card${showPoster ? "" : " no-poster"}">
      ${showPoster ? `<img class="result-poster" src="${posterUrl}" alt="" />` : ""}
      <div class="result-card-body">
        <strong>${escapeHtml(concert.band_name)}</strong>
        <div class="result-meta">
          <span>${escapeHtml(concert.title)}</span>
          <span>${escapeHtml(concert.city)}</span>
          <span>${escapeHtml(concert.venue)}</span>
          <span>${formatDate(concert.date_time)}</span>
          <span>${formatPrice(concert.price)}</span>
          <span>${t("common.tickets_left", { count: concert.tickets_available })}</span>
        </div>
        <div class="concert-card-actions">
          <input type="number" min="1" max="10" value="1" aria-label="${escapeHtml(currentLanguage === "ru" ? "Количество билетов" : "Ticket quantity")}" />
          <button class="ghost-button concert-details" type="button" data-concert-id="${concert.id}">${escapeHtml(currentLanguage === "ru" ? "Подробнее" : "Details")}</button>
          <button class="primary-button buy-ticket" type="button" data-concert-id="${concert.id}">${escapeHtml(buyLabel)}</button>
        </div>
        <span class="status-line card-message"></span>
      </div>
    </article>
  `;
}

function recommendedConcertCardHtml(concert) {
  const posterUrl = concert.poster_url || "/static/assets/poster-lowve.svg";
  const reasonChips = (concert.reasons || [])
    .slice(0, 3)
    .map((reason) => `<span class="recommendation-chip">${escapeHtml(recommendationReasonLabel(reason))}</span>`)
    .join("");

  return `
    <article class="result-card">
      <img class="result-poster" src="${posterUrl}" alt="" />
      <div class="result-card-body">
        <strong>${escapeHtml(concert.band_name)}</strong>
        <div class="result-meta">
          <span>${escapeHtml(concert.title)}</span>
          <span>${escapeHtml(concert.city)}</span>
          <span>${escapeHtml(concert.venue)}</span>
          <span>${formatDate(concert.date_time)}</span>
          <span>${formatPrice(concert.price)}</span>
          <span>${t("common.tickets_left", { count: concert.tickets_available })}</span>
        </div>
        <div class="recommendation-summary">
          <span class="recommendation-score">${escapeHtml(currentLanguage === "ru" ? "Рейтинг" : "Score")} ${Number(concert.score || 0).toFixed(1)}</span>
          ${reasonChips}
        </div>
        <div class="concert-card-actions">
          <input type="number" min="1" max="10" value="1" aria-label="${escapeHtml(currentLanguage === "ru" ? "Количество билетов" : "Ticket quantity")}" />
          <button class="ghost-button concert-details" type="button" data-concert-id="${concert.id}">${escapeHtml(currentLanguage === "ru" ? "Подробнее" : "Details")}</button>
          <button class="primary-button buy-ticket" type="button" data-concert-id="${concert.id}">${escapeHtml(t("common.buy_ticket"))}</button>
        </div>
        <span class="status-line card-message"></span>
      </div>
    </article>
  `;
}

function formatLineupDateParts(value) {
  const date = new Date(value);
  const locale = currentLanguage === "ru" ? "ru-RU" : "en-US";
  return {
    month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "").toUpperCase(),
    day: new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", "").toUpperCase(),
  };
}

function lineupConcertCardHtml(concert) {
  const posterUrl = concert.poster_url || "/static/assets/poster-lowve.svg";
  const dateBadge = formatLineupDateParts(concert.date_time);

  return `
    <article class="lineup-card">
      <img class="lineup-card-poster" src="${posterUrl}" alt="" />
      <div class="lineup-card-surface">
        <div class="lineup-card-top">
          <div class="lineup-date-badge" aria-hidden="true">
            <span>${escapeHtml(dateBadge.month)}</span>
            <strong>${escapeHtml(dateBadge.day)}</strong>
            <span>${escapeHtml(dateBadge.weekday)}</span>
          </div>
          <div class="lineup-card-chips">
            <span class="lineup-city-chip">${escapeHtml(concert.city)}</span>
            <span class="lineup-city-chip lineup-city-chip--muted">${escapeHtml(currentLanguage === "ru" ? "концерт" : "concert")}</span>
          </div>
        </div>
        <div class="lineup-card-bottom">
          <div class="lineup-card-copy">
            <strong>${escapeHtml(concert.band_name)}</strong>
            <p>${escapeHtml(concert.title)}</p>
            <div class="lineup-meta">
              <span>${escapeHtml(concert.venue)}</span>
              <span>${formatDate(concert.date_time)}</span>
              <span>${formatPrice(concert.price)}</span>
              <span>${t("common.tickets_left", { count: concert.tickets_available })}</span>
            </div>
          </div>
          <div class="lineup-actions">
            <input type="number" min="1" max="10" value="1" aria-label="${escapeHtml(currentLanguage === "ru" ? "Количество билетов" : "Ticket quantity")}" />
            <div class="lineup-action-stack">
              <button class="ghost-button concert-details" type="button" data-concert-id="${concert.id}">${escapeHtml(currentLanguage === "ru" ? "Подробнее" : "Details")}</button>
              <button class="primary-button buy-ticket" type="button" data-concert-id="${concert.id}">${escapeHtml(t("common.buy_ticket"))}</button>
            </div>
          </div>
          <span class="status-line card-message"></span>
        </div>
      </div>
    </article>
  `;
}

function lineupExternalCardHtml(concert) {
  const posterUrl = concert.poster_url || "/static/assets/poster-pyro.svg";
  const dateBadge = concert.date_time ? formatLineupDateParts(concert.date_time) : null;

  return `
    <article class="lineup-card lineup-card--external">
      <img class="lineup-card-poster" src="${posterUrl}" alt="" />
      <div class="lineup-card-surface">
        <div class="lineup-card-top">
          ${
            dateBadge
              ? `
                <div class="lineup-date-badge" aria-hidden="true">
                  <span>${escapeHtml(dateBadge.month)}</span>
                  <strong>${escapeHtml(dateBadge.day)}</strong>
                  <span>${escapeHtml(dateBadge.weekday)}</span>
                </div>
              `
              : `<div class="lineup-date-badge lineup-date-badge--placeholder"><span>TBA</span></div>`
          }
          <div class="lineup-card-chips">
            <span class="lineup-city-chip">${escapeHtml(concert.city)}</span>
            <span class="lineup-city-chip lineup-city-chip--muted">${escapeHtml(concert.source)}</span>
          </div>
        </div>
        <div class="lineup-card-bottom">
          <div class="lineup-card-copy">
            <strong>${escapeHtml(concert.artist_name)}</strong>
            <p>${escapeHtml(concert.title)}</p>
            <div class="lineup-meta">
              <span>${escapeHtml(concert.venue)}</span>
              <span>${concert.date_time ? formatDate(concert.date_time) : t("common.date_tba")}</span>
            </div>
          </div>
          <div class="lineup-action-stack lineup-action-stack--single">
            <a class="primary-button external-link" href="${concert.source_url}" target="_blank" rel="noreferrer">${t("common.open_event")}</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

function sortConcertCatalog(concerts) {
  const mode = catalogSort?.value || "date-asc";
  return concerts.slice().sort((left, right) => {
    if (mode === "price-asc") {
      return left.price - right.price || new Date(left.date_time) - new Date(right.date_time);
    }
    if (mode === "price-desc") {
      return right.price - left.price || new Date(left.date_time) - new Date(right.date_time);
    }
    if (mode === "tickets-desc") {
      return right.tickets_available - left.tickets_available || new Date(left.date_time) - new Date(right.date_time);
    }
    return new Date(left.date_time) - new Date(right.date_time);
  });
}

function renderConcerts(concerts) {
  if (!resultList) {
    return;
  }
  if (!concerts.length) {
    setResultSummary(currentLanguage === "ru" ? "По вашим фильтрам ничего не найдено." : "No concerts matched your filters.");
    renderEmpty(t("common.no_results"));
    return;
  }

  resultState = { mode: "local", data: concerts, message: "" };
  resultList.classList.add("result-list--lineup");
  if (catalogSort) {
    catalogSort.disabled = false;
  }
  setResultSummary(
    currentLanguage === "ru"
      ? `Найдено концертов: ${concerts.length}`
      : `Concerts found: ${concerts.length}`,
  );
  resultList.innerHTML = sortConcertCatalog(concerts).map((concert) => lineupConcertCardHtml(concert)).join("");
}

function renderCityFilters(cities) {
  if (!cityFilter) {
    return;
  }
  const allLabel = currentLanguage === "ru" ? "Все города" : "All cities";
  cityFilter.innerHTML = `
    <button class="city-filter-button is-active" type="button" data-city="">${escapeHtml(allLabel)}</button>
    ${cities
      .map((city) => `<button class="city-filter-button" type="button" data-city="${escapeHtml(city)}">${escapeHtml(city)}</button>`)
      .join("")}
  `;
}

async function loadConcertCatalog(city = "") {
  if (!resultList || pageKey() !== "concerts") {
    return;
  }
  const params = new URLSearchParams({ limit: "60" });
  if (city) {
    params.set("city", city);
  }
  setResultSummary(city ? `${currentLanguage === "ru" ? "Афиша города" : "City lineup"}: ${city}` : currentLanguage === "ru" ? "Загружаем ближайшую афишу..." : "Loading upcoming lineup...");
  renderEmpty(currentLanguage === "ru" ? "Загружаем концерты из каталога..." : "Loading catalog concerts...");
  const concerts = await request(`/concerts/catalog?${params.toString()}`, { headers: {} });
  catalogState = concerts;
  renderConcerts(concerts);
  setResultSummary(
    city
      ? `${currentLanguage === "ru" ? "Концертов в городе" : "Concerts in city"}: ${concerts.length}`
      : `${currentLanguage === "ru" ? "Ближайших концертов в афише" : "Upcoming concerts in lineup"}: ${concerts.length}`,
  );
}

function concertDetailHtml(concert) {
  return `
    <div class="concert-detail">
      <img class="concert-detail-poster" src="${concert.poster_url || "/static/assets/poster-lowve.svg"}" alt="" />
      <div class="concert-detail-copy">
        <span class="state-card-label">${escapeHtml(statusTitle(concert.status))}</span>
        <h2>${escapeHtml(concert.band_name)}</h2>
        <p>${escapeHtml(concert.description || concert.title)}</p>
        <div class="concert-detail-list">
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Концерт" : "Concert")}:</strong> ${escapeHtml(concert.title)}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Жанр" : "Genre")}:</strong> ${escapeHtml(concert.genre || "")}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Город" : "City")}:</strong> ${escapeHtml(concert.city)}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Площадка" : "Venue")}:</strong> ${escapeHtml(concert.venue)}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Дата" : "Date")}:</strong> ${formatDate(concert.date_time)}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Стоимость" : "Price")}:</strong> ${formatPrice(concert.price)}</span>
          <span><strong>${escapeHtml(currentLanguage === "ru" ? "Билеты" : "Tickets")}:</strong> ${t("common.tickets_total", { available: concert.tickets_available, total: concert.tickets_total })}</span>
        </div>
        <div class="concert-card-actions">
          <input type="number" min="1" max="10" value="1" aria-label="${escapeHtml(currentLanguage === "ru" ? "Количество билетов" : "Ticket quantity")}" />
          <button class="primary-button buy-ticket" type="button" data-concert-id="${concert.id}">${escapeHtml(t("common.buy_ticket"))}</button>
        </div>
        <span class="status-line card-message"></span>
      </div>
    </div>
  `;
}

async function openConcertDetail(concertId) {
  if (!concertDetailDialog || !concertDetailContent) {
    return;
  }
  concertDetailContent.innerHTML = stateCardHtml(currentLanguage === "ru" ? "Загружаем концерт..." : "Loading concert...", "loading");
  if (!concertDetailDialog.open) {
    concertDetailDialog.showModal();
  }
  try {
    const concert = await request(`/concerts/${concertId}`, { headers: {} });
    concertDetailContent.innerHTML = concertDetailHtml(concert);
  } catch (error) {
    concertDetailContent.innerHTML = stateCardHtml(error.message, "error");
  }
}

function renderExternalConcerts(concerts) {
  if (!resultList) {
    return;
  }
  if (!concerts.length) {
    setResultSummary(
      currentLanguage === "ru"
        ? "Внешние источники не нашли подходящих концертов."
        : "External sources did not return matching concerts.",
    );
    renderEmpty(t("common.no_external_results"));
    return;
  }

  resultState = { mode: "external", data: concerts, message: "" };
  resultList.classList.add("result-list--lineup");
  if (catalogSort) {
    catalogSort.disabled = true;
  }
  setResultSummary(
    currentLanguage === "ru"
      ? `Во внешних источниках найдено: ${concerts.length}`
      : `External events found: ${concerts.length}`,
  );
  resultList.innerHTML = concerts.map((concert) => lineupExternalCardHtml(concert)).join("");
}

function ticketCardsHtml(tickets) {
  if (!tickets.length) {
    return `<div class="result-card no-poster"><span class="result-meta">${t("common.no_tickets")}</span></div>`;
  }

  return tickets
    .map(
      (ticket) => `
        <article class="result-card no-poster ticket-item">
          <div>
            <strong>${escapeHtml(ticket.concert.band_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(ticket.concert.title)}</span>
              <span>${escapeHtml(ticket.concert.city)}</span>
              <span>${escapeHtml(ticket.concert.venue)}</span>
              <span>${formatDate(ticket.concert.date_time)}</span>
              <span>${ticket.quantity} ${escapeHtml(currentLanguage === "ru" ? "билет(ов)" : "ticket(s)")}</span>
            </div>
            <span class="result-meta">${escapeHtml(ticket.qr_code_data)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTickets(tickets) {
  if (resultList) {
    resultState = { mode: "tickets", data: tickets, message: "" };
    resultList.classList.remove("result-list--lineup");
    if (catalogSort) {
      catalogSort.disabled = true;
    }
    setResultSummary(
      currentLanguage === "ru"
        ? `Заказов в кабинете: ${tickets.length}`
        : `Ticket orders in your cabinet: ${tickets.length}`,
    );
    resultList.innerHTML = ticketCardsHtml(tickets);
  }
}

function renderFeaturedConcerts(concerts) {
  if (!homeConcertGrid) {
    return;
  }
  if (!concerts.length) {
    renderHomeConcertsPlaceholder(
      currentLanguage === "ru" ? "Сейчас в каталоге нет ближайших концертов." : "No upcoming catalog concerts are available right now.",
    );
    return;
  }

  featuredConcertsState = concerts;
  if (!preferredCity() && concerts[0]?.city) {
    persistPreferredCity(concerts[0].city);
  }
  homeConcertGrid.innerHTML = concerts
    .map((concert) => concertCardHtml(concert, { buyLabel: t("common.buy_ticket") }))
    .join("");
}

function renderRecommendedConcerts(concerts) {
  if (!homeRecommendGrid) {
    return;
  }
  if (!concerts.length) {
    homeRecommendGrid.innerHTML = stateCardHtml(t("home.recommended_empty"), "empty");
    return;
  }

  recommendedConcertsState = concerts;
  homeRecommendGrid.innerHTML = concerts.map((concert) => recommendedConcertCardHtml(concert)).join("");
}

function renderExternalHighlights(concerts) {
  if (!homeHighlightGrid) {
    return;
  }
  if (!concerts.length) {
    homeHighlightGrid.innerHTML = stateCardHtml(t("home.external_empty"), "empty");
    return;
  }

  externalHighlightsState = concerts;
  homeHighlightGrid.innerHTML = concerts
    .map(
      (concert) => `
        <article class="result-card no-poster">
          <div class="result-card-body">
            <strong>${escapeHtml(concert.artist_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(concert.title)}</span>
              <span>${escapeHtml(concert.city)}</span>
              <span>${escapeHtml(concert.venue)}</span>
              <span>${concert.date_time ? formatDate(concert.date_time) : t("common.date_tba")}</span>
              <span>${escapeHtml(concert.source)}</span>
            </div>
            <a class="primary-button external-link" href="${concert.source_url}" target="_blank" rel="noreferrer">${t("common.open_event")}</a>
          </div>
        </article>
      `,
    )
    .join("");
}

function baseOverviewCard(user, tickets) {
  const summary = summarizeTickets(tickets);
  const stats = [
    { label: currentLanguage === "ru" ? "Заказов" : "Orders", value: summary.totalOrders },
    { label: currentLanguage === "ru" ? "Билетов" : "Tickets", value: summary.totalTickets },
    { label: currentLanguage === "ru" ? "Ближайших событий" : "Upcoming events", value: summary.upcomingEvents },
  ];

  return cabinetCard({
    title: `${currentLanguage === "ru" ? "Добро пожаловать" : "Welcome"}, ${userDisplayName(user)}`,
    subtitle: `${currentLanguage === "ru" ? "Роль" : "Role"}: ${roleTitle(user.role)}`,
    featured: true,
    span: "5",
    body: `
      ${profileMetaHtml(user)}
      <div class="cabinet-stats">
        ${stats
          .map(
            (item) => `
              <div class="cabinet-stat">
                <strong>${item.value}</strong>
                <span>${item.label}</span>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="result-meta">
        <span>${
          summary.nextConcert
            ? `${currentLanguage === "ru" ? "Ближайший концерт" : "Next concert"}: ${escapeHtml(summary.nextConcert.concert.title)} · ${formatDate(summary.nextConcert.concert.date_time)}`
            : currentLanguage === "ru"
              ? "Ближайших билетов пока нет"
              : "No upcoming ticketed events yet"
        }</span>
      </div>
      <div class="form-actions">
        <a class="primary-button link-button" href="/concerts">${t("common.search_all")}</a>
        <button class="ghost-button" type="button" data-cabinet-action="load-tickets">${t("common.refresh")}</button>
      </div>
    `,
  });
}

function discoverCard(role) {
  const capabilities = [
    "поиск локальных концертов",
    "поиск концертов из внешних источников",
    "покупка билетов и хранение QR-кода",
    "быстрый переход к афише",
  ];

  if (role === "musician") {
    capabilities.push("расписание выступлений", "просмотр составов групп");
  }
  if (role === "manager") {
    capabilities.push("создание концертов", "управление ценами и остатками", "сводка по продажам");
  }
  if (role === "admin") {
    capabilities.push("управление ролями пользователей", "создание групп", "назначение менеджеров");
  }

  return cabinetCard({
    title: currentLanguage === "ru" ? "Быстрые действия" : "Quick actions",
    subtitle:
      currentLanguage === "ru"
        ? "Как в Ticketmaster и Eventbrite: поиск, заказы и рабочие инструменты в одном аккаунте."
        : "Like major ticketing platforms: discovery, orders, and role-based tools in one account.",
    span: "7",
    body: `
      ${featureListHtml(capabilities)}
      <div class="form-actions">
        <a class="primary-button link-button" href="/concerts">${currentLanguage === "ru" ? "Открыть афишу" : "Open listings"}</a>
        <a class="ghost-button link-button" href="/">${t("common.go_home")}</a>
      </div>
    `,
  });
}

function profileFormCard(user) {
  return cabinetCard({
    title: t("common.profile"),
    subtitle:
      currentLanguage === "ru"
        ? "Обновите контактные данные, чтобы кабинет был действительно вашим рабочим аккаунтом."
        : "Keep your contact details current so the cabinet works like a real account workspace.",
    span: "5",
    body: `
      <form class="cabinet-form" id="profile-form">
        <label>
          Email
          <input name="email" type="email" value="${escapeHtml(user.email)}" required />
        </label>
        <label>
          ${escapeHtml(currentLanguage === "ru" ? "Имя" : "First name")}
          <input name="first_name" type="text" value="${escapeHtml(user.profile?.first_name || "")}" required />
        </label>
        <label>
          ${escapeHtml(currentLanguage === "ru" ? "Фамилия" : "Last name")}
          <input name="last_name" type="text" value="${escapeHtml(user.profile?.last_name || "")}" required />
        </label>
        <label>
          ${escapeHtml(currentLanguage === "ru" ? "Ссылка на аватар" : "Avatar URL")}
          <input name="avatar_url" type="url" value="${escapeHtml(user.profile?.avatar_url || "")}" placeholder="https://..." />
        </label>
        <button class="primary-button wide" type="submit">${currentLanguage === "ru" ? "Сохранить профиль" : "Save profile"}</button>
        <p class="status-line wide" id="profile-status"></p>
      </form>
    `,
  });
}

function ticketsCard(tickets) {
  return cabinetCard({
    title: currentLanguage === "ru" ? "Мои билеты" : "My tickets",
    subtitle: currentLanguage === "ru" ? "Заказы и ближайшие события в одном месте." : "Orders and upcoming events in one place.",
    span: "7",
    body: `<div class="ticket-list" id="cabinet-ticket-list">${ticketCardsHtml(tickets)}</div>`,
  });
}

function guestCabinetHtml() {
  return `
    <div class="cabinet-grid">
      ${cabinetCard({
        title: currentLanguage === "ru" ? "Гостевой режим" : "Guest mode",
        subtitle:
          currentLanguage === "ru"
            ? "Сначала изучите афишу, а затем войдите, чтобы покупать билеты и хранить историю заказов."
            : "Explore the lineup first, then log in to buy tickets and keep your order history.",
        featured: true,
        span: "7",
        body: `
          ${featureListHtml(
            currentLanguage === "ru"
              ? ["поиск концертов", "внешняя афиша", "просмотр доступных событий"]
              : ["concert discovery", "external posters", "event browsing"],
          )}
          <div class="form-actions">
            <a class="primary-button link-button" href="/concerts">${currentLanguage === "ru" ? "Смотреть концерты" : "Browse concerts"}</a>
            <button class="ghost-button" type="button" data-cabinet-auth="login">${currentLanguage === "ru" ? "Войти" : "Log in"}</button>
            <button class="ghost-button" type="button" data-cabinet-auth="register">${currentLanguage === "ru" ? "Регистрация" : "Sign up"}</button>
          </div>
        `,
      })}
      ${cabinetCard({
        title: currentLanguage === "ru" ? "Что даст аккаунт" : "Why create an account",
        subtitle:
          currentLanguage === "ru"
            ? "Ориентир как у крупных ticketing-сервисов: кабинет хранит не только логин, но и ваши заказы."
            : "Modeled after real ticketing services: your cabinet stores more than a login, it stores your orders.",
        span: "5",
        body: `
          ${featureListHtml([
            ...(currentLanguage === "ru"
              ? [
                  "покупка билетов",
                  "личная история заказов",
                  "роль музыканта, менеджера или администратора",
                  "рабочие инструменты по роли",
                ]
              : [
                  "ticket purchase",
                  "personal order history",
                  "musician, manager, or admin role",
                  "role-based workspace tools",
                ]),
          ])}
        `,
      })}
      ${cabinetCard({
        title: currentLanguage === "ru" ? "Что дальше" : "What next",
        subtitle:
          currentLanguage === "ru"
            ? "Если вы просто хотите смотреть афишу, можно остаться гостем. Для работы с билетами нужен вход."
            : "You can stay a guest to browse listings, but buying and managing tickets requires an account.",
        wide: true,
        body: `
          <div class="form-actions">
            <a class="primary-button link-button" href="/concerts">${currentLanguage === "ru" ? "Перейти к афише" : "Go to listings"}</a>
            <a class="ghost-button link-button" href="/">${currentLanguage === "ru" ? "Вернуться на главную" : "Back home"}</a>
          </div>
        `,
      })}
    </div>
  `;
}

function baseCabinetSections(user, tickets) {
  return [baseOverviewCard(user, tickets), discoverCard(user.role), profileFormCard(user), ticketsCard(tickets)];
}

function adminUserRow(user) {
  const fullName = [user.profile?.first_name, user.profile?.last_name].filter(Boolean).join(" ").trim();
  return `
    <div class="admin-user-row" data-user-id="${user.id}">
      <div>
        <strong>${escapeHtml(user.email)}</strong>
        <span class="result-meta">${escapeHtml(fullName || (currentLanguage === "ru" ? "Без имени" : "No profile name"))}</span>
        <code>${user.id}</code>
      </div>
      <label>
        ${escapeHtml(currentLanguage === "ru" ? "Роль" : "Role")}
        <select class="role-select">
          ${["registered_user", "musician", "manager", "admin"]
            .map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${roleTitle(role)}</option>`)
            .join("")}
        </select>
      </label>
      <div class="admin-user-actions">
        <button class="primary-button save-role" type="button">${t("common.save")}</button>
        <p class="status-line admin-user-status"></p>
      </div>
    </div>
  `;
}

function createFallbackCabinetModule() {
  return {
    async renderCabinet() {
      if (!cabinetContent || !cabinetSubtitle) {
        return;
      }
      if (!currentUser) {
        cabinetSubtitle.textContent = currentLanguage === "ru" ? "Гостевой режим" : "Guest mode";
        cabinetContent.innerHTML = guestCabinetHtml();
        return;
      }
      cabinetSubtitle.textContent = `${currentUser.email} · ${roleTitle(currentUser.role)}`;
      cabinetContent.innerHTML = `
        <div class="cabinet-grid">
          ${baseOverviewCard(currentUser, [])}
          ${discoverCard(currentUser.role)}
          ${profileFormCard(currentUser)}
          ${cabinetCard({
            title: currentLanguage === "ru" ? "Данные кабинета временно недоступны" : "Workspace data is temporarily unavailable",
            subtitle:
              currentLanguage === "ru"
                ? "Основной модуль кабинета не загрузился. Вход работает, профиль доступен, обновите страницу без кэша."
                : "The main cabinet module did not load. Sign-in works, profile is available, refresh the page without cache.",
            span: "7",
            body: `<div class="form-actions"><button class="primary-button" type="button" data-cabinet-action="reload-page">${currentLanguage === "ru" ? "Обновить страницу" : "Refresh page"}</button></div>`,
          })}
        </div>
      `;
    },
    async reloadTicketList() {},
    async handleCabinetClick(event) {
      if (event.target.closest("[data-cabinet-action='reload-page']")) {
        window.location.reload();
        return true;
      }
      const authButton = event.target.closest("[data-cabinet-auth]");
      if (authButton) {
        openAuth(authButton.dataset.cabinetAuth);
        return true;
      }
      return false;
    },
    async handleCabinetSubmit() {
      return false;
    },
  };
}

const cabinetModuleFactory = window.WavesCabinetModule?.create;
const cabinetModule = typeof cabinetModuleFactory === "function" ? cabinetModuleFactory({
  elements: {
    cabinetSubtitle,
    cabinetContent,
  },
  getCurrentUser: () => currentUser,
  setCurrentUser: (user) => {
    currentUser = user;
  },
  getCurrentLanguage: () => currentLanguage,
  request,
  t,
  roleTitle,
  statusTitle,
  escapeHtml,
  showToast,
  setButtonBusy,
  setStatusLine,
  stateCardHtml,
  ticketCardsHtml,
  buildConcertPayload,
  validateConcertPayload,
  openAuth,
  setAuthState,
  baseCabinetSections,
  baseOverviewCard,
  cabinetCard,
  bandCardsHtml,
  discoverCard,
  profileFormCard,
  scheduleConcertsHtml,
  managedConcertsHtml,
  adminUserRow,
  ticketsCard,
  guestCabinetHtml,
  summarizeManagedWorkspace,
  managerSummaryCard,
}) : createFallbackCabinetModule();

async function loadCurrentUser() {
  if (!token) {
    currentUser = null;
    if (logoutButton) {
      logoutButton.hidden = true;
    }
    setAuthState(t("roles.guest"));
    syncAuthButtons();
    await cabinetModule.renderCabinet();
    return;
  }

  try {
    currentUser = await request("/users/me");
  } catch {
    token = "";
    currentUser = null;
    localStorage.removeItem("waves_token");
    setAuthState(t("roles.guest"));
    if (logoutButton) {
      logoutButton.hidden = true;
    }
    syncAuthButtons();
    await cabinetModule.renderCabinet();
    return;
  }

  setAuthState(roleTitle(currentUser.role));
  if (logoutButton) {
    logoutButton.hidden = false;
  }
  syncAuthButtons();

  try {
    await cabinetModule.renderCabinet();
  } catch (error) {
    renderCabinetMessage(error.message || (currentLanguage === "ru" ? "Не удалось загрузить рабочее пространство." : "Could not load the workspace."));
  }
}

function rerenderByState() {
  applyStaticTranslations();
  syncAuthButtons();
  setAuthState(currentUser ? roleTitle(currentUser.role) : t("roles.guest"));
  if (pageKey() === "home") {
    if (featuredConcertsState.length) {
      renderFeaturedConcerts(featuredConcertsState);
    } else {
      renderHomeConcertsPlaceholder(t("common.loading_local_home"));
    }
    if (recommendedConcertsState.length) {
      renderRecommendedConcerts(recommendedConcertsState);
    } else {
      renderHomeRecommendationsPlaceholder(t("home.loading_recommended_text"));
    }
    if (externalHighlightsState.length) {
      renderExternalHighlights(externalHighlightsState);
    } else if (homeHighlightGrid) {
      homeHighlightGrid.innerHTML = `<article class="result-card no-poster"><span class="result-meta">${t("common.loading_external_home")}</span></article>`;
    }
  }
  if (pageKey() === "concerts" && resultList) {
    if (resultState.mode === "local") {
      renderConcerts(resultState.data);
    } else if (resultState.mode === "external") {
      renderExternalConcerts(resultState.data);
    } else if (resultState.mode === "tickets") {
      renderTickets(resultState.data);
    } else {
      renderEmpty(resultState.message || t("common.search_start"));
    }
  }
  if (pageKey() === "cabinet") {
    loadCurrentUser();
  }
}

localeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    currentLanguage = button.dataset.locale;
    localStorage.setItem("waves_language", currentLanguage);
    updateUrlParameter("lang", currentLanguage);
    rerenderByState();
  });
});

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (currentUser) {
      if (
        button.id === "hero-login-button" ||
        button.id === "hero-signup-button" ||
        button.id === "topbar-login-button" ||
        button.id === "topbar-signup-button"
      ) {
        window.location.href = "/cabinet";
        return;
      }
    }
    updateUrlParameter("auth", button.dataset.openAuth);
    openAuth(button.dataset.openAuth);
  });
});

if (document.querySelector("#close-auth") && authDialog) {
  document.querySelector("#close-auth").addEventListener("click", () => {
    updateUrlParameter("auth", "");
    authDialog.close();
  });
}

if (document.querySelector("#close-concert-detail") && concertDetailDialog) {
  document.querySelector("#close-concert-detail").addEventListener("click", () => concertDetailDialog.close());
}

if (checkoutDialog) {
  checkoutDialog.addEventListener("click", (event) => {
    const closeButton = event.target.closest("#close-checkout, #checkout-continue");
    if (closeButton) {
      checkoutDialog.close();
    }
  });
}

if (authDialog) {
  authDialog.addEventListener("close", () => {
    updateUrlParameter("auth", "");
  });
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());
    setButtonBusy(
      authSubmit,
      true,
      authMode === "register"
        ? currentLanguage === "ru"
          ? "Создаем аккаунт..."
          : "Creating account..."
        : currentLanguage === "ru"
          ? "Входим..."
          : "Signing in...",
    );
    setMessage("");

    try {
      if (authMode === "register") {
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const login = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
        }),
      });

      token = login.access_token;
      localStorage.setItem("waves_token", token);
      await loadCurrentUser();
      updateUrlParameter("auth", "");
      authDialog.close();
      showToast(
        authMode === "register"
          ? currentLanguage === "ru"
            ? "Аккаунт создан. Добро пожаловать в Waves."
            : "Account created. Welcome to Waves."
          : currentLanguage === "ru"
            ? "Вы успешно вошли в аккаунт."
            : "You are now signed in.",
        "success",
      );

      if (window.location.pathname === "/") {
        window.location.href = "/cabinet";
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setButtonBusy(authSubmit, false);
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    token = "";
    currentUser = null;
    localStorage.removeItem("waves_token");
    await loadCurrentUser();
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  });
}

async function handleTicketPurchase(button) {
  if (!button) {
    return;
  }

  const card = button.closest(".result-card") || button.closest(".concert-detail");
  const quantityInput = card?.querySelector("input[type='number']");
  const message = card?.querySelector(".card-message");
  const quantity = Number(quantityInput?.value || 1);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    setStatusLine(message, currentLanguage === "ru" ? "Укажите количество от 1 до 10." : "Choose a quantity from 1 to 10.", "error");
    return;
  }

  try {
    await openCheckout(button.dataset.concertId, quantity, message);
    setStatusLine(message, "", "neutral");
  } catch (error) {
    setStatusLine(message, error.message, "error");
  }
}

if (checkoutDialog) {
  checkoutDialog.addEventListener("submit", async (event) => {
    const form = event.target.closest("#checkout-form");
    if (!form) {
      return;
    }
    event.preventDefault();
    const submitButton = form.querySelector("#checkout-submit");
    const status = form.querySelector("#checkout-status");
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.quantity = Number(payload.quantity);
    setButtonBusy(submitButton, true, t("checkout.processing"));
    setStatusLine(status, t("checkout.processing"), "loading");
    try {
      const ticket = await request("/tickets/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (checkoutState.sourceMessage) {
        setStatusLine(checkoutState.sourceMessage, t("common.ticket_purchased"), "success");
      }
      showToast(ticket.saved_to_account ? t("checkout.success_user") : t("checkout.success_guest"), "success");
      checkoutContent.innerHTML = checkoutSuccessHtml(ticket);
    } catch (error) {
      setStatusLine(status, error.message, "error");
      setButtonBusy(submitButton, false);
    }
  });
}

if (cabinetContent) {
  cabinetContent.addEventListener("click", async (event) => {
    await cabinetModule.handleCabinetClick(event);
  });

  cabinetContent.addEventListener("submit", async (event) => {
    await cabinetModule.handleCabinetSubmit(event);
  });
}

if (resultList) {
  resultList.addEventListener("click", async (event) => {
    const detailsButton = event.target.closest(".concert-details");
    if (detailsButton) {
      await openConcertDetail(detailsButton.dataset.concertId);
      return;
    }
    const button = event.target.closest(".buy-ticket");
    if (!button) {
      return;
    }
    await handleTicketPurchase(button);
  });
}

if (homeConcertGrid) {
  homeConcertGrid.addEventListener("click", async (event) => {
    const detailsButton = event.target.closest(".concert-details");
    if (detailsButton) {
      await openConcertDetail(detailsButton.dataset.concertId);
      return;
    }
    const button = event.target.closest(".buy-ticket");
    if (!button) {
      return;
    }
    await handleTicketPurchase(button);
  });
}

if (homeRecommendGrid) {
  homeRecommendGrid.addEventListener("click", async (event) => {
    const detailsButton = event.target.closest(".concert-details");
    if (detailsButton) {
      await openConcertDetail(detailsButton.dataset.concertId);
      return;
    }
    const button = event.target.closest(".buy-ticket");
    if (!button) {
      return;
    }
    await handleTicketPurchase(button);
  });
}

if (concertDetailContent) {
  concertDetailContent.addEventListener("click", async (event) => {
    const button = event.target.closest(".buy-ticket");
    if (!button) {
      return;
    }
    await handleTicketPurchase(button);
  });
}

if (cityFilter) {
  cityFilter.addEventListener("click", async (event) => {
    const button = event.target.closest(".city-filter-button");
    if (!button) {
      return;
    }
    cityFilter.querySelectorAll(".city-filter-button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    persistPreferredCity(button.dataset.city || "");
    await loadConcertCatalog(button.dataset.city || "");
  });
}

if (catalogSort) {
  catalogSort.addEventListener("change", () => {
    if (resultState.mode === "local") {
      renderConcerts(catalogState.length ? catalogState : resultState.data);
    }
  });
}

if (toggleFiltersButton && searchPanel) {
  toggleFiltersButton.addEventListener("click", () => {
    searchPanel.classList.toggle("is-collapsed");
    syncFilterToggleButton();
  });
}

if (searchForm) {
  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = searchForm.querySelector("button[type='submit']");
    const params = new URLSearchParams();
    const formData = new FormData(searchForm);

    for (const [key, value] of formData.entries()) {
      if (value) {
        const normalizedValue =
          key === "date_from" ? toDateBoundary(value) : key === "date_to" ? toDateBoundary(value, true) : value;
        params.set(key, normalizedValue);
      }
    }
    if (formData.get("city")) {
      persistPreferredCity(formData.get("city"));
    }

    try {
      setButtonBusy(submitButton, true, currentLanguage === "ru" ? "Ищем..." : "Searching...");
      setResultSummary(currentLanguage === "ru" ? "Ищем концерты в каталоге..." : "Searching the catalog...");
      renderEmpty(t("common.loading_concerts"));
      const concerts = await request(`/concerts/?${params.toString()}`, { headers: {} });
      renderConcerts(concerts);
    } catch (error) {
      setResultSummary(error.message);
      renderEmpty(error.message);
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
}

if (loadTicketsButton) {
  loadTicketsButton.addEventListener("click", async () => {
    if (!token) {
      openAuth("login");
      setMessage(currentLanguage === "ru" ? "Войдите, чтобы увидеть свои билеты." : "Log in to see your tickets.");
      return;
    }

    try {
      setButtonBusy(loadTicketsButton, true, currentLanguage === "ru" ? "Загружаем..." : "Loading...");
      setResultSummary(currentLanguage === "ru" ? "Подтягиваем ваши билеты..." : "Fetching your tickets...");
      renderEmpty(t("common.loading_tickets"));
      const tickets = await request("/tickets/my");
      renderTickets(tickets);
    } catch (error) {
      setResultSummary(error.message);
      renderEmpty(error.message);
    } finally {
      setButtonBusy(loadTicketsButton, false);
    }
  });
}

if (externalSearchButton) {
  externalSearchButton.addEventListener("click", async () => {
    const params = new URLSearchParams();
    const formData = new FormData(searchForm);
    const city = String(formData.get("city") || "").trim();
    if (!city) {
      const message =
        currentLanguage === "ru" ? "Сначала выберите город для внешнего поиска." : "Choose a city before searching external sources.";
      setResultSummary(message);
      renderEmpty(message);
      return;
    }

    for (const [key, value] of formData.entries()) {
      if (!value) {
        continue;
      }
      if (["city", "genre", "artist"].includes(key)) {
        params.set(key, value);
      }
      if (key === "date_from" || key === "date_to") {
        params.set(key, toDateBoundary(value, key === "date_to"));
      }
    }

    try {
      setButtonBusy(externalSearchButton, true, currentLanguage === "ru" ? "Ищем..." : "Searching...");
      setResultSummary(
        currentLanguage === "ru"
          ? "Ищем афиши во внешних источниках..."
          : "Searching posters in external sources...",
      );
      renderEmpty(t("common.loading_external"));
      const concerts = await request(`/concerts/external?${params.toString()}`, { headers: {} });
      renderExternalConcerts(concerts);
    } catch (error) {
      setResultSummary(error.message);
      renderEmpty(error.message);
    } finally {
      setButtonBusy(externalSearchButton, false);
    }
  });
}

async function loadFeaturedConcerts() {
  if (!homeConcertGrid) {
    return;
  }

  try {
    renderHomeConcertsPlaceholder(t("common.loading_local_home"));
    const concerts = await request("/concerts/featured?limit=6", { headers: {} });
    renderFeaturedConcerts(concerts);
  } catch (error) {
    renderHomeConcertsPlaceholder(error.message);
  }
}

async function loadRecommendedConcerts() {
  if (!homeRecommendGrid) {
    return;
  }

  const city = preferredCity() || "Москва";
  persistPreferredCity(city);
  renderHomeRecommendationsPlaceholder(t("home.loading_recommended_text"));
  try {
    const params = new URLSearchParams({ limit: "6", city });
    const concerts = await request(`/concerts/recommended?${params.toString()}`, { headers: {} });
    renderRecommendedConcerts(concerts);
  } catch (error) {
    homeRecommendGrid.innerHTML = stateCardHtml(error.message, "error");
  }
}

async function loadExternalHighlights() {
  if (!homeHighlightGrid) {
    return;
  }

  homeHighlightGrid.innerHTML = stateCardHtml(t("common.loading_external_home"), "loading");
  try {
    const concerts = await request("/concerts/external/highlights?limit=6", { headers: {} });
    renderExternalHighlights(concerts);
  } catch (error) {
    homeHighlightGrid.innerHTML = stateCardHtml(error.message, "error");
  }
}

async function loadConcertCities() {
  if (!cityFilter) {
    return;
  }
  try {
    const cities = await request("/concerts/cities", { headers: {} });
    renderCityFilters(cities);
  } catch {
    renderCityFilters([]);
  }
}

applyStaticTranslations();
syncAuthButtons();
setAuthState();
if (pageKey() === "concerts" && searchPanel && window.innerWidth <= 900) {
  searchPanel.classList.add("is-collapsed");
  syncFilterToggleButton();
}
loadCurrentUser();
loadFeaturedConcerts();
loadRecommendedConcerts();
loadExternalHighlights();
loadConcertCities();
if (!token) {
  const requestedAuthMode = pageQuery.get("auth");
  if (requestedAuthMode === "login" || requestedAuthMode === "register") {
    openAuth(requestedAuthMode);
  }
}
if (resultList) {
  setResultSummary(t("concerts.summary_start"));
  loadConcertCatalog().catch((error) => {
    setResultSummary(error.message);
    renderEmpty(error.message);
  });
}
