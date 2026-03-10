'use client';

import React, { useState } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { 
  Calendar,
  Clock, 
  Save, 
  Loader2,
  Trash2,
  Plus,
  X,
  Lightbulb
} from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';

interface TimeSlot {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  day: string;
  isOpen: boolean;
  slots: TimeSlot[];
}

interface Exception {
  id: string;
  date: string; // Used for display "25 DE DEZEMBRO"
  description: string; // Used for display "Natal (Fechado o dia todo)"
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
  
  // Initialize with mock data based on the image
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map((day, index) => {
      // Mock data logic
      const isMonday = index === 0;
      const isTuesday = index === 1;
      const isWeekend = index >= 5;

      let slots: TimeSlot[] = [];
      
      if (isMonday) {
        slots = [
          { id: '1', start: '08:00', end: '12:00' },
          { id: '2', start: '06:00', end: '11:00' } // Intentionally using image data even if weird
        ];
      } else if (!isTuesday) {
        slots = [
          { id: `s-${index}`, start: '06:00', end: '11:30' }
        ];
      }

      return {
        day,
        isOpen: !isTuesday, // Tuesday closed in image
        slots
      };
    })
  );

  const [exceptions, setExceptions] = useState<Exception[]>([
    { id: '1', date: '25 DE DEZEMBRO', description: 'Natal (Fechado o dia todo)' },
    { id: '2', date: '01 DE JANEIRO', description: 'Ano Novo (18h às 23h)' }
  ]);

  const handleDayToggle = (index: number) => {
    setSchedule(prev => prev.map((item, i) => 
      i === index ? { ...item, isOpen: !item.isOpen } : item
    ));
  };

  const handleTimeChange = (dayIndex: number, slotId: string, field: 'start' | 'end', value: string) => {
    setSchedule(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      return {
        ...day,
        slots: day.slots.map(slot => 
          slot.id === slotId ? { ...slot, [field]: value } : slot
        )
      };
    }));
  };

  const addTimeSlot = (dayIndex: number) => {
    setSchedule(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const newSlot: TimeSlot = {
        id: Math.random().toString(36).substr(2, 9),
        start: '08:00',
        end: '18:00'
      };
      return { ...day, slots: [...day.slots, newSlot] };
    }));
  };

  const removeTimeSlot = (dayIndex: number, slotId: string) => {
    setSchedule(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      return { ...day, slots: day.slots.filter(s => s.id !== slotId) };
    }));
  };

  const replicateMonday = () => {
    const mondaySlots = schedule[0].slots;
    setSchedule(prev => prev.map((day, index) => {
      if (index === 0) return day; // Skip Monday
      return {
        ...day,
        isOpen: true,
        slots: mondaySlots.map(s => ({ ...s, id: Math.random().toString(36).substr(2, 9) }))
      };
    }));
    success('Horários de segunda-feira replicados para todos os dias!');
  };

  const removeException = (id: string) => {
    setExceptions(prev => prev.filter(e => e.id !== id));
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
          subtitle="Defina os períodos em que seu estabelecimento estará aberto para receber pedidos no WhatsApp." 
        />

        <div className={styles.contentWrapper}>
          {/* Left Column: Weekly Schedule */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Calendar className={styles.icon} />
                <span>Grade Semanal</span>
              </h2>
              
              <button onClick={replicateMonday} className={styles.replicateLink}>
                REPLICAR SEGUNDA PARA TODOS
              </button>
            </div>

            <div className={styles.scheduleList}>
              {schedule.map((day, index) => (
                <div key={day.day} className={styles.dayRow}>
                  {/* Toggle */}
                  <label className={styles.toggleSwitch}>
                    <input 
                      type="checkbox" 
                      checked={day.isOpen}
                      onChange={() => handleDayToggle(index)}
                    />
                    <span className={styles.slider}></span>
                  </label>

                  {/* Day Name */}
                  <div className={styles.dayName}>{day.day}</div>
                  
                  {/* Hours Column */}
                  <div className={styles.hoursColumn}>
                    {day.isOpen ? (
                      <>
                        {day.slots.map(slot => (
                          <div key={slot.id} className={styles.timeSlot}>
                            <input 
                              type="time" 
                              value={slot.start}
                              onChange={(e) => handleTimeChange(index, slot.id, 'start', e.target.value)}
                              className={styles.hourInput}
                            />
                            <Clock className={styles.clockIcon} />
                            <span className={styles.timeSeparator}>até</span>
                            <input 
                              type="time" 
                              value={slot.end}
                              onChange={(e) => handleTimeChange(index, slot.id, 'end', e.target.value)}
                              className={styles.hourInput}
                            />
                            <Clock className={styles.clockIcon} />
                            
                            <button 
                              onClick={() => removeTimeSlot(index, slot.id)}
                              className={styles.removeSlotBtn}
                              title="Remover turno"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => addTimeSlot(index)}
                          className={styles.addTurnBtn}
                        >
                          <Plus size={16} />
                          Adicionar turno
                        </button>
                      </>
                    ) : (
                      <span className={styles.closedText}>Estabelecimento fechado para pedidos.</span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className={`${styles.statusBadge} ${day.isOpen ? styles.statusOpen : styles.statusClosed}`}>
                    {day.isOpen ? 'ABERTO' : 'FECHADO'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Exceptions & Tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Exceptions Card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  <Calendar className={styles.icon} />
                  <span>Exceções e Feriados</span>
                </h2>
              </div>
              
              <div className={styles.exceptionsList}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Adicione datas específicas em que o horário será diferente do padrão (ex: feriados).
                </p>

                {exceptions.map(exception => (
                  <div key={exception.id} className={styles.exceptionItem}>
                    <div className={styles.exceptionDate}>{exception.date}</div>
                    <div className={styles.exceptionDesc}>{exception.description}</div>
                    <button 
                      onClick={() => removeException(exception.id)}
                      className={styles.removeExceptionBtn}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                <button className={styles.addExceptionBtn}>
                  <Plus size={20} />
                  <span>Adicionar exceção</span>
                </button>
              </div>
            </div>

            {/* Pro Tip Card */}
            <div className={styles.tipCard}>
              <Lightbulb className={styles.tipIcon} size={24} />
              <div className={styles.tipContent}>
                <h3>Dica de mestre</h3>
                <p>
                  Mantenha seus horários atualizados para evitar que clientes peçam pelo WhatsApp quando você estiver offline.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className={styles.footerActions}>
            <Link href="/dashboard">
              <button className={styles.cancelButton}>
                CANCELAR
              </button>
            </Link>
            
            <button 
              onClick={handleSave} 
              disabled={saving}
              className={styles.saveButton}
            >
              {saving ? (
                <>
                  <Loader2 className={styles.loader} />
                  <span>SALVANDO...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>SALVAR ALTERAÇÕES</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
