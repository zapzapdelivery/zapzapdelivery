import React from 'react';
import styles from './loading.module.css';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message = 'Carregando...', fullScreen = false }: LoadingProps) {
  return (
    <div 
      className={styles.container}
      style={fullScreen ? { minHeight: '100vh' } : undefined}
    >
      <Loader2 className={styles.spinner} size={48} />
      {message && <span className={styles.message}>{message}</span>}
    </div>
  );
}
