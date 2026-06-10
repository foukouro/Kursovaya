# Music Band Manager

Backend REST API на FastAPI для управления музыкальными группами, концертами и покупкой билетов.

## Стек

- Python 3.11+
- FastAPI
- SQLAlchemy async
- PostgreSQL + asyncpg
- Alembic
- Poetry / requirements.txt

## Запуск через Docker

1. Создайте `.env` на основе `.env.example` или используйте значения по умолчанию.
2. Запустите сервисы:

```bash
docker compose up --build
```

Приложение будет доступно по адресу `http://localhost:8000`.
Swagger UI: `http://localhost:8000/docs`.
Фронтенд: `http://localhost:8000/`.
Сервис уведомлений: `http://localhost:8010/health`.
Сервис рекомендаций: `http://localhost:8020/health`.

## Локальный запуск без Docker

```bash
poetry install
poetry shell
alembic upgrade head
uvicorn app.main:app --reload
```

Для запуска через `pip`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## Дополнительные микросервисы

В проект добавлены два отдельных FastAPI-микросервиса:

1. `notification-service`
   - порт: `8010`
   - health-check: `GET /health`
   - отправка уведомления: `POST /api/v1/notifications/send`
   - журнал уведомлений: `GET /api/v1/notifications/logs`

2. `recommendation-service`
   - порт: `8020`
   - health-check: `GET /health`
   - рекомендации концертов: `POST /api/v1/recommendations/concerts`

Примеры локального запуска без Docker:

```bash
uvicorn services.notification_service.main:app --host 127.0.0.1 --port 8010
uvicorn services.recommendation_service.main:app --host 127.0.0.1 --port 8020
```

## Основные эндпоинты

- `POST /api/v1/auth/register` - регистрация пользователя.
- `POST /api/v1/auth/login` - JWT-логин.
- `PATCH /api/v1/users/me` - обновление профиля текущего пользователя.
- `GET /api/v1/concerts/?city=Москва` - поиск доступных будущих концертов.
- `GET /api/v1/concerts/featured` - ближайшие концерты для главной страницы.
- `POST /api/v1/tickets/` - покупка билетов с блокировкой строки концерта.
- `GET /api/v1/tickets/my` - билеты текущего пользователя.
- `GET /api/v1/bands/my` - группы музыканта.
- `GET /api/v1/concerts/my` - расписание музыканта.
- `GET /api/v1/bands/managed` - группы текущего менеджера.
- `GET /api/v1/concerts/managed` - концерты текущего менеджера.
- `POST /api/v1/bands/{band_id}/concerts` - создание концерта менеджером.
- `GET /api/v1/bands/{band_id}/stats` - статистика группы.
- `GET /api/v1/admin/users` - список пользователей для администратора.
- `POST /api/v1/admin/bands` - создание группы администратором.

## Фронтенд

Статическая адаптивная страница находится в `app/static`.
FastAPI отдает ее с корневого маршрута `/`, а ассеты доступны через `/static`.

## Как работать в личном кабинете

Откройте `http://127.0.0.1:8000/cabinet`. Если браузер показывает старую версию страницы, нажмите `Ctrl+F5`: проект отключает кэш для фронтенда, но старые вкладки иногда держат уже загруженный JavaScript.

1. Нажмите `войти` в шапке или в верхнем блоке страницы.
2. Введите email и пароль демо-аккаунта из раздела ниже.
3. После входа кабинет сам перестроится под роль пользователя.
4. Переключение языка находится справа в шапке: `RU` и `EN`.
5. Кнопка `выйти` очищает текущий JWT-токен и возвращает гостевой режим.

Что доступно по ролям:

- `registered_user`: просмотр профиля, редактирование имени/email/аватара, просмотр своих билетов, переход к афише и покупке билетов.
- `musician`: все функции пользователя, список своих групп и расписание выступлений.
- `manager`: все функции пользователя, создание концертов, редактирование концертов, управление составом групп, статистика по группам и продажам.
- `admin`: все функции пользователя, создание групп, назначение менеджеров, просмотр пользователей и смена ролей.

Если кабинет после входа выглядит пустым:

- Проверьте, что сервер запущен: `http://127.0.0.1:8000/health` должен вернуть `{"status":"ok"}`.
- Откройте `http://127.0.0.1:8000/cabinet?auth=login`: это принудительно открывает окно входа.
- Нажмите `Ctrl+F5`, чтобы подтянуть актуальные `/static/app.js` и `/static/js/cabinet.js`.
- Убедитесь, что демо-данные созданы командами `python -m app.scripts.seed_demo_users` и `python -m app.scripts.seed_demo_content`.
- Если один API-запрос временно падает, кабинет теперь не должен становиться пустым: рабочие блоки останутся на экране, а ошибка появится внутри конкретного блока.

## Безопасность и роли

JWT передается через заголовок:

```http
Authorization: Bearer <access_token>
```

Роли:

- `registered_user`
- `musician`
- `manager`
- `admin`

Гости не хранятся в базе данных. При регистрации пользователь получает роль `registered_user`.

Первого администратора можно назначить вручную после регистрации пользователя:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

## Демо-аккаунты

Создать тестовых пользователей:

```bash
python -m app.scripts.seed_demo_users
```

Для полного демо-наполнения каталога, групп и концертов:

```bash
python -m app.scripts.seed_demo_content
```

Логины:

- зарегистрированный пользователь: `user@example.com` / `user12345`
- администратор: `admin@example.com` / `admin12345`
- менеджер: `manager@example.com` / `manager12345`
- музыкант: `musician@example.com` / `musician12345`
