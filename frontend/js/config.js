/**
 * Global Configuration & Localization
 */

const CONFIG = {
    PROJECT_NAME: "(NAME)",
    APP_VERSION: "1.0.0",    // Used for cache busting
    DEFAULT_LANG: 'uk',      // Ukrainian by default
    API_BASE: window.location.origin, // Automatically matches current domain/port (Production Ready)
    CURRENCY: '₴',           // UAH currency symbol
    CURRENCY_NAME: 'грн'     // Full currency name
};

// Centralized asset paths for easy management
const ASSETS = {

    // Hero/Landing page
    HERO_BACKGROUND: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",

    // Logo
    FAVICON: "/favicon.svg",
    LOGO_ICON: "/favicon.svg",

    // Default avatar
    AVATAR_DEFAULT: (name = 'User') => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`
};

const TRANSLATIONS = {
    "uk": {
        // Landing Page
        "hero_title": "Відчуй швидкість <span class=\"text-blue-500 text-glow\">реальності</span>",
        "hero_text": "Справжні RC-машинки, якими ти керуєш через інтернет. Мінімальна затримка, максимальний драйв.",
        "btn_start_journey": "Почати подорож",
        "btn_how_it_works": "Як це працює?",
        "stats_cars": "Машинок",
        "stats_stream": "Стрім",
        "car_default_desc": "FPV машинка",
        "steps_title": "Твій шлях пілота",
        "steps_subtitle": "Всього три кроки відокремлюють тебе від старту",
        "step1_title": "Обери болід",
        "step1_desc": "В нашому гаражі є все: від швидкісних багі до потужних краулерів для бездоріжжя.",
        "step2_title": "Підключись",
        "step2_desc": "Не потрібно нічого встановлювати. Керування відбувається прямо з браузера.",
        "step3_title": "Тисни на газ!",
        "step3_desc": "Отримуй відеопотік в реальному часі та керуй клавіатурою (WASD).",
        "features_title": "Технології",
        "features_desc": "Ми розробили власну систему передачі відео та команд, яка забезпечує миттєвий відгук навіть через мобільний інтернет.",
        "feature_webrtc_title": "WebRTC Core",
        "feature_webrtc_desc": "Пряме Peer-to-Peer з'єднання для мінімальної затримки.",
        "feature_secure_title": "Secure Link",
        "feature_secure_desc": "Шифрований канал керування захистить від перехоплення.",
        "footer_rights": "© 2024 Всі права захищено.",
        "system_active": "СИСТЕМА АКТИВНА",
        "latency_ping": "Затримка (Ping)",
        "video_quality": "Якість відео",

        // Auth page
        "app_subtitle": "ПАНЕЛЬ КЕРУВАННЯ",
        "tab_login": "ВХІД",
        "tab_register": "РЕЄСТРАЦІЯ",
        "system_link": "АБО УВІЙТИ ЧЕРЕЗ",
        "label_callsign": "ЕЛЕКТРОННА ПОШТА",
        "label_security_key": "ПАРОЛЬ",
        "label_pilot_name": "ІМ'Я КОРИСТУВАЧА",
        "btn_login": "УВІЙТИ",
        "btn_register": "ЗАРЕЄСТРУВАТИСЯ",
        "auto_connect": "Запам'ятати мене",
        "lost_key": "Забули пароль?",
        "terms": "Реєструючись, ви погоджуєтесь з умовами використання.",

        // Navigation
        "nav_dashboard": "Кабінет",
        "nav_profile": "Мій Профіль",
        "nav_support": "Підтримка",
        "nav_admin": "Адмін",
        "nav_logout": "Вийти",
        "nav_back": "На Головну",
        "btn_login_register": "Вхід / Реєстрація",

        // Dashboard
        "dashboard_title": "Доступні машинки",
        "dashboard_subtitle": "Оберіть машинку щоб розпочати сесію",
        "balance": "Баланс",
        "top_up": "Поповнити баланс",
        "available_cars": "Доступні машинки",
        "select_car": "Оберіть машинку щоб розпочати сесію",
        "filter_all": "Всі",
        "filter_available": "Вільні",
        "status_online": "ОНЛАЙН",
        "status_busy": "ЗАЙНЯТО",
        "status_offline": "ОФЛАЙН",
        "start_session": "Почати сесію",
        "unavailable": "Недоступно",
        "active_session_title": "Активна сесія",
        "active_session_desc": "У вас є активна оренда прямо зараз",
        "btn_enter_control": "Увійти в керування",
        "reserved": "Зарезервовано",

        // Support Modal
        "support_title": "Служба підтримки",
        "support_topic": "Тема звернення",
        "support_message": "Повідомлення",
        "support_btn": "Надіслати запит",
        "support_topic_tech": "Технічна проблема",
        "support_topic_payment": "Помилка оплати",
        "support_topic_account": "Вхід та Акаунт",
        "support_topic_other": "Інше",
        "placeholder_support_msg": "Детально опишіть ситуацію...",

        // Profile
        "profile_title": "Мій Профіль",
        "appearance_title": "Зовнішній вигляд",
        "theme_system": "Системна",
        "theme_light": "Світла",
        "theme_dark": "Темна",
        "lang_title": "Мова / Language",
        "lang_uk": "Українська",
        "lang_en": "English",
        "btn_topup_short": "Поповнити",
        "stats_title": "Статистика",
        "stats_total_sessions": "Всього сесій",
        "stats_total_time": "Загальний час",
        "history_title": "Останні сесії",
        "history_empty": "Сесій поки немає",
        "session_label": "Сесія",
        "status_active": "Активна",
        "status_finished": "Завершена",
        "unit_min": "хв",

        // Rental
        "rent_title": "Оренда машинки",
        "select_duration": "Оберіть тривалість",
        "rent_duration_5": "5 Хвилин",
        "rent_duration_10": "10 Хвилин",
        "rent_duration_20": "20 Хвилин",
        "your_balance": "Ваш баланс",
        "confirm_rent": "Підтвердити та підключитись",
        "active_session": "Активна сесія",
        "enter_control": "Увійти в керування",

        // Errors
        "error_signal_lost": "Помилка з'єднання",
        "auth_authenticating": "Перевірка даних...",
        "auth_creating": "Створення акаунту...",
        "auth_failed": "Невірні дані",
        "reg_failed": "Помилка реєстрації",
        "google_failed": "Помилка Google Auth",
        "error_invalid_email": "Невірний формат пошти",
        "error_password_short": "Пароль має бути мінімум 8 символів",
        "error_email_taken": "Ця пошта вже зареєстрована",
        "error_user_not_found": "Користувача не знайдено",
        "error_invalid_code": "Невірний код",
        "error_wrong_password": "Невірний пароль",
        "error_login_failed": "Помилка входу. Перевірте дані.",
        "error_network": "Помилка мережі. Спробуйте пізніше.",
        "error_insufficient_funds": "Недостатньо коштів! Будь ласка, поповніть баланс.",
        "Invalid credentials": "Невірна пошта або пароль",
        "User not found": "Користувача не знайдено",

        // Misc
        "placeholder_email": "user@example.com",
        "placeholder_pass": "••••••••",
        "placeholder_name": "Ваше Ім'я",
        "hero_subtitle": "Керуйте FPV дронами дистанційно з професійною точністю",
        "btn_get_started": "РОЗПОЧАТИ",
        "btn_view_fleet": "ОГЛЯД ПРИСТРОЇВ",
        "landing_title": "Ласкаво просимо",
        "pass_strength_weak": "Слабкий",
        "pass_strength_medium": "Середній",
        "pass_strength_strong": "Надійний",
        "forgot_title": "Відновлення пароля",
        "forgot_desc": "Введіть пошту, щоб отримати код",
        "btn_send_code": "НАДІСЛАТИ КОД",
        "verify_title": "Перевірка",
        "verify_desc": "Введіть код з email",
        "label_code": "КОД ПІДТВЕРДЖЕННЯ",
        "placeholder_code": "123456",
        "btn_verify": "ПІДТВЕРДИТИ",
        "reset_title": "Новий пароль",
        "reset_desc": "Створіть новий пароль",
        "btn_reset": "ЗМІНИТИ ПАРОЛЬ",
        "back_to_login": "Назад до входу",
        "code_sent": "Код надіслано!",
        "pass_updated": "Пароль оновлено!",
        "payment_success": "Оплата успішна! Баланс оновлено.",
        "payment_error": "Помилка оплати",
        "proceed_to_payment": "Перейти до оплати"
    },
    "en": {
        // Landing Page
        "hero_title": "Feel the Speed of <span class=\"text-blue-500 text-glow\">Reality</span>",
        "hero_text": "Real RC cars you control over the internet. Minimal latency, maximum drive.",
        "btn_start_journey": "Start Journey",
        "btn_how_it_works": "How it works?",
        "stats_cars": "Cars",
        "stats_stream": "Stream",
        "car_default_desc": "FPV Car",
        "steps_title": "Your Pilot Path",
        "steps_subtitle": "Only three steps separate you from the start",
        "step1_title": "Choose Your Bolide",
        "step1_desc": "Our garage has everything: from high-speed buggies to powerful off-road crawlers.",
        "step2_title": "Connect",
        "step2_desc": "No installation required. Control directly from your browser.",
        "step3_title": "Hit the Gas!",
        "step3_desc": "Get real-time video feed and control with your keyboard (WASD).",
        "features_title": "Technologies",
        "features_desc": "We developed our own video and command transmission system that ensures instant feedback even over mobile internet.",
        "feature_webrtc_title": "WebRTC Core",
        "feature_webrtc_desc": "Direct Peer-to-Peer connection for minimal latency.",
        "feature_secure_title": "Secure Link",
        "feature_secure_desc": "Encrypted control channel protects against interception.",
        "footer_rights": "© 2024 All rights reserved.",
        "system_active": "SYSTEM ACTIVE",
        "latency_ping": "Latency (Ping)",
        "video_quality": "Video Quality",

        // Auth page
        "app_subtitle": "CONTROL PANEL",
        "tab_login": "LOGIN",
        "tab_register": "REGISTER",
        "system_link": "OR LOGIN WITH",
        "label_callsign": "EMAIL ADDRESS",
        "label_security_key": "PASSWORD",
        "label_pilot_name": "FULL NAME",
        "btn_login": "SIGN IN",
        "btn_register": "CREATE ACCOUNT",
        "auto_connect": "Remember me",
        "lost_key": "Forgot password?",
        "terms": "By registering, you agree to the Terms of Service.",

        // Navigation
        "nav_dashboard": "Dashboard",
        "nav_profile": "My Profile",
        "nav_support": "Support",
        "nav_admin": "Admin",
        "nav_logout": "Logout",
        "nav_back": "To Home",
        "btn_login_register": "Login / Register",

        // Dashboard
        "dashboard_title": "Available Cars",
        "dashboard_subtitle": "Select a car to start a session",
        "balance": "Balance",
        "top_up": "Top Up Balance",
        "available_cars": "Available Cars",
        "select_car": "Select a car to start a session",
        "filter_all": "All",
        "filter_available": "Available",
        "status_online": "ONLINE",
        "status_busy": "BUSY",
        "status_offline": "OFFLINE",
        "start_session": "Start Session",
        "unavailable": "Unavailable",
        "active_session_title": "Active Session",
        "active_session_desc": "You have an active rental right now",
        "btn_enter_control": "Enter Control",
        "reserved": "Reserved",

        // Support Modal
        "support_title": "Support Service",
        "support_topic": "Subject",
        "support_message": "Message",
        "support_btn": "Send Request",
        "support_topic_tech": "Technical Issue",
        "support_topic_payment": "Payment Error",
        "support_topic_account": "Login & Account",
        "support_topic_other": "Other",
        "placeholder_support_msg": "Describe the situation in detail...",

        // Profile
        "profile_title": "My Profile",
        "appearance_title": "Appearance",
        "theme_system": "System",
        "theme_light": "Light",
        "theme_dark": "Dark",
        "lang_title": "Language / Мова",
        "lang_uk": "Ukrainian",
        "lang_en": "English",
        "btn_topup_short": "Top Up",
        "stats_title": "Statistics",
        "stats_total_sessions": "Total Sessions",
        "stats_total_time": "Total Time",
        "history_title": "Recent Sessions",
        "history_empty": "No sessions yet",
        "session_label": "Session",
        "status_active": "Active",
        "status_finished": "Finished",
        "unit_min": "min",

        // Rental
        "rent_title": "Rent Car",
        "select_duration": "Select Duration",
        "rent_duration_5": "5 Minutes",
        "rent_duration_10": "10 Minutes",
        "rent_duration_20": "20 Minutes",
        "your_balance": "Your Balance",
        "confirm_rent": "Confirm & Connect",
        "active_session": "Active Session",
        "enter_control": "Enter Control",

        // Errors
        "error_signal_lost": "Connection Error",
        "auth_authenticating": "Verifying...",
        "auth_creating": "Creating Account...",
        "auth_failed": "Invalid Credentials",
        "reg_failed": "Registration Failed",
        "google_failed": "Google Auth Failed",
        "error_invalid_email": "Invalid Email Format",
        "error_password_short": "Password must be at least 8 characters",
        "error_email_taken": "Email is already registered",
        "error_user_not_found": "User not found",
        "error_invalid_code": "Invalid Code",
        "error_wrong_password": "Wrong Password",
        "error_login_failed": "Login failed. Please check your credentials.",
        "error_network": "Network error. Please try again.",
        "error_insufficient_funds": "Insufficient funds! Please top up your balance.",
        "Invalid credentials": "Invalid email or password",
        "User not found": "User not found",

        // Misc
        "placeholder_email": "user@example.com",
        "placeholder_pass": "••••••••",
        "placeholder_name": "User Name",
        "hero_subtitle": "Control FPV drones remotely with professional precision",
        "btn_get_started": "GET STARTED",
        "btn_view_fleet": "VIEW DEVICES",
        "landing_title": "Welcome",
        "pass_strength_weak": "Weak",
        "pass_strength_medium": "Medium",
        "pass_strength_strong": "Strong",
        "forgot_title": "Recovery",
        "forgot_desc": "Enter email to receive code",
        "btn_send_code": "SEND CODE",
        "verify_title": "Verification",
        "verify_desc": "Enter code from email",
        "label_code": "VERIFICATION CODE",
        "placeholder_code": "123456",
        "btn_verify": "VERIFY",
        "reset_title": "New Password",
        "reset_desc": "Create a new password",
        "btn_reset": "UPDATE PASSWORD",
        "back_to_login": "Back to Login",
        "code_sent": "Code sent!",
        "pass_updated": "Password updated!",
        "payment_success": "Payment successful! Balance updated.",
        "payment_error": "Payment error",
        "proceed_to_payment": "Proceed to Payment"
    }
};

/**
 * Auto-bind CONFIG values to DOM elements with data-config attribute
 * Also updates document.title if it has data-config="PROJECT_NAME"
 */
function initConfigBindings() {
    // Handle title element
    const titleEl = document.querySelector('title[data-config="PROJECT_NAME"]');
    if (titleEl) {
        const originalText = titleEl.textContent || '';
        const hasSeparator = originalText.includes('-');
        if (hasSeparator) {
            const suffix = originalText.split('-').slice(1).join('-').trim();
            document.title = `${CONFIG.PROJECT_NAME} - ${suffix}`;
        } else {
            document.title = CONFIG.PROJECT_NAME;
        }
    }

    // Replace all elements with data-config attribute
    document.querySelectorAll('[data-config]').forEach(el => {
        const key = el.getAttribute('data-config');
        if (CONFIG[key] !== undefined) {
            el.textContent = CONFIG[key];
        }
    });
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfigBindings);
} else {
    initConfigBindings();
}

window.CONFIG = CONFIG;
window.ASSETS = ASSETS;
window.TRANSLATIONS = TRANSLATIONS;
window.initConfigBindings = initConfigBindings;
