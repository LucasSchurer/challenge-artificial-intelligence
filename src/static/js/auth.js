// Authentication functionality
class AuthManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }
    
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            this.setupPasswordValidation();
        }
        
        // Real-time validation
        this.setupRealTimeValidation();
    }
    
    setupPasswordValidation() {
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                this.validatePasswordStrength(passwordInput.value);
                if (confirmPasswordInput.value) {
                    this.validatePasswordMatch();
                }
            });
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.validatePasswordMatch();
            });
        }
    }
    
    setupRealTimeValidation() {
        // Username validation
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.addEventListener('blur', () => {
                this.validateUsername(usernameInput.value);
            });
        }
        
        // Name validation
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.addEventListener('blur', () => {
                this.validateName(nameInput.value);
            });
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };
        
        // Validate form
        if (!this.validateLoginForm(loginData)) {
            return;
        }
        
        this.setLoadingState('loginBtn', true);
        
        try {
            console.log('Sending login request:', loginData); // Debug
            const response = await Utils.fetchAPI('/user/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });
            
            // Store token
            this.storeAuthToken(response.token, response.id);
            
            Utils.showNotification('Login realizado com sucesso!', 'success');
            
            // Login sempre vai para painel
            setTimeout(() => {
                window.location.href = '/ui/painel';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.message.includes('401')) {
                this.showFieldError('password', 'Usuário ou senha incorretos');
            } else {
                Utils.showNotification('Erro ao fazer login. Tente novamente.', 'error');
            }
        } finally {
            this.setLoadingState('loginBtn', false);
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const registerData = {
            name: formData.get('name'),
            username: formData.get('username'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };
        
        // Validate form
        if (!this.validateRegisterForm(registerData)) {
            return;
        }
        
        this.setLoadingState('registerBtn', true);
        
        try {
            const response = await Utils.fetchAPI('/user', {
                method: 'POST',
                body: JSON.stringify({
                    name: registerData.name,
                    username: registerData.username,
                    password: registerData.password
                })
            });
            
            Utils.showNotification('Conta criada com sucesso!', 'success');
            
            // Auto login after registration
            setTimeout(async () => {
                try {
                    const loginResponse = await Utils.fetchAPI('/user/login', {
                        method: 'POST',
                        body: JSON.stringify({
                            username: registerData.username,
                            password: registerData.password
                        })
                    });
                    
                    this.storeAuthToken(loginResponse.token, loginResponse.id);
                    
                    // Registro sempre vai para avaliação
                    window.location.href = '/ui/avaliacao';
                } catch (error) {
                    window.location.href = '/ui/login';
                }
            }, 1000);
            
        } catch (error) {
            console.error('Register error:', error);
            
            if (error.message.includes('400') && error.message.includes('Username')) {
                this.showFieldError('username', 'Este nome de usuário já existe');
            } else {
                Utils.showNotification('Erro ao criar conta. Tente novamente.', 'error');
            }
        } finally {
            this.setLoadingState('registerBtn', false);
        }
    }
    
    validateLoginForm(data) {
        let isValid = true;
        
        // Clear previous errors
        this.clearFieldErrors();
        
        if (!data.username.trim()) {
            this.showFieldError('username', 'Usuário é obrigatório');
            isValid = false;
        }
        
        if (!data.password.trim()) {
            this.showFieldError('password', 'Senha é obrigatória');
            isValid = false;
        }
        
        return isValid;
    }
    
    validateRegisterForm(data) {
        let isValid = true;
        
        // Clear previous errors
        this.clearFieldErrors();
        
        // Name validation
        if (!this.validateName(data.name)) {
            isValid = false;
        }
        
        // Username validation
        if (!this.validateUsername(data.username)) {
            isValid = false;
        }
        
        // Password validation
        if (!this.validatePassword(data.password)) {
            isValid = false;
        }
        
        // Confirm password validation
        if (data.password !== data.confirmPassword) {
            this.showFieldError('confirmPassword', 'As senhas não coincidem');
            isValid = false;
        }
        
        return isValid;
    }
    
    validateName(name) {
        if (!name || name.trim().length < 2) {
            this.showFieldError('name', 'Nome deve ter pelo menos 2 caracteres');
            return false;
        }
        
        this.clearFieldError('name');
        return true;
    }
    
    validateUsername(username) {
        if (!username || username.trim().length < 3) {
            this.showFieldError('username', 'Usuário deve ter pelo menos 3 caracteres');
            return false;
        }
        
        if (/\s/.test(username)) {
            this.showFieldError('username', 'Usuário não pode conter espaços');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showFieldError('username', 'Usuário pode conter apenas letras, números e _');
            return false;
        }
        
        this.clearFieldError('username');
        return true;
    }
    
    validatePassword(password) {
        if (!password || password.length < 6) {
            this.showFieldError('password', 'Senha deve ter pelo menos 6 caracteres');
            return false;
        }
        
        this.clearFieldError('password');
        return true;
    }
    
    validatePasswordStrength(password) {
        const strengthIndicator = document.getElementById('passwordStrength');
        if (!strengthIndicator) return;
        
        const strengthFill = strengthIndicator.querySelector('.strength-fill');
        const strengthText = strengthIndicator.querySelector('.strength-text');
        
        let strength = 0;
        let text = 'Muito fraca';
        
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        // Remove all strength classes
        strengthFill.className = 'strength-fill';
        
        switch (strength) {
            case 0:
            case 1:
                strengthFill.classList.add('weak');
                text = 'Fraca';
                break;
            case 2:
                strengthFill.classList.add('fair');
                text = 'Regular';
                break;
            case 3:
            case 4:
                strengthFill.classList.add('good');
                text = 'Boa';
                break;
            case 5:
                strengthFill.classList.add('strong');
                text = 'Forte';
                break;
        }
        
        strengthText.textContent = text;
    }
    
    validatePasswordMatch() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.showFieldError('confirmPassword', 'As senhas não coincidem');
            return false;
        }
        
        this.clearFieldError('confirmPassword');
        return true;
    }
    
    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const formGroup = document.getElementById(fieldName)?.closest('.form-group');
        
        if (errorElement) {
            errorElement.textContent = message;
        }
        
        if (formGroup) {
            formGroup.classList.remove('success');
            formGroup.classList.add('error');
        }
    }
    
    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const formGroup = document.getElementById(fieldName)?.closest('.form-group');
        
        if (errorElement) {
            errorElement.textContent = '';
        }
        
        if (formGroup) {
            formGroup.classList.remove('error');
            formGroup.classList.add('success');
        }
    }
    
    clearFieldErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
        });
        
        document.querySelectorAll('.form-group').forEach(el => {
            el.classList.remove('error', 'success');
        });
    }
    
    setLoadingState(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const btnText = button.querySelector('.btn-text');
        const btnLoading = button.querySelector('.btn-loading');
        
        if (isLoading) {
            button.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            button.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    }
    
    storeAuthToken(token, userId) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('userId', userId);
        
        // Set token for future API calls
        this.setAuthHeader(token);
    }
    
    getAuthToken() {
        return localStorage.getItem('authToken');
    }
    
    getUserId() {
        return localStorage.getItem('userId');
    }
    
    setAuthHeader(token) {
        // This will be used by Utils.fetchAPI
        window.authToken = token;
    }
    
    clearAuth() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        window.authToken = null;
    }
    
    isAuthenticated() {
        const token = this.getAuthToken();
        if (!token) return false;
        
        try {
            // Basic JWT validation (check if not expired)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Date.now() / 1000;
            
            if (payload.exp < now) {
                this.clearAuth();
                return false;
            }
            
            this.setAuthHeader(token);
            return true;
        } catch (error) {
            this.clearAuth();
            return false;
        }
    }
    
    checkAuthStatus() {
        const currentPath = window.location.pathname;
        const isAuthPage = ['/ui/login', '/ui/registro'].includes(currentPath);
        const isAuthenticated = this.isAuthenticated();
        
        if (isAuthenticated && isAuthPage) {
            // Redirect authenticated users away from auth pages
            window.location.href = '/ui/painel';
        } else if (!isAuthenticated && !isAuthPage && currentPath !== '/ui/' && currentPath !== '/ui') {
            // Redirect unauthenticated users to login (except home page)
            window.location.href = '/ui/login';
        }
    }
    
    logout() {
        this.clearAuth();
        Utils.showNotification('Logout realizado com sucesso!', 'success');
        setTimeout(() => {
            window.location.href = '/ui/';
        }, 1000);
    }
}

// Global functions
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password');
    const icon = button.querySelector('.eye-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        // Ícone de olho fechado (eye-off)
        icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        input.type = 'password';
        // Ícone de olho aberto
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

// Update Utils.fetchAPI to include auth header
const originalFetchAPI = Utils.fetchAPI;
Utils.fetchAPI = async function(url, options = {}) {
    const token = localStorage.getItem('authToken') || window.authToken;
    
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    
    // Token is automatically added to headers
    
    return originalFetchAPI(url, options);
};

// Initialize auth manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});