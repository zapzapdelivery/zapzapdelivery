import React from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './UnsavedChangesModal.module.css';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <AlertTriangle className={styles.icon} size={24} />
          </div>
          <h2 className={styles.title}>Alterações não salvas</h2>
        </div>
        
        <div className={styles.content}>
          <p className={styles.description}>
            Você tem alterações que ainda não foram salvas. Se você sair agora, todas as modificações serão perdidas.
          </p>
          <p className={styles.subDescription}>
            Deseja realmente descartar as alterações e sair?
          </p>
        </div>

        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.stayButton} 
            onClick={onClose}
          >
            Permanecer na página
          </button>
          <button 
            type="button" 
            className={styles.discardButton} 
            onClick={onConfirm}
          >
            Descartar alterações
          </button>
        </div>
      </div>
    </div>
  );
};
