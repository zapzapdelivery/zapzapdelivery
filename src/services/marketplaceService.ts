import { Establishment, Category } from '@/types/marketplace';

export const marketplaceService = {
  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch('/api/marketplace/categorias', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await res.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  async getEstablishments(categoryId?: string, uf?: string, city?: string): Promise<Establishment[]> {
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append('category_id', categoryId);
      if (uf) params.append('uf', uf);
      if (city) params.append('cidade', city);
      
      const res = await fetch(`/api/marketplace/estabelecimentos?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch establishments');
      }
      
      const json = await res.json();
      const data = json.data || [];

      // Map the response to match the Establishment interface
      return data.map((est: any) => ({
        ...est,
        categoryId: est.tipos_estabelecimento?.id,
      }));
    } catch (error) {
      console.error('Error fetching establishments:', error);
      return [];
    }
  },

  async getTopTenEstablishments(uf?: string, city?: string): Promise<Establishment[]> {
    try {
      const params = new URLSearchParams();
      params.append('top10', 'true');
      if (uf) params.append('uf', uf);
      if (city) params.append('cidade', city);

      const res = await fetch(`/api/marketplace/estabelecimentos?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch top 10 establishments');
      }
      
      const json = await res.json();
      const data = json.data || [];

      return data.map((est: any) => ({
        ...est,
        categoryId: est.tipos_estabelecimento?.id,
        isTop10: true,
      }));
    } catch (error) {
      console.error('Error fetching top 10 establishments:', error);
      return [];
    }
  }
};
