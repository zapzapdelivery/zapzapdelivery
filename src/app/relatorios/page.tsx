'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { UnderConstruction } from '../../components/UnderConstruction/UnderConstruction';

export default function RelatoriosPage() {
  const router = useRouter();
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  if (loadingRole) {
    return null; // Prevent rendering while checking permission
  }

  return (
    <div className="min-h-screen bg-gray-100 transition-all duration-300">
      <Sidebar />
      <main className="p-4 md:p-6 w-full">
        <AdminHeader />
        <UnderConstruction 
          title="Relatórios e Análises" 
          launchDate="30/04/2026" 
        />
      </main>
    </div>
  );
}
