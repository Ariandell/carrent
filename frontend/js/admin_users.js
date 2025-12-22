document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    if (!api.isAuthenticated()) {
        window.location.href = '../auth.html';
        return;
    }

    // Load users
    await loadUsers();
});

async function loadUsers() {
    try {
        const users = await api.get('/api/users/');
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/50';
            tr.innerHTML = `
                <td class="p-3">
                    <div class="flex items-center space-x-3">
                        <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + user.name}" class="w-8 h-8 rounded-full">
                        <span>${user.email}</span>
                    </div>
                </td>
                <td class="p-3">${user.name}</td>
                <td class="p-3">${user.balance_minutes} min</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}">
                        ${user.role}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Failed to load users:", error);
        alert("Failed to load users. Are you admin?");
    }
}
