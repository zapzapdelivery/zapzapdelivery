'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { ArrowLeft, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from '../../../produtos/novo/novo-produto.module.css';
import { OrderStatus } from '@/types/orderStatus';

type MovementKind = 'entrada' | 'saida' | 'ajuste';

interface ProductOption {
  id: string;
  nome_produto: string;
}

function NovaMovimentacaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError, warning } = useToast();

  const [movementType, setMovementType] = useState<MovementKind>('entrada');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [establishmentId, setEstablishmentId] = useState<string>('');
  const [establishmentName, setEstablishmentName] = useState<string>('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setEditingId(idFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('usuarios')
          .select('estabelecimento_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        const estabId = profile?.estabelecimento_id as string | null;

        if (!estabId) {
          toastError('Estabelecimento não encontrado para este usuário.');
          return;
        }

        setEstablishmentId(estabId);

        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch(`/api/estabelecimentos/${estabId}`, {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        });

        if (response.ok) {
          const estab = await response.json();
          setEstablishmentName(
            estab.nome_estabelecimento || estab.name || 'Estabelecimento'
          );
        }

        const { data: prods, error: prodError } = await supabase
          .from('produtos')
          .select('id, nome_produto')
          .eq('estabelecimento_id', estabId)
          .eq('status_produto', 'ativo')
          .order('nome_produto');

        if (prodError) {
          throw prodError;
        }

        setProducts(prods || []);
      } catch (err: any) {
        console.error('Erro ao carregar dados iniciais do estoque:', err);
        toastError('Erro ao carregar dados iniciais do estoque.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [router, toastError]);

  useEffect(() => {
    const fetchStockSummary = async () => {
      if (!establishmentId || !selectedProductId) {
        setCurrentStock(0);
        setMinStock(0);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('estoque_produtos')
          .select('estoque_atual, estoque_minimo')
          .eq('estabelecimento_id', establishmentId)
          .eq('produto_id', selectedProductId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setCurrentStock(data?.estoque_atual ?? 0);
        setMinStock(data?.estoque_minimo ?? 0);
      } catch (err: any) {
        console.error('Erro ao carregar resumo de estoque:', err);
        toastError('Erro ao carregar resumo de estoque.');
        setCurrentStock(0);
        setMinStock(0);
      }
    };

    fetchStockSummary();
  }, [establishmentId, selectedProductId, toastError]);

  useEffect(() => {
    const loadEditData = async () => {
      if (!editingId || !establishmentId) return;
      try {
        const { data, error } = await supabase
          .from('estoque_produtos')
          .select('produto_id, estoque_atual, estoque_minimo')
          .eq('id', editingId)
          .eq('estabelecimento_id', establishmentId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setSelectedProductId(data.produto_id as string);
          setCurrentStock(data.estoque_atual ?? 0);
          setMinStock(data.estoque_minimo ?? 0);
        }
      } catch (err: any) {
        console.error('Erro ao carregar movimentação para edição:', err);
        toastError('Erro ao carregar movimentação para edição.');
      }
    };

    loadEditData();
  }, [editingId, establishmentId, toastError]);

  const handleCancel = () => {
    router.push('/estoque/movimentacoes');
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      warning('Selecione um produto para lançar o estoque.');
      return;
    }

    try {
      if (!establishmentId) {
        toastError('Estabelecimento não identificado para esta movimentação.');
        return;
      }

      if (!quantity) {
        warning('Informe a quantidade da movimentação.');
        return;
      }

      const parsedQty = Number(quantity);
      if (Number.isNaN(parsedQty) || parsedQty < 0) {
        warning('Informe uma quantidade válida.');
        return;
      }

      if ((movementType === 'entrada' || movementType === 'saida') && parsedQty === 0) {
        warning('Para entrada e saída, a quantidade deve ser maior que zero.');
        return;
      }

      if (movementType === 'saida') {
        try {
          const { data: openOrders, error: openError } = await supabase
            .from('pedidos')
            .select(`
              id,
              numero_pedido,
              status_pedido,
              itens_pedidos (
                produto_id,
                quantidade
              )
            `)
            .eq('estabelecimento_id', establishmentId)
            .in('status_pedido', [
              OrderStatus.PEDINDO,
              OrderStatus.CONFIRMADO,
              OrderStatus.PREPARACAO,
              OrderStatus.PRONTO,
              OrderStatus.SAIU_ENTREGA,
              'Pedindo', // Legacy
              'Pedido Confirmado', // Legacy
              'Em Preparação', // Legacy
              'Pedido Pronto', // Legacy
              'Saiu Para Entrega', // Legacy
              'Em Andamento', // Old Legacy
              'Em Entrega' // Old Legacy
            ]);

          if (openError) {
            console.error(
              'Erro ao verificar pedidos em aberto para movimentação de saída:',
              openError
            );
          } else if (Array.isArray(openOrders) && openOrders.length > 0) {
            const ordersWithProduct = openOrders.filter((p: any) =>
              Array.isArray(p.itens_pedidos) &&
              p.itens_pedidos.some(
                (it: any) =>
                  String(it.produto_id) === selectedProductId &&
                  Number(it.quantidade) > 0
              )
            );

            if (ordersWithProduct.length > 0) {
              const numbers = ordersWithProduct
                .map((p: any) => p.numero_pedido)
                .filter(Boolean)
                .slice(0, 3)
                .join(', ');
              const msgBase =
                'Não é possível registrar saída manual para este produto porque há pedidos em aberto utilizando-o.';
              const msg =
                numbers.length > 0 ? `${msgBase} Pedidos: ${numbers}.` : msgBase;
              warning(msg);
              return;
            }
          }
        } catch (checkErr: any) {
          console.error(
            'Erro inesperado ao verificar pedidos em aberto antes da saída de estoque:',
            checkErr
          );
        }
      }

      setSaving(true);

      // Recarrega o estoque atual diretamente do banco para evitar desatualização
      const { data: stockRow, error: stockError } = await supabase
        .from('estoque_produtos')
        .select('id, estoque_atual, estoque_minimo')
        .eq('estabelecimento_id', establishmentId)
        .eq('produto_id', selectedProductId)
        .maybeSingle();

      if (stockError) {
        console.error('Erro ao buscar estoque atual antes da movimentação:', stockError);
        toastError('Erro ao buscar estoque atual. Tente novamente.');
        setSaving(false);
        return;
      }

      const previousStock = stockRow?.estoque_atual ?? 0;
      let newStock = previousStock;

      if (movementType === 'entrada') {
        newStock = previousStock + parsedQty;
      } else if (movementType === 'saida') {
        newStock = previousStock - parsedQty;
      } else if (movementType === 'ajuste') {
        newStock = parsedQty;
      }

      if (newStock < 0) {
        warning('A operação resultaria em estoque negativo. Ajuste a quantidade.');
        setSaving(false);
        return;
      }

      console.log('[Estoque] Movimentação solicitada', {
        movementType,
        quantity: parsedQty,
        establishmentId,
        selectedProductId,
        previousStock,
        newStock
      });

      // Atualiza ou cria o registro em estoque_produtos
      let estoqueProdutoId = stockRow?.id as string | undefined;
      if (estoqueProdutoId) {
        const { error: updateError } = await supabase
          .from('estoque_produtos')
          .update({ estoque_atual: newStock })
          .eq('id', estoqueProdutoId)
          .eq('estabelecimento_id', establishmentId);

        if (updateError) {
          console.error('Erro ao atualizar estoque_produtos:', updateError);
          toastError('Erro ao atualizar o estoque. Nenhuma alteração foi aplicada.');
          setSaving(false);
          return;
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('estoque_produtos')
          .insert({
            estabelecimento_id: establishmentId,
            produto_id: selectedProductId,
            estoque_atual: newStock,
            estoque_minimo: minStock ?? 0
          })
          .select('id')
          .maybeSingle();

        if (insertError) {
          console.error('Erro ao criar registro de estoque_produtos:', insertError);
          toastError('Erro ao criar o registro de estoque. Operação não concluída.');
          setSaving(false);
          return;
        }

        estoqueProdutoId = inserted?.id as string | undefined;
      }

      // Tenta registrar auditoria na tabela de movimentações (via API com supabaseAdmin)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const payload = {
            produto_id: selectedProductId,
            tipo_movimentacao: movementType,
            quantidade: parsedQty,
            motivo: reason && reason.trim() ? reason.trim() : undefined,
            criado_em: new Date().toISOString()
          };

          const resp = await fetch('/api/estoque/movimentacoes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            console.error(
              'Erro ao registrar movimentação de auditoria (API):',
              errBody?.error || resp.status
            );
          }
        } else {
          console.warn('Sessão não encontrada ao registrar movimentação de auditoria.');
        }
      } catch (auditErr: any) {
        console.error('Erro inesperado ao registrar log de movimentação:', auditErr);
      }

      console.log('[Estoque] Movimentação concluída com sucesso', {
        movementType,
        quantity: parsedQty,
        previousStock,
        newStock
      });

      success('Movimentação de estoque registrada com sucesso.');
      router.push('/estoque/movimentacoes');
    } catch (err: any) {
      console.error('Erro ao salvar movimentação de estoque:', err);
      toastError('Erro ao salvar movimentação de estoque.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.content}>
        <AdminHeader />

        <div className={styles.header}>
          <Link href="/estoque/movimentacoes" className={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Voltar para Estoque</span>
          </Link>
          <h1 className={styles.title}>
            {editingId ? 'Editar Movimentação de Estoque' : 'Cadastro de Estoque'}
          </h1>
          <p className={styles.subtitle}>
            {editingId
              ? 'Atualize os dados da movimentação de estoque do produto selecionado.'
              : 'Configure a entrada ou saída de produtos para seus estabelecimentos.'}
          </p>
        </div>

        {loading ? (
          <div style={{ marginTop: 80, color: '#6b7280' }}>Carregando dados...</div>
        ) : (
          <div className={styles.formGrid}>
          <div className={styles.mainColumn}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Dados da movimentação</h2>

              <div className={styles.formGroup}>
                <label className={styles.label}>Estabelecimento</label>
                <select className={styles.select} value={establishmentId} disabled>
                  <option value={establishmentId}>
                    {establishmentName || 'Estabelecimento atual'}
                  </option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Produto</label>
                <select
                  className={styles.select}
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Selecione o produto</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.nome_produto}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de movimentação</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setMovementType('entrada')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      border:
                        movementType === 'entrada'
                          ? '1px solid #10b981'
                          : '1px solid #e5e7eb',
                      backgroundColor:
                        movementType === 'entrada' ? '#ecfdf5' : '#ffffff',
                      color: movementType === 'entrada' ? '#065f46' : '#374151',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('saida')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      border:
                        movementType === 'saida'
                          ? '1px solid #f97316'
                          : '1px solid #e5e7eb',
                      backgroundColor:
                        movementType === 'saida' ? '#fff7ed' : '#ffffff',
                      color: movementType === 'saida' ? '#9a3412' : '#374151',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Saída
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('ajuste')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      border:
                        movementType === 'ajuste'
                          ? '1px solid #3b82f6'
                          : '1px solid #e5e7eb',
                      backgroundColor:
                        movementType === 'ajuste' ? '#eff6ff' : '#ffffff',
                      color: movementType === 'ajuste' ? '#1d4ed8' : '#374151',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Ajuste
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Quantidade</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    className={styles.input}
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setQuantity(v);
                    }}
                    style={{ maxWidth: 200 }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 14,
                      color: '#6b7280'
                    }}
                  >
                    UN
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Motivo / Observação</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Descreva o motivo da movimentação..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.sideColumn}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Resumo do estoque</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estoque atual</label>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    fontWeight: 600,
                    fontSize: 18
                  }}
                >
                  <span>{currentStock}</span>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>UN</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estoque mínimo</label>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    fontWeight: 600,
                    fontSize: 18
                  }}
                >
                  <span>{minStock}</span>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>UN</span>
                </div>
              </div>
            </div>
            
            <div className={styles.actions}>
              <button
                className={styles.cancelButton}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? 'Salvando...' : 'Salvar Movimentação'}
              </button>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}

export default function NovaMovimentacaoEstoquePage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Carregando...</div>}>
      <NovaMovimentacaoContent />
    </Suspense>
  );
}
