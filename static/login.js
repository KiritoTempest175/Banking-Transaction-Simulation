// 1. Get References to HTML Elements
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const popup = document.getElementById('popup');
const popupIcon = document.getElementById('popupIcon');
const popupMessage = document.getElementById('popupMessage');
const overlay = document.getElementById('overlay');
const loginForm = document.getElementById('loginForm');

// ROBOT VARIABLES
const robots = document.querySelectorAll('.robot');
const robot3 = document.getElementById('robot3'); 
const pupils = document.querySelectorAll('.pupil');
let isFocusingUsername = false;
let isPrivacyMode = false;
let peekTimeout;
let hideTimeout;

// 2. Input Validation & Restrictions
usernameInput.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
});

passwordInput.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
});

// 3. Handle Login Button Click
loginBtn.addEventListener('click', function(e) {
    e.preventDefault(); 
    
    // Reset any sad/happy animations before checking
    resetRobots();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // -- Client-Side Checks --
    if (username === '' || password === '') {
        showPopup('error', '⚠️', 'Please fill all fields!');
        // Robots get sad
        robots.forEach(r => r.classList.add('sad'));
        return;
    }

    if (username.length < 6) {
        showPopup('error', '⚠️', 'Account number must be at least 6 digits!');
        robots.forEach(r => r.classList.add('sad'));
        return;
    }

    if (password.length !== 4) {
        showPopup('error', '⚠️', 'PIN must be exactly 4 digits!');
        robots.forEach(r => r.classList.add('sad'));
        return;
    }

    // -- Success! --
    // Robots celebrate right before submission
    robots.forEach(r => r.classList.add('celebrate'));
    
    // Submit the form
    loginForm.submit(); 
});

// 4. Popup Logic
function showPopup(type, icon, message) {
    popup.className = 'popup ' + type;
    popupIcon.textContent = icon;
    popupMessage.innerHTML = message;
    
    overlay.classList.add('show');
    popup.classList.add('show');

    setTimeout(() => {
        overlay.classList.remove('show');
        popup.classList.remove('show');
        // Reset robots when popup closes
        setTimeout(() => resetRobots(), 500);
    }, 3000);
}

// 5. SERVER MESSAGE CHECKER (The "Bridge" Fix)
document.addEventListener('DOMContentLoaded', function() {
    const messageContainer = document.getElementById('server-message');
    if (messageContainer) {
        const messageText = messageContainer.getAttribute('data-message');
        if (messageText && messageText !== "") {
            showPopup('error', '⚠️', messageText);
            // If server returns error, robots are sad
            robots.forEach(r => r.classList.add('sad'));
        }
    }
});

// --- ROBOT ANIMATION LOGIC ---

// Helper: Move eyes to look at targetX, targetY
function moveEyes(targetX, targetY, specificRobot = null) {
    const targetPupils = specificRobot ? specificRobot.querySelectorAll('.pupil') : pupils;
    
    targetPupils.forEach(pupil => {
        const eye = pupil.parentElement;
        const eyeRect = eye.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;
        const angle = Math.atan2(targetY - eyeCenterY, targetX - eyeCenterX);
        const distance = Math.min(eyeRect.width / 6, Math.hypot(targetX - eyeCenterX, targetY - eyeCenterY));
        const pupilX = Math.cos(angle) * distance;
        const pupilY = Math.sin(angle) * distance;
        pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
    });
}

// Mouse Tracking
document.addEventListener('mousemove', (e) => {
    if (isPrivacyMode) return;
    if (isFocusingUsername) return; 
    moveEyes(e.clientX, e.clientY);
});

// Focus Account ID (Stare at input)
usernameInput.addEventListener('focus', () => { 
    isFocusingUsername = true; 
    resetRobots();
    const rect = usernameInput.getBoundingClientRect();
    moveEyes(rect.left + rect.width / 2, rect.top + rect.height / 2);
});

usernameInput.addEventListener('blur', () => { 
    isFocusingUsername = false; 
});

// Privacy Mode (PIN)
passwordInput.addEventListener('focus', () => { 
    enterPrivacyMode(); 
});

passwordInput.addEventListener('blur', () => { 
    exitPrivacyMode(); 
});

function enterPrivacyMode() {
    isPrivacyMode = true; 
    isFocusingUsername = false;
    robots.forEach(robot => robot.classList.add('hiding'));
    
    clearTimeout(peekTimeout); 
    clearTimeout(hideTimeout);
    
    peekTimeout = setTimeout(() => {
        if(isPrivacyMode) {
            robot3.classList.add('peeking');
            // Look at PIN
            const pinRect = passwordInput.getBoundingClientRect();
            moveEyes(pinRect.left + pinRect.width / 2, pinRect.top + pinRect.height / 2, robot3);

            hideTimeout = setTimeout(() => {
                robot3.classList.remove('peeking');
                robot3.querySelectorAll('.pupil').forEach(p => p.style.transform = `translate(0,0)`);
            }, 1500);
        }
    }, 800);
}

function exitPrivacyMode() {
    isPrivacyMode = false; 
    clearTimeout(peekTimeout); 
    clearTimeout(hideTimeout);
    robots.forEach(robot => { 
        robot.classList.remove('hiding', 'peeking'); 
    });
}

function resetRobots() {
    robots.forEach(robot => { 
        robot.classList.remove('sad', 'celebrate', 'hiding', 'peeking'); 
    });
    pupils.forEach(pupil => pupil.style.transform = 'translate(0,0)');
}