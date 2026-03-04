export type DeliveryFeeType = 'fixo' | 'bairro' | 'distancia';

export interface DeliveryFeeConfig {
  id: string;
  estabelecimento_id: string;
  tipo_taxa: DeliveryFeeType;
  valor_base: number;
  preco_km: number;
  km_base: number;
  distancia_maxima: number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface NeighborhoodFee {
  id: string;
  taxa_entrega_id: string;
  nome_bairro: string;
  valor_taxa: number;
  criado_em: string;
}
