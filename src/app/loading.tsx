'use client';

import { usePathname } from 'next/navigation';
import { Loading } from '@/components/Loading/Loading';

function getLoadingMessage(pathname: string) {
  const path = (pathname || '').toLowerCase();

  if (path.includes('/carrinho')) return 'Carregando carrinho...';
  if (path.includes('/cardapio/')) return 'Carregando cardápio...';

  if (path.startsWith('/minhaconta')) return 'Carregando minha conta...';
  if (path.startsWith('/painelentregador')) return 'Carregando Painel do Entregador...';
  if (path.startsWith('/paineladmin')) return 'Carregando Painel Admin...';

  if (path.startsWith('/checkout')) return 'Carregando checkout...';
  if (path.startsWith('/pedidos')) return 'Carregando pedidos...';
  if (path.startsWith('/produtos')) return 'Carregando produtos...';
  if (path.startsWith('/categorias')) return 'Carregando categorias...';
  if (path.startsWith('/cupons')) return 'Carregando cupons...';
  if (path.startsWith('/adicionais')) return 'Carregando adicionais...';
  if (path.startsWith('/configuracoes')) return 'Carregando configurações...';
  if (path.startsWith('/usuarios')) return 'Carregando usuários...';
  if (path.startsWith('/entregadores')) return 'Carregando entregadores...';
  if (path.startsWith('/estoque')) return 'Carregando estoque...';
  if (path.startsWith('/parceiros')) return 'Carregando parceiros...';
  if (path.startsWith('/relatorios')) return 'Carregando relatórios...';
  if (path.startsWith('/dashboard')) return 'Carregando dashboard...';
  if (path.startsWith('/estabelecimentos') || path.startsWith('/estabelecimentoss')) return 'Carregando estabelecimentos...';

  return 'Carregando...';
}

export default function LoadingPage() {
  const pathname = usePathname() || '';
  return <Loading fullScreen message={getLoadingMessage(pathname)} />;
}

