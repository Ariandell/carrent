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
                showToast('Оплата успішна! Баланс оновлено.', 'success');
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
                        adminLink.innerText = 'Адмін';
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

    // Update UI
    const btnAll = document.getElementById('filterAll');
    const btnAvail = document.getElementById('filterAvailable');

    if (filter === 'all') {
        btnAll.className = 'btn-primary px-3 py-1.5 text-sm rounded-lg transition-all';
        btnAll.classList.remove('opacity-60', 'btn-secondary');

        btnAvail.className = 'btn-secondary px-3 py-1.5 text-sm rounded-lg opacity-60 transition-all';
    } else {
        btnAvail.className = 'btn-primary px-3 py-1.5 text-sm rounded-lg transition-all';
        btnAvail.classList.remove('opacity-60', 'btn-secondary');

        btnAll.className = 'btn-secondary px-3 py-1.5 text-sm rounded-lg opacity-60 transition-all';
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
            grid.innerHTML = '<div class="col-span-full text-center text-muted py-12">Немає доступних пристроїв</div>';
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
            const statusColor = isFree ? 'bg-emerald-500' : (isBusy ? 'bg-indigo-500' : 'bg-red-500');
            const statusTextColor = isFree ? 'text-emerald-400' : (isBusy ? 'text-indigo-400' : 'text-red-400');
            const statusText = isFree ? 'ОНЛАЙН' : (isBusy ? 'ЗАЙНЯТО' : 'ОФЛАЙН');

            // Reservation Info Logic
            let reservationHTML = '';
            let busyUntilAttr = '';

            if (isBusy && car.busy_until) {
                // Use data attribute strictly for logic
                busyUntilAttr = `data-busy-until="${car.busy_until}"`;

                const bookedByName = car.booked_by_name || 'Невідомий користувач';

                reservationHTML = `
                    <div class="mt-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 text-xs">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-indigo-600 dark:text-indigo-400 font-medium uppercase tracking-wider">Зарезервовано</span>
                            <span class="text-indigo-700 dark:text-indigo-300 font-bold truncate max-w-[80px]" title="${bookedByName}">${bookedByName}</span>
                        </div>
                        <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                            <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="countdown-timer" data-until="${car.busy_until}">Розрахунок...</span>
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

            // Button styling (Cinematic)
            let btnClass = isFree
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_20px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:-translate-y-0.5'
                : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed';

            // Special styling for Occupied
            if (isBusy) {
                btnClass = 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 cursor-not-allowed';
            }

            const btnText = isFree
                ? '<span>Почати сесію</span> <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>'
                : (isBusy ? 'Зайнято' : 'Недоступно');

            const btnDisabled = !isFree ? 'disabled' : '';

            let card = document.getElementById(cardId);

            if (!card) {
                card = document.createElement('div');
                card.id = cardId;
                // iOS Glass Card Container
                card.className = `group relative flex flex-col overflow-hidden rounded-3xl transition-all duration-300 
                    bg-white/80 backdrop-blur-lg border border-gray-200/50 shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:scale-[1.02]
                    dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/10 dark:shadow-lg dark:shadow-black/20
                    ${!isFree ? 'opacity-90 grayscale-[0.2]' : ''}`;
                card.dataset.status = car.status;
                card.dataset.price = car.price_per_minute || 1.0; // Store price
                if (busyUntilAttr) card.dataset.busyUntil = car.busy_until;

                card.innerHTML = `
                <!-- Image Section with Parallax Effect -->
                <div class="relative h-48 overflow-hidden">
                    <!-- iOS Glassmorphism Background -->
                    <div class="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent dark:from-white/10 dark:via-white/5 dark:to-transparent backdrop-blur-xl"></div>
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-200/50 via-transparent to-transparent dark:from-black/40 dark:via-transparent dark:to-white/5"></div>
                    
                    <!-- Car Image with Hover Scale -->
                    <div class="absolute inset-0 flex items-center justify-center p-4">
                        <img src="${car.image_url || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=600'}" 
                             class="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl"
                             alt="${car.name}"
                             onerror="this.src='https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=600'">
                    </div>
                         
                    <!-- Top Float -->
                    <div class="absolute top-4 left-4 z-20" id="status-${car.id}">
                        ${statusBadgeHTML}
                    </div>

                    <!-- Bottom Info: Battery + Price -->
                    <div class="absolute bottom-3 right-4 z-20 flex items-center gap-2">
                         <div class="px-2 py-1 rounded-md bg-black/40 backdrop-blur border border-white/10 text-[10px] font-mono text-white/80">
                            BAT <span id="batt-${car.id}" class="text-white font-bold ml-1">${car.battery_level}%</span>
                         </div>
                         <div class="px-2 py-1 rounded-md bg-emerald-500/80 backdrop-blur border border-emerald-400/30 text-[10px] font-bold text-white">
                            ${car.price_per_minute || 1} ₴/хв
                         </div>
                    </div>
                </div>
                
                <!-- Content Section -->
                <div class="p-5 pt-4 flex flex-col flex-1">
                    <div class="mb-4">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-xl text-slate-800 dark:text-white mb-1 tracking-tight">${car.name}</h3>
                        </div>
                        <p class="text-sm text-slate-500 dark:text-gray-400 font-light">${car.description || 'High-performance FPV unit'}</p>
                        
                        <!-- Reservation Info Container -->
                        <div id="reservation-${car.id}">
                            ${reservationHTML}
                        </div>
                    </div>
                    
                    <div class="mt-auto">
                        <button id="btn-${car.id}" 
                                onclick="openRentModal('${car.id}', '${car.name}')" 
                                ${btnDisabled} 
                                class="w-full py-3 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${btnClass}">
                            ${btnText}
                        </button>
                    </div>
                </div>`;
                grid.appendChild(card);
            } else {
                // Update existing card
                // Only full redraw if status changed significantly, otherwise simple DOM updates
                // For simplicity, we can just update inner parts if we want, or do the dirty check

                // Always update battery
                const battEl = document.getElementById(`batt-${car.id}`);
                if (battEl) battEl.innerText = `${car.battery_level}%`;

                if (card.dataset.status !== car.status || card.dataset.busyUntil !== (car.busy_until || '')) {
                    document.getElementById(`status-${car.id}`).innerHTML = statusBadgeHTML;
                    const btn = document.getElementById(`btn-${car.id}`);
                    btn.className = `w-full py-3 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${btnClass}`;
                    btn.innerHTML = btnText; // Use HTML for icon
                    if (!isFree) btn.setAttribute('disabled', 'true'); else btn.removeAttribute('disabled');
                    card.className = `card overflow-hidden ${!isFree ? 'opacity-90 grayscale-[0.2]' : ''}`;
                    card.dataset.status = car.status;
                    card.dataset.price = car.price_per_minute || 1.0;
                    card.dataset.busyUntil = car.busy_until || '';

                    // Update reservation info part specifically
                    const resContainer = document.getElementById(`reservation-${car.id}`);
                    if (resContainer) resContainer.innerHTML = reservationHTML;
                }
            }
        });

        existingCards.forEach(id => {
            if (!activeIds.has(id)) {
                const el = document.getElementById(id);
                if (el) el.remove();
            }
        });

        // Immediate update of timers after load
        updateTimers();

    } catch (e) {
        console.error(e);
    }
}

function updateTimers() {
    const timers = document.querySelectorAll('.countdown-timer');
    timers.forEach(timer => {
        let untilStr = timer.dataset.until;
        if (!untilStr) return;

        // If naive datetime string (no Z or offset), assume UTC by appending Z
        if (!untilStr.endsWith('Z') && !untilStr.match(/[+-]\d\d:?\d\d$/)) {
            untilStr += 'Z';
        }

        const until = new Date(untilStr).getTime();
        const now = new Date().getTime();
        const diff = until - now;

        if (diff <= 0) {
            timer.innerText = "Скоро буде";
            // Optional: trigger reload if it just expired
            return;
        }

        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timer.innerText = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    });
}

// === Rent Modal ===
let selectedCarPrice = 1.0; // Default

function openRentModal(id, name) {
    selectedCarId = id;

    // Find car price from loaded cars logic or DOM
    // We can grab it from the DOM element we created or pass it in
    // Simpler: find the card logic
    const priceEl = document.querySelector(`#car-${id} .text-emerald-500\\/80`);
    // Wait, the DOM structure has the price in a specific div. 
    // Let's rely on looking up the text or storing it in dataset
    const card = document.getElementById(`car-${id}`);

    // Parse price from card text or API data if available. 
    // Since we don't keep a global cars map easily here, let's look at the card.
    // In loadCars we added price to the HTML: "1.00 ₴/хв"
    // Let's update loadCars to store price in dataset for easier access
    if (card && card.dataset.price) {
        selectedCarPrice = parseFloat(card.dataset.price);
    } else {
        selectedCarPrice = 1.0; // Fallback
    }

    selectDuration(10); // Reset to default
    document.getElementById('rentCarName').innerText = name;
    document.getElementById('modalBalance').innerText = `${userBalance} ₴`;
    document.getElementById('rentModal').classList.remove('hidden');
}

function closeRentModal() {
    document.getElementById('rentModal').classList.add('hidden');
    selectedCarId = null;
}

function selectDuration(minutes) {
    selectedDurationMinutes = minutes;
    const estimatedCost = (minutes * selectedCarPrice).toFixed(2);

    // Update UI styling and text
    const buttons = document.querySelectorAll('.duration-btn');
    buttons.forEach(btn => {
        const durationText = btn.querySelector('.font-medium');
        const badge = btn.querySelector('.badge');

        // Reset base text if needed or just update badge
        // We know the structure: span (Time), span (Badge)
        // Let's just update the badge to show cost
        if (btn.innerText.includes(minutes + ' ')) { // Simple check
            btn.classList.add('border-blue-500', 'bg-blue-500/10');
            btn.classList.remove('border-[var(--divider)]', 'bg-[var(--card-bg)]');
        } else {
            btn.classList.remove('border-blue-500', 'bg-blue-500/10');
            btn.classList.add('border-[var(--divider)]', 'bg-[var(--card-bg)]');
        }
    });

    // Update the visual confirmation of cost if we had a dedicated element, 
    // but for now let's just update the specific button badges if we can identify them
    // Or simpler: Update a "Total Cost" display in the modal
    const costDisplay = document.getElementById('rentalCostDisplay');
    if (!costDisplay) {
        // Create it if missing or just append to modal
        // For this iteration, let's keep it simple and maybe update the button text dynamically?
        // Actually, let's add a cost line above the button
        let costEl = document.getElementById('estimatedCost');
        if (!costEl) {
            costEl = document.createElement('div');
            costEl.id = 'estimatedCost';
            costEl.className = 'flex justify-between items-center mb-4 text-sm font-bold text-white';
            document.querySelector('#rentModal .p-6:last-child').insertBefore(costEl, document.querySelector('#rentModal .btn-primary'));
        }
        costEl.innerHTML = `<span>Вартість</span> <span class="text-emerald-400">${estimatedCost} ₴</span>`;
    } else {
        document.getElementById('estimatedCost').innerHTML = `<span>Вартість</span> <span class="text-emerald-400">${estimatedCost} ₴</span>`;
    }
}

async function confirmRental() {
    if (!selectedCarId) return;

    const cost = selectedDurationMinutes * selectedCarPrice;

    if (userBalance < cost) {
        showToast(`Недостатньо коштів! Потрібно: ${cost.toFixed(2)} ₴`, 'error');
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
        showToast("Помилка оренди: " + e.message, 'error');
    }
}

// === Top Up Modal ===
function openTopUpModal() {
    document.getElementById('topUpModal').classList.remove('hidden');
    selectAmount(100); // Default
}
function closeTopUpModal() { document.getElementById('topUpModal').classList.add('hidden'); }

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
        showToast("Помилка оплати: " + e.message, 'error');
    }
}

// === Support Modal ===
function openSupportModal() {
    document.getElementById('supportModal').classList.remove('hidden');
}
function closeSupportModal() {
    document.getElementById('supportModal').classList.add('hidden');
}
async function submitSupport() {
    const subject = document.getElementById('supportSubject').value;
    const message = document.getElementById('supportMessage').value;

    if (!message.trim()) {
        showToast('Будь ласка, введіть повідомлення', 'error');
        return;
    }

    try {
        await api.post('/api/support/', {
            subject: subject,
            message: message
        });
        showToast('Запит надіслано! Ми зв\'яжемось з вами.', 'success');
        document.getElementById('supportMessage').value = '';
        closeSupportModal();
    } catch (e) {
        showToast('Помилка надсилання: ' + e.message, 'error');
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
