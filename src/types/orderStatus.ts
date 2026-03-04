export enum OrderStatus {
  PEDINDO = 'Pedindo',
  CONFIRMADO = 'Pedido Confirmado',
  PREPARACAO = 'Em Preparação',
  PRONTO = 'Pedido Pronto',
  SAIU_ENTREGA = 'Saiu Para Entrega',
  ENTREGUE = 'Pedido Entregue',
  CANCELADO_CLIENTE = 'Cancelado Pelo Cliente',
  CANCELADO_ESTABELECIMENTO = 'Cancelado Pelo Estabelecimento'
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PEDINDO]: 'PEDINDO',
  [OrderStatus.CONFIRMADO]: 'PEDIDO CONFIRMADO',
  [OrderStatus.PREPARACAO]: 'EM PREPARAÇÃO',
  [OrderStatus.PRONTO]: 'PEDIDO PRONTO',
  [OrderStatus.SAIU_ENTREGA]: 'SAIU PARA ENTREGA',
  [OrderStatus.ENTREGUE]: 'ENTREGUE',
  [OrderStatus.CANCELADO_CLIENTE]: 'CANCELADO PELO CLIENTE',
  [OrderStatus.CANCELADO_ESTABELECIMENTO]: 'CANCELADO PELO ESTABELECIMENTO'
};

export const ORDER_STATUS_SLUG: Record<OrderStatus, string> = {
  [OrderStatus.PEDINDO]: 'pedindo',
  [OrderStatus.CONFIRMADO]: 'confirmado',
  [OrderStatus.PREPARACAO]: 'preparacao',
  [OrderStatus.PRONTO]: 'pronto',
  [OrderStatus.SAIU_ENTREGA]: 'entrega',
  [OrderStatus.ENTREGUE]: 'entregue',
  [OrderStatus.CANCELADO_CLIENTE]: 'cancelado_cliente',
  [OrderStatus.CANCELADO_ESTABELECIMENTO]: 'cancelado_loja'
};

export const ORDER_STATUS_FLOW = [
  OrderStatus.PEDINDO,
  OrderStatus.CONFIRMADO,
  OrderStatus.PREPARACAO,
  OrderStatus.PRONTO,
  OrderStatus.SAIU_ENTREGA,
  OrderStatus.ENTREGUE
];

// Map legacy statuses to new standardized Enums
export const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  'Em Preparo': OrderStatus.PREPARACAO,
  'Em Preparação': OrderStatus.PREPARACAO,
  'Em Andamento': OrderStatus.PREPARACAO,
  'Em Entrega': OrderStatus.SAIU_ENTREGA,
  'Saiu Para Entrega': OrderStatus.SAIU_ENTREGA,
  'Cancelado': OrderStatus.CANCELADO_ESTABELECIMENTO, // Default fallback
  'cancelado_cliente': OrderStatus.CANCELADO_CLIENTE,
  'cancelado_loja': OrderStatus.CANCELADO_ESTABELECIMENTO
};
