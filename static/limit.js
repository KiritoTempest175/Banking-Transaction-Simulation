// Formatting function for currency
const formatCurrency = (num) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-US').format(num);
};

// Configuration for limits
const limits = [
    { rangeId: 'range-online', displayId: 'val-online', usageId: 'display-online' },
    { rangeId: 'range-atm', displayId: 'val-atm', usageId: 'display-atm' },
    { rangeId: 'range-intl', displayId: 'val-intl', usageId: 'display-intl' },
    { rangeId: 'range-pos', displayId: 'val-pos', usageId: 'display-pos' }
];

// Attach listeners for range sliders
limits.forEach(limit => {
    const rangeInput = document.getElementById(limit.rangeId);
    const valueDisplay = document.getElementById(limit.displayId);
    const usageDisplay = document.getElementById(limit.usageId);

    if (rangeInput && valueDisplay && usageDisplay) {
        // Initialize displays with formatted values
        valueDisplay.textContent = formatCurrency(rangeInput.value);
        usageDisplay.textContent = formatCurrency(rangeInput.value);

        rangeInput.addEventListener('input', function() {
            const formattedVal = formatCurrency(this.value);
            valueDisplay.textContent = formattedVal;
            usageDisplay.textContent = formattedVal; 
        });
    }
});

// Sidebar Navigation
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
        // Handle navigation via onclick in HTML, this is just visual if needed
    });
});

// --- SAVE BUTTON LOGIC (UPDATED) ---
document.querySelector('.save-btn').addEventListener('click', function() {
    const btn = this;
    const originalText = btn.textContent;
    
    btn.textContent = "Saving...";
    btn.disabled = true;

    // 1. Gather Data
    const payload = {
        online: document.getElementById('range-online').value,
        atm: document.getElementById('range-atm').value,
        intl: document.getElementById('range-intl').value,
        pos: document.getElementById('range-pos').value
    };

    // 2. Send to Python
    fetch('/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            btn.textContent = "Updated";
            btn.style.background = "linear-gradient(135deg, #4ade80, #22c55e)"; // Green for success
            btn.style.boxShadow = "0 0 25px rgba(74, 222, 128, 0.6)";
        } else {
            btn.textContent = "Error";
            btn.style.background = "#ef4444";
        }

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = ""; 
            btn.style.boxShadow = "";
            btn.disabled = false;
        }, 2000);
    })
    .catch(err => {
        console.error(err);
        btn.textContent = "Failed";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    });
});