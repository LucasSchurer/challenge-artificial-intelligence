// Plano de Estudos - Chat + Canvas Interface
class PlanoManager {
    constructor() {
        this.currentPlanId = null;
        this.isWaitingForResponse = false;
        this.lastMessageId = null;
        this.pollingInterval = null;
        this.currentStatus = null;
        this.currentMode = 'creation'; // 'creation' or 'study'
        this.selectedModuleId = null;
        this.modules = [];
        this.currentModalContent = null;
        this.currentLoadingContentId = null;

        this.initializeElements();
        this.bindEvents();
        this.initializePlan();
    }

    initializeElements() {
        // Creation mode elements
        this.creationMode = document.getElementById('creationMode');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatStatus = document.getElementById('chatStatus');
        this.planTitle = document.getElementById('planTitle');
        this.planDifficulty = document.getElementById('planDifficulty');
        this.modulesContainer = document.getElementById('modulesContainer');
        this.emptyState = document.getElementById('emptyState');
        this.canvasActions = document.getElementById('canvasActions');
        this.finalizePlan = document.getElementById('finalizePlan');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        // Study mode elements
        this.studyMode = document.getElementById('studyMode');
        this.studyTitle = document.getElementById('studyTitle');
        this.modulesList = document.getElementById('modulesList');
        this.contentBody = document.getElementById('contentBody');
        this.chatOverlay = document.getElementById('chatOverlay');
        this.chatHistoryBody = document.getElementById('chatHistoryBody');
    }

    bindEvents() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    initializePlan() {
        // Check if there's a plan_id in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const planId = urlParams.get('plan_id');

        if (planId) {
            this.loadExistingPlan(planId);
        } else {
            this.startNewPlan();
        }
    }

    async loadExistingPlan(planId) {
        try {
            this.showLoading('Carregando plano...');

            const response = await fetch(`/plan/${planId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar plano');
            }

            const planData = await response.json();
            console.log('Existing plan data:', planData);

            this.currentPlanId = planData.plan_id;

            // Reconstruct chat from messages history
            this.reconstructChat(planData.messages || []);

            // Update plan info from last message
            const lastMessage = planData.messages?.[planData.messages.length - 1];
            if (lastMessage?.content?.data) {
                this.updatePlanInfo(lastMessage.content.data);
                this.updateModules(lastMessage.content.data.modules || [], lastMessage.content.data.ready_to_save || false);
            }

            // Set current status and determine mode
            this.currentStatus = planData.status;

            if (planData.status === 'created' || planData.status === 'completed') {
                // Switch to study mode
                this.switchToStudyMode(planData);
            } else if (planData.status === 'creating_modules') {
                this.showModuleGenerationStatus();
                this.startPolling(); // Only start polling if actively processing
            } else if (planData.status === 'creating_outline') {
                this.enableInput();
                // No polling needed yet - user is still chatting
            } else {
                this.enableInput();
            }

            this.hideLoading();

        } catch (error) {
            console.error('Erro ao carregar plano:', error);
            Utils.showNotification('Erro ao carregar plano', 'error');
            this.hideLoading();
            // Fallback to new plan
            this.startNewPlan();
        }
    }

    reconstructChat(messages) {
        // Clear existing messages
        this.chatMessages.innerHTML = '';

        // Add each message to chat
        messages.forEach(message => {
            if (message.role === 'assistant' && message.content?.data?.answer) {
                this.addMessage(message.content.data.answer, 'ai');
            } else if (message.role === 'user' && message.content?.text) {
                this.addMessage(message.content.text, 'user');
            }
        });
    }

    async startNewPlan() {
        try {
            this.showLoading('Criando novo plano...');

            // Apenas cria o plano
            const createResponse = await fetch('/plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!createResponse.ok) {
                throw new Error('Erro ao criar plano');
            }

            const planData = await createResponse.json();
            console.log('Plan data received:', planData);

            this.currentPlanId = planData.plan_id;

            // Mostra a mensagem inicial da IA que vem do plano
            const messageData = planData.last_message?.content?.data;
            if (messageData?.answer) {
                console.log('Adding AI message:', messageData.answer);
                this.addMessage(messageData.answer, 'ai');

                // Atualiza as informações do plano
                this.updatePlanInfo(messageData);
                this.updateModules(messageData.modules || [], messageData.ready_to_save || false);
            } else {
                console.log('No message data found');
            }

            this.enableInput();
            this.hideLoading();

        } catch (error) {
            console.error('Erro ao iniciar plano:', error);
            Utils.showNotification('Erro ao iniciar plano de estudos', 'error');
            this.hideLoading();
        }
    }

    startPolling() {
        // Poll every 3 seconds to check for status changes
        this.pollingInterval = setInterval(() => {
            this.checkPlanStatus();
        }, 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async checkPlanStatus() {
        if (!this.currentPlanId) return;

        try {
            const response = await fetch(`/plan/${this.currentPlanId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const planData = await response.json();
                const newStatus = planData.status;

                if (newStatus !== this.currentStatus) {
                    console.log(`Status changed from ${this.currentStatus} to ${newStatus}`);
                    this.handleStatusChange(this.currentStatus, newStatus, planData);
                    this.currentStatus = newStatus;
                }
            }
        } catch (error) {
            console.error('Error checking plan status:', error);
        }
    }

    handleStatusChange(oldStatus, newStatus, planData) {
        switch (newStatus) {
            case 'creating_modules':
                this.showModuleGenerationStatus();
                break;
            case 'created':
                this.showPlanCompleted();
                this.stopPolling(); // Stop polling when plan is ready
                break;
            case 'completed':
                this.showAllCompleted();
                this.stopPolling(); // Stop polling when fully completed
                break;
        }
    }

    showModuleGenerationStatus() {
        this.chatStatus.textContent = 'Gerando conteúdos dos módulos...';
        this.addMessage('Perfeito! Agora vou gerar os conteúdos detalhados para cada módulo. Isso pode levar alguns minutos...', 'ai');

        // Disable input during module generation
        this.disableInput();

        // Update finalize button
        this.finalizePlan.disabled = true;
        this.finalizePlan.textContent = 'Gerando Conteúdos...';
    }

    showPlanCompleted() {
        this.chatStatus.textContent = 'Plano finalizado com sucesso!';
        this.addMessage('🎉 Seu plano de estudos está pronto! Todos os módulos foram criados com conteúdos detalhados. Você pode começar a estudar agora!', 'ai');

        // Update finalize button
        this.finalizePlan.disabled = false;
        this.finalizePlan.textContent = 'Começar a Estudar';
        this.finalizePlan.onclick = () => this.startStudying();

        Utils.showNotification('Plano finalizado com sucesso!', 'success');
    }

    showAllCompleted() {
        this.chatStatus.textContent = 'Todos os conteúdos foram gerados!';
        Utils.showNotification('Todos os módulos estão prontos!', 'success');
    }

    startStudying() {
        Utils.showNotification('Redirecionando para estudos...', 'info');
        setTimeout(() => {
            window.location.href = '/ui/painel';
        }, 1500);
    }

    async switchToStudyMode(planData) {
        console.log('Switching to study mode');
        this.currentMode = 'study';

        // Hide creation mode, show study mode
        this.creationMode.style.display = 'none';
        this.studyMode.style.display = 'flex';

        // Hide footer in study mode
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.style.display = 'none';
        }

        // Update study header
        const lastMessage = planData.messages?.[planData.messages.length - 1];
        const messageData = lastMessage?.content?.data;

        if (messageData) {
            this.studyTitle.textContent = messageData.title || 'Plano de Estudos';

            // Update description
            const descriptionElement = document.getElementById('studyDescription');
            if (descriptionElement) {
                descriptionElement.textContent = messageData.description || 'Plano personalizado de aprendizagem';
            }

            // Update status badge
            const statusBadge = document.getElementById('studyStatusBadge');
            if (statusBadge) {
                const statusInfo = this.getStatusInfo(planData.status, planData.progress || 0);
                statusBadge.textContent = statusInfo.text;
                statusBadge.className = `study-status-badge ${statusInfo.class}`;
            }

            // Update created date
            const createdDateElement = document.getElementById('studyCreatedDate');
            if (createdDateElement) {
                createdDateElement.textContent = `📅 Criado em: ${this.formatDate(planData.created_at)}`;
            }

            // Update progress bar
            const progressCountElement = document.getElementById('progressCount');
            const progressFillElement = document.getElementById('progressFill');
            if (progressCountElement && progressFillElement) {
                const completedCount = planData.progress || 0;
                const totalCount = planData.modules_count || messageData.modules?.length || 0;
                const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                progressCountElement.textContent = `${completedCount}/${totalCount}`;
                progressFillElement.style.width = `${progressPercentage}%`;
            }
        }

        // Load modules
        await this.loadModules();

        // Load chat history for modal
        this.loadChatHistory(planData.messages || []);
    }

    async loadModules() {
        try {
            const response = await fetch(`/plan/${this.currentPlanId}/modules`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar módulos');
            }

            const modules = await response.json();
            console.log('Modules loaded:', modules);
            console.log('First module structure:', modules[0]); // Debug structure

            this.modules = modules;
            this.renderModules();

        } catch (error) {
            console.error('Error loading modules:', error);
            Utils.showNotification('Erro ao carregar módulos', 'error');
        }
    }

    renderModules() {
        console.log('Rendering modules:', this.modules); // Debug

        if (!this.modulesList) {
            console.error('modulesList element not found');
            return;
        }

        this.modulesList.innerHTML = this.modules.map(module => this.createModuleItem(module)).join('');

        // Select first module by default
        if (this.modules.length > 0 && !this.selectedModuleId) {
            const firstModuleId = this.modules[0].id || this.modules[0].module_id;
            console.log('Auto-selecting first module:', firstModuleId);
            this.selectModule(firstModuleId);
        }
    }

    createModuleItem(module) {
        console.log('Creating module item:', module); // Debug

        const moduleId = module.id || module.module_id; // Try both possible field names
        const progress = module.progress || 0;
        const totalContents = module.contents_count || 0;
        const progressPercentage = totalContents > 0 ? Math.round((progress / totalContents) * 100) : 0;

        // Determine status
        const statusInfo = this.getModuleStatusInfo(module.status, progress, totalContents);

        return `
            <div class="module-card ${this.selectedModuleId === moduleId ? 'active' : ''}" 
                 data-module-id="${moduleId}"
                 onclick="window.planoManager.selectModule('${moduleId}')">
                <div class="module-card-header">
                    <h4 class="module-title">${module.title}</h4>
                    <span class="module-status-badge ${statusInfo.class}">
                        ${statusInfo.text}
                    </span>
                </div>
                
                <p class="module-description">
                    ${module.description || 'Módulo do plano de estudos'}
                </p>
                
                <div class="module-progress">
                    <div class="progress-label">
                        <span>Progresso</span>
                        <span>${progress}/${totalContents}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async selectModule(moduleId) {
        console.log('Selecting module:', moduleId); // Debug

        if (!moduleId || moduleId === 'undefined') {
            console.error('Invalid module ID:', moduleId);
            return;
        }

        this.selectedModuleId = moduleId;

        // Update active state - use data attribute for precise selection
        document.querySelectorAll('.module-card').forEach(item => {
            item.classList.remove('active');
        });

        // Find the specific module card by data attribute
        const targetElement = document.querySelector(`[data-module-id="${moduleId}"]`);
        if (targetElement) {
            targetElement.classList.add('active');
        } else {
            console.warn('Module card not found for ID:', moduleId);
        }

        // Load module content
        await this.loadModuleContent(moduleId);
    }

    async loadModuleContent(moduleId) {
        try {
            // Show skeleton while loading
            this.showContentSkeleton();

            const response = await fetch(`/plan/${this.currentPlanId}/modules/${moduleId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar conteúdo do módulo');
            }

            const module = await response.json();
            console.log('Module content loaded:', module);

            this.renderModuleContent(module);

        } catch (error) {
            console.error('Error loading module content:', error);
            Utils.showNotification('Erro ao carregar conteúdo', 'error');
        }
    }

    renderModuleContent(module) {
        if (!module.contents || module.contents.length === 0) {
            this.contentBody.innerHTML = `
                <div class="empty-content">
                    <div class="empty-icon">📚</div>
                    <h3>Módulo em preparação</h3>
                    <p>Os conteúdos deste módulo ainda estão sendo gerados.</p>
                </div>
            `;
            return;
        }



        const contentList = module.contents.map((content, index) => this.createContentItem(content, index + 1)).join('');
        this.contentBody.innerHTML = `<div class="content-list">${contentList}</div>`;
    }

    showContentSkeleton() {
        const skeletonHtml = `
            <div class="content-skeleton">
                ${Array(3).fill(0).map((_, index) => `
                    <div class="content-skeleton-item">
                        <div class="content-skeleton-header">
                            <div class="content-skeleton-number"></div>
                            <div class="content-skeleton-title"></div>
                            <div class="content-skeleton-badges">
                                <div class="content-skeleton-checkbox"></div>
                                <div class="content-skeleton-badge"></div>
                            </div>
                        </div>
                        <div class="content-skeleton-description"></div>
                    </div>
                `).join('')}
            </div>
        `;

        this.contentBody.innerHTML = skeletonHtml;
    }

    createContentItem(content, order) {
        const contentId = content.id || content.content_id; // Try both possible field names
        
        // Check completion status
        const isCompleted = content.status === 'completed';

        // Get content type from the backend data
        const contentType = content.content_type || 'text';
        const typeInfo = this.getContentTypeInfo(contentType);

        return `
            <div class="content-item ${isCompleted ? 'completed' : ''}" 
                 onclick="window.planoManager.openContentModal('${contentId}')">
                <div class="content-item-header">
                    <div class="content-item-number">${order}</div>
                    <h3 class="content-item-title">${content.title}</h3>
                    <div class="content-item-badges">
                        <div class="content-status-toggle" onclick="event.stopPropagation()">
                            <label class="checkbox-container">
                                <input type="checkbox" 
                                       id="content-checkbox-${contentId}"
                                       ${isCompleted ? 'checked' : ''} 
                                       onchange="window.planoManager.toggleContentStatus('${contentId}', '${content.status}')">
                                <span class="checkmark"></span>
                                Concluído
                            </label>
                        </div>
                        <span class="content-type-badge ${typeInfo.class}">
                            ${typeInfo.icon} ${typeInfo.text}
                        </span>
                    </div>
                </div>
                ${content.description ? `
                    <div class="content-item-description">
                        ${content.description}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async toggleContentStatus(contentId, currentStatus) {
        try {
            // Determine the new completion status
            const newCompleted = currentStatus !== 'completed'; // Toggle: if completed, set to false; if not completed, set to true

            const response = await fetch(`/plan/${this.currentPlanId}/modules/${this.selectedModuleId}/contents/${contentId}/complete?completed=${newCompleted}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao alterar status do conteúdo');
            }

            const message = newCompleted ?
                'Conteúdo marcado como concluído!' :
                'Conteúdo desmarcado!';

            Utils.showNotification(message, 'success');

            // Reload module content and overall progress
            await this.loadModuleContent(this.selectedModuleId);
            await this.loadModules(); // Refresh modules list

        } catch (error) {
            console.error('Error toggling content status:', error);
            Utils.showNotification('Erro ao alterar status do conteúdo', 'error');
        }
    }

    // updateOverallProgress() - Removed as we now use the progress bar in the header

    loadChatHistory(messages) {
        const historyHtml = messages.map(message => {
            if (message.role === 'assistant' && message.content?.data?.answer) {
                return `<div class="message ai">${this.markdownToHtml(message.content.data.answer)}</div>`;
            } else if (message.role === 'user' && message.content?.text) {
                return `<div class="message user">${message.content.text}</div>`;
            }
            return '';
        }).join('');

        this.chatHistoryBody.innerHTML = historyHtml;
    }

    translateModuleStatus(status) {
        const translations = {
            'creating_outline': 'Criando',
            'creating_contents': 'Gerando',
            'created': 'Pronto',
            'completed': 'Concluído'
        };
        return translations[status] || status;
    }

    async openContentModal(contentId) {
        // Check if already loading to prevent multiple clicks
        const contentItem = document.querySelector(`[onclick*="${contentId}"]`);
        if (contentItem && contentItem.dataset.loading === 'true') {
            return; // Already loading, ignore click
        }

        try {
            // Show loading feedback
            this.showContentLoadingFeedback(contentId);

            // Get full content details
            const response = await fetch(`/plan/${this.currentPlanId}/modules/${this.selectedModuleId}/contents/${contentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar conteúdo');
            }

            const content = await response.json();
            console.log('Content loaded for modal:', content);

            // Add minimum delay to ensure user sees the loading feedback
            await new Promise(resolve => setTimeout(resolve, 300));

            // Hide loading feedback
            this.hideContentLoadingFeedback(contentId);

            this.showContentModal(content);

        } catch (error) {
            console.error('Error loading content for modal:', error);

            // Hide loading feedback on error
            this.hideContentLoadingFeedback(contentId);

            Utils.showNotification('Erro ao carregar conteúdo', 'error');
        }
    }

    showContentLoadingFeedback(contentId) {
        // Find the content item by contentId - try multiple selectors
        let contentItem = document.querySelector(`[onclick*="${contentId}"]`);

        // If not found by onclick, try by data attribute or other methods
        if (!contentItem) {
            contentItem = document.querySelector(`[data-content-id="${contentId}"]`);
        }

        // If still not found, try to find by the contentId in any onclick attribute
        if (!contentItem) {
            const allContentItems = document.querySelectorAll('.content-item');
            contentItem = Array.from(allContentItems).find(item =>
                item.getAttribute('onclick')?.includes(contentId)
            );
        }

        if (contentItem) {
            // Add loading class to the content item
            contentItem.classList.add('content-loading');

            // Add a flag to prevent multiple clicks instead of disabling pointer events
            contentItem.dataset.loading = 'true';

            // Add loading spinner to the content item
            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'content-loading-spinner';
            loadingSpinner.innerHTML = `
                <div class="spinner-small"></div>
                <span>Carregando...</span>
            `;
            contentItem.appendChild(loadingSpinner);

            // Store reference for cleanup
            this.currentLoadingContentId = contentId;
        }

        // Also show a general loading overlay with slight delay for better UX
        setTimeout(() => {
            this.showModalLoadingOverlay();
        }, 100);
    }

    hideContentLoadingFeedback(contentId) {
        // Use stored reference or find the content item
        const targetId = contentId || this.currentLoadingContentId;

        // Find the content item by contentId - try multiple selectors
        let contentItem = document.querySelector(`[onclick*="${targetId}"]`);

        if (!contentItem) {
            contentItem = document.querySelector(`[data-content-id="${targetId}"]`);
        }

        if (!contentItem) {
            const allContentItems = document.querySelectorAll('.content-item');
            contentItem = Array.from(allContentItems).find(item =>
                item.getAttribute('onclick')?.includes(targetId)
            );
        }

        // Also try to find any content item that has loading class
        if (!contentItem) {
            contentItem = document.querySelector('.content-item.content-loading');
        }

        if (contentItem) {
            // Remove loading class
            contentItem.classList.remove('content-loading');

            // Remove loading flag
            delete contentItem.dataset.loading;

            // Remove loading spinner
            const loadingSpinner = contentItem.querySelector('.content-loading-spinner');
            if (loadingSpinner) {
                loadingSpinner.remove();
            }
        }

        // Hide general loading overlay
        this.hideModalLoadingOverlay();

        // Clear stored reference
        this.currentLoadingContentId = null;
    }

    // Fallback method to clean any loading states
    clearAllLoadingStates() {
        // Remove loading class from all content items
        const loadingItems = document.querySelectorAll('.content-item.content-loading');
        loadingItems.forEach(item => {
            item.classList.remove('content-loading');
            delete item.dataset.loading;

            const spinner = item.querySelector('.content-loading-spinner');
            if (spinner) {
                spinner.remove();
            }
        });

        // Hide modal loading overlay
        this.hideModalLoadingOverlay();

        // Clear stored reference
        this.currentLoadingContentId = null;
    }

    showModalLoadingOverlay() {
        // Create or show modal loading overlay
        let overlay = document.getElementById('modalLoadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modalLoadingOverlay';
            overlay.className = 'modal-loading-overlay';
            overlay.innerHTML = `
                <div class="modal-loading-content">
                    <div class="spinner"></div>
                    <p>Carregando conteúdo...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    hideModalLoadingOverlay() {
        const overlay = document.getElementById('modalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showContentModal(content) {
        const contentId = content.id || content.content_id;
        const isCompleted = content.status === 'completed';
        const contentType = content.content_type || content.type || 'text';

        // Update modal elements (common for all types)
        document.getElementById('modalContentTitle').textContent = content.title;
        document.getElementById('modalContentCheckbox').checked = isCompleted;

        // Update description (common for all types)
        const descriptionElement = document.getElementById('modalContentDescription');
        if (content.description) {
            descriptionElement.innerHTML = `
                <h4>Descrição</h4>
                <p>${content.description}</p>
            `;
            descriptionElement.style.display = 'block';
        } else {
            descriptionElement.style.display = 'none';
        }

        // Update content body based on type (dynamic part)
        const contentBody = document.getElementById('modalContentBody');
        const renderedHtml = this.renderContentByType(content, contentType);
        console.log('Rendered HTML for modal:', renderedHtml.substring(0, 200) + '...');
        contentBody.innerHTML = renderedHtml;

        // Update toggle button (common for all types)
        const toggleButton = document.getElementById('modalToggleButton');
        toggleButton.textContent = isCompleted ? 'Desmarcar' : 'Marcar como Concluído';
        toggleButton.className = isCompleted ? 'btn-secondary' : 'btn-primary';

        // Store current content for modal actions
        this.currentModalContent = content;

        // Show modal
        document.getElementById('contentOverlay').style.display = 'flex';

        // Load document content if source_document_id exists
        // Use setTimeout to ensure DOM is rendered first
        if (content.source_document_id) {
            setTimeout(() => {
                this.loadDocumentContent(content);
            }, 100);
        }
    }

    /**
     * Renders content based on its type. This is the main method that makes the modal dynamic.
     * 
     * Expected content structure for each type:
     * 
     * TEXTUAL: { text_content: "markdown content" }
     * VIDEO: { video_url: "youtube/vimeo url", text_content: "optional notes" }
     * AUDIO: { audio_url: "audio file url", text_content: "optional transcript" }
     * INTERACTIVE: { interactive_url: "iframe url", text_content: "optional instructions" }
     * QUIZ: { quiz_data: { questions: [{ question: "text", options: ["a", "b"], correct: 0 }] } }
     * 
     * All types also have: id, title, description, type, status (common fields)
     */
    renderContentByType(content, contentType) {
        switch (contentType) {
            case 'text':
            case 'textual':
                return this.renderTextualContent(content);

            case 'video':
                return this.renderVideoContent(content);

            case 'image':
                return this.renderImageContent(content);

            case 'audio':
                return this.renderAudioContent(content);

            case 'interactive':
                return this.renderInteractiveContent(content);

            case 'quiz':
                return this.renderQuizContent(content);

            default:
                return this.renderTextualContent(content);
        }
    }

    renderTextualContent(content) {
        if (content.text_content) {
            return `
                <div class="textual-content">
                    ${this.markdownToHtml(content.text_content)}
                </div>
            `;
        } else {
            return '<p><em>Conteúdo em preparação...</em></p>';
        }
    }

    renderVideoContent(content) {
        const contentId = content.id || content.content_id;
        console.log('renderVideoContent - content ID:', contentId);
        
        // Check if content has a source document
        if (content.source_document_id) {
            const html = `
                <div class="video-content">
                    <div class="video-container" id="video-container-${contentId}">
                        <div class="loading-document">
                            <div class="spinner"></div>
                            <p>Carregando vídeo...</p>
                        </div>
                    </div>
                    ${content.text_content ? `
                        <div class="video-notes">
                            <h4>Anotações do Vídeo</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
            console.log('Generated video HTML with container ID:', `video-container-${contentId}`);
            return html;
        } else if (content.video_url) {
            return `
                <div class="video-content">
                    <div class="video-container">
                        <iframe 
                            src="${content.video_url}" 
                            frameborder="0" 
                            allowfullscreen
                            title="${content.title}">
                        </iframe>
                    </div>
                    ${content.text_content ? `
                        <div class="video-notes">
                            <h4>Anotações do Vídeo</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            return '<p><em>Vídeo em preparação...</em></p>';
        }
    }

    renderImageContent(content) {
        // Check if content has a source document
        if (content.source_document_id) {
            return `
                <div class="image-content">
                    <div class="image-container" id="image-container-${content.id}">
                        <div class="loading-document">
                            <div class="spinner"></div>
                            <p>Carregando imagem...</p>
                        </div>
                    </div>
                    ${content.text_content ? `
                        <div class="image-description">
                            <h4>Descrição da Imagem</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (content.image_url) {
            return `
                <div class="image-content">
                    <div class="image-container">
                        <img src="${content.image_url}" alt="${content.title}" style="max-width: 100%; height: auto;">
                    </div>
                    ${content.text_content ? `
                        <div class="image-description">
                            <h4>Descrição da Imagem</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            return '<p><em>Imagem em preparação...</em></p>';
        }
    }

    renderAudioContent(content) {
        if (content.audio_url) {
            return `
                <div class="audio-content">
                    <div class="audio-player">
                        <audio controls>
                            <source src="${content.audio_url}" type="audio/mpeg">
                            Seu navegador não suporta o elemento de áudio.
                        </audio>
                    </div>
                    ${content.text_content ? `
                        <div class="audio-transcript">
                            <h4>Transcrição</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            return '<p><em>Áudio em preparação...</em></p>';
        }
    }

    renderInteractiveContent(content) {
        if (content.interactive_url) {
            return `
                <div class="interactive-content">
                    <div class="interactive-container">
                        <iframe 
                            src="${content.interactive_url}" 
                            frameborder="0"
                            title="${content.title}">
                        </iframe>
                    </div>
                    ${content.text_content ? `
                        <div class="interactive-instructions">
                            <h4>Instruções</h4>
                            ${this.markdownToHtml(content.text_content)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            return '<p><em>Conteúdo interativo em preparação...</em></p>';
        }
    }

    renderQuizContent(content) {
        if (content.quiz_data) {
            try {
                const quizData = typeof content.quiz_data === 'string'
                    ? JSON.parse(content.quiz_data)
                    : content.quiz_data;

                return `
                    <div class="quiz-content">
                        <div class="quiz-container" id="quizContainer">
                            ${this.renderQuizQuestions(quizData)}
                        </div>
                        <div class="quiz-actions">
                            <button class="btn-primary" onclick="window.planoManager.submitQuiz()">
                                Enviar Respostas
                            </button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error parsing quiz data:', error);
                return '<p><em>Erro ao carregar quiz...</em></p>';
            }
        } else {
            return '<p><em>Quiz em preparação...</em></p>';
        }
    }

    renderQuizQuestions(quizData) {
        if (!quizData.questions || !Array.isArray(quizData.questions)) {
            return '<p><em>Nenhuma pergunta encontrada...</em></p>';
        }

        return quizData.questions.map((question, index) => `
            <div class="quiz-question" data-question-id="${index}">
                <h4 class="question-title">Pergunta ${index + 1}</h4>
                <p class="question-text">${question.question}</p>
                <div class="question-options">
                    ${question.options.map((option, optionIndex) => `
                        <label class="quiz-option">
                            <input 
                                type="radio" 
                                name="question_${index}" 
                                value="${optionIndex}"
                                data-question="${index}"
                            >
                            <span class="option-text">${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    submitQuiz() {
        const quizContainer = document.getElementById('quizContainer');
        const questions = quizContainer.querySelectorAll('.quiz-question');
        const answers = {};

        questions.forEach((questionEl, index) => {
            const selectedOption = questionEl.querySelector('input[type="radio"]:checked');
            if (selectedOption) {
                answers[index] = parseInt(selectedOption.value);
            }
        });

        // Here you would typically send the answers to the server
        console.log('Quiz answers:', answers);
        Utils.showNotification('Quiz enviado com sucesso!', 'success');

        // Auto-mark as completed when quiz is submitted
        if (this.currentModalContent && this.currentModalContent.status !== 'completed') {
            this.toggleContentFromModal();
        }
    }

    async toggleContentFromModal() {
        if (!this.currentModalContent) return;

        const contentId = this.currentModalContent.id || this.currentModalContent.content_id;
        const currentStatus = this.currentModalContent.status;

        // Toggle the content status
        await this.toggleContentStatus(contentId, currentStatus);

        // Update modal content status
        this.currentModalContent.status = currentStatus === 'completed' ? 'created' : 'completed';

        // Update modal UI
        const isCompleted = this.currentModalContent.status === 'completed';
        document.getElementById('modalContentCheckbox').checked = isCompleted;

        const toggleButton = document.getElementById('modalToggleButton');
        toggleButton.textContent = isCompleted ? 'Desmarcar' : 'Marcar como Concluído';
        toggleButton.className = isCompleted ? 'btn-secondary' : 'btn-primary';
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isWaitingForResponse) return;

        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.disableInput();
        this.showTyping();

        try {
            const response = await fetch(`/plan/${this.currentPlanId}/develop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    content: {
                        content_type: "text",
                        text: message
                    },
                    role: "user"
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao enviar mensagem');
            }

            const data = await response.json();
            console.log('Develop response:', data);

            this.hideTyping();

            const messageData = data.last_message?.content?.data;
            if (messageData) {
                this.addMessage(messageData.answer, 'ai');
                this.updatePlanInfo(messageData);
                this.updateModules(messageData.modules || [], messageData.ready_to_save || false);

                // Start polling if plan is ready to save (will trigger module generation)
                if (messageData.ready_to_save && !this.pollingInterval) {
                    this.currentStatus = data.status;
                    this.startPolling();
                }
            }

            this.enableInput();

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            this.hideTyping();
            this.addMessage('Desculpe, ocorreu um erro. Tente novamente.', 'ai');
            this.enableInput();
        }
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        // Convert markdown to HTML for AI messages
        if (type === 'ai') {
            messageDiv.innerHTML = this.markdownToHtml(text);
        } else {
            messageDiv.textContent = text;
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    markdownToHtml(text) {
        if (!text) return '';
        
        // Versão super simples - apenas quebras de linha e formatação básica
        return text
            .trim()
            // Escape HTML tags para evitar interpretação
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Converte quebras de linha duplas em parágrafos
            .split('\n\n')
            .map(paragraph => {
                if (!paragraph.trim()) return '';
                
                // Processa formatação básica dentro do parágrafo
                let processed = paragraph
                    // Headers
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    // Bold
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    // Italic
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    // Code inline
                    .replace(/`(.+?)`/g, '<code>$1</code>')
                    // Lists
                    .replace(/^\* (.+)$/gm, '<li>$1</li>')
                    .replace(/^- (.+)$/gm, '<li>$1</li>')
                    // Quebras de linha simples
                    .replace(/\n/g, '<br>');
                
                // Se tem li, envolve em ul
                if (processed.includes('<li>')) {
                    processed = '<ul>' + processed + '</ul>';
                }
                
                // Se não é header, lista ou código, envolve em p
                if (!processed.match(/^<(h[1-6]|ul|pre)/)) {
                    processed = '<p>' + processed + '</p>';
                }
                
                return processed;
            })
            .filter(p => p)
            .join('\n');
    }

    showTyping() {
        this.isWaitingForResponse = true;
        this.chatStatus.textContent = 'IA está pensando...';

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            IA está digitando...
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTyping() {
        this.isWaitingForResponse = false;
        this.chatStatus.textContent = 'Conversando com IA';

        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    enableInput() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.messageInput.focus();
    }

    disableInput() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updatePlanInfo(data) {
        if (data.title) {
            this.planTitle.textContent = data.title;
        }

        if (data.difficulty) {
            this.planDifficulty.textContent = `Nível: ${this.translateDifficulty(data.difficulty)}`;
        }
    }

    translateDifficulty(difficulty) {
        const translations = {
            'beginner': 'Iniciante',
            'intermediate': 'Intermediário',
            'advanced': 'Avançado'
        };
        return translations[difficulty] || difficulty;
    }

    updateModules(modules, readyToSave) {
        if (!modules || modules.length === 0) {
            this.emptyState.style.display = 'flex';
            this.canvasActions.style.display = 'none';
            return;
        }

        this.emptyState.style.display = 'none';
        this.canvasActions.style.display = 'flex';

        // Clear existing modules
        const existingGrid = this.modulesContainer.querySelector('.modules-grid');
        if (existingGrid) {
            existingGrid.remove();
        }

        // Create modules grid
        const modulesGrid = document.createElement('div');
        modulesGrid.className = 'modules-grid';

        modules.forEach((module, index) => {
            const moduleCard = this.createModuleCard(module, readyToSave, index);
            modulesGrid.appendChild(moduleCard);
        });

        this.modulesContainer.appendChild(modulesGrid);

        // Update finalize button
        this.finalizePlan.disabled = !readyToSave;

        if (readyToSave) {
            this.chatStatus.textContent = 'Plano criado com sucesso!';
        }
    }

    createModuleCard(module, readyToSave, index) {
        const card = document.createElement('div');
        card.className = 'module-card';
        card.style.animationDelay = `${index * 0.1}s`;

        const statusClass = readyToSave ? 'created' : 'draft';
        const statusText = readyToSave ? 'Criado' : 'Rascunho';

        card.innerHTML = `
            <div class="module-header">
                <h3 class="module-title">${module.title}</h3>
                <span class="module-status ${statusClass}">${statusText}</span>
            </div>
            <p class="module-description">${module.description}</p>
        `;

        return card;
    }

    showLoading(message) {
        const loadingContent = this.loadingOverlay.querySelector('.loading-content p');
        loadingContent.textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
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

    formatDate(dateString) {
        if (!dateString) return 'Recente';

        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    getModuleStatusInfo(status, progress, totalContents) {
        // Determine module status based on progress and status
        if (status === 'completed' || (progress > 0 && progress === totalContents)) {
            return { class: 'concluido', text: 'Concluído' };
        } else if (progress > 0) {
            return { class: 'andamento', text: 'Em Andamento' };
        } else {
            return { class: 'nao-iniciado', text: 'Não Iniciado' };
        }
    }

    getContentTypeInfo(type) {
        // Map content types to display info - handle both frontend and backend naming
        const typeMapping = {
            // Backend types
            'text': { class: 'textual', icon: '📄', text: 'Textual' },
            'video': { class: 'video', icon: '🎥', text: 'Vídeo' },
            'image': { class: 'image', icon: '🖼️', text: 'Imagem' },
            'audio': { class: 'audio', icon: '🎵', text: 'Áudio' },
            
            // Frontend types (for compatibility)
            'textual': { class: 'textual', icon: '📄', text: 'Textual' },
            'interactive': { class: 'interactive', icon: '🎮', text: 'Interativo' },
            'quiz': { class: 'quiz', icon: '❓', text: 'Quiz' }
        };


        return typeMapping[type] || typeMapping['text'];
    }

    async loadDocumentContent(content) {
        try {
            const contentType = content.content_type || content.type || 'text';
            const contentId = content.id || content.content_id;
            
            // Get the knowledge base ID from the backend configuration
            const knowledgeBaseId = await this.getKnowledgeBaseId();
            
            if (!knowledgeBaseId) {
                throw new Error('Knowledge Base ID não configurado');
            }

            const response = await fetch(`/knowledge_base/${knowledgeBaseId}/documents/${content.source_document_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro ao carregar documento: ${response.status} ${response.statusText}`);
            }

            const document = await response.json();
            console.log('Document loaded:', document.name, document.document_type, document.document_extension);

            // Convert bytes to base64
            const base64Data = this.bytesToBase64(document.data);
            console.log('Base64 data ready, length:', base64Data ? base64Data.length : 'null');
            
            // Update the content based on type
            if (contentType === 'video') {
                console.log('Displaying video document');
                this.displayVideoDocument(contentId, base64Data, document.document_extension);
            } else if (contentType === 'image') {
                console.log('Displaying image document');
                this.displayImageDocument(contentId, base64Data, document.document_extension);
            }

        } catch (error) {
            console.error('Error loading document:', error);
            
            // Show error message in the container
            const contentType = content.content_type || content.type || 'text';
            const contentId = content.id || content.content_id;
            const container = document.getElementById(`${contentType}-container-${contentId}`);
            if (container) {
                container.innerHTML = `
                    <div class="document-error">
                        <p>❌ Erro ao carregar ${contentType === 'video' ? 'vídeo' : 'imagem'}</p>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
    }

    async getKnowledgeBaseId() {
        // First try to get from a cached value
        if (this.knowledgeBaseId) {
            return this.knowledgeBaseId;
        }

        try {
            // Get the knowledge base ID from the backend configuration
            const response = await fetch('/ui/config', {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar configuração');
            }

            const config = await response.json();
            
            if (!config.knowledge_base_id) {
                throw new Error('Knowledge Base ID não configurado no backend');
            }

            // Cache the ID for future use
            this.knowledgeBaseId = config.knowledge_base_id;
            return this.knowledgeBaseId;

        } catch (error) {
            console.error('Error getting knowledge base ID:', error);
            return null;
        }
    }

    bytesToBase64(data) {
        console.log('bytesToBase64 input:', typeof data, data ? data.length || 'no length' : 'null/undefined');
        
        // Since the backend now returns base64 directly, just return the data
        if (typeof data === 'string') {
            // Validate base64 format
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (base64Regex.test(data)) {
                console.log('Valid base64 string detected');
                return data;
            } else {
                console.warn('String does not appear to be valid base64');
                return data;
            }
        }
        
        // If it's an object with data property
        if (data && data.data) {
            console.log('Found data.data property');
            return this.bytesToBase64(data.data);
        }
        
        console.warn('Expected base64 string from backend, got:', typeof data);
        return data;
    }

    displayVideoDocument(contentId, base64Data, extension) {
        const container = document.getElementById(`video-container-${contentId}`);
        
        if (container) {
            const mimeType = this.getMimeType('video', extension);
            
            const videoHtml = `
                <video controls 
                       style="width: 100%; height: auto; max-height: 400px; background: #000;" 
                       preload="metadata"
                       onloadstart="console.log('Video load started')" 
                       oncanplay="console.log('Video can play')" 
                       onerror="console.error('Video error:', event)"
                       onloadedmetadata="console.log('Video metadata loaded, duration:', this.duration)">
                    <source src="data:${mimeType};base64,${base64Data}" type="${mimeType}">
                    Seu navegador não suporta o elemento de vídeo.
                </video>
            `;
            
            container.innerHTML = videoHtml;
            
            // Add event listeners to the video element
            const videoElement = container.querySelector('video');
            if (videoElement) {
                videoElement.addEventListener('loadstart', () => console.log('✅ Video started loading'));
                videoElement.addEventListener('canplay', () => console.log('✅ Video ready to play'));
                videoElement.addEventListener('error', (e) => console.error('❌ Video error:', e));
                videoElement.addEventListener('loadedmetadata', () => {
                    console.log('✅ Video metadata loaded - Duration:', videoElement.duration, 'seconds');
                });
            }
        } else {
            console.error('Video container not found with ID:', `video-container-${contentId}`);
        }
    }

    displayImageDocument(contentId, base64Data, extension) {
        const container = document.getElementById(`image-container-${contentId}`);
        if (container) {
            const mimeType = this.getMimeType('image', extension);
            container.innerHTML = `
                <img src="data:${mimeType};base64,${base64Data}" 
                     alt="${this.currentModalContent?.title || 'Imagem'}" 
                     style="max-width: 100%; height: auto; border-radius: 0.5rem;">
            `;
        }
    }

    getMimeType(type, extension) {
        const mimeTypes = {
            video: {
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'ogg': 'video/ogg',
                'avi': 'video/avi',
                'mov': 'video/quicktime'
            },
            image: {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp'
            }
        };

        const ext = extension.toLowerCase();
        const mimeType = mimeTypes[type]?.[ext] || `${type}/${ext}`;
        
        console.log(`getMimeType: ${type} + ${extension} = ${mimeType}`);
        return mimeType;
    }

    // Helper method for testing different content types (can be removed in production)
    testContentModal(type = 'textual') {
        const testContent = {
            id: 'test-content',
            title: `Conteúdo de Teste - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            description: `Este é um exemplo de conteúdo do tipo ${type} para demonstrar como o modal se adapta a diferentes tipos.`,
            type: type,
            status: 'created'
        };

        switch (type) {
            case 'textual':
                testContent.text_content = `# Conteúdo Textual de Exemplo

Este é um exemplo de **conteúdo textual** que pode incluir:

- Texto formatado em markdown
- **Negrito** e *itálico*
- Listas numeradas e com marcadores
- \`Código inline\`

## Seção de Exemplo

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Subseção

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`;
                break;

            case 'video':
                testContent.video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
                testContent.text_content = `## Anotações do Vídeo

- Ponto importante 1
- Ponto importante 2
- Resumo dos conceitos principais`;
                break;

            case 'audio':
                testContent.audio_url = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
                testContent.text_content = `## Transcrição do Áudio

Esta é a transcrição do conteúdo de áudio, incluindo os pontos principais discutidos.`;
                break;

            case 'interactive':
                testContent.interactive_url = 'https://codepen.io/pen/';
                testContent.text_content = `## Instruções

1. Interaja com o conteúdo
2. Complete os exercícios
3. Teste suas respostas`;
                break;

            case 'quiz':
                testContent.quiz_data = {
                    questions: [
                        {
                            question: "Qual é a capital do Brasil?",
                            options: ["São Paulo", "Rio de Janeiro", "Brasília", "Belo Horizonte"],
                            correct: 2
                        },
                        {
                            question: "Quantos estados tem o Brasil?",
                            options: ["25", "26", "27", "28"],
                            correct: 1
                        }
                    ]
                };
                break;
        }

        this.showContentModal(testContent);
    }
}

// Global functions
function goBack() {
    if (window.planoManager.currentMode === 'study') {
        // Restore footer
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.style.display = 'block';
        }

        window.location.href = '/ui/painel';
    } else if (confirm('Tem certeza que deseja sair? O progresso atual será perdido.')) {
        window.location.href = '/ui/painel';
    }
}

function finalizePlan() {
    Utils.showNotification('Plano finalizado com sucesso!', 'success');
    setTimeout(() => {
        window.location.href = '/ui/painel';
    }, 1500);
}

function togglePlanMenu() {
    const dropdown = document.getElementById('planDropdown');
    dropdown.classList.toggle('show');
}

function viewChatHistory() {
    // Close dropdown first
    document.getElementById('planDropdown').classList.remove('show');

    const overlay = document.getElementById('chatOverlay');
    overlay.style.display = 'block';
}

function deletePlan() {
    // Placeholder for future implementation
    Utils.showNotification('Funcionalidade em desenvolvimento', 'info');
}

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('planDropdown');
    const toggle = document.querySelector('.dropdown-toggle');

    if (dropdown && !dropdown.contains(event.target) && !toggle.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

function closeChatHistory() {
    const overlay = document.getElementById('chatOverlay');
    overlay.style.display = 'none';
}

function closeContentModal() {
    const overlay = document.getElementById('contentOverlay');
    overlay.style.display = 'none';

    // Clear current modal content and loading states
    if (window.planoManager) {
        window.planoManager.currentModalContent = null;
        window.planoManager.clearAllLoadingStates();
    }
}

function toggleContentFromModal() {
    if (window.planoManager) {
        window.planoManager.toggleContentFromModal();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Plano page loaded');

    // Check authentication
    const token = localStorage.getItem('authToken');
    console.log('Auth token:', token ? 'exists' : 'missing');

    if (!token) {
        console.log('No token, redirecting to login');
        window.location.href = '/ui/login';
        return;
    }

    console.log('Initializing PlanoManager');
    window.planoManager = new PlanoManager();
});

// Cleanup polling when leaving page
window.addEventListener('beforeunload', () => {
    if (window.planoManager) {
        window.planoManager.stopPolling();
    }
});

/*
COMO TESTAR O SISTEMA DINÂMICO DE CONTEÚDO:

No console do navegador, você pode testar os diferentes tipos de conteúdo:

// Testar conteúdo textual
window.planoManager.testContentModal('textual');

// Testar conteúdo de vídeo
window.planoManager.testContentModal('video');

// Testar conteúdo de áudio
window.planoManager.testContentModal('audio');

// Testar conteúdo interativo
window.planoManager.testContentModal('interactive');

// Testar quiz
window.planoManager.testContentModal('quiz');

ESTRUTURA DE DADOS ESPERADA DO BACKEND:

Para cada tipo de conteúdo, o backend deve retornar:

CAMPOS COMUNS (todos os tipos):
- id: string
- title: string
- description: string (opcional)
- type: 'textual' | 'video' | 'audio' | 'interactive' | 'quiz'
- status: 'created' | 'completed'

CAMPOS ESPECÍFICOS POR TIPO:

TEXTUAL:
- text_content: string (markdown)

VIDEO:
- video_url: string (YouTube, Vimeo, etc.)
- text_content: string (opcional, para anotações)

AUDIO:
- audio_url: string (arquivo de áudio)
- text_content: string (opcional, para transcrição)

INTERACTIVE:
- interactive_url: string (URL para iframe)
- text_content: string (opcional, para instruções)

QUIZ:
- quiz_data: {
    questions: [
      {
        question: string,
        options: string[],
        correct: number (índice da resposta correta)
      }
    ]
  }
*/