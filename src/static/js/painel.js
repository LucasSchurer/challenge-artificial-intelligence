// Painel Management - Integra funcionalidade de todos os planos
class PainelManager {
    constructor() {
        this.plans = [];
        this.currentFilter = 'todos';
        this.pollingInterval = null;
        this.lastPlansHash = null;
        
        this.init();
    }
    
    init() {
        // Check authentication
        if (!this.checkAuth()) {
            return;
        }
        
        this.loadUserName();
        this.loadAllPlans();
    }
    
    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            Utils.showNotification('Você precisa fazer login para acessar o painel', 'warning');
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
    
    loadUserName() {
        // Try to get user name from assessment or use default
        const assessment = localStorage.getItem('userAssessment');
        let userName = 'Estudante';
        
        if (assessment) {
            try {
                const data = JSON.parse(assessment);
                if (data.name) {
                    userName = data.name;
                }
            } catch (e) {
                console.log('Could not parse user assessment');
            }
        }
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }
    }

    async loadAllPlans() {
        try {
            // Show skeleton on first load
            if (this.plans.length === 0) {
                this.showSkeleton();
            }
            
            const response = await fetch('/plan', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const allPlans = await response.json();
                console.log('All plans loaded:', allPlans);
                
                // Only update UI if plans actually changed
                const currentHash = this.generatePlansHash(allPlans);
                if (currentHash !== this.lastPlansHash) {
                    console.log('Plans changed, updating UI');
                    this.plans = allPlans;
                    this.renderPlans();
                    this.lastPlansHash = currentHash;
                } else {
                    console.log('No changes in plans, skipping UI update');
                    this.plans = allPlans; // Still update the data for filtering
                }
                
                // Hide skeleton after loading
                this.hideSkeleton();
                
                // Check if we need to continue polling
                this.checkPollingNeed(allPlans);
            } else {
                this.hideSkeleton();
                this.showEmptyPlans();
            }
        } catch (error) {
            console.error('Error loading plans:', error);
            this.hideSkeleton();
            this.showEmptyPlans();
        }
    }

    checkPollingNeed(plans) {
        // Only poll if there are plans creating modules (not outline)
        const hasModuleCreation = plans.some(plan => 
            plan.status === 'creating_modules'
        );
        
        if (hasModuleCreation && !this.pollingInterval) {
            console.log('Starting polling - found plans creating modules');
            this.startPolling();
        } else if (!hasModuleCreation && this.pollingInterval) {
            console.log('Stopping polling - no module creation in progress');
            this.stopPolling();
        }
    }

    renderPlans() {
        const filteredPlans = this.filterPlansByStatus(this.plans, this.currentFilter);
        const allPlansContainer = document.getElementById('allPlans');
        const emptyPlansContainer = document.getElementById('emptyPlans');
        
        // Always hide skeleton when rendering
        this.hideSkeleton();
        
        if (filteredPlans.length === 0) {
            this.showEmptyPlans();
            return;
        }
        
        emptyPlansContainer.style.display = 'none';
        allPlansContainer.innerHTML = filteredPlans.map(plan => this.createPlanCard(plan)).join('');
    }

    createPlanCard(plan) {

        
        const lastMessage = plan.last_message?.content?.data;
        const title = lastMessage?.title || plan.title || 'Plano de Estudos';
        const description = lastMessage?.description || plan.description || 'Plano personalizado de aprendizagem';
        
        // Get real progress data from API response
        const totalModules = plan.modules_count || 0;
        const currentProgress = plan.progress || 0;
        const progressPercentage = totalModules > 0 ? Math.round((currentProgress / totalModules) * 100) : 0;
        
        // Determine status based on backend status and real progress
        const statusInfo = this.getStatusInfo(plan.status, progressPercentage);
        
        // Use real dates - prioritize last_viewed_at over created_at
        const lastAccessDate = plan.last_viewed_at || plan.created_at;
        
        return `
            <div class="plan-card" onclick="openPlan('${plan.plan_id}')">
                <div class="plan-content">
                    <h3 class="plan-title">${title}</h3>
                    <span class="plan-status ${statusInfo.class}">
                        ${statusInfo.text}
                    </span>
                    
                    <div class="plan-description">
                        ${description}
                    </div>
                    
                    <div class="plan-progress">
                        <div class="progress-label">
                            <span>Progresso</span>
                            <span>${currentProgress}/${totalModules}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                    </div>
                    
                    <div class="plan-meta">
                        <div class="plan-date">
                            📅 ${this.formatDate(lastAccessDate)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    filterPlansByStatus(plans, status) {
        if (status === 'todos') {
            return plans;
        }
        
        return plans.filter(plan => {
            // Get status category based on plan data
            const statusCategory = this.getStatusCategory(plan);
            return statusCategory === status;
        });
    }

    getStatusCategory(plan) {
        const totalModules = plan.modules_count || 0;
        const currentProgress = plan.progress || 0;
        const progressPercentage = totalModules > 0 ? Math.round((currentProgress / totalModules) * 100) : 0;
        
        const statusInfo = this.getStatusInfo(plan.status, progressPercentage);
        
        // Map UI status classes to filter categories
        const categoryMapping = {
            'criando': 'criacao',
            'andamento': 'andamento', 
            'nao-iniciado': 'nao-iniciado',
            'concluido': 'concluido'
        };
        
        return categoryMapping[statusInfo.class] || 'andamento';
    }

    filterPlans(status, targetElement) {
        this.currentFilter = status;
        
        // Update active tab
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (targetElement) {
            targetElement.classList.add('active');
        }
        
        this.renderPlans();
    }

    showEmptyPlans() {
        const allPlansContainer = document.getElementById('allPlans');
        const emptyPlansContainer = document.getElementById('emptyPlans');
        
        allPlansContainer.innerHTML = '';
        emptyPlansContainer.style.display = 'block';
    }

    showSkeleton() {
        const skeletonContainer = document.getElementById('skeletonLoading');
        const allPlansContainer = document.getElementById('allPlans');
        const emptyPlansContainer = document.getElementById('emptyPlans');
        
        if (skeletonContainer) {
            skeletonContainer.style.display = 'grid';
        }
        allPlansContainer.style.display = 'none';
        emptyPlansContainer.style.display = 'none';
    }

    hideSkeleton() {
        const skeletonContainer = document.getElementById('skeletonLoading');
        const allPlansContainer = document.getElementById('allPlans');
        
        if (skeletonContainer) {
            skeletonContainer.style.display = 'none';
        }
        allPlansContainer.style.display = 'grid';
    }

    formatDate(dateString) {
        if (!dateString) return 'Recente';
        
        // Parse the UTC date and convert to local time
        const date = new Date(dateString);
        const now = new Date();
        
        // Calculate difference in local time
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        

        
        if (diffMinutes < 60) {
            return diffMinutes <= 1 ? 'Agora mesmo' : `${diffMinutes} min atrás`;
        } else if (diffHours < 24) {
            return diffHours === 1 ? '1 hora atrás' : `${diffHours} horas atrás`;
        } else if (diffDays === 1) {
            return 'Ontem';
        } else if (diffDays < 7) {
            return `${diffDays} dias atrás`;
        } else {
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    translateDifficulty(difficulty) {
        const translations = {
            'beginner': 'Iniciante',
            'intermediate': 'Intermediário',
            'advanced': 'Avançado'
        };
        return translations[difficulty] || 'Não definido';
    }

    getStatusInfo(backendStatus, progress) {
        // New granular status logic
        switch (backendStatus) {
            case 'creating_outline':
                return { class: 'criando', text: 'Em Criação' };
            
            case 'creating_modules':
                return { class: 'criando', text: 'Em Criação' };
            
            case 'created':
                if (progress > 0) {
                    return { class: 'andamento', text: 'Em Andamento' };
                } else {
                    return { class: 'nao-iniciado', text: 'Não Iniciado' };
                }
            
            case 'completed':
                return { class: 'concluido', text: 'Concluído' };
            
            default:
                return { class: 'andamento', text: 'Em Andamento' };
        }
    }

    generatePlansHash(plans) {
        // Create a simple hash based on plan IDs and key properties
        const planData = plans.map(plan => ({
            id: plan.plan_id,
            status: plan.status,
            title: plan.last_message?.content?.data?.title,
            moduleCount: plan.last_message?.content?.data?.modules?.length || 0,
            updated_at: plan.updated_at
        }));
        
        return JSON.stringify(planData);
    }

    startPolling() {
        // Poll every 5 seconds to update plan statuses
        this.pollingInterval = setInterval(() => {
            this.loadAllPlans();
        }, 5000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}

// Global functions
function startNewPlan() {
    Utils.showNotification('Iniciando novo plano...', 'info');
    setTimeout(() => {
        window.location.href = '/ui/plano';
    }, 1000);
}

function openProfile() {
    Utils.showNotification('Redirecionando para avaliação...', 'info');
    setTimeout(() => {
        window.location.href = '/ui/avaliacao';
    }, 1000);
}

function openPlan(planId) {
    Utils.showNotification('Abrindo plano...', 'info');
    setTimeout(() => {
        window.location.href = `/ui/plano?plan_id=${planId}`;
    }, 1000);
}

function filterPlans(status) {
    if (window.painelManager) {
        // Find the clicked button by matching the onclick attribute
        const clickedButton = document.querySelector(`[onclick="filterPlans('${status}')"]`);
        window.painelManager.filterPlans(status, clickedButton);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.painelManager = new PainelManager();
});

// Cleanup polling when leaving page
window.addEventListener('beforeunload', () => {
    if (window.painelManager) {
        window.painelManager.stopPolling();
    }
});