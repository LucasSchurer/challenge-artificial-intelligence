// Home page authentication management
class HomeAuth {
    constructor() {
        this.init();
    }
    
    init() {
        this.updateHomeContent();
    }
    
    updateHomeContent() {
        const isAuthenticated = this.isAuthenticated();
        
        // Update hero section
        this.updateHeroSection(isAuthenticated);
        
        // Update CTA section
        this.updateCTASection(isAuthenticated);
    }
    
    updateHeroSection(isAuthenticated) {
        const heroGuest = document.getElementById('heroGuest');
        const heroUser = document.getElementById('heroUser');
        
        if (heroGuest && heroUser) {
            if (isAuthenticated) {
                heroGuest.style.display = 'none';
                heroUser.style.display = 'flex';
            } else {
                heroGuest.style.display = 'flex';
                heroUser.style.display = 'none';
            }
        }
    }
    
    updateCTASection(isAuthenticated) {
        const ctaGuest = document.querySelector('.cta-guest');
        const ctaUser = document.querySelector('.cta-user');
        
        if (ctaGuest && ctaUser) {
            if (isAuthenticated) {
                ctaGuest.style.display = 'none';
                ctaUser.style.display = 'inline-block';
            } else {
                ctaGuest.style.display = 'inline-block';
                ctaUser.style.display = 'none';
            }
        }
    }
    
    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Date.now() / 1000;
            return payload.exp > now;
        } catch (error) {
            return false;
        }
    }
}

// Initialize home auth when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Only run on home page
    if (window.location.pathname === '/ui/' || window.location.pathname === '/ui') {
        new HomeAuth();
    }
});