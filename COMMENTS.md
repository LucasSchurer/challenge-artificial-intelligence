# +A Educação - Engenheiro de Inteligência Artificial

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
uvicorn src.main:app --reload
```

#### 5. Indexar Recursos da Base de Conhecimento
Com a aplicação rodando, execute a seguinte chamada para indexar os recursos da pasta `resources/`:

```bash
curl -X POST "http://localhost:8000/knowledge_base/populate_test_data"
```

Ou acesse via browser: http://localhost:8000/docs e execute o endpoint `POST /knowledge_base/populate_test_data`

### Verificação da Instalação

- Interface Principal: http://localhost:8000
- Documentação da API: http://localhost:8000/docs
- Verificar Knowledge Base: http://localhost:8000/knowledge_base