// Wedding Website JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Get page elements
    const landingPage = document.getElementById('landing-page');
    const mainWebsite = document.getElementById('main-website');
    const emailForm = document.getElementById('email-form');
    const skipBtn = document.getElementById('skip-btn');
    
    // Check if user has already submitted the form
    checkReturningVisitor();
    
    // Skip button handler
    skipBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Mark as skipped in localStorage (optional, for analytics or future reference)
        localStorage.setItem('formSkipped', 'true');
        
        // Transition to main site without saving guest info
        transitionToMainSite();
    });
    
    // Function to check for returning visitors
    function checkReturningVisitor() {
        const guestInfo = localStorage.getItem('guestInfo');
        if (guestInfo) {
            const guest = JSON.parse(guestInfo);
            // Automatically show main website for returning visitors
            showMainWebsiteForReturningVisitor(guest);
        }
    }
    
    // Function to show main website for returning visitors
    function showMainWebsiteForReturningVisitor(guest) {
        // Skip the landing page and go directly to main site
        landingPage.classList.remove('active');
        mainWebsite.classList.add('active');
        
        // Add a subtle welcome message in the hero banner
        const heroBanner = document.querySelector('.hero-banner .banner-content');
        if (heroBanner && guest.fullName) {
            const welcomeMessage = document.createElement('p');
            welcomeMessage.className = 'welcome-back-message';
            welcomeMessage.innerHTML = `Welcome back, ${guest.fullName}! 💕`;
            welcomeMessage.style.cssText = `
                font-size: 1.1rem;
                color: var(--primary-color);
                margin-top: 15px;
                opacity: 0;
                animation: fadeIn 1s ease-in-out 0.5s forwards;
            `;
            heroBanner.appendChild(welcomeMessage);
        }
        
        // Add CSS animation for the welcome message
        if (!document.querySelector('#welcome-back-styles')) {
            const style = document.createElement('style');
            style.id = 'welcome-back-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Form submission handler
    emailForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            fullName: document.getElementById('full-name').value,
            email: document.getElementById('email').value
        };
        
        // Validate form
        if (!formData.fullName || !formData.email) {
            alert('Please fill in all fields.');
            return;
        }
        
        // Show loading state
        const submitBtn = e.target.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="btn-text">Submitting...</span>';
        submitBtn.disabled = true;
        
        // Here you can integrate with Google Forms
        // Replace 'YOUR_GOOGLE_FORM_URL' with your actual Google Form URL
        // You can get this by creating a Google Form and getting the pre-filled link
        
        // Google Forms integration - uncomment and configure when ready
        
        const googleFormURL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSdCya5SWA7UBbFSTsZsvaeKzUsjpvvJN7KPV4Sb03pf2F9o1g/formResponse';
        const formBody = new FormData();
        formBody.append('entry.669220233', formData.fullName);
        formBody.append('entry.1534190314', formData.email);
        
        fetch(googleFormURL, {
            method: 'POST',
            mode: 'no-cors',
            body: formBody
        }).then(() => {
            console.log('Form submitted to Google Forms');
            localStorage.setItem('guestInfo', JSON.stringify(formData));
            transitionToMainSite();
        }).catch(() => {
            console.log('Form submission completed');
            localStorage.setItem('guestInfo', JSON.stringify(formData));
            transitionToMainSite();
        });
        
        
        // // For now, we'll simulate form submission and then transition to main site
        // setTimeout(() => {
        //     console.log('Form submitted:', formData);
            
        //     // Store data (you might want to send this to your backend)
        //     localStorage.setItem('guestInfo', JSON.stringify(formData));
            
        //     // Transition to main website
        //     transitionToMainSite();
        // }, 1000);
    });
    
    // Function to transition to main website
    function transitionToMainSite() {
        landingPage.classList.add('page-transition');
        
        setTimeout(() => {
            landingPage.classList.remove('active');
            mainWebsite.classList.add('active');
            
            // Smooth scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Add fade-in animation
            setTimeout(() => {
                mainWebsite.classList.add('page-transition', 'fade-in');
            }, 100);
        }, 300);
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add active class to navigation items based on scroll position
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-menu a');
        
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
    
    // Handle image loading errors (replace with placeholder)
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function() {
            this.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f5e6d3'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='16' fill='%238b7355'%3EPhoto Placeholder%3C/text%3E%3C/svg%3E`;
        });
    });
    
    // Add animation to elements when they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px 300px 0px' // Changed from -50px to 100px to trigger much earlier
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe sections for animations
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
});

// Form Integration Functions
// You can use these functions to integrate with various form services

// Google Forms Integration
function submitToGoogleForm(formData) {
    // Replace with your Google Form URL and field IDs
    const formUrl = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';
    const formDataToSend = new FormData();
    
    // Map your form fields to Google Form field IDs
    formDataToSend.append('entry.YOUR_NAME_FIELD_ID', formData.fullName);
    formDataToSend.append('entry.YOUR_EMAIL_FIELD_ID', formData.email);
    
    fetch(formUrl, {
        method: 'POST',
        body: formDataToSend,
        mode: 'no-cors' // Required for Google Forms
    }).then(() => {
        console.log('Form submitted to Google Forms');
    }).catch(error => {
        console.error('Error submitting to Google Forms:', error);
    });
}

// Netlify Forms Integration (if hosting on Netlify)
function submitToNetlify(formData) {
    fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            'form-name': 'wedding-contact',
            'full-name': formData.fullName,
            'email': formData.email
        })
    }).then(() => {
        console.log('Form submitted to Netlify');
    }).catch(error => {
        console.error('Error submitting to Netlify:', error);
    });
}

// Formspree Integration
function submitToFormspree(formData) {
    // Replace with your Formspree endpoint
    fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    }).then(() => {
        console.log('Form submitted to Formspree');
    }).catch(error => {
        console.error('Error submitting to Formspree:', error);
    });
}

// Function to show landing page again (for updating contact info)
function showLandingPageForUpdate() {
    mainWebsite.classList.remove('active');
    landingPage.classList.add('active');
    
    // Pre-fill the form with existing data
    const guestInfo = localStorage.getItem('guestInfo');
    if (guestInfo) {
        const guest = JSON.parse(guestInfo);
        document.getElementById('full-name').value = guest.fullName || '';
        document.getElementById('email').value = guest.email || '';
    }
    
    // Update the form intro text for returning visitors
    const formIntro = document.querySelector('.form-intro h2');
    const formDesc = document.querySelector('.form-intro p');
    if (formIntro) formIntro.textContent = "Update Your Contact Information";
    if (formDesc) formDesc.textContent = "Make any changes to your contact details below.";
    
    // Update button text
    const btnText = document.querySelector('.btn-text');
    if (btnText) btnText.textContent = "Update & Continue";
}

// Add update contact info functionality to the navigation
function addUpdateContactLink() {
    const guestInfo = localStorage.getItem('guestInfo');
    if (guestInfo) {
        // Add a small "Update Contact Info" link to the contact section
        const contactSection = document.querySelector('#contact .contact-info');
        if (contactSection) {
            const updateLink = document.createElement('p');
            updateLink.innerHTML = '<a href="#" id="update-contact-link" style="color: var(--secondary-color); text-decoration: underline; font-size: 0.9rem;">Update your contact information</a>';
            contactSection.appendChild(updateLink);
            
            // Add click handler
            document.getElementById('update-contact-link').addEventListener('click', function(e) {
                e.preventDefault();
                showLandingPageForUpdate();
            });
        }
    }
}

// Call this function after checking for returning visitors
setTimeout(() => {
    addUpdateContactLink();
}, 1000);
