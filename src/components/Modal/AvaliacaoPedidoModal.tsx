import React from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './AvaliacaoPedidoModal.module.css';

interface AvaliacaoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: string | null;
  estabelecimentoId: string | null;
  entregadorId?: string | null;
  estabelecimentoNome?: string | null;
  entregadorNome?: string | null;
  titulo?: string;
  onSubmitted?: (pedidoId: string) => void;
}

export function AvaliacaoPedidoModal({
  isOpen,
  onClose,
  pedidoId,
  estabelecimentoId,
  entregadorId,
  estabelecimentoNome,
  entregadorNome,
  titulo,
  onSubmitted
}: AvaliacaoPedidoModalProps) {
  const { success, error } = useToast();
  const [notaPedido, setNotaPedido] = React.useState<number>(0);
  const [comentarioPedido, setComentarioPedido] = React.useState<string>('');
  const [notaEstabelecimento, setNotaEstabelecimento] = React.useState<number>(0);
  const [comentarioEstabelecimento, setComentarioEstabelecimento] = React.useState<string>('');
  const [notaEntregador, setNotaEntregador] = React.useState<number>(0);
  const [comentarioEntregador, setComentarioEntregador] = React.useState<string>('');
  const [enviando, setEnviando] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setNotaPedido(0);
    setComentarioPedido('');
    setNotaEstabelecimento(0);
    setComentarioEstabelecimento('');
    setNotaEntregador(0);
    setComentarioEntregador('');
    setEnviando(false);
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!pedidoId || !estabelecimentoId) {
      error('Não foi possível identificar o pedido.');
      return;
    }
    if (!notaPedido || notaPedido < 1 || notaPedido > 5) {
      error('Selecione uma nota de 1 a 5 para o pedido.');
      return;
    }
    if (!notaEstabelecimento || notaEstabelecimento < 1 || notaEstabelecimento > 5) {
      error('Selecione uma nota de 1 a 5 para o estabelecimento.');
      return;
    }
    if (entregadorId && (!notaEntregador || notaEntregador < 1 || notaEntregador > 5)) {
      error('Selecione uma nota de 1 a 5 para o entregador.');
      return;
    }
    try {
      setEnviando(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ? String(userData.user.id) : '';
      if (!uid) {
        error('Você precisa estar logado para avaliar.');
        return;
      }

      const insertPedido = await supabase.from('avaliacoes_pedidos').insert({
        pedido_id: pedidoId,
        cliente_id: uid,
        estabelecimento_id: estabelecimentoId,
        nota: notaPedido,
        comentario: comentarioPedido.trim() ? comentarioPedido.trim() : null
      });

      if (insertPedido.error) {
        const code = (insertPedido.error as any)?.code ? String((insertPedido.error as any).code) : '';
        if (code === '23505') {
          error('Você já avaliou este pedido.');
          onSubmitted?.(pedidoId);
          onClose();
          return;
        }
        error(insertPedido.error.message || 'Erro ao enviar avaliação do pedido.');
        return;
      }

      const insertEstabelecimento = await supabase.from('avaliacoes_estabelecimentos').insert({
        pedido_id: pedidoId,
        cliente_id: uid,
        estabelecimento_id: estabelecimentoId,
        nota: notaEstabelecimento,
        comentario: comentarioEstabelecimento.trim() ? comentarioEstabelecimento.trim() : null
      });

      if (insertEstabelecimento.error) {
        const code = (insertEstabelecimento.error as any)?.code ? String((insertEstabelecimento.error as any).code) : '';
        if (code !== '23505') {
          error(insertEstabelecimento.error.message || 'Erro ao enviar avaliação do estabelecimento.');
          return;
        }
      }

      if (entregadorId) {
        const insertEntregador = await supabase.from('avaliacoes_entregadores').insert({
          pedido_id: pedidoId,
          entregador_id: entregadorId,
          estabelecimento_id: estabelecimentoId,
          cliente_id: uid,
          avaliador_tipo: 'cliente',
          nota: notaEntregador,
          comentario: comentarioEntregador.trim() ? comentarioEntregador.trim() : null
        });

        if (insertEntregador.error) {
          const code = (insertEntregador.error as any)?.code ? String((insertEntregador.error as any).code) : '';
          if (code !== '23505') {
            error(insertEntregador.error.message || 'Erro ao enviar avaliação do entregador.');
            return;
          }
        }
      }

      success('Avaliação enviada com sucesso.');
      onSubmitted?.(pedidoId);
      onClose();
    } finally {
      setEnviando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={enviando ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Avaliar</h3>
          <div className={styles.subtitle}>{titulo || ''}</div>
        </div>
        <div className={styles.content}>
          <div>
            <div className={styles.sectionTitle}>Pedido</div>
            <div className={styles.label}>Sua nota</div>
            <div className={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = idx + 1;
                const active = notaPedido >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.starBtn} ${active ? styles.starActive : ''}`.trim()}
                    onClick={() => setNotaPedido(value)}
                    disabled={enviando}
                    aria-label={`Nota ${value}`}
                  >
                    <Star size={18} className={active ? 'fill-current' : ''} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className={styles.label}>Comentário (opcional)</div>
            <textarea
              className={styles.textarea}
              value={comentarioPedido}
              onChange={(e) => setComentarioPedido(e.target.value)}
              placeholder="Conte como foi sua experiência..."
              disabled={enviando}
            />
          </div>

          <div className={styles.sectionDivider} />

          <div>
            <div className={styles.sectionTitle}>
              Estabelecimento{estabelecimentoNome ? `: ${estabelecimentoNome}` : ''}
            </div>
            <div className={styles.label}>Sua nota</div>
            <div className={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = idx + 1;
                const active = notaEstabelecimento >= value;
                return (
                  <button
                    key={`est-${value}`}
                    type="button"
                    className={`${styles.starBtn} ${active ? styles.starActive : ''}`.trim()}
                    onClick={() => setNotaEstabelecimento(value)}
                    disabled={enviando}
                    aria-label={`Nota ${value} para o estabelecimento`}
                  >
                    <Star size={18} className={active ? 'fill-current' : ''} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className={styles.label}>Comentário (opcional)</div>
            <textarea
              className={styles.textarea}
              value={comentarioEstabelecimento}
              onChange={(e) => setComentarioEstabelecimento(e.target.value)}
              placeholder="Conte como foi sua experiência com o estabelecimento..."
              disabled={enviando}
            />
          </div>

          {entregadorId ? (
            <>
              <div className={styles.sectionDivider} />

              <div>
                <div className={styles.sectionTitle}>
                  Entregador{entregadorNome ? `: ${entregadorNome}` : ''}
                </div>
                <div className={styles.label}>Sua nota</div>
                <div className={styles.starsRow}>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const value = idx + 1;
                    const active = notaEntregador >= value;
                    return (
                      <button
                        key={`ent-${value}`}
                        type="button"
                        className={`${styles.starBtn} ${active ? styles.starActive : ''}`.trim()}
                        onClick={() => setNotaEntregador(value)}
                        disabled={enviando}
                        aria-label={`Nota ${value} para o entregador`}
                      >
                        <Star size={18} className={active ? 'fill-current' : ''} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className={styles.label}>Comentário (opcional)</div>
                <textarea
                  className={styles.textarea}
                  value={comentarioEntregador}
                  onChange={(e) => setComentarioEntregador(e.target.value)}
                  placeholder="Conte como foi sua experiência com a entrega..."
                  disabled={enviando}
                />
              </div>
            </>
          ) : null}
        </div>
        <div className={styles.divider} />
        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={enviando} type="button">
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={enviando} type="button">
            {enviando ? 'Enviando...' : 'Enviar Avaliação'}
          </button>
        </div>
      </div>
    </div>
  );
}
