File Integrity Monitor - Active Defense

Sistema de Monitoramento de Integridade de Arquivos (FIM) com recursos de Defesa Ativa.
O sistema bloqueia alterações não autorizadas de forma imediata por meio de rollback automático, isola potenciais ameaças em quarentena e exige aprovação criptográfica de um administrador para validar qualquer modificação.

Desenvolvimento:
    0. Banco de Dados: SQL
    1. Agente Python: Responsável pela geração de hashes e detecção de operações de I/O
    2. API Node.js: Responsável pela recepção de alertas e integração entre os componentes
    3. Segurança: Implementação de autenticação, autorização e rastreamento de ações
    4. Frontend

Requisitos:

    Node.js
    Python
    PostgreSQL
    Thunder Client (extensão do VS Code), Postman ou Insomnia para enviar comandos de autorização.

    Event-Driven - npm install express pg dotenv jsonwebtoken bcrypt
    Watchdog
    Flask

Padrões e Arquiteturas Utilizadas:

    EDR (Endpoint Detection and Response): Modelo de segurança que integra monitoramento contínuo com resposta automatizada, incluindo rollback e quarentena.
    Arquitetura Orientada a Eventos (Event-Driven): O sistema reage em tempo real a eventos disparados pelo sistema operacional (ex: Watchdog).
    Microserviços & API RESTful: Estrutura distribuída composta por uma API central de controle (Node.js) e um agente local autônomo que escuta comandos (Flask).
    PostgreSQL: Utilizado para controle de concorrência e idempotência por meio de Upserts (ON CONFLICT).
    Modelo relacional 1:N com uso de Foreign Keys e queries parametrizadas para mitigação de SQL Injection.

Segurança e Controle de Acesso: RBAC com JWT

    1. Autenticação e Assinatura: Na rota de login, as credenciais fornecidas são validadas contra o hash `bcrypt` armazenado no banco de dados.
        Caso válidas, a API emite um JSON Web Token (JWT) assinado com a chave secreta do servidor, contendo o ID do usuário e sua respectiva role (ex: admin).

    2. Transmissão Stateless: Para execução de ações restritas, o cliente deve enviar o token no cabeçalho HTTP (`Authorization: Bearer <token>`), mantendo a API stateless e escalável.

    3. Validação via Middleware: Rotas críticas são protegidas por um middleware que valida a integridade criptográfica do token, sua expiração e a role do usuário.
        Apenas requisições autorizadas são processadas e registradas no PostgreSQL, incluindo o ID do responsável na trilha de auditoria.

Como Aprovar:

    Thunder Client:

        Gerar token:
        POST [http://localhost:xxxx/login](http://localhost:xxxxx/login)
        Body (JSON): {"username": "xxxxxx", "password": "xxxxxx"}

        Enviar autorização:
        PATCH [http://localhost:xxxxx/logs/ID/authorize](http://localhost:xxxxxx/logs/ID/authorize)
        Na aba Auth, selecionar Bearer Token e inserir o token gerado.

