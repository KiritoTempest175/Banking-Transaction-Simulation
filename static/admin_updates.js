document.addEventListener('DOMContentLoaded', function() {
    
    // State Tracking
    let knownTxIds = new Set();
    let isFirstLoad = true;
    let previousQueueHash = ""; // To detect if data actually changed

    // 1. Create Notification Container (if missing)
    let notifContainer = document.querySelector('.notif-container');
    if (!notifContainer) {
        notifContainer = document.createElement('div');
        notifContainer.className = 'notif-container';
        document.body.appendChild(notifContainer);
    }

    // --- POLLING FUNCTION ---
    function fetchAdminQueue() {
        fetch('/api/admin/queue')
            .then(res => res.json())
            .then(queueData => {
                
                // A. Handle Notifications (Runs on ALL tabs)
                const currentIds = new Set(queueData.map(tx => tx.id));
                
                queueData.forEach(tx => {
                    if (!knownTxIds.has(tx.id)) {
                        if (!isFirstLoad) {
                            showAdminNotification(tx);
                        }
                        knownTxIds.add(tx.id);
                    }
                });

                // Cleanup processed IDs
                knownTxIds.forEach(id => {
                    if (!currentIds.has(id)) knownTxIds.delete(id);
                });

                // B. Handle Table Updates (Only runs if on Queue Tab)
                const queueBody = document.getElementById('queue-body');
                
                if (queueBody) {
                    // Simple way to check if data changed: Stringify comparison
                    const currentDataHash = JSON.stringify(queueData);
                    
                    if (currentDataHash !== previousQueueHash) {
                        console.log("Queue changed! Re-rendering table...");
                        renderQueueTable(queueData, queueBody);
                        previousQueueHash = currentDataHash;
                    }
                }

                isFirstLoad = false;
            })
            .catch(err => console.error("Admin Polling Error:", err));
    }

    // --- RENDER TABLE ---
    function renderQueueTable(data, tbody) {
        const emptyMsg = document.getElementById('empty-msg');
        const table = document.getElementById('queue-table');

        // 1. Handle Empty State
        if (data.length === 0) {
            if (emptyMsg) {
                emptyMsg.style.display = 'block';
                emptyMsg.classList.remove('hidden');
            }
            if (table) {
                table.style.display = 'none';
                table.classList.add('hidden');
            }
            tbody.innerHTML = '';
            return;
        }

        // 2. Handle Active State
        if (emptyMsg) {
            emptyMsg.style.display = 'none';
            emptyMsg.classList.add('hidden');
        }
        if (table) {
            table.style.display = 'table'; // Force show table
            table.classList.remove('hidden');
        }

        // 3. Build Rows
        tbody.innerHTML = data.map(tx => {
            const isFast = tx.mode === 'fast';
            const badgeClass = isFast ? 'mode-fast' : 'mode-standard';
            const badgeText = isFast ? 'FAST' : 'SECURE';
            // Inline styles for badges to ensure they look right immediately
            const badgeStyle = isFast 
                ? 'background: rgba(239, 68, 68, 0.2); color: #fca5a5;' 
                : 'background: rgba(52, 211, 153, 0.2); color: #6ee7b7;';
            
            const inputHtml = isFast 
                ? `<input type="number" step="0.01" name="amount" value="${tx.amount}" class="tamper-input">`
                : `<span style="color: #94a3b8;">🔒 $${tx.amount}</span><input type="hidden" name="amount" value="${tx.amount}">`;

            return `
                <tr>
                    <td><span class="mode-badge" style="${badgeStyle}">${badgeText}</span></td>
                    <td>${tx.sender_id}</td>
                    <td>${tx.receiver_id}</td>
                    <td>
                        <form action="/admin/process" method="POST" id="form-${tx.id}">
                            <input type="hidden" name="tx_id" value="${tx.id}">
                            <input type="hidden" name="action" value="approve">
                            ${inputHtml}
                        </form>
                    </td>
                    <td>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" onclick="document.getElementById('form-${tx.id}').submit()" class="btn-sm btn-approve">Approve</button>
                            <form action="/admin/process" method="POST" style="display:inline;">
                                <input type="hidden" name="tx_id" value="${tx.id}">
                                <input type="hidden" name="action" value="reject">
                                <button type="submit" class="btn-sm btn-reject">Reject</button>
                            </form>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- NOTIFICATION UI ---
    function showAdminNotification(tx) {
        const card = document.createElement('div');
        card.className = 'notif-card show'; // Uses notifications.css
        card.style.borderLeftColor = '#8b5cf6'; // Admin Purple

        const modeIcon = tx.mode === 'fast' ? '⚡' : '🔒';

        card.innerHTML = `
            <div class="notif-header">
                <span class="notif-title">🔔 New Request</span>
                <span class="notif-close">&times;</span>
            </div>
            <div class="notif-body">
                <span class="notif-amount" style="color:#c4b5fd">${modeIcon} $${tx.amount}</span>
                <div class="notif-row">
                    <span class="notif-label">From:</span>
                    <span class="notif-value">${tx.sender_id}</span>
                </div>
                 <div class="notif-row">
                    <span class="notif-label">To:</span>
                    <span class="notif-value">${tx.receiver_id}</span>
                </div>
            </div>
        `;

        notifContainer.appendChild(card);
        
        // Setup removal logic
        const remove = () => {
            card.classList.remove('show');
            setTimeout(() => card.remove(), 400);
        };

        const closeBtn = card.querySelector('.notif-close');
        if(closeBtn) closeBtn.onclick = remove;
        
        setTimeout(remove, 5000);
    }

    // Start Polling immediately
    fetchAdminQueue();
    setInterval(fetchAdminQueue, 2000);
});