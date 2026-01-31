const editButton = document.getElementById('editButton');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileAvatar = document.getElementById('profileAvatar');

let isEditMode = false;

// --- TOGGLE FUNCTION ---
if (editButton) {
    editButton.addEventListener('click', function() {
        if (!isEditMode) {
            isEditMode = true;
            enterEditMode();
        } else {
            saveChanges();
        }
    });
}

function enterEditMode() {
    editButton.textContent = 'Save Changes';
    editButton.classList.add('save');

    const detailValues = document.querySelectorAll('.detail-value');
    
    detailValues.forEach(span => {
        const field = span.dataset.field;
        
        // --- RESTRICTION LOGIC ---
        // We only allow editing of specific fields.
        // If the field is NOT in this list, we skip it.
        const allowedFields = ['username', 'phone', 'address', 'email'];
        
        if (!allowedFields.includes(field)) {
            // This skips: daily_limit, role, account_id, status
            return;
        }

        const input = document.createElement('input');
        input.type = field === 'email' ? 'email' : (field === 'phone' ? 'tel' : 'text');
        input.classList.add('detail-input');
        input.value = span.textContent.trim();
        input.dataset.field = field; 

        input.style.textAlign = span.style.textAlign || 'left';

        span.parentNode.replaceChild(input, span);
    });
}

function saveChanges() {
    const inputs = document.querySelectorAll('.detail-input');
    const payload = {};
    
    inputs.forEach(input => {
        const field = input.dataset.field;
        payload[field] = input.value;
    });

    editButton.textContent = 'Saving...';
    editButton.disabled = true;

    fetch('/update_personal_details', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            isEditMode = false;
            exitEditMode(inputs);
            alert('Details updated successfully!');
        } else {
            alert('Error saving data: ' + data.message);
            editButton.textContent = 'Save Changes';
            editButton.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while saving.');
        editButton.textContent = 'Save Changes';
        editButton.disabled = false;
    });
}

function exitEditMode(inputs) {
    editButton.textContent = 'Edit Profile';
    editButton.classList.remove('save');
    editButton.disabled = false;
    
    inputs.forEach(input => {
        const field = input.dataset.field;
        
        const newSpan = document.createElement('span');
        newSpan.classList.add('detail-value');
        newSpan.dataset.field = field;
        newSpan.textContent = input.value;
        newSpan.style.textAlign = input.style.textAlign;
        
        if (field === 'username') { 
            if(profileName) profileName.textContent = input.value;
            if(profileAvatar) profileAvatar.textContent = input.value.charAt(0);
        }
        if (field === 'email') {
            if(profileEmail) profileEmail.textContent = input.value;
        }

        input.parentNode.replaceChild(newSpan, input);
    });
}

// Sidebar Links Logic
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
        const href = this.getAttribute('href');
        if (href) {
            window.location.href = href;
        }
    });
});