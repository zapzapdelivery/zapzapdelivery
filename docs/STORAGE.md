# Documentação do Sistema de Armazenamento (Storage)

Este documento descreve a estratégia de armazenamento de arquivos (imagens) utilizada no projeto ZapZap Delivery, utilizando o **Supabase Storage**.

## Visão Geral

O sistema utiliza buckets públicos do Supabase Storage para armazenar imagens de diferentes entidades (usuários, estabelecimentos, produtos, parceiros, categorias). O upload é gerenciado pelo frontend através de um componente reutilizável, e as referências (URLs) são salvas no banco de dados PostgreSQL.

## Buckets e Estrutura

Foram definidos 5 buckets principais. Cada bucket pode conter pastas para organização, embora a separação principal seja por bucket.

| Entidade | Bucket | Pasta Padrão | Coluna no Banco | Obs |
|---|---|---|---|---|
| **Usuários** | `avatars` | `usuarios/` | `avatar_url` | Avatares de perfil |
| **Estabelecimentos** | `establishments` | `estabelecimentos/` | `logo_url`, `capa_url` | Logo e capa |
| **Produtos** | `products` | `produtos/` | `imagem_produto_url` | Fotos dos produtos |
| **Parceiros** | `partners` | `parceiros/` | `logo_url` | Logos de parceiros |
| **Categorias** | `categories` | `categorias/` | `imagem_categoria_url` | Ícones/Imagens de categoria |

### Políticas de Segurança (RLS)

- **Leitura (SELECT)**: Pública para todos os buckets (necessário para exibir imagens no app/site).
- **Escrita (INSERT/UPDATE/DELETE)**: Restrita a usuários autenticados (Authenticated role).

## Componente de Upload (`ImageUpload`)

Foi criado um componente reutilizável em `src/components/Upload/ImageUpload.tsx`.

### Uso Básico

```tsx
import { ImageUpload } from '@/components/Upload/ImageUpload';

<ImageUpload
  bucket="products"       // Nome do bucket (obrigatório)
  folder="produtos"       // Pasta interna (opcional, padrão: raiz do bucket)
  value={imageUrl}        // Estado local da URL
  onChange={setImageUrl}  // Função para atualizar estado
  helpText="Recomendado: 500x500px"
/>
```

O componente lida automaticamente com:
- Seleção de arquivo.
- Validação de tipos (JPG, PNG, WEBP, AVIF, GIF) e tamanho (padrão 5MB).
- Upload para o Supabase.
- Geração de nome único (timestamp + random).
- Retorno da URL pública.
- Estado de loading e erro.

## Estratégia de Limpeza (Cleanup)

Para evitar o acúmulo de imagens órfãs (arquivos no Storage que não são referenciados por nenhuma linha no banco de dados), foi desenvolvido um script de verificação.

### Script de Verificação

Localização: `scripts/test-cleanup-v2.js`

Este script realiza uma varredura "Dry-Run" (apenas leitura/log):
1. Lista todos os arquivos presentes nos buckets configurados.
2. Consulta as tabelas do banco de dados para obter todas as URLs de imagens em uso.
3. Compara as listas e identifica arquivos "órfãos" (presentes no storage mas não no banco).

**Execução:**
```bash
node scripts/test-cleanup-v2.js
```

> **Nota:** Atualmente o script roda em modo de teste e apenas lista os arquivos candidatos à exclusão. A implementação da exclusão real deve ser agendada via Cron Job ou Edge Function futura.

## Migração e Refatoração

Todas as páginas de cadastro e edição foram refatoradas para utilizar o novo padrão:
- `src/app/produtos/novo/page.tsx` & `editar/[id]/page.tsx`
- `src/app/estabelecimentos/novo/page.tsx` (usa `?id` para edição)
- `src/app/parceiros/novo/page.tsx` (usa `?id` para edição)
- `src/app/categorias/novo/page.tsx` (usa `?id` para edição)
- `src/app/usuarios/novo/page.tsx` & `editar/[id]/page.tsx`

## Ordenação de Produtos

A API de produtos (`/api/produtos`) foi ajustada para retornar os itens ordenados por:
1. `atualizado_em` (Decrescente) - Itens modificados recentemente aparecem primeiro.
2. `criado_em` (Decrescente) - Critério de desempate.

Isso garante que ao editar um produto, ele vá para o topo da lista no Painel Administrativo.
