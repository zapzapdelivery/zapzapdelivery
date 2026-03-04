import { createClient } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';
import CheckoutClient from './CheckoutClient';
import styles from './checkout.module.css';

// Configuração do Supabase para Server Components
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getOrderData(id: string) {
  // Buscar pedido
  const { data: pedido, error } = await supabaseAdmin
    .from('pedidos')
    .select('*, estabelecimentos(*)')
    .eq('id', id)
    .single();

  if (error || !pedido) return null;
  return pedido;
}

async function getMpConfig(estabelecimentoId: string) {
  // Buscar config MP
  const { data: config, error } = await supabaseAdmin
    .from('configuracoes_mercadopago')
    .select('*')
    .eq('estabelecimento_id', estabelecimentoId)
    .single();
  
  if (error || !config) return null;
  return config;
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const pedido = await getOrderData(id);

  if (!pedido) {
    notFound();
  }

  // Verificar se o pedido já foi pago ou processado
  // Permite pagamento apenas para pedidos com status inicial (Pedindo ou Pendente)
  const statusPermitidos = ['Pedindo', 'Pendente'];
  if (!statusPermitidos.includes(pedido.status_pedido)) {
     redirect(`/minhaconta/pedidos?status=already_processed&pedido=${pedido.numero_pedido}`);
  }

  const configMp = await getMpConfig(pedido.estabelecimento_id);

  if (!configMp || !configMp.ativo) {
    return (
        <div className={styles.errorContainer}>
            <h1>Pagamento Indisponível</h1>
            <p>O pagamento online não está configurado para este estabelecimento.</p>
        </div>
    );
  }

  const publicKey = configMp.ambiente === 'producao' 
    ? configMp.public_key_producao 
    : configMp.public_key_teste;

  if (!publicKey) {
    return (
        <div className={styles.errorContainer}>
            <h1>Erro de Configuração</h1>
            <p>Credenciais de pagamento inválidas. Entre em contato com o estabelecimento.</p>
        </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
       <CheckoutClient order={pedido} publicKey={publicKey} />
    </div>
  );
}
