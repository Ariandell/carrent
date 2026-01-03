const urlParams = new URLSearchParams(window.location.search);
let ws = null;
let currentCarId = null;
let currentRentalId = null;
let timerInterval = null;
let expiryTime = null;
let totalDurationMs = 0;
let extendModalShown = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await api.get('/api/users/profile');

        const rental = await api.get('/api/rentals/active');
        if (!rental) {
            showToast("Активного зв'язку не знайдено. Повернення на базу.", 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        currentRentalId = rental.id;
        currentCarId = rental.car_id;
        let startedAtStr = rental.started_at;
        if (!startedAtStr.endsWith('Z')) startedAtStr += 'Z';
        const startedAt = new Date(startedAtStr).getTime();
        totalDurationMs = (rental.duration_minutes + (rental.extended_minutes || 0)) * 60 * 1000;
        expiryTime = startedAt + totalDurationMs;

        const car = await api.get(`/api/cars/${rental.car_id}`);
        if (car) {
            if (car.vdo_ninja_id) {
                // Updated to use clean params for VDO
                const vdoUrl = `https://vdo.ninja/?view=${car.vdo_ninja_id}&autoplay&clean&transparent&label=CarCam&controls=0&info=0`;
                document.getElementById('videoStream').src = vdoUrl;
            }
            // Store price
            currentPricePerMinute = car.price_per_minute || 1.0;
            updateExtendButtons();
        }

        connectWebSocket(rental.car_id);
        startTimer();

    } catch (e) {
        console.error(e);
        // window.location.href = 'dashboard.html';
    }
});

function connectWebSocket(carId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws/control/${carId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        const el = document.getElementById('connectionStatus');
        el.classList.remove('bg-red-500');
        el.classList.add('bg-emerald-400', 'shadow-[0_0_10px_#34d399]');

        const txt = document.getElementById('statusText');
        if (txt) txt.innerText = "ОНЛАЙН";

        document.getElementById('ping').innerText = '24'; // Fake initial ping
    };

    ws.onclose = () => {
        const el = document.getElementById('connectionStatus');
        el.classList.add('bg-red-500');
        el.classList.remove('bg-emerald-400', 'shadow-[0_0_10px_#34d399]');

        const txt = document.getElementById('statusText');
        if (txt) txt.innerText = "ОФЛАЙН";

        document.getElementById('ping').innerText = '--';
    };

    ws.onmessage = (msg) => {
        // Handle explicit latency packet if backend sends it
    };
}

function sendCommand(cmd) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(cmd);
        visualizeKey(cmd);
    }
}

// Controls
const keys = {
    'w': 'forward', 's': 'backward', 'a': 'left', 'd': 'right',
    'arrowup': 'cam_up', 'arrowdown': 'cam_down', 'arrowleft': 'cam_left', 'arrowright': 'cam_right'
};

// Add event listeners for visualizer
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] && !e.repeat) {
        sendCommand(keys[key]);
        const keyEl = document.getElementById(`key-${key}`);
        if (keyEl) keyEl.classList.add('bg-white', 'text-black', 'border-white');
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key]) {
        sendCommand('stop');
        const keyEl = document.getElementById(`key-${key}`);
        if (keyEl) keyEl.classList.remove('bg-white', 'text-black', 'border-white');
    }
});

function visualizeKey(cmd) {
    // Only used for mobile touch mainly, or additional FX
    // For mobile touch, the active state is handled by CSS :active
}

// Mobile Joysticks
function initJoysticks() {
    if (!document.getElementById('zone-right')) return;

    // Safety check visibility again
    document.getElementById('mobile-controls').classList.remove('hidden');

    // Right Joystick (Driving)
    const managerRight = nipplejs.create({
        zone: document.getElementById('zone-right'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    });

    let currentDriveCmd = null;

    managerRight.on('move', (evt, data) => {
        if (!data.direction) return;

        // Simple 4-way digital mapping
        const angle = data.angle.degree;
        let cmd = 'stop';

        // Add deadzone and overlap handling via simple angle ranges
        if (angle >= 45 && angle < 135) cmd = 'forward';
        else if (angle >= 135 && angle < 225) cmd = 'left';
        else if (angle >= 225 && angle < 315) cmd = 'backward';
        else cmd = 'right'; // 315-45

        if (cmd !== currentDriveCmd) {
            currentDriveCmd = cmd;
            sendCommand(cmd);
        }
    });

    managerRight.on('end', () => {
        currentDriveCmd = null;
        sendCommand('stop');
    });

    // Left Joystick (Camera)
    const managerLeft = nipplejs.create({
        zone: document.getElementById('zone-left'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    });

    let currentCamCmd = null;

    managerLeft.on('move', (evt, data) => {
        if (!data.direction) return;

        const angle = data.angle.degree;
        let cmd = null;

        if (angle >= 45 && angle < 135) cmd = 'cam_up';
        else if (angle >= 135 && angle < 225) cmd = 'cam_left';
        else if (angle >= 225 && angle < 315) cmd = 'cam_down';
        else cmd = 'cam_right';

        if (cmd && cmd !== currentCamCmd) {
            currentCamCmd = cmd;
            sendCommand(cmd);
        }
    });

    managerLeft.on('end', () => {
        currentCamCmd = null;
        // Optionally send cam stop? usually servos just hold or stop moving
        // sendCommand('cam_stop');
    });
}

// Init only if touch detected
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isTouch) {
    // Force mobile layout
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('desktop-controls').classList.add('hidden');

        // Ensure browser bar is hidden if possible or warn user about landscape
        setTimeout(initJoysticks, 500); // Wait for render
    });
} else {
    // Force desktop layout - only enable if strictly mouse
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('desktop-controls').classList.remove('hidden');
        document.getElementById('desktop-controls').classList.add('flex');
    });
}

function startTimer() {
    timerInterval = setInterval(() => {
        const now = Date.now();
        let diff = expiryTime - now;

        if (diff <= 0) {
            clearInterval(timerInterval);
            document.getElementById('timerDisplay').innerText = "00:00";

            // Auto-release logic: Force exit when time is up
            showToast("Сесія минула. Повернення на базу...", 'error');
            sendCommand('stop'); // Safety stop
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

            return;
        }

        // Show Extend Modal if < 30s
        if (diff < 30000 && !extendModalShown) {
            document.getElementById('extendModal').classList.remove('hidden');
            extendModalShown = true;
        }

        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        document.getElementById('timerDisplay').innerText =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Calculate percentage for progress bar
        // We need the original rental duration for this? 
        // Let's approximate using totalDurationMs updated on extend
        const percent = Math.max(0, (diff / totalDurationMs) * 100);
        document.getElementById('timeProgress').style.width = `${percent}%`;

        // Change color if low
        if (percent < 20) {
            document.getElementById('timeProgress').className = "h-full bg-red-500 relative w-full origin-left transition-all duration-1000";
            document.getElementById('timerDisplay').classList.add('text-red-500', 'animate-pulse');
        }

    }, 1000);
}

function closeExtendModal() {
    document.getElementById('extendModal').classList.add('hidden');
}

// Global state update
let currentPricePerMinute = 1.0;

async function extendRental(minutes) {
    if (!currentRentalId) return;
    try {
        await api.post('/api/rentals/extend', {
            rental_id: currentRentalId,
            additional_minutes: minutes
        });

        // Update expiry
        const addedMs = minutes * 60 * 1000;
        expiryTime += addedMs;
        totalDurationMs += addedMs; // Update total to prevent progress bar jumping too weirdly

        extendModalShown = false;
        closeExtendModal();

        // Reset Low Fuel warnings
        document.getElementById('timeProgress').className = "h-full bg-white relative w-full origin-left transition-all duration-1000";
        document.getElementById('timerDisplay').classList.remove('text-red-500', 'animate-pulse');

        showToast(`Оренду продовжено на ${minutes} хв`, 'success');

    } catch (e) {
        showToast("Продовження недоступне: " + e.message, 'error');
    }
}

// Update initialization to fetch price and update button text
function updateExtendButtons() {
    // 3 min
    const cost3 = (3 * currentPricePerMinute).toFixed(2);
    document.querySelector('#btnExtend3 span:last-child').innerText = `+3хв (${cost3} ₴)`;

    // 5 min
    const cost5 = (5 * currentPricePerMinute).toFixed(2);
    document.querySelector('#btnExtend5 span:last-child').innerText = `+5хв (${cost5} ₴)`;

    // 10 min
    const cost10 = (10 * currentPricePerMinute).toFixed(2);
    document.querySelector('#btnExtend10 span:last-child').innerText = `+10хв (${cost10} ₴)`;
}

function confirmExit() {
    if (confirm("Перервати місію і повернутись до ангару?")) {
        window.location.href = 'dashboard.html';
    }
}

function openExpiryModal() {
    document.getElementById('expiryModal').classList.remove('hidden');
}

// Report Logic
function openReportModal() {
    document.getElementById('reportModal').classList.remove('hidden');
}

async function submitReport() {
    const issue = document.getElementById('issueText').value;
    if (!issue) { showToast('Будь ласка, опишіть проблему', 'error'); return; }

    try {
        await api.post('/api/rentals/report', {
            rental_id: currentRentalId,
            issue: issue
        });
        showToast('Звіт надіслано. Підтримка повідомлена.', 'success');
        document.getElementById('reportModal').classList.add('hidden');
    } catch (e) {
        showToast('Помилка передачі: ' + e.message, 'error');
    }
}

// Feedback Logic
let currentRating = 0;
function setRating(r) {
    currentRating = r;
    const stars = document.getElementById('starRating').children;
    for (let i = 0; i < 5; i++) {
        stars[i].className = i < r
            ? "text-2xl text-yellow-400 cursor-pointer transition-colors"
            : "text-2xl text-gray-600 hover:text-yellow-400 cursor-pointer transition-colors";
    }
    document.getElementById('feedbackText').classList.remove('hidden');
}

async function submitFeedbackAndExit() {
    if (currentRating > 0) {
        try {
            await api.post('/api/rentals/feedback', {
                rental_id: currentRentalId,
                rating: currentRating,
                comment: document.getElementById('feedbackText').value
            });
        } catch (e) { console.error("Feedback error", e); }
    }
    window.location.href = 'dashboard.html';
}
