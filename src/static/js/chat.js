// Chat functionality
class ChatInterface {
    constructor() {
        this.messages = [];
        this.currentChatId = null;
        this.isLoading = false;
        this.init();
    }
    
    init() {
        // Check authentication first
        if (!this.checkAuth()) {
            return;
        }
        
        this.setupEventListeners();
        this.loadChatHistory();
        this.focusInput();
    }
    
    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            Utils.showNotification('Você precisa fazer login para acessar o chat', 'warning');
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
        const input = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        
        // Auto-resize textarea
        input.addEventListener('input', () => {
            this.autoResizeTextarea(input);
            this.toggleSendButton();
        });
        
        // Enable/disable send button
        input.addEventListener('keyup', () => {
            this.toggleSendButton();
        });
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    toggleSendButton() {
        const input = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const hasText = input.value.trim().length > 0;
        
        sendButton.disabled = !hasText || this.isLoading;
    }
    
    focusInput() {
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 100);
    }
    
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || this.isLoading) return;
        
        // Clear input and reset height
        input.value = '';
        input.style.height = 'auto';
        this.toggleSendButton();
        
        // Add user message to chat
        this.addMessage('user', message);
        
        // Show loading
        this.showLoading();
        
        try {
            // Send to backend
            const response = await this.sendToAPI(message);
            
            // Hide loading
            this.hideLoading();
            
            // Add assistant response
            this.addMessage('assistant', response.message, response.content);
            
        } catch (error) {
            this.hideLoading();
            this.addMessage('assistant', 'Desculpe, ocorreu um erro. Tente novamente.');
            Utils.showNotification('Erro ao enviar mensagem', 'error');
        }
    }
    
    async sendToAPI(message) {
        // Simular API call por enquanto
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    message: this.generateMockResponse(message),
                    content: this.generateMockContent()
                });
            }, 1500);
        });
        
        // Implementação real da API:
        /*
        return await Utils.fetchAPI('/chat/message', {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                chat_id: this.currentChatId
            })
        });
        */
    }
    
    generateMockResponse(userMessage) {
        const responses = [
            "Entendi! Vou te ajudar com isso. Baseado no que você disse, identifiquei algumas áreas onde podemos focar.",
            "Ótima pergunta! Vou criar um conteúdo personalizado para você sobre esse tópico.",
            "Vejo que você tem interesse nessa área. Que tal começarmos com alguns conceitos fundamentais?",
            "Perfeito! Vou adaptar o conteúdo ao seu nível de conhecimento."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    generateMockContent() {
        const contentTypes = ['video', 'text', 'audio'];
        const randomType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
        
        return {
            type: randomType,
            title: "Conteúdo Personalizado",
            description: "Material adaptado ao seu nível de conhecimento"
        };
    }
    
    addMessage(sender, text, content = null) {
        const messagesContainer = document.getElementById('chatMessages');
        
        // Remove welcome message if it exists
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? 'U' : 'A';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = text;
        
        // Add content suggestions if provided
        if (content) {
            const contentSuggestion = this.createContentSuggestion(content);
            messageContent.appendChild(contentSuggestion);
        }
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageElement.appendChild(avatar);
        messageElement.appendChild(messageContent);
        messageElement.appendChild(messageTime);
        
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Store message
        this.messages.push({
            sender,
            text,
            content,
            timestamp: new Date()
        });
    }
    
    createContentSuggestion(content) {
        const suggestion = document.createElement('div');
        suggestion.className = 'content-suggestion';
        
        const title = document.createElement('h4');
        title.textContent = content.title;
        
        const description = document.createElement('p');
        description.textContent = content.description;
        
        const actions = document.createElement('div');
        actions.className = 'content-actions';
        
        const viewBtn = document.createElement('button');
        viewBtn.className = 'content-btn';
        viewBtn.textContent = `Ver ${content.type === 'video' ? 'Vídeo' : content.type === 'audio' ? 'Áudio' : 'Texto'}`;
        viewBtn.onclick = () => this.viewContent(content);
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'content-btn';
        saveBtn.textContent = 'Salvar';
        saveBtn.onclick = () => this.saveContent(content);
        
        actions.appendChild(viewBtn);
        actions.appendChild(saveBtn);
        
        suggestion.appendChild(title);
        suggestion.appendChild(description);
        suggestion.appendChild(actions);
        
        return suggestion;
    }
    
    viewContent(content) {
        Utils.showNotification(`Abrindo conteúdo: ${content.title}`, 'info');
        // Implementar visualização do conteúdo
    }
    
    saveContent(content) {
        Utils.showNotification('Conteúdo salvo com sucesso!', 'success');
        // Implementar salvamento do conteúdo
    }
    
    showLoading() {
        this.isLoading = true;
        document.getElementById('loadingIndicator').style.display = 'block';
        this.toggleSendButton();
    }
    
    hideLoading() {
        this.isLoading = false;
        document.getElementById('loadingIndicator').style.display = 'none';
        this.toggleSendButton();
    }
    
    loadChatHistory() {
        // Implementar carregamento do histórico
        const historyContainer = document.querySelector('.chat-history');
        historyContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 1rem;">Nenhuma conversa anterior</p>';
    }
}

// Global functions for template
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function sendMessage() {
    if (window.chatInterface) {
        window.chatInterface.sendMessage();
    }
}

function selectTopic(topic) {
    const input = document.getElementById('chatInput');
    input.value = `Gostaria de aprender sobre ${topic}`;
    input.focus();
    window.chatInterface.autoResizeTextarea(input);
    window.chatInterface.toggleSendButton();
}

function startNewChat() {
    if (window.chatInterface) {
        window.chatInterface.messages = [];
        window.chatInterface.currentChatId = null;
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>Olá! 👋</h2>
                    <p>Sou seu assistente de aprendizagem adaptativa. Vou te ajudar a identificar suas dificuldades e criar conteúdo personalizado para você.</p>
                    <p>Para começar, me conte: <strong>qual área da programação você gostaria de estudar hoje?</strong></p>
                    <div class="quick-topics">
                        <button class="topic-btn" onclick="selectTopic('Python Básico')">Python Básico</button>
                        <button class="topic-btn" onclick="selectTopic('JavaScript')">JavaScript</button>
                        <button class="topic-btn" onclick="selectTopic('Estruturas de Dados')">Estruturas de Dados</button>
                        <button class="topic-btn" onclick="selectTopic('Algoritmos')">Algoritmos</button>
                    </div>
                </div>
            </div>
        `;
        
        Utils.showNotification('Nova conversa iniciada', 'success');
    }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});