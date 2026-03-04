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

// Simple notification sound (beep)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { establishmentId } = useUserRole();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio(NOTIFICATION_SOUND);
  }, []);

  const playNotificationSound = (repeats = 1) => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    // Reset previous state
    audio.pause();
    audio.currentTime = 0;
    audio.onended = null;

    let playedCount = 0;

    const play = () => {
        audio.play().catch(e => console.error('Error playing sound:', e));
        playedCount++;
    };

    if (repeats > 1) {
        audio.onended = () => {
            if (playedCount < repeats) {
                audio.currentTime = 0;
                play();
            } else {
                audio.onended = null;
            }
        };
    }

    play();
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    // Repeat 3 times for new orders, 1 time for others
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
