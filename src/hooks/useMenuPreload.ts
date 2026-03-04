'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { menuCacheService } from '@/services/menuCacheService';

export const useMenuPreload = () => {
  useEffect(() => {
    const preloadMenuData = async () => {
      try {
        // Verificar se já temos cache válido
        if (menuCacheService.isCacheValid()) {
          return;
        }

        // Obter sessão para pegar o token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || null;

        if (!token) {
          return;
        }

        // Pré-carregar dados do menu em background
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            menuCacheService.getMenuDataWithCache(token).catch(error => {
              console.warn('Falha no pré-carregamento do menu:', error);
            });
          });
        } else {
          // Fallback para setTimeout
          setTimeout(() => {
            menuCacheService.getMenuDataWithCache(token).catch(error => {
              console.warn('Falha no pré-carregamento do menu:', error);
            });
          }, 2000); // 2 segundos após carregamento
        }
      } catch (error) {
        console.warn('Erro no pré-carregamento do menu:', error);
      }
    };

    preloadMenuData();
  }, []);
};

// Hook para forçar atualização do cache quando necessário
export const useMenuCacheRefresh = () => {
  const refreshMenuCache = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || null;

      if (token) {
        // Limpar cache existente e buscar dados frescos
        menuCacheService.clearCache();
        await menuCacheService.getMenuDataWithCache(token);
      }
    } catch (error) {
      console.error('Erro ao atualizar cache do menu:', error);
    }
  };

  return { refreshMenuCache };
};