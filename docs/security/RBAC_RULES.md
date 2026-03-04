# Regras de Controle de Acesso Baseado em Roles (RBAC) e Isolamento

Este documento descreve a implementação de segurança para garantir o isolamento completo de dados entre estabelecimentos no ZapZap Delivery.

## 1. Princípio Fundamental
**Cada usuário vinculado a um estabelecimento deve visualizar e manipular APENAS dados pertencentes a esse estabelecimento.**
O único papel com permissão global é o **Super Admin** (`everaldozs@gmail.com`).

## 2. Arquitetura de Segurança em Camadas (Defense in Depth)

### Camada 1: Banco de Dados (Row Level Security - RLS)
A proteção mais crítica ocorre diretamente no banco de dados PostgreSQL via Supabase RLS.
- **Mecanismo:** Policies SQL automáticas interceptam todas as queries (SELECT, INSERT, UPDATE, DELETE).
- **Prevenção de Recursão:** Utilizamos uma função `SECURITY DEFINER` chamada `get_current_user_establishment_id()` para buscar o ID do estabelecimento do usuário sem acionar loops infinitos de verificação de permissão.
- **Lógica das Policies:**
  ```sql
  estabelecimento_id = get_current_user_establishment_id()
  ```
- **Cobertura:** Tabelas `produtos`, `pedidos`, `clientes`, `estabelecimentos`, `usuarios`.
- **Bypass:** Super Admin tem permissão total via verificação de e-mail no JWT.

### Camada 2: API Backend (Middleware/Helper)
Para rotas de API do Next.js (Server-Side), utilizamos um helper centralizado.
- **Arquivo:** `src/lib/server-auth.ts`
- **Função:** `getAuthContext(request)`
- **Responsabilidade:**
  1. Validar Token JWT.
  2. Identificar se é Super Admin.
  3. Recuperar `estabelecimento_id` do usuário logado.
  4. Bloquear requisições sem contexto válido.
- **Uso:** Todas as rotas em `/api/*` devem iniciar chamando este helper e usando o `establishmentId` retornado para filtrar queries do Supabase Admin Client.
- **Tratamento de Inconsistências (Ghost Users):** Caso um usuário exista na tabela `public.usuarios` mas não no Supabase Auth, a API de exclusão detecta o erro "User not found" e procede com a limpeza manual do registro no banco de dados.
- **Validação de Propriedade:** Antes de qualquer operação crítica (ex: exclusão), a API verifica explicitamente se o usuário alvo pertence ao mesmo estabelecimento do solicitante.

### Camada 3: Frontend (UX)
- O frontend aplica filtros visuais para melhorar a experiência, mas **não é confiado** para segurança.
- O uso direto do `supabase-js` client no frontend é protegido automaticamente pela Camada 1 (RLS).

## 3. Implementação e Manutenção

### Arquivos Críticos
- `sql/secure_rls.sql`: Contém as definições das policies de segurança. DEVE ser aplicado no banco sempre que novas tabelas forem criadas.
- `src/lib/server-auth.ts`: Lógica central de autenticação da API.
- `test_rbac_isolation.js`: Script de teste de penetração para validar o isolamento.

### Como Aplicar as Regras
Para ativar a proteção completa, execute o script SQL contido em `sql/secure_rls.sql` no SQL Editor do Supabase Dashboard.

### Como Testar
Execute o script de teste automatizado:
```bash
node test_rbac_isolation.js
```
Este script simula:
1. Criação de usuário em um estabelecimento.
2. Tentativa de leitura de dados de OUTRO estabelecimento (deve retornar vazio).
3. Tentativa de escrita em OUTRO estabelecimento via RLS (deve ser bloqueado).
