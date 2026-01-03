# 🚀 Інструкція по деплою (Hetzner / DigitalOcean)

Цей гайд допоможе налаштувати сервер (VPS) з **2 CPU / 4 GB RAM** для запуску вашого проекту.

## 🛠 Крок 1: Підготовка Сервера

1.  **Зайдіть на сервер** (вам на пошту прийшов IP та пароль `root`):
    ```bash
    ssh root@YOUR_SERVER_IP
    ```

2.  **Оновіть систему**:
    ```bash
    apt update && apt upgrade -y
    ```

3.  **Встановіть Docker та Git**:
    ```bash
    apt install docker.io docker-compose git -y
    ```

## 📦 Крок 2: Завантаження Проекту

1.  **Клонуйте репозиторій** (замініть посилання на ваш GitHub репо):
    ```bash
    git clone https://github.com/ВАШ_НІК/fpv_project.git
    cd fpv_project
    ```

2.  **Налаштуйте змінні середовища**:
    *   Створіть файл `.env`:
    ```bash
    nano .env
    ```
    *   Вставте туди ваші налаштування (як на локальному ПК, тільки `APP_URL` змініть на IP сервера).

## 🏗 Крок 3: Запуск з Docker

Ми використаємо Docker, щоб запустити все однією командою.

1.  **Створіть `Dockerfile`** (якщо його немає):
    ```bash
    nano Dockerfile
    ```
    Вставте цей текст:
    ```dockerfile
    FROM python:3.11-slim

    WORKDIR /app

    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt

    COPY . .

    CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    ```

2.  **Створіть/Оновіть `docker-compose.yml`**:
    ```bash
    nano docker-compose.yml
    ```
    Вставте цей текст:
    ```yaml
    version: '3.8'

    services:
      backend:
        build: .
        container_name: fpv_backend
        ports:
          - "80:8000"  # Слухаємо порт 80 (стандартний HTTP)
        environment:
          - DATABASE_URL=postgresql+asyncpg://fpv_admin:fpv_secure_2024@postgres:5432/fpv_racer
          - LIQPAY_PUBLIC_KEY=${LIQPAY_PUBLIC_KEY}
          - LIQPAY_PRIVATE_KEY=${LIQPAY_PRIVATE_KEY}
        depends_on:
          - postgres
        restart: always

      postgres:
        image: postgres:16-alpine
        container_name: fpv_postgres
        environment:
          POSTGRES_USER: fpv_admin
          POSTGRES_PASSWORD: fpv_secure_2024
          POSTGRES_DB: fpv_racer
        volumes:
          - postgres_data:/var/lib/postgresql/data
        restart: always

    volumes:
      postgres_data:
    ```

3.  **Запустіть проект**:
    ```bash
    docker-compose up -d --build
    ```

## ✅ Крок 4: Перевірка

1.  Відкрийте браузер і введіть IP вашого сервера: `http://YOUR_SERVER_IP`.
2.  Ви маєте побачити ваш сайт!

## 🔧 Корисні команди

*   **Дивитись логи**: `docker-compose logs -f`
*   **Рестарт**: `docker-compose restart`
*   **Зупинка**: `docker-compose down`
