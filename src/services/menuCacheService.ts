interface MenuCacheData {
  role: string | null;
  userEmail: string | null;
  userName: string;
  initials: string;
  timestamp: number;
  version: string;
}

class MenuCacheService {
  private readonly CACHE_KEY = 'menu_data_cache';
  private readonly CACHE_VERSION = 'v1';
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 horas

  // Salvar dados no cache
  saveToCache(data: {
    role: string | null;
    userEmail: string | null;
    userName: string;
    initials: string;
  }): void {
    try {
      const cacheData: MenuCacheData = {
        ...data,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.warn('Erro ao salvar cache de menu:', error);
    }
  }

  // Obter dados do cache
  getFromCache(): MenuCacheData | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;
      
      const cacheData: MenuCacheData = JSON.parse(cached);
      
      // Verificar se o cache é válido (versão e tempo)
      if (cacheData.version !== this.CACHE_VERSION) return null;
      if (Date.now() - cacheData.timestamp > this.CACHE_DURATION) return null;
      
      return cacheData;
    } catch (error) {
      console.warn('Erro ao recuperar cache de menu:', error);
      return null;
    }
  }

  // Limpar cache
  clearCache(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.CACHE_KEY);
      }
    } catch (error) {
      console.warn('Erro ao limpar cache de menu:', error);
    }
  }

  // Verificar se o cache é válido
  isCacheValid(): boolean {
    return this.getFromCache() !== null;
  }

  // Obter dados com fallback para API
  async getMenuDataWithCache(token: string | null): Promise<{
    role: string | null;
    userEmail: string | null;
    userName: string;
    initials: string;
  }> {
    // 1. Tentar obter do cache primeiro
    const cached = this.getFromCache();
    if (cached) {
      return {
        role: cached.role,
        userEmail: cached.userEmail,
        userName: cached.userName,
        initials: cached.initials
      };
    }

    // 2. Se não há cache válido, buscar da API
    try {
      if (!token) {
        throw new Error('Token não disponível');
      }

      const res = await fetch('/api/me/role', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const normalizedRole = typeof data?.role === 'string' ? data.role.trim().toLowerCase() : null;

      // Extrair informações do usuário da sessão
      const sessionRes = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      let userEmail: string | null = null;
      let userName = 'Usuário';
      let initials = 'US';

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        userEmail = sessionData.user?.email || null;
        
        if (sessionData.user) {
          userName = sessionData.user.user_metadata?.full_name ||
                    sessionData.user.user_metadata?.name ||
                    (sessionData.user.email ? sessionData.user.email.split('@')[0] : 'Usuário');
          
          initials = String(userName)
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase() || '')
            .join('') || 'US';
        }
      }

      const result = {
        role: normalizedRole,
        userEmail,
        userName,
        initials
      };

      // Salvar no cache para uso futuro
      this.saveToCache(result);

      return result;
    } catch (error) {
      console.error('Erro ao buscar dados do menu:', error);
      
      // Fallback: retornar dados padrão em caso de erro
      return {
        role: null,
        userEmail: null,
        userName: 'Usuário',
        initials: 'US'
      };
    }
  }

  // Pré-carregar dados durante idle time
  preloadMenuData(token: string | null): void {
    if (this.isCacheValid()) return; // Já tem cache válido

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.getMenuDataWithCache(token).catch(console.error);
      });
    } else {
      // Fallback para setTimeout
      setTimeout(() => {
        this.getMenuDataWithCache(token).catch(console.error);
      }, 3000); // 3 segundos após carregamento
    }
  }
}

// Exportar instância singleton
export const menuCacheService = new MenuCacheService();