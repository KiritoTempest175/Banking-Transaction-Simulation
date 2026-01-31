document.addEventListener('DOMContentLoaded', function() {
    
    // --- Filter Logic ---
    const filterButtons = document.querySelectorAll('.filter-button');
    const transactionList = document.querySelector('.transaction-list');
    
    if(filterButtons.length > 0 && transactionList) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                const selectedFilter = this.textContent.trim().toLowerCase();
                const items = transactionList.querySelectorAll('.transaction-item');

                items.forEach(item => {
                    const itemType = item.dataset.type || ''; 
                    
                    if (selectedFilter === 'all transactions') {
                        item.style.display = 'flex';
                    } else if (itemType.includes(selectedFilter)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }

    // --- Sorting Logic ---
    const sortBtn = document.getElementById('sortBtn');
    const sortDropdown = document.getElementById('sortDropdown');
    const sortOptions = document.querySelectorAll('.sort-option');

    if(sortBtn && sortDropdown) {
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sortDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!sortBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
                sortDropdown.classList.remove('show');
            }
        });

        sortOptions.forEach(option => {
            option.addEventListener('click', function() {
                sortOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                sortDropdown.classList.remove('show'); 

                const criteria = this.dataset.sort;
                sortTransactions(criteria);
            });
        });
    }

    function sortTransactions(criteria) {
        if (!transactionList) return;
        const items = Array.from(transactionList.querySelectorAll('.transaction-item'));

        items.sort((a, b) => {
            const dateAStr = a.dataset.date.replace(/-/g, '/'); 
            const dateBStr = b.dataset.date.replace(/-/g, '/');
            const dateA = new Date(dateAStr);
            const dateB = new Date(dateBStr);

            const amtA = parseFloat(a.dataset.amount);
            const amtB = parseFloat(b.dataset.amount);

            switch(criteria) {
                case 'newest': return dateB - dateA;
                case 'oldest': return dateA - dateB;
                case 'highest': return amtB - amtA;
                case 'lowest': return amtA - amtB;
                default: return 0;
            }
        });

        transactionList.innerHTML = '';
        items.forEach(item => transactionList.appendChild(item));
    }
});