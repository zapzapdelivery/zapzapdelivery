import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShoppingBag, 
  History, 
  User, 
  MapPin, 
  FileText, 
  CreditCard, 
  Printer, 
  FileDown,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Bike,
  X,
  Ban
} from 'lucide-react';
import styles from './OrderDetailsModal.module.css';
import { supabase } from '@/lib/supabase';
import { OrderStatus, ORDER_STATUS_LABEL } from '@/types/orderStatus';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onCancel?: (orderId: string) => void;
}

export function OrderDetailsModal({ isOpen, onClose, order, onCancel }: OrderDetailsModalProps) {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!isOpen) return;

      if (!order?.real_id) {
        console.error('OrderDetailsModal: real_id missing', order);
        setError('ID do pedido não encontrado.');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError('Sessão expirada. Recarregue a página.');
          setLoading(false);
          return;
        }

        console.log('Fetching order details for:', order.real_id);
        const resp = await fetch(`/api/pedidos/${order.real_id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!resp.ok) {
          const errText = await resp.text();
          let errObj = {};
          try {
             errObj = JSON.parse(errText);
          } catch (e) {
             errObj = { error: errText || `Erro ${resp.status}` };
          }
          console.error('Error fetching order details:', resp.status, resp.statusText, errObj);
          setError((errObj as any).error || `Erro ao carregar pedido (${resp.status})`);
          setDetails(null);
        } else {
          const data = await resp.json();
          console.log('Fetched order details:', data);
          if (!ignore) {
             setDetails(data);
             if (!data) setError('Pedido não encontrado.');
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar detalhes do pedido:', err);
        if (!ignore) setError(err.message || 'Erro de conexão');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    
    if (isOpen) {
        load();
    } else {
        setDetails(null);
        setError(null);
        setLoading(true);
    }
    
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
  
  const addressList = cliente?.enderecos_clientes || [];
  const address = Array.isArray(addressList) && addressList.length > 0 ? addressList[0] : null;
  const deliverer = details?.entregadores;
  const orderNumberRaw =
    details?.numero_pedido ??
    order?.numero_pedido ??
    order?.original?.numero_pedido ??
    order?.id ??
    order?.real_id ??
    null;
  const orderNumberCleaned = orderNumberRaw ? String(orderNumberRaw).replace(/^#+/, '').trim() : '';
  const orderTitle = orderNumberCleaned ? `#${orderNumberCleaned}` : 'Pedido';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.leftHeader}>
              <div className={styles.titleRow}>
                <h2 className={styles.orderTitle}>{orderTitle}</h2>
                <span className={`${styles.statusBadge} ${styles['status_' + (details?.status_pedido || order?.status || '').toLowerCase().replace(/\s+/g, '')] || ''}`}>
                  {details?.status_pedido || order?.status || 'Status não informado'}
                </span>
              </div>
              <p className={styles.orderSubtitle}>
                Realizado em {order?.data || new Date().toLocaleDateString('pt-BR')} às {order?.hora || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            
            <div className={styles.rightHeader}>
              <button className={styles.closeButton} title="Fechar" onClick={onClose}>
                <X size={24} />
              </button>
            </div>
          </div>
        </header>

        {notification && (
          <div style={{
            padding: '12px 16px',
            margin: '0 24px 16px',
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

        {error && (
          <div style={{
            padding: '12px 16px',
            margin: '0 24px 16px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500
          }}>
            <X size={18} />
            {error}
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
              maxWidth: '400px',
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
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Não, manter
                </button>
                <button
                  onClick={confirmCancel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Sim, cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.content}>
          <div className={styles.leftColumn}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <ShoppingBag size={20} className={styles.sectionIcon} />
                <h3>Itens do Pedido</h3>
              </div>
              {loading ? (
                <div style={{ padding: '1rem 1.5rem', color: '#64748b' }}>Carregando itens...</div>
              ) : (
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>PRODUTO</th>
                      <th>QTD</th>
                      <th>PREÇO UNIT.</th>
                      <th>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => {
                      const produto = it.produtos || {};
                      const name = produto.nome_produto || 'Produto';
                      const unit = Number(it.valor_unitario || 0);
                      const qty = Number(it.quantidade || 0);
                      const subtotal = unit * qty;
                      const imgSrc = produto.imagem_produto_url || 'https://via.placeholder.com/80';
                      return (
                        <tr key={it.id || idx}>
                          <td>
                            <div className={styles.productCell}>
                              <img 
                                src={imgSrc} 
                                alt={name} 
                                className={styles.productImage}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (!target.dataset.fallback) {
                                    target.dataset.fallback = '1';
                                    target.src = 'https://via.placeholder.com/80';
                                  }
                                }}
                              />
                              <span className={styles.productName}>{name}</span>
                            </div>
                          </td>
                          <td className={styles.qtyCell}>{qty}</td>
                          <td className={styles.priceCell}>R$ {unit.toFixed(2).replace('.', ',')}</td>
                          <td className={styles.subtotalCell}>R$ {subtotal.toFixed(2).replace('.', ',')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            {deliverer && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Bike size={20} className={styles.sectionIcon} />
                  <h3>Entregador</h3>
                </div>
                <div className={styles.customerInfo}>
                  <div className={styles.customerHeader}>
                    <img 
                      src={deliverer.imagem_entregador_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(deliverer.nome_entregador || 'E')}&background=random&color=fff`} 
                      alt={deliverer.nome_entregador} 
                      className={styles.customerAvatar}
                    />
                    <div className={styles.customerHeaderInfo}>
                      <h4>{deliverer.nome_entregador}</h4>
                      {deliverer.veiculo && <p>{deliverer.veiculo}</p>}
                      {deliverer.telefone && <p>{deliverer.telefone}</p>}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <History size={20} className={styles.sectionIcon} />
                <h3>Histórico do Pedido</h3>
              </div>
              <div className={styles.timeline}>
                <div className={styles.timelineItem}>
                  <div className={`${styles.timelineIcon} ${styles.timelineIconCompleted}`}>
                    <CheckCircle2 size={14} />
                  </div>
                  <div className={styles.timelineContent}>
                    <h4>Pedido realizado</h4>
                    <p>{details?.criado_em ? new Date(details.criado_em).toLocaleString('pt-BR') : `${order?.data} ${order?.hora}`}</p>
                  </div>
                </div>
                
                {details?.timeline?.filter((t: any) => (t.action === 'UPDATE' || t.action === 'INSERT') && t.new_status && t.new_status !== 'Pedido realizado').map((log: any) => (
                   <div className={styles.timelineItem} key={log.id}>
                    <div className={`${styles.timelineIcon} ${styles.timelineIconCompleted}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className={styles.timelineContent}>
                      <h4>{log.new_status}</h4>
                      <p>{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.rightColumn}>
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
                  <div className={styles.customerHeaderInfo}>
                    <h4>{cliente.nome_cliente || order?.cliente?.nome || 'Cliente não identificado'}</h4>
                    <p>{cliente.telefone || ''}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <MapPin size={20} className={styles.sectionIcon} />
                <h3>Endereço de Entrega</h3>
              </div>
              <div className={styles.customerAddress}>
                <MapPin size={18} className={styles.addressIcon} />
                <div>
                  <p style={{ fontWeight: 600, color: '#1e293b' }}>
                    {details?.forma_entrega === 'delivery'
                      ? 'Delivery'
                      : details?.forma_entrega === 'consumo'
                        ? 'Consumir no local'
                        : 'Retirada no local'}
                  </p>
                  {details?.forma_entrega === 'delivery' && (
                    <div style={{ marginTop: '4px', fontSize: '14px', color: '#64748b' }}>
                      {address ? (
                        <>
                          <p>{address.endereco}, {address.numero} {address.complemento ? `- ${address.complemento}` : ''}</p>
                          <p>{address.bairro} - {address.cidade}/{address.uf}</p>
                          <p>CEP: {address.cep}</p>
                          {address.referencia && <p style={{ fontStyle: 'italic' }}>Ref: {address.referencia}</p>}
                        </>
                      ) : (
                        <p style={{ color: '#ef4444' }}>Endereço não encontrado no cadastro do cliente</p>
                      )}
                    </div>
                  )}
                </div>
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
                <Package size={20} className={styles.sectionIcon} />
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

        <footer className={styles.modalActions}>
          <button className={styles.btnExportPdf} title="Exportar">
            <FileDown size={18} />
            <span>Exportar</span>
          </button>
          
          <button className={styles.btnPrint} title="Imprimir">
            <Printer size={18} />
            <span>Imprimir</span>
          </button>

          <button 
            className={styles.cancelButton}
            onClick={handleCancelClick}
            disabled={details?.status_pedido === OrderStatus.CANCELADO_CLIENTE || details?.status_pedido === OrderStatus.CANCELADO_ESTABELECIMENTO || details?.status_pedido?.includes('Cancelado')}
            title="Cancelar Pedido"
          >
            <Ban size={18} />
            <span>Cancelar Pedido</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
