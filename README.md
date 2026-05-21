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

## Основные эндпоинты

- `POST /api/v1/auth/register` - регистрация пользователя.
- `POST /api/v1/auth/login` - JWT-логин.
- `GET /api/v1/concerts/?city=Москва` - поиск доступных будущих концертов.
- `POST /api/v1/tickets/` - покупка билетов с блокировкой строки концерта.
- `GET /api/v1/tickets/my` - билеты текущего пользователя.
- `GET /api/v1/bands/my` - группы музыканта.
- `GET /api/v1/concerts/my` - расписание музыканта.
- `POST /api/v1/bands/{band_id}/concerts` - создание концерта менеджером.
- `GET /api/v1/bands/{band_id}/stats` - статистика группы.
- `GET /api/v1/admin/users` - список пользователей для администратора.
- `POST /api/v1/admin/bands` - создание группы администратором.

## Фронтенд

Статическая адаптивная страница находится в `app/static`.
FastAPI отдает ее с корневого маршрута `/`, а ассеты доступны через `/static`.

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

Логины:

- зарегистрированный пользователь: `user@example.com` / `user12345`
- администратор: `admin@example.com` / `admin12345`
- менеджер: `manager@example.com` / `manager12345`
- музыкант: `musician@example.com` / `musician12345`
