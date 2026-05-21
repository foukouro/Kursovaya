const api = "/api/v1";
const authDialog = document.querySelector("#auth-dialog");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubmit = document.querySelector("#auth-submit");
const authMessage = document.querySelector("#auth-message");
const authState = document.querySelector("#auth-state");
const resultList = document.querySelector("#result-list");
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

let authMode = "login";
let token = localStorage.getItem("waves_token") || "";
let currentUser = null;

function setMessage(text) {
  if (authMessage) {
    authMessage.textContent = text;
  }
}

function setAuthState(label) {
  if (authState) {
    authState.textContent = label || (token ? "authorized" : "guest");
  }
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
      loginButton.textContent = "cabinet";
      signupButton.hidden = true;
    } else {
      loginButton.textContent = "log in";
      signupButton.hidden = false;
    }
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

function roleTitle(role) {
  const titles = {
    registered_user: "registered user",
    musician: "musician",
    manager: "manager",
    admin: "admin",
    guest: "guest",
  };
  return titles[role] || role;
}

function openAuth(mode) {
  if (!authDialog || !authForm) {
    return;
  }
  authMode = mode;
  authForm.classList.toggle("is-register", mode === "register");
  authTitle.textContent = mode === "register" ? "sign up" : "log in";
  authSubmit.textContent = mode === "register" ? "sign up" : "log in";
  authForm.reset();
  setMessage("");
  authDialog.showModal();
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
        ? "Сервер не смог выполнить запрос. Проверьте, что PostgreSQL запущен и миграции применены."
        : text || response.statusText || "Request failed";
    throw new Error(data?.detail || data?.message || fallbackMessage);
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
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function toDateBoundary(value, endOfDay = false) {
  return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
}

function renderEmpty(text) {
  if (resultList) {
    resultList.innerHTML = `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(text)}</span></div>`;
  }
}

function renderCabinetMessage(text) {
  if (cabinetContent) {
    cabinetContent.innerHTML = `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(text)}</span></div>`;
  }
}

function renderConcerts(concerts) {
  if (!resultList) {
    return;
  }
  if (!concerts.length) {
    renderEmpty("No concerts found");
    return;
  }

  resultList.innerHTML = concerts
    .map(
      (concert) => `
        <article class="result-card">
          <img class="result-poster" src="${concert.poster_url || "/static/assets/poster-lowve.svg"}" alt="" />
          <div class="result-card-body">
            <strong>${escapeHtml(concert.band_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(concert.title)}</span>
              <span>${escapeHtml(concert.city)}</span>
              <span>${escapeHtml(concert.venue)}</span>
              <span>${formatDate(concert.date_time)}</span>
              <span>${formatPrice(concert.price)}</span>
              <span>${concert.tickets_available} left</span>
            </div>
            <div class="purchase-row">
              <input type="number" min="1" max="10" value="1" aria-label="Количество билетов" />
              <button class="primary-button buy-ticket" type="button" data-concert-id="${concert.id}">buy</button>
            </div>
            <span class="result-meta card-message"></span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderExternalConcerts(concerts) {
  if (!resultList) {
    return;
  }
  if (!concerts.length) {
    renderEmpty("No internet concerts found");
    return;
  }

  resultList.innerHTML = concerts
    .map(
      (concert) => `
        <article class="result-card">
          <img class="result-poster" src="${concert.poster_url || "/static/assets/poster-pyro.svg"}" alt="" />
          <div class="result-card-body">
            <strong>${escapeHtml(concert.artist_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(concert.title)}</span>
              <span>${escapeHtml(concert.city)}</span>
              <span>${escapeHtml(concert.venue)}</span>
              <span>${concert.date_time ? formatDate(concert.date_time) : "Date TBA"}</span>
              <span>${escapeHtml(concert.source)}</span>
            </div>
            <a class="primary-button external-link" href="${concert.source_url}" target="_blank" rel="noreferrer">open poster</a>
          </div>
        </article>
      `,
    )
    .join("");
}

if (resultList) {
  resultList.addEventListener("click", async (event) => {
    const button = event.target.closest(".buy-ticket");
    if (!button) {
      return;
    }
    if (!token) {
      openAuth("login");
      return;
    }

    const card = button.closest(".result-card");
    const quantity = Number(card.querySelector("input").value || 1);
    const message = card.querySelector(".card-message");
    button.disabled = true;
    message.textContent = "";

    try {
      await request("/tickets/", {
        method: "POST",
        body: JSON.stringify({
          concert_id: button.dataset.concertId,
          quantity,
        }),
      });
      message.textContent = "Ticket purchased";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setTimeout(() => {
        button.disabled = false;
      }, 1800);
    }
  });
}

function ticketCardsHtml(tickets) {
  if (!tickets.length) {
    return `<div class="result-card no-poster"><span class="result-meta">No tickets yet</span></div>`;
  }

  return tickets
    .map(
      (ticket) => `
        <article class="result-card no-poster ticket-item">
          <div>
            <strong>${escapeHtml(ticket.concert.band_name)}</strong>
            <div class="result-meta">
              <span>${escapeHtml(ticket.concert.city)}</span>
              <span>${escapeHtml(ticket.concert.venue)}</span>
              <span>${formatDate(ticket.concert.date_time)}</span>
              <span>${ticket.quantity} ticket(s)</span>
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
    resultList.innerHTML = ticketCardsHtml(tickets);
  }
}

async function renderRegisteredCabinet() {
  if (!cabinetSubtitle || !cabinetContent || !currentUser) {
    return;
  }
  cabinetSubtitle.textContent = `${currentUser.email} · ${roleTitle(currentUser.role)}`;
  cabinetContent.innerHTML = `
    <div class="cabinet-grid">
      <section class="cabinet-card">
        <h3>Profile</h3>
        <div class="result-meta">
          <span>${escapeHtml(currentUser.profile?.first_name || "")} ${escapeHtml(currentUser.profile?.last_name || "")}</span>
          <span>${escapeHtml(currentUser.email)}</span>
          <span>${roleTitle(currentUser.role)}</span>
        </div>
        <button class="primary-button" type="button" id="cabinet-load-tickets">load my tickets</button>
      </section>
      <section class="cabinet-card">
        <h3>My tickets</h3>
        <div class="ticket-list" id="cabinet-ticket-list">
          <div class="result-card no-poster"><span class="result-meta">Tickets will appear here.</span></div>
        </div>
      </section>
    </div>
  `;
}

function adminUserRow(user) {
  return `
    <div class="admin-user-row" data-user-id="${user.id}">
      <div>
        <strong>${escapeHtml(user.email)}</strong>
        <span class="result-meta">${escapeHtml(user.profile?.first_name || "")} ${escapeHtml(user.profile?.last_name || "")}</span>
        <code>${user.id}</code>
      </div>
      <label>
        Role
        <select class="role-select">
          ${["registered_user", "musician", "manager", "admin"]
            .map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${roleTitle(role)}</option>`)
            .join("")}
        </select>
      </label>
      <button class="primary-button save-role" type="button">save</button>
    </div>
  `;
}

async function loadAdminUsers() {
  const users = await request("/admin/users");
  const list = document.querySelector("#admin-user-list");
  const managerList = document.querySelector("#manager-list");
  if (!list || !managerList) {
    return;
  }
  list.innerHTML = users.map(adminUserRow).join("");
  managerList.innerHTML = users.map((user) => `<option value="${user.id}" label="${escapeHtml(user.email)}"></option>`).join("");
}

async function renderAdminCabinet() {
  if (!cabinetSubtitle || !cabinetContent || !currentUser) {
    return;
  }
  cabinetSubtitle.textContent = `${currentUser.email} · administrator workspace`;
  cabinetContent.innerHTML = `
    <div class="cabinet-grid">
      <section class="cabinet-card">
        <h3>Create band</h3>
        <form class="cabinet-form" id="admin-band-form">
          <label>
            Name
            <input name="name" type="text" placeholder="Waves Band" required />
          </label>
          <label>
            Genre
            <input name="genre" type="text" list="genre-list" placeholder="rock" required />
          </label>
          <label class="wide">
            Manager ID
            <input name="manager_id" type="text" list="manager-list" placeholder="Select user id" required />
            <datalist id="manager-list"></datalist>
          </label>
          <button class="primary-button wide" type="submit">create band</button>
          <p class="status-line wide" id="admin-band-status"></p>
        </form>
      </section>
      <section class="cabinet-card">
        <div class="panel-heading">
          <h3>Users</h3>
          <button class="ghost-button compact" type="button" id="refresh-admin-users">refresh</button>
        </div>
        <div class="admin-user-list" id="admin-user-list">
          <div class="result-card no-poster"><span class="result-meta">Loading users...</span></div>
        </div>
      </section>
    </div>
  `;
  await loadAdminUsers();
}

async function renderCabinet() {
  if (!cabinetContent || !cabinetSubtitle) {
    return;
  }
  if (!currentUser) {
    renderCabinetMessage("Use log in or sign up to continue.");
    return;
  }
  if (currentUser.role === "admin") {
    await renderAdminCabinet();
    return;
  }
  await renderRegisteredCabinet();
}

async function loadCurrentUser() {
  if (!token) {
    currentUser = null;
    if (logoutButton) {
      logoutButton.hidden = true;
    }
    setAuthState("guest");
    syncAuthButtons();
    if (cabinetSubtitle) {
      cabinetSubtitle.textContent = "Log in to open your workspace";
    }
    renderCabinetMessage("Use log in or sign up to continue.");
    return;
  }

  try {
    currentUser = await request("/users/me");
    setAuthState(roleTitle(currentUser.role));
    if (logoutButton) {
      logoutButton.hidden = false;
    }
    syncAuthButtons();
    await renderCabinet();
  } catch {
    token = "";
    currentUser = null;
    localStorage.removeItem("waves_token");
    setAuthState("guest");
    if (logoutButton) {
      logoutButton.hidden = true;
    }
    syncAuthButtons();
    renderCabinetMessage("Session expired. Please log in again.");
  }
}

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => {
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
    openAuth(button.dataset.openAuth);
  });
});

if (document.querySelector("#close-auth") && authDialog) {
  document.querySelector("#close-auth").addEventListener("click", () => authDialog.close());
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());

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
      authDialog.close();

      if (window.location.pathname === "/") {
        window.location.href = "/cabinet";
      }
    } catch (error) {
      setMessage(error.message);
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    token = "";
    currentUser = null;
    localStorage.removeItem("waves_token");
    loadCurrentUser();
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  });
}

if (cabinetContent) {
  cabinetContent.addEventListener("click", async (event) => {
    const ticketsButton = event.target.closest("#cabinet-load-tickets");
    if (ticketsButton) {
      const list = document.querySelector("#cabinet-ticket-list");
      if (!list) {
        return;
      }
      list.innerHTML = `<div class="result-card no-poster"><span class="result-meta">Loading tickets...</span></div>`;
      try {
        const tickets = await request("/tickets/my");
        list.innerHTML = ticketCardsHtml(tickets);
      } catch (error) {
        list.innerHTML = `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(error.message)}</span></div>`;
      }
      return;
    }

    const refreshButton = event.target.closest("#refresh-admin-users");
    if (refreshButton) {
      await loadAdminUsers();
      return;
    }

    const saveRoleButton = event.target.closest(".save-role");
    if (saveRoleButton) {
      const row = saveRoleButton.closest(".admin-user-row");
      const role = row.querySelector(".role-select").value;
      saveRoleButton.disabled = true;
      try {
        await request(`/admin/users/${row.dataset.userId}/role`, {
          method: "PUT",
          body: JSON.stringify({ role }),
        });
        await loadAdminUsers();
      } catch (error) {
        alert(error.message);
      } finally {
        saveRoleButton.disabled = false;
      }
    }
  });

  cabinetContent.addEventListener("submit", async (event) => {
    if (event.target.id !== "admin-band-form") {
      return;
    }
    event.preventDefault();
    const status = document.querySelector("#admin-band-status");
    const payload = Object.fromEntries(new FormData(event.target).entries());
    if (status) {
      status.textContent = "Creating band...";
    }
    try {
      const band = await request("/admin/bands", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (status) {
        status.textContent = `Band created: ${band.name}`;
      }
      event.target.reset();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    }
  });
}

if (searchForm) {
  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const formData = new FormData(searchForm);

    for (const [key, value] of formData.entries()) {
      if (value) {
        const normalizedValue =
          key === "date_from" ? toDateBoundary(value) : key === "date_to" ? toDateBoundary(value, true) : value;
        params.set(key, normalizedValue);
      }
    }

    try {
      renderEmpty("Loading concerts...");
      const concerts = await request(`/concerts/?${params.toString()}`, { headers: {} });
      renderConcerts(concerts);
    } catch (error) {
      renderEmpty(error.message);
    }
  });
}

if (loadTicketsButton) {
  loadTicketsButton.addEventListener("click", async () => {
    if (!token) {
      openAuth("login");
      return;
    }

    try {
      renderEmpty("Loading tickets...");
      const tickets = await request("/tickets/my");
      renderTickets(tickets);
    } catch (error) {
      renderEmpty(error.message);
    }
  });
}

if (externalSearchButton) {
  externalSearchButton.addEventListener("click", async () => {
    const params = new URLSearchParams();
    const formData = new FormData(searchForm);
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
      renderEmpty("Loading internet concerts...");
      const concerts = await request(`/concerts/external?${params.toString()}`, { headers: {} });
      renderExternalConcerts(concerts);
    } catch (error) {
      renderEmpty(error.message);
    }
  });
}

syncAuthButtons();
setAuthState();
loadCurrentUser();
renderEmpty("Search concerts by city");
