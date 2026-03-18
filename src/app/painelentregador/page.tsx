"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import styles from './painelentregador.module.css';
import { OrderStatus } from '@/types/orderStatus';
import { Loading } from '@/components/Loading/Loading';
import { 
  LayoutDashboard, 
  Truck, 
  Wallet, 
  User, 
  Bike, 
  MapPin, 
  LogOut, 
  Bell, 
  MessageCircle, 
  Store, 
  Navigation,
  Trophy,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
  Loader2,
  Ban,
  Menu,
  X
} from 'lucide-react';

export default function PainelEntregador() {
  const router = useRouter();
  const { role, establishmentId, loading } = useUserRole();
  const [userName, setUserName] = useState('Usuário');
  const [isOnline, setIsOnline] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'inicio' | 'minhas_entregas'>('inicio');
  const [alertsMode, setAlertsMode] = useState<'off' | 'som' | 'push'>('som');
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    document.title = 'ZapZap Delivery - Entregador';
  }, []);
  const [stats, setStats] = useState({
    entregasHoje: 0,
    faturamentoTotal: 0,
    taxaAceitacao: 0,
    avaliacaoMedia: 0
  });
  const [currentDeliveries, setCurrentDeliveries] = useState<any[]>([]);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [ganhos, setGanhos] = useState({ dia: 0, semana: 0, mes: 0 });
  const [entregues, setEntregues] = useState<any[]>([]);
  const [entreguesPage, setEntreguesPage] = useState(1);
  const [entreguesHasMore, setEntreguesHasMore] = useState(true);
  const [entreguesPerPage, setEntreguesPerPage] = useState(8);
  const [entreguesLoading, setEntreguesLoading] = useState(false);
  const [prontosPage, setProntosPage] = useState(1);
  const [prontosPerPage, setProntosPerPage] = useState(8);
  const [aceitosPage, setAceitosPage] = useState(1);
  const [aceitosPerPage, setAceitosPerPage] = useState(8);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const [incomingAccepting, setIncomingAccepting] = useState(false);
  const [finishingOrderId, setFinishingOrderId] = useState<string | null>(null);
  const fetchInFlightRef = useRef(false);
  const fetchEntreguesInFlightRef = useRef(false);
  const lastAvailableOrdersRef = useRef<Set<string> | null>(null);
  const declinedOrdersRef = useRef<Map<string, number>>(new Map());
  const modalTimerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pushEnsuredRef = useRef(false);
  const timeZone = 'America/Sao_Paulo';

  const PER_PAGE_OPTIONS = [8, 10, 20, 30, 50, 100];
  const REOFFER_AFTER_MS = 45000;

  const getInitials = (name: string) => {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
    const raw = `${first}${last}`.toUpperCase();
    return raw || 'U';
  };

  const handleNavTo = (section: 'inicio' | 'minhas_entregas') => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const handleComingSoon = () => {
    setNotification({ type: 'error', message: 'Em breve.' });
    setMobileMenuOpen(false);
  };

  const toggleAlertsMode = async () => {
    const nextMode = alertsMode === 'off' ? 'som' : alertsMode === 'som' ? 'push' : 'off';
    setAlertsMode(nextMode);
    if (nextMode === 'push') {
      const ok = await ensurePushSubscription();
      if (!ok) {
        setNotification({ type: 'error', message: 'Não foi possível ativar push neste dispositivo.' });
        return;
      }
      await showBrowserNotification('Notificações ativadas', 'Você vai receber alertas de pedido pronto.');
      setNotification({ type: 'success', message: 'Alertas: Push + Som' });
      vibrate([80, 50, 80]);
      await beep();
      return;
    }
    if (nextMode === 'som') {
      setNotification({ type: 'success', message: 'Alertas: Som' });
      vibrate(80);
      const ok = await beep();
      if (!ok) setNotification({ type: 'error', message: 'Som bloqueado. Toque na tela e tente novamente.' });
      return;
    }
    setNotification({ type: 'success', message: 'Alertas: Desligado' });
  };

  const cleanExpiredDeclines = (now: number) => {
    const map = declinedOrdersRef.current;
    if (!map || map.size === 0) return;
    for (const [orderId, ts] of map.entries()) {
      if (now - ts >= REOFFER_AFTER_MS) {
        map.delete(orderId);
      }
    }
  };

  const pickNextAvailableOrder = (orders: any[]) => {
    const now = Date.now();
    cleanExpiredDeclines(now);
    const declined = declinedOrdersRef.current;
    const sorted = Array.isArray(orders) ? [...orders] : [];
    sorted.sort((a, b) => {
      const ta = new Date(a?.criado_em || 0).getTime();
      const tb = new Date(b?.criado_em || 0).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });
    for (const o of sorted) {
      const id = String(o?.id || '');
      if (!id) continue;
      if (declined?.has(id)) continue;
      return o;
    }
    return null;
  };

  const clampPage = (page: number, totalPages: number) => {
    const safeTotal = Math.max(1, totalPages);
    const safePage = Math.max(1, Number(page) || 1);
    return Math.min(safePage, safeTotal);
  };

  const calcTotalPages = (totalItems: number, perPage: number) => {
    const p = Math.max(1, Number(perPage) || 1);
    return Math.max(1, Math.ceil((Number(totalItems) || 0) / p));
  };

  const formatHour = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone });
  };

  const getClienteEnderecoCompleto = (pedido: any) => {
    const addr = pedido?.cliente?.enderecos?.[0];
    if (!addr) return '';

    const firstLineParts = [addr.endereco, addr.numero].filter(Boolean);
    const firstLine = firstLineParts.join(', ');

    const midParts = [addr.complemento, addr.bairro].filter(Boolean);
    const mid = midParts.join(' - ');

    const cityUf = [addr.cidade, addr.uf].filter(Boolean).join('/');

    const tailParts = [cityUf, addr.cep ? `CEP ${addr.cep}` : null].filter(Boolean);
    const tail = tailParts.join(' - ');

    return [firstLine, mid, tail].filter(Boolean).join(', ');
  };

  const getGoogleMapsUrl = (address: string) => {
    const a = (address || '').trim();
    if (!a) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
  };

  const formatBRL = (value: any) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getWhatsAppUrl = (rawPhone: string, message: string) => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (!digits) return '';
    const normalized = digits.startsWith('55')
      ? digits
      : digits.length === 10 || digits.length === 11
        ? `55${digits}`
        : digits;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message || '')}`;
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('entregador_alerts_mode');
    if (raw === 'off' || raw === 'som' || raw === 'push') {
      setAlertsMode(raw);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileViewport(Boolean(mql.matches));
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('entregador_alerts_mode', alertsMode);
  }, [alertsMode]);

  useEffect(() => {
    if (loading) return;
    if (!role || (role !== 'entregador' && role !== 'admin')) return;
    if (alertsMode !== 'push') {
      pushEnsuredRef.current = false;
      return;
    }
    if (pushEnsuredRef.current) return;
    pushEnsuredRef.current = true;
    ensurePushSubscription()
      .then((ok) => {
        if (!ok) setNotification({ type: 'error', message: 'Não foi possível ativar push neste dispositivo.' });
      })
      .catch(() => {
        setNotification({ type: 'error', message: 'Não foi possível ativar push neste dispositivo.' });
      });
  }, [alertsMode, role, loading]);

  useEffect(() => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ensureAudio = async () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume();
        }
      } catch {}
    };

    const onFirstInteraction = () => {
      ensureAudio().finally(() => {});
      window.removeEventListener('pointerdown', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('touchstart', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('mousedown', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('keydown', onFirstInteraction, { capture: true } as any);
    };

    window.addEventListener('pointerdown', onFirstInteraction, { capture: true, passive: true } as any);
    window.addEventListener('touchstart', onFirstInteraction, { capture: true, passive: true } as any);
    window.addEventListener('mousedown', onFirstInteraction, { capture: true, passive: true } as any);
    window.addEventListener('keydown', onFirstInteraction, { capture: true, passive: true } as any);
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('touchstart', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('mousedown', onFirstInteraction, { capture: true } as any);
      window.removeEventListener('keydown', onFirstInteraction, { capture: true } as any);
    };
  }, []);

  const vibrate = (pattern: number | number[]) => {
    try {
      if (typeof navigator === 'undefined') return;
      const v = (navigator as any).vibrate;
      if (typeof v !== 'function') return;
      v.call(navigator, pattern);
    } catch {}
  };

  const beep = async (): Promise<boolean> => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 980;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
      osc.stop(ctx.currentTime + 0.4);
      return true;
    } catch {
      return false;
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const value = String(base64String || '').trim();
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  };

  const ensurePushSubscription = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (typeof Notification === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return false;

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    if (Notification.permission !== 'granted') return false;

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {}

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      }));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return false;

    const resp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });

    if (!resp.ok) return false;
    return true;
  };

  const showBrowserNotification = async (title: string, body: string) => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, tag: 'pedido-pronto' });
    } catch {}
  };

  const fireReadyOrderAlert = (message: string) => {
    setNotification({ type: 'success', message });
    vibrate([180, 80, 180]);
    if (alertsMode === 'off') return;
    beep().then((ok) => {
      if (!ok) {
        setNotification({ type: 'error', message: 'Toque no sino para ativar o som do alerta.' });
      }
    }).catch(() => {});
    if (alertsMode === 'push') {
      showBrowserNotification('Pedido pronto', message).catch(() => {});
    }
  };

  const fetchPainel = async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      fetchInFlightRef.current = false;
      return;
    }

    try {
      const resp = await fetch('/api/entregadores/painel', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      const rawDisponiveis = Array.isArray(data?.disponiveis) ? data.disponiveis : [];
      const onlyDeliveryDisponiveis = rawDisponiveis.filter(
        (p: any) => String(p?.forma_entrega || '').toLowerCase() === 'delivery'
      );
      const rawEntregaAtual = Array.isArray(data?.entrega_atual)
        ? data.entrega_atual
        : data?.entrega_atual
          ? [data.entrega_atual]
          : [];
      const onlyDeliveryEntregaAtual = rawEntregaAtual.filter(
        (p: any) => String(p?.forma_entrega || '').toLowerCase() === 'delivery'
      );

      setAvailableOrders(onlyDeliveryDisponiveis);
      setCurrentDeliveries(onlyDeliveryEntregaAtual);
      setStats((prev) => ({
        ...prev,
        entregasHoje: Number(data?.stats?.entregasHoje || 0),
        faturamentoTotal: Number(data?.stats?.faturamentoTotal || 0),
      }));
    } catch (error: any) {
      const message =
        error?.message === 'Failed to fetch'
          ? 'Falha ao conectar no servidor.'
          : error?.message || 'Erro ao carregar painel';
      setNotification((prev) => {
        if (prev?.type === 'error' && prev.message === message) return prev;
        return { type: 'error', message };
      });
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  const fetchMinhasEntregas = async (opts?: { page?: number; perPage?: number }) => {
    if (fetchEntreguesInFlightRef.current) return;
    fetchEntreguesInFlightRef.current = true;
    setEntreguesLoading(true);
    const page = Math.max(1, Number(opts?.page || 1) || 1);
    const perPage = Math.min(100, Math.max(1, Number(opts?.perPage || entreguesPerPage) || 8));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setEntreguesLoading(false);
      fetchEntreguesInFlightRef.current = false;
      return;
    }

    try {
      const qs = new URLSearchParams({
        includeEntregues: '1',
        page: String(page),
        perPage: String(perPage)
      });
      const resp = await fetch(`/api/entregadores/painel?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      const ganhosRaw = data?.ganhos || {};
      setGanhos({
        dia: Number(ganhosRaw?.dia || 0),
        semana: Number(ganhosRaw?.semana || 0),
        mes: Number(ganhosRaw?.mes || 0)
      });

      const items = Array.isArray(data?.entregues) ? data.entregues : [];
      const hasMore = Boolean(data?.entregues_paginacao?.hasMore) || items.length === perPage;

      setEntreguesHasMore(hasMore);
      setEntreguesPage(page);
      setEntregues(items);
    } catch (error: any) {
      const message =
        error?.message === 'Failed to fetch'
          ? 'Falha ao conectar no servidor.'
          : error?.message || 'Erro ao carregar entregas';
      setNotification((prev) => {
        if (prev?.type === 'error' && prev.message === message) return prev;
        return { type: 'error', message };
      });
    } finally {
      fetchEntreguesInFlightRef.current = false;
      setEntreguesLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const resp = await fetch('/api/entregadores/painel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'aceitar', orderId })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      setNotification({ type: 'success', message: 'Pedido aceito! Boa entrega.' });
      await fetchPainel();
      if (activeSection === 'minhas_entregas') {
        await fetchMinhasEntregas({ page: 1, perPage: entreguesPerPage });
      }
      return true;
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Erro ao aceitar pedido' });
      return false;
    }
  };

  const handleFinishDelivery = async (orderId: string) => {
    if (finishingOrderId === orderId) return;
    setFinishingOrderId(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const resp = await fetch('/api/entregadores/painel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'finalizar', orderId })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      setNotification({ type: 'success', message: 'Entrega finalizada com sucesso.' });
      await fetchPainel();
      if (activeSection === 'minhas_entregas') {
        await fetchMinhasEntregas({ page: 1, perPage: entreguesPerPage });
      }
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Erro ao finalizar entrega' });
    } finally {
      setFinishingOrderId((prev) => (prev === orderId ? null : prev));
    }
  };

  // Function to handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/paineladmin');
  };

  useEffect(() => {
    if (!loading && role !== 'entregador' && role !== 'admin') {
      router.push('/paineladmin');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function fetchEntregadorData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserName(user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Entregador');
      try {
        await fetchPainel();
      } catch (e: any) {
        setNotification({ type: 'error', message: e?.message || 'Erro ao carregar painel' });
      }
    }

    if (!loading && role) {
      fetchEntregadorData();
    }
  }, [loading, role]);

  useEffect(() => {
    if (!role || (role !== 'entregador' && role !== 'admin')) return;
    let ignore = false;
    let channel: any = null;

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || ignore) return;

      channel = supabase
        .channel('realtime-entregador-painel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pedidos',
            filter: establishmentId ? `estabelecimento_id=eq.${establishmentId}` : undefined
          },
          () => {
            if (activeSection === 'minhas_entregas') {
              fetchMinhasEntregas({ page: 1, perPage: entreguesPerPage }).catch(() => {});
            } else {
              fetchPainel().catch(() => {});
            }
          }
        )
        .subscribe();
    };

    start();
    return () => {
      ignore = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [role, establishmentId, activeSection, entreguesPerPage]);

  useEffect(() => {
    if (!role || (role !== 'entregador' && role !== 'admin')) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (activeSection === 'minhas_entregas') {
        fetchMinhasEntregas({ page: 1, perPage: entreguesPerPage }).catch(() => {});
      } else {
        fetchPainel().catch(() => {});
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [role, establishmentId, activeSection, entreguesPerPage]);

  useEffect(() => {
    if (!role || (role !== 'entregador' && role !== 'admin')) return;
    if (activeSection !== 'minhas_entregas') return;

    setEntregues([]);
    setEntreguesPage(1);
    setEntreguesHasMore(true);
    fetchMinhasEntregas({ page: 1, perPage: entreguesPerPage }).catch(() => {});
  }, [activeSection, role, entreguesPerPage]);

  useEffect(() => {
    const totalPages = calcTotalPages(availableOrders.length, prontosPerPage);
    setProntosPage((p) => clampPage(p, totalPages));
  }, [availableOrders.length, prontosPerPage]);

  useEffect(() => {
    const totalPages = calcTotalPages(currentDeliveries.length, aceitosPerPage);
    setAceitosPage((p) => clampPage(p, totalPages));
  }, [currentDeliveries.length, aceitosPerPage]);

  useEffect(() => {
    if (!isOnline) return;
    const ids = new Set<string>(
      (availableOrders || [])
        .map((p: any) => String(p?.id || ''))
        .filter(Boolean)
    );

    const prev = lastAvailableOrdersRef.current;
    const prevSize = prev?.size || 0;
    lastAvailableOrdersRef.current = ids;
    if (!prev) return;

    const newIds: string[] = [];
    ids.forEach((id) => {
      if (!prev.has(id)) newIds.push(id);
    });
    if (newIds.length === 0 && !(ids.size > prevSize)) return;

    const first = (availableOrders || []).find((p: any) => String(p?.id || '') === newIds[0]);
    const firstLabel = first?.numero_pedido || (first?.id ? String(first.id).slice(0, 8) : '');
    const message = newIds.length === 1
      ? `Pedido pronto: #${firstLabel}`
      : `${newIds.length} pedidos prontos`;

    fireReadyOrderAlert(message);
    if (!incomingOrder) {
      const candidate = first || pickNextAvailableOrder(availableOrders);
      if (candidate) setIncomingOrder(candidate);
    }
  }, [availableOrders, alertsMode, isOnline, incomingOrder]);

  useEffect(() => {
    if (!incomingOrder) return;
    const id = String(incomingOrder?.id || '');
    if (!id) {
      setIncomingOrder(null);
      setIncomingAccepting(false);
      return;
    }
    const stillAvailable = (availableOrders || []).some((p: any) => String(p?.id || '') === id);
    if (!stillAvailable) {
      setIncomingOrder(null);
      setIncomingAccepting(false);
    }
  }, [availableOrders, incomingOrder]);

  useEffect(() => {
    if (!isOnline) return;
    if (incomingOrder) return;
    if (!Array.isArray(availableOrders) || availableOrders.length === 0) return;

    if (modalTimerRef.current) {
      clearTimeout(modalTimerRef.current);
      modalTimerRef.current = null;
    }

    const now = Date.now();
    cleanExpiredDeclines(now);
    const next = pickNextAvailableOrder(availableOrders);
    if (next) {
      setIncomingOrder(next);
      return;
    }

    let minRemaining = REOFFER_AFTER_MS;
    for (const ts of declinedOrdersRef.current.values()) {
      const remaining = REOFFER_AFTER_MS - (now - ts);
      if (remaining > 0 && remaining < minRemaining) minRemaining = remaining;
    }
    modalTimerRef.current = setTimeout(() => {
      const candidate = pickNextAvailableOrder(availableOrders);
      if (candidate) {
        setIncomingOrder(candidate);
        fireReadyOrderAlert('Pedido pronto disponível');
      }
    }, Math.max(1500, minRemaining));

    return () => {
      if (modalTimerRef.current) {
        clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
    };
  }, [availableOrders, incomingOrder, isOnline]);

  if (loading) return <Loading message="Carregando Painel do Entregador..." fullScreen />;

  const prontosTotalPages = calcTotalPages(availableOrders.length, prontosPerPage);
  const prontosFrom = (prontosPage - 1) * prontosPerPage;
  const prontosItems = availableOrders.slice(prontosFrom, prontosFrom + prontosPerPage);

  const aceitosTotalPages = calcTotalPages(currentDeliveries.length, aceitosPerPage);
  const aceitosFrom = (aceitosPage - 1) * aceitosPerPage;
  const aceitosItems = currentDeliveries.slice(aceitosFrom, aceitosFrom + aceitosPerPage);

  return (
    <div className={styles.container}>
      {incomingOrder ? (
        <div className={styles.incomingOverlay}>
          <div className={styles.incomingModal} role="dialog" aria-modal="true">
            <div className={styles.incomingModalHeader}>
              <div className={styles.incomingModalTitle}>Pedido pronto</div>
              <div className={styles.incomingModalMeta}>
                <span>#{incomingOrder?.numero_pedido || String(incomingOrder?.id || '').slice(0, 8)}</span>
                <span className={styles.incomingModalDot}>•</span>
                <span>{formatHour(incomingOrder?.criado_em)}</span>
              </div>
            </div>

            <div className={styles.incomingModalBody}>
              <div className={styles.incomingModalRow}>
                <span className={styles.incomingModalLabel}>Loja</span>
                <span className={styles.incomingModalValue}>{incomingOrder?.estabelecimento?.nome || 'Estabelecimento'}</span>
              </div>
              <div className={styles.incomingModalRow}>
                <span className={styles.incomingModalLabel}>Total</span>
                <span className={styles.incomingModalValue}>
                  {formatBRL(incomingOrder?.total_pedido || 0)}
                </span>
              </div>
              {(() => {
                const fee = Number(incomingOrder?.taxa_entrega || 0);
                const entregaKey = String(incomingOrder?.forma_entrega || '').trim().toLowerCase();
                const shouldShow = entregaKey === 'delivery' || fee > 0;
                if (!shouldShow) return null;
                return (
                  <div className={styles.incomingModalRow}>
                    <span className={styles.incomingModalLabel}>Valor da Entrega</span>
                    <span className={styles.incomingModalValue}>{fee === 0 ? 'Grátis' : formatBRL(fee)}</span>
                  </div>
                );
              })()}

              {(() => {
                const address = getClienteEnderecoCompleto(incomingOrder);
                const mapsUrl = address ? getGoogleMapsUrl(address) : '';
                const clienteNome = incomingOrder?.cliente?.nome || '';
                return (
                  <div className={styles.clienteBlock}>
                    {clienteNome ? (
                      <div className={styles.clienteName}>{clienteNome}</div>
                    ) : null}
                    <div className={styles.addressRow}>
                      <span className={styles.addressText}>{address || 'Endereço não informado'}</span>
                      {mapsUrl ? (
                        <a
                          className={styles.mapsIconBtn}
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Abrir no Google Maps"
                        >
                          <MapPin size={18} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.incomingModalActions}>
              <button
                className={styles.declineBtn}
                disabled={incomingAccepting}
                onClick={() => {
                  const id = String(incomingOrder?.id || '');
                  if (id) declinedOrdersRef.current.set(id, Date.now());
                  setIncomingOrder(null);
                  setIncomingAccepting(false);
                  setNotification({ type: 'success', message: 'Entrega recusada.' });
                }}
              >
                Recusar
              </button>
              <button
                className={styles.acceptModalBtn}
                disabled={incomingAccepting}
                onClick={async () => {
                  const id = String(incomingOrder?.id || '');
                  if (!id) return;
                  setIncomingAccepting(true);
                  const ok = await handleAcceptOrder(id);
                  setIncomingAccepting(false);
                  setIncomingOrder(null);
                  if (ok) setActiveSection('minhas_entregas');
                }}
              >
                Aceitar entrega
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {mobileMenuOpen ? (
        <div className={styles.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)} role="presentation">
          <aside className={styles.mobileMenuDrawer} onClick={(e) => e.stopPropagation()} aria-label="Menu do entregador">
            <div className={styles.mobileMenuHeader}>
              <div className={styles.mobileMenuUser}>
                <div className={styles.avatarCircle}>{getInitials(userName)}</div>
                <div className={styles.mobileMenuUserText}>
                  <div className={styles.mobileMenuHello}>Olá,</div>
                  <div className={styles.mobileMenuName}>{userName}</div>
                </div>
              </div>
              <button className={styles.mobileMenuCloseBtn} onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>

            <nav className={styles.mobileMenuNav}>
              <button
                className={`${styles.mobileMenuItem} ${activeSection === 'inicio' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => handleNavTo('inicio')}
              >
                <LayoutDashboard size={20} /> Início
              </button>
              <button
                className={`${styles.mobileMenuItem} ${activeSection === 'minhas_entregas' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => handleNavTo('minhas_entregas')}
              >
                <Truck size={20} /> Minhas Entregas
              </button>
              <button className={styles.mobileMenuItem} onClick={handleComingSoon}>
                <Wallet size={20} /> Carteira
              </button>
              <button className={styles.mobileMenuItem} onClick={handleComingSoon}>
                <User size={20} /> Perfil
              </button>
              <button className={styles.mobileMenuItem} onClick={handleComingSoon}>
                <Bike size={20} /> Meus Veículos
              </button>
              <button className={styles.mobileMenuItem} onClick={handleComingSoon}>
                <MapPin size={20} /> Meus Endereços
              </button>
            </nav>

            <button className={styles.mobileMenuLogout} onClick={handleLogout}>
              <LogOut size={20} /> Sair
            </button>
          </aside>
        </div>
      ) : null}
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><Bike size={24} /></div>
          <div className={styles.logoText}>
            <h1>ZapZap</h1>
            <span>ENTREGADOR</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${activeSection === 'inicio' ? styles.navItemActive : ''}`}
            onClick={() => setActiveSection('inicio')}
          >
            <LayoutDashboard size={20} /> Início
          </button>
          <button
            className={`${styles.navItem} ${activeSection === 'minhas_entregas' ? styles.navItemActive : ''}`}
            onClick={() => setActiveSection('minhas_entregas')}
          >
            <Truck size={20} /> Minhas Entregas
          </button>
          <button className={styles.navItem}>
            <Wallet size={20} /> Carteira
          </button>
          <button className={styles.navItem}>
            <User size={20} /> Perfil
          </button>
          <button className={styles.navItem}>
            <Bike size={20} /> Meus Veículos
          </button>
          <button className={styles.navItem}>
            <MapPin size={20} /> Meus Endereços
          </button>
        </nav>

        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={20} /> Sair
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className={styles.mobileTopBar}>
          <button className={styles.hamburgerBtn} onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <div className={styles.mobileGreeting}>
            <div className={styles.mobileHello}>Olá,</div>
            <div className={styles.mobileName}>{userName}!</div>
          </div>
          <div className={styles.mobileTopActions}>
            <button
              className={`${styles.btnIcon} ${alertsMode !== 'off' ? styles.btnIconActive : ''} ${alertsMode === 'push' ? styles.btnIconPush : ''}`}
              onClick={async () => {
                await toggleAlertsMode();
              }}
              aria-label="Configurar alertas"
              title={alertsMode === 'off' ? 'Alertas desligados' : alertsMode === 'som' ? 'Alertas com som' : 'Alertas com push + som'}
            >
              <Bell size={20} />
            </button>
            <div className={styles.avatarCircle}>{getInitials(userName)}</div>
          </div>
        </header>

        <div className={styles.mobileSubheader}>
          <div className={styles.mobileSubtitle}>Vamos fazer ótimas entregas hoje.</div>
          <div className={styles.statusToggle}>
            <span className={styles.statusLabel}>Status:</span>
            <label className={styles.switch}>
              <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} />
              <span className={styles.slider}></span>
            </label>
            <span className={styles.statusBadge}>{isOnline ? 'Disponível' : 'Offline'}</span>
          </div>
        </div>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.welcome}>
            <h2>Olá, {userName}! 🛵</h2>
            <p>Vamos fazer ótimas entregas hoje.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.statusToggle}>
              <span className={styles.statusLabel}>Status:</span>
              <label className={styles.switch}>
                <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} />
                <span className={styles.slider}></span>
              </label>
              <span className={styles.statusBadge}>{isOnline ? 'Disponível' : 'Offline'}</span>
            </div>
            <button
              className={`${styles.btnIcon} ${alertsMode !== 'off' ? styles.btnIconActive : ''} ${alertsMode === 'push' ? styles.btnIconPush : ''}`}
              onClick={toggleAlertsMode}
              aria-label="Configurar alertas"
              title={alertsMode === 'off' ? 'Alertas desligados' : alertsMode === 'som' ? 'Alertas com som' : 'Alertas com push + som'}
            >
              <Bell size={20} />
            </button>
            <div className={styles.avatarCircle}>{getInitials(userName)}</div>
          </div>
        </header>

        {notification && (
          <div
            className={`${styles.toast} ${notification.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            role="status"
            aria-live="polite"
          >
            {notification.type === 'success' ? <CheckCircle2 size={24} /> : <Ban size={24} />}
            <span className={styles.toastText}>{notification.message}</span>
          </div>
        )}

        {activeSection === 'inicio' ? (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.blueIcon}`}><Package size={20} /></div>
                <div className={styles.statTrend}>+2</div>
                <div className={styles.statValue}>{stats.entregasHoje}</div>
                <div className={styles.statLabel}>Entregas Hoje</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.greenIcon}`}><Wallet size={20} /></div>
                <div className={`${styles.statTrend} ${styles.trendPositive}`}>+15%</div>
                <div className={styles.statValue}>R$ {stats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div className={styles.statLabel}>Faturamento Total</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.purpleIcon}`}><Trophy size={20} /></div>
                <div className={styles.statValue}>{stats.taxaAceitacao}%</div>
                <div className={styles.statLabel}>Taxa de Aceitação</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.orangeIcon}`}><User size={20} /></div>
                <div className={styles.statValue}>{stats.avaliacaoMedia}</div>
                <div className={styles.statLabel}>Avaliação Média</div>
              </div>
            </div>

            <div className={styles.dashboardGrid}>
              <section className={`${styles.recentActivityCard} ${styles.readyOrdersCard}`}>
                <div className={styles.cardTitleRow}>
                  <h3>Pedidos Prontos</h3>
                  <div className={styles.listHeaderRight}>
                    <span className={styles.readyBadge}>{availableOrders.length}</span>
                    <div className={styles.perPageControl}>
                      <span className={styles.perPageLabel}>Ver</span>
                      <select
                        className={styles.perPageSelect}
                        value={prontosPerPage}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 8;
                          setProntosPerPage(v);
                          setProntosPage(1);
                        }}
                      >
                        {PER_PAGE_OPTIONS.map((n) => (
                          <option key={`prontos-${n}`} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.pager}>
                      <button
                        className={styles.pagerBtn}
                        onClick={() => setProntosPage((p) => Math.max(1, p - 1))}
                        disabled={prontosPage <= 1}
                      >
                        ‹
                      </button>
                      <span className={styles.pagerInfo}>{prontosPage}/{prontosTotalPages}</span>
                      <button
                        className={styles.pagerBtn}
                        onClick={() => setProntosPage((p) => Math.min(prontosTotalPages, p + 1))}
                        disabled={prontosPage >= prontosTotalPages}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`${styles.activityList} ${styles.readyOrdersGrid}`}>
                  {availableOrders.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum pedido pronto no momento.</div>
                  ) : (
                    prontosItems.map((p) => {
                      const address = getClienteEnderecoCompleto(p);
                      const mapsUrl = address ? getGoogleMapsUrl(address) : '';
                      const clienteNome = p?.cliente?.nome || '';

                      return (
                        <div
                          key={p.id}
                          className={`${styles.activityItem} ${styles.readyOrderItem} ${styles.readyOrderClickable}`}
                          onClick={() => {
                            setIncomingAccepting(false);
                            setIncomingOrder(p);
                          }}
                        >
                        <div className={styles.activityIcon}>
                          <Clock size={16} />
                        </div>
                        <div className={styles.activityContent}>
                          <div className={styles.activityHeader}>
                            <span className={styles.activityTitle}>#{p.numero_pedido || p.id.slice(0, 8)}</span>
                            <span className={styles.activityTime}>{formatHour(p.criado_em)}</span>
                          </div>
                          <div className={styles.activityDetails}>
                            <span>{p?.estabelecimento?.nome || 'Estabelecimento'}</span>
                            <span>R$ {Number(p.total_pedido || 0).toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className={styles.clienteBlock}>
                            {clienteNome ? (
                              <div className={styles.clienteName}>{clienteNome}</div>
                            ) : null}
                            <div className={styles.addressRow}>
                              <span className={styles.addressText}>
                                {address || 'Endereço não informado'}
                              </span>
                              {mapsUrl ? (
                                <a
                                  className={styles.mapsIconBtn}
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Abrir no Google Maps"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MapPin size={18} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </section>

              {currentDeliveries.length > 0 ? (
                <section className={styles.currentDeliveryCard}>
                  <div className={styles.cardHeader}>
                    <h3><Navigation size={18} /> Entrega Atual</h3>
                    <div className={styles.listHeaderRight}>
                      <span className={styles.deliveryStatus}>{currentDeliveries.length} aceita{currentDeliveries.length === 1 ? '' : 's'}</span>
                      <div className={styles.perPageControl}>
                        <span className={styles.perPageLabel}>Ver</span>
                        <select
                          className={styles.perPageSelect}
                          value={aceitosPerPage}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 8;
                            setAceitosPerPage(v);
                            setAceitosPage(1);
                          }}
                        >
                          {PER_PAGE_OPTIONS.map((n) => (
                            <option key={`aceitos-${n}`} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.pager}>
                        <button
                          className={styles.pagerBtn}
                          onClick={() => setAceitosPage((p) => Math.max(1, p - 1))}
                          disabled={aceitosPage <= 1}
                        >
                          ‹
                        </button>
                        <span className={styles.pagerInfo}>{aceitosPage}/{aceitosTotalPages}</span>
                        <button
                          className={styles.pagerBtn}
                          onClick={() => setAceitosPage((p) => Math.min(aceitosTotalPages, p + 1))}
                          disabled={aceitosPage >= aceitosTotalPages}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.deliveryContent} ${styles.deliveryGrid}`}>
                    {aceitosItems.map((delivery: any) => {
                      const address = getClienteEnderecoCompleto(delivery);
                      const mapsUrl = address ? getGoogleMapsUrl(address) : '';
                      const clienteNome = delivery?.cliente?.nome || '';
                      const clienteTelefone = String(delivery?.cliente?.telefone || '');
                      const deliveryFee = Number(delivery?.taxa_entrega || 0);
                      const orderLabel = delivery.numero_pedido || delivery.id.slice(0, 8);
                      const whatsappUrl = getWhatsAppUrl(
                        clienteTelefone,
                        `Olá! Sou o entregador do seu pedido #${orderLabel}.`
                      );

                      return (
                        <div key={delivery.id} className={`${styles.activityItem} ${styles.readyOrderItem}`}>
                          <div className={styles.activityContent}>
                            <div className={styles.activityHeader}>
                              <span className={styles.activityTitle}>#{delivery.numero_pedido || delivery.id.slice(0, 8)}</span>
                              <span className={styles.activityTime}>{formatHour(delivery.criado_em)}</span>
                            </div>
                            <div className={styles.activityDetails}>
                              <span>{delivery?.estabelecimento?.nome || 'Estabelecimento'}</span>
                              <span>R$ {Number(delivery.total_pedido || 0).toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className={styles.deliveryFeeRow}>
                              <span>Valor da Entrega</span>
                              <span>{formatBRL(deliveryFee)}</span>
                            </div>
                            <div className={styles.clienteBlock}>
                              {clienteNome ? (
                                <div className={styles.clienteName}>{clienteNome}</div>
                              ) : null}
                              <div className={styles.addressRow}>
                                <span className={styles.addressText}>
                                  {address || 'Endereço não informado'}
                                </span>
                              </div>
                            </div>
                            <div className={styles.deliveryActions}>
                              {whatsappUrl ? (
                                <a
                                  className={styles.btnChat}
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle size={18} /> Chat
                                </a>
                              ) : (
                                <button className={styles.btnChat} disabled>
                                  <MessageCircle size={18} /> Chat
                                </button>
                              )}
                              {mapsUrl ? (
                                <a
                                  className={styles.btnMap}
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MapPin size={18} /> Mapa
                                </a>
                              ) : (
                                <button className={styles.btnMap} disabled>
                                  <MapPin size={18} /> Mapa
                                </button>
                              )}
                              <button
                                className={styles.btnFinish}
                                disabled={delivery.status_pedido !== OrderStatus.SAIU_ENTREGA || finishingOrderId === delivery.id}
                                aria-busy={finishingOrderId === delivery.id}
                                onClick={() => handleFinishDelivery(delivery.id)}
                              >
                                {finishingOrderId === delivery.id ? (
                                  <>
                                    <Loader2 size={18} className="animate-spin" /> Finalizando...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={18} /> Finalizar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className={styles.currentDeliveryCard}>
                  <div className={styles.cardHeader}>
                    <h3><Navigation size={18} /> Entrega Atual</h3>
                  </div>
                  <div className={styles.deliveryContent} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <p style={{ color: '#64748b' }}>Nenhuma entrega em andamento no momento.</p>
                  </div>
                </section>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.greenIcon}`}><Wallet size={20} /></div>
                <div className={styles.statValue}>{formatBRL(ganhos.dia)}</div>
                <div className={styles.statLabel}>Ganhos Hoje</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.blueIcon}`}><Wallet size={20} /></div>
                <div className={styles.statValue}>{formatBRL(ganhos.semana)}</div>
                <div className={styles.statLabel}>Ganhos Semana</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.purpleIcon}`}><Wallet size={20} /></div>
                <div className={styles.statValue}>{formatBRL(ganhos.mes)}</div>
                <div className={styles.statLabel}>Ganhos Mês</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.orangeIcon}`}><Package size={20} /></div>
                <div className={styles.statValue}>{entregues.length}</div>
                <div className={styles.statLabel}>Pedidos Entregues</div>
              </div>
            </div>

            <div className={styles.dashboardGrid}>
              <section className={styles.recentActivityCard}>
                <div className={styles.cardTitleRow}>
                  <h3>Pedidos Entregues</h3>
                  <span className={styles.readyBadge}>{entregues.length}</span>
                </div>

                <div className={styles.entreguesGrid}>
                  {entregues.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum pedido entregue ainda.</div>
                  ) : (
                    entregues.map((p: any) => {
                      const address = getClienteEnderecoCompleto(p);
                      const mapsUrl = address ? getGoogleMapsUrl(address) : '';
                      const clienteNome = p?.cliente?.nome || '';
                      const deliveryFee = Number(p?.taxa_entrega || 0);
                      const estabelecimentoNome = p?.estabelecimento?.nome || 'ZapZap Delivery';
                      const total = Number(p?.total_pedido || 0);

                      return (
                        <div
                          key={p.id}
                          className={styles.entregueCard}
                          style={isMobileViewport ? { padding: '0.9rem', gap: '0.65rem' } : undefined}
                        >
                          <div className={styles.entregueTop}>
                            <div className={styles.entregueIconWrap} style={isMobileViewport ? { width: 36, height: 36 } : undefined}>
                              <CheckCircle2 size={18} />
                            </div>
                            <div className={styles.entregueTopMain}>
                              <div className={styles.entregueTitleRow}>
                                <span className={styles.entregueNumero}>#{p.numero_pedido || p.id.slice(0, 8)}</span>
                                <span className={styles.entregueHora}>{formatHour(p.criado_em)}</span>
                              </div>
                              <div className={styles.entregueDetailsRow}>
                                <span className={styles.entregueEstabelecimento}>{estabelecimentoNome}</span>
                                <span className={styles.entregueTotal}>{formatBRL(total)}</span>
                              </div>
                              <div className={styles.entregueFeeRow}>
                                <span>Ganho da entrega</span>
                                <span>{formatBRL(deliveryFee)}</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.entregueClienteBlock}>
                            {clienteNome ? <div className={styles.entregueClienteNome}>{clienteNome}</div> : null}
                            <div className={styles.entregueEnderecoRow}>
                              <span
                                className={styles.entregueEnderecoText}
                                style={
                                  isMobileViewport
                                    ? {
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                      }
                                    : undefined
                                }
                              >
                                {address || 'Endereço não informado'}
                              </span>
                              {mapsUrl ? (
                                <a
                                  className={styles.entregueMapBtn}
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Abrir no Google Maps"
                                >
                                  <MapPin size={18} />
                                </a>
                              ) : (
                                <button className={styles.entregueMapBtn} type="button" disabled aria-label="Mapa indisponível">
                                  <MapPin size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div
                  className={styles.entreguesFooter}
                  style={isMobileViewport ? { justifyContent: 'space-between', flexWrap: 'wrap' } : undefined}
                >
                  <div className={styles.perPageControl}>
                    <span className={styles.perPageLabel}>Ver</span>
                    <select
                      className={styles.perPageSelect}
                      value={entreguesPerPage}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 8;
                        setEntreguesPerPage(v);
                        setEntreguesPage(1);
                      }}
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={`entregues-${n}`} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.pager}>
                    <button
                      className={styles.pagerBtn}
                      onClick={() => fetchMinhasEntregas({ page: Math.max(1, entreguesPage - 1), perPage: entreguesPerPage })}
                      disabled={entreguesLoading || entreguesPage <= 1}
                    >
                      ‹
                    </button>
                    <span className={styles.pagerInfo}>{entreguesPage}</span>
                    <button
                      className={styles.pagerBtn}
                      onClick={() => fetchMinhasEntregas({ page: entreguesPage + 1, perPage: entreguesPerPage })}
                      disabled={entreguesLoading || !entreguesHasMore}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        <nav className={styles.bottomNav} aria-label="Navegação inferior">
          <button
            className={`${styles.bottomNavItem} ${activeSection === 'inicio' ? styles.bottomNavItemActive : ''}`}
            onClick={() => handleNavTo('inicio')}
          >
            <LayoutDashboard size={18} />
            <span>Início</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeSection === 'minhas_entregas' ? styles.bottomNavItemActive : ''}`}
            onClick={() => handleNavTo('minhas_entregas')}
          >
            <Truck size={18} />
            <span>Entregas</span>
          </button>
          <button className={styles.bottomNavItem} onClick={handleComingSoon}>
            <Wallet size={18} />
            <span>Carteira</span>
          </button>
          <button className={styles.bottomNavItem} onClick={handleComingSoon}>
            <User size={18} />
            <span>Perfil</span>
          </button>
          <button className={styles.bottomNavItem} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
