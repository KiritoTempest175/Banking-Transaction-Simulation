document.getElementById('transcriptForm').addEventListener('submit', function(event) {
    event.preventDefault(); 
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const format = document.getElementById('format').value;
    const details = document.getElementById('details').value;
    const successMessage = document.getElementById('successMessage');

    // --- Simulation of Download Logic ---
    console.log(`Generating Transcript for ${startDate} to ${endDate} in ${format} format...`);
    
    // 1. Show Success Message
    successMessage.textContent = `✅ Transcript (${format.toUpperCase()}) for ${startDate} to ${endDate} generated successfully! Downloading...`;
    successMessage.classList.add('visible');
    
    // 2. Hide Message after a delay (simulating download completion)
    setTimeout(() => {
        successMessage.classList.remove('visible');
    }, 5000);

    // In a real application, AJAX request would be made here to Flask
    // fetch('/generate_transcript', { method: 'POST', body: new FormData(this) })
    // .then(response => response.blob())
    // .then(blob => { /* create download link */ });
});

// Sidebar navigation logic (placeholder - would link to other pages in a full app)
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.dataset.page;
        if (page === 'signout') {
            alert('Signing out...');
            // window.location.href = '/login';
        } else if (page === 'download') {
            // Do nothing, we are on this page
        }
        else {
            // Using Flask placeholder routes
            // window.location.href = `/${page}`;
            console.log(`Navigating to the ${page.charAt(0).toUpperCase() + page.slice(1)} page.`);
        }
    });
});

// Set default dates for better user experience (e.g., last 30 days)
window.onload = function() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    
    const formatDate = (date) => {
        let d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join('-');
    }

    document.getElementById('endDate').value = formatDate(today);
    document.getElementById('startDate').value = formatDate(lastMonth);
};