import React from 'react';
import styles from './skeleton.module.css';

export function KanbanSkeleton() {
  // Simulate 5 columns to match the usual statuses
  const columns = Array.from({ length: 5 });
  
  return (
    <div className={styles.skeletonContainer}>
      {columns.map((_, colIndex) => (
        <div key={colIndex} className={styles.skeletonColumn}>
          <div className={styles.skeletonHeader}>
            <div className={`${styles.shimmer} ${styles.skeletonTitle}`} style={{ width: '120px' }}></div>
            <div className={`${styles.shimmer} ${styles.skeletonBadge}`} style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
          </div>
          <div className={styles.skeletonContent}>
            {/* Deterministic number of cards per column to avoid hydration mismatch */}
            {Array.from({ length: (colIndex % 3) + 1 }).map((_, cardIndex) => (
              <div key={cardIndex} className={styles.skeletonCard}>
                <div className={styles.skeletonRow} style={{ justifyContent: 'space-between' }}>
                  <div className={`${styles.shimmer} ${styles.skeletonText}`} style={{ width: '60px' }}></div>
                  <div className={`${styles.shimmer} ${styles.skeletonText}`} style={{ width: '80px' }}></div>
                </div>
                
                <div className={styles.skeletonRow}>
                  <div className={`${styles.shimmer} ${styles.skeletonAvatar}`}></div>
                  <div style={{ flex: 1 }}>
                    <div className={`${styles.shimmer} ${styles.skeletonText}`} style={{ width: '70%', marginBottom: '0.5rem' }}></div>
                    <div className={`${styles.shimmer} ${styles.skeletonText}`} style={{ width: '40%' }}></div>
                  </div>
                </div>

                <div className={styles.skeletonRow} style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <div className={`${styles.shimmer} ${styles.skeletonText}`} style={{ width: '80px', height: '1.5rem' }}></div>
                  <div className={styles.skeletonRow}>
                    <div className={`${styles.shimmer}`} style={{ width: '24px', height: '24px', borderRadius: '4px' }}></div>
                    <div className={`${styles.shimmer}`} style={{ width: '24px', height: '24px', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
