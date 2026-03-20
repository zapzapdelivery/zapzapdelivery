'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { useRouter } from 'next/navigation';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'cancel' | 'payment';
  link: string;
  read: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  playNotificationSound: (repeats?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { establishmentId } = useUserRole();
  const audioContextRef = useRef<AudioContext | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize AudioContext on user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
        }
      }
      
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.error('AudioContext resume failed:', e));
      }
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('keydown', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('keydown', initAudio);
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playNotificationSound = (repeats = 1) => {
    try {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) audioContextRef.current = new AudioContext();
        }

        const ctx = audioContextRef.current;
        if (!ctx) return;
        
        if (ctx.state === 'suspended') {
             ctx.resume().catch(() => {});
        }

        const playTone = (startTime: number, freqStart: number, freqEnd: number, duration: number, volume: number, type: OscillatorType) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = type;
            osc.frequency.setValueAtTime(freqStart, startTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startTime + Math.max(0.01, duration * 0.75));
            
            gain.gain.setValueAtTime(volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(0.01, duration));
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        const isOrderSound = repeats >= 2;
        for (let i = 0; i < repeats; i++) {
            const base = now + i * (isOrderSound ? 0.9 : 0.4);
            if (isOrderSound) {
              // Som de "alerta/campainha" forte
              playTone(base, 1200, 1150, 0.2, 0.9, 'triangle');
              playTone(base + 0.15, 1200, 1150, 0.2, 0.9, 'triangle');
              playTone(base + 0.3, 1500, 1400, 0.5, 1.0, 'triangle');
            } else {
              playTone(base, 880, 440, 0.15, 0.3, 'sine'); // Aumentado um pouco o volume do som de cancelamento/pagamento (era 0.16)
            }
        }
    } catch (e) {
        console.error('Error playing notification sound:', e);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    // Toca som forte e prolongado (3 repetições) para novos pedidos
    if (notification.type === 'order') {
      playNotificationSound(3);
    } else {
      playNotificationSound(1);
    }
  };

  useEffect(() => {
    if (!establishmentId) return;

    console.log('Iniciando sistema de notificações para estabelecimento:', establishmentId);

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `estabelecimento_id=eq.${establishmentId}`,
        },
        (payload) => {
          console.log('Evento recebido:', payload);
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT') {
            // Novo Pedido
            addNotification({
              title: 'Novo Pedido',
              message: `Pedido #${newRecord.numero_pedido || newRecord.id.slice(0, 8)} recebido!`,
              type: 'order',
              link: `/pedidos`,
            });
          } else if (eventType === 'UPDATE') {
            // Cancelamento pelo cliente
            if (newRecord.status === 'CANCELADO_CLIENTE' && oldRecord.status !== 'CANCELADO_CLIENTE') {
              addNotification({
                title: 'Pedido Cancelado',
                message: `Pedido #${newRecord.numero_pedido || newRecord.id.slice(0, 8)} cancelado pelo cliente.`,
                type: 'cancel',
                link: `/pedidos`,
              });
            }

            // Pagamento confirmado via PIX
            if (
              newRecord.status_pagamento === 'aprovado' && 
              oldRecord.status_pagamento !== 'aprovado' &&
              newRecord.forma_pagamento === 'pix'
            ) {
              addNotification({
                title: 'Pagamento Confirmado',
                message: `Pagamento PIX confirmado para o pedido #${newRecord.numero_pedido || newRecord.id.slice(0, 8)}.`,
                type: 'payment',
                link: `/pedidos`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      removeNotification,
      playNotificationSound 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
