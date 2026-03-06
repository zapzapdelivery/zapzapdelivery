
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, Loader2, AlertCircle, CheckCircle, Check } from 'lucide-react';
import styles from './PixModal.module.css';
import { useRouter } from 'next/navigation';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: any;
  loading: boolean;
  error?: string | null;
  onPaymentConfirmed?: () => void;
  orderId?: string | null;
}

export function PixModal({ isOpen, onClose, pixData, loading, error, onPaymentConfirmed, orderId: propOrderId }: PixModalProps) {
  const router = useRouter();
  const [currentPixData, setCurrentPixData] = useState<any>(pixData);
  const [status, setStatus] = useState<string>(pixData?.status || 'pending');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getOrderId = () => {
      // Prioridade: Prop explicita > orderId no pixData > id no pixData (se for string/UUID)
      if (propOrderId) return propOrderId;
      if (currentPixData?.orderId) return currentPixData.orderId;
      if (typeof currentPixData?.id === 'string' && currentPixData.id.includes('-')) return currentPixData.id;
      return null;
  };

  const handleRetry = async () => {
    const orderId = getOrderId();
    if (!orderId) {
        console.error('PixModal: Order ID não encontrado para reativação');
        setRetryError('Erro interno: ID do pedido não encontrado.');
        return;
    }
    
    setIsRetrying(true);
    setRetryError(null);
    
    try {
      console.log(`[PixModal] Tentando reativar pedido ${orderId}...`);
      const res = await fetch(`/api/pedidos/${orderId}/reativar`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.success) {
        setStatus('pending');
        setTimeLeft('Aguarde...');
        
        // Se a API retornou os dados do novo pagamento (incluindo QR Code), usa eles direto
        if (data.qr_code) {
            setCurrentPixData(data);
        } else {
            // Fallback: Força uma atualização imediata dos dados do PIX buscando na rota /pix
            const pixRes = await fetch(`/api/pedidos/${orderId}/pix`);
            if (pixRes.ok) {
                const pixData = await pixRes.json();
                setCurrentPixData(pixData);
            }
        }

        // Notifica o pai para atualizar a lista (voltar para 'Pedindo')
        if (onPaymentConfirmed) {
            onPaymentConfirmed();
        }
      } else {
        setRetryError(data.error || 'Não foi possível reativar o pedido. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao reativar:', error);
      setRetryError('Erro de conexão ao tentar reativar. Verifique sua internet.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleExpire = async () => {
    const orderId = getOrderId();
    if (!orderId) {
        console.error('PixModal: Order ID não encontrado para expiração');
        return;
    }

    try {
        console.log(`[PixModal] Expirando pedido ${orderId}...`);
        const response = await fetch(`/api/pedidos/${orderId}/cancelar-pix`, { method: 'POST' });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[PixModal] Erro na resposta da API de cancelamento:', response.status, errorData);
        } else {
            console.log('[PixModal] Pedido cancelado com sucesso.');
        }

        // Notificar o pai para atualizar a lista (Status -> Cancelado)
        if (onPaymentConfirmed) onPaymentConfirmed();
    } catch (err) {
        console.error('Erro ao cancelar pedido expirado:', err);
    }
  };

  // Sync currentPixData with prop pixData when it changes
  useEffect(() => {
    if (pixData) {
      setCurrentPixData(pixData);
      setStatus(pixData.status);
    }
  }, [pixData]);

  // Update timeLeft based on currentPixData
  useEffect(() => {
    if (currentPixData) {
      // Verificação imediata de expiração
      if (currentPixData.date_expiration) {
        const now = new Date().getTime();
        const expiration = new Date(currentPixData.date_expiration).getTime();
        if (now > expiration) {
          setTimeLeft('EXPIRADO');
        }
      }
    }
  }, [currentPixData]);

  // Efeito para polling de status
  useEffect(() => {
    const orderId = getOrderId();
    if (!isOpen || !orderId || status === 'approved' || status === 'cancelled') return;

    const checkStatus = async () => {
      try {
        setIsChecking(true);
        // Usa o ID do pedido para a rota /pix (que espera ID do pedido no params)
        const res = await fetch(`/api/pedidos/${orderId}/pix`);
        if (res.ok) {
          const data = await res.json();
          // Sempre atualiza os dados do PIX (incluindo data de expiração)
          setCurrentPixData((prev: any) => ({ ...prev, ...data }));
          
          if (data.status !== status) {
            setStatus(data.status);
            if (data.status === 'approved' && onPaymentConfirmed) {
              onPaymentConfirmed();
            } else if (data.status === 'cancelled' && onPaymentConfirmed) {
              // Notifica o pai para atualizar a lista quando expirar/cancelar
              onPaymentConfirmed();
            }
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status:', err);
      } finally {
        setIsChecking(false);
      }
    };

    const interval = setInterval(checkStatus, 5000); // 5 segundos
    return () => clearInterval(interval);
  }, [isOpen, currentPixData, status, onPaymentConfirmed, propOrderId]);

  // Timer de Expiração (MODO REAL: Baseado no Mercado Pago)
  useEffect(() => {
    if (!currentPixData?.date_expiration) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      // const expiration = new Date(currentPixData.date_expiration).getTime();
      
      // TESTE: Expirar em 30s a partir da criação (Front-end only)
      // Usamos date_created + 30s para teste rápido de expiração
      const createdTime = currentPixData.date_created 
        ? new Date(currentPixData.date_created).getTime() 
        : new Date().getTime(); // Fallback para agora se não tiver data de criação (evita NaN)
        
      const expiration = createdTime + 30000; 
      
      const distance = expiration - now;

      if (distance < 0) {
        setTimeLeft('EXPIRADO');
        handleExpire();
        clearInterval(interval);
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPixData]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    if (currentPixData?.qr_code) {
      navigator.clipboard.writeText(currentPixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>
        
        <h2 className={styles.title}>Pagamento via PIX</h2>
        
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <Loader2 className={styles.spinner} size={48} />
              <p>Carregando dados do PIX...</p>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <AlertCircle size={48} color="#ef4444" />
              <p>{error}</p>
            </div>
          ) : currentPixData ? (
            <>
              {status === 'approved' ? (
                <div className={styles.successContainer}>
                  <CheckCircle size={64} color="#22c55e" />
                  <h3>Pagamento Confirmado!</h3>
                  <p>Seu pedido está sendo preparado.</p>
                  <button onClick={onClose} className={styles.closeSuccessBtn}>
                    Fechar
                  </button>
                </div>
              ) : timeLeft === 'EXPIRADO' || status === 'cancelled' ? (
                <div className={styles.expiredContainer}>
                  <AlertCircle size={64} color="#ef4444" />
                  <h3>PIX Expirado ou Cancelado</h3>
                  <p>Este código PIX expirou ou o pedido foi cancelado. Por favor, realize um novo pedido ou tente pagar novamente.</p>
                  
                  {retryError && (
                    <div className={styles.retryErrorMsg}>
                      {retryError}
                    </div>
                  )}

                  <div className={styles.expiredActions}>
                    <button 
                      onClick={handleRetry} 
                      className={styles.retryBtn}
                      disabled={isRetrying}
                    >
                      {isRetrying ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Loader2 size={16} className={styles.spinSmall} />
                          Reativando...
                        </div>
                      ) : (
                        'Pagar Novamente'
                      )}
                    </button>
                    <button onClick={onClose} className={styles.closeExpiredBtn}>
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.qrContainer}>
                    <QRCodeSVG value={currentPixData.qr_code} size={220} />
                  </div>
                  
                  <p className={styles.instruction}>
                    Escaneie o QR Code com seu aplicativo de banco ou use o código Copia e Cola abaixo:
                  </p>
                  
                  <div className={styles.copyContainer}>
                    <input 
                      type="text" 
                      value={currentPixData.qr_code || ''} 
                      readOnly 
                      className={styles.copyInput}
                    />
                    <button onClick={copyToClipboard} className={styles.copyBtn} title="Copiar código">
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                  
                  <div className={styles.statusContainer}>
                    {currentPixData.date_expiration && (
                      <div className={styles.expiration}>
                        <p>Expira em: <span className={styles.timer}>{timeLeft}</span></p>
                      </div>
                    )}

                    <div className={styles.statusInfo}>
                      <div className={styles.loadingStatus}>
                         <Loader2 className={styles.spinSmall} size={16} />
                         <p>Aguardando pagamento...</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
