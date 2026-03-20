"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { useNotification } from '@/context/NotificationContext';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Minus, 
  ShoppingBasket, 
  User, 
  Ticket, 
  Banknote, 
  QrCode, 
  CreditCard,
  Send,
  ShoppingBag,
  ChevronDown,
  MapPin,
  MessageSquare,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { NewCustomerModal } from '@/components/Modal/NewCustomerModal';
import styles from './novo-pedido.module.css';

// Types
interface Product {
  id: string;
  nome_produto: string;
  valor_base: number;
  categoria_id: string;
  imagem_produto_url: string;
  descricao?: string;
}

interface Customer {
  id: string;
  nome_cliente: string;
  telefone: string;
}

interface Address {
  id: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  complemento?: string;
}

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  tamanho_selecionado?: string;
}

interface Category {
  id: string;
  nome_categoria: string;
}

export default function NovoPedido() {
  const router = useRouter();
  const toast = useToast();
  const { playNotificationSound } = useNotification();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // UI State
  const [activeCategory, setActiveCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [deliveryMethod, setDeliveryMethod] = useState('retirar');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [orderObservation, setOrderObservation] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Sizes state
  const [productSizes, setProductSizes] = useState<any[]>([]);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [productToSelectSize, setProductToSelectSize] = useState<Product | null>(null);
  const [productToSelectSizeOptions, setProductToSelectSizeOptions] = useState<any[]>([]);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Get establishment ID
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('estabelecimento_id')
          .eq('id', user.id)
          .single();

        if (userError || !userData?.estabelecimento_id) {
          toast.error('Erro ao identificar estabelecimento');
          return;
        }

        const estabId = userData.estabelecimento_id;
        setEstablishmentId(estabId);

        // Fetch Data in parallel
        const [{ data: sessionData }] = await Promise.all([supabase.auth.getSession()]);
        const token = sessionData?.session?.access_token;

        const [prodRes, custRes, catResp] = await Promise.all([
          supabase.from('produtos').select('*').eq('estabelecimento_id', estabId).eq('status_produto', 'ativo'),
          supabase.from('clientes').select('*').eq('estabelecimento_id', estabId).eq('status_cliente', 'ativo'),
          fetch('/api/categorias', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        ]);

        if (prodRes.data) {
            setProducts(prodRes.data);
            const prodIds = prodRes.data.map(p => p.id);
            if (prodIds.length > 0) {
               const { data: fetchSizes, error: tamErr } = await supabase.from('produtos_tamanhos').select('*').in('produto_id', prodIds);
               if (!tamErr && fetchSizes) {
                   setProductSizes(fetchSizes);
               }
            }
        }
        if (custRes.data) setCustomers(custRes.data);
        if (catResp.ok) {
          const catData = await catResp.json();
          setCategories(Array.isArray(catData) ? catData : []);
        } else {
          console.error('Erro ao carregar categorias:', await catResp.text());
          setCategories([]);
        }

      } catch (error) {
        console.error('Error initializing:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesCategory = activeCategory === 'todos' || product.categoria_id === activeCategory;
    const matchesSearch = product.nome_produto.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredCustomers = customers.filter(customer => 
    customer.nome_cliente.toLowerCase().includes(customerSearch.toLowerCase()) || 
    customer.telefone.includes(customerSearch)
  );

  const subtotal = cart.reduce((acc, item) => acc + (item.valor_base * item.quantity), 0);
  const deliveryFee = deliveryMethod === 'delivery' ? 5.00 : 0; // Taxa fixa de exemplo
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  const handleAddToCart = (product: Product) => {
    const pSizes = productSizes.filter(s => s.produto_id === product.id).sort((a,b) => a.ordem - b.ordem);
    if (pSizes.length > 0) {
        setProductToSelectSize(product);
        setProductToSelectSizeOptions(pSizes);
        setIsSizeModalOpen(true);
        return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.cartItemId === product.id);
      if (existing) {
        return prev.map(item => item.cartItemId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, cartItemId: product.id, quantity: 1 }];
    });
    toast.success('Produto adicionado');
  };

  const confirmSizeSelection = (size: any) => {
      if (!productToSelectSize) return;
      setCart(prev => {
          const itemKey = `${productToSelectSize.id}-${size.id}`;
          const existing = prev.find(item => item.cartItemId === itemKey);
          if (existing) {
             return prev.map(item => item.cartItemId === itemKey ? { ...item, quantity: item.quantity + 1 } : item);
          }
          return [...prev, { 
              ...productToSelectSize, 
              cartItemId: itemKey, 
              quantity: 1, 
              valor_base: size.preco, 
              tamanho_selecionado: size.nome_tamanho 
          }];
      });
      setIsSizeModalOpen(false);
      setProductToSelectSize(null);
      toast.success('Pizza adicionada!');
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const refreshCustomers = async () => {
    if (!establishmentId) return;
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('estabelecimento_id', establishmentId)
        .eq('status_cliente', 'ativo');
        
      if (data) {
        setCustomers(data);
        toast.success('Lista de clientes atualizada');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar clientes');
    }
  };

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDropdownOpen(false);
    setCustomerSearch('');
    
    // Fetch addresses
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fallback to direct query if no session (shouldn't happen on this page)
      if (!session) {
         const { data, error } = await supabase
          .from('enderecos_clientes')
          .select('*')
          .eq('cliente_id', customer.id);
          
          if (error) throw error;
          
          setCustomerAddresses(data || []);
          if (data && data.length > 0) {
            setSelectedAddressId(data[0].id);
            toast.success('Endereços carregados');
          } else {
            setSelectedAddressId(null);
            toast.info('Cliente sem endereços');
          }
          return;
      }

      const response = await fetch(`/api/clientes/${customer.id}/enderecos`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: Falha ao carregar endereços`);
      }

      const data = await response.json();
      
      setCustomerAddresses(data || []);
      if (data && data.length > 0) {
        setSelectedAddressId(data[0].id);
        toast.success('Endereços carregados');
      } else {
        setSelectedAddressId(null);
        toast.info('Cliente sem endereços');
      }
    } catch (err: any) {
      console.error('Error fetching addresses:', err);
      toast.error(err.message || 'Erro ao buscar endereços do cliente');
      setCustomerAddresses([]);
      setSelectedAddressId(null);
    }
  };

  const handleNewCustomerSuccess = (newCustomer: any) => {
    // Add to list
    setCustomers(prev => [...prev, newCustomer]);
    
    // Select automatically
    handleSelectCustomer(newCustomer);
    
    // Close modal
    setIsNewCustomerModalOpen(false);
  };

  // Número do pedido agora é gerado no servidor

  const handleFinalizeOrder = async () => {
    if (!establishmentId) {
        toast.error('Estabelecimento não identificado');
        return;
    }
    if (cart.length === 0) {
      toast.error('O carrinho está vazio');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Selecione um cliente');
      return;
    }

    if (deliveryMethod === 'delivery' && !selectedAddressId) {
        toast.error('Selecione um endereço para entrega');
        return;
    }

    try {
      setLoading(true);
      const deliveryMap: Record<string, string> = {
        'retirar': 'retirada',
        'delivery': 'delivery',
        'consumir': 'consumo'
      };
      const mappedDelivery = deliveryMap[deliveryMethod] || 'retirada';
      
      const paymentMap: Record<string, string> = {
        'pix': 'pix',
        'dinheiro': 'dinheiro',
        'cartao': 'cartao'
      };
      const mappedPayment = paymentMap[paymentMethod] || 'pix';

      let finalObservation = orderObservation || '';
      if (mappedDelivery === 'delivery' && selectedAddressId) {
          const addr = customerAddresses.find(a => a.id === selectedAddressId);
          if (addr) {
              const addressString = `Endereço de Entrega: ${addr.endereco}, ${addr.numero} - ${addr.bairro}, ${addr.cidade}/${addr.uf} - CEP: ${addr.cep} ${addr.complemento ? `(${addr.complemento})` : ''}`;
              finalObservation = finalObservation ? `${finalObservation} | ${addressString}` : addressString;
          }
      }

      // Criação via API (server-side) para contornar RLS e garantir atomicidade
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada');

      const payload = {
        estabelecimento_id: establishmentId,
        cliente_id: selectedCustomer.id,
        forma_pagamento: mappedPayment,
        forma_entrega: mappedDelivery,
        observacao_cliente: finalObservation,
        subtotal,
        taxa_entrega: deliveryFee,
        desconto: discount,
        total,
        items: cart.map(item => ({
          produto_id: item.id,
          quantidade: item.quantity,
          valor_unitario: item.valor_base,
          observacao: item.tamanho_selecionado ? `Tamanho: ${item.tamanho_selecionado}` : null
        }))
      };

      const resp = await fetch('/api/pedidos/novo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${resp.status}`);
      }

      playNotificationSound(1);
      toast.success('Pedido realizado com sucesso!');
      router.push('/pedidos');

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Erro desconhecido ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !products.length) {
    return <div className={styles.loading}>Carregando...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Catalog Section */}
      <div className={styles.catalogSection}>
        <div className={styles.catalogHeader}>
          <button className={styles.backButton} onClick={() => router.push('/pedidos')}>
            <ArrowLeft size={20} />
            Voltar para Dashboard
          </button>
          
          <div className={styles.searchWrapper}>
            <Search size={20} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar produtos pelo nome..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.categoriesList}>
          <button
            className={`${styles.categoryBtn} ${activeCategory === 'todos' ? styles.categoryBtnActive : ''}`}
            onClick={() => setActiveCategory('todos')}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`${styles.categoryBtn} ${activeCategory === cat.id ? styles.categoryBtnActive : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.nome_categoria}
            </button>
          ))}
        </div>

        <div className={styles.productsGrid}>
          {filteredProducts.map(product => {
            const prodSiz = productSizes.filter(s => s.produto_id === product.id);
            let displayPrice = `R$ ${product.valor_base.toFixed(2).replace('.', ',')}`;
            if (prodSiz.length > 0) {
               const minP = Math.min(...prodSiz.map(s => s.preco));
               displayPrice = `A partir de R$ ${minP.toFixed(2).replace('.', ',')}`;
            }

            return (
              <div key={product.id} className={styles.productCard} onClick={() => handleAddToCart(product)}>
                <div className={styles.productThumb}>
                  <img src={product.imagem_produto_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop'} alt={product.nome_produto} className={styles.productThumbImg} />
                </div>
                <div className={styles.productInfo}>
                  <span className={styles.productName}>{product.nome_produto}</span>
                  <span className={styles.productPrice}>{displayPrice}</span>
                </div>
                <button className={styles.addButton}>
                  <Plus size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.selectedSection}>
        <div className={styles.selectedHeader}>
          <ShoppingBasket className={styles.selectedIcon} size={24} />
          <h2>Produtos Selecionados</h2>
        </div>
        <div className={styles.cartList}>
          {cart.length === 0 ? (
            <div className={styles.emptySelected}>Nenhum produto selecionado</div>
          ) : (
            cart.map(item => (
              <div key={item.cartItemId} className={styles.cartItem}>
                <img src={item.imagem_produto_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop'} alt={item.nome_produto} className={styles.cartItemImage} />
                <div className={styles.cartItemInfo}>
                  <p className={styles.cartItemName}>
                    {item.nome_produto}
                    {item.tamanho_selecionado && <span style={{display:'block', fontSize:'0.75rem', color:'#6b7280', marginTop:'2px'}}>(Tamanho: {item.tamanho_selecionado})</span>}
                  </p>
                  <p className={styles.cartItemPrice}>R$ {item.valor_base.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className={styles.quantitySelector}>
                  <button className={styles.qtyBtn} onClick={() => updateQuantity(item.cartItemId, -1)}>
                    <Minus size={16} />
                  </button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} onClick={() => updateQuantity(item.cartItemId, 1)}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className={styles.summarySection}>
        <div className={styles.summaryHeader}>
          <ShoppingBag className={styles.summaryIcon} size={24} />
          <h2>Resumo do Pedido</h2>
        </div>

        <div className={styles.customerSection} ref={dropdownRef}>
          <button 
            className={styles.customerBadge}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className={styles.customerIcon}>
              <User size={20} />
            </div>
            <div className={styles.customerInfo}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', margin: 0 }}>Cliente Selecionado</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#064e3b', margin: 0 }}>
                {selectedCustomer ? `${selectedCustomer.nome_cliente} ${selectedCustomer.telefone}` : 'Selecione um cliente'}
              </p>
            </div>
            <ChevronDown size={20} color="#059669" />
          </button>

          {isDropdownOpen && (
            <div className={styles.dropdownContainer}>
              <div className={styles.dropdownActions}>
                <button 
                  className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                  onClick={() => {
                    setIsNewCustomerModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                >
                  <UserPlus size={16} />
                  Novo Cliente
                </button>
                <button 
                  className={styles.actionButton}
                  onClick={refreshCustomers}
                >
                  <RefreshCw size={16} />
                  Atualizar
                </button>
              </div>
              <div className={styles.dropdownSearch}>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Filtrar por nome ou telefone..." 
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className={styles.customerList}>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => (
                    <button 
                      key={customer.id} 
                      className={styles.customerOption}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <span className={styles.optionName}>{customer.nome_cliente}</span>
                      <span className={styles.optionPhone}>{customer.telefone}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.noResults}>Nenhum cliente encontrado</div>
                )}
              </div>
            </div>
          )}
        </div>

        

        <div className={styles.financialSection}>
          <div className={styles.couponInput}>
            <Ticket size={20} color="#94a3b8" />
            <input type="text" placeholder="Código do Cupom" />
          </div>

          <div className={styles.deliverySection}>
            <span className={styles.deliveryLabel}>Forma de Entrega</span>
            <div className={styles.deliveryDropdownWrapper}>
              <select 
                className={styles.deliverySelect}
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              >
                <option value="retirar">Retirar no local</option>
                <option value="consumir">Consumir no local</option>
                <option value="delivery">Delivery</option>
              </select>
              <ChevronDown size={20} className={styles.deliveryIconRight} />
            </div>
          </div>

          {deliveryMethod === 'delivery' && (
            <div className={styles.deliverySection}>
              <span className={styles.deliveryLabel}>Endereço de Entrega</span>
              {customerAddresses.length > 0 ? (
                <div className={styles.deliveryDropdownWrapper}>
                  <MapPin size={20} className={styles.deliveryIconLeft} style={{left: '10px', position: 'absolute', zIndex: 1, color: '#64748b'}} />
                  <select 
                    className={styles.deliverySelect}
                    style={{paddingLeft: '35px'}}
                    value={selectedAddressId || ''}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                  >
                    {customerAddresses.map(addr => (
                      <option key={addr.id} value={addr.id}>
                        {addr.endereco}, {addr.numero} - {addr.bairro}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={20} className={styles.deliveryIconRight} />
                </div>
              ) : (
                <div className={styles.noAddressWarning}>
                   Cliente sem endereço cadastrado.
                </div>
              )}
            </div>
          )}

          <div className={styles.deliverySection}>
            <span className={styles.deliveryLabel}>Observações</span>
            <div className={styles.couponInput}>
              <MessageSquare size={20} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Observações do pedido (opcional)" 
                value={orderObservation}
                onChange={(e) => setOrderObservation(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
          </div>
          {deliveryFee > 0 && (
            <div className={styles.summaryRow}>
              <span>Taxa de Entrega</span>
              <span>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div className={styles.summaryRow}>
            <span>Desconto</span>
            <span className={styles.discountValue}>- R$ {discount.toFixed(2).replace('.', ',')}</span>
          </div>

          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalValue}>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>

          <div className={styles.paymentMethods}>
            <button 
              className={`${styles.paymentBtn} ${paymentMethod === 'dinheiro' ? styles.paymentBtnActive : ''}`}
              onClick={() => setPaymentMethod('dinheiro')}
            >
              <Banknote className={styles.paymentIcon} size={24} />
              <span>Dinheiro</span>
            </button>
            <button 
              className={`${styles.paymentBtn} ${paymentMethod === 'pix' ? styles.paymentBtnActive : ''}`}
              onClick={() => setPaymentMethod('pix')}
            >
              <QrCode className={styles.paymentIcon} size={24} />
              <span>PIX</span>
            </button>
            <button 
              className={`${styles.paymentBtn} ${paymentMethod === 'cartao' ? styles.paymentBtnActive : ''}`}
              onClick={() => setPaymentMethod('cartao')}
            >
              <CreditCard className={styles.paymentIcon} size={24} />
              <span>Cartão</span>
            </button>
          </div>

          <button 
            className={styles.checkoutBtn} 
            onClick={handleFinalizeOrder} 
            disabled={loading}
          >
            {loading ? 'PROCESSANDO...' : 'FINALIZAR PEDIDO'} <Send size={20} />
          </button>

          <button className={styles.clearCartBtn} onClick={() => setCart([])}>
            Limpar Carrinho
          </button>
        </div>
      </div>
      <NewCustomerModal 
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSuccess={handleNewCustomerSuccess}
        establishmentId={establishmentId || ''}
      />

      {isSizeModalOpen && productToSelectSize && (
        <div className={styles.sizeModalOverlay}>
          <div className={styles.sizeModalContent}>
            <div className={styles.sizeModalHeader}>
                <h3 className={styles.sizeModalTitle}>Escolha o Tamanho</h3>
                <button type="button" onClick={() => setIsSizeModalOpen(false)} className={styles.closeBtn}>×</button>
            </div>
            <p className={styles.sizeModalSubtitle}>{productToSelectSize.nome_produto}</p>
            
            <div className={styles.sizeOptionsGrid}>
              {productToSelectSizeOptions.map(sz => (
                <button 
                    key={sz.id} 
                    className={styles.sizeOptionBtn}
                    onClick={() => confirmSizeSelection(sz)}
                >
                  <span className={styles.sizeOptionName}>{sz.nome_tamanho}</span>
                  <span className={styles.sizeOptionPrice}>R$ {sz.preco.toFixed(2).replace('.', ',')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
