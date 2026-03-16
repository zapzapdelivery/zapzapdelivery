"use client";

import React, { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../Sidebar/Sidebar';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

function SidebarContent({ children }: { children: ReactNode }) {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const pathname = usePathname();

  // Determine if sidebar should be visible
  // Only show sidebar on admin pages
  // Exclude login, public pages, customer pages, delivery app
  const isAuthPage = pathname === '/paineladmin' || pathname === '/login';
  const isPublicPage = pathname.startsWith('/estabelecimentos/cardapio') || pathname === '/' || pathname === '/estabelecimentos' || pathname === '/novoestabelecimento' || pathname.startsWith('/categoria/');
  const isCustomerPage = pathname.startsWith('/minhaconta');
  const isDeliveryPage = pathname.startsWith('/painelentregador');
  const isCheckoutPage = pathname.startsWith('/checkout');
  
  const showSidebar = !isAuthPage && !isPublicPage && !isCustomerPage && !isDeliveryPage && !isCheckoutPage;

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar} 
      />
      <div className="admin-layout-content">
        {children}
      </div>
      <style jsx global>{`
        .admin-layout-content {
          padding-left: 250px;
          min-height: 100vh;
          transition: padding-left 0.3s ease;
        }
        @media (max-width: 768px) {
          .admin-layout-content {
            padding-left: 0 !important;
          }
        }
      `}</style>
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);

  return (
    <SidebarProvider>
      <SidebarContent>{children}</SidebarContent>
    </SidebarProvider>
  );
}
