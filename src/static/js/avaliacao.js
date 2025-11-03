// Avaliação Initial Assessment
class AvaliacaoManager {
    constructor() {
        this.isAssessmentStarted = false;
        this.isLoading = false;
        this.chatId = null;
        this.init();
    }
    
    init() {
        // Check authentication
        if (!this.checkAuth()) {
            return;
        }
        
        // Load existing chat_id if available
        this.chatId = localStorage.getItem('assessmentChatId');
        
        // Setup scroll observer
        this.setupScrollObserver();
        
        // Start assessment automatically
        this.startAssessment();
    }
    
    setupScrollObserver() {
        const messagesContainer = document.getElementById('messagesContainer');
        
        // Create a MutationObserver to watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // New message added, scroll to bottom
                    setTimeout(() => {
                        this.scrollToBottom();
                    }, 100);
                }
            });
        });
        
        // Start observing
        observer.observe(messagesContainer, {
            childList: true,
            subtree: true
        });
    }
    
    checkAuth() {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            Utils.showNotification('Você precisa fazer login para acessar a avaliação', 'warning');
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
    
    async startAssessment() {
        if (this.isAssessmentStarted) return;
        
        this.isAssessmentStarted = true;
        
        // Remove initial loading
        const initialLoading = document.querySelector('.initial-loading');
        if (initialLoading) {
            initialLoading.remove();
        }
        

        
        try {
            const token = localStorage.getItem('authToken');
            
            const response = await Utils.fetchAPI('/user/start_profile_assessment', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Store chat_id for future messages
            if (response.chat_id) {
                this.chatId = response.chat_id;
                localStorage.setItem('assessmentChatId', this.chatId);
                console.log('Stored chat_id:', this.chatId);
            }
            
            // Extract just the text content from the response
            console.log('Start assessment response:', response);
            let messageText = this.extractMessageText(response);
            
            this.addAssistantMessage(messageText);
            
            // Use progress from response if available, otherwise start at 5%
            const initialProgress = this.getProgressFromResponse(response) || 5;
            this.updateProgress(initialProgress);
            
            // Ensure scroll works from the start
            setTimeout(() => {
                this.scrollToBottom();
            }, 300);
            
        } catch (error) {
            console.error('Error starting assessment:', error);
            
            // Show error message in chat
            this.addAssistantMessage('Desculpe, ocorreu um erro ao iniciar a avaliação. Vou tentar novamente...');
            
            // Try again after 2 seconds
            setTimeout(() => {
                this.isAssessmentStarted = false;
                this.startAssessment();
            }, 2000);
        }
    }
    
    async sendUserResponse(message) {
        if (this.isLoading) return;
        
        // Add user message to chat
        this.addUserMessage(message);
        this.setLoading(true);
        
        try {
            const token = localStorage.getItem('authToken');
            
            // Get stored chat_id or use current one
            const chatId = this.chatId || localStorage.getItem('assessmentChatId');
            
            // Create payload exactly like Bruno's working example
            const payload = {
                content: {
                    content_type: 'text',
                    text: message
                },
                role: 'user',
                chat_id: chatId
            };
            
            // Also try a minimal version for comparison
            const minimalPayload = {
                role: 'user',
                content: {
                    content_type: 'text',
                    text: message
                }
            };
            
            // Send the message
            
            let response;
            let fetchResponse;
            
            try {
                // Try with chat_id first
                fetchResponse = await fetch('/user/continue_profile_assessment', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!fetchResponse.ok) {
                    throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                }
                
                response = await fetchResponse.json();
                
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                throw fetchError;
            }
            
            this.setLoading(false);
            
            console.log('Continue assessment response:', response);
            
            // Check if assessment is complete - look for finished flag
            if (response.content.content_type === 'dict' && 
                response.content.data && 
                response.content.data.finished === true) {
                // Assessment completed
                console.log('Assessment marked as finished by AI');
                this.handleAssessmentComplete(response.content.data);
            } else {
                // Continue assessment - extract clean text
                const messageText = this.extractMessageText(response);
                this.addAssistantMessage(messageText);
                this.updateProgress(Math.min(90, this.getProgressFromResponse(response)));
                
                // Force scroll after AI response
                setTimeout(() => {
                    this.scrollToBottom();
                }, 200);
            }
            
        } catch (error) {
            console.error('Error sending response:', error);
            this.setLoading(false);
            
            // Log the specific error for debugging
            console.error('Failed to send message. Error details:', error);
            
            if (error.message.includes('422')) {
                console.log('422 Unprocessable Entity - payload validation failed');
                console.log('Current chat_id:', this.chatId);
                console.log('Payload that failed:', JSON.stringify({
                    role: 'user',
                    chat_id: this.chatId || localStorage.getItem('assessmentChatId'),
                    content: {
                        content_type: 'text',
                        text: message
                    }
                }, null, 2));
            }
            
            this.addAssistantMessage('Desculpe, ocorreu um erro. Pode repetir sua resposta?');
        }
    }
    
    addUserMessage(text) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.innerHTML = `
            <div class="message-avatar user-avatar">U</div>
            <div class="message-content">
                <p>${text}</p>
            </div>
        `;
        
        messagesContainer.appendChild(userMessage);
        
        // Ensure scroll happens after DOM update
        setTimeout(() => {
            this.scrollToBottom();
        }, 50);
    }
    
    addAssistantMessage(content) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        const assistantMessage = document.createElement('div');
        assistantMessage.className = 'message assistant';
        
        let messageContent = '';
        if (typeof content === 'string') {
            messageContent = `<p>${content}</p>`;
        } else if (content && content.question && content.options) {
            // Structured response with options
            messageContent = `
                <p><strong>${content.question}</strong></p>
                <div class="options-container">
                    ${content.options.map(option => 
                        `<button class="option-btn" onclick="window.avaliacaoManager.selectOption('${option}')">
                            ${option}
                        </button>`
                    ).join('')}
                </div>
            `;
        } else if (typeof content === 'object') {
            messageContent = `<p>${JSON.stringify(content, null, 2)}</p>`;
        } else {
            messageContent = `<p>Resposta recebida</p>`;
        }
        
        assistantMessage.innerHTML = `
            <div class="message-avatar assistant-avatar">IA</div>
            <div class="message-content">
                ${messageContent}
            </div>
        `;
        
        messagesContainer.appendChild(assistantMessage);
        
        // Ensure scroll happens after DOM update and animations
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }
    
    selectOption(option) {
        // Disable all option buttons
        const options = document.querySelectorAll('.option-btn');
        options.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent.trim() === option) {
                btn.classList.add('selected');
            }
        });
        
        // Scroll to show the selection
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
        
        // Send the selected option as user response
        setTimeout(() => {
            this.sendUserResponse(option);
        }, 500);
    }
    
    handleAssessmentComplete(data) {
        // Save assessment data
        const profileData = data.profile_data || data;
        localStorage.setItem('userAssessment', JSON.stringify(profileData));
        
        // Add completion message - use the AI's message if available
        let completionMessage = 'Perfeito! Sua avaliação foi concluída. Agora posso criar conteúdos personalizados para você.';
        if (data.answer) {
            completionMessage = data.answer;
        }
        
        this.addAssistantMessage(completionMessage);
        
        // Update progress to 100%
        this.updateProgress(100);
        
        // Show finish button
        document.getElementById('finishBtn').style.display = 'block';
        
        Utils.showNotification('Avaliação concluída com sucesso!', 'success');
    }
    
    getProgressFromResponse(response) {
        // Use progress from agent if available
        if (response.content && 
            response.content.data && 
            typeof response.content.data.progress === 'number') {
            return response.content.data.progress;
        }
        
        // Fallback: calculate based on interactions
        const userMessages = document.querySelectorAll('.message.user').length;
        return Math.min(90, userMessages * 15); // 15% per interaction, max 90%
    }
    
    scrollToBottom() {
        // Use the chat container as the scroll target (it's the one with overflow-y: auto)
        const chatContainer = document.querySelector('.avaliacao-chat');
        
        if (!chatContainer) {
            return;
        }
        
        // Multiple approaches to ensure scroll works reliably
        const scrollToEnd = () => {
            const scrollHeight = chatContainer.scrollHeight;
            
            // Always try to scroll to bottom
            chatContainer.scrollTop = scrollHeight;
            
            // Also try smooth scroll as backup
            if (chatContainer.scrollTo) {
                chatContainer.scrollTo({
                    top: scrollHeight,
                    behavior: 'smooth'
                });
            }
        };
        
        // Use requestAnimationFrame for better timing with DOM updates
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scrollToEnd();
                
                // Additional fallback to ensure scroll happens
                setTimeout(scrollToEnd, 150);
            });
        });
    }
    
    setLoading(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            // Add loading message
            const messagesContainer = document.getElementById('messagesContainer');
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'message assistant loading-message';
            loadingMessage.innerHTML = `
                <div class="message-avatar assistant-avatar">🤖</div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(loadingMessage);
            
            // Scroll after adding loading message
            setTimeout(() => {
                this.scrollToBottom();
            }, 50);
        } else {
            // Remove loading message
            const loadingMessage = document.querySelector('.loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
    }
    
    extractMessageText(response) {
        // Try to extract clean text from various response formats
        if (response.content && response.content.text) {
            return response.content.text;
        }
        
        if (response.content && response.content.data) {
            const data = response.content.data;
            
            // If it's a string, return it
            if (typeof data === 'string') {
                return data;
            }
            
            // If it's an object, try to find text fields
            if (typeof data === 'object') {
                // Common text fields to look for
                const textFields = ['answer', 'question', 'message', 'text', 'content', 'response'];
                
                for (const field of textFields) {
                    if (data[field] && typeof data[field] === 'string') {
                        return data[field];
                    }
                }
                
                // If no text field found, try to stringify nicely
                if (data.question && data.options) {
                    return data.question; // For structured questions
                }
                
                return 'Continue respondendo as perguntas...';
            }
        }
        
        return 'Vamos continuar sua avaliação!';
    }
    
    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // Round to avoid decimals
        const roundedPercentage = Math.round(percentage);
        
        progressFill.style.width = `${roundedPercentage}%`;
        
        if (roundedPercentage < 100) {
            progressText.textContent = `${roundedPercentage}%`;
        } else {
            progressText.textContent = 'Concluída!';
        }
    }
    
    skipAssessment() {
        // Show custom modal instead of browser confirm
        document.getElementById('skipModal').style.display = 'flex';
    }
    
    confirmSkip() {
        // Close modal
        document.getElementById('skipModal').style.display = 'none';
        
        // Set default profile data
        const defaultProfile = {
            nivel: 'basico',
            formato: 'texto',
            objetivo: 'melhorar'
        };
        
        localStorage.setItem('userAssessment', JSON.stringify(defaultProfile));
        this.finishAssessment();
    }
    
    closeSkipModal() {
        document.getElementById('skipModal').style.display = 'none';
    }
    
    finishAssessment() {
        // Clear assessment chat_id
        localStorage.removeItem('assessmentChatId');
        this.chatId = null;
        
        Utils.showNotification('Perfil criado com sucesso!', 'success');
        
        // Redirect to painel
        setTimeout(() => {
            window.location.href = '/ui/painel';
        }, 1500);
    }
}

// Global functions
function selectOption(option) {
    if (window.avaliacaoManager) {
        window.avaliacaoManager.selectOption(option);
    }
}

function sendResponse() {
    const input = document.getElementById('avaliacaoInput');
    const message = input.value.trim();
    
    if (message && window.avaliacaoManager) {
        input.value = '';
        toggleSendButton();
        window.avaliacaoManager.sendUserResponse(message);
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendResponse();
    }
    
    // Auto-resize textarea
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    
    // Toggle send button
    toggleSendButton();
}

function toggleSendButton() {
    const input = document.getElementById('avaliacaoInput');
    const sendBtn = document.getElementById('sendBtn');
    const hasText = input.value.trim().length > 0;
    
    sendBtn.disabled = !hasText;
}

function skipAssessment() {
    if (window.avaliacaoManager) {
        window.avaliacaoManager.skipAssessment();
    }
}

function confirmSkip() {
    if (window.avaliacaoManager) {
        window.avaliacaoManager.confirmSkip();
    }
}

function closeSkipModal() {
    if (window.avaliacaoManager) {
        window.avaliacaoManager.closeSkipModal();
    }
}

function finishAssessment() {
    if (window.avaliacaoManager) {
        window.avaliacaoManager.finishAssessment();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.avaliacaoManager = new AvaliacaoManager();
});