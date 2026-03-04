import React from 'react';
import { Eye } from 'lucide-react';
import styles from './ViewDetailsModal.module.css';

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: Record<string, any> | null;
  labels?: Record<string, string>;
}

export function ViewDetailsModal({
  isOpen,
  onClose,
  title,
  data,
  labels
}: ViewDetailsModalProps) {
  if (!isOpen || !data) return null;

  // Se labels não for fornecido, usa as chaves do objeto data
  const keys = Object.keys(data);
  const displayKeys = labels ? Object.keys(labels).filter(key => key in data) : keys;
  const initials = String(data?.name || 'E').substring(0, 2).toUpperCase();

  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    if (React.isValidElement(value)) return value;
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') {
        // Se for data, tenta formatar
        if (value instanceof Date) return value.toLocaleDateString('pt-BR');
        return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <Eye size={28} />
          </div>
          <div className={styles.headerBrand}>
            <div className={styles.logoCircle}>
              {data?.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt={String(data?.name || '')}
                  className={styles.logoImg}
                />
              ) : (
                initials
              )}
            </div>
            <div className={styles.headerTexts}>
              <div className={styles.title}>{title}</div>
              {data?.name && <div className={styles.subtitle}>{String(data.name)}</div>}
            </div>
          </div>
        </div>
        
        <div className={styles.content}>
          <div className={styles.detailsList}>
            {displayKeys.map((key) => {
              const label = labels ? labels[key] : key;
              const value = data[key];
              
              // Pula renderização se labels foi fornecido mas a chave não está nele (já filtrado acima),
              // ou se quisermos lógica específica de ocultação (ex: id interno).
              // Aqui assumimos que se está em displayKeys, deve mostrar.
              
              return (
                <div key={key} className={styles.detailItem}>
                  <span className={styles.label}>{label}</span>
                  <span className={styles.value}>{formatValue(value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnClose} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
