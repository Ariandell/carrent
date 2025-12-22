document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    if (!api.isAuthenticated()) {
        window.location.href = '../auth.html';
        return;
    }

    // Load rentals
    await loadRentals();
});

async function loadRentals() {
    try {
        const rentals = await api.get('/api/rentals/');
        const tbody = document.getElementById('rentalsTable');
        tbody.innerHTML = '';

        rentals.forEach(rental => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/50';
            const statusColor = rental.status === 'active' ? 'text-green-400' : 'text-gray-400';

            tr.innerHTML = `
                <td class="p-3 font-mono text-xs text-gray-500">${rental.id.split('-')[0]}...</td>
                <td class="p-3 text-xs">${rental.user_id}</td> <!-- ideally fetch user name -->
                <td class="p-3 text-xs">${rental.car_id}</td> <!-- ideally fetch car name -->
                <td class="p-3">${new Date(rental.started_at).toLocaleString()}</td>
                <td class="p-3 ${statusColor}">${rental.status}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Failed to load rentals:", error);
        alert("Failed to load rentals. Are you admin?");
    }
}
