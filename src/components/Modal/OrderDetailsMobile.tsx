import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingBag, User, MapPin, FileText, CreditCard, Printer, FileDown, CheckCircle2, Clock, Ban, X } from 'lucide-react';
import { OrderStatus } from '@/types/orderStatus';
import styles from './OrderDetailsMobile.module.css';
import { supabase } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onCancel?: (orderId: string) => void;
}

export function OrderDetailsMobile({ isOpen, onClose, order, onCancel }: Props) {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !order?.real_id) {
          setDetails(null);
          setLoading(false);
          return;
        }
        const resp = await fetch(`/api/pedidos/${order.real_id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (!resp.ok) {
          setDetails(null);
        } else {
          const data = await resp.json();
          if (!ignore) setDetails(data);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [order?.real_id, isOpen]);

  if (!isOpen) return null;

  const handleCancelClick = () => {
    if (!order?.real_id) {
      setNotification({ type: 'error', message: 'ID do pedido não encontrado' });
      return;
    }
    setShowConfirmCancel(true);
  };

  const confirmCancel = async () => {
    setShowConfirmCancel(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setNotification({ type: 'error', message: 'Sessão não encontrada' });
        return;
      }

      const resp = await fetch('/api/pedidos/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: order.real_id,
          status: OrderStatus.CANCELADO_ESTABELECIMENTO
        })
      });

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: 'Erro ao cancelar pedido' }));
        setNotification({ type: 'error', message: error.error || 'Erro ao cancelar pedido' });
        return;
      }

      onCancel && onCancel(order.real_id);
      setNotification({ type: 'success', message: 'Pedido cancelado com sucesso!' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      setNotification({ type: 'error', message: 'Erro ao cancelar pedido' });
    }
  };

  const items = Array.isArray(details?.itens_pedidos) ? details.itens_pedidos : [];
  
  // Handle cliente as object or array (just in case)
  const clienteRaw = details?.clientes || order?.cliente;
  const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] : (clienteRaw || {});

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <button className={styles.backButton} onClick={onClose}>
              <ArrowLeft size={20} />
              <span>Voltar</span>
            </button>
            <div className={styles.headerActions}>
              <button className={styles.iconButton} title="Imprimir">
                <Printer size={20} />
              </button>
              <button className={styles.iconButton} title="Exportar">
                <FileDown size={20} />
              </button>
            </div>
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.orderInfo}>
              <h2 className={styles.orderTitle}>{order?.id || 'Pedido'}</h2>
              <div className={styles.orderStatus}>
                <span className={`${styles.statusBadge} ${styles[details?.status_pedido?.toLowerCase().replace(/\s+/g, '')] || ''}`}>
                  {details?.status_pedido || order?.status || 'Status não informado'}
                </span>
              </div>
            </div>
            <button 
              className={styles.cancelButton}
              onClick={handleCancelClick}
              disabled={details?.status_pedido === OrderStatus.CANCELADO_ESTABELECIMENTO}
            >
              <Ban size={16} />
              Cancelar Pedido
            </button>
          </div>
        </header>

        {notification && (
          <div style={{
            padding: '12px 16px',
            margin: '0 16px 16px',
            borderRadius: '8px',
            backgroundColor: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            {notification.message}
          </div>
        )}

        {showConfirmCancel && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              maxWidth: '320px',
              width: '100%',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
                Cancelar Pedido?
              </h3>
              <p style={{ color: '#64748b', marginBottom: '24px' }}>
                Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: 500,
                    flex: 1
                  }}
                >
                  Não
                </button>
                <button
                  onClick={confirmCancel}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 500,
                    flex: 1
                  }}
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.content}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <ShoppingBag size={20} className={styles.sectionIcon} />
              <h3>Itens do Pedido</h3>
            </div>
            {loading ? (
              <div style={{ padding: '1rem', color: '#64748b' }}>Carregando itens...</div>
            ) : (
              <div className={styles.itemsList}>
                {items.map((it: any, idx: number) => {
                  const produto = it.produtos || {};
                  const name = produto.nome_produto || 'Produto';
                  const unit = Number(it.valor_unitario || 0);
                  const qty = Number(it.quantidade || 0);
                  const subtotal = unit * qty;
                  const imgSrc = produto.imagem_produto_url || 'https://via.placeholder.com/80';
                  return (
                    <div key={it.id || idx} className={styles.item}>
                      <img 
                        src={imgSrc} 
                        alt={name} 
                        className={styles.itemImage}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallback) {
                            target.dataset.fallback = '1';
                            target.src = 'https://via.placeholder.com/80';
                          }
                        }}
                      />
                      <div className={styles.itemDetails}>
                        <p className={styles.itemName}>{name}</p>
                        <p className={styles.itemQuantity}>Qtd: {qty}</p>
                        <p className={styles.itemPrice}>R$ {unit.toFixed(2).replace('.', ',')} cada</p>
                      </div>
                      <div className={styles.itemTotal}>
                        R$ {subtotal.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <User size={20} className={styles.sectionIcon} />
              <h3>Cliente</h3>
            </div>
            <div className={styles.customerInfo}>
              <div className={styles.customerHeader}>
                <img 
                  src={cliente.imagem_cliente_url || order?.cliente?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cliente.nome_cliente || 'C')}&background=random&color=fff`} 
                  alt={cliente.nome_cliente || 'Cliente'} 
                  className={styles.customerAvatar}
                />
                <div>
                  <p className={styles.customerName}>{cliente.nome_cliente || order?.cliente?.nome || 'Cliente não identificado'}</p>
                  <p className={styles.customerPhone}>{cliente.telefone || ''}</p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <MapPin size={20} className={styles.sectionIcon} />
              <h3>Endereço de Entrega</h3>
            </div>
            <div className={styles.deliveryInfo}>
              <p className={styles.deliveryType}>
                {details?.forma_entrega === 'delivery' ? 'Delivery' : 'Retirada no local'}
              </p>
              {details?.forma_entrega === 'delivery' && (
                <p className={styles.deliveryAddress}>
                  Endereço de entrega não disponível
                </p>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <FileText size={20} className={styles.sectionIcon} />
              <h3>Observações</h3>
            </div>
            <div className={styles.observations}>
              <p className={styles.observationText}>
                {details?.observacao_cliente || 'Nenhuma observação'}
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <CreditCard size={20} className={styles.sectionIcon} />
              <h3>Pagamento</h3>
            </div>
            <div className={styles.paymentInfo}>
              <p className={styles.paymentMethod}>
                {details?.forma_pagamento || order?.pagamento || 'Não informado'}
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Clock size={20} className={styles.sectionIcon} />
              <h3>Resumo do Pedido</h3>
            </div>
            <div className={styles.orderSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>R$ {(details?.subtotal || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Taxa de entrega</span>
                <span>R$ {(details?.taxa_entrega || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              {details?.desconto > 0 && (
                <div className={styles.summaryRow}>
                  <span>Desconto</span>
                  <span>- R$ {details.desconto.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total</span>
                <span>R$ {(details?.total_pedido || 0).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}