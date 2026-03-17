import React from 'react';
import { 
  X, 
  Check, 
  Clock, 
  Zap,
  Circle,
  AlertTriangle,
  Store,
  User
} from 'lucide-react';
import styles from './OrderTrackingModal.module.css';
import { OrderStatus, ORDER_STATUS_LABEL, LEGACY_STATUS_MAP } from '@/types/orderStatus';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    numero_pedido: string;
    status_pedido: string;
    forma_pagamento: string;
    total_pedido: number;
    criado_em: string;
  } | null;
}

const STEPS = [
  {
    key: 'realizado',
    label: ORDER_STATUS_LABEL[OrderStatus.PEDINDO],
    description: '',
    icon: <Check size={18} strokeWidth={3} />,
    match: [OrderStatus.PEDINDO]
  },
  {
    key: 'confirmado',
    label: ORDER_STATUS_LABEL[OrderStatus.CONFIRMADO],
    description: '',
    icon: <Check size={18} strokeWidth={3} />,
    match: [OrderStatus.CONFIRMADO]
  },
  {
    key: 'preparo',
    label: ORDER_STATUS_LABEL[OrderStatus.PREPARACAO],
    description: 'O estabelecimento está preparando o seu pedido com carinho.',
    icon: <Clock size={18} strokeWidth={2.5} />,
    match: [OrderStatus.PREPARACAO]
  },
  {
    key: 'pronto',
    label: ORDER_STATUS_LABEL[OrderStatus.PRONTO],
    description: 'Aguardando retirada',
    icon: <Circle size={10} fill="currentColor" stroke="none" />,
    match: [OrderStatus.PRONTO]
  },
  {
    key: 'entrega',
    label: ORDER_STATUS_LABEL[OrderStatus.SAIU_ENTREGA],
    description: 'Em breve em sua porta',
    icon: <Zap size={18} fill="currentColor" strokeWidth={0} />,
    match: [OrderStatus.SAIU_ENTREGA]
  },
  {
    key: 'entregue',
    label: ORDER_STATUS_LABEL[OrderStatus.ENTREGUE],
    description: 'Bom apetite!',
    icon: <Check size={18} strokeWidth={3} />,
    match: [OrderStatus.ENTREGUE]
  }
];

export function OrderTrackingModal({ isOpen, onClose, order }: OrderTrackingModalProps) {
  if (!isOpen || !order) return null;

  const currentStatus = order.status_pedido || '';
  
  // Check for cancellation
  const isCancelled = currentStatus === OrderStatus.CANCELADO_CLIENTE || currentStatus === OrderStatus.CANCELADO_ESTABELECIMENTO;
  const cancelledByClient = currentStatus === OrderStatus.CANCELADO_CLIENTE;
  const cancelledByStore = currentStatus === OrderStatus.CANCELADO_ESTABELECIMENTO;

  // Determine current step index
  let activeStepIndex = -1;
  
  if (isCancelled) {
    activeStepIndex = -1; 
  } else {
    // Try to find exact match first
    const stepIndex = STEPS.findIndex(step => step.match.includes(currentStatus as OrderStatus));
    if (stepIndex !== -1) {
        activeStepIndex = stepIndex;
    } else {
        // Fallback for legacy or partial matches using LEGACY_STATUS_MAP
        const legacyStatus = LEGACY_STATUS_MAP[currentStatus] || LEGACY_STATUS_MAP[currentStatus.toLowerCase()];
        
        if (legacyStatus) {
            const mappedIndex = STEPS.findIndex(step => step.match.includes(legacyStatus));
            if (mappedIndex !== -1) {
                activeStepIndex = mappedIndex;
            }
        } else {
            // Last resort string matching
            const lowerStatus = currentStatus.toLowerCase();
            if (lowerStatus.includes('pedindo') || lowerStatus.includes('pendente')) activeStepIndex = 0;
            else if (lowerStatus.includes('confirmado')) activeStepIndex = 1;
            else if (lowerStatus.includes('preparação') || lowerStatus.includes('preparo')) activeStepIndex = 2;
            else if (lowerStatus.includes('pronto')) activeStepIndex = 3;
            else if (lowerStatus.includes('saiu') || lowerStatus.includes('entrega')) activeStepIndex = 4;
            else if (lowerStatus.includes('entregue')) activeStepIndex = 5;
        }
    }
  }

  // Format date
  const date = new Date(order.criado_em);
  const formattedDate = `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerIcon}></div>
            <div className={styles.headerText}>
              <h2 className={styles.mainTitle}>Status do Pedido</h2>
              <p className={styles.subTitle}>
                Acompanhe o Status do seu Pedido <span className={styles.orderNumber}>#{order.numero_pedido || order.id.slice(0, 8)}</span> em tempo real
              </p>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className={styles.infoBar}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>NÚMERO DO PEDIDO</span>
            <span className={styles.infoValue}>#{order.numero_pedido || order.id.slice(0, 8)}</span>
          </div>
          <div className={styles.infoItem} style={{ textAlign: 'right' }}>
            <span className={styles.infoLabel}>PAGAMENTO</span>
            <span className={styles.infoValue}>{order.forma_pagamento || 'Pix'}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className={styles.timelineContainer}>
          {STEPS.map((step, index) => {
            let status = 'pending'; // pending, current, completed
            
            if (!isCancelled) {
              if (index < activeStepIndex) status = 'completed';
              else if (index === activeStepIndex) status = 'current';
            }

            return (
              <div key={step.key} className={styles.timelineStep}>
                <div className={styles.line} />
                <div className={`${styles.iconWrapper} ${styles[status]}`}>
                   {step.icon}
                </div>
                <div className={styles.stepContent}>
                  <h4 className={`${styles.stepTitle} ${styles[status + 'Text']}`}>
                    {step.label}
                  </h4>
                  {/* Show timestamp for completed steps if index matches (simulated for now based on image) */}
                  {(status === 'completed' || status === 'current') && (
                     <p className={styles.stepDescription} style={{fontSize: '0.75rem', marginTop: '2px'}}>
                       {index <= 1 ? formattedDate : step.description}
                     </p>
                  )}
                  {/* Show description for current step */}
                  {status === 'current' && step.description && index > 1 && (
                    <p className={styles.stepDescription}>
                      {step.description}
                    </p>
                  )}
                  {/* Show description for pending steps if needed */}
                  {status === 'pending' && step.description && (
                     <p className={`${styles.stepDescription} ${styles.pendingText}`}>
                       {step.description}
                     </p>
                  )}
                </div>
              </div>
            );
          })}

          {isCancelled ? (
            <div className={styles.timelineStep}>
              <div className={styles.line} />
              <div className={`${styles.iconWrapper} ${styles.cancelled}`}>
                {cancelledByClient ? <X size={18} /> : cancelledByStore ? <AlertTriangle size={18} /> : <X size={18} />}
              </div>
              <div className={styles.stepContent}>
                <h4 className={`${styles.stepTitle} ${styles.cancelledText}`}>
                  {cancelledByClient
                    ? ORDER_STATUS_LABEL[OrderStatus.CANCELADO_CLIENTE]
                    : cancelledByStore
                      ? ORDER_STATUS_LABEL[OrderStatus.CANCELADO_ESTABELECIMENTO]
                      : 'Cancelado'}
                </h4>
                <p className={styles.stepDescription}>
                  {cancelledByClient ? 'Solicitação do usuário' : cancelledByStore ? 'Indisponibilidade ou imprevisto' : 'Cancelado'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.footerBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
