# +A Educação - Engenheiro de Inteligência Artificial

## Decisão da Arquitetura Utilizada

### Arquitetura Geral

1. **Backend**: FastAPI como framework principal
2. **Banco de Dados**: PostgreSQL + pgvector para dados relacionais e vector store
3. **IA Generativa**: Utilizado AWS Bedrock para realizar chamadas para LLMs
4. **RAG Personalizado**: Sistema próprio de indexação para processamento multimodal
5. **Frontend**: HTML/CSS/JS vanilla - desenvolvido como protótipo e implementado **completamente através IA**.

### Sistema RAG Multimodal
Foi implementado um sistema RAG completo que processa diferentes tipos de conteúdo:

- **Textos (.txt, .json)**: Processamento direto com chunking inteligente
- **Imagens (.png, .jpg)**: OCR via AWS Bedrock para extrair texto ou descrever conteúdo
- **PDFs**: Extração de texto + OCR para imagens presentes
- **Vídeos (.mp4)**: Transcrição automática com OpenAI Whisper em português

**Pipeline de Indexação:**
1. Upload → Extração de conteúdo → Chunking → Embedding (Cohere v4) → Armazenamento vetorial

### Agentes Especializados
Sistema de agentes com prompts otimizados para tarefas específicas:

- **Profile Assessment Agent**: Avalia perfil de aprendizagem através de conversação natural
- **Plan Outline Creator**: Gera estruturas de planos baseadas no perfil do usuário
- **Module Outline Creator**: Detalha módulos específicos com objetivos e conteúdos
- **Text Content Creator**: Produz conteúdo adaptativo usando contexto RAG

Para a geração de **vídeos** e **imagens**, é realizado uma busca no banco de dados vetorial e o resultado é retornado como o conteúdo.

## Requisitos Obrigatórios Entregues

### Etapa 1: Indexação dos Dados

**Sistema RAG Completo Implementado:**
- Indexação de textos com busca por palavras-chave e frases relevantes
- Processamento de PDFs com extração de texto e metadados
- Transcrição de vídeos MP4 usando OpenAI Whisper
- OCR de imagens (PNG/JPG) via AWS Bedrock
- Armazenamento vetorial com PostgreSQL + pgvector para busca eficiente

**Tipos de dados suportados:**
- Textos (.txt, .json)¹
- PDFs com extração completa de conteúdo
- Vídeos (.mp4) com transcrição automática
- Imagens (.png, .jpg) com OCR e descrição

*¹: Mais detalhes sobre o JSON são discutidos na seção de Melhorias.*

### Etapa 2: Prompt de Aprendizagem Adaptativa

**Assessment de Perfil Implementado:**
- Sistema de avaliação durante criação da conta ou quando usuário decide refazer
- Identificação de dificuldades e lacunas de conhecimento através de perguntas direcionadas
- Detecção de preferências de formato de aprendizado (texto, vídeo, áudio)
- Criação de perfil personalizado armazenado no banco de dados

**Geração de Conteúdo Dinâmico:**
- Conteúdos textuais adaptativos baseados no perfil do usuário
- Recomendações de vídeos relevantes da base de conhecimento
- Sugestões de materiais complementares (PDFs, textos)
- Personalização completa baseada nas preferências identificadas

## O que Melhoraria se Tivesse Mais Tempo

### 1. Melhorias no Sistema RAG
- **Chunking Inteligente para JSONs**: Atualmente existe problema com a separação de chunks em arquivos JSON, resultando em similaridade muito alta para todos os casos. Por isso optei por remover alguns arquivos JSON do processamento.
- **Estratégias de Chunking Específicas**: Implementar diferentes estratégias de divisão baseadas no tipo de conteúdo (código, texto corrido, listas, etc.).

### 2. Evolução do Sistema de Perfil
- **Agente de Feedback Pós-Plano**: Inserção de um novo agente capaz de coletar informações depois de um plano ter sido criado, para atualizar automaticamente o perfil do usuário.
- **Histórico de Aprendizagem**: Levar em consideração planos já concluídos do usuário para construção mais precisa do seu perfil de aprendizagem.

### 3. Geração de Conteúdo Multimodal
- **Síntese de Voz**: Realizar a geração de conteúdos de áudio através de sintetização do texto (AWS Polly/OpenAI Text-To-Speech/ElevenLabs).
- **Geração de Imagens**: Criar imagens explicativas e diagramas usando modelos generativos.
- **Geração de Vídeos**: Produzir vídeos educacionais ao invés de apenas sugestões por RAG.

### 4. Correções Técnicas
- **Encoding de Caracteres**: Corrigir a formatação errada de textos com acentos do modelo (às vezes retorna unicode malformado).
- **Validação de Saída**: Implementar pós-processamento para garantir formatação correta dos textos gerados.

### 5. Novos Tipos de Conteúdo
- **Sistema de Quiz**: Introduzir tipo de conteúdo em formato de quiz interativo com correção automática.
- **Exercícios Práticos**: Implementar exercícios de programação com validação automática de código.

### 6. Analytics e Monitoramento
- **Dashboard de Usuário**: Estatísticas de quantos planos foram concluídos, tempo médio de conclusão, progresso por tópico.
- **Painel Administrativo**: Visualização de tópicos mais criados pelos alunos, identificação de lacunas no conteúdo, métricas de engajamento.

### 7. Melhorias de Infraestrutura
- **Cache Inteligente**: Implementar Redis para cache de embeddings e respostas frequentes.
- **Processamento Assíncrono**: Queue system para processamento de documentos grandes sem bloquear a interface.

### 8. Experiência do Usuário
- **Gamificação**: Sistema de pontos, badges e rankings para aumentar engajamento.
- **Colaboração**: Possibilidade de compartilhar planos e criar grupos de estudo.

## Inicialização do Projeto

### Pré-requisitos
- Python 3.11+
- PostgreSQL com extensão pgvector
- AWS Account com acesso ao Bedrock

### Passos para Setup

#### 1. Configuração do Banco de Dados
Execute os seguintes scripts SQL no PostgreSQL:

```sql
-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Executar script de criação das tabelas
-- Copie e cole o conteúdo do arquivo: setup/setup_db.sql
```

#### 2. Instalar Dependências Python
```bash
pip install -r requirements.txt
```

#### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Database Configuration
SQL_DB_HOST=seu_host_postgresql
SQL_DB_PORT=5432
SQL_DB_USER=seu_usuario
SQL_DB_PASSWORD=sua_senha
SQL_DB_NAME=seu_banco

# AWS Bedrock Configuration
BEDROCK_API_KEY=sua_chave_bedrock

# JWT Configuration
JWT_SECRET_KEY=sua_chave_secreta_jwt

# Agent IDs (não alterar - já configurados no banco)
PROFILE_ASSESSMENT_AGENT_ID=440f74fd-85b7-4342-b900-435cb1f04b06
PLAN_OUTLINE_CREATOR_AGENT_ID=d5789623-6a8b-4c07-a9e6-f0a2942e71cc
MODULE_OUTLINE_CREATOR_AGENT_ID=667bb235-6471-47b6-870b-c8f9a196d788
TEXT_CONTENT_CREATOR_AGENT_ID=ac01e60f-976e-430a-bf33-09ec096f7ed9

# Resource Configuration
RAG_TEST_DATA_DIR=./resources
KNOWLEDGE_BASE_ID=5b0b698f-2a01-4404-9ea5-15ecbaecf87e
```

#### 4. Executar a Aplicação
```bash
uvicorn src.main:app --reload --port 8080 --host 0.0.0.0
```

#### 5. Indexar Recursos da Base de Conhecimento
Com a aplicação rodando, execute a seguinte chamada para indexar os recursos da pasta `resources/`:

```bash
curl -X POST "http://localhost:8080/knowledge_base/populate_test_data"
```

Ou acesse via browser: http://localhost:8080/docs e execute o endpoint `POST /knowledge_base/populate_test_data`

### Verificação da Instalação

- Interface Principal: http://localhost:8080
- Documentação da API: http://localhost:8080/docs
- Verificar Knowledge Base: http://localhost:8080/knowledge_base