'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { ChevronLeft, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import styles from './checkout.module.css';

interface CheckoutClientProps {
  order: any;
  publicKey: string;
}

export default function CheckoutClient({ order, publicKey }: CheckoutClientProps) {
  const router = useRouter();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se o pagamento for em dinheiro, cartão na entrega ou offline, o pedido já está "confirmado" (sem pagamento online).
    // Então limpamos o carrinho aqui.
    // PIX agora é tratado como ONLINE (via Mercado Pago)
    if (['dinheiro', 'offline', 'cartao_entrega'].includes(order.forma_pagamento)) {
      clearCart();
    }
  }, [order.forma_pagamento, clearCart]);

  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey, { locale: 'pt-BR' });
      setLoading(false);
    }
  }, [publicKey]);

  const initialization = {
    amount: Number(order.total_pedido),
  };

  // Se o método for explicitamente mercado_pago ou pix, é online.
  const isOnline = ['mercado_pago', 'pix'].includes(order.forma_pagamento);

  const customization = {
    paymentMethods: {
      ticket: order.forma_pagamento === 'pix' ? [] : 'all',
      bankTransfer: 'all', // PIX está aqui
      creditCard: order.forma_pagamento === 'pix' ? [] : 'all',
      debitCard: order.forma_pagamento === 'pix' ? [] : 'all',
      mercadoPago: order.forma_pagamento === 'pix' ? [] : ('all' as any),
    },
    visual: {
        style: {
            theme: 'default' as const, // 'default' | 'dark' | 'bootstrap' | 'flat'
        }
    }
  };

  const onSubmit = async ({ formData }: any) => {
    try {
      const response = await fetch('/api/pagamentos/mercado-pago/processar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData, orderId: order.id }),
      });
      const data = await response.json();
      
      if (data.status === 'approved' || data.status === 'in_process' || data.status === 'pending' || data.status === 'pending_waiting_transfer') {
         // Limpar o carrinho quando o pagamento for aprovado ou estiver em processamento (PIX)
         clearCart();
         // Redirecionar para pedidos com sucesso
         router.push(`/minhaconta/pedidos?status=success&pedido=${order.numero_pedido}`);
      } else {
         // Mostrar erro detalhado vindo do backend
         const errorMessage = data.detail || data.error || data.status || 'Erro desconhecido';
         alert(`Pagamento não aprovado: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Erro no pagamento:', error);
      alert('Erro ao processar pagamento.');
    }
  };

  const onError = async (error: any) => {
    console.log(error);
  };

  const onReady = async () => {
    // Brick carregado
  };

  if (loading && isOnline) return <div className={styles.loading}>Carregando pagamento...</div>;

  // Se o pagamento for offline/manual, mostra apenas confirmação
  if (!isOnline) {
    return (
      <div className={styles.container}>
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>
            <Check size={48} color="#22c55e" />
          </div>
          <h1>Pedido Confirmado!</h1>
          <p className={styles.orderNumber}>Pedido #{order.numero_pedido}</p>
          
          <div className={styles.orderSummary}>
            <p>Obrigado pelo seu pedido!</p>
            <p>
              {order.forma_pagamento === 'pix' 
                ? 'Pagamento via PIX (Chave/QR Code).' 
                : order.forma_pagamento === 'cartao_entrega' 
                  ? 'Pagamento no Cartão (Entrega).' 
                  : 'O pagamento será realizado na entrega.'}
            </p>
            <div className={styles.totalRow}>
              <span>Total:</span>
              <strong>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_pedido)}
              </strong>
            </div>
          </div>

          <button 
            onClick={() => {
              clearCart();
              router.push(`/minhaconta/pedidos?status=success&pedido=${order.numero_pedido}`);
            }}
            className={styles.primaryButton}
          >
            Acompanhar Pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          <ChevronLeft size={24} />
          Voltar
        </button>
        <h1>Pagamento Online</h1>
      </header>

      <div className={styles.orderSummary}>
        <h2>Resumo do Pedido #{order.numero_pedido}</h2>
        <div className={styles.summaryItem}>
          <span>Total a pagar:</span>
          <strong>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_pedido)}
          </strong>
        </div>
        <p className={styles.establishmentName}>
           {order.estabelecimentos?.nome_estabelecimento}
        </p>
      </div>

      <div className={styles.paymentContainer}>
        <Payment
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
          onReady={onReady}
          onError={onError}
          locale="pt-BR"
        />
      </div>
      
      <div className={styles.securityNote}>
        <p>Pagamento processado com segurança pelo Mercado Pago.</p>
      </div>
    </div>
  );
}
