// Theme Management handled by theme.js

// Tab Switching
function switchTab(tab) {
    // Determine which form is currently visible
    const forms = ['loginForm', 'registerForm', 'forgotForm', 'verifyForm', 'resetForm'];
    let currentFormId = null;

    forms.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
            currentFormId = id;
        }
    });

    const currentForm = document.getElementById(currentFormId);
    let nextFormId = '';

    // Map tab names to IDs
    if (tab === 'login') nextFormId = 'loginForm';
    else if (tab === 'register') nextFormId = 'registerForm';
    else if (tab === 'forgot') nextFormId = 'forgotForm';
    else if (tab === 'verify') nextFormId = 'verifyForm';
    else if (tab === 'reset') nextFormId = 'resetForm';

    const nextForm = document.getElementById(nextFormId);
    if (!nextForm || nextForm === currentForm) return;

    // Handle Tab Buttons (Only for Login/Register)
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (tab === 'login') {
        setActive(tabLogin);
        setInactive(tabRegister);
        moveIndicator('login');
    } else if (tab === 'register') {
        setActive(tabRegister);
        setInactive(tabLogin);
        moveIndicator('register');
    } else {
        // Deactivate both if in recovery flow
        setInactive(tabLogin);
        setInactive(tabRegister);
        moveIndicator('recovery');
    }

    const card = document.getElementById('auth-card');

    // 1. Lock height & Start Fade Out
    const startHeight = card.offsetHeight;
    card.style.height = startHeight + 'px';

    currentForm.classList.add('opacity-0');

    setTimeout(() => {
        // 2. Swap Content
        currentForm.classList.add('hidden');
        nextForm.classList.remove('hidden');
        nextForm.classList.add('opacity-0');

        // 3. Measure Target Height
        card.style.height = 'auto';
        const endHeight = card.offsetHeight;

        // 4. Restore, Reflow, Animate
        card.style.height = startHeight + 'px';
        void card.offsetHeight;

        requestAnimationFrame(() => {
            card.style.height = endHeight + 'px';
            setTimeout(() => {
                nextForm.classList.remove('opacity-0');
            }, 50);
        });

        // 6. Cleanup
        setTimeout(() => {
            card.style.height = null;
        }, 500);
    }, 200);
}

function setActive(el) {
    if (!el) return;
    el.classList.remove('text-gray-500');
    el.classList.add('text-blue-500');
}

function setInactive(el) {
    if (!el) return;
    el.classList.remove('text-blue-500');
    el.classList.add('text-gray-500');
}

// Slide the tab indicator to the target tab
function moveIndicator(tab) {
    const indicator = document.getElementById('tab-indicator');
    const highlight = document.getElementById('tab-highlight');

    if (!indicator || !highlight) return;

    if (tab === 'login') {
        indicator.style.left = '0';
        highlight.style.left = '0';
    } else if (tab === 'register') {
        indicator.style.left = '50%';
        highlight.style.left = '50%';
    } else {
        // Recovery forms - hide indicator
        indicator.style.opacity = '0';
        highlight.style.opacity = '0';
    }

    // Ensure visible
    if (tab === 'login' || tab === 'register') {
        indicator.style.opacity = '1';
        highlight.style.opacity = '1';
    }
}

// Toggle password visibility
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const eyeClosed = btn.querySelector('.eye-closed');
    const eyeOpen = btn.querySelector('.eye-open');

    if (input.type === 'password') {
        input.type = 'text';
        eyeClosed.classList.add('hidden');
        eyeOpen.classList.remove('hidden');
    } else {
        input.type = 'password';
        eyeClosed.classList.remove('hidden');
        eyeOpen.classList.add('hidden');
    }
}

function showError(msg) {
    // Try to get localized message
    const localizedMsg = window.t ? window.t(msg) : msg;
    if (window.showToast) {
        showToast(localizedMsg, 'error');
    } else {
        alert(localizedMsg);
    }
}

// Handle Google Login
async function handleCredentialResponse(response) {
    if (response.credential) {
        try {
            const res = await api.post('/api/auth/google', { token: response.credential });
            if (res && res.access_token) {
                api.setToken(res.access_token);
                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            showError("Google Auth Failed: " + err.message);
        }
    }
}

// Validation Helpers
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Handle Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validation
    if (!isValidEmail(email)) {
        showError(window.lang ? window.lang.t('error_invalid_email') || "Invalid Email Format" : "Invalid Email");
        return;
    }
    if (!password) {
        showError("Password is required");
        return;
    }

    // Basic validation feedback
    // FIX: target type="submit" to avoid selecting the eye token button
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = window.lang ? window.lang.t('auth_authenticating') : "Authenticating...";
    btn.disabled = true;

    try {
        const res = await api.post('/api/auth/login', { email, password });
        if (res && res.access_token) {
            api.setToken(res.access_token);
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        showError(err.message || (window.lang ? window.lang.t('auth_failed') : "Invalid credentials"));
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// Password Strength Logic
function calculateStrength(password) {
    let score = 0;
    if (!password) return { score: 0, label: "" };

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Normalize to 1-3 scale for UI
    // 0-2 pts = Weak (1)
    // 3-4 pts = Medium (2)
    // 5 pts = Strong (3)

    let uiScore = 1;
    let labelKey = 'pass_strength_weak';

    if (password.length < 8) {
        uiScore = 0; // Too short to even be weak
        labelKey = 'error_password_short';
    } else if (score >= 4) {
        uiScore = 3;
        labelKey = 'pass_strength_strong';
    } else if (score >= 2) {
        uiScore = 2;
        labelKey = 'pass_strength_medium';
    }

    return { score: uiScore, labelKey };
}

// Real-time Strength Monitor
document.getElementById('regPass').addEventListener('input', (e) => {
    const val = e.target.value;
    const container = document.getElementById('passwordStrength');
    const textEl = document.getElementById('strengthText');

    if (val.length > 0) {
        container.classList.remove('hidden');
        const result = calculateStrength(val);

        // Remove old classes
        container.classList.remove('strength-weak', 'strength-medium', 'strength-strong');

        // Add new class
        if (result.score === 1) container.classList.add('strength-weak');
        if (result.score === 2) container.classList.add('strength-medium');
        if (result.score === 3) container.classList.add('strength-strong');

        // Update Text
        textEl.innerText = window.lang ? window.lang.t(result.labelKey) : result.labelKey;
    } else {
        container.classList.add('hidden');
    }
});

// Handle Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;

    // Validation
    const strength = calculateStrength(password);
    if (strength.score < 2) {
        // 0=Too Short, 1=Weak, 2=Medium, 3=Strong
        showError(window.lang ? "Password is too weak" : "Password is too weak");
        // We'll trust the visual indicator mostly, but prevent "Weak" (Red)
        return;
    }

    if (name.length < 2) {
        showError("Name must be at least 2 characters");
        return;
    }
    if (!isValidEmail(email)) {
        showError("Invalid Email Format");
        return;
    }
    // Length already checked in calculateStrength/UI but good to double check
    if (password.length < 8) {
        showError(window.lang ? window.lang.t('error_password_short') || "Password must be at least 8 characters" : "Password > 8 chars required");
        return;
    }

    // FIX: target type="submit" to avoid selecting other buttons (like the eye icon)
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = window.lang ? window.lang.t('auth_creating') : "Creating Profile...";
    btn.disabled = true;

    try {
        // Actually call the register API!
        const res = await api.post('/api/auth/register', { name, email, password });

        if (window.showToast) window.showToast("Account user created! Please check email.", "success");

        // Switch to verification mode
        recoveryData.email = email;
        recoveryData.mode = 'register'; // New flag
        switchTab('verify');
    } catch (err) {
        let msg = err.message;
        // Backend returns "Email already registered" (en) or we might need to localize it
        if (msg.includes("Email already registered")) {
            msg = window.lang ? window.lang.t('error_email_taken') || "Ця пошта вже зареєстрована" : "Email already taken";
        } else if (msg.includes("Invalid credentials")) {
            msg = window.lang ? window.lang.t('auth_failed') || "Невірні дані" : "Invalid credentials";
        } else {
            msg = window.lang ? window.lang.t('reg_failed') || "Registration failed" : msg;
        }

        showError(msg);
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// RECOVERY/VERIFY FLOW STATE
let recoveryData = {
    email: '',
    code: '',
    mode: 'reset' // 'reset' or 'register'
};

// 1. Forgot Submit
document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();

    if (!isValidEmail(email)) {
        showError("Invalid Email Format");
        return;
    }

    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
        await api.post('/api/auth/forgot-password', { email });
        recoveryData.email = email;
        if (window.showToast) window.showToast(window.lang ? window.lang.t('code_sent') || "Code Sent!" : "Code Sent!", "success");

        if (window.showToast) window.showToast(window.lang ? window.lang.t('code_sent') || "Code Sent!" : "Code Sent!", "success");

        recoveryData.mode = 'reset';
        switchTab('verify');
    } catch (err) {
        showError(err.message === "User not found" && window.lang ? window.lang.t('error_user_not_found') : err.message);
    } finally {
        btn.disabled = false;
    }
});

// 2. Verify Submit
document.getElementById('verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('verifyCode').value.trim();

    if (code.length < 4) {
        showError("Invalid Code");
        return;
    }

    if (recoveryData.mode === 'register') {
        // Direct Verification for Registration
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Verifying...";

        try {
            const res = await api.post('/api/auth/verify-email', {
                email: recoveryData.email,
                code: code
            });

            if (res && res.access_token) {
                api.setToken(res.access_token);
                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            showError(err.message || "Verification Failed");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } else {
        // Password Reset Flow - just store code and move to reset
        recoveryData.code = code;
        switchTab('reset');
    }
});

// 3. Reset Submit
document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('resetPass').value;

    if (password.length < 8) {
        showError(window.lang ? window.lang.t('error_password_short') : "Password too short");
        return;
    }

    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
        await api.post('/api/auth/reset-password', {
            email: recoveryData.email,
            code: recoveryData.code,
            new_password: password
        });

        if (window.showToast) window.showToast(window.lang ? window.lang.t('pass_updated') || "Password Updated!" : "Password Updated!", "success");

        setTimeout(() => {
            switchTab('login');
        }, 1500);

    } catch (err) {
        showError(err.message || "Reset Failed");
        if (err.message.includes("code")) {
            switchTab('verify'); // Go back to check code if wrong
        }
    } finally {
        btn.disabled = false;
    }
});

// Check if already logged in
if (api.getToken()) {
    // Verify token validity via /me endpoint or just redirect
    window.location.href = 'dashboard.html';
}
