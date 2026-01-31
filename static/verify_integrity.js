// --- DATA IS LOADED FROM THE HTML TEMPLATE ---
// The 'transactions' array is injected via the <script> block in the HTML file.

let currentTxIndex = null;

function openVerification(index) {
    currentTxIndex = index;
    // Access the global variable 'transactions' defined in the HTML
    if (typeof transactions === 'undefined' || !transactions || !transactions[index]) return;
    
    const tx = transactions[index];
    
    // Populate modal with transaction data
    const idEl = document.getElementById('modalTxnId');
    const dataEl = document.getElementById('modalData');
    const hashEl = document.getElementById('modalReceivedHash');

    if (idEl) idEl.textContent = tx.id;
    if (dataEl) dataEl.textContent = tx.data;
    if (hashEl) hashEl.textContent = tx.receivedHash;
    
    // Reset button state
    const btn = document.getElementById('verifyBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('btnLoader');
    
    if (btnText) btnText.style.display = 'block';
    if (loader) loader.style.display = 'none';
    if (btn) btn.disabled = false;

    // Show the primary verification modal
    const modal = document.getElementById('verifyModal');
    if (modal) modal.classList.add('active');
}

function processVerification() {
    if (currentTxIndex === null) return;

    const btn = document.getElementById('verifyBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('btnLoader');

    // Show loading state
    if (btnText) btnText.style.display = 'none';
    if (loader) loader.style.display = 'block';
    if (btn) btn.disabled = true;

    // Simulate hashing process delay (for UX visualization)
    setTimeout(() => {
        const tx = transactions[currentTxIndex];
        // Close verification modal
        const verifyModal = document.getElementById('verifyModal');
        if (verifyModal) verifyModal.classList.remove('active');

        // Check if the received hash matches the locally calculated hash
        if (tx.receivedHash === tx.actualDataHash) {
            const successDisplay = document.getElementById('successHashDisplay');
            if (successDisplay) successDisplay.textContent = tx.actualDataHash;
            
            const successModal = document.getElementById('successModal');
            if (successModal) successModal.classList.add('active');
        } else {
            const failDisplay = document.getElementById('failHashDisplay');
            if (failDisplay) failDisplay.textContent = tx.actualDataHash;
            
            const failModal = document.getElementById('failModal');
            if (failModal) failModal.classList.add('active');
        }

    }, 1500);
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.classList.remove('active');
    });
}

// Close modals when clicking outside the content area
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeAllModals();
    }
}