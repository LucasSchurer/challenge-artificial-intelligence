// Profile functionality
class ProfileManager {
    constructor() {
        this.preferences = {
            format: 'text',
            difficulty: 3,
            interests: ['Python', 'JavaScript', 'Estruturas de Dados', 'Algoritmos', 'Web Development', 'Machine Learning']
        };
        this.init();
    }
    
    init() {
        // Check authentication first
        if (!this.checkAuth()) {
            return;
        }
        
        this.setupEventListeners();
        this.loadPreferences();
        this.updateDifficultyDisplay();
    }
    
    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            Utils.showNotification('Você precisa fazer login para acessar o perfil', 'warning');
            setTimeout(() => {
                window.location.href = '/ui/login';
            }, 2000);
            return false;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Date.now() / 1000;
            
            if (payload.exp < now) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                Utils.showNotification('Sua sessão expirou. Faça login novamente.', 'warning');
                setTimeout(() => {
                    window.location.href = '/ui/login';
                }, 2000);
                return false;
            }
            
            // Set auth header for API calls
            window.authToken = token;
            return true;
        } catch (error) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            Utils.showNotification('Token inválido. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = '/ui/login';
            }, 2000);
            return false;
        }
    }
    
    setupEventListeners() {
        // Format preference change
        document.querySelectorAll('input[name="format"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.preferences.format = e.target.value;
                this.savePreferences();
                Utils.showNotification('Preferência de formato atualizada', 'success');
            });
        });
        
        // Difficulty slider change
        const difficultyRange = document.getElementById('difficultyRange');
        if (difficultyRange) {
            difficultyRange.addEventListener('input', (e) => {
                this.preferences.difficulty = parseInt(e.target.value);
                this.updateDifficultyDisplay();
            });
            
            difficultyRange.addEventListener('change', () => {
                this.savePreferences();
                Utils.showNotification('Nível de dificuldade atualizado', 'success');
            });
        }
        
        // Add interest button
        const addInterestBtn = document.querySelector('.add-interest-btn');
        if (addInterestBtn) {
            addInterestBtn.addEventListener('click', () => {
                this.showAddInterestDialog();
            });
        }
        
        // Interest tags click (for removal)
        this.setupInterestTagListeners();
        
        // Content actions
        document.querySelectorAll('.content-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const contentItem = e.target.closest('.content-item');
                const title = contentItem.querySelector('h4').textContent;
                this.viewContent(title);
            });
        });
        
        // Change avatar button
        const changeAvatarBtn = document.querySelector('.change-avatar-btn');
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', () => {
                this.changeAvatar();
            });
        }
    }
    
    setupInterestTagListeners() {
        document.querySelectorAll('.tag').forEach(tag => {
            tag.style.cursor = 'pointer';
            tag.title = 'Clique para remover';
            
            tag.addEventListener('click', () => {
                const interest = tag.textContent;
                this.removeInterest(interest);
            });
        });
    }
    
    updateDifficultyDisplay() {
        const difficultyRange = document.getElementById('difficultyRange');
        if (!difficultyRange) return;
        
        const value = parseInt(difficultyRange.value);
        const labels = ['Iniciante', 'Básico', 'Intermediário', 'Avançado', 'Expert'];
        
        // Update visual feedback (could add a display element)
        difficultyRange.title = `Nível: ${labels[value - 1]}`;
    }
    
    showAddInterestDialog() {
        const interest = prompt('Digite uma nova área de interesse:');
        if (interest && interest.trim()) {
            this.addInterest(interest.trim());
        }
    }
    
    addInterest(interest) {
        if (this.preferences.interests.includes(interest)) {
            Utils.showNotification('Esta área de interesse já existe', 'warning');
            return;
        }
        
        this.preferences.interests.push(interest);
        this.updateInterestTags();
        this.savePreferences();
        Utils.showNotification('Área de interesse adicionada', 'success');
    }
    
    removeInterest(interest) {
        const index = this.preferences.interests.indexOf(interest);
        if (index > -1) {
            this.preferences.interests.splice(index, 1);
            this.updateInterestTags();
            this.savePreferences();
            Utils.showNotification('Área de interesse removida', 'success');
        }
    }
    
    updateInterestTags() {
        const tagsContainer = document.querySelector('.interest-tags');
        if (!tagsContainer) return;
        
        // Clear existing tags (except add button)
        const existingTags = tagsContainer.querySelectorAll('.tag');
        existingTags.forEach(tag => tag.remove());
        
        // Add updated tags
        this.preferences.interests.forEach(interest => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = interest;
            tag.style.cursor = 'pointer';
            tag.title = 'Clique para remover';
            tag.addEventListener('click', () => this.removeInterest(interest));
            
            // Insert before the add button
            const addBtn = tagsContainer.querySelector('.add-interest-btn');
            tagsContainer.insertBefore(tag, addBtn);
        });
    }
    
    viewContent(title) {
        Utils.showNotification(`Abrindo: ${title}`, 'info');
        // Implementar visualização do conteúdo
        // Poderia abrir um modal ou navegar para uma página específica
    }
    
    changeAvatar() {
        Utils.showNotification('Funcionalidade de alteração de avatar em desenvolvimento', 'info');
        // Implementar upload de avatar
    }
    
    loadPreferences() {
        // Carregar preferências salvas (localStorage ou API)
        const saved = localStorage.getItem('userPreferences');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.preferences = { ...this.preferences, ...parsed };
                this.applyPreferences();
            } catch (error) {
                console.error('Error loading preferences:', error);
            }
        }
    }
    
    savePreferences() {
        // Salvar preferências (localStorage ou API)
        localStorage.setItem('userPreferences', JSON.stringify(this.preferences));
        
        // Também poderia enviar para a API:
        /*
        Utils.fetchAPI('/user/preferences', {
            method: 'PUT',
            body: JSON.stringify(this.preferences)
        }).catch(error => {
            console.error('Error saving preferences:', error);
        });
        */
    }
    
    applyPreferences() {
        // Aplicar preferências carregadas à interface
        
        // Format preference
        const formatRadio = document.querySelector(`input[name="format"][value="${this.preferences.format}"]`);
        if (formatRadio) {
            formatRadio.checked = true;
        }
        
        // Difficulty preference
        const difficultyRange = document.getElementById('difficultyRange');
        if (difficultyRange) {
            difficultyRange.value = this.preferences.difficulty;
            this.updateDifficultyDisplay();
        }
        
        // Interest tags are already rendered from the template
        // but we could update them here if needed
    }
    
    // Method to get user stats (could be called from API)
    async updateStats() {
        try {
            // Mock data - replace with actual API call
            const stats = {
                conversations: Math.floor(Math.random() * 20),
                savedContent: Math.floor(Math.random() * 50),
                studyHours: Math.floor(Math.random() * 100)
            };
            
            // Update stats display
            const statNumbers = document.querySelectorAll('.stat-number');
            if (statNumbers.length >= 3) {
                statNumbers[0].textContent = stats.conversations;
                statNumbers[1].textContent = stats.savedContent;
                statNumbers[2].textContent = stats.studyHours;
            }
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
}

// Initialize profile manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.profileManager = new ProfileManager();
    
    // Update stats after a short delay
    setTimeout(() => {
        if (window.profileManager) {
            window.profileManager.updateStats();
        }
    }, 1000);
});