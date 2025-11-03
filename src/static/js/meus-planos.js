// Meus Planos - Gerenciamento de Planos do Usuário
class PlanosManager {
    constructor() {
        this.plans = [];
        this.currentFilter = 'todos';
        this.pollingInterval = null;
        this.lastPlansHash = null; // To track changes
        
        this.initializeElements();
        this.loadPlans(); // This will start polling if needed
    }

    initializeElements() {
        this.plansGrid = document.getElementById('plansGrid');
        this.emptyState = document.getElementById('emptyState');
    }

    async loadPlans() {
        try {
            this.showLoading();
            
            const response = await fetch('/plan', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar planos');
            }

            const plans = await response.json();
            console.log('Plans loaded:', plans);
            
            // Only update UI if plans actually changed
            const currentHash = this.generatePlansHash(plans);
            if (currentHash !== this.lastPlansHash) {
                console.log('Plans changed, updating UI');
                this.plans = plans;
                this.renderPlans();
                this.lastPlansHash = currentHash;
            } else {
                console.log('No changes in plans, skipping UI update');
                this.plans = plans; // Still update the data for filtering
            }
            
            this.hideLoading();
            
            // Check if we need to continue polling
            this.checkPollingNeed(plans);
            
        } catch (error) {
            console.error('Error loading plans:', error);
            Utils.showNotification('Erro ao carregar planos', 'error');
            this.plans = [];
            this.renderPlans();
            this.hideLoading();
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
        
        if (filteredPlans.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        this.plansGrid.innerHTML = filteredPlans.map(plan => this.createPlanCard(plan)).join('');
    }

    createPlanCard(plan) {
        const lastMessage = plan.last_message?.content?.data;
        const title = lastMessage?.title || plan.title || 'Plano de Estudos';
        const description = lastMessage?.description || 'Plano personalizado de aprendizagem';
        const moduleCount = lastMessage?.modules?.length || 0;
        const difficulty = this.translateDifficulty(lastMessage?.difficulty);
        
        // Calculate progress (assuming each module represents 20% progress)
        const progress = Math.min(moduleCount * 20, 100);
        
        // Determine status based on backend status and progress
        const statusInfo = this.getStatusInfo(plan.status, progress);
        
        return `
            <div class="plan-card" onclick="openPlan('${plan.plan_id}')">
                <div class="plan-header">
                    <h3 class="plan-title">${title}</h3>
                    <span class="plan-status ${statusInfo.class}">
                        ${statusInfo.text}
                    </span>
                </div>
                
                <div class="plan-description">
                    ${description}
                </div>
                
                <div class="plan-progress">
                    <div class="progress-label">
                        <span>Módulos criados</span>
                        <span>${moduleCount}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(moduleCount * 20, 100)}%"></div>
                    </div>
                </div>
                
                <div class="plan-meta">
                    <div class="plan-date">
                        📅 ${this.formatDate(plan.updated_at)}
                    </div>
                    <div class="plan-difficulty">
                        🎯 ${difficulty}
                    </div>
                </div>
            </div>
        `;
    }

    createSkeletonCards() {
        // Create 3 skeleton cards to match typical loading state
        const skeletonCard = `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-status"></div>
                </div>
                
                <div class="skeleton-description">
                    <div class="skeleton-description-line"></div>
                    <div class="skeleton-description-line"></div>
                    <div class="skeleton-description-line"></div>
                </div>
                
                <div class="skeleton-progress">
                    <div class="skeleton-progress-label">
                        <div class="skeleton-progress-text"></div>
                        <div class="skeleton-progress-number"></div>
                    </div>
                    <div class="skeleton-progress-bar"></div>
                </div>
                
                <div class="skeleton-meta">
                    <div class="skeleton-date"></div>
                    <div class="skeleton-difficulty"></div>
                </div>
            </div>
        `;
        
        return Array(3).fill(skeletonCard).join('');
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
        const lastMessage = plan.last_message?.content?.data;
        const moduleCount = lastMessage?.modules?.length || 0;
        const progress = Math.min(moduleCount * 20, 100);
        
        const statusInfo = this.getStatusInfo(plan.status, progress);
        
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
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        if (targetElement) {
            targetElement.classList.add('active');
        }
        
        this.renderPlans();
    }

    formatDate(dateString) {
        if (!dateString) return 'Recente';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Ontem';
        } else if (diffDays < 7) {
            return `${diffDays} dias atrás`;
        } else {
            return date.toLocaleDateString('pt-BR');
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
            this.loadPlans();
        }, 5000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    showLoading() {
        this.emptyState.style.display = 'none';
        this.plansGrid.style.display = 'grid';
        this.plansGrid.innerHTML = this.createSkeletonCards();
    }

    hideLoading() {
        // Loading is hidden when real content is rendered
    }

    showEmptyState() {
        this.emptyState.style.display = 'block';
        this.plansGrid.style.display = 'none';
    }

    hideEmptyState() {
        this.emptyState.style.display = 'none';
        this.plansGrid.style.display = 'grid';
    }
}

// Global functions
function filterPlans(status) {
    if (window.planosManager) {
        // Find the clicked button by matching the onclick attribute
        const clickedButton = document.querySelector(`[onclick="filterPlans('${status}')"]`);
        window.planosManager.filterPlans(status, clickedButton);
    }
}

function createNewPlan() {
    Utils.showNotification('Criando novo plano...', 'info');
    setTimeout(() => {
        window.location.href = '/ui/plano';
    }, 1000);
}

function openPlan(planId) {
    Utils.showNotification('Abrindo plano...', 'info');
    setTimeout(() => {
        window.location.href = `/ui/plano?plan_id=${planId}`;
    }, 1000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!localStorage.getItem('authToken')) {
        window.location.href = '/ui/login';
        return;
    }

    window.planosManager = new PlanosManager();
});

// Cleanup polling when leaving page
window.addEventListener('beforeunload', () => {
    if (window.planosManager) {
        window.planosManager.stopPolling();
    }
});