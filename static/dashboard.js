let balanceVisible = false;
const actualBalance = '$25,430.50';
const balanceValue = document.getElementById('balanceValue');
const eyeButton = document.getElementById('eyeButton');

// Function to update the eye icon SVG (re-used to make the main listener cleaner)
function updateEyeIcon() {
    // Hidden (Lock/Closed Eye icon)
    const hiddenIcon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
    `;
    // Visible (Lock/Open Eye icon)
    const visibleIcon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <circle cx="12" cy="16" r="1"/>
        </svg>
    `;

    return balanceVisible ? visibleIcon : hiddenIcon;
}

eyeButton.addEventListener('click', function() {
    balanceVisible = !balanceVisible;
    
    if (balanceVisible) {
        balanceValue.textContent = actualBalance;
        balanceValue.classList.remove('hidden');
    } else {
        balanceValue.textContent = '••••••';
        balanceValue.classList.add('hidden');
    }

    eyeButton.innerHTML = updateEyeIcon();
});


// Add click handlers for action cards
document.querySelectorAll('.action-card').forEach(card => {
    card.addEventListener('click', function() {
        const title = this.querySelector('.action-title').textContent;
        console.log('Clicked action:', title);
        // Add your navigation or action logic here (e.g., redirect to 'send-money.html')
    });
});

// Sidebar click handler - Manages Active State
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all items
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        
        // Add active class to clicked item (unless it's the sign out button)
        if (!this.classList.contains('signout')) {
            this.classList.add('active');
            console.log('Navigating to:', this.textContent.trim());
        } else {
            console.log('Signing out...');
            // Add sign out logic here
        }
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const balanceValue = document.getElementById('balanceValue');
    const eyeButton = document.getElementById('eyeButton');
    
    // Get the real balance from the HTML data attribute
    const rawBalance = balanceValue.getAttribute('data-balance');
    let isHidden = true; // FIX: Reset to start in the hidden state

    // Helper function to format the number (e.g., 500000 -> $500,000.00)
    function formatBalance(amount) {
        const num = Number(amount);
        return num.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // --- INITIALIZATION FIX: Hide balance on load ---
    function initializeBalanceDisplay() {
        if (rawBalance) {
            // Set the initial view to the mask
            balanceValue.textContent = '••••••'; 
            
            // Ensure the icon reflects the "closed/locked" state initially
            eyeButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>`;
            
            isHidden = true; // Confirm hidden state
        }
    }
    
    // --- TOGGLE LOGIC ---
    eyeButton.addEventListener('click', function() {
        if (isHidden) { // Currently hidden, so show it
            // SHOW BALANCE
            balanceValue.textContent = formatBalance(rawBalance); 
            
            // Change Icon to "Eye Open"
            eyeButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>`;
            
            isHidden = false;
        } else { // Currently shown, so hide it
            // HIDE BALANCE
            balanceValue.textContent = '••••••';
            
            // Change Icon back to "Lock/Closed"
            eyeButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>`;
            
            isHidden = true;
        }
    });

    // Run the function to ensure the balance is masked immediately
    initializeBalanceDisplay();
});