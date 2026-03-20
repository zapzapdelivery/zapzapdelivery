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

function NovoGrupoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isEditing = !!id;

  const { role, loading: loadingRole } = useUserRole();
  const { success, error: toastError, warning } = useToast();
  const { establishmentId, establishmentName, loading: loadingEstab } = useEstablishment();

  const [nome, setNome] = useState('');
  const [tipoSelecao, setTipoSelecao] = useState<'unico' | 'multiplo'>('unico');
  const [obrigatorio, setObrigatorio] = useState(true);
  const [minOpcoes, setMinOpcoes] = useState(1);
  const [maxOpcoes, setMaxOpcoes] = useState(1);
  const [ordemExibicao, setOrdemExibicao] = useState(0);
  const [categoriaId, setCategoriaId] = useState('');
  const [categories, setCategories] = useState<{ id: string; nome_categoria: string }[]>([]);
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

        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome_categoria')
          .eq('estabelecimento_id', establishmentId)
          .eq('status_categoria', 'ativo')
          .order('nome_categoria');

        setCategories(cats || []);

        if (id) {
          const { data, error } = await supabase
            .from('grupos_adicionais')
            .select('*')
            .eq('id', id)
            .eq('estabelecimento_id', establishmentId)
            .single();

          if (error) throw error;

          if (data) {
            setNome(data.nome || '');
            setTipoSelecao(data.tipo_selecao === 'multiplo' ? 'multiplo' : 'unico');
            setObrigatorio(Boolean(data.obrigatorio));
            setMinOpcoes(Number(data.min_opcoes) || 0);
            setMaxOpcoes(Number(data.max_opcoes) || 0);
            setOrdemExibicao(Number(data.ordem_exibicao) || 0);
            setCategoriaId(data.categoria_id || '');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar grupo:', err);
        toastError('Erro ao carregar dados do grupo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, establishmentId, loadingEstab, toastError]);

  const handleSave = async () => {
    if (!nome.trim()) {
      warning('Informe o nome do grupo.');
      return;
    }

    if (!categoriaId) {
      warning('Selecione uma categoria para o grupo.');
      return;
    }

    if (!establishmentId) {
      toastError('Erro: Estabelecimento não identificado.');
      return;
    }

    let min = minOpcoes;
    let max = maxOpcoes;

    if (tipoSelecao === 'unico') {
      min = 1;
      max = 1;
    } else {
      if (min < 0) min = 0;
      if (max < 0) max = 0;
      if (max !== 0 && max < min) {
        warning('O máximo de opções não pode ser menor que o mínimo.');
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        estabelecimento_id: establishmentId,
        nome,
        tipo_selecao: tipoSelecao,
        obrigatorio,
        min_opcoes: min,
        max_opcoes: max,
        ordem_exibicao: ordemExibicao,
        categoria_id: categoriaId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('grupos_adicionais')
          .update(payload)
          .eq('id', id)
          .eq('estabelecimento_id', establishmentId);

        if (error) throw error;
        success('Grupo atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('grupos_adicionais').insert(payload);
        if (error) {
          console.error('Supabase insert error grupos_adicionais:', error);
          throw error;
        }
        success('Grupo criado com sucesso!');
      }

      router.push('/adicionais');
    } catch (err: any) {
      console.error('Erro ao salvar grupo:', err);
      const message =
        err?.message ||
        err?.error_description ||
        err?.error ||
        (typeof err === 'string' ? err : JSON.stringify(err));
      toastError('Erro ao salvar grupo: ' + message);
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

        <div className={styles.header} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Link href="/adicionais" className={styles.backLink} style={{ margin: '0 auto 1rem auto' }}>
            <ArrowLeft size={16} />
            Voltar para Adicionais
          </Link>
          <h1 className={styles.title}>{isEditing ? 'Editar Grupo de Adicionais' : 'Novo Grupo de Adicionais'}</h1>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.mainColumn}>
            {/* Status Card - Moved to top */}
            <div className={styles.card}>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Obrigatório</span>
                  <span className={styles.switchDescription}>O cliente precisa escolher neste grupo</span>
                </div>
                <label className={`${styles.switch} ${styles.greenToggle}`}>
                  <input
                    type="checkbox"
                    checked={obrigatorio}
                    onChange={(e) => setObrigatorio(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Informações do Grupo</h2>
              <p className={styles.cardSubtitle}>Defina como este grupo de adicionais será exibido.</p>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nome do Grupo <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Sabores, Coberturas, Bordas"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Categoria do Grupo <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.select}
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome_categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Seleção</label>
                <select
                  className={styles.select}
                  value={tipoSelecao}
                  onChange={(e) => setTipoSelecao(e.target.value === 'multiplo' ? 'multiplo' : 'unico')}
                >
                  <option value="unico">Escolha única</option>
                  <option value="multiplo">Múltipla escolha</option>
                </select>
              </div>

              <div className={styles.formGroup} style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className={styles.label}>Mínimo de opções</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={minOpcoes}
                    onChange={(e) => setMinOpcoes(parseInt(e.target.value) || 0)}
                    min={0}
                    disabled={tipoSelecao === 'unico'}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.label}>Máximo de opções</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={maxOpcoes}
                    onChange={(e) => setMaxOpcoes(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    min={0}
                    disabled={tipoSelecao === 'unico'}
                  />
                  <div style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem'}}>Use 0 para sem limite</div>
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
                Salvar Grupo
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function NovoGrupoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NovoGrupoContent />
    </Suspense>
  );
}
