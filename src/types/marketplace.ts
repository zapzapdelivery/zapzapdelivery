export interface Establishment {
  id: string;
  name: string;
  logoUrl?: string;
  url_cardapio?: string;
  created_at?: string;
  address?: string;
  categoryId?: string;
  tipos_estabelecimento?: {
    id: string;
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}
