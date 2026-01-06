let selectedCarId = null;
let selectedTopUpAmount = 100;
let selectedDurationMinutes = 10;
let userBalance = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Check for payment success query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        // Clear the query param from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Show success toast after page loads (delayed to ensure showToast is available)
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast(window.t('msg_payment_success'), 'success');
            }
        }, 500);
    }

    // 1. Fetch User Info
    try {
        const user = await api.get('/api/users/profile');
        if (user) {
            userBalance = user.balance || 0;
            document.getElementById('balanceDisplay').innerHTML = `${userBalance} <small class="text-xs">₴</small>`;

            if (user.avatar_url) document.getElementById('userAvatar').src = user.avatar_url;
            if (user.name) document.getElementById('userName').innerText = user.name;

            // Admin Button Logic - Only show for admin users
            if (user.role === 'admin' || user.role === 'UserRole.ADMIN') {
                // Admin Panel link embedded in dropdown below

                // Add Admin Panel link to dropdown menu
                const dropdown = document.getElementById('userDropdown');
                if (dropdown) {
                    const profileLink = dropdown.querySelector('a[href="profile.html"]');
                    if (profileLink) {
                        const adminLink = document.createElement('a');
                        adminLink.href = 'admin/index.html';
                        adminLink.className = 'block px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors';
                        adminLink.innerText = window.t('nav_admin') || 'Адмін';
                        profileLink.insertAdjacentElement('afterend', adminLink);
                    }
                }
            }

            // Check for active rental
            // For now, since we don't have a direct endpoint for "check status" in api.js wrappers easily, 
            // we rely on listing rentals or active endpoint. 
            // Checking active rental:
            checkActiveRental();
        } else {
            window.location.href = 'index.html';
        }

        loadCars();
        setupWebSocket();

        // Start timer update loop
        setInterval(updateTimers, 1000);

    } catch (e) {
        console.error(e);
        // Force auth if 401
    }
});

// Filter State
let currentFilter = 'all';

function setFilter(filter) {
    currentFilter = filter;

    // Update UI - using simple classes that work with Tailwind dark mode
    const btnAll = document.getElementById('filterAll');
    const btnAvail = document.getElementById('filterAvailable');

    // Active button style
    const activeClass = 'px-5 py-2 rounded-lg text-sm font-bold transition-all bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm';
    // Inactive button style  
    const inactiveClass = 'px-5 py-2 rounded-lg text-sm font-bold transition-all text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white';

    if (filter === 'all') {
        btnAll.className = activeClass;
        btnAvail.className = inactiveClass;
    } else {
        btnAvail.className = activeClass;
        btnAll.className = inactiveClass;
    }

    loadCars();
}

async function checkActiveRental() {
    try {
        const rental = await api.get('/api/rentals/active');
        if (rental) {
            document.getElementById('activeRentalBanner').classList.remove('hidden');
        }
    } catch (e) {
        // No active rental or error
    }
}

async function loadCars() {
    const grid = document.getElementById('carsGrid');
    try {
        const cars = await api.get('/api/cars/');

        // Clear initial skeletons if any
        const skeletons = grid.querySelectorAll('.skeleton');
        skeletons.forEach(el => el.remove());

        if (cars.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-muted py-12">${window.t('no_cars_available') || 'Немає доступних пристроїв'}</div>`;
            return;
        }

        const existingCards = new Set(Array.from(grid.children).map(c => c.id));
        const activeIds = new Set();

        cars.forEach(car => {
            // FILTER LOGIC
            const isFree = car.status === 'free';
            if (currentFilter === 'available' && !isFree) {
                // If filtering by available, skip busy/offline cars
                return;
            }

            const cardId = `car-${car.id}`;
            activeIds.add(cardId);

            const isBusy = car.status === 'busy';

            // Status styling
            const statusColor = isFree ? 'bg-blue-500' : (isBusy ? 'bg-indigo-500' : 'bg-red-500');
            const statusTextColor = isFree ? 'text-blue-400' : (isBusy ? 'text-indigo-400' : 'text-red-400');
            const statusText = isFree ? window.t('status_online') : (isBusy ? window.t('status_busy') : window.t('status_offline'));

            // Reservation Info Logic
            let reservationHTML = '';
            let busyUntilAttr = '';

            if (isBusy && car.busy_until) {
                // Use data attribute strictly for logic
                busyUntilAttr = `data-busy-until="${car.busy_until}"`;

                const bookedByName = car.booked_by_name || window.t('unknown_user') || 'Невідомий користувач';

                reservationHTML = `
                    <div class="mt-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 text-xs">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-indigo-600 dark:text-indigo-400 font-medium uppercase tracking-wider">${window.t('label_reserved')}</span>
                            <span class="text-indigo-700 dark:text-indigo-300 font-bold truncate max-w-[80px]" title="${bookedByName}">${bookedByName}</span>
                        </div>
                        <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                            <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="countdown-timer" data-until="${car.busy_until}">${window.t('label_calculating')}</span>
                        </div>
                    </div>
                `;
            }

            // Modern Pill Badge
            const statusBadgeHTML = `
                <div class="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg">
                    <span class="w-1.5 h-1.5 rounded-full ${statusColor} ${isFree ? 'animate-pulse' : ''} shadow-[0_0_8px_currentColor]"></span>
                    <span class="text-[10px] font-bold tracking-wider ${statusTextColor}">${statusText}</span>
                </div>`;

            // ... (rest of logic) ...

                    < !--Bottom Info: Battery + Price-- >
                <div class="absolute bottom-3 right-4 z-20 flex items-center gap-2">
                    <div class="px-2 py-1 rounded-md bg-black/40 backdrop-blur border border-white/10 text-[10px] font-mono text-white/80">
                        ${window.t('label_battery')} <span id="batt-${car.id}" class="text-white font-bold ml-1">${car.battery_level}%</span>
                    </div>
                    <div class="px-2 py-1 rounded-md bg-blue-500/80 backdrop-blur border border-blue-400/30 text-[10px] font-bold text-white">
                        ${car.price_per_minute || 1} ${window.t('currency_minute')}
                    </div>
                </div>
                </div >

                // ... (rest of logic) ...

    // ... (modal logic) ...
    // ...
    // ...
    // ...
        } else {
            document.getElementById('estimatedCost').innerHTML = `<span>${window.t('label_cost')}</span> <span class="text-blue-400">${estimatedCost} ₴</span>`;
        }
}

async function confirmRental() {
        if (!selectedCarId) return;

        const cost = selectedDurationMinutes * selectedCarPrice;

        if (userBalance < cost) {
            showToast(`${window.t('err_insufficient_funds')} ${cost.toFixed(2)} ₴`, 'error');
            return;
        }

        try {
            const res = await api.post('/api/rentals/start', {
                car_id: selectedCarId,
                duration_minutes: selectedDurationMinutes
            });

            if (res && res.id) {
                localStorage.setItem('active_rental_id', res.id);
                window.location.href = 'control.html?rental_id=' + res.id;
            }
        } catch (e) {
            showToast(window.t('err_rent_failed') + " " + e.message, 'error');
        }
    }

    // === Top Up Modal ===
    function openTopUpModal() {
        const el = document.getElementById('topUpModal');
        if (el) {
            el.style.display = 'flex';
            requestAnimationFrame(() => el.classList.add('active'));
        }
        selectAmount(100); // Default
    }
    function closeTopUpModal() {
        const el = document.getElementById('topUpModal');
        if (el) {
            el.classList.remove('active');
            setTimeout(() => el.style.display = 'none', 300);
        }
    }

    function selectAmount(amount) {
        selectedTopUpAmount = amount;
        // Update UI styling for amount buttons
        const buttons = document.querySelectorAll('.amount-btn');
        buttons.forEach(btn => {
            if (btn.innerText.includes(amount + ' ₴')) {
                btn.classList.add('border-blue-500', 'bg-blue-500/10');
                btn.classList.remove('border-transparent', 'bg-black/5', 'dark:bg-white/5');
            } else {
                btn.classList.remove('border-blue-500', 'bg-blue-500/10');
                btn.classList.add('border-transparent', 'bg-black/5', 'dark:bg-white/5');
            }
        });
    }

    async function processPayment() {
        const url = `/api/payments/create?amount=${selectedTopUpAmount}`;
        try {
            const res = await api.post(url, {});
            if (res && res.data && res.signature) {
                document.getElementById('liqpayData').value = res.data;
                document.getElementById('liqpaySignature').value = res.signature;
                document.getElementById('liqpayForm').submit();
            }
        } catch (e) {
            showToast(window.t('err_payment_failed') + " " + e.message, 'error');
        }
    }

    // === Support Modal ===
    function openSupportModal() {
        const el = document.getElementById('supportModal');
        if (el) {
            el.style.display = 'flex';
            requestAnimationFrame(() => el.classList.add('active'));
        }
    }
    function closeSupportModal() {
        const el = document.getElementById('supportModal');
        if (el) {
            el.classList.remove('active');
            setTimeout(() => el.style.display = 'none', 300);
        }
    }
    async function submitSupport() {
        const subject = document.getElementById('supportSubject').value;
        const message = document.getElementById('supportMessage').value;

        if (!message.trim()) {
            showToast(window.t('val_enter_message'), 'error');
            return;
        }

        try {
            await api.post('/api/support/', {
                subject: subject,
                message: message
            });
            showToast(window.t('msg_support_sent'), 'success');
            document.getElementById('supportMessage').value = '';
            closeSupportModal();
        } catch (e) {
            showToast(window.t('err_support_send') + ' ' + e.message, 'error');
        }
    }

    // === WebSocket ===
    function setupWebSocket() {
        // Only for updates on car status list
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use hardcoded port 8000 if dev, else relative
        const host = window.location.host;

        const ws = new WebSocket(`${protocol}//${host}/api/ws/status`);
        ws.onmessage = (event) => {
            // On any update, reload cars
            // Optimization: parse event and update specific card
            loadCars();
        }
    }
