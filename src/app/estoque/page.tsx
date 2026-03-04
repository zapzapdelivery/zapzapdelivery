'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';

export default function EstoquePage() {
  const router = useRouter();
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (loadingRole) return;

    if (role === 'atendente') {
      router.push('/');
    } else {
      router.push('/estoque/movimentacoes');
    }
  }, [role, loadingRole, router]);

  return null;
}
