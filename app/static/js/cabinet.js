(function () {
  function createCabinetModule(deps) {
    const {
      elements,
      getCurrentUser,
      setCurrentUser,
      getCurrentLanguage,
      request,
      t,
      roleTitle,
      escapeHtml,
      showToast,
      setButtonBusy,
      setStatusLine,
      stateCardHtml,
      ticketCardsHtml,
      baseOverviewCard,
      buildConcertPayload,
      validateConcertPayload,
      openAuth,
      setAuthState,
      baseCabinetSections,
      cabinetCard,
      bandCardsHtml,
      discoverCard,
      profileFormCard,
      scheduleConcertsHtml,
      managedConcertsHtml,
      adminUserRow,
      ticketsCard,
      summarizeManagedWorkspace,
      managerSummaryCard,
    } = deps;

    const sectionState = new Map();

    function language() {
      return getCurrentLanguage();
    }

    function currentUser() {
      return getCurrentUser();
    }

    async function requestOr(path, fallback) {
      try {
        return await request(path);
      } catch (error) {
        showToast(error.message, "error");
        return fallback;
      }
    }

    function notificationTitle(kind) {
      const titles = {
        moderation: language() === "ru" ? "Модерация" : "Moderation",
        invitation: language() === "ru" ? "Приглашение" : "Invitation",
        schedule: language() === "ru" ? "Расписание" : "Schedule",
        system: language() === "ru" ? "Система" : "System",
      };
      return titles[kind] || kind;
    }

    function eventTypeTitle(type) {
      const titles = {
        concert: language() === "ru" ? "Концерт" : "Concert",
        rehearsal: language() === "ru" ? "Репетиция" : "Rehearsal",
        meeting: language() === "ru" ? "Встреча" : "Meeting",
        other: language() === "ru" ? "Другое" : "Other",
      };
      return titles[type] || type;
    }

    function participationTitle(status) {
      const titles = {
        pending: language() === "ru" ? "ожидается" : "pending",
        confirmed: language() === "ru" ? "подтверждено" : "confirmed",
        declined: language() === "ru" ? "отклонено" : "declined",
      };
      return titles[status] || status;
    }

    function roleSectionKey(role) {
      return `waves_cabinet_section_${role}_${language()}`;
    }

    function activeSectionId(role, sections) {
      const stored = sectionState.get(role) || window.localStorage.getItem(roleSectionKey(role));
      if (stored && sections.some((section) => section.id === stored)) {
        return stored;
      }
      return sections[0]?.id || "";
    }

    function rememberSection(role, sectionId) {
      sectionState.set(role, sectionId);
      window.localStorage.setItem(roleSectionKey(role), sectionId);
    }

    function workspaceLayoutMarkup(role, sections) {
      const activeId = activeSectionId(role, sections);
      return `
        <div class="cabinet-workspace" data-role-workspace="${role}">
          <aside class="cabinet-sidebar">
            <div class="cabinet-sidebar-head">
              <strong>${escapeHtml(language() === "ru" ? "Разделы кабинета" : "Workspace sections")}</strong>
              <span>${escapeHtml(language() === "ru" ? "Откройте нужный раздел в 1 клик" : "Open the right section in one click")}</span>
            </div>
            <nav class="cabinet-sidebar-nav" aria-label="${escapeHtml(language() === "ru" ? "Навигация кабинета" : "Cabinet navigation")}">
              ${sections
                .map(
                  (section) => `
                    <button
                      class="cabinet-nav-button ${section.id === activeId ? "is-active" : ""}"
                      type="button"
                      data-cabinet-section="${section.id}"
                      data-cabinet-role="${role}"
                    >
                      <span>${escapeHtml(section.label)}</span>
                      ${section.count ? `<span class="cabinet-nav-count">${section.count}</span>` : ""}
                    </button>
                  `,
                )
                .join("")}
            </nav>
          </aside>
          <div class="cabinet-stage">
            ${sections
              .map(
                (section) => `
                  <section class="cabinet-stage-section ${section.id === activeId ? "is-active" : ""}" data-section-panel="${section.id}">
                    <div class="cabinet-stage-head">
                      <div>
                        <h3>${escapeHtml(section.label)}</h3>
                        ${section.subtitle ? `<p class="panel-subtitle">${escapeHtml(section.subtitle)}</p>` : ""}
                      </div>
                    </div>
                    <div class="cabinet-grid">${section.body}</div>
                  </section>
                `,
              )
              .join("")}
          </div>
        </div>
      `;
    }

    function activateWorkspaceSection(button) {
      const workspace = button.closest("[data-role-workspace]");
      if (!workspace) {
        return;
      }
      const role = button.dataset.cabinetRole || workspace.dataset.roleWorkspace || "user";
      const sectionId = button.dataset.cabinetSection || "";
      rememberSection(role, sectionId);
      workspace.querySelectorAll(".cabinet-nav-button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      workspace.querySelectorAll(".cabinet-stage-section").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.sectionPanel === sectionId);
      });
    }

    async function loadBandRosters(bands) {
      const rosters = await Promise.all(
        bands.map(async (band) => {
          try {
            const roster = await request(`/bands/${band.id}/roster`);
            return [band.id, roster.musicians || []];
          } catch {
            return [band.id, []];
          }
        }),
      );
      return Object.fromEntries(rosters);
    }

    async function loadBandStats(bands) {
      const stats = await Promise.all(
        bands.map(async (band) => {
          try {
            const payload = await request(`/bands/${band.id}/stats`);
            return [band.id, payload];
          } catch {
            return [band.id, null];
          }
        }),
      );
      return Object.fromEntries(stats);
    }

    async function loadBandReleases(bands) {
      const releases = await Promise.all(
        bands.map(async (band) => {
          try {
            const payload = await request(`/bands/${band.id}/releases`);
            return [band.id, payload || []];
          } catch {
            return [band.id, []];
          }
        }),
      );
      return Object.fromEntries(releases);
    }

    async function loadBandInvitations(bands) {
      const invitations = await Promise.all(
        bands.map(async (band) => {
          try {
            const payload = await request(`/bands/${band.id}/invitations`);
            return [band.id, payload || []];
          } catch {
            return [band.id, []];
          }
        }),
      );
      return Object.fromEntries(invitations);
    }

    async function loadBandSchedules(bands) {
      const schedules = await Promise.all(
        bands.map(async (band) => {
          try {
            const payload = await request(`/bands/${band.id}/schedule`);
            return [band.id, payload || []];
          } catch {
            return [band.id, []];
          }
        }),
      );
      return Object.fromEntries(schedules);
    }

    function formatDateTime(value) {
      return new Intl.DateTimeFormat(language() === "ru" ? "ru-RU" : "en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    }

    function formatPrice(value) {
      return new Intl.NumberFormat(language() === "ru" ? "ru-RU" : "en-US", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(value);
    }

    function toInputDateTime(value) {
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function moderationTitle(status) {
      const titles = {
        pending: language() === "ru" ? "на модерации" : "pending review",
        approved: language() === "ru" ? "одобрено" : "approved",
        rejected: language() === "ru" ? "отклонено" : "rejected",
      };
      return titles[status] || status;
    }

    function groupByBandId(items) {
      return items.reduce((accumulator, item) => {
        const bucket = accumulator[item.band_id] || [];
        bucket.push(item);
        accumulator[item.band_id] = bucket;
        return accumulator;
      }, {});
    }

    function removeMusicianChipMarkup(roster, bandId) {
      if (!roster.length) {
        return `<div class="result-meta"><span>${escapeHtml(language() === "ru" ? "Состав пока не заполнен." : "The roster is still empty.")}</span></div>`;
      }
      return `
        <div class="tag-list">
          ${roster
            .map((musician) => {
              const fullName = [musician.first_name, musician.last_name].filter(Boolean).join(" ").trim();
              return `
                <span class="tag-chip tag-chip--interactive">
                  <span>${escapeHtml(fullName || musician.id)}</span>
                  <button
                    class="tag-chip-action roster-remove"
                    type="button"
                    data-band-id="${bandId}"
                    data-user-id="${musician.id}"
                    aria-label="${escapeHtml(language() === "ru" ? `Убрать ${fullName}` : `Remove ${fullName}`)}"
                  >
                    x
                  </button>
                </span>
              `;
            })
            .join("")}
        </div>
      `;
    }

    function rosterEmailFormMarkup(bandId) {
      return `
        <form class="roster-email-form" data-band-id="${bandId}">
          <label class="wide">
            ${escapeHtml(language() === "ru" ? "Найти музыканта по email" : "Find musician by email")}
            <input name="email" type="email" placeholder="musician@example.com" required />
          </label>
          <button class="ghost-button" type="submit">
            ${escapeHtml(language() === "ru" ? "Добавить по email" : "Add by email")}
          </button>
          <p class="status-line wide"></p>
        </form>
      `;
    }

    function concertRequestFormMarkup(band) {
      return `
        <form class="cabinet-form concert-request-form" data-band-id="${band.id}">
          <label>
            ${escapeHtml(language() === "ru" ? "Название концерта" : "Concert title")}
            <input name="title" type="text" placeholder="Summer Set" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Площадка" : "Venue")}
            <input name="venue" type="text" placeholder="Main Hall" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Город" : "City")}
            <input name="city" type="text" value="${escapeHtml(band.city || "")}" placeholder="Москва" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Дата и время" : "Date and time")}
            <input name="date_time" type="datetime-local" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Всего билетов" : "Total tickets")}
            <input name="tickets_total" type="number" min="1" value="100" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Доступно сейчас" : "Available now")}
            <input name="tickets_available" type="number" min="0" value="100" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Цена билета, ₽" : "Ticket price, RUB")}
            <input name="price" type="number" min="0" step="1" value="3000" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Статус" : "Status")}
            <select name="concert_status">
              <option value="planned">${deps.statusTitle("planned")}</option>
              <option value="completed">${deps.statusTitle("completed")}</option>
              <option value="cancelled">${deps.statusTitle("cancelled")}</option>
            </select>
          </label>
          <label class="wide">
            ${escapeHtml(language() === "ru" ? "Описание концерта" : "Concert description")}
            <textarea name="description" rows="4" placeholder="${escapeHtml(language() === "ru" ? "Программа, формат, особые условия, ссылки" : "Program, format, special notes, links")}"></textarea>
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Постер / медиа" : "Poster / media URL")}
            <input name="poster_url" type="url" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Ссылка на событие" : "Event URL")}
            <input name="external_url" type="url" placeholder="https://..." />
          </label>
          <button class="primary-button wide" type="submit">${escapeHtml(language() === "ru" ? "Отправить концерт на подтверждение" : "Send concert for approval")}</button>
          <p class="status-line wide"></p>
        </form>
      `;
    }

    function releaseFormMarkup(band) {
      return `
        <form class="cabinet-form release-form" data-band-id="${band.id}">
          <label>
            ${escapeHtml(language() === "ru" ? "Название релиза" : "Release title")}
            <input name="title" type="text" placeholder="Midnight EP" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Дата релиза" : "Release date")}
            <input name="release_date" type="datetime-local" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Обложка" : "Cover URL")}
            <input name="cover_url" type="url" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Ссылка на медиа" : "Media URL")}
            <input name="media_url" type="url" placeholder="https://..." />
          </label>
          <label class="wide">
            ${escapeHtml(language() === "ru" ? "Описание релиза" : "Release description")}
            <textarea name="description" rows="3" placeholder="${escapeHtml(language() === "ru" ? "Сингл, EP, альбом, тизер, пресс-текст" : "Single, EP, album, teaser, press text")}"></textarea>
          </label>
          <button class="ghost-button wide" type="submit">${escapeHtml(language() === "ru" ? "Отправить релиз на модерацию" : "Send release for moderation")}</button>
          <p class="status-line wide"></p>
        </form>
      `;
    }

    function moderationBadge(status) {
      return `<span class="state-card-label">${escapeHtml(moderationTitle(status))}</span>`;
    }

    function releaseCardsMarkup(releases) {
      if (!releases.length) {
        return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(language() === "ru" ? "Релизов пока нет." : "No releases yet.")}</span></div>`;
      }
      return releases
        .map(
          (release) => `
            <article class="result-card no-poster moderation-card">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(release.title)}</strong>
                  ${moderationBadge(release.status)}
                </div>
                <div class="result-meta">
                  <span>${formatDateTime(release.release_date)}</span>
                  ${release.media_url ? `<span>${escapeHtml(release.media_url)}</span>` : ""}
                </div>
                ${release.description ? `<p class="panel-subtitle">${escapeHtml(release.description)}</p>` : ""}
                ${release.admin_comment ? `<p class="status-line" data-tone="${release.status === "rejected" ? "error" : "success"}">${escapeHtml(release.admin_comment)}</p>` : ""}
              </div>
            </article>
          `,
        )
        .join("");
    }

    function concertRequestCardsMarkup(requests) {
      if (!requests.length) {
        return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(language() === "ru" ? "Заявок на концерты пока нет." : "No concert requests yet.")}</span></div>`;
      }
      return requests
        .map(
          (item) => `
            <article class="result-card no-poster moderation-card">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${moderationBadge(item.status)}
                </div>
                <div class="result-meta">
                  <span>${escapeHtml(item.city)}</span>
                  <span>${escapeHtml(item.venue)}</span>
                  <span>${formatDateTime(item.date_time)}</span>
                  <span>${formatPrice(item.price)}</span>
                </div>
                ${item.description ? `<p class="panel-subtitle">${escapeHtml(item.description)}</p>` : ""}
                ${item.admin_comment ? `<p class="status-line" data-tone="${item.status === "rejected" ? "error" : "success"}">${escapeHtml(item.admin_comment)}</p>` : ""}
              </div>
            </article>
          `,
        )
        .join("");
    }

    function notificationCardsMarkup(notifications) {
      if (!notifications.length) {
        return stateCardHtml(language() === "ru" ? "Уведомлений пока нет." : "No notifications yet.", "empty");
      }
      return notifications
        .map(
          (item) => `
            <article class="result-card no-poster moderation-card ${item.is_read ? "" : "notification-card--new"}">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="state-card-label">${escapeHtml(notificationTitle(item.kind))}</span>
                </div>
                <p class="panel-subtitle">${escapeHtml(item.body)}</p>
                <div class="form-actions">
                  <span class="result-meta">${formatDateTime(item.created_at)}</span>
                  ${item.is_read ? "" : `<button class="ghost-button compact mark-notification-read" type="button" data-notification-id="${item.id}">${escapeHtml(language() === "ru" ? "Прочитано" : "Mark read")}</button>`}
                </div>
              </div>
            </article>
          `,
        )
        .join("");
    }

    function actionLogCardsMarkup(logs) {
      if (!logs.length) {
        return stateCardHtml(language() === "ru" ? "Журнал пока пуст." : "The action log is empty.", "empty");
      }
      return logs
        .map(
          (item) => `
            <article class="result-card no-poster moderation-card">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(item.action)}</strong>
                  <span class="state-card-label">${escapeHtml(item.target_type)}</span>
                </div>
                <p class="panel-subtitle">${escapeHtml(item.summary)}</p>
                <div class="result-meta">
                  <span>${escapeHtml(item.actor_email || (language() === "ru" ? "система" : "system"))}</span>
                  <span>${formatDateTime(item.created_at)}</span>
                </div>
              </div>
            </article>
          `,
        )
        .join("");
    }

    function invitationCardsMarkup(invitations, bandsById, editable = false) {
      if (!invitations.length) {
        return stateCardHtml(language() === "ru" ? "Приглашений пока нет." : "No invitations yet.", "empty");
      }
      return invitations
        .map(
          (invitation) => `
            <article class="result-card no-poster moderation-card">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(bandsById[invitation.band_id]?.name || invitation.band_id)}</strong>
                  ${moderationBadge(invitation.status)}
                </div>
                ${invitation.message ? `<p class="panel-subtitle">${escapeHtml(invitation.message)}</p>` : ""}
                ${editable
                  ? `
                    <form class="cabinet-form invitation-decision-form" data-invitation-id="${invitation.id}">
                      <label class="wide">
                        ${escapeHtml(language() === "ru" ? "Комментарий" : "Comment")}
                        <textarea name="response_comment" rows="3" placeholder="${escapeHtml(language() === "ru" ? "Комментарий для менеджера" : "Comment for the manager")}">${escapeHtml(invitation.response_comment || "")}</textarea>
                      </label>
                      <div class="wide form-actions">
                        <button class="primary-button" type="submit" name="decision" value="accept">${escapeHtml(language() === "ru" ? "Принять" : "Accept")}</button>
                        <button class="ghost-button" type="submit" name="decision" value="reject">${escapeHtml(language() === "ru" ? "Отклонить" : "Decline")}</button>
                        <p class="status-line"></p>
                      </div>
                    </form>
                  `
                  : `${invitation.response_comment ? `<p class="status-line" data-tone="${invitation.status === "rejected" ? "error" : "success"}">${escapeHtml(invitation.response_comment)}</p>` : ""}`
                }
              </div>
            </article>
          `,
        )
        .join("");
    }

    function scheduleEventFormMarkup(band) {
      return `
        <form class="cabinet-form schedule-event-form" data-band-id="${band.id}">
          <label>
            ${escapeHtml(language() === "ru" ? "Название события" : "Event title")}
            <input name="title" type="text" placeholder="${escapeHtml(language() === "ru" ? "Репетиция в студии" : "Studio rehearsal")}" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Тип события" : "Event type")}
            <select name="event_type">
              <option value="concert">${escapeHtml(eventTypeTitle("concert"))}</option>
              <option value="rehearsal">${escapeHtml(eventTypeTitle("rehearsal"))}</option>
              <option value="meeting">${escapeHtml(eventTypeTitle("meeting"))}</option>
              <option value="other">${escapeHtml(eventTypeTitle("other"))}</option>
            </select>
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Начало" : "Start")}
            <input name="starts_at" type="datetime-local" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Окончание" : "End")}
            <input name="ends_at" type="datetime-local" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Площадка" : "Venue")}
            <input name="venue" type="text" placeholder="Studio A" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Город" : "City")}
            <input name="city" type="text" value="${escapeHtml(band.city || "")}" placeholder="Москва" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Статус" : "Status")}
            <select name="status">
              <option value="planned">${deps.statusTitle("planned")}</option>
              <option value="completed">${deps.statusTitle("completed")}</option>
              <option value="cancelled">${deps.statusTitle("cancelled")}</option>
            </select>
          </label>
          <label class="wide">
            ${escapeHtml(language() === "ru" ? "Комментарий" : "Notes")}
            <textarea name="notes" rows="3" placeholder="${escapeHtml(language() === "ru" ? "Что нужно подготовить, дресс-код, техника" : "Prep list, dress code, technical notes")}"></textarea>
          </label>
          <button class="primary-button wide" type="submit">${escapeHtml(language() === "ru" ? "Добавить событие в расписание" : "Add to schedule")}</button>
          <p class="status-line wide"></p>
        </form>
      `;
    }

    function managerScheduleEventCardsMarkup(events) {
      if (!events.length) {
        return stateCardHtml(language() === "ru" ? "Событий в расписании пока нет." : "No schedule events yet.", "empty");
      }
      return events
        .map(
          (eventItem) => `
            <article class="result-card no-poster">
              <form class="cabinet-form schedule-event-edit-form" data-event-id="${eventItem.id}">
                <div class="wide moderation-card-head">
                  <strong>${escapeHtml(eventItem.title)}</strong>
                  <span class="state-card-label">${escapeHtml(eventTypeTitle(eventItem.event_type))}</span>
                </div>
                <div class="wide result-meta">
                  <span>${escapeHtml(eventItem.band_name || "")}</span>
                  <span>${escapeHtml(eventItem.city)}</span>
                  <span>${escapeHtml(eventItem.venue)}</span>
                  <span>${formatDateTime(eventItem.starts_at)}</span>
                  <span>${escapeHtml(participationTitle(eventItem.my_response))}</span>
                  <span>${eventItem.confirmed_count}/${eventItem.confirmed_count + eventItem.declined_count} ${escapeHtml(language() === "ru" ? "ответов" : "responses")}</span>
                </div>
                <label>
                  ${escapeHtml(language() === "ru" ? "Название" : "Title")}
                  <input name="title" type="text" value="${escapeHtml(eventItem.title)}" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Тип" : "Type")}
                  <select name="event_type">
                    ${["concert", "rehearsal", "meeting", "other"]
                      .map((type) => `<option value="${type}" ${eventItem.event_type === type ? "selected" : ""}>${escapeHtml(eventTypeTitle(type))}</option>`)
                      .join("")}
                  </select>
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Начало" : "Start")}
                  <input name="starts_at" type="datetime-local" value="${toInputDateTime(eventItem.starts_at)}" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Окончание" : "End")}
                  <input name="ends_at" type="datetime-local" value="${toInputDateTime(eventItem.ends_at)}" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Площадка" : "Venue")}
                  <input name="venue" type="text" value="${escapeHtml(eventItem.venue)}" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Город" : "City")}
                  <input name="city" type="text" value="${escapeHtml(eventItem.city)}" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Статус" : "Status")}
                  <select name="status">
                    ${["planned", "completed", "cancelled"]
                      .map((status) => `<option value="${status}" ${eventItem.status === status ? "selected" : ""}>${deps.statusTitle(status)}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="wide">
                  ${escapeHtml(language() === "ru" ? "Комментарий" : "Notes")}
                  <textarea name="notes" rows="3">${escapeHtml(eventItem.notes || "")}</textarea>
                </label>
                <div class="wide form-actions">
                  <button class="primary-button" type="submit">${escapeHtml(language() === "ru" ? "Сохранить событие" : "Save event")}</button>
                  <p class="status-line"></p>
                </div>
              </form>
            </article>
          `,
        )
        .join("");
    }

    function musicianScheduleCardsMarkup(events) {
      if (!events.length) {
        return stateCardHtml(language() === "ru" ? "Ваше расписание пока пустое." : "Your schedule is empty.", "empty");
      }
      return events
        .map(
          (eventItem) => `
            <article class="result-card no-poster">
              <form class="cabinet-form schedule-response-form" data-event-id="${eventItem.id}">
                <div class="wide moderation-card-head">
                  <strong>${escapeHtml(eventItem.title)}</strong>
                  <span class="state-card-label">${escapeHtml(eventTypeTitle(eventItem.event_type))}</span>
                </div>
                <div class="wide result-meta">
                  <span>${escapeHtml(eventItem.band_name)}</span>
                  <span>${escapeHtml(eventItem.city)}</span>
                  <span>${escapeHtml(eventItem.venue)}</span>
                  <span>${formatDateTime(eventItem.starts_at)}</span>
                  <span>${escapeHtml(deps.statusTitle(eventItem.status))}</span>
                </div>
                ${eventItem.notes ? `<p class="panel-subtitle wide">${escapeHtml(eventItem.notes)}</p>` : ""}
                <label>
                  ${escapeHtml(language() === "ru" ? "Ваш ответ" : "Your response")}
                  <select name="status">
                    ${["pending", "confirmed", "declined"]
                      .map((status) => `<option value="${status}" ${eventItem.my_response === status ? "selected" : ""}>${escapeHtml(participationTitle(status))}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="wide">
                  ${escapeHtml(language() === "ru" ? "Комментарий менеджеру" : "Comment to the manager")}
                  <textarea name="comment" rows="3">${escapeHtml(eventItem.response_comment || "")}</textarea>
                </label>
                <div class="wide form-actions">
                  <button class="primary-button" type="submit">${escapeHtml(language() === "ru" ? "Сохранить ответ" : "Save response")}</button>
                  <p class="status-line"></p>
                </div>
              </form>
            </article>
          `,
        )
        .join("");
    }

    function managerConcertEditFormMarkup(concert) {
      return `
        <article class="result-card no-poster">
          <form class="cabinet-form manager-concert-edit-form" data-concert-id="${concert.id}">
            <div class="wide">
              <strong>${escapeHtml(concert.title)}</strong>
              <div class="result-meta">
                <span>${escapeHtml(concert.city)}</span>
                <span>${escapeHtml(concert.venue)}</span>
                <span>${formatDateTime(concert.date_time)}</span>
              </div>
            </div>
            <label>
              ${escapeHtml(language() === "ru" ? "Название" : "Title")}
              <input name="title" type="text" value="${escapeHtml(concert.title)}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Площадка" : "Venue")}
              <input name="venue" type="text" value="${escapeHtml(concert.venue)}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Город" : "City")}
              <input name="city" type="text" value="${escapeHtml(concert.city)}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Дата и время" : "Date and time")}
              <input name="date_time" type="datetime-local" value="${toInputDateTime(concert.date_time)}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Всего билетов" : "Total tickets")}
              <input name="tickets_total" type="number" min="1" value="${concert.tickets_total}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Доступно сейчас" : "Available now")}
              <input name="tickets_available" type="number" min="0" value="${concert.tickets_available}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Цена билета, ₽" : "Ticket price, RUB")}
              <input name="price" type="number" min="0" step="1" value="${concert.price}" required />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Статус" : "Status")}
              <select name="status">
                ${["planned", "completed", "cancelled"]
                  .map((status) => `<option value="${status}" ${concert.status === status ? "selected" : ""}>${deps.statusTitle(status)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="wide">
              ${escapeHtml(language() === "ru" ? "Описание концерта" : "Concert description")}
              <textarea name="description" rows="4">${escapeHtml(concert.description || "")}</textarea>
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Постер / медиа" : "Poster / media URL")}
              <input name="poster_url" type="url" value="${escapeHtml(concert.poster_url || "")}" placeholder="https://..." />
            </label>
            <label>
              ${escapeHtml(language() === "ru" ? "Ссылка на событие" : "Event URL")}
              <input name="external_url" type="url" value="${escapeHtml(concert.external_url || "")}" placeholder="https://..." />
            </label>
            <div class="wide form-actions">
              <button class="primary-button" type="submit">${t("common.save")}</button>
              <button class="ghost-button cancel-managed-concert" type="button" data-concert-id="${concert.id}">${escapeHtml(language() === "ru" ? "Отменить концерт" : "Cancel concert")}</button>
            </div>
            <p class="status-line wide"></p>
          </form>
        </article>
      `;
    }

    function concertStatusSectionsMarkup(concerts) {
      const now = Date.now();
      const groups = [
        {
          key: "planned",
          title: language() === "ru" ? "Запланированные" : "Planned",
          items: concerts.filter((concert) => concert.status === "planned" && new Date(concert.date_time).getTime() > now),
        },
        {
          key: "completed",
          title: language() === "ru" ? "Прошедшие" : "Past",
          items: concerts.filter((concert) => concert.status === "completed" || (concert.status === "planned" && new Date(concert.date_time).getTime() <= now)),
        },
        {
          key: "cancelled",
          title: language() === "ru" ? "Отмененные" : "Cancelled",
          items: concerts.filter((concert) => concert.status === "cancelled"),
        },
      ];
      return groups
        .map(
          (group) => `
            <details class="status-catalog" ${group.key === "planned" ? "open" : ""}>
              <summary>
                <span>${escapeHtml(group.title)}</span>
                <span>${group.items.length}</span>
              </summary>
              <div class="status-catalog-body">
                ${
                  group.items.length
                    ? group.items.map(managerConcertEditFormMarkup).join("")
                    : `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(language() === "ru" ? "В этом разделе пока пусто." : "Nothing in this section yet.")}</span></div>`
                }
              </div>
            </details>
          `,
        )
        .join("");
    }

    function managerBandCatalogMarkup(bands, rostersByBand, statsByBand, concertsByBand, requestsByBand, releasesByBand) {
      if (!bands.length) {
        return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(language() === "ru" ? "У менеджера пока нет групп." : "This manager does not have bands yet.")}</span></div>`;
      }

      return bands
        .map((band) => {
          const roster = rostersByBand[band.id] || [];
          const stats = statsByBand[band.id];
          const concerts = concertsByBand[band.id] || [];
          const concertRequests = requestsByBand[band.id] || [];
          const releases = releasesByBand[band.id] || [];
          return `
            <details class="manager-band-catalog" open>
              <summary>
                <div class="manager-band-summary">
                  <div>
                    <strong>${escapeHtml(band.name)}</strong>
                    <div class="result-meta">
                      <span>${escapeHtml(band.genre)}</span>
                      <span>${escapeHtml(band.city || (language() === "ru" ? "город не указан" : "city not specified"))}</span>
                      ${stats ? `<span>${stats.future_tickets_sold} ${escapeHtml(language() === "ru" ? "продано" : "sold")}</span>` : ""}
                    </div>
                  </div>
                  <div class="manager-band-summary-stats">
                    <span>${concerts.length} ${escapeHtml(language() === "ru" ? "концертов" : "concerts")}</span>
                    <span>${concertRequests.filter((item) => item.status === "pending").length} ${escapeHtml(language() === "ru" ? "заявок" : "requests")}</span>
                    <span>${releases.length} ${escapeHtml(language() === "ru" ? "релизов" : "releases")}</span>
                  </div>
                </div>
              </summary>
              <div class="manager-band-body">
                ${bandCardsHtml([band], rostersByBand, { statsByBand, editable: true, candidatesByBand: {} })}
                <section class="manager-subsection">
                  <div class="cabinet-card-head">
                    <h3>${escapeHtml(language() === "ru" ? "Состав группы" : "Band roster")}</h3>
                    <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Поиск музыкантов только по email, без общего списка." : "Musicians are added by email only, without a public search list.")}</p>
                  </div>
                  ${removeMusicianChipMarkup(roster, band.id)}
                  ${rosterEmailFormMarkup(band.id)}
                </section>
                <section class="manager-subsection">
                  <div class="cabinet-card-head">
                    <h3>${escapeHtml(language() === "ru" ? "Новый концерт" : "New concert request")}</h3>
                    <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Новый концерт сначала уходит на подтверждение администрации." : "New concerts go to admin approval before publication.")}</p>
                  </div>
                  ${concertRequestFormMarkup(band)}
                </section>
                <section class="manager-subsection">
                  <div class="cabinet-card-head">
                    <h3>${escapeHtml(language() === "ru" ? "Заявки на концерты" : "Concert requests")}</h3>
                    <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Отслеживайте, какие события уже отправлены на модерацию." : "Track which events are already waiting for moderation.")}</p>
                  </div>
                  <div class="ticket-list">${concertRequestCardsMarkup(concertRequests)}</div>
                </section>
                <section class="manager-subsection">
                  <div class="cabinet-card-head">
                    <h3>${escapeHtml(language() === "ru" ? "Релизы группы" : "Band releases")}</h3>
                    <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Релизы тоже проходят модерацию перед публикацией." : "Releases also go through moderation before publication.")}</p>
                  </div>
                  ${releaseFormMarkup(band)}
                  <div class="ticket-list">${releaseCardsMarkup(releases)}</div>
                </section>
                <section class="manager-subsection">
                  <div class="cabinet-card-head">
                    <h3>${escapeHtml(language() === "ru" ? "Каталог концертов группы" : "Band concert catalog")}</h3>
                    <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Каждый статус открывается как отдельный раздел." : "Each status opens as a separate catalog section.")}</p>
                  </div>
                  ${concertStatusSectionsMarkup(concerts)}
                </section>
              </div>
            </details>
          `;
        })
        .join("");
    }

    function bandRequestListMarkup(requests) {
      if (!requests.length) {
        return `<div class="result-card no-poster"><span class="result-meta">${escapeHtml(language() === "ru" ? "Заявок на новые группы пока нет." : "No new band requests yet.")}</span></div>`;
      }
      return requests
        .map(
          (requestItem) => `
            <article class="result-card no-poster moderation-card">
              <div class="result-card-body">
                <div class="moderation-card-head">
                  <strong>${escapeHtml(requestItem.name)}</strong>
                  ${moderationBadge(requestItem.status)}
                </div>
                <div class="result-meta">
                  <span>${escapeHtml(requestItem.genre)}</span>
                  ${requestItem.city ? `<span>${escapeHtml(requestItem.city)}</span>` : ""}
                </div>
                ${requestItem.description ? `<p class="panel-subtitle">${escapeHtml(requestItem.description)}</p>` : ""}
                ${requestItem.admin_comment ? `<p class="status-line" data-tone="${requestItem.status === "rejected" ? "error" : "success"}">${escapeHtml(requestItem.admin_comment)}</p>` : ""}
              </div>
            </article>
          `,
        )
        .join("");
    }

    function managerBandRequestFormMarkup() {
      return `
        <form class="cabinet-form band-request-form">
          <label>
            ${escapeHtml(language() === "ru" ? "Название группы" : "Band name")}
            <input name="name" type="text" placeholder="Neon District" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Жанр" : "Genre")}
            <input name="genre" type="text" placeholder="indie" required />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Базовый город" : "Home city")}
            <input name="city" type="text" placeholder="Москва" />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Обложка / постер" : "Cover URL")}
            <input name="cover_url" type="url" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Сайт группы" : "Band website")}
            <input name="website_url" type="url" placeholder="https://..." />
          </label>
          <label>
            ${escapeHtml(language() === "ru" ? "Instagram / соцсеть" : "Instagram / social link")}
            <input name="instagram_url" type="url" placeholder="https://..." />
          </label>
          <label class="wide">
            ${escapeHtml(language() === "ru" ? "Описание группы" : "Band description")}
            <textarea name="description" rows="4" placeholder="${escapeHtml(language() === "ru" ? "Опишите состав, жанр, стиль и медиа" : "Describe the lineup, genre, style, and media")}"></textarea>
          </label>
          <button class="primary-button wide" type="submit">${escapeHtml(language() === "ru" ? "Отправить группу на подтверждение" : "Send band for approval")}</button>
          <p class="status-line wide"></p>
        </form>
      `;
    }

    function adminBandRequestCardsMarkup(requests, usersById) {
      if (!requests.length) {
        return stateCardHtml(language() === "ru" ? "Ожидающих заявок на группы нет." : "No pending band requests.", "empty");
      }
      return requests
        .map((requestItem) => {
          const manager = usersById[requestItem.manager_id];
          return `
            <article class="result-card no-poster moderation-card">
              <form class="cabinet-form admin-band-request-form" data-request-id="${requestItem.id}">
                <div class="wide moderation-card-head">
                  <strong>${escapeHtml(requestItem.name)}</strong>
                  ${moderationBadge(requestItem.status)}
                </div>
                <div class="wide result-meta">
                  <span>${escapeHtml(requestItem.genre)}</span>
                  ${requestItem.city ? `<span>${escapeHtml(requestItem.city)}</span>` : ""}
                  ${manager ? `<span>${escapeHtml(manager.email)}</span>` : ""}
                </div>
                <label class="wide">
                  ${escapeHtml(language() === "ru" ? "Комментарий администратора" : "Admin comment")}
                  <textarea name="admin_comment" rows="3" placeholder="${escapeHtml(language() === "ru" ? "Причина решения или условия публикации" : "Reason for the decision or publication conditions")}">${escapeHtml(requestItem.admin_comment || "")}</textarea>
                </label>
                <div class="wide form-actions">
                  <button class="primary-button" type="submit" name="decision" value="approve">${escapeHtml(language() === "ru" ? "Одобрить группу" : "Approve band")}</button>
                  <button class="ghost-button" type="submit" name="decision" value="reject">${escapeHtml(language() === "ru" ? "Отклонить" : "Reject")}</button>
                  <p class="status-line"></p>
                </div>
              </form>
            </article>
          `;
        })
        .join("");
    }

    function adminConcertRequestCardsMarkup(requests, bandsById) {
      if (!requests.length) {
        return stateCardHtml(language() === "ru" ? "Ожидающих заявок на концерты нет." : "No pending concert requests.", "empty");
      }
      return requests
        .map((requestItem) => `
          <article class="result-card no-poster moderation-card">
            <form class="cabinet-form admin-concert-request-form" data-request-id="${requestItem.id}">
              <div class="wide moderation-card-head">
                <strong>${escapeHtml(requestItem.title)}</strong>
                ${moderationBadge(requestItem.status)}
              </div>
              <div class="wide result-meta">
                <span>${escapeHtml(bandsById[requestItem.band_id]?.name || requestItem.band_id)}</span>
                <span>${escapeHtml(requestItem.city)}</span>
                <span>${escapeHtml(requestItem.venue)}</span>
                <span>${formatDateTime(requestItem.date_time)}</span>
              </div>
              <label class="wide">
                ${escapeHtml(language() === "ru" ? "Комментарий администратора" : "Admin comment")}
                <textarea name="admin_comment" rows="3">${escapeHtml(requestItem.admin_comment || "")}</textarea>
              </label>
              <div class="wide form-actions">
                <button class="primary-button" type="submit" name="decision" value="approve">${escapeHtml(language() === "ru" ? "Опубликовать концерт" : "Publish concert")}</button>
                <button class="ghost-button" type="submit" name="decision" value="reject">${escapeHtml(language() === "ru" ? "Отклонить" : "Reject")}</button>
                <p class="status-line"></p>
              </div>
            </form>
          </article>
        `)
        .join("");
    }

    function adminReleaseCardsMarkup(releases, bandsById) {
      if (!releases.length) {
        return stateCardHtml(language() === "ru" ? "Релизов пока нет." : "No releases yet.", "empty");
      }
      return releases
        .map((release) => `
          <article class="result-card no-poster moderation-card">
            <form class="cabinet-form admin-release-form" data-release-id="${release.id}">
              <div class="wide moderation-card-head">
                <strong>${escapeHtml(release.title)}</strong>
                ${moderationBadge(release.status)}
              </div>
              <div class="wide result-meta">
                <span>${escapeHtml(bandsById[release.band_id]?.name || release.band_id)}</span>
                <span>${formatDateTime(release.release_date)}</span>
              </div>
              <label>
                ${escapeHtml(language() === "ru" ? "Название релиза" : "Release title")}
                <input name="title" type="text" value="${escapeHtml(release.title)}" required />
              </label>
              <label>
                ${escapeHtml(language() === "ru" ? "Дата релиза" : "Release date")}
                <input name="release_date" type="datetime-local" value="${toInputDateTime(release.release_date)}" required />
              </label>
              <label>
                ${escapeHtml(language() === "ru" ? "Обложка" : "Cover URL")}
                <input name="cover_url" type="url" value="${escapeHtml(release.cover_url || "")}" placeholder="https://..." />
              </label>
              <label>
                ${escapeHtml(language() === "ru" ? "Медиа-ссылка" : "Media URL")}
                <input name="media_url" type="url" value="${escapeHtml(release.media_url || "")}" placeholder="https://..." />
              </label>
              <label class="wide">
                ${escapeHtml(language() === "ru" ? "Описание" : "Description")}
                <textarea name="description" rows="4">${escapeHtml(release.description || "")}</textarea>
              </label>
              <label class="wide">
                ${escapeHtml(language() === "ru" ? "Комментарий администратора" : "Admin comment")}
                <textarea name="admin_comment" rows="3">${escapeHtml(release.admin_comment || "")}</textarea>
              </label>
              <div class="wide form-actions">
                <button class="primary-button" type="submit" name="action" value="save">${escapeHtml(language() === "ru" ? "Сохранить релиз" : "Save release")}</button>
                <button class="ghost-button" type="submit" name="action" value="approve">${escapeHtml(language() === "ru" ? "Одобрить" : "Approve")}</button>
                <button class="ghost-button" type="submit" name="action" value="reject">${escapeHtml(language() === "ru" ? "Отклонить" : "Reject")}</button>
                <button class="ghost-button danger-button" type="submit" name="action" value="delete">${escapeHtml(language() === "ru" ? "Удалить" : "Delete")}</button>
                <p class="status-line"></p>
              </div>
            </form>
          </article>
        `)
        .join("");
    }

    async function renderRegisteredCabinet() {
      if (!elements.cabinetSubtitle || !elements.cabinetContent || !currentUser()) {
        return;
      }

      const user = currentUser();
      const tickets = await requestOr("/tickets/my", []);
      const notifications = await requestOr("/users/notifications", []);
      elements.cabinetSubtitle.textContent = `${user.email} · ${language() === "ru" ? "личный кабинет" : "personal cabinet"}`;
      const sections = [
        {
          id: "dashboard",
          label: language() === "ru" ? "Дашборд" : "Dashboard",
          subtitle: language() === "ru" ? "Быстрый доступ к билетам и основным действиям." : "Fast access to tickets and core actions.",
          body: `${baseOverviewCard(user, tickets)}${discoverCard(user.role)}${ticketsCard(tickets)}`,
        },
        {
          id: "notifications",
          label: language() === "ru" ? "Уведомления" : "Notifications",
          subtitle: language() === "ru" ? "История системных и продуктовых событий." : "System and product activity feed.",
          count: notifications.filter((item) => !item.is_read).length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Все уведомления" : "All notifications",
            subtitle: language() === "ru" ? "Новые и уже прочитанные сообщения." : "Unread and historical notifications.",
            wide: true,
            body: `<div class="ticket-list">${notificationCardsMarkup(notifications)}</div>`,
          })}`,
        },
        {
          id: "settings",
          label: language() === "ru" ? "Настройки профиля" : "Profile settings",
          subtitle: language() === "ru" ? "Контактные данные и аккаунт." : "Contact details and account settings.",
          body: `${profileFormCard(user)}`,
        },
      ];
      elements.cabinetContent.innerHTML = workspaceLayoutMarkup("registered_user", sections);
    }

    async function renderMusicianCabinet() {
      if (!elements.cabinetSubtitle || !elements.cabinetContent || !currentUser()) {
        return;
      }

      const user = currentUser();
      elements.cabinetSubtitle.textContent = `${user.email} · ${language() === "ru" ? "кабинет музыканта" : "musician cabinet"}`;
      elements.cabinetContent.innerHTML = stateCardHtml(
        language() === "ru" ? "Загружаем кабинет музыканта..." : "Loading musician cabinet...",
        "loading",
      );

      const [tickets, bands, concerts, invitations, notifications, schedule] = await Promise.all([
        requestOr("/tickets/my", []),
        requestOr("/bands/my", []),
        requestOr("/concerts/my", []),
        requestOr("/bands/my-invitations", []),
        requestOr("/users/notifications", []),
        requestOr("/bands/my-schedule", []),
      ]);
      const rostersByBand = await loadBandRosters(bands);
      const bandsById = Object.fromEntries(bands.map((item) => [item.id, item]));

      const sections = [
        {
          id: "dashboard",
          label: language() === "ru" ? "Дашборд" : "Dashboard",
          subtitle: language() === "ru" ? "Быстрый обзор ваших групп, билетов и задач." : "A fast summary of your bands, tickets, and activity.",
          body: `${baseOverviewCard(user, tickets)}${ticketsCard(tickets)}`,
        },
        {
          id: "schedule",
          label: language() === "ru" ? "Мое расписание" : "My schedule",
          subtitle: language() === "ru" ? "Концерты, репетиции, встречи и ответы на участие." : "Concerts, rehearsals, meetings, and participation responses.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Календарь музыканта" : "Musician schedule",
            subtitle: language() === "ru" ? "Откройте событие и подтвердите участие." : "Open an event and confirm your attendance.",
            wide: true,
            body: `<div class="ticket-list">${musicianScheduleCardsMarkup(schedule)}</div>`,
          })}`,
        },
        {
          id: "groups",
          label: language() === "ru" ? "Мои группы" : "My bands",
          subtitle: language() === "ru" ? "Составы и проекты, где вы участвуете." : "Lineups and projects you are part of.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Группы" : "Bands",
            subtitle: language() === "ru" ? "Текущие коллективы и их состав." : "Current bands and their rosters.",
            wide: true,
            body: `<div class="ticket-list">${bandCardsHtml(bands, rostersByBand)}</div>`,
          })}`,
        },
        {
          id: "concerts",
          label: language() === "ru" ? "Концерты" : "Concerts",
          subtitle: language() === "ru" ? "Все ближайшие выступления ваших групп." : "All upcoming performances across your bands.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Афиша музыканта" : "Performance list",
            subtitle: language() === "ru" ? "Удобный список будущих концертов." : "A clean list of your upcoming concerts.",
            wide: true,
            body: `<div class="ticket-list">${scheduleConcertsHtml(concerts)}</div>`,
          })}`,
        },
        {
          id: "invitations",
          label: language() === "ru" ? "Приглашения" : "Invitations",
          subtitle: language() === "ru" ? "Новые приглашения в группы и история ответов." : "New band invitations and your response history.",
          count: invitations.filter((item) => item.status === "pending").length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Приглашения в группы" : "Band invitations",
            subtitle: language() === "ru" ? "Можно принять или отклонить приглашение с комментарием." : "Accept or decline invitations with a comment.",
            wide: true,
            body: `<div class="ticket-list">${invitationCardsMarkup(invitations, bandsById, true)}</div>`,
          })}`,
        },
        {
          id: "notifications",
          label: language() === "ru" ? "Уведомления" : "Notifications",
          subtitle: language() === "ru" ? "Изменения расписания и приглашений." : "Schedule changes and invitation activity.",
          count: notifications.filter((item) => !item.is_read).length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Лента уведомлений" : "Notification feed",
            subtitle: language() === "ru" ? "Все последние изменения по вашим группам." : "The latest changes across your bands.",
            wide: true,
            body: `<div class="ticket-list">${notificationCardsMarkup(notifications)}</div>`,
          })}`,
        },
        {
          id: "profile",
          label: language() === "ru" ? "Профиль" : "Profile",
          subtitle: language() === "ru" ? "Данные аккаунта музыканта." : "Your musician account details.",
          body: `${profileFormCard(user)}`,
        },
      ];

      elements.cabinetContent.innerHTML = workspaceLayoutMarkup("musician", sections);
    }

    async function loadAdminUsers() {
      const list = document.querySelector("#admin-user-list");
      const managerList = document.querySelector("#manager-select");
      if (!list || !managerList) {
        return;
      }

      let users = [];
      try {
        users = await request("/admin/users");
      } catch (error) {
        list.innerHTML = stateCardHtml(error.message, "error");
        managerList.innerHTML = `<option value="">${escapeHtml(language() === "ru" ? "Пользователи недоступны" : "Users unavailable")}</option>`;
        return;
      }

      list.innerHTML = users.map(adminUserRow).join("");
      managerList.innerHTML = users
        .filter((user) => user.role === "manager" || user.role === "admin")
        .map((user) => {
          const fullName = [user.profile?.first_name, user.profile?.last_name].filter(Boolean).join(" ").trim();
          const label = fullName ? `${user.email} · ${fullName}` : user.email;
          return `<option value="${user.id}">${escapeHtml(label)}</option>`;
        })
        .join("");

      if (!managerList.querySelector("option[value='']")) {
        managerList.insertAdjacentHTML(
          "afterbegin",
          `<option value="">${escapeHtml(language() === "ru" ? "Выберите менеджера" : "Choose a manager")}</option>`,
        );
      }
    }

    async function renderAdminCabinet() {
      if (!elements.cabinetSubtitle || !elements.cabinetContent || !currentUser()) {
        return;
      }

      const user = currentUser();
      const tickets = await requestOr("/tickets/my", []);
      elements.cabinetSubtitle.textContent = `${user.email} · ${language() === "ru" ? "кабинет администратора" : "admin cabinet"}`;

      const [users, bands, bandRequests, concertRequests, releases, notifications, actionLog] = await Promise.all([
        requestOr("/admin/users", []),
        requestOr("/admin/bands", []),
        requestOr("/admin/band-requests", []),
        requestOr("/admin/concert-requests", []),
        requestOr("/admin/releases", []),
        requestOr("/users/notifications", []),
        requestOr("/admin/action-log", []),
      ]);
      const usersById = Object.fromEntries(users.map((item) => [item.id, item]));
      const bandsById = Object.fromEntries(bands.map((item) => [item.id, item]));

      const sections = [
        {
          id: "dashboard",
          label: language() === "ru" ? "Дашборд" : "Dashboard",
          subtitle: language() === "ru" ? "Ключевые показатели модерации и пользователей." : "Key moderation and user metrics.",
          body: `${baseOverviewCard(user, tickets)}${cabinetCard({
            title: language() === "ru" ? "Итоги модерации" : "Moderation overview",
            subtitle: language() === "ru" ? "Сколько новых заявок и релизов ждут решения." : "How many requests and releases are waiting for a decision.",
            span: "7",
            body: `
              <div class="cabinet-stats">
                <div class="cabinet-stat"><strong>${concertRequests.filter((item) => item.status === "pending").length}</strong><span>${escapeHtml(language() === "ru" ? "новых концертов" : "new concerts")}</span></div>
                <div class="cabinet-stat"><strong>${bandRequests.filter((item) => item.status === "pending").length}</strong><span>${escapeHtml(language() === "ru" ? "новых групп" : "new bands")}</span></div>
                <div class="cabinet-stat"><strong>${releases.filter((item) => item.status === "pending").length}</strong><span>${escapeHtml(language() === "ru" ? "релизов на проверке" : "releases in review")}</span></div>
              </div>
            `,
          })}`,
        },
        {
          id: "concerts",
          label: language() === "ru" ? "Концерты" : "Concerts",
          subtitle: language() === "ru" ? "Новые, одобренные и отклоненные заявки на концерты." : "New, approved, and rejected concert requests.",
          count: concertRequests.filter((item) => item.status === "pending").length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Новые заявки" : "New requests",
            subtitle: language() === "ru" ? "Концерты, ожидающие решения." : "Concerts waiting for a decision.",
            wide: true,
            body: `<div class="ticket-list">${adminConcertRequestCardsMarkup(concertRequests.filter((item) => item.status === "pending"), bandsById)}</div>`,
          })}${cabinetCard({
            title: language() === "ru" ? "История решений" : "Decision history",
            subtitle: language() === "ru" ? "Одобренные и отклоненные концерты." : "Approved and rejected concerts.",
            wide: true,
            body: `<div class="ticket-list">${adminConcertRequestCardsMarkup(concertRequests.filter((item) => item.status !== "pending"), bandsById)}</div>`,
          })}`,
        },
        {
          id: "groups",
          label: language() === "ru" ? "Группы" : "Bands",
          subtitle: language() === "ru" ? "Заявки менеджеров и ручное создание групп." : "Manager band requests and manual band creation.",
          count: bandRequests.filter((item) => item.status === "pending").length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Создать группу" : "Create band",
            subtitle: language() === "ru" ? "Назначьте менеджера и создайте новую карточку группы." : "Assign a manager and create a new band card.",
            body: `
              <form class="cabinet-form" id="admin-band-form">
                <label>
                  ${escapeHtml(language() === "ru" ? "Название группы" : "Band name")}
                  <input name="name" type="text" placeholder="Waves Band" required />
                </label>
                <label>
                  ${escapeHtml(language() === "ru" ? "Жанр" : "Genre")}
                  <input name="genre" type="text" list="genre-list" placeholder="rock" required />
                </label>
                <label class="wide">
                  ${escapeHtml(language() === "ru" ? "Менеджер" : "Manager")}
                  <select name="manager_id" id="manager-select" required>
                    <option value="">${escapeHtml(language() === "ru" ? "Выберите менеджера" : "Choose a manager")}</option>
                  </select>
                </label>
                <button class="primary-button wide" type="submit">${language() === "ru" ? "Создать группу" : "Create band"}</button>
                <p class="status-line wide" id="admin-band-status"></p>
              </form>
            `,
          })}${cabinetCard({
            title: language() === "ru" ? "Новые заявки на группы" : "New band requests",
            subtitle: language() === "ru" ? "Ожидают одобрения или отказа." : "Waiting for approval or rejection.",
            wide: true,
            body: `<div class="ticket-list">${adminBandRequestCardsMarkup(bandRequests.filter((item) => item.status === "pending"), usersById)}</div>`,
          })}${cabinetCard({
            title: language() === "ru" ? "История заявок" : "Request history",
            subtitle: language() === "ru" ? "Ранее обработанные группы." : "Previously processed band requests.",
            wide: true,
            body: `<div class="ticket-list">${adminBandRequestCardsMarkup(bandRequests.filter((item) => item.status !== "pending"), usersById)}</div>`,
          })}`,
        },
        {
          id: "releases",
          label: language() === "ru" ? "Релизы" : "Releases",
          subtitle: language() === "ru" ? "Модерация, редактирование и удаление материалов." : "Moderation, editing, and deletion of release materials.",
          count: releases.filter((item) => item.status === "pending").length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Релизы платформы" : "Platform releases",
            subtitle: language() === "ru" ? "Один раздел для проверки, правок и скрытия контента." : "One section to review, edit, and remove content.",
            wide: true,
            body: `<div class="ticket-list">${adminReleaseCardsMarkup(releases, bandsById)}</div>`,
          })}`,
        },
        {
          id: "users",
          label: language() === "ru" ? "Пользователи" : "Users",
          subtitle: language() === "ru" ? "Роли, доступы и аккаунты." : "Roles, permissions, and accounts.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Пользователи и роли" : "Users and roles",
            subtitle: language() === "ru" ? "Администрирование доступа к платформе." : "Platform access administration.",
            wide: true,
            body: `
              <div class="panel-heading">
                <span>${language() === "ru" ? "Текущие роли и аккаунты" : "Current roles and accounts"}</span>
                <button class="ghost-button compact" type="button" id="refresh-admin-users">${t("common.refresh")}</button>
              </div>
              <div class="admin-user-list" id="admin-user-list">
                ${stateCardHtml(language() === "ru" ? "Загружаем пользователей..." : "Loading users...", "loading")}
              </div>
            `,
          })}`,
        },
        {
          id: "notifications",
          label: language() === "ru" ? "Уведомления" : "Notifications",
          subtitle: language() === "ru" ? "Оповещения администратора и системные события." : "Admin alerts and system events.",
          count: notifications.filter((item) => !item.is_read).length,
          body: `${cabinetCard({
            title: language() === "ru" ? "Уведомления" : "Notifications",
            subtitle: language() === "ru" ? "Что изменилось на платформе." : "What changed across the platform.",
            wide: true,
            body: `<div class="ticket-list">${notificationCardsMarkup(notifications)}</div>`,
          })}`,
        },
        {
          id: "log",
          label: language() === "ru" ? "Журнал действий" : "Action log",
          subtitle: language() === "ru" ? "Кто, что и когда изменил." : "Who changed what and when.",
          body: `${cabinetCard({
            title: language() === "ru" ? "История действий" : "Action history",
            subtitle: language() === "ru" ? "Создание, одобрение, отклонение и удаление материалов." : "Creation, approval, rejection, and deletion history.",
            wide: true,
            body: `<div class="ticket-list">${actionLogCardsMarkup(actionLog)}</div>`,
          })}`,
        },
        {
          id: "settings",
          label: language() === "ru" ? "Настройки" : "Settings",
          subtitle: language() === "ru" ? "Профиль администратора." : "Admin profile settings.",
          body: `${profileFormCard(user)}`,
        },
      ];

      elements.cabinetContent.innerHTML = workspaceLayoutMarkup("admin", sections);
      await loadAdminUsers();
    }

    async function renderManagerCabinet() {
      if (!elements.cabinetSubtitle || !elements.cabinetContent || !currentUser()) {
        return;
      }

      const user = currentUser();
      elements.cabinetSubtitle.textContent = `${user.email} · ${language() === "ru" ? "кабинет менеджера" : "manager cabinet"}`;
      elements.cabinetContent.innerHTML = stateCardHtml(
        language() === "ru" ? "Загружаем кабинет менеджера..." : "Loading manager cabinet...",
        "loading",
      );

      const [tickets, bands, concerts, bandRequests, concertRequests, notifications] = await Promise.all([
        requestOr("/tickets/my", []),
        requestOr("/bands/managed", []),
        requestOr("/concerts/managed", []),
        requestOr("/bands/requests/my", []),
        requestOr("/bands/concert-requests/my", []),
        requestOr("/users/notifications", []),
      ]);
      const [rostersByBand, statsByBand, releasesByBand, invitationsByBand, schedulesByBand] = await Promise.all([
        loadBandRosters(bands),
        loadBandStats(bands),
        loadBandReleases(bands),
        loadBandInvitations(bands),
        loadBandSchedules(bands),
      ]);
      const concertsByBand = groupByBandId(concerts);
      const concertRequestsByBand = groupByBandId(concertRequests);
      const managerSummary = summarizeManagedWorkspace(bands, concerts, statsByBand);
      const unreadNotifications = notifications.filter((item) => !item.is_read).length;
      const pendingRequestCount =
        bandRequests.filter((item) => item.status === "pending").length +
        concertRequests.filter((item) => item.status === "pending").length;

      const sections = [
        {
          id: "dashboard",
          label: language() === "ru" ? "Дашборд" : "Dashboard",
          subtitle: language() === "ru" ? "Итоги по группам, билетам и текущей нагрузке." : "A summary of bands, tickets, and active workload.",
          body: `${baseOverviewCard(user, tickets)}${managerSummaryCard(managerSummary)}${ticketsCard(tickets)}`,
        },
        {
          id: "schedule",
          label: language() === "ru" ? "Календарь / Расписание" : "Schedule",
          subtitle: language() === "ru" ? "Репетиции, встречи и внутренний календарь по группам." : "Rehearsals, meetings, and band schedule management.",
          body: bands
            .map(
              (band) => `${cabinetCard({
                title: `${language() === "ru" ? "Расписание группы" : "Band schedule"}: ${band.name}`,
                subtitle: language() === "ru" ? "Создавайте и редактируйте события группы." : "Create and edit events for this band.",
                wide: true,
                body: `${scheduleEventFormMarkup(band)}<div class="ticket-list">${managerScheduleEventCardsMarkup(schedulesByBand[band.id] || [])}</div>`,
              })}`,
            )
            .join(""),
        },
        {
          id: "concerts",
          label: language() === "ru" ? "Мои концерты" : "My concerts",
          subtitle: language() === "ru" ? "Запланированные, на модерации, отмененные и прошедшие концерты." : "Planned, moderated, cancelled, and past concerts.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Каталог концертов" : "Concert catalog",
            subtitle: language() === "ru" ? "Каждая группа разворачивается отдельно." : "Each band expands into its own concert workspace.",
            wide: true,
            body: `<div class="manager-band-catalog-list">${managerBandCatalogMarkup(
              bands,
              rostersByBand,
              statsByBand,
              concertsByBand,
              concertRequestsByBand,
              releasesByBand,
            )}</div>`,
          })}`,
        },
        {
          id: "groups",
          label: language() === "ru" ? "Мои группы" : "My bands",
          subtitle: language() === "ru" ? "Профили групп и заявки на создание новых." : "Band profiles and requests for new bands.",
          body: `${cabinetCard({
            title: language() === "ru" ? "Создать новую группу" : "Create a new band",
            subtitle: language() === "ru" ? "Новая группа отправляется на модерацию администрации." : "New bands go to admin moderation before appearing publicly.",
            body: `${managerBandRequestFormMarkup()}<div class="ticket-list">${bandRequestListMarkup(bandRequests)}</div>`,
          })}${cabinetCard({
            title: language() === "ru" ? "Профили групп" : "Band profiles",
            subtitle: language() === "ru" ? "Редактирование жанра, состава, города, описания и медиа." : "Edit genre, city, description, links, and media.",
            wide: true,
            body: `<div class="ticket-list">${bandCardsHtml(bands, rostersByBand, { statsByBand, editable: true, candidatesByBand: {} })}</div>`,
          })}`,
        },
        {
          id: "musicians",
          label: language() === "ru" ? "Музыканты" : "Musicians",
          subtitle: language() === "ru" ? "Состав групп, приглашения и поиск по email." : "Rosters, invitations, and email-based musician search.",
          body: bands
            .map(
              (band) => `${cabinetCard({
                title: `${language() === "ru" ? "Музыканты группы" : "Band musicians"}: ${band.name}`,
                subtitle: language() === "ru" ? "Добавление по email, приглашения и управление составом." : "Email invitations and roster management.",
                wide: true,
                body: `
                  <section class="manager-subsection">
                    <div class="cabinet-card-head">
                      <h3>${escapeHtml(language() === "ru" ? "Текущий состав" : "Current roster")}</h3>
                      <p class="panel-subtitle">${escapeHtml(language() === "ru" ? "Убирать участников можно сразу, а новых приглашать по email." : "You can remove current members and invite new ones by email.")}</p>
                    </div>
                    ${removeMusicianChipMarkup(rostersByBand[band.id] || [], band.id)}
                    ${rosterEmailFormMarkup(band.id)}
                    <form class="cabinet-form band-invitation-form" data-band-id="${band.id}">
                      <label>
                        ${escapeHtml(language() === "ru" ? "Email музыканта" : "Musician email")}
                        <input name="email" type="email" placeholder="musician@example.com" required />
                      </label>
                      <label class="wide">
                        ${escapeHtml(language() === "ru" ? "Комментарий к приглашению" : "Invitation message")}
                        <textarea name="message" rows="3" placeholder="${escapeHtml(language() === "ru" ? "Расскажите, в какой проект вы приглашаете музыканта" : "Explain the project and invitation details")}"></textarea>
                      </label>
                      <button class="ghost-button" type="submit">${escapeHtml(language() === "ru" ? "Отправить приглашение" : "Send invitation")}</button>
                      <p class="status-line wide"></p>
                    </form>
                    <div class="ticket-list">${invitationCardsMarkup(invitationsByBand[band.id] || [], { [band.id]: band }, false)}</div>
                  </section>
                `,
              })}`,
            )
            .join(""),
        },
        {
          id: "requests",
          label: language() === "ru" ? "Заявки" : "Requests",
          subtitle: language() === "ru" ? "Статусы заявок на группы и концерты." : "Statuses for band and concert requests.",
          count: pendingRequestCount,
          body: `${cabinetCard({
            title: language() === "ru" ? "Заявки на группы" : "Band requests",
            subtitle: language() === "ru" ? "История ваших заявок на новые группы." : "History of your band creation requests.",
            body: `<div class="ticket-list">${bandRequestListMarkup(bandRequests)}</div>`,
          })}${cabinetCard({
            title: language() === "ru" ? "Заявки на концерты" : "Concert requests",
            subtitle: language() === "ru" ? "Что уже на модерации, а что одобрено или отклонено." : "What is pending moderation and what has been approved or rejected.",
            wide: true,
            body: `<div class="manager-band-catalog-list">${bands
              .map(
                (band) => `${cabinetCard({
                  title: band.name,
                  subtitle: language() === "ru" ? "Статусы концертных заявок по группе." : "Concert request statuses for this band.",
                  body: `<div class="ticket-list">${concertRequestCardsMarkup(concertRequestsByBand[band.id] || [])}</div>`,
                })}`,
              )
              .join("")}</div>`,
          })}`,
        },
        {
          id: "notifications",
          label: language() === "ru" ? "Уведомления" : "Notifications",
          subtitle: language() === "ru" ? "Ответы администрации, изменения расписания и события групп." : "Admin decisions, schedule changes, and band activity.",
          count: unreadNotifications,
          body: `${cabinetCard({
            title: language() === "ru" ? "Лента уведомлений" : "Notification feed",
            subtitle: language() === "ru" ? "Все важные изменения в одном месте." : "All important changes in one place.",
            wide: true,
            body: `<div class="ticket-list">${notificationCardsMarkup(notifications)}</div>`,
          })}`,
        },
        {
          id: "settings",
          label: language() === "ru" ? "Настройки профиля" : "Profile settings",
          subtitle: language() === "ru" ? "Личные данные менеджера." : "Your manager account settings.",
          body: `${profileFormCard(user)}`,
        },
      ];

      elements.cabinetContent.innerHTML = workspaceLayoutMarkup("manager", sections);
    }

    async function renderCabinet() {
      if (!elements.cabinetContent || !elements.cabinetSubtitle) {
        return;
      }
      const user = currentUser();
      if (!user) {
        elements.cabinetSubtitle.textContent = language() === "ru" ? "Гостевой режим" : "Guest mode";
        elements.cabinetContent.innerHTML = deps.guestCabinetHtml();
        return;
      }
      if (user.role === "admin") {
        await renderAdminCabinet();
        return;
      }
      if (user.role === "manager") {
        await renderManagerCabinet();
        return;
      }
      if (user.role === "musician") {
        await renderMusicianCabinet();
        return;
      }
      await renderRegisteredCabinet();
    }

    async function reloadTicketList() {
      const list = document.querySelector("#cabinet-ticket-list");
      if (!list) {
        return;
      }
      list.innerHTML = stateCardHtml(t("common.loading_tickets"), "loading");
      try {
        const tickets = await request("/tickets/my");
        list.innerHTML = ticketCardsHtml(tickets);
      } catch (error) {
        list.innerHTML = stateCardHtml(error.message, "error");
      }
    }

    async function handleCabinetClick(event) {
      const sectionButton = event.target.closest(".cabinet-nav-button");
      if (sectionButton) {
        activateWorkspaceSection(sectionButton);
        return true;
      }

      const authButton = event.target.closest("[data-cabinet-auth]");
      if (authButton) {
        openAuth(authButton.dataset.cabinetAuth);
        return true;
      }

      const actionButton = event.target.closest("[data-cabinet-action='load-tickets']");
      if (actionButton) {
        await reloadTicketList();
        return true;
      }

      const refreshButton = event.target.closest("#refresh-admin-users");
      if (refreshButton) {
        await loadAdminUsers();
        return true;
      }

      const notificationButton = event.target.closest(".mark-notification-read");
      if (notificationButton) {
        setButtonBusy(notificationButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        try {
          await request(`/users/notifications/${notificationButton.dataset.notificationId}/read`, {
            method: "POST",
          });
          await renderCabinet();
        } catch (error) {
          showToast(error.message, "error");
          setButtonBusy(notificationButton, false);
        }
        return true;
      }

      const saveRoleButton = event.target.closest(".save-role");
      if (saveRoleButton) {
        const row = saveRoleButton.closest(".admin-user-row");
        const status = row?.querySelector(".admin-user-status");
        const role = row.querySelector(".role-select").value;
        setButtonBusy(saveRoleButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обновляем роль..." : "Updating role...", "loading");
        try {
          await request(`/admin/users/${row.dataset.userId}/role`, {
            method: "PUT",
            body: JSON.stringify({ role }),
          });
          await loadAdminUsers();
          setStatusLine(status, language() === "ru" ? "Роль обновлена" : "Role updated", "success");
          showToast(language() === "ru" ? "Роль пользователя обновлена." : "User role updated.", "success");
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(saveRoleButton, false);
        }
        return true;
      }

      const cancelConcertButton = event.target.closest(".cancel-managed-concert");
      if (cancelConcertButton) {
        const form = cancelConcertButton.closest("form");
        const status = form?.querySelector(".status-line");
        setButtonBusy(cancelConcertButton, true, language() === "ru" ? "Отменяем..." : "Cancelling...");
        setStatusLine(status, language() === "ru" ? "Отменяем концерт..." : "Cancelling concert...", "loading");
        try {
          await request(`/concerts/${cancelConcertButton.dataset.concertId}`, {
            method: "DELETE",
          });
          showToast(language() === "ru" ? "Концерт отменен." : "Concert cancelled.", "success");
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
          setButtonBusy(cancelConcertButton, false);
        }
        return true;
      }

      const removeMusicianButton = event.target.closest(".roster-remove");
      if (removeMusicianButton) {
        const rosterSection = removeMusicianButton.closest(".manager-subsection") || removeMusicianButton.closest(".result-card");
        const status = rosterSection?.querySelector(".roster-email-form .status-line") || rosterSection?.querySelector(".status-line");
        setButtonBusy(removeMusicianButton, true, language() === "ru" ? "Убираем..." : "Removing...");
        setStatusLine(
          status,
          language() === "ru" ? "Убираем музыканта из группы..." : "Removing musician from the band...",
          "loading",
        );
        try {
          await request(
            `/bands/${removeMusicianButton.dataset.bandId}/musicians/${removeMusicianButton.dataset.userId}`,
            { method: "DELETE" },
          );
          showToast(
            language() === "ru" ? "Музыкант удален из состава." : "Musician removed from the roster.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
          setButtonBusy(removeMusicianButton, false);
        }
        return true;
      }

      return false;
    }

    async function handleCabinetSubmit(event) {
      if (event.target.id === "profile-form") {
        event.preventDefault();
        const status = document.querySelector("#profile-status");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Сохраняем профиль..." : "Saving profile...", "loading");
        try {
          const updatedUser = await request("/users/me", {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setCurrentUser(updatedUser);
          setStatusLine(status, language() === "ru" ? "Профиль обновлен" : "Profile updated", "success");
          setAuthState(roleTitle(updatedUser.role));
          showToast(language() === "ru" ? "Профиль сохранен." : "Profile saved.", "success");
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.id === "admin-band-form") {
        event.preventDefault();
        const status = document.querySelector("#admin-band-status");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Создаем..." : "Creating...");
        setStatusLine(status, language() === "ru" ? "Создаем группу..." : "Creating band...", "loading");
        try {
          const band = await request("/admin/bands", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setStatusLine(
            status,
            language() === "ru" ? `Группа создана: ${band.name}` : `Band created: ${band.name}`,
            "success",
          );
          showToast(
            language() === "ru" ? `Создана группа «${band.name}».` : `Band "${band.name}" created.`,
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("band-request-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Отправляем..." : "Sending...");
        setStatusLine(status, language() === "ru" ? "Отправляем заявку на группу..." : "Sending band request...", "loading");
        try {
          await request("/bands/requests", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setStatusLine(status, language() === "ru" ? "Заявка отправлена" : "Request sent", "success");
          showToast(
            language() === "ru" ? "Новая группа отправлена на подтверждение администрации." : "The new band was sent for admin approval.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("band-profile-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".band-profile-status");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(
          status,
          language() === "ru" ? "Обновляем профиль группы..." : "Updating band profile...",
          "loading",
        );
        try {
          const band = await request(`/bands/${event.target.dataset.bandId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          setStatusLine(
            status,
            language() === "ru" ? `Профиль группы обновлен: ${band.name}` : `Band profile updated: ${band.name}`,
            "success",
          );
          showToast(
            language() === "ru" ? `Профиль группы «${band.name}» сохранен.` : `Band profile "${band.name}" saved.`,
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("band-invitation-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Отправляем..." : "Sending...");
        setStatusLine(status, language() === "ru" ? "Отправляем приглашение..." : "Sending invitation...", "loading");
        try {
          await request(`/bands/${event.target.dataset.bandId}/invitations`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            language() === "ru" ? "Приглашение отправлено музыканту." : "Invitation sent to the musician.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("invitation-decision-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const decision = submitButton?.value || "accept";
        const payload = {
          response_comment: String(new FormData(event.target).get("response_comment") || ""),
        };
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обрабатываем приглашение..." : "Processing invitation...", "loading");
        try {
          await request(`/bands/invitations/${event.target.dataset.invitationId}/${decision}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            decision === "accept"
              ? language() === "ru"
                ? "Приглашение принято."
                : "Invitation accepted."
              : language() === "ru"
                ? "Приглашение отклонено."
                : "Invitation declined.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("schedule-event-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());
        payload.starts_at = new Date(String(payload.starts_at || "")).toISOString();
        payload.ends_at = new Date(String(payload.ends_at || "")).toISOString();
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Создаем событие..." : "Creating event...", "loading");
        try {
          await request(`/bands/${event.target.dataset.bandId}/schedule`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            language() === "ru" ? "Событие добавлено в расписание группы." : "The event was added to the band schedule.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("schedule-event-edit-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());
        payload.starts_at = new Date(String(payload.starts_at || "")).toISOString();
        payload.ends_at = new Date(String(payload.ends_at || "")).toISOString();
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обновляем событие..." : "Updating event...", "loading");
        try {
          await request(`/bands/schedule/${event.target.dataset.eventId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          showToast(
            language() === "ru" ? "Событие расписания обновлено." : "Schedule event updated.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("schedule-response-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const payload = Object.fromEntries(new FormData(event.target).entries());
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Отправляем ответ..." : "Sending response...", "loading");
        try {
          await request(`/bands/schedule/${event.target.dataset.eventId}/respond`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            language() === "ru" ? "Ответ на событие сохранен." : "Your event response has been saved.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("concert-request-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const payload = buildConcertPayload(formData);
        payload.concert_status = formData.get("concert_status");
        delete payload.status;
        const validationError = validateConcertPayload({
          ...payload,
          status: payload.concert_status,
        });
        if (validationError) {
          setStatusLine(status, validationError, "error");
          return true;
        }
        setButtonBusy(submitButton, true, language() === "ru" ? "Отправляем..." : "Sending...");
        setStatusLine(status, language() === "ru" ? "Отправляем концерт на модерацию..." : "Sending concert to moderation...", "loading");
        try {
          await request(`/bands/${event.target.dataset.bandId}/concert-requests`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setStatusLine(status, language() === "ru" ? "Заявка на концерт отправлена" : "Concert request sent", "success");
          showToast(
            language() === "ru" ? "Концерт отправлен администрации на подтверждение." : "The concert was sent to admin for approval.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("release-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());
        payload.release_date = new Date(payload.release_date).toISOString();
        setButtonBusy(submitButton, true, language() === "ru" ? "Отправляем..." : "Sending...");
        setStatusLine(status, language() === "ru" ? "Отправляем релиз на модерацию..." : "Sending release for moderation...", "loading");
        try {
          await request(`/bands/${event.target.dataset.bandId}/releases`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setStatusLine(status, language() === "ru" ? "Релиз отправлен" : "Release sent", "success");
          showToast(
            language() === "ru" ? "Релиз отправлен на публикационную проверку." : "The release was sent for publication review.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("roster-management-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const userId = formData.get("user_id");
        if (!userId) {
          setStatusLine(
            status,
            language() === "ru" ? "Выберите пользователя для добавления." : "Choose a user to add.",
            "error",
          );
          return true;
        }
        setButtonBusy(submitButton, true, language() === "ru" ? "Добавляем..." : "Adding...");
        setStatusLine(
          status,
          language() === "ru" ? "Добавляем музыканта в группу..." : "Adding musician to the band...",
          "loading",
        );
        try {
          await request(`/bands/${event.target.dataset.bandId}/musicians/${userId}`, {
            method: "POST",
          });
          showToast(
            language() === "ru" ? "Музыкант добавлен в состав." : "Musician added to the roster.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("admin-band-request-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const decision = submitButton?.value || "approve";
        const formData = new FormData(event.target);
        const payload = { admin_comment: String(formData.get("admin_comment") || "") };
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обрабатываем заявку..." : "Processing request...", "loading");
        try {
          await request(`/admin/band-requests/${event.target.dataset.requestId}/${decision}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            decision === "approve"
              ? language() === "ru"
                ? "Группа одобрена."
                : "Band approved."
              : language() === "ru"
                ? "Заявка на группу отклонена."
                : "Band request rejected.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("admin-concert-request-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const decision = submitButton?.value || "approve";
        const payload = {
          admin_comment: String(new FormData(event.target).get("admin_comment") || ""),
        };
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обрабатываем концерт..." : "Processing concert...", "loading");
        try {
          await request(`/admin/concert-requests/${event.target.dataset.requestId}/${decision}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast(
            decision === "approve"
              ? language() === "ru"
                ? "Концерт опубликован."
                : "Concert published."
              : language() === "ru"
                ? "Заявка на концерт отклонена."
                : "Concert request rejected.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("admin-release-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
        const action = submitButton?.value || "save";
        const formData = new FormData(event.target);
        const payload = {
          title: String(formData.get("title") || ""),
          release_date: new Date(String(formData.get("release_date") || "")).toISOString(),
          cover_url: String(formData.get("cover_url") || ""),
          media_url: String(formData.get("media_url") || ""),
          description: String(formData.get("description") || ""),
          admin_comment: String(formData.get("admin_comment") || ""),
        };
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Обрабатываем релиз..." : "Processing release...", "loading");
        try {
          if (action === "delete") {
            await request(`/admin/releases/${event.target.dataset.releaseId}`, {
              method: "DELETE",
            });
          } else if (action === "approve" || action === "reject") {
            await request(`/admin/releases/${event.target.dataset.releaseId}/${action}`, {
              method: "POST",
              body: JSON.stringify({ admin_comment: payload.admin_comment }),
            });
          } else {
            await request(`/admin/releases/${event.target.dataset.releaseId}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          }
          showToast(
            action === "delete"
              ? language() === "ru"
                ? "Релиз удален."
                : "Release deleted."
              : action === "approve"
                ? language() === "ru"
                  ? "Релиз одобрен."
                  : "Release approved."
                : action === "reject"
                  ? language() === "ru"
                    ? "Релиз отклонен."
                    : "Release rejected."
                  : language() === "ru"
                    ? "Релиз обновлен."
                    : "Release updated.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("roster-email-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const email = String(new FormData(event.target).get("email") || "").trim();
        if (!email) {
          setStatusLine(
            status,
            language() === "ru" ? "Введите email музыканта." : "Enter the musician email.",
            "error",
          );
          return true;
        }
        setButtonBusy(submitButton, true, language() === "ru" ? "Ищем..." : "Searching...");
        setStatusLine(
          status,
          language() === "ru" ? "Ищем пользователя и добавляем в состав..." : "Finding the user and adding them to the roster...",
          "loading",
        );
        try {
          await request(`/bands/${event.target.dataset.bandId}/musicians/by-email`, {
            method: "POST",
            body: JSON.stringify({ email }),
          });
          showToast(
            language() === "ru" ? "Музыкант добавлен по email." : "Musician added by email.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.id === "manager-concert-form") {
        event.preventDefault();
        const status = document.querySelector("#manager-concert-status");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const bandId = formData.get("band_id");
        const payload = buildConcertPayload(formData);
        const validationError = validateConcertPayload(payload);
        if (!bandId) {
          setStatusLine(
            status,
            language() === "ru" ? "Выберите группу для нового концерта." : "Choose a band for the new concert.",
            "error",
          );
          return true;
        }
        if (validationError) {
          setStatusLine(status, validationError, "error");
          return true;
        }
        setButtonBusy(submitButton, true, language() === "ru" ? "Создаем..." : "Creating...");
        setStatusLine(status, language() === "ru" ? "Создаем концерт..." : "Creating concert...", "loading");
        try {
          await request(`/bands/${bandId}/concerts`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setStatusLine(status, language() === "ru" ? "Концерт создан" : "Concert created", "success");
          showToast(
            language() === "ru" ? "Новый концерт опубликован." : "A new concert has been published.",
            "success",
          );
          event.target.reset();
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      if (event.target.classList.contains("manager-concert-edit-form")) {
        event.preventDefault();
        const status = event.target.querySelector(".status-line");
        const submitButton = event.target.querySelector("button[type='submit']");
        const formData = new FormData(event.target);
        const payload = buildConcertPayload(formData);
        const validationError = validateConcertPayload(payload);
        if (validationError) {
          setStatusLine(status, validationError, "error");
          return true;
        }
        setButtonBusy(submitButton, true, language() === "ru" ? "Сохраняем..." : "Saving...");
        setStatusLine(status, language() === "ru" ? "Сохраняем изменения..." : "Saving changes...", "loading");
        try {
          await request(`/concerts/${event.target.dataset.concertId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          setStatusLine(status, language() === "ru" ? "Концерт обновлен" : "Concert updated", "success");
          showToast(
            language() === "ru" ? "Изменения концерта сохранены." : "Concert changes saved.",
            "success",
          );
          await renderCabinet();
        } catch (error) {
          setStatusLine(status, error.message, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
        return true;
      }

      return false;
    }

    return {
      loadAdminUsers,
      renderCabinet,
      reloadTicketList,
      handleCabinetClick,
      handleCabinetSubmit,
    };
  }

  window.WavesCabinetModule = {
    create: createCabinetModule,
  };
})();
