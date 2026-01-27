// User profile management with PIN authentication

let selectedColor = '#2980b9';
let userToDelete = null;
let userToAuth = null;
let userToSetPin = null;
let newUserId = null; // Store the ID of the newly created user

document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    setupEventListeners();
    checkSpotifyConnectionResult();
});

// Check URL for Spotify connection result (from new user flow)
function checkSpotifyConnectionResult() {
    const params = new URLSearchParams(window.location.search);
    const spotifyResult = params.get('spotify');

    if (spotifyResult === 'already_connected') {
        const existingUser = params.get('existing_user') || 'another user';
        alert(`This Spotify account is already connected to "${existingUser}".\n\nTo connect a different Spotify account:\n1. On the Spotify authorization page, click "Not you?" to log out\n2. Then log in with the Spotify account you want to use`);
        window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'error') {
        alert('Failed to connect Spotify. You can connect later from Settings.');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function setupEventListeners() {
    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
        });
    });

    // Add user form - Step 1
    document.getElementById('add-user-form-step1').addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleStep1Submit();
    });

    // Cancel add user
    document.getElementById('cancel-add-user').addEventListener('click', function() {
        hideModal('add-user-modal');
        resetAddUserModal();
    });

    // Back to step 1
    document.getElementById('back-to-step1').addEventListener('click', function() {
        showStep(1);
    });

    // Connect Spotify button
    document.getElementById('connect-spotify-btn').addEventListener('click', function() {
        connectSpotifyForNewUser();
    });

    // Skip Spotify checkbox
    document.getElementById('skip-spotify-checkbox').addEventListener('change', function() {
        document.getElementById('finish-create-user').disabled = !this.checked;
    });

    // Finish button (skip Spotify)
    document.getElementById('finish-create-user').addEventListener('click', function() {
        // User already created in step 1, just redirect
        window.location.href = '/';
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

    // PIN Modal
    document.getElementById('cancel-pin').addEventListener('click', function() {
        hideModal('pin-modal');
        userToAuth = null;
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').classList.add('hidden');
    });

    document.getElementById('submit-pin').addEventListener('click', async function() {
        await submitPin();
    });

    document.getElementById('pin-input').addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            await submitPin();
        }
    });

    // Auto-submit when 4 digits entered
    document.getElementById('pin-input').addEventListener('input', async function() {
        if (this.value.length === 4) {
            await submitPin();
        }
    });

    // Set PIN Modal
    document.getElementById('cancel-set-pin').addEventListener('click', function() {
        hideModal('set-pin-modal');
        userToSetPin = null;
        document.getElementById('new-pin-input').value = '';
        document.getElementById('confirm-pin-input').value = '';
        document.getElementById('set-pin-error').classList.add('hidden');
    });

    document.getElementById('submit-set-pin').addEventListener('click', async function() {
        await submitSetPin();
    });

    document.getElementById('confirm-pin-input').addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            await submitSetPin();
        }
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this.id);
                userToDelete = null;
                userToAuth = null;
                userToSetPin = null;
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
        ${!user.has_pin ? '<span class="no-pin-badge">No PIN</span>' : ''}
        <button class="delete-user-btn" title="Delete profile">&times;</button>
    `;

    // Delete button - add listener first
    const deleteBtn = card.querySelector('.delete-user-btn');
    deleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showDeleteModal(user);
    });

    // Click to authenticate user
    card.addEventListener('click', function(e) {
        if (!e.target.closest('.delete-user-btn')) {
            if (user.has_pin) {
                showPinModal(user);
            } else {
                showSetPinModal(user);
            }
        }
    });

    return card;
}

// PIN Modal Functions
function showPinModal(user) {
    userToAuth = user;
    document.getElementById('pin-user-name').textContent = user.name;
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error').classList.add('hidden');
    showModal('pin-modal');
    setTimeout(() => document.getElementById('pin-input').focus(), 100);
}

async function submitPin() {
    const pin = document.getElementById('pin-input').value;

    if (pin.length !== 4) {
        return;
    }

    try {
        const response = await fetch('/api/users/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userToAuth.id,
                pin: pin
            })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            // Show error and shake
            document.getElementById('pin-error').classList.remove('hidden');
            document.getElementById('pin-input').value = '';
            document.querySelector('.pin-modal-content').classList.add('shake');
            setTimeout(() => {
                document.querySelector('.pin-modal-content').classList.remove('shake');
            }, 500);
            document.getElementById('pin-input').focus();
        }
    } catch (error) {
        console.error('Error authenticating:', error);
        alert('Error authenticating');
    }
}

// Set PIN Modal Functions (for existing users without PIN)
function showSetPinModal(user) {
    userToSetPin = user;
    document.getElementById('set-pin-user-name').textContent = user.name;
    document.getElementById('new-pin-input').value = '';
    document.getElementById('confirm-pin-input').value = '';
    document.getElementById('set-pin-error').classList.add('hidden');
    showModal('set-pin-modal');
    setTimeout(() => document.getElementById('new-pin-input').focus(), 100);
}

async function submitSetPin() {
    const pin = document.getElementById('new-pin-input').value;
    const confirmPin = document.getElementById('confirm-pin-input').value;

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        document.getElementById('set-pin-error').textContent = 'PIN must be 4 digits.';
        document.getElementById('set-pin-error').classList.remove('hidden');
        return;
    }

    if (pin !== confirmPin) {
        document.getElementById('set-pin-error').textContent = 'PINs do not match.';
        document.getElementById('set-pin-error').classList.remove('hidden');
        document.querySelector('#set-pin-modal .pin-modal-content').classList.add('shake');
        setTimeout(() => {
            document.querySelector('#set-pin-modal .pin-modal-content').classList.remove('shake');
        }, 500);
        return;
    }

    try {
        const response = await fetch(`/api/users/${userToSetPin.id}/set-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            document.getElementById('set-pin-error').textContent = data.error || 'Failed to set PIN';
            document.getElementById('set-pin-error').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error setting PIN:', error);
        alert('Error setting PIN');
    }
}

// Add User Modal Functions
function showAddUserModal() {
    document.getElementById('new-user-name').value = '';
    document.getElementById('create-pin-input').value = '';
    document.getElementById('create-pin-confirm').value = '';
    document.getElementById('create-pin-error').classList.add('hidden');
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.color-btn[data-color="#2980b9"]').classList.add('selected');
    selectedColor = '#2980b9';
    showStep(1);
    showModal('add-user-modal');
    document.getElementById('new-user-name').focus();
}

function showStep(stepNumber) {
    document.getElementById('add-user-step-1').classList.toggle('hidden', stepNumber !== 1);
    document.getElementById('add-user-step-2').classList.toggle('hidden', stepNumber !== 2);
}

async function handleStep1Submit() {
    const name = document.getElementById('new-user-name').value.trim();
    const pin = document.getElementById('create-pin-input').value;
    const confirmPin = document.getElementById('create-pin-confirm').value;

    if (!name) {
        alert('Please enter a name');
        return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        document.getElementById('create-pin-error').textContent = 'PIN must be 4 digits.';
        document.getElementById('create-pin-error').classList.remove('hidden');
        return;
    }

    if (pin !== confirmPin) {
        document.getElementById('create-pin-error').textContent = 'PINs do not match.';
        document.getElementById('create-pin-error').classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                avatar_color: selectedColor,
                pin: pin
            })
        });

        const data = await response.json();

        if (data.success) {
            newUserId = data.user_id;
            // Move to step 2 (Spotify connection)
            showStep(2);
            // Reset skip checkbox and finish button
            document.getElementById('skip-spotify-checkbox').checked = false;
            document.getElementById('finish-create-user').disabled = true;
        } else {
            alert(data.error || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Error creating user');
    }
}

function resetAddUserModal() {
    showStep(1);
    document.getElementById('new-user-name').value = '';
    document.getElementById('create-pin-input').value = '';
    document.getElementById('create-pin-confirm').value = '';
    document.getElementById('create-pin-error').classList.add('hidden');
    document.getElementById('skip-spotify-checkbox').checked = false;
    document.getElementById('finish-create-user').disabled = true;
    newUserId = null;
}

async function connectSpotifyForNewUser() {
    try {
        const response = await fetch('/api/spotify/login?return_page=/');
        const data = await response.json();

        if (data.success) {
            window.location.href = data.auth_url;
        } else {
            alert('Error initiating Spotify login: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
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
