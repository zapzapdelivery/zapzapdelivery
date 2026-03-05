
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './PixModal.module.css';
import { useRouter } from 'next/navigation';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: any;
  loading: boolean;
  error?: string | null;
  onPaymentConfirmed?: () => void;
}

export function PixModal({ isOpen, onClose, pixData, loading, error, onPaymentConfirmed }: PixModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(pixData?.status || 'pending');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  // Reset status when pixData changes
  useEffect(() => {
    if (pixData) {
      setStatus(pixData.status);
    }
  }, [pixData]);

  // Efeito para polling de status
  useEffect(() => {
    if (!isOpen || !pixData?.id || status === 'approved' || status === 'cancelled') return;

    const checkStatus = async () => {
      try {
        setIsChecking(true);
        const res = await fetch(`/api/pedidos/${pixData.orderId || pixData.id}/pix`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== status) {
            setStatus(data.status);
            if (data.status === 'approved' && onPaymentConfirmed) {
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
  }, [isOpen, pixData, status, onPaymentConfirmed]);

  // Timer de Expiração
  useEffect(() => {
    if (!pixData?.date_expiration) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiration = new Date(pixData.date_expiration).getTime();
      const distance = expiration - now;

      if (distance < 0) {
        setTimeLeft('EXPIRADO');
        clearInterval(interval);
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pixData]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      alert('Código PIX copiado!');
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
          ) : pixData ? (
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
                  <p>Este código PIX expirou ou o pedido foi cancelado. Por favor, realize um novo pedido.</p>
                  <button onClick={onClose} className={styles.closeExpiredBtn}>
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.qrContainer}>
                    <QRCodeSVG value={pixData.qr_code} size={220} />
                  </div>
                  
                  <p className={styles.instruction}>
                    Escaneie o QR Code com seu aplicativo de banco ou use o código Copia e Cola abaixo:
                  </p>
                  
                  <div className={styles.copyContainer}>
                    <input 
                      type="text" 
                      value={pixData.qr_code} 
                      readOnly 
                      className={styles.copyInput}
                    />
                    <button onClick={copyToClipboard} className={styles.copyBtn} title="Copiar código">
                      <Copy size={20} />
                    </button>
                  </div>
                  
                  <div className={styles.statusContainer}>
                    {pixData.date_expiration && (
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
