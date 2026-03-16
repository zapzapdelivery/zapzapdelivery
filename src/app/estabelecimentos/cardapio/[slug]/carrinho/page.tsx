"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { 
  ShoppingCart, 
  Plus, 
  MessageSquare,
  ArrowLeft,
  Trash2,
  Calculator,
  Ticket,
  CreditCard,
  Banknote,
  ShieldCheck,
  Send,
  Minus,
  ChevronLeft,
  MapPin,
  QrCode,
  Store,
  Utensils,
  Bike,
  Loader2,
  Check,
  AlertTriangle,
  XCircle,
  Info,
  Navigation
} from 'lucide-react';
import styles from './carrinho.module.css';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/Toast/ToastProvider';
import { useNotification } from '@/context/NotificationContext';
import { Loading } from '@/components/Loading/Loading';
import Link from 'next/link';

interface DeliveryFeeConfig {
  tipo_taxa: 'fixo' | 'bairro' | 'distancia';
  valor_base: number;
  preco_km?: number;
  km_base?: number;
  distancia_maxima?: number;
  taxas_bairros?: { nome_bairro: string; valor_taxa: number }[];
}

interface Estabelecimento {
  id: string;
  nome_estabelecimento: string;
  imagem_estabelecimento_url?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  taxa_entrega?: DeliveryFeeConfig;
  mercadopago_public_key?: string;
}

export default function CarrinhoPage() {
  const toast = useToast();
  const { playNotificationSound } = useNotification();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { items, totalItems, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'DINHEIRO' | 'CARTÃO' | 'MERCADO_PAGO'>('PIX');
  const [deliveryOption, setDeliveryOption] = useState<'DELIVERY' | 'RETIRADA' | 'CONSUMO'>('DELIVERY');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [cep, setCep] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [savedAddress, setSavedAddress] = useState<any>(null);

  // New State for Multi-step Checkout
  const [currentStep, setCurrentStep] = useState(1);
  const [addressDetails, setAddressDetails] = useState({
    rua: '',
    numero: '',
    complemento: '',
    referencia: '',
    cidade: '',
    uf: ''
  });

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [mpReady, setMpReady] = useState(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  
  // Real-time Stock Updates
  const fetchStock = React.useCallback(async () => {
    if (!estabelecimento) return;
    try {
      const res = await fetch(`/api/estabelecimentos/cardapio/${slug}/produtos`);
      if (res.ok) {
        const products = await res.json();
        const newStock: Record<string, number> = {};
        products.forEach((p: any) => {
          if (p.estoque_atual !== undefined) {
            newStock[p.id] = p.estoque_atual;
          }
        });
        setStockMap(newStock);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
    }
  }, [estabelecimento, slug]);

  useEffect(() => {
    if (!estabelecimento) return;

    fetchStock();

    const channel = supabase
      .channel('cart-stock-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estoque_produtos', filter: `estabelecimento_id=eq.${estabelecimento.id}` },
        () => {
          console.log('Stock update received via realtime');
          fetchStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [estabelecimento, fetchStock]);


  // Initialize Mercado Pago
  useEffect(() => {
    if (estabelecimento?.mercadopago_public_key) {
      initMercadoPago(estabelecimento.mercadopago_public_key, { locale: 'pt-BR' });
      setMpReady(true);
    }
  }, [estabelecimento?.mercadopago_public_key]);

  // Persist Address Details
  useEffect(() => {
    const saved = sessionStorage.getItem('addressDetails');
    if (saved) {
      setAddressDetails(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('addressDetails', JSON.stringify(addressDetails));
  }, [addressDetails]);

  // Load user address on mount
  useEffect(() => {
    async function loadUserAddress() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Fetch user name
          let name = '';
          
          // 1. Try clientes table
          const { data: clientData } = await supabase
            .from('clientes')
            .select('nome_cliente')
            .eq('id', session.user.id)
            .maybeSingle();

          if (clientData?.nome_cliente) {
            name = clientData.nome_cliente;
          } 
          
          // 2. Try usuarios table if empty
          if (!name) {
            const { data: userData } = await supabase
                .from('usuarios')
                .select('nome')
                .eq('id', session.user.id)
                .maybeSingle();
            
            if (userData?.nome) {
                name = userData.nome;
            }
          }

          // 3. Fallback to metadata
          if (!name) {
            name = session.user.user_metadata?.full_name || 
                   session.user.user_metadata?.name || 
                   session.user.email || 
                   'Cliente';
          }

          setUserName(name);

          // Use the API to bypass RLS issues and get the correct address
          const response = await fetch('/api/minhaconta/enderecos', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.addresses && data.addresses.length > 0) {
              const address = data.addresses[0];
              setSavedAddress(address);
              if (address.cep) {
                setCep(address.cep);
              }
              
              // Auto-fill address details from saved address
              setAddressDetails(prev => ({
                ...prev,
                rua: address.rua || prev.rua,
                numero: address.numero || prev.numero,
                complemento: address.complemento || prev.complemento,
                referencia: address.referencia || prev.referencia,
                cidade: address.cidade || prev.cidade,
                uf: address.uf || prev.uf
              }));

              if (address.bairro) {
                setSelectedNeighborhood(address.bairro);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading user address:', error);
      }
    }
    loadUserAddress();
  }, []);

  // Calculate fee when distance changes
  useEffect(() => {
    if (
      estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' &&
      distance !== null
    ) {
      const { valor_base, preco_km, km_base, distancia_maxima } = estabelecimento.taxa_entrega;
      
      if (distancia_maxima && distance > distancia_maxima) {
        setDeliveryError(`Endereço fora da área de entrega (Máx: ${distancia_maxima}km, Distância: ${distance}km)`);
        setDeliveryFee(0);
      } else {
        setDeliveryError(null);
        let fee = Number(valor_base);
        if (km_base && distance > Number(km_base) && preco_km) {
          const extraKm = distance - Number(km_base);
          fee += extraKm * Number(preco_km);
        }
        setDeliveryFee(fee);
      }
    } else {
      // If distance is null (cleared or error), reset fee only if in distance mode
      if (estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' && distance === null) {
          setDeliveryFee(0);
      }
    }
  }, [estabelecimento, distance]);
  
  // Trigger calculation when saved address is loaded and establishment is ready
  useEffect(() => {
    if (savedAddress && savedAddress.cep && estabelecimento && estabelecimento.taxa_entrega?.tipo_taxa === 'distancia' && !distance) {
        calculateShipping(savedAddress.cep);
    }
  }, [savedAddress, estabelecimento]);

  const calculateShipping = async (cepValue: string) => {
    const rawCep = cepValue.replace(/\D/g, '');
    if (rawCep.length !== 8) {
      if (cepValue.length > 0) {
         setDeliveryError('CEP incompleto');
      }
      return;
    }

    try {
      setLoadingCep(true);
      setDeliveryError(null);
      
      // Reset fee/distance before calculation
      if (estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia') {
        setDeliveryFee(0);
        setDistance(null);
      }

      const response = await fetch(`/api/utils/cep/${rawCep}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.erro) {
            setDeliveryError('CEP não encontrado');
            return;
        }

        // Validate City Match
        const cepCity = data.localidade?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
        const estCity = estabelecimento?.cidade?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

        if (estCity && cepCity && cepCity !== estCity) {
            showModal(
                'error', 
                'Cidade Não Atendida', 
                `Não realizamos entregas para outra cidade. Atendemos apenas em ${estabelecimento?.cidade} - ${estabelecimento?.uf}. Por favor, informe um CEP válido desta cidade.`
            );
            setDeliveryError(`Entregas apenas em ${estabelecimento?.cidade} - ${estabelecimento?.uf}`);
            
            // Keep locked city/uf but clear other fields
            setAddressDetails(prev => ({
                ...prev,
                rua: '',
                cidade: estabelecimento?.cidade || '',
                uf: estabelecimento?.uf || ''
            }));
            return;
        }

        // Populate address details
        setAddressDetails(prev => ({
          ...prev,
          rua: data.logradouro || '',
          cidade: estabelecimento?.cidade || data.localidade || '',
          uf: estabelecimento?.uf || data.uf || ''
        }));
        
        // Update Bairro for non-bairro fee types
        if (estabelecimento?.taxa_entrega?.tipo_taxa !== 'bairro' && data.bairro) {
            setSelectedNeighborhood(data.bairro);
        }

        // Logic for 'bairro'
        if (estabelecimento?.taxa_entrega?.tipo_taxa === 'bairro' && estabelecimento.taxa_entrega.taxas_bairros) {
            if (data.bairro) {
              const normalizedBairro = data.bairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              
              const foundBairro = estabelecimento.taxa_entrega.taxas_bairros.find(b => 
                b.nome_bairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedBairro ||
                b.nome_bairro.toLowerCase().includes(normalizedBairro) ||
                normalizedBairro.includes(b.nome_bairro.toLowerCase())
              );

              if (foundBairro) {
                setSelectedNeighborhood(foundBairro.nome_bairro);
                setDeliveryFee(foundBairro.valor_taxa);
              } else {
                 setDeliveryError(`Bairro ${data.bairro} não atendido`);
                 setDeliveryFee(0);
              }
            }
        }

        // Logic for 'distancia'
        if (estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia') {
            let customerAddress = [
                data.logradouro,
                data.bairro,
                data.localidade ? `${data.localidade} - ${data.uf}` : null
            ].filter(Boolean).join(', ');
            
            // If saved address matches this CEP, use full address for better precision
            if (savedAddress && savedAddress.cep && savedAddress.cep.replace(/\D/g, '') === rawCep) {
                customerAddress = [
                    savedAddress.endereco,
                    savedAddress.numero,
                    savedAddress.bairro,
                    savedAddress.cidade ? `${savedAddress.cidade} - ${savedAddress.uf}` : null
                ].filter(Boolean).join(', ');
            }

            const establishmentAddress = [
                estabelecimento.endereco,
                estabelecimento.numero,
                estabelecimento.bairro,
                estabelecimento.cidade ? `${estabelecimento.cidade} - ${estabelecimento.uf}` : null
            ].filter(Boolean).join(', ');

            try {
                const distResponse = await fetch('/api/utils/distance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: establishmentAddress,
                        destination: customerAddress
                    })
                });

                if (!distResponse.ok) {
                    const errorData = await distResponse.json();
                    throw new Error(errorData.error || 'Erro ao calcular distância');
                }

                const distData = await distResponse.json();
                if (typeof distData.distance === 'number') {
                    setDistance(distData.distance);
                } else {
                    throw new Error('Distância inválida retornada pela API');
                }

            } catch (err: any) {
                console.error('Error calculating distance:', err);
                setDeliveryError(err.message || 'Erro ao calcular distância');
            }
        }
      } else {
        setDeliveryError('CEP não encontrado');
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
      setDeliveryError('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    if (value.length > 5) {
      value = value.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setCep(value);

    // Auto-calculate if 8 digits
    const rawCep = value.replace(/\D/g, '');
    if (rawCep.length === 8) {
      calculateShipping(value);
    }
  };

  const handleNeighborhoodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bairro = e.target.value;
    setSelectedNeighborhood(bairro);
    setDeliveryError(null);
    
    if (!estabelecimento?.taxa_entrega?.taxas_bairros) return;

    if (bairro === '') {
      setDeliveryFee(0);
      return;
    }

    const feeConfig = estabelecimento.taxa_entrega.taxas_bairros.find(
      t => t.nome_bairro === bairro
    );

    if (feeConfig) {
      setDeliveryFee(feeConfig.valor_taxa);
    }
  };


  // Calculate distance and fee
  useEffect(() => {
    // This logic is now handled in calculateShipping via API
    // Just keeping the effect for cleanup if needed or other side effects
  }, [estabelecimento]);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string | React.ReactNode;
    orderNumber?: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showModal = (type: 'success' | 'error' | 'warning', title: string, message: string | React.ReactNode, orderNumber?: string) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      orderNumber
    });
  };

  const closeModal = () => {
    if (modalConfig.type === 'success' && modalConfig.orderNumber) {
      // Não redireciona automaticamente - o usuário deve clicar no botão para ir ao checkout
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Validate Cart against Stock (Real-time)
  useEffect(() => {
    if (Object.keys(stockMap).length === 0 || items.length === 0) return;

    let changed = false;
    const messages: string[] = [];

    items.forEach(item => {
      const available = stockMap[item.id];
      // If available is undefined, it means we don't have stock info (maybe not tracked or error), ignore
      if (available === undefined) return;

      if (available <= 0) {
        removeItem(item.id);
        messages.push(`"${item.nome_produto}" esgotou e foi removido.`);
        changed = true;
      } else if (item.quantidade > available) {
        updateQuantity(item.id, available);
        messages.push(`Quantidade de "${item.nome_produto}" ajustada para ${available} (limite de estoque).`);
        changed = true;
      }
    });

    if (changed && messages.length > 0) {
      showModal('warning', 'Atualização de Estoque', messages.join('\n'));
    }
  }, [stockMap, items]); // Re-run when stock changes or items change

  // Verificar se veio de um redirecionamento de login para finalizar o pedido
  useEffect(() => {
    const checkRedirect = async () => {
      // Pequeno delay para garantir que a sessão foi restaurada
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Se usuário está logado, verificamos se o parâmetro de redirecionamento está presente na URL
        // Isso indicaria que ele acabou de voltar do login
        // Mas como o próprio login já redireciona para cá, podemos assumir que se ele clicou em finalizar antes,
        // ele gostaria de continuar.
        // Uma abordagem melhor seria verificar um flag no localStorage ou sessionStorage
        const pendingOrder = sessionStorage.getItem('pendingOrder');
        if (pendingOrder === 'true') {
          sessionStorage.removeItem('pendingOrder');
          handleFinalizeOrder();
        }
      }
    };
    
    checkRedirect();
  }, []);

  useEffect(() => {
    async function fetchEstabelecimento() {
      if (!slug) return;
      
      try {
        setLoading(true);
        setErrorMsg(null);
        
        // Use API route to bypass RLS issues for public access
        const response = await fetch(`/api/estabelecimentos/cardapio/${slug}/dados`);
        
        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error || 'Estabelecimento não encontrado');
        }
        
        const data = await response.json();
        
        if (data && data.estabelecimento) {
          console.log('[Carrinho] Fetched estabelecimento:', data.estabelecimento);
          if (data.estabelecimento.taxa_entrega) {
             console.log('[Carrinho] Taxa Entrega Config:', data.estabelecimento.taxa_entrega);
             console.log('[Carrinho] Taxas Bairros:', data.estabelecimento.taxa_entrega.taxas_bairros);
          }
          setEstabelecimento(data.estabelecimento);
        } else {
           throw new Error('Dados do estabelecimento inválidos');
        }

      } catch (err: any) {
        console.error('Erro ao buscar estabelecimento:', err);
        setErrorMsg(err.message || 'Erro ao carregar dados do estabelecimento. Tente novamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchEstabelecimento();
  }, [slug]);

  useEffect(() => {
    if (deliveryOption !== 'DELIVERY' || !estabelecimento?.taxa_entrega) {
      setDeliveryFee(0);
      return;
    }

    const { taxa_entrega } = estabelecimento;

    if (taxa_entrega.tipo_taxa === 'fixo') {
      setDeliveryFee(Number(taxa_entrega.valor_base));
    } else if (taxa_entrega.tipo_taxa === 'bairro') {
      // Fee is set by calculateDeliveryFee
    } else if (taxa_entrega.tipo_taxa === 'distancia') {
      // TODO: Implement distance calculation
      setDeliveryFee(Number(taxa_entrega.valor_base));
    }
  }, [estabelecimento, deliveryOption]);

  const handleBack = () => {
    router.push(`/estabelecimentos/cardapio/${slug}`);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Digite o código do cupom');
      return;
    }

    if (!estabelecimento) {
      setCouponError('Estabelecimento não carregado');
      return;
    }

    try {
      setValidatingCoupon(true);
      setCouponError(null);

      const response = await fetch(`/api/estabelecimentos/cardapio/${slug}/cupons/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: couponCode,
          estabelecimento_id: estabelecimento.id,
          valor_pedido: totalPrice
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cupom inválido');
      }

      setAppliedCoupon(data.cupom);
      setCouponCode('');
      showModal('success', 'Cupom Aplicado!', `Desconto de ${data.cupom.tipo === 'porcentagem' ? `${data.cupom.valor}%` : `R$ ${data.cupom.valor}`} aplicado com sucesso!`);

    } catch (error: any) {
      console.error('Erro ao validar cupom:', error);
      setCouponError(error.message);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    if (appliedCoupon.tipo === 'porcentagem') {
      return (totalPrice * appliedCoupon.valor) / 100;
    } else {
      return appliedCoupon.valor;
    }
  };

  const finalTotal = Math.max(0, totalPrice + deliveryFee - calculateDiscount());

  const submitOrder = async () => {
    if (isFinalizing) return;
    
    setIsFinalizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        sessionStorage.setItem('pendingOrder', 'true');
        const returnUrl = encodeURIComponent(window.location.pathname);
        router.push(`/paineladmin?redirect=${returnUrl}`);
        return;
      }

      console.log('Usuário logado, criando pedido...');
      
      if (items.length === 0) {
        showModal('warning', 'Carrinho Vazio', 'Seu carrinho está vazio!');
        return;
      }

      const deliveryMap: Record<string, string> = {
        'DELIVERY': 'delivery',
        'RETIRADA': 'retirada',
        'CONSUMO': 'consumo'
      };

      const paymentMap: Record<string, string> = {
        'PIX': 'pix',
        'DINHEIRO': 'dinheiro',
        'CARTÃO': 'cartao_entrega',
        'MERCADO_PAGO': 'mercado_pago'
      };

      const finalDeliveryOption = deliveryMap[deliveryOption] || 'delivery';
      const finalPaymentMethod = paymentMap[paymentMethod] || 'pix';

      const fullAddress = deliveryOption === 'DELIVERY' 
        ? `${addressDetails.rua}, ${addressDetails.numero}${addressDetails.complemento ? ` - ${addressDetails.complemento}` : ''}, ${selectedNeighborhood}, ${addressDetails.cidade} - ${addressDetails.uf} (CEP: ${cep})`
        : (deliveryOption === 'CONSUMO' ? 'Consumir no Local' : 'Retirada no Local');

      let observacaoExtra = deliveryOption === 'CONSUMO' ? ' (Consumo no local)' : '';
      if (deliveryOption === 'DELIVERY') {
        observacaoExtra += `\nEndereço: ${fullAddress}`;
        if (addressDetails.referencia) {
          observacaoExtra += `\nReferência: ${addressDetails.referencia}`;
        }
      }
      if (finalPaymentMethod === 'mercado_pago') {
        observacaoExtra += '\n(Pagamento Online - Pendente)';
      }
      
      const response = await fetch('/api/pedidos/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items,
          estabelecimento_id: estabelecimento?.id,
          forma_pagamento: finalPaymentMethod,
          forma_entrega: finalDeliveryOption,
          observacao: observacaoExtra.trim(),
          user_id: user.id,
          cupom_id: appliedCoupon ? appliedCoupon.id : null,
          valor_desconto: calculateDiscount(),
          endereco_entrega: deliveryOption === 'DELIVERY' ? fullAddress : null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar pedido via API');
      }

      const order = result.order;

      if (order) {
        console.log('Pedido criado com sucesso:', order);
        playNotificationSound(1);
        
        sessionStorage.removeItem('pendingOrder');

        if (['DINHEIRO', 'CARTÃO'].includes(paymentMethod)) {
           clearCart();
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        window.location.href = `/checkout/${order.id}`;
        return;
      }
      
    } catch (error: any) {
      console.error('Erro ao finalizar pedido:', error);
      showModal('error', 'Erro ao realizar pedido', error.message || 'Erro desconhecido');
      fetchStock();
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalizeOrder = async () => {
    // Step 1: Validate Delivery Option and CEP
    if (currentStep === 1) {
      if (deliveryOption === 'DELIVERY') {
        if (estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia') {
          if (!cep || cep.length < 9) {
            showModal('warning', 'CEP Obrigatório', 'Por favor, informe seu CEP para entrega.');
            return;
          }
          if (deliveryError) {
            showModal('error', 'Endereço Inválido', deliveryError);
            return;
          }
        }
        
        if (estabelecimento?.taxa_entrega?.tipo_taxa === 'bairro' && !selectedNeighborhood) {
             showModal('warning', 'Bairro Obrigatório', 'Por favor, selecione seu bairro para calcular a taxa.');
             return;
        }

        setCurrentStep(2); // Go to Address Details
      } else {
        // Retirada/Consumo -> Go to Confirmation (Step 3) where payment is selected
        setCurrentStep(3);
      }
      return;
    }

    // Step 2: Validate Address Details (Only for Delivery)
    if (currentStep === 2) {
      if (deliveryOption === 'DELIVERY') {
        if (deliveryError) {
            toast.error(deliveryError);
            return;
        }
        if (!addressDetails.rua) {
          toast.error('Por favor, informe o nome da rua.');
          return;
        }
        if (!addressDetails.numero) {
          toast.error('Por favor, informe o número do endereço.');
          return;
        }
        if (!addressDetails.cidade) {
            toast.error('Por favor, informe a cidade.');
            return;
        }
        if (!addressDetails.uf) {
            toast.error('Por favor, informe o estado (UF).');
            return;
        }
        if (estabelecimento?.taxa_entrega?.tipo_taxa === 'bairro' && !selectedNeighborhood) {
           toast.error('Por favor, selecione seu bairro.');
           return;
        }
      }
      
      // Go to Confirmation (Step 3) where payment is selected
      setCurrentStep(3);
      return;
    }

    // Step 3: Final Confirmation and Order Creation
    if (currentStep === 3) {
      if (!estabelecimento) {
        showModal('error', 'Erro', 'Estabelecimento não carregado. Tente recarregar a página.');
        return;
      }
      await submitOrder();
    }
  };

  if (loading) return <Loading message="Carregando carrinho..." fullScreen />;

  if (errorMsg) {
    return (
      <div className={styles.loading}>
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#22c55e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '0.5rem',
              cursor: 'pointer' 
            }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const renderModalIcon = () => {
    switch (modalConfig.type) {
      case 'success':
        return <Check size={32} strokeWidth={3} />;
      case 'error':
        return <XCircle size={32} strokeWidth={3} />;
      case 'warning':
        return <AlertTriangle size={32} strokeWidth={3} />;
      default:
        return <Info size={32} strokeWidth={3} />;
    }
  };

  const renderModalContent = () => {
    if (modalConfig.type === 'success' && modalConfig.orderNumber) {
      return (
        <p className={styles.modalText}>
          Seu pedido <span style={{ fontWeight: 'bold' }}>#{modalConfig.orderNumber}</span> foi realizado com sucesso. 
          Acompanhe o status na sua conta.
        </p>
      );
    }
    return <p className={styles.modalText}>{modalConfig.message}</p>;
  };

  return (
    <div className={styles.cartContainer}>
      <header className={styles.cartHeader}>
        <div className={styles.cartHeaderContent}>
          <div className={styles.headerLeft}>
            <button className={styles.mobileBackButton} onClick={handleBack}>
              <ChevronLeft size={24} color="#22c55e" />
              <span>Voltar</span>
            </button>
            <Link href={`/estabelecimentos/cardapio/${slug}`} className={styles.backToMenu}>
              <ArrowLeft size={16} />
              <span>Voltar para Cardápio</span>
            </Link>
          </div>
          <h1 className={styles.mobileHeaderTitle}>Meu Carrinho</h1>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>⚡</div>
            <span className={styles.logoText}>ZAPZAP DELIVERY</span>
          </div>
        </div>
      </header>

      {modalConfig.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={`${styles.modalIcon} ${styles[modalConfig.type]}`}>
              {renderModalIcon()}
            </div>
            <h2 className={styles.modalTitle}>{modalConfig.title}</h2>
            {renderModalContent()}
            <button 
              className={`${styles.modalButton} ${styles[modalConfig.type]}`} 
              onClick={() => {
                if (modalConfig.type === 'success' && modalConfig.orderNumber) {
                  // O redirecionamento já foi feito automaticamente para o checkout
                  // Não é necessário redirecionar novamente aqui
                }
                setModalConfig(prev => ({ ...prev, isOpen: false }));
              }}
            >
              {modalConfig.type === 'success' && modalConfig.orderNumber ? 'Fechar' : 'OK'}
            </button>
          </div>
        </div>
      )}

      <main className={styles.cartMain}>
        {/* Stepper */}
        <div style={{ maxWidth: '800px', margin: '0 auto 2rem', width: '100%', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            {/* Step 1 */}
            <div style={{ 
              width: '2rem', height: '2rem', borderRadius: '50%', 
              backgroundColor: currentStep >= 1 ? '#22c55e' : '#e2e8f0', 
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', zIndex: 1
            }}>{currentStep > 1 ? <Check size={16} /> : '1'}</div>
            
            <div style={{ 
              flex: 1, height: '4px', backgroundColor: currentStep >= 2 ? '#22c55e' : '#e2e8f0',
              margin: '0 0.5rem'
            }}></div>
            
            {/* Step 2 (Address) - Only for Delivery */}
            {deliveryOption === 'DELIVERY' && (
              <>
                <div style={{ 
                  width: '2rem', height: '2rem', borderRadius: '50%', 
                  backgroundColor: currentStep >= 2 ? '#22c55e' : '#e2e8f0', 
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', zIndex: 1
                }}>{currentStep > 2 ? <Check size={16} /> : '2'}</div>
                
                <div style={{ 
                  flex: 1, height: '4px', backgroundColor: currentStep >= 3 ? '#22c55e' : '#e2e8f0',
                  margin: '0 0.5rem'
                }}></div>
              </>
            )}

            {/* Final Step (Confirmation) */}
            <div style={{ 
              width: '2rem', height: '2rem', borderRadius: '50%', 
              backgroundColor: currentStep >= 3 || (deliveryOption !== 'DELIVERY' && currentStep === 3) ? '#22c55e' : '#e2e8f0', 
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', zIndex: 1
            }}>{deliveryOption === 'DELIVERY' ? '3' : '2'}</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
            <span>
              {estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' ? 'Carrinho & CEP' : 
               estabelecimento?.taxa_entrega?.tipo_taxa === 'bairro' ? 'Carrinho & Bairro' : 'Carrinho'}
            </span>
            {deliveryOption === 'DELIVERY' && <span>Endereço</span>}
            <span>Confirmação</span>
          </div>
        </div>
        {currentStep === 3 && (
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <button onClick={() => setCurrentStep(deliveryOption === 'DELIVERY' ? 2 : 1)} className={styles.linkSmall} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ChevronLeft size={16} /> Voltar
            </button>
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center' }}>Confirme seu Pedido</h2>

            <div className={styles.sideCard}>
                <h3 className={styles.sideCardTitle}><Check size={16} /> Dados do Cliente</h3>
                <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                    <p><strong>Nome:</strong> {userName}</p>
                </div>
            </div>

            <div className={styles.sideCard} style={{ marginTop: '1rem' }}>
                <h3 className={styles.sideCardTitle}><MapPin size={16} /> Endereço de Entrega</h3>
                <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                    {deliveryOption === 'DELIVERY' ? (
                        <>
                            <p style={{ fontWeight: 'bold' }}>{addressDetails.rua}, {addressDetails.numero}</p>
                            <p>{selectedNeighborhood} - {addressDetails.cidade}/{addressDetails.uf}</p>
                            {cep && <p>CEP: {cep}</p>}
                            {addressDetails.complemento && <p>Comp: {addressDetails.complemento}</p>}
                            {addressDetails.referencia && <p>Ref: {addressDetails.referencia}</p>}
                        </>
                    ) : (
                        <p style={{ fontWeight: 'bold' }}>Retirada no Local</p>
                    )}
                </div>
            </div>

            <div className={styles.sideCard} style={{ marginTop: '1rem' }}>
                <h3 className={styles.sideCardTitle}><ShoppingCart size={16} /> Itens do Pedido</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span>{item.quantidade}x {item.nome_produto}</span>
                            <span>R$ {(item.valor_base * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    ))}
                </div>
            </div>

              <div className={styles.sideCard} style={{ marginTop: '1rem' }}>
                <h3 className={styles.sideCardTitle}><CreditCard size={16} /> Forma de Pagamento</h3>
                <div className={styles.paymentGrid}>
                  <button 
                    className={`${styles.paymentOption} ${paymentMethod === 'MERCADO_PAGO' ? styles.paymentOptionActive : ''}`}
                    onClick={() => setPaymentMethod('MERCADO_PAGO')}
                  >
                    <CreditCard size={20} className={paymentMethod === 'MERCADO_PAGO' ? styles.iconActive : ''} />
                    <span>Cartão de Crédito (Online)</span>
                  </button>
                  <button 
                    className={`${styles.paymentOption} ${paymentMethod === 'PIX' ? styles.paymentOptionActive : ''}`}
                    onClick={() => setPaymentMethod('PIX')}
                  >
                    <QrCode size={20} className={paymentMethod === 'PIX' ? styles.iconActive : ''} />
                    <span>Pix (Online)</span>
                  </button>
                  <button 
                    className={`${styles.paymentOption} ${paymentMethod === 'DINHEIRO' ? styles.paymentOptionActive : ''}`}
                    onClick={() => setPaymentMethod('DINHEIRO')}
                  >
                    <Banknote size={20} className={paymentMethod === 'DINHEIRO' ? styles.iconActive : ''} />
                    <span>Dinheiro (Na Entrega)</span>
                  </button>
                  <button 
                    className={`${styles.paymentOption} ${paymentMethod === 'CARTÃO' ? styles.paymentOptionActive : ''}`}
                    onClick={() => setPaymentMethod('CARTÃO')}
                  >
                    <CreditCard size={20} className={paymentMethod === 'CARTÃO' ? styles.iconActive : ''} />
                    <span>Cartão (Na Entrega)</span>
                  </button>
                </div>
                {(paymentMethod === 'MERCADO_PAGO' || paymentMethod === 'PIX') && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    Você será redirecionado para o pagamento seguro após confirmar.
                  </div>
                )}
            </div>

            <div className={styles.summaryCard} style={{ marginTop: '1.5rem' }}>
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className={styles.summaryRow}>
                  <span>Entrega</span>
                  <span>R$ {deliveryFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className={styles.summaryRow}>
                  <span>Desconto</span>
                  <span className={styles.summaryValueGreen}>
                    - R$ {calculateDiscount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <div className={styles.totalRow}>
                <div className={styles.totalLabels}>
                  <span className={styles.totalLabel}>TOTAL FINAL</span>
                </div>
                <span className={styles.totalPriceLarge}>
                  R$ {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button 
                className={styles.btnFinalizeLarge}
                onClick={handleFinalizeOrder}
                disabled={isFinalizing}
                style={{ opacity: isFinalizing ? 0.8 : 1 }}
              >
                {isFinalizing ? (
                  <>
                    <span>PROCESSANDO...</span>
                    <Loader2 size={20} className={styles.spin} />
                  </>
                ) : (
                  <>
                    <span>{(paymentMethod === 'DINHEIRO' || paymentMethod === 'CARTÃO') ? 'FINALIZAR PEDIDO' : 'CONFIRMAR E PAGAR'}</span>
                    <Send size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
        <>
        <div className={styles.cartTitleSection}>
          <h1 className={styles.mainTitle}>Meu Carrinho</h1>
          <p className={styles.subTitle}>Você tem {totalItems} itens no seu pedido</p>
        </div>

        <div className={styles.cartContent}>
          {/* Coluna da Esquerda: Itens */}
          <div className={styles.cartLeftColumn}>
            <h2 className={styles.mobileSectionTitle}>ITENS DO PEDIDO</h2>
            {items.length === 0 ? (
              <div className={styles.emptyCart}>
                <ShoppingCart size={64} color="#e5e7eb" />
                <p>Seu carrinho está vazio</p>
                <Link href={`/estabelecimentos/cardapio/${slug}`} className={styles.btnPrimary}>
                  Ver Cardápio
                </Link>
              </div>
            ) : (
              <div className={styles.itemsList}>
                {items.map(item => (
                  <div key={item.id} className={styles.cartItemCard}>
                    <div className={styles.cartItemImage}>
                      <img src={item.imagem_produto_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop"} alt={item.nome_produto} />
                    </div>
                    <div className={styles.cartItemDetails}>
                      <div className={styles.cartItemTop}>
                        <div className={styles.cartItemInfo}>
                          <h3>{item.nome_produto}</h3>
                          <p className={styles.cartItemDescription}>{item.descricao || 'Sem descrição disponível'}</p>
                        </div>
                        <button className={styles.removeButton} onClick={() => removeItem(item.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className={styles.cartItemBottom}>
                        <span className={styles.cartItemPriceOrange}>
                          R$ {(item.valor_base * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <div className={styles.quantitySelectorDesign}>
                          <button onClick={() => updateQuantity(item.id, item.quantidade - 1)} disabled={item.quantidade <= 1} className={styles.qtyBtnMinus}>
                            <Minus size={14} />
                          </button>
                          <span className={styles.qtyValue}>{item.quantidade}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantidade + 1)} 
                            className={styles.qtyBtnPlus}
                            disabled={item.quantidade >= (stockMap[item.id] ?? 999)}
                            style={{ opacity: item.quantidade >= (stockMap[item.id] ?? 999) ? 0.5 : 1, cursor: item.quantidade >= (stockMap[item.id] ?? 999) ? 'not-allowed' : 'pointer' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile Only: Entrega e Pagamento Sections */}
            <div className={styles.mobileOnlySections}>
              <section className={styles.mobileSection}>
                <h2 className={styles.mobileSectionTitle}>FORMA DE ENTREGA</h2>
                <div className={styles.mobilePaymentList}>
                  <div 
                    className={`${styles.mobilePaymentCard} ${deliveryOption === 'RETIRADA' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setDeliveryOption('RETIRADA')}
                  >
                    <div className={styles.paymentInfo}>
                      <Store size={20} color="#22c55e" />
                      <span>Retirar no Local</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${deliveryOption === 'RETIRADA' ? styles.mobileRadioActive : ''}`}>
                      {deliveryOption === 'RETIRADA' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>

                  <div 
                    className={`${styles.mobilePaymentCard} ${deliveryOption === 'CONSUMO' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setDeliveryOption('CONSUMO')}
                  >
                    <div className={styles.paymentInfo}>
                      <Utensils size={20} color="#22c55e" />
                      <span>Consumir no Local</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${deliveryOption === 'CONSUMO' ? styles.mobileRadioActive : ''}`}>
                      {deliveryOption === 'CONSUMO' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>

                  <div 
                    className={`${styles.mobilePaymentCard} ${deliveryOption === 'DELIVERY' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setDeliveryOption('DELIVERY')}
                  >
                    <div className={styles.paymentInfo}>
                      <Bike size={20} color="#22c55e" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>Delivery (Entrega)</span>
                        {estabelecimento?.taxa_entrega?.distancia_maxima && (
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>
                            Raio máx: {estabelecimento.taxa_entrega.distancia_maxima}km
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${deliveryOption === 'DELIVERY' ? styles.mobileRadioActive : ''}`}>
                      {deliveryOption === 'DELIVERY' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.mobileSection}>
                <h2 className={styles.mobileSectionTitle}>
                  {deliveryOption === 'DELIVERY' ? 'ENTREGA E CUPONS' : 'CUPONS DE DESCONTO'}
                </h2>
                {deliveryOption === 'DELIVERY' && (
                  <div className={styles.mobileInputGroup}>
                    <div className={styles.mobileInputWrapper}>
                      <MapPin size={18} color="#94a3b8" />
                      <input 
                        type="text" 
                        placeholder="CEP (00000-000)" 
                        value={cep}
                        onChange={handleCepChange}
                        maxLength={9}
                      />
                    </div>
                    <button 
                      className={styles.mobileBtnApply} 
                      onClick={() => calculateShipping(cep)}
                      disabled={loadingCep || cep.length < 9}
                      style={{ minWidth: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                      {loadingCep ? <Loader2 className={styles.spin} size={20} /> : 'Buscar'}
                    </button>
                  </div>
                )}
                
                {/* Mobile Address Fields moved to Step 2 */}

                {deliveryOption === 'DELIVERY' && deliveryError && (
                   <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                     {deliveryError}
                   </div>
                )}
                {deliveryOption === 'DELIVERY' && distance !== null && !deliveryError && estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' && (
                   <div style={{ color: '#22c55e', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                     Distância: {distance}km
                   </div>
                )}
                {deliveryOption === 'DELIVERY' && estabelecimento?.taxa_entrega?.taxas_bairros && estabelecimento.taxa_entrega.tipo_taxa === 'bairro' && (
                  <div className={styles.mobileInputGroup}>
                    <div className={styles.mobileInputWrapper}>
                      <MapPin size={18} color="#94a3b8" />
                      <select 
                        className={styles.neighborhoodSelect}
                        value={selectedNeighborhood}
                        onChange={handleNeighborhoodChange}
                      >
                        <option value="">Selecione seu Bairro</option>
                        {estabelecimento.taxa_entrega.taxas_bairros.map((bairro, idx) => (
                          <option key={idx} value={bairro.nome_bairro}>
                            {bairro.nome_bairro} - R$ {bairro.valor_taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className={styles.mobileInputGroup}>
                  <div className={styles.mobileInputWrapper}>
                    <Ticket size={18} color="#94a3b8" />
                    <input 
                      type="text" 
                      placeholder="Cupom de Desconto" 
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={!!appliedCoupon}
                    />
                  </div>
                  {appliedCoupon ? (
                    <button className={styles.mobileBtnRemove} onClick={removeCoupon}>Remover</button>
                  ) : (
                    <button 
                      className={styles.mobileBtnApply} 
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode}
                    >
                      {validatingCoupon ? <Loader2 className={styles.spin} size={16} /> : 'Aplicar'}
                    </button>
                  )}
                </div>
                {couponError && (
                  <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                    {couponError}
                  </div>
                )}
                {appliedCoupon && (
                  <div style={{ color: '#22c55e', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                    Cupom aplicado: {appliedCoupon.codigo} (-R$ {calculateDiscount().toFixed(2)})
                  </div>
                )}
              </section>

              <section className={styles.mobileSection}>
                <h2 className={styles.mobileSectionTitle}>FORMA DE PAGAMENTO</h2>
                <div className={styles.mobilePaymentList}>
                  <div 
                    className={`${styles.mobilePaymentCard} ${paymentMethod === 'PIX' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setPaymentMethod('PIX')}
                  >
                    <div className={styles.paymentInfo}>
                      <QrCode size={20} color="#22c55e" />
                      <span>Pix (Online)</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${paymentMethod === 'PIX' ? styles.mobileRadioActive : ''}`}>
                      {paymentMethod === 'PIX' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>

                  <div 
                    className={`${styles.mobilePaymentCard} ${paymentMethod === 'DINHEIRO' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setPaymentMethod('DINHEIRO')}
                  >
                    <div className={styles.paymentInfo}>
                      <Banknote size={20} color="#22c55e" />
                      <span>Dinheiro (Na Entrega)</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${paymentMethod === 'DINHEIRO' ? styles.mobileRadioActive : ''}`}>
                      {paymentMethod === 'DINHEIRO' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>

                  <div 
                    className={`${styles.mobilePaymentCard} ${paymentMethod === 'CARTÃO' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setPaymentMethod('CARTÃO')}
                  >
                    <div className={styles.paymentInfo}>
                      <CreditCard size={20} color="#22c55e" />
                      <span>Cartão (Na Entrega)</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${paymentMethod === 'CARTÃO' ? styles.mobileRadioActive : ''}`}>
                      {paymentMethod === 'CARTÃO' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>

                  <div 
                    className={`${styles.mobilePaymentCard} ${paymentMethod === 'MERCADO_PAGO' ? styles.mobilePaymentCardActive : ''}`}
                    onClick={() => setPaymentMethod('MERCADO_PAGO')}
                  >
                    <div className={styles.paymentInfo}>
                      <CreditCard size={20} color="#22c55e" />
                      <span>Cartão de Crédito (Online)</span>
                    </div>
                    <div className={`${styles.mobileRadioCircle} ${paymentMethod === 'MERCADO_PAGO' ? styles.mobileRadioActive : ''}`}>
                      {paymentMethod === 'MERCADO_PAGO' && <div className={styles.mobileRadioInner} />}
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.mobileSummarySection}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className={styles.summaryRow}>
                  <span>Entrega</span>
                  <span style={{ fontWeight: 600 }}>
                    {deliveryOption === 'RETIRADA' ? 'Retirar no Local' : 
                     deliveryOption === 'CONSUMO' ? 'Consumir no Local' : 'Delivery'}
                  </span>
                </div>

                {deliveryOption === 'DELIVERY' && (
                  <div className={styles.summaryRow}>
                    <span>Valor da Entrega</span>
                    <span className={deliveryFee === 0 ? styles.summaryValueGreen : ''}>
                      {deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                )}

                <div className={styles.summaryRow}>
                  <span>Desconto</span>
                  <span className={styles.summaryValueGreen}>
                    - R$ {calculateDiscount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className={styles.summaryDivider}></div>
                
                <div className={styles.totalRow} style={{ marginTop: '0.5rem' }}>
                  <div className={styles.totalLabels}>
                    <span className={styles.totalLabel}>TOTAL DO PEDIDO</span>
                  </div>
                  <span className={styles.totalPriceLarge}>
                    R$ {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <button 
                  className={styles.btnFinalizeLarge} 
                  onClick={handleFinalizeOrder}
                  disabled={isFinalizing}
                  style={{ marginTop: '1.5rem', opacity: isFinalizing ? 0.8 : 1 }}
                >
                  {isFinalizing ? (
                    <>
                      <Loader2 size={20} className={styles.spin} />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span>CONTINUAR</span>
                      <Navigation size={20} />
                    </>
                  )}
                </button>
                <div style={{ textAlign: 'center', marginTop: '1rem', color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <ShieldCheck size={14} />
                  <span>PAGAMENTO SEGURO</span>
                </div>
              </section>
            </div>
          </div>

          {/* Coluna da Direita: Entrega, Pagamento e Resumo */}
          <aside className={styles.cartRightColumn}>
            {/* Forma de Entrega */}
            <div className={styles.sideCard}>
              <h3 className={styles.sideCardTitle}>
                <div className={styles.sideCardIcon}><Bike size={16} /></div>
                Forma de Entrega
              </h3>
              <div className={styles.paymentGrid}>
                <button 
                  className={`${styles.paymentOption} ${deliveryOption === 'RETIRADA' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setDeliveryOption('RETIRADA')}
                >
                  <Store size={20} className={deliveryOption === 'RETIRADA' ? styles.iconActive : ''} />
                  <span>Retirar no Local</span>
                </button>
                <button 
                  className={`${styles.paymentOption} ${deliveryOption === 'CONSUMO' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setDeliveryOption('CONSUMO')}
                >
                  <Utensils size={20} className={deliveryOption === 'CONSUMO' ? styles.iconActive : ''} />
                  <span>Consumir no Local</span>
                </button>
                <button 
                  className={`${styles.paymentOption} ${deliveryOption === 'DELIVERY' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setDeliveryOption('DELIVERY')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', height: 'auto', padding: '12px' }}
                >
                  <Bike size={20} className={deliveryOption === 'DELIVERY' ? styles.iconActive : ''} />
                  <span>Delivery</span>
                  {estabelecimento?.taxa_entrega?.distancia_maxima && (
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>
                      Max: {estabelecimento.taxa_entrega.distancia_maxima}km
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Frete e Cupom */}
            <div className={styles.sideCard}>
              {deliveryOption === 'DELIVERY' && (
                <div className={styles.sideCardSection}>
                  <h3 className={styles.sideCardTitle}>
                    <div className={styles.sideCardIcon}><MapPin size={16} /></div>
                    Calcular Entrega
                  </h3>
                  <div className={styles.inputGroup}>
                    <input 
                      type="text" 
                      placeholder="CEP (00000-000)" 
                      className={styles.textInput} 
                      value={cep}
                      onChange={handleCepChange}
                      maxLength={9}
                    />
                    <button 
                      className={styles.btnCalculate} 
                      onClick={() => calculateShipping(cep)}
                      disabled={loadingCep || cep.length < 9}
                      style={{ minWidth: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                      {loadingCep ? <Loader2 className={styles.spin} size={16} /> : 'Buscar'}
                    </button>
                  </div>

                  {deliveryOption === 'DELIVERY' && deliveryError && (
                     <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
                       {deliveryError}
                     </div>
                  )}
                  {deliveryOption === 'DELIVERY' && distance !== null && !deliveryError && estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' && (
                     <div style={{ color: '#22c55e', fontSize: '0.875rem', marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
                       Distância: {distance}km
                     </div>
                  )}
                  <button className={styles.linkSmall}>Não sei meu CEP</button>
                </div>
              )}
              
              {/* Seção de Bairro para Desktop se Taxa por Bairro */}
              {deliveryOption === 'DELIVERY' && estabelecimento?.taxa_entrega?.taxas_bairros && estabelecimento.taxa_entrega.tipo_taxa === 'bairro' && (
                  <div className={styles.sideCardSection}>
                    <h3 className={styles.sideCardTitle}>
                      <div className={styles.sideCardIcon}><MapPin size={16} /></div>
                      Selecione seu Bairro
                    </h3>
                    <div className={styles.inputGroup} style={{ marginTop: '0.5rem' }}>
                      <select 
                        className={styles.neighborhoodSelect}
                        value={selectedNeighborhood}
                        onChange={handleNeighborhoodChange}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', outline: 'none' }}
                      >
                        <option value="">Selecione seu Bairro</option>
                        {estabelecimento.taxa_entrega.taxas_bairros.map((bairro, idx) => (
                          <option key={idx} value={bairro.nome_bairro}>
                            {bairro.nome_bairro} - R$ {bairro.valor_taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
              )}

              <div className={styles.sideCardSection}>
                <h3 className={styles.sideCardTitle}>
                  <div className={styles.sideCardIcon}><Ticket size={16} /></div>
                  Cupom de Desconto
                </h3>
                <div className={styles.inputGroup}>
                  <input 
                    type="text" 
                    placeholder="Código do cupom" 
                    className={styles.textInput} 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon ? (
                    <button className={styles.btnRemove} onClick={removeCoupon}>
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button 
                      className={styles.btnApply} 
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode}
                    >
                      {validatingCoupon ? <Loader2 className={styles.spin} size={16} /> : 'Aplicar'}
                    </button>
                  )}
                </div>
                {couponError && <p className={styles.errorText}>{couponError}</p>}
                {appliedCoupon && (
                   <p className={styles.successText}>
                     Desconto de R$ {calculateDiscount().toFixed(2)} aplicado!
                   </p>
                )}
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className={styles.sideCard}>
              <h3 className={styles.sideCardTitle}>
                <div className={styles.sideCardIcon}><CreditCard size={16} /></div>
                Forma de Pagamento
              </h3>
              <div className={styles.paymentGrid}>
                <button 
                  className={`${styles.paymentOption} ${paymentMethod === 'PIX' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('PIX')}
                >
                  <QrCode size={20} className={paymentMethod === 'PIX' ? styles.iconActive : ''} />
                  <span>PIX (Online)</span>
                </button>
                <button 
                  className={`${styles.paymentOption} ${paymentMethod === 'DINHEIRO' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('DINHEIRO')}
                >
                  <Banknote size={20} className={paymentMethod === 'DINHEIRO' ? styles.iconActive : ''} />
                  <span>DINHEIRO (Na Entrega)</span>
                </button>
                <button 
                  className={`${styles.paymentOption} ${paymentMethod === 'CARTÃO' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('CARTÃO')}
                >
                  <CreditCard size={20} className={paymentMethod === 'CARTÃO' ? styles.iconActive : ''} />
                  <span>Cartão (Na Entrega)</span>
                </button>
                <button 
                  className={`${styles.paymentOption} ${paymentMethod === 'MERCADO_PAGO' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('MERCADO_PAGO')}
                >
                  <CreditCard size={20} className={paymentMethod === 'MERCADO_PAGO' ? styles.iconActive : ''} />
                  <span>Cartão de Crédito (Online)</span>
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className={styles.summaryRow}>
                  <span>Entrega</span>
                  <span style={{ fontWeight: 600 }}>
                    {deliveryOption === 'RETIRADA' ? 'Retirar no Local' : 
                     deliveryOption === 'CONSUMO' ? 'Consumir no Local' : 'Delivery'}
                  </span>
                </div>

                {deliveryOption === 'DELIVERY' && (
                  <div className={styles.summaryRow}>
                    <span>Valor da Entrega</span>
                    <span className={deliveryFee === 0 ? styles.summaryValueGreen : ''}>
                      {deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                )}

                <div className={styles.summaryRow}>
                  <span>Desconto</span>
                  <span className={styles.summaryValueGreen}>
                    - R$ {calculateDiscount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <div className={styles.totalRow}>
                <div className={styles.totalLabels}>
                  <span className={styles.totalLabel}>TOTAL DO PEDIDO</span>
                </div>
                <span className={styles.totalPriceLarge}>
                  R$ {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button 
                className={styles.btnFinalizeLarge} 
                onClick={handleFinalizeOrder}
                disabled={isFinalizing}
                style={{ opacity: isFinalizing ? 0.8 : 1 }}
              >
                {isFinalizing ? (
                  <>
                    <span>PROCESSANDO...</span>
                    <Loader2 size={20} className={styles.spin} />
                  </>
                ) : (
                  (deliveryOption !== 'DELIVERY' && (paymentMethod === 'DINHEIRO' || paymentMethod === 'CARTÃO')) ? (
                    <>
                      <span>FINALIZAR PEDIDO</span>
                      <Send size={20} />
                    </>
                  ) : (
                    <>
                      <span>CONTINUAR</span>
                      <Navigation size={20} />
                    </>
                  )
                )}
              </button>

              <div className={styles.securePayment}>
                <ShieldCheck size={16} />
                <span>PAGAMENTO SEGURO</span>
              </div>
            </div>
          </aside>
        </div>
      </>
      )}
      </main>

      {currentStep === 2 && (
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '0 1rem' }}>
        <button onClick={() => setCurrentStep(1)} className={styles.linkSmall} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ChevronLeft size={16} /> Voltar para o Carrinho
        </button>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center' }}>Endereço de Entrega</h2>
        
        <div className={styles.sideCard}>
          <div style={{ padding: '1rem' }}>
            <div className={styles.inputGroup} style={{ flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>CEP</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="00000-000" 
                  className={styles.textInput}
                  value={cep}
                  onChange={handleCepChange}
                  maxLength={9}
                  style={{ width: '100%', padding: '12px', paddingRight: '40px', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                {loadingCep && (
                  <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
                    <Loader2 className={styles.spin} size={20} color="#666" />
                  </div>
                )}
              </div>
              {deliveryError && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 600 }}>
                  {deliveryError}
                </div>
              )}
              {deliveryOption === 'DELIVERY' && distance !== null && !deliveryError && estabelecimento?.taxa_entrega?.tipo_taxa === 'distancia' && (
                 <div style={{ color: '#166534', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 600 }}>
                   Distância: {distance} km
                 </div>
              )}
            </div>

            <div className={styles.inputGroup} style={{ flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Rua / Logradouro</label>
              <input 
                type="text" 
                placeholder="Ex: Av. Paulista" 
                className={styles.textInput}
                value={addressDetails.rua}
                onChange={(e) => setAddressDetails({...addressDetails, rua: e.target.value})}
                style={{ width: '100%', padding: '12px', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Número</label>
                <input 
                  type="text" 
                  placeholder="123" 
                  className={styles.textInput}
                  value={addressDetails.numero}
                  onChange={(e) => setAddressDetails({...addressDetails, numero: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Complemento</label>
                <input 
                  type="text" 
                  placeholder="Apto 101" 
                  className={styles.textInput}
                  value={addressDetails.complemento}
                  onChange={(e) => setAddressDetails({...addressDetails, complemento: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div className={styles.inputGroup} style={{ flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Bairro</label>
              {estabelecimento?.taxa_entrega?.tipo_taxa === 'bairro' ? (
                <select 
                  className={styles.neighborhoodSelect}
                  value={selectedNeighborhood}
                  onChange={handleNeighborhoodChange}
                  style={{ width: '100%', padding: '12px', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">Selecione seu Bairro</option>
                  {estabelecimento.taxa_entrega.taxas_bairros?.map((bairro, idx) => (
                    <option key={idx} value={bairro.nome_bairro}>
                      {bairro.nome_bairro} - R$ {bairro.valor_taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder="Bairro" 
                  className={styles.textInput}
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  style={{ width: '100%', padding: '12px', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
               <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Cidade</label>
                <input 
                  type="text" 
                  placeholder="Cidade" 
                  className={styles.textInput}
                  value={addressDetails.cidade}
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                />
               </div>
               <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>UF</label>
                <input 
                  type="text" 
                  placeholder="UF" 
                  className={styles.textInput}
                  value={addressDetails.uf}
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                />
               </div>
            </div>

            <div className={styles.inputGroup} style={{ flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Ponto de Referência</label>
              <input 
                type="text" 
                placeholder="Próximo ao mercado..." 
                className={styles.textInput}
                value={addressDetails.referencia}
                onChange={(e) => setAddressDetails({...addressDetails, referencia: e.target.value})}
                style={{ width: '100%', padding: '12px', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
            </div>

          </div>
        </div>

        <button 
          className={styles.btnFinalizeLarge} 
          onClick={handleFinalizeOrder}
          disabled={isFinalizing}
          style={{ marginTop: '2rem', opacity: isFinalizing ? 0.8 : 1 }}
        >
          {isFinalizing ? (
            <>
              <Loader2 size={20} className={styles.spin} />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <span>CONTINUAR</span>
              <Navigation size={20} />
            </>
          )}
        </button>
      </div>
      )}

      {currentStep === 1 && (
        <div style={{ height: '2rem' }}></div>
      )}

    </div>
  );
}
