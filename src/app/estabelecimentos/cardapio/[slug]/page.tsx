"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Plus,
  Star, 
  Instagram, 
  Facebook, 
  Twitter,
  ChevronRight,
  MessageSquare,
  X,
  Minus,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Calculator,
  Ticket,
  CreditCard,
  Banknote,
  ShieldCheck,
  Send,
  Check
} from 'lucide-react';
import styles from './cardapio.module.css';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/Toast/ToastProvider';
import Link from 'next/link';

// Types
interface Categoria {
  id: string;
  nome_categoria: string;
  descricao?: string;
}

interface Produto {
  id: string;
  categoria_id: string;
  nome_produto: string;
  descricao?: string;
  valor_base: number;
  imagem_produto_url?: string;
  permite_observacao?: boolean;
  estoque_atual?: number;
}

interface Estabelecimento {
  id: string;
  nome_estabelecimento: string;
  imagem_estabelecimento_url?: string;
  telefone?: string;
  whatsappMain?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export default function CardapioPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { items, addItem, totalItems, removeItem, updateQuantity, totalPrice } = useCart();
  const { success } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [observation, setObservation] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const testimonials = [
    {
      id: 1,
      name: 'Mariana Souza',
      rating: 5,
      text: '"A entrega foi super rápida e a comida chegou quentinha! Amei a coxinha gourmet."',
      avatar: 'https://i.pravatar.cc/150?u=mariana'
    },
    {
      id: 2,
      name: 'João Mendes',
      rating: 5,
      text: '"O atendimento pelo Zap é super intuitivo e prático. Nota 10!"',
      avatar: 'https://i.pravatar.cc/150?u=joao'
    },
    {
      id: 3,
      name: 'Ricardo Costa',
      rating: 5,
      text: '"Experiência premium do começo ao fim. A embalagem é de ótima qualidade."',
      avatar: 'https://i.pravatar.cc/150?u=ricardo'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  useEffect(() => {
    const handleScroll = () => {
      const categorySections = categorias.map(cat => ({
        id: cat.id,
        offset: document.getElementById(cat.id)?.offsetTop || 0
      }));

      const scrollPosition = window.scrollY + 160; // Compensação do header

      for (let i = categorySections.length - 1; i >= 0; i--) {
        if (scrollPosition >= categorySections[i].offset) {
          setActiveCategory(categorySections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categorias]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    const term = value.trim().toLowerCase();
    if (term.length >= 2) {
      const matches = produtos.filter((p) =>
        p.nome_produto.toLowerCase().includes(term)
      );
      setSearchResults(matches.slice(0, 15));
      setShowSearchResults(matches.length > 0);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchBlur = () => {
    setTimeout(() => {
      setShowSearchResults(false);
    }, 150);
  };

  const handleSelectFromSearch = (product: Produto) => {
    setShowSearchResults(false);
    setSearchTerm(product.nome_produto);
    const element = document.getElementById(`product-${product.id}`);
    if (element) {
      const headerOffset = 160;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    } else {
      openProductModal(product);
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(categoryId);
    if (element) {
      const headerOffset = 140; // Altura do header fixo + margem
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    async function fetchCardapioData() {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);

        // 1. Buscar dados públicos do cardápio via API (server, sem RLS)
        const dadosRes = await fetch(`/api/estabelecimentos/cardapio/${slug}/dados`, { cache: 'no-store' });
        const dados = await dadosRes.json().catch(() => ({}));
        if (!dadosRes.ok) {
          throw new Error(dados?.error || 'Falha ao carregar dados do cardápio');
        }
        setEstabelecimento(dados.estabelecimento);
        setCategorias(dados.categorias || []);
        if (Array.isArray(dados.categorias) && dados.categorias.length > 0) {
          setActiveCategory(dados.categorias[0].id);
        }

        // Assim que os dados básicos chegam, já liberamos a tela
        setLoading(false);

        // 3. Buscar produtos do cardápio filtrados por estoque via API
        const res = await fetch(`/api/estabelecimentos/cardapio/${slug}/produtos`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Falha ao carregar produtos do cardápio');
        }
        const prods = await res.json();
        setProdutos(prods || []);

      } catch (err: any) {
        console.error('Erro ao carregar cardápio:', err);
        setError('Ocorreu um erro ao carregar os dados do cardápio.');
      }
    }

    fetchCardapioData();
  }, [slug]);

  useEffect(() => {
    if (!estabelecimento) return;
    try {
      const channel = supabase
        .channel('realtime-cardapio-estoque')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'estoque_produtos', filter: `estabelecimento_id=eq.${estabelecimento.id}` },
          async () => {
            const res = await fetch(`/api/estabelecimentos/cardapio/${slug}/produtos`);
            if (res.ok) {
              const prods = await res.json();
              setProdutos(prods || []);
            }
          }
        )
        .subscribe();
    } catch {
      // Fallback: polling leve
      const interval = setInterval(async () => {
        const res = await fetch(`/api/estabelecimentos/cardapio/${slug}/produtos`);
        if (res.ok) {
          const prods = await res.json();
          setProdutos(prods || []);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [estabelecimento, slug]);

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedProduct]);

  if (loading) return <div className={styles.loading}>Carregando cardápio...</div>;

  if (error || !estabelecimento) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} color="#ef4444" />
        <h1>Ops!</h1>
        <p>{error || 'Estabelecimento não encontrado.'}</p>
        <button onClick={() => window.location.reload()} className={styles.btnPrimary}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isSearching = normalizedSearch.length >= 2;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSubscribeModal(true);
  };

  const openProductModal = (product: Produto) => {
    const gruposProduto = (product as any).grupos_adicionais || [];
    const initialSelection: Record<string, string[]> = {};

    gruposProduto.forEach((grupo: any) => {
      const isUnico = String(grupo.tipo_selecao) === 'unico';
      const max = Number(grupo.max_opcoes_resolvido) || (isUnico ? 1 : 0);
      const freeIds = (grupo.adicionais || [])
        .filter((a: any) => Number(a.preco) === 0)
        .map((a: any) => String(a.id));

      if (freeIds.length > 0) {
        if (isUnico) {
          initialSelection[grupo.grupo_id] = [freeIds[0]];
        } else {
          initialSelection[grupo.grupo_id] =
            max > 0 ? freeIds.slice(0, max) : freeIds;
        }
      }
    });

    setSelectedProduct(product);
    setQuantity(1);
    setSelectedByGroup(initialSelection);
    setObservation('');
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setObservation('');
  };

  const handleAddToCart = (product: Produto, qty: number = 1) => {
    const grupoList = (product as any).grupos_adicionais || [];
    for (const g of grupoList as any[]) {
      if (g.obrigatorio) {
        const current = selectedByGroup[g.grupo_id] || [];
        const min = Math.max(1, Number(g.min_opcoes) || 0);
        if (current.length < min) {
          success(`Selecione pelo menos ${min} opção(ões) em "${g.nome}"`, 2500);
          return;
        }
      }
    }

    let extraTotal = 0;
    const addIndex = new Map<string, number>();
    const addNames = new Map<string, string>();
    grupoList.forEach((g: any) => {
      (g.adicionais || []).forEach((a: any) => {
        const aid = String(a.id);
        addIndex.set(aid, Number(a.preco) || 0);
        addNames.set(aid, String(a.nome || 'Adicional'));
      });
    });
    const counts = new Map<string, number>();
    Object.values(selectedByGroup).forEach((ids) => {
      ids.forEach((id) => {
        const sid = String(id);
        extraTotal += addIndex.get(sid) || 0;
        counts.set(sid, (counts.get(sid) || 0) + 1);
      });
    });
    const unitPrice = Number(product.valor_base) + extraTotal;
    let descricaoCart = product.descricao || '';
    if (counts.size > 0) {
      const extrasList = Array.from(counts.entries())
        .map(([id, qtd]) => {
          const nome = addNames.get(id) || 'Adicional';
          return qtd > 1 ? `${qtd}x ${nome}` : nome;
        })
        .join(', ');
      const extrasText = `Adicionais: ${extrasList}`;
      descricaoCart = descricaoCart
        ? `${descricaoCart} | ${extrasText}`
        : extrasText;
    }
    const trimmedObservation = observation.trim();
    if (trimmedObservation) {
      const obsText = `Obs: ${trimmedObservation}`;
      descricaoCart = descricaoCart ? `${descricaoCart} | ${obsText}` : obsText;
    }
    addItem({
      id: product.id,
      nome_produto: product.nome_produto,
      valor_base: unitPrice,
      imagem_produto_url: product.imagem_produto_url,
      quantidade: qty,
      descricao: descricaoCart
    });
    success(`${qty}x ${product.nome_produto} adicionado ao carrinho!`, 2000);
    if (selectedProduct) closeProductModal();
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><MessageSquare size={24} fill="#22c55e" color="#22c55e" /></div>
            <span className={styles.logoText}>ZAPZAP<span className={styles.logoTextGreen}>DELIVERY</span></span>
          </div>
          
          <div className={styles.searchBar}>
            <Search size={20} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="O que você quer comer hoje?"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              onBlur={handleSearchBlur}
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={styles.searchResultItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectFromSearch(product);
                    }}
                  >
                    {product.nome_produto}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.headerActions}>
            <div 
              className={`${styles.cartIcon} ${totalItems > 0 ? styles.cartPulse : ''}`} 
              onClick={() => {
                if (isMobile) {
                  router.push(`/estabelecimentos/cardapio/${slug}/carrinho`);
                } else {
                  setShowCart(true);
                }
              }} 
              style={{ cursor: 'pointer' }}
            >
              <ShoppingCart size={24} />
              {totalItems > 0 && <span className={styles.cartBadge}>{totalItems}</span>}
            </div>
            <button 
              className={styles.accountButton}
              onClick={() => router.push('/minhaconta')}
            >
              <User size={20} />
              <span>Minha Conta</span>
            </button>
          </div>
        </div>

        {/* Categories Nav */}
        <nav className={styles.categoriesNav}>
          {categorias.map(cat => (
            <button 
              key={cat.id} 
              className={`${styles.navItem} ${activeCategory === cat.id ? styles.activeNav : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              {cat.nome_categoria}
            </button>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        {/* Hero Section */}
        {/* <section className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.heroBadge}>{estabelecimento.nome_estabelecimento.toUpperCase()}</span>
            <h1>O sabor que você ama, entregue <span className={styles.italicGreen}>num Zap.</span></h1>
            <p>
              {estabelecimento.endereco ? `${estabelecimento.endereco}, ${estabelecimento.cidade} - ${estabelecimento.uf}` : 'Peça agora e receba em minutos com a entrega mais rápida e segura da cidade.'}
            </p>
            <div className={styles.heroButtons}>
              <button className={styles.btnPrimary}>Ver Cardápio</button>
              <button className={styles.btnSecondary}>Informações</button>
            </div>
          </div>
          <div className={styles.heroImage}>
            <img 
              src={estabelecimento.imagem_estabelecimento_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop"} 
              alt={estabelecimento.nome_estabelecimento} 
            />
          </div>
        </section> */}

        {/* Products Sections */}
        {categorias.map(categoria => {
          const categoryProducts = produtos.filter(p => {
            if (p.categoria_id !== categoria.id) return false;
            if (!isSearching) return true;
            return p.nome_produto.toLowerCase().includes(normalizedSearch);
          });
          if (categoryProducts.length === 0) return null;

          return (
            <section key={categoria.id} className={styles.section} id={categoria.id}>
              <div className={styles.sectionHeader}>
                <h2>{categoria.nome_categoria}</h2>
              </div>
              <div className={styles.productGrid}>
                {categoryProducts.map(product => (
                  <div key={product.id} className={styles.productCard} id={`product-${product.id}`}>
                    <div className={styles.productImage}>
                      <img 
                        src={product.imagem_produto_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop"} 
                        alt={product.nome_produto} 
                      />
                    </div>
                    <div className={styles.productInfo}>
                      <h3>{product.nome_produto}</h3>
                      <p>{product.descricao || 'Sem descrição disponível.'}</p>
                      <div className={styles.productFooter}>
                        <span className={styles.price}>R$ {product.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className={styles.actionButtons}>
                          {(product.estoque_atual !== undefined && product.estoque_atual <= 0) ? (
                            <span className={styles.outOfStock}>Esgotado</span>
                          ) : (
                            <button 
                              className={styles.viewButton}
                              onClick={() => {
                                openProductModal(product);
                              }}
                              title="Adicionar"
                            >
                              <ShoppingCart size={18} />
                              <span>Adicionar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Testimonials Carousel */}
        <section className={styles.testimonials}>
          <div className={styles.testimonialsHeader}>
            <h2>O que nossos clientes dizem</h2>
          </div>
          <div className={styles.carouselContainer}>
            <div 
              className={styles.carouselTrack}
              style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
            >
              {testimonials.map((t) => (
                <div key={t.id} className={styles.carouselItem}>
                  <div className={styles.testimonialCard}>
                    <div className={styles.testimonialUser}>
                      <img src={t.avatar} alt={t.name} />
                      <div>
                        <h4>{t.name}</h4>
                        <div className={styles.stars}>
                          {[...Array(t.rating)].map((_, i) => <Star key={i} size={12} fill="#fbbf24" color="#fbbf24" />)}
                        </div>
                      </div>
                    </div>
                    <p>{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className={styles.newsletter}>
          <div className={styles.newsletterContent}>
            <h2>Fique por dentro de novas promoções</h2>
            <p>Receba novidades e ofertas exclusivas diretamente no seu e-mail.</p>
          </div>
          <form className={styles.newsletterForm} onSubmit={handleSubscribe}>
            <input 
              type="email" 
              placeholder="Seu melhor e-mail" 
              required 
            />
            <button type="submit">Inscrever</button>
          </form>
        </section>
      </main>

      {/* Subscribe Success Modal */}
      {showSubscribeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              <Check size={32} color="#16a34a" />
            </div>
            
            <h3 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Inscrição Confirmada!
            </h3>
            
            <p style={{ 
              color: '#4b5563', 
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Obrigado por se inscrever! Você receberá nossas melhores ofertas e novidades em breve.
            </p>

            <button
              onClick={() => setShowSubscribeModal(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
            >
              Entendi
            </button>
          </div>
        </div>
      )}


      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}><MessageSquare size={24} fill="#22c55e" color="#22c55e" /></div>
              <span className={styles.logoText}>ZAPZAP<span className={styles.logoTextGreen}>DELIVERY</span></span>
            </div>
            <p>Redefinindo a experiência de delivery com qualidade gourmet e agilidade sem precedentes.</p>
          </div>

          <div className={styles.footerCol}>
            <h4>Menu</h4>
            <ul>
              <li>Início</li>
              <li>Cardápio</li>
              <li>Promoções</li>
              <li>Meus Pedidos</li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h4>Suporte</h4>
            <ul>
              <li>FAQ</li>
              <li>Central de Ajuda</li>
              <li>Privacidade</li>
              <li>Termos de Uso</li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h4>Atendimento</h4>
            <ul>
              <li>Segunda a Domingo: 11:00 às 23:30</li>
              <li className={styles.phone}>
                {estabelecimento.telefone}
              </li>
              <li>
                {[estabelecimento.endereco, estabelecimento.numero]
                  .filter(Boolean)
                  .join(', ')}
              </li>
              <li>
                {[
                  estabelecimento.bairro,
                  estabelecimento.cidade,
                  estabelecimento.uf,
                ]
                  .filter(Boolean)
                  .join(' - ')}
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.socialLinks}>
          <button className={styles.twitter}><Twitter size={20} /></button>
          <button className={styles.instagram}><Instagram size={20} /></button>
          <button className={styles.facebook}><Facebook size={20} /></button>
        </div>

        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} ZapZap Delivery. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Cart Sidebar (Desktop) */}
      {!isMobile && showCart && (
        <div className={styles.cartOverlay} onClick={() => setShowCart(false)}>
          <div className={styles.cartSidebar} onClick={e => e.stopPropagation()}>
            <div className={styles.cartSidebarHeader}>
              <div className={styles.cartSidebarTitle}>
                <ShoppingCart size={24} />
                <span>Seu Pedido</span>
              </div>
              <button className={styles.closeSidebar} onClick={() => setShowCart(false)}>
                <X size={24} />
              </button>
            </div>

            <div className={styles.cartSidebarContent}>
              {items.length === 0 ? (
                <div className={styles.emptySidebar}>
                  <ShoppingCart size={48} color="#e5e7eb" />
                  <p>Seu carrinho está vazio</p>
                  <button className={styles.btnPrimary} onClick={() => setShowCart(false)}>
                    Ver Cardápio
                  </button>
                </div>
              ) : (
                <div className={styles.sidebarItems}>
                  {items.map(item => (
                    <div key={item.id} className={styles.sidebarItem}>
                      <div className={styles.sidebarItemInfo}>
                        <h4>{item.nome_produto}</h4>
                        <p>R$ {item.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div className={styles.sidebarItemActions}>
                          <div className={styles.quantitySelectorMini}>
                            <button onClick={() => updateQuantity(item.id, item.quantidade - 1)} disabled={item.quantidade <= 1}>
                              <Minus size={14} />
                            </button>
                            <span>{item.quantidade}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantidade + 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                          <button className={styles.removeSmall} onClick={() => removeItem(item.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.sidebarItemTotal}>
                        R$ {(item.valor_base * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className={styles.cartSidebarFooter}>
                <div className={styles.sidebarTotal}>
                  <span>Subtotal</span>
                  <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <button 
                  className={styles.btnCheckout}
                  onClick={() => router.push(`/estabelecimentos/cardapio/${slug}/carrinho`)}
                >
                  <span>FINALIZAR PEDIDO</span>
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <div className={styles.modalOverlay} onClick={closeProductModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={closeProductModal}>
              <X size={24} />
            </button>
            
            <div className={styles.modalBody}>
              <div className={styles.modalImage}>
                <img 
                  src={selectedProduct.imagem_produto_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop"} 
                  alt={selectedProduct.nome_produto} 
                />
              </div>
              
              <div className={styles.modalInfo}>
                <div className={styles.modalScrollableContent}>
                  <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{selectedProduct.nome_produto}</h2>
                    <span className={styles.modalPrice}>
                      {(() => {
                        let extra = 0;
                        const groups = (selectedProduct as any).grupos_adicionais || [];
                        const idx = new Map<string, number>();
                        groups.forEach((g: any) =>
                          (g.adicionais || []).forEach((a: any) =>
                            idx.set(String(a.id), Number(a.preco) || 0)
                          )
                        );
                        Object.values(selectedByGroup).forEach((ids) =>
                          ids.forEach((id) => {
                            extra += idx.get(String(id)) || 0;
                          })
                        );
                        const price = Number(selectedProduct.valor_base) + extra;
                        return `R$ ${price.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}`;
                      })()}
                    </span>
                  </div>
                  
                  <p className={styles.modalDescription}>
                    {selectedProduct.descricao || 'Sem descrição disponível.'}
                  </p>

                  <div className={styles.additionalItems}>
                    {Array.isArray((selectedProduct as any).grupos_adicionais) &&
                      (selectedProduct as any).grupos_adicionais.length > 0 && (
                        <>
                          {(selectedProduct as any).grupos_adicionais.map((grupo: any) => {
                            const current = selectedByGroup[grupo.grupo_id] || [];
                            const max = Number(grupo.max_opcoes_resolvido) || 1;
                            const min = Number(grupo.min_opcoes) || 0;
                            const isUnico = String(grupo.tipo_selecao) === 'unico';
                            const totalSelecionado = current.length;

                            const countOf = (aid: string) =>
                              current.filter((id) => id === aid).length;

                            const handleToggle = (aid: string) => {
                              setSelectedByGroup((prev) => {
                                const arr = prev[grupo.grupo_id]
                                  ? [...prev[grupo.grupo_id]]
                                  : [];
                                if (isUnico) {
                                  return { ...prev, [grupo.grupo_id]: [aid] };
                                }
                                const next = arr.filter((id) => id !== aid);
                                if (next.length === arr.length) {
                                  if (arr.length >= max) return prev;
                                  next.push(aid);
                                }
                                return { ...prev, [grupo.grupo_id]: next };
                              });
                            };

                            const handleIncrement = (aid: string) => {
                              setSelectedByGroup((prev) => {
                                const arr = prev[grupo.grupo_id]
                                  ? [...prev[grupo.grupo_id]]
                                  : [];
                                if (arr.length >= max) return prev;
                                arr.push(aid);
                                return { ...prev, [grupo.grupo_id]: arr };
                              });
                            };

                            const handleDecrement = (aid: string) => {
                              setSelectedByGroup((prev) => {
                                const arr = prev[grupo.grupo_id]
                                  ? [...prev[grupo.grupo_id]]
                                  : [];
                                const idx = arr.indexOf(aid);
                                if (idx < 0) return prev;
                                arr.splice(idx, 1);
                                return { ...prev, [grupo.grupo_id]: arr };
                              });
                            };

                            return (
                              <div key={grupo.grupo_id} style={{ marginBottom: '2rem' }}>
                                <div className={styles.sectionTitle}>
                                  {grupo.nome}
                                  <span style={{ fontWeight: 'normal', color: '#9ca3af', marginLeft: 'auto', fontSize: '0.8rem' }}>
                                    {grupo.obrigatorio ? 'Obrigatório • ' : ''}
                                    {isUnico ? 'Escolha 1' : `Escolha até ${max}`}
                                  </span>
                                </div>
                                
                                {grupo.adicionais.map((a: any) => {
                                  const preco = Number(a.preco) || 0;
                                  const isFree = preco <= 0;
                                  const count = countOf(String(a.id));
                                  const checked = isUnico
                                    ? current[0] === a.id
                                    : isFree
                                    ? current.includes(a.id)
                                    : count > 0;
                                    
                                  return (
                                    <div 
                                      key={a.id} 
                                      className={styles.itemRow} 
                                      onClick={() => (isFree || !checked) && handleToggle(String(a.id))}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className={styles.itemInfo}>
                                        <span className={styles.itemName}>{a.nome}</span>
                                        <span className={styles.itemPrice}>
                                          {preco > 0
                                            ? `+ R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : null}
                                        </span>
                                      </div>
                                      
                                      {isUnico ? (
                                        <input
                                          type="radio"
                                          name={`grupo-${grupo.grupo_id}`}
                                          checked={checked}
                                          onChange={() => handleToggle(String(a.id))}
                                          style={{ width: '20px', height: '20px', accentColor: '#22c55e' }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : isFree ? (
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.375rem',
                                            backgroundColor: checked ? '#dcfce7' : 'transparent',
                                            border: checked ? '1px solid #22c55e' : '1px solid transparent',
                                            transition: 'all 0.2s',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggle(String(a.id));
                                          }}
                                        >
                                          {checked && <Check size={14} color="#16a34a" strokeWidth={3} />}
                                          <span
                                            style={{
                                              color: checked ? '#16a34a' : '#6b7280',
                                              fontWeight: checked ? '700' : '500',
                                              fontSize: '0.875rem',
                                              textTransform: 'uppercase',
                                            }}
                                          >
                                            Grátis
                                          </span>
                                        </div>
                                      ) : (
                                        <div className={styles.itemQuantityControl} onClick={e => e.stopPropagation()}>
                                          <button 
                                            className={styles.btnQty}
                                            onClick={() => checked ? handleDecrement(String(a.id)) : null}
                                            disabled={!checked || count === 0}
                                          >
                                            <Minus size={14} />
                                          </button>
                                          <span className={styles.qtyValue}>{count}</span>
                                          <button 
                                            className={styles.btnQty}
                                            onClick={() => handleIncrement(String(a.id))}
                                            disabled={totalSelecionado >= max && count === 0}
                                          >
                                            <Plus size={14} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {grupo.obrigatorio &&
                                  totalSelecionado < Math.max(1, min) && (
                                    <div className={styles.optionError}>
                                      Seleção obrigatória
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </>
                      )}
                  </div>

                  {selectedProduct.permite_observacao && (
                    <div className={styles.observationContainer}>
                      <div className={styles.observationHeader}>
                        <MessageSquare size={16} />
                        <span>Alguma observação?</span>
                      </div>
                      <textarea
                        className={styles.observationInput}
                        placeholder="Ex: tirar cebola, ponto da carne, maionese à parte..."
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        maxLength={240}
                      />
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                        {observation.length}/240
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <div className={styles.sectionTitle}>Quantidade</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '1rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className={styles.btnQty}
                        style={{ width: '48px', height: '48px' }}
                      >
                        <Minus size={20} />
                      </button>
                      <span style={{ fontSize: '1.5rem', fontWeight: '700', minWidth: '3rem', textAlign: 'center' }}>{quantity}</span>
                      <button 
                        onClick={() => {
                          const max = selectedProduct.estoque_atual ?? 999;
                          setQuantity(Math.min(max, quantity + 1));
                        }}
                        className={styles.btnQty}
                        style={{ width: '48px', height: '48px' }}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className={styles.modalFooter}>
                  <button
                    className={styles.btnClose}
                    onClick={closeProductModal}
                  >
                    FECHAR
                  </button>

                  <button
                    className={styles.btnAdd}
                    onClick={() => handleAddToCart(selectedProduct, quantity)}
                  >
                    ADICIONAR + {(() => {
                      let extra = 0;
                      const groups =
                        (selectedProduct as any).grupos_adicionais || [];
                      const idx = new Map<string, number>();
                      groups.forEach((g: any) =>
                        (g.adicionais || []).forEach((a: any) =>
                          idx.set(String(a.id), Number(a.preco) || 0)
                        )
                      );
                      Object.values(selectedByGroup).forEach((ids) =>
                        ids.forEach((id) => {
                          extra += idx.get(String(id)) || 0;
                        })
                      );
                      const unitPrice = Number(selectedProduct.valor_base) + extra;
                      const total = unitPrice * quantity;
                      return `R$ ${total.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}`;
                    })()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
