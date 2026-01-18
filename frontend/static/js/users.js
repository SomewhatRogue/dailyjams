// User profile management

let selectedColor = '#2980b9';
let userToDelete = null;

document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    setupEventListeners();
});

function setupEventListeners() {
    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
        });
    });

    // Add user form
    document.getElementById('add-user-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await createUser();
    });

    // Cancel add user
    document.getElementById('cancel-add-user').addEventListener('click', function() {
        hideModal('add-user-modal');
    });

    // Delete confirmation
    document.getElementById('cancel-delete').addEventListener('click', function() {
        hideModal('delete-modal');
        userToDelete = null;
    });

    document.getElementById('confirm-delete').addEventListener('click', async function() {
        if (userToDelete) {
            await deleteUser(userToDelete);
        }
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this.id);
                userToDelete = null;
            }
        });
    });
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();

        if (data.success) {
            renderUsers(data.users);
        } else {
            console.error('Failed to load users:', data.error);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers(users) {
    const grid = document.getElementById('users-grid');
    grid.innerHTML = '';

    // Render existing users
    users.forEach(user => {
        const card = createUserCard(user);
        grid.appendChild(card);
    });

    // Add "Add New" card
    const addCard = document.createElement('div');
    addCard.className = 'user-card add-user-card';
    addCard.innerHTML = `
        <div class="user-avatar add-avatar">+</div>
        <span class="user-name">Add Profile</span>
    `;
    addCard.addEventListener('click', showAddUserModal);
    grid.appendChild(addCard);
}

function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.dataset.userId = user.id;

    const initial = user.name.charAt(0).toUpperCase();

    card.innerHTML = `
        <div class="user-avatar" style="background-color: ${user.avatar_color};">${initial}</div>
        <span class="user-name">${user.name}</span>
        <button class="delete-user-btn" title="Delete profile">&times;</button>
    `;

    // Delete button - add listener first
    const deleteBtn = card.querySelector('.delete-user-btn');
    deleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showDeleteModal(user);
    });

    // Click to switch user - check if click is on delete button or its children
    card.addEventListener('click', function(e) {
        if (!e.target.closest('.delete-user-btn')) {
            switchUser(user.id);
        }
    });

    return card;
}

async function switchUser(userId) {
    try {
        const response = await fetch('/api/users/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        const data = await response.json();

        if (data.success) {
            // Redirect to home page
            window.location.href = '/';
        } else {
            alert('Failed to switch user: ' + data.error);
        }
    } catch (error) {
        console.error('Error switching user:', error);
        alert('Error switching user');
    }
}

function showAddUserModal() {
    document.getElementById('new-user-name').value = '';
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.color-btn[data-color="#2980b9"]').classList.add('selected');
    selectedColor = '#2980b9';
    showModal('add-user-modal');
    document.getElementById('new-user-name').focus();
}

async function createUser() {
    const name = document.getElementById('new-user-name').value.trim();

    if (!name) {
        alert('Please enter a name');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                avatar_color: selectedColor
            })
        });

        const data = await response.json();

        if (data.success) {
            hideModal('add-user-modal');
            loadUsers();
        } else {
            alert(data.error || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Error creating user');
    }
}

function showDeleteModal(user) {
    userToDelete = user.id;
    document.getElementById('delete-user-name').textContent = user.name;
    showModal('delete-modal');
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            hideModal('delete-modal');
            userToDelete = null;
            loadUsers();
        } else {
            alert(data.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
    }
}

function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}
