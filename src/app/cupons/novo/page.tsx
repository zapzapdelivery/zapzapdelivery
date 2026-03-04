'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/components/Toast/ToastProvider';
import { supabase } from '@/lib/supabase';
import { Info, Percent, DollarSign, Calendar, Link2, ArrowLeft } from 'lucide-react';
import styles from './novo-cupom.module.css';

type DiscountType = 'percentual' | 'fixo';

interface EstablishmentOption {
  id: string;
  nome_estabelecimento: string;
}

export default function NovoCupomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, establishmentId, establishmentName, loading: loadingRole } = useUserRole();
  const { success, error: toastError } = useToast();

  const [saving, setSaving] = useState(false);
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(false);

  const [statusAtivo, setStatusAtivo] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState<DiscountType>('percentual');
  const [valorDesconto, setValorDesconto] = useState('');
  const [limiteUso, setLimiteUso] = useState('');
  const [vinculoEstabelecimentoId, setVinculoEstabelecimentoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setEditingId(idFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loadingRole && establishmentId && !vinculoEstabelecimentoId) {
      setVinculoEstabelecimentoId(establishmentId);
    }
  }, [loadingRole, establishmentId, vinculoEstabelecimentoId]);

  useEffect(() => {
    const fetchEstablishments = async () => {
      if (role !== 'admin' && role !== 'parceiro') return;
      try {
        setLoadingEstablishments(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch('/api/estabelecimentos', {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        });

        if (!res.ok) {
          throw new Error('Erro ao carregar estabelecimentos');
        }

        const data = await res.json();
        const formatted: EstablishmentOption[] = (data || []).map((e: any) => ({
          id: e.id,
          nome_estabelecimento: e.name || e.nome_estabelecimento || 'Estabelecimento',
        }));

        setEstablishments(formatted);
      } catch (err) {
        console.error('Erro ao buscar estabelecimentos:', err);
        setEstablishments([]);
      } finally {
        setLoadingEstablishments(false);
      }
    };

    if (!loadingRole) {
      fetchEstablishments();
    }
  }, [loadingRole, role]);

  useEffect(() => {
    const loadCoupon = async () => {
      if (!editingId) return;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`/api/cupons/${editingId}`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'Erro ao carregar cupom');
        }

        setCodigo(data.codigo_cupom || '');
        setTipoDesconto(data.tipo_desconto === 'fixo' ? 'fixo' : 'percentual');
        setValorDesconto(
          data.valor_desconto != null ? String(data.valor_desconto).replace('.', ',') : ''
        );
        setLimiteUso(
          data.limite_uso != null && data.limite_uso !== undefined
            ? String(data.limite_uso)
            : ''
        );
        setDataInicio(data.data_inicio ? String(data.data_inicio).slice(0, 10) : '');
        setDataFim(data.data_fim ? String(data.data_fim).slice(0, 10) : '');
        setStatusAtivo(data.status_cupom === 'ativo');
        if (data.estabelecimento_id) {
          setVinculoEstabelecimentoId(data.estabelecimento_id);
        }
      } catch (err: any) {
        console.error('Erro ao carregar cupom para edição:', err);
        toastError(err?.message || 'Erro ao carregar cupom para edição');
      }
    };

    if (!loadingRole && editingId) {
      loadCoupon();
    }
  }, [editingId, loadingRole, toastError]);

  const handleSubmit = async () => {
    if (!codigo.trim()) {
      toastError('Informe o código do cupom');
      return;
    }

    if (!valorDesconto.trim()) {
      toastError('Informe o valor do desconto');
      return;
    }

    if (!vinculoEstabelecimentoId && role !== 'admin' && role !== 'parceiro') {
      toastError('Não foi possível determinar o estabelecimento do cupom');
      return;
    }

    try {
      setSaving(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const payload = {
        estabelecimento_id: vinculoEstabelecimentoId || null,
        codigo_cupom: codigo.trim(),
        tipo_desconto: tipoDesconto === 'percentual' ? 'percentual' : 'fixo',
        valor_desconto: parseFloat(valorDesconto.replace(',', '.')) || 0,
        limite_uso: limiteUso ? parseInt(limiteUso, 10) : null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        status_cupom: statusAtivo ? 'ativo' : 'inativo',
      };

      const res = await fetch(editingId ? `/api/cupons/${editingId}` : '/api/cupons', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao salvar cupom');
      }

      success(editingId ? 'Cupom atualizado com sucesso' : 'Cupom criado com sucesso');
      router.push('/cupons');
    } catch (err: any) {
      console.error('Erro ao salvar cupom:', err);
      toastError(err?.message || 'Erro ao salvar cupom');
    } finally {
      setSaving(false);
    }
  };

  const resolveEstablishmentLabel = () => {
    if (role === 'estabelecimento' && establishmentName) {
      return establishmentName;
    }

    if (!vinculoEstabelecimentoId) {
      return 'Selecione um estabelecimento...';
    }

    const found = establishments.find((e) => e.id === vinculoEstabelecimentoId);
    return found?.nome_estabelecimento || 'Selecione um estabelecimento...';
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.content}>
        <div className={styles.header}>
          <Link href="/cupons" className={styles.backLink}>
            <ArrowLeft size={18} /> Voltar para Cupons
          </Link>
          <h1 className={styles.title}>Novo Cupom</h1>
          <p className={styles.subtitle}>Configure as regras de desconto e validade</p>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.mainColumn}>
            <div className={styles.card}>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Status do Cupom</span>
                  <span className={styles.switchDescription}>Habilita ou desabilita o uso do cupom</span>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={statusAtivo}
                    onChange={(e) => setStatusAtivo(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionTitle}>
                <Percent size={18} color="#2563eb" />
                Regras de Desconto
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>NOME DO CUPOM</label>
                <input
                  type="text"
                  placeholder="BEMVINDO2026"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={`${styles.optionGroup} ${styles.formGroup}`}>
                <button
                  type="button"
                  onClick={() => setTipoDesconto('percentual')}
                  className={`${styles.optionButton} ${tipoDesconto === 'percentual' ? styles.optionButtonActive : ''}`}
                >
                  <Percent size={18} />
                  Percentual (%)
                </button>
                <button
                  type="button"
                  onClick={() => setTipoDesconto('fixo')}
                  className={`${styles.optionButton} ${tipoDesconto === 'fixo' ? styles.optionButtonActive : ''}`}
                >
                  <DollarSign size={18} />
                  Valor Fixo (R$)
                </button>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>VALOR</label>
                  <input
                    type="text"
                    placeholder={tipoDesconto === 'percentual' ? '0,00' : '0,00'}
                    value={valorDesconto}
                    onChange={(e) => setValorDesconto(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>LIMITE DE USO</label>
                  <input
                    type="number"
                    placeholder="Ilimitado"
                    value={limiteUso}
                    onChange={(e) => setLimiteUso(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionTitle}>
                <Calendar size={18} color="#ef4444" />
                Validade
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>INÍCIO</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>FIM</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sideColumn}>
            <div className={styles.card}>
              <div className={styles.sectionTitle}>
                <Link2 size={18} color="#f97316" />
                Vínculo
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>ESTABELECIMENTO</label>

                {role === 'estabelecimento' ? (
                  <div className={styles.readonly}>
                    {resolveEstablishmentLabel()}
                  </div>
                ) : (
                  <select
                    value={vinculoEstabelecimentoId}
                    onChange={(e) => setVinculoEstabelecimentoId(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">
                      {loadingEstablishments
                        ? 'Carregando estabelecimentos...'
                        : 'Selecione um estabelecimento...'}
                    </option>
                    {establishments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome_estabelecimento}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className={styles.infoBox}>
              <Info size={18} className={styles.infoIcon} />
              <p className={styles.infoText}>
                Cupons expirados ou inativos não serão aplicados aos pedidos. Defina bem a
                validade e o limite de uso para evitar usos indevidos.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.actionsFooter}>
          <button
            type="button"
            onClick={() => router.push('/cupons')}
            disabled={saving}
            className={styles.btnCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={styles.btnSave}
          >
            {saving ? 'Salvando...' : 'Salvar Cupom'}
          </button>
        </div>
      </main>
    </div>
  );
}
