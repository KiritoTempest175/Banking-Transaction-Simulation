document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Inject the Container into the page body
    const container = document.createElement('div');
    container.className = 'notif-container';
    document.body.appendChild(container);

    let lastTxId = sessionStorage.getItem('lastTxId'); // Remember across reloads

    function pollForUpdates() {
        fetch('/api/check_updates')
            .then(res => res.json())
            .then(data => {
                // Update Balance on Dashboard (if element exists)
                const balanceEl = document.getElementById('balanceValue');
                if (balanceEl && data.balance !== parseFloat(balanceEl.getAttribute('data-balance'))) {
                    balanceEl.setAttribute('data-balance', data.balance);
                    // Only update text if not hidden (checking class or text content)
                    if (!balanceEl.textContent.includes('•••')) {
                        balanceEl.textContent = formatCurrency(data.balance);
                    }
                }

                // Check for New Transaction
                if (data.has_new && data.tx) {
                    // Only show if it's a NEW ID we haven't alerted yet
                    if (data.tx.id !== lastTxId) {
                        createPopup(data.tx);
                        lastTxId = data.tx.id;
                        sessionStorage.setItem('lastTxId', lastTxId);
                    }
                }
            })
            .catch(e => console.log("Polling...", e));
    }

    function createPopup(tx) {
        const isReceived = tx.type === 'Received';
        const colorClass = isReceived ? 'received' : 'sent';
        const amountSign = isReceived ? '+' : '-';
        const amountClass = isReceived ? 'text-green' : 'text-red';
        const icon = isReceived ? '↓' : '↑';
        
        // Determine "Other Party" details
        const otherName = isReceived ? tx.sender_name : tx.receiver_name;
        const otherAcc = isReceived ? tx.sender_acc : tx.receiver_acc;
        const label = isReceived ? 'From' : 'To';

        const card = document.createElement('div');
        card.className = `notif-card ${colorClass}`;
        
        card.innerHTML = `
            <div class="notif-header">
                <span class="notif-title">
                    <span>${icon}</span> ${tx.type} Money
                </span>
                <span class="notif-close">&times;</span>
            </div>
            <div class="notif-body">
                <span class="notif-amount ${amountClass}">${amountSign}$${tx.amount}</span>
                
                <div class="notif-row">
                    <span class="notif-label">${label}:</span>
                    <span class="notif-value">${otherName}</span>
                </div>
                <div class="notif-row">
                    <span class="notif-label">Account:</span>
                    <span class="notif-value">${otherAcc}</span>
                </div>
                
                <div class="notif-footer">
                    <span>${tx.date}</span>
                    <span>${tx.time}</span>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Trigger Animation
        requestAnimationFrame(() => {
            card.classList.add('show');
        });
        
        // Close Logic
        const closeBtn = card.querySelector('.notif-close');
        closeBtn.onclick = () => removeCard(card);

        // Auto Dismiss
        setTimeout(() => removeCard(card), 6000);
    }

    function removeCard(card) {
        card.classList.remove('show');
        setTimeout(() => card.remove(), 400);
    }

    function formatCurrency(num) {
        return Number(num).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
        });
    }

    // Start Polling (2.5s)
    setInterval(pollForUpdates, 2500);
});