const form = document.getElementById('transferForm');
const amountInput = document.getElementById('amount');
const accountInput = document.getElementById('accountNumber');

// Summary Elements
const summaryType = document.getElementById('summaryType');
const summarySecurity = document.getElementById('summarySecurity');
const summaryFee = document.getElementById('summaryFee');
const summaryTotalDebit = document.getElementById('summaryTotalDebit');
const summaryRecipientAcct = document.getElementById('summaryRecipientAcct');

// Radio Buttons (Targeting name="mode" now, not "type")
const radioInstant = document.getElementById('instant');
const radioStandard = document.getElementById('standard');

function updateSummary() {
    // 1. Update Account Display
    const acct = accountInput.value;
    if (acct.length >= 4) {
        summaryRecipientAcct.textContent = '...' + acct.slice(-4);
    } else {
        summaryRecipientAcct.textContent = 'N/A';
    }

    // 2. Update Amount & Fee
    const val = parseFloat(amountInput.value) || 0;
    
    // Check which radio is checked
    let isFast = radioInstant.checked; 
    
    let fee = 0;
    let securityText = "";
    
    if (isFast) {
        fee = 1.50;
        summaryType.textContent = 'Fast';
        summarySecurity.textContent = 'Non-Encrypted';
        summarySecurity.style.color = '#ff6b6b'; // Red
        
        // Move indicator if you have one
        const indicator = document.querySelector('.active-indicator');
        if(indicator) indicator.style.transform = 'translateX(0%)';
        
    } else {
        fee = 0.00;
        summaryType.textContent = 'Standard';
        summarySecurity.textContent = 'Encrypted (AES-256)';
        summarySecurity.style.color = '#4ade80'; // Green
        
        const indicator = document.querySelector('.active-indicator');
        if(indicator) indicator.style.transform = 'translateX(100%)';
    }

    summaryFee.textContent = '$' + fee.toFixed(2);
    
    // Total Debit
    const total = val + fee;
    summaryTotalDebit.textContent = '$' + total.toFixed(2);
    
    // Visual opacity for total
    const totalItem = document.querySelector('.summary-item.total-cost');
    if (totalItem) {
        if (val > 0) {
            totalItem.style.opacity = '1';
        } else {
            totalItem.style.opacity = '0.7';
        }
    }
}

// Event Listeners
amountInput.addEventListener('input', updateSummary);
accountInput.addEventListener('input', updateSummary);

// Listen to radio buttons
const radios = document.querySelectorAll('input[name="mode"]');
radios.forEach(radio => {
    radio.addEventListener('change', updateSummary);
});

// Run once on load
document.addEventListener('DOMContentLoaded', updateSummary);

// --- FORM SUBMISSION FIX ---
// We do NOT use preventDefault() here because we want the form 
// to actually send data to Python.
form.addEventListener('submit', function(event) {
    const amount = parseFloat(amountInput.value);
    const account = accountInput.value;

    if (amount <= 0 || !account) {
        event.preventDefault(); // Only stop if invalid
        alert("Please enter a valid amount and account number.");
    }
    // Otherwise, let the form submit naturally to /perform_transaction
});