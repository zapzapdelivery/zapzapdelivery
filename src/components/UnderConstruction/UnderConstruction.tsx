import React from 'react';
import { Construction, Calendar } from 'lucide-react';
import styles from './UnderConstruction.module.css';

interface UnderConstructionProps {
  title: string;
  launchDate?: string;
}

export function UnderConstruction({ title, launchDate }: UnderConstructionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <Construction size={48} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>
        Estamos trabalhando duro para trazer novidades incríveis nesta seção.
        <br />
        Em breve você terá acesso a todas as funcionalidades.
      </p>
      {launchDate && (
        <div className={styles.launchDate}>
          <Calendar size={18} />
          <span>Previsão de lançamento: {launchDate}</span>
        </div>
      )}
    </div>
  );
}
