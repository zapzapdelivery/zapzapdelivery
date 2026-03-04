
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, Loader2, AlertCircle } from 'lucide-react';
import styles from './PixModal.module.css';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: any;
  loading: boolean;
  error?: string | null;
}

export function PixModal({ isOpen, onClose, pixData, loading, error }: PixModalProps) {
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
              
              {pixData.date_expiration && (
                <div className={styles.expiration}>
                  <p>Expira em: {new Date(pixData.date_expiration).toLocaleString('pt-BR')}</p>
                </div>
              )}

              <div className={styles.statusInfo}>
                <p>Status: <strong>{pixData.status === 'pending' ? 'Pendente' : pixData.status}</strong></p>
                {pixData.status_detail && <p className={styles.detail}>{pixData.status_detail}</p>}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
