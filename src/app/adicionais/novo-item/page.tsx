'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Store } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { useUserRole } from '@/hooks/useUserRole';
import { useEstablishment } from '@/hooks/useEstablishment';
import { supabase } from '@/lib/supabase';
import styles from '../../categorias/novo/novo-categoria.module.css';

interface Grupo {
  id: string;
  nome: string;
}

function NovoItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isEditing = !!id;
  const initialGrupoId = searchParams.get('grupo_id');

  const { role, loading: loadingRole } = useUserRole();
  const { success, error: toastError, warning } = useToast();
  const { establishmentId, establishmentName, loading: loadingEstab } = useEstablishment();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoId, setGrupoId] = useState(initialGrupoId || '');
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('0,00');
  const [ativo, setAtivo] = useState(true);
  const [controlaEstoque, setControlaEstoque] = useState(false);
  const [estoqueAtual, setEstoqueAtual] = useState(0);
  const [ordemExibicao, setOrdemExibicao] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  useEffect(() => {
    if (loadingEstab) return;

    if (!establishmentId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: gRows, error: gErr } = await supabase
          .from('grupos_adicionais')
          .select('id, nome')
          .eq('estabelecimento_id', establishmentId)
          .order('ordem_exibicao');

        if (gErr) throw gErr;

        setGrupos(gRows || []);

        if (!grupoId && gRows && gRows.length > 0) {
          setGrupoId(gRows[0].id);
        }

        if (id) {
          const { data, error } = await supabase
            .from('adicionais')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;

          if (data) {
            setGrupoId(String(data.grupo_id));
            setNome(data.nome || '');
            setPreco(data.preco != null ? String(data.preco).replace('.', ',') : '');
            setAtivo(Boolean(data.ativo));
            setControlaEstoque(Boolean(data.controla_estoque));
            setEstoqueAtual(Number(data.estoque_atual) || 0);
            setOrdemExibicao(Number(data.ordem_exibicao) || 0);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar adicional:', err);
        toastError('Erro ao carregar dados do adicional.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, establishmentId, loadingEstab]);

  const handleSave = async () => {
    if (!nome.trim()) {
      warning('Informe o nome do adicional.');
      return;
    }

    if (!grupoId) {
      warning('Selecione um grupo.');
      return;
    }

    if (preco === '') {
      warning('Informe o preço do adicional.');
      return;
    }

    const valorNumero = parseFloat(preco.replace(',', '.'));
    if (Number.isNaN(valorNumero) || valorNumero < 0) {
      warning('Informe um preço válido.');
      return;
    }

    const estoque = controlaEstoque ? Math.max(0, estoqueAtual) : null;

    try {
      setSaving(true);

      const payload = {
        grupo_id: grupoId,
        nome,
        preco: valorNumero,
        ativo,
        controla_estoque: controlaEstoque,
        estoque_atual: estoque,
        ordem_exibicao: ordemExibicao,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('adicionais')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
        success('Adicional atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('adicionais').insert(payload);
        if (error) throw error;
        success('Adicional criado com sucesso!');
      }

      router.push('/adicionais');
    } catch (err: any) {
      console.error('Erro ao salvar adicional:', err);
      toastError('Erro ao salvar adicional: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingRole) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <div className={styles.content}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  if (role === 'atendente') return null;

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.content}>
        <AdminHeader />

        <div className={styles.header}>
          <Link href="/adicionais" className={styles.backLink}>
            <ArrowLeft size={16} />
            Voltar para Adicionais
          </Link>
          <h1 className={styles.title}>{isEditing ? 'Editar Adicional' : 'Novo Adicional'}</h1>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.mainColumn}>
            {/* Status Card - Moved to top */}
            <div className={styles.card}>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Ativo</span>
                  <span className={styles.switchDescription}>Controla se este adicional aparece no cardápio</span>
                </div>
                <label className={`${styles.switch} ${styles.greenToggle}`}>
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            {/* Estoque Card - Moved to top */}
            <div className={styles.card}>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Controlar estoque</span>
                  <span className={styles.switchDescription}>Ative se este adicional tiver quantidade limitada</span>
                </div>
                <label className={`${styles.switch} ${styles.greenToggle}`}>
                  <input
                    type="checkbox"
                    checked={controlaEstoque}
                    onChange={(e) => setControlaEstoque(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                <label className={styles.label}>Estoque atual</label>
                <input
                  type="number"
                  className={styles.input}
                  value={estoqueAtual}
                  onChange={(e) => setEstoqueAtual(parseInt(e.target.value) || 0)}
                  min={0}
                  disabled={!controlaEstoque}
                />
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Informações do Adicional</h2>
              <p className={styles.cardSubtitle}>Defina o nome, preço e grupo deste adicional.</p>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nome do Adicional <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Borda recheada, Cobertura de morango"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Grupo <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.select}
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                >
                  <option value="">Selecione um grupo</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Preço (R$) <span className={styles.required}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '0.75rem',
                      color: '#6b7280',
                      fontSize: '0.875rem',
                    }}
                  >
                    R$
                  </span>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="0,00"
                    value={preco}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[\d.,]*$/.test(val)) {
                        setPreco(val);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Configurações Card - Moved from side */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Configurações</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estabelecimento</label>
                <div className={styles.readOnlyField}>
                  <Store size={18} className={styles.fieldIcon} />
                  <span>{establishmentName || 'Carregando...'}</span>
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                <label className={styles.label}>Ordem de Exibição</label>
                <input
                  type="number"
                  className={styles.input}
                  value={ordemExibicao}
                  onChange={(e) => setOrdemExibicao(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Link href="/adicionais" className={styles.cancelButton}>
            Cancelar
          </Link>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : (
              <>
                <Check size={18} />
                Salvar Adicional
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function NovoItemPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NovoItemContent />
    </Suspense>
  );
}
