'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading/Loading';

export default function EstablishmentsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a página inicial
    router.push('/');
  }, [router]);

  // Exibe a tela de carregamento enquanto o redirecionamento acontece
  return <Loading fullScreen={true} message="Redirecionando..." />;
}
