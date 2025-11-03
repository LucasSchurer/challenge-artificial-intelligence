// Utilitários gerais
class Utils {
    static async fetchAPI(url, options = {}) {
        try {
            const defaultOptions = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const mergedOptions = {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...options.headers
                }
            };
            
            console.log('Fetch options:', mergedOptions); // Debug
            
            const response = await fetch(url, mergedOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    static showNotification(message, type = 'info') {
        // Criar sistema de notificações simples
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Estilos inline para a notificação
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        // Cores baseadas no tipo
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remover após 5 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Navegação suave
class Navigation {
    constructor() {
        this.init();
    }
    
    init() {
        // Scroll suave para âncoras
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
}

// Animações de entrada
class Animations {
    constructor() {
        this.init();
    }
    
    init() {
        this.observeElements();
    }
    
    observeElements() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        // Observar elementos que devem ser animados
        document.querySelectorAll('.feature-card, .hero-content, .cta-content').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }
}

// CSS para animações (adicionado dinamicamente)
const animationStyles = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;

// Adicionar estilos de animação
const styleSheet = document.createElement('style');
styleSheet.textContent = animationStyles;
document.head.appendChild(styleSheet);

// Navigation Auth Manager
class NavigationAuth {
    constructor() {
        this.init();
    }
    
    init() {
        this.updateNavigation();
        this.highlightActiveLink();
    }
    
    updateNavigation() {
        const navGuest = document.getElementById('navGuest');
        const navUser = document.getElementById('navUser');
        
        if (!navGuest || !navUser) return;
        
        const isAuthenticated = this.isAuthenticated();
        
        if (isAuthenticated) {
            navGuest.style.display = 'none';
            navUser.style.display = 'flex';
        } else {
            navGuest.style.display = 'flex';
            navUser.style.display = 'none';
        }
    }
    
    highlightActiveLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPath = link.getAttribute('href');
            
            if (linkPath === currentPath || 
                (currentPath === '/ui' && linkPath === '/ui/') ||
                (currentPath === '/ui/' && linkPath === '/ui/')) {
                link.classList.add('active');
            }
        });
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

// Global logout function
function logout() {
    if (window.authManager) {
        window.authManager.logout();
    } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        Utils.showNotification('Logout realizado com sucesso!', 'success');
        setTimeout(() => {
            window.location.href = '/ui/';
        }, 1000);
    }
}

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new Navigation();
    new Animations();
    new NavigationAuth();
    
    // Adicionar classe para indicar que JS está carregado
    document.body.classList.add('js-loaded');
});

// Exportar utilitários para uso global
window.Utils = Utils;

// Profile dropdown functionality
function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    const button = document.querySelector('.profile-button');
    
    menu.classList.toggle('show');
    button.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.querySelector('.profile-dropdown');
    const menu = document.getElementById('profileMenu');
    const button = document.querySelector('.profile-button');
    
    if (dropdown && !dropdown.contains(event.target)) {
        menu.classList.remove('show');
        button.classList.remove('active');
    }
});