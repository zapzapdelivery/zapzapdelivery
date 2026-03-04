import React from 'react';
import { Trash2 } from 'lucide-react';
import styles from './DeleteConfirmationModal.module.css';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title: string;
  description: React.ReactNode;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  title,
  description
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={isDeleting ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.deleteIconWrap}>
          <Trash2 size={24} className={styles.deleteIcon} />
        </div>
        <div className={styles.deleteTitle}>{title}</div>
        <div className={styles.deleteDesc}>
          {description}
        </div>
        <div className={styles.modalDivider}></div>
        <div className={styles.modalFooter}>
          <button 
            className={styles.btnCancel} 
            onClick={onClose} 
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button 
            className={styles.btnDeleteConfirm} 
            onClick={onConfirm} 
            disabled={isDeleting}
          >
            {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
