# File Integrity Monitor - Active Defense

Um sistema de EDR (Endpoint Detection and Response) com arquitetura orientada a eventos. Ele monitora arquivos críticos e, se detectar alterações não autorizadas, faz o rollback automático, isola a ameaça em quarentena e exige a aprovação de um administrador para validar a modificação.

## Funcionalidades

* **Defesa Ativa (Rollback):** Bloqueia alterações e restaura a versão original instantaneamente.
* **Quarentena:** Isola arquivos modificados não autorizados para análise.
* **Aprovação Criptográfica:** Nenhuma alteração passa sem um token JWT de um administrador.
* **Trilha de Auditoria:** Registra todas as tentativas (bloqueadas ou aprovadas) no PostgreSQL.

## Tecnologias e Arquitetura

* **Agente Local:** Python (Watchdog para monitorar I/O, Flask para escutar comandos).
* **API Central:** Node.js (Express) para gerenciar os alertas e aprovações.
* **Banco de Dados:** PostgreSQL (controle de concorrência e mitigação de SQL Injection).
* **Segurança:** RBAC (Role-Based Access Control) usando JWT e bcrypt (transmissão stateless).

## Como Instalar e Rodar

**Pré-requisitos:** Node.js, Python, PostgreSQL e um client de API (Postman, Insomnia ou Thunder Client).

1. **Clone o repositório** e instale as dependências:
   * Node: `npm install express pg dotenv jsonwebtoken bcrypt`
   * Python: `pip install watchdog flask`
2. **Configure o Banco:** Crie um banco no PostgreSQL e rode o arquivo `seed.js` (baseado no seu `.env.example`) para criar o usuário admin.
3. **Inicie os serviços:**
   * Em um terminal, rode a API: `node server.js`
   * Em outro terminal, rode o agente: `python monitor.py`

## Como Simular um Ataque

1. Vá até a pasta `monitored` e tente alterar o arquivo de teste.
2. **O que acontece:** O sistema bloqueia a ação, manda a alteração para a quarentena e restaura o arquivo original.
3. Olhe os terminais do servidor e do monitor: você verá o alerta do ataque bloqueado, que também foi salvo no SQL.

## Como Aprovar a Alteração (Admin)

Para que a edição seja aceita, o administrador precisa assinar a operação via API.

**Passo 1: Gerar o Token JWT**
* **Método:** `POST http://localhost:xxxx/login`
* **Body (JSON):** ```json
  {
    "username": "seu_admin", 
    "password": "sua_senha"
  }
