'use client';

import React, { useState } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { 
  Clock, 
  Save, 
  Loader2 
} from 'lucide-react';
import styles from './page.module.css';

interface DaySchedule {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const DAYS_OF_WEEK = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

export default function HorariosPage() {
  const { openSidebar } = useSidebar();
  const { success, error: toastError } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Initialize with default schedule
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map(day => ({
      day,
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00'
    }))
  );

  const handleDayToggle = (index: number) => {
    setSchedule(prev => prev.map((item, i) => 
      i === index ? { ...item, isOpen: !item.isOpen } : item
    ));
  };

  const handleTimeChange = (index: number, field: 'openTime' | 'closeTime', value: string) => {
    setSchedule(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      success('Horários salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toastError('Erro ao salvar horários. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <MobileHeader 
        onMenuClick={openSidebar} 
        title="Horários"
      />
      
      <main className={styles.mainContent}>
        <AdminHeader 
          title="Horários de Funcionamento" 
          subtitle="Configure os dias e horários que seu estabelecimento está aberto." 
        />

        <div className={styles.contentWrapper}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Clock className={styles.icon} />
                <span>Horários Semanais</span>
              </h2>
              
              <button 
                onClick={handleSave} 
                disabled={saving}
                className={styles.saveButton}
              >
                {saving ? (
                  <>
                    <Loader2 className={styles.loader} />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className={styles.smallIcon} />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>

            <div className={styles.scheduleList}>
              {schedule.map((day, index) => (
                <div key={day.day} className={styles.dayRow}>
                  <div className={styles.dayName}>{day.day}</div>
                  
                  <div className={styles.hoursContainer}>
                    {day.isOpen ? (
                      <>
                        <input 
                          type="time" 
                          value={day.openTime}
                          onChange={(e) => handleTimeChange(index, 'openTime', e.target.value)}
                          className={styles.hourInput}
                        />
                        <span>até</span>
                        <input 
                          type="time" 
                          value={day.closeTime}
                          onChange={(e) => handleTimeChange(index, 'closeTime', e.target.value)}
                          className={styles.hourInput}
                        />
                      </>
                    ) : (
                      <span className="text-gray-400 italic">Fechado</span>
                    )}
                  </div>

                  <label className={styles.toggleSwitch}>
                    <input 
                      type="checkbox" 
                      checked={day.isOpen}
                      onChange={() => handleDayToggle(index)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
