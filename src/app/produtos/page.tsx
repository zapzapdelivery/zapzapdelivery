'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { supabase } from '@/lib/supabase';
import { useSidebar } from '@/context/SidebarContext';
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Upload, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  LayoutGrid, 
  List as ListIcon,
  Package as PackageIcon
} from 'lucide-react';
import styles from './produtos.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { useUserRole } from '@/hooks/useUserRole';
import { useStorage } from '@/hooks/useStorage';

interface Product {
  id: string;
  nome_produto: string;
  descricao: string | null;
  valor_base: number;
  categoria_id: string | null;
  imagem_produto_url: string | null;
  status_produto: string;
  estoque_atual?: number | null;
}

interface Category {
  id: string;
  nome_categoria: string;
}

export default function ProdutosPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { role, loading: loadingRole } = useUserRole();
  const { deleteFile } = useStorage();
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo' | 'esgotado'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const { openSidebar } = useSidebar();

  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<Product | null>(null);

  const PRODUCT_LABELS = {
    nome_produto: 'Nome',
    descricao: 'Descrição',
    valor_base: 'Valor Base',
    status_produto: 'Status'
  };

  const handleView = (product: Product) => {
    setViewData(product);
    setViewModalOpen(true);
  };

  const pageSize = 10;

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Get User Session for Token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // 2. Fetch Categories (Keep using Supabase client for categories as it's less sensitive or public)
        // Or better, we could also move this to an API, but for now let's focus on Products as requested.
        // To be safe and consistent with "middleware" requirement, let's fetch products via API.
        
        const { data: { user } } = await supabase.auth.getUser();
        const isSuperAdmin = user?.email === 'everaldozs@gmail.com';

        // Fetch Categories
        let queryCats = supabase
          .from('categorias')
          .select('id, nome_categoria')
          .order('nome_categoria');
        
        // We still need establishmentId for categories if we use client-side Supabase
        // But since we are moving to API for products, let's get establishmentId from profile for client-side category filtering
        // OR rely on API for products.
        
        const roleRes = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store'
        });
        const roleData = await roleRes.json().catch(() => ({}));
        const estabId = (roleData?.establishment_id as string | null) ?? null;
        setEstablishmentId(estabId);

        if (estabId) {
          queryCats = queryCats.eq('estabelecimento_id', estabId);
        }

        const { data: cats, error: catError } = await queryCats;
        if (catError) throw catError;
        setCategories(cats || []);

        // 3. Fetch Products via API (Middleware Interception)
        const res = await fetch('/api/produtos', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.error || 'Failed to fetch products');
        }

        const prods = await res.json();

        if (estabId) {
          const { data: stockRows, error: stockError } = await supabase
            .from('estoque_produtos')
            .select('produto_id, estoque_atual')
            .eq('estabelecimento_id', estabId);

          if (stockError) {
            console.error('Erro ao carregar estoque de produtos:', stockError);
          }

          const stockMap = new Map<string, number>(
            (stockRows || []).map((row: any) => [
              String(row.produto_id),
              Number(row.estoque_atual) || 0
            ])
          );

          const enriched = (prods || []).map((p: any) => ({
            ...p,
            estoque_atual: stockMap.get(String(p.id)) ?? null
          }));

          setProducts(enriched);
        } else {
          setProducts(prods || []);
        }

      } catch (err: any) {
        console.error('Error loading products:', err);
        toastError('Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, toastError]);

  // Filter & Pagination
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        p.nome_produto.toLowerCase().includes(searchLower) || 
        (p.descricao && p.descricao.toLowerCase().includes(searchLower)); // Removed code check as we don't have code in DB

      // Status
      const matchesStatus = statusFilter === 'todos' || p.status_produto === statusFilter;

      // Category
      const matchesCategory =
        categoryFilter === 'todas' || p.categoria_id === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  // Handlers
  const handleDelete = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      setProductToDelete(product);
      setDeleteModalOpen(true);
    }
  };

  const handleStatusChange = async (productId: string, newStatus: string) => {
    const originalProduct = products.find(p => p.id === productId);
    if (!originalProduct) return;

    try {
      // Optimistic update
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, status_produto: newStatus } : p
      ));

      const { error } = await supabase
        .from('produtos')
        .update({ status_produto: newStatus })
        .eq('id', productId);

      if (error) throw error;
      
      success('Status atualizado com sucesso');
    } catch (err) {
      console.error('Error updating status:', err);
      toastError('Erro ao atualizar status');
      // Revert optimistic update
      setProducts(prev => prev.map(p => 
        p.id === productId ? originalProduct : p
      ));
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);

      // 1. Delete image from Storage if exists
      if (productToDelete.imagem_produto_url) {
        await deleteFile(productToDelete.imagem_produto_url, 'products');
      }

      // 2. Delete record from Database
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productToDelete.id);
      
      if (error) throw error;
      
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      success('Produto excluído com sucesso');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err) {
      console.error('Error deleting product:', err);
      toastError('Erro ao excluir produto');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return '-';
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome_categoria : '-';
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loadingRole) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <AdminHeader onMenuClick={openSidebar} />
        
        <div className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <div>
              <Link href="/" className={styles.backLink}>← Voltar para Dashboard</Link>
              <h1 className={styles.title}>Produtos</h1>
              <p className={styles.subtitle}>Gerencie seus produtos</p>
            </div>
          </div>

        <div className={styles.actionsBar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, código ou categoria..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.actionButtons}>
            <Link href="/categorias" className={`${styles.btnAction} ${styles.btnCategory}`}>
              <PackageIcon size={18} />
              <span>Categorias</span>
            </Link>

            <button
              className={`${styles.btnAction} ${styles.btnAdicionais}`}
              onClick={() => router.push('/adicionais')}
            >
              <MoreHorizontal size={18} />
              <span>Adicionais</span>
            </button>

            <button className={`${styles.btnAction} ${styles.btnImport}`}>
              <Upload size={18} />
              <span>Importar</span>
            </button>

            <button className={`${styles.btnAction} ${styles.btnExport}`}>
              <Download size={18} />
              <span>Exportar</span>
            </button>

            <Link href="/produtos/novo" className={`${styles.btnAction} ${styles.btnNew}`}>
              <Plus size={18} />
              <span>Novo Produto</span>
            </Link>
          </div>
        </div>

        <div className={styles.filtersSection}>
          <div className={styles.tabs}>
            <button 
                className={`${styles.tab} ${statusFilter === 'todos' ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter('todos')}
            >
                Todos
            </button>
            <button 
                className={`${styles.tab} ${statusFilter === 'ativo' ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter('ativo')}
            >
                Ativos
            </button>
            <button 
                className={`${styles.tab} ${statusFilter === 'inativo' ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter('inativo')}
            >
                Inativos
            </button>
            <button 
                className={`${styles.tab} ${statusFilter === 'esgotado' ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter('esgotado')}
            >
                Esgotados
            </button>
          </div>
          
          <div className={styles.filtersRight}>
            <div className={styles.categoryFilter}>
              <Filter size={16} className={styles.categoryFilterIcon} />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="todas">Todas as categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome_categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.viewToggle}>
              <button 
                  className={`${styles.toggleBtn} ${view === 'list' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setView('list')}
              >
                  <ListIcon size={18} />
              </button>
              <button 
                  className={`${styles.toggleBtn} ${view === 'grid' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setView('grid')}
              >
                  <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>Carregando produtos...</div>
        ) : (
          <>
            {view === 'list' ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Imagem</th>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Preço</th>
                      <th>Estoque</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((product) => (
                        <tr key={product.id}>
                          <td className={styles.imageCell}>
                            <div className={styles.productImage}>
                              {product.imagem_produto_url ? (
                                <img src={product.imagem_produto_url} alt={product.nome_produto} />
                              ) : (
                                <div className={styles.placeholderImage}>
                                  <PackageIcon />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={styles.nameCell}>
                            <div className={styles.productName}>{product.nome_produto}</div>
                          </td>
                          <td>{getCategoryName(product.categoria_id)}</td>
                          <td className={styles.priceCell}>{formatCurrency(product.valor_base)}</td>
                          <td>
                            <span className={styles.stockInfo}>
                              {typeof product.estoque_atual === 'number'
                                ? `${product.estoque_atual} un`
                                : '-'}
                            </span>
                          </td>
                          <td>
                            <select
                              value={product.status_produto}
                              onChange={(e) => handleStatusChange(product.id, e.target.value)}
                              className={`${styles.statusSelect} ${styles[product.status_produto] || styles.defaultStatus}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="ativo">ATIVO</option>
                              <option value="inativo">INATIVO</option>
                              <option value="esgotado">ESGOTADO</option>
                            </select>
                          </td>
                          <td className={styles.actionsCell}>
                            <div className={styles.actions}>
                              <button className={`${styles.btnIcon} ${styles.btnView}`} title="Visualizar" onClick={() => handleView(product)}>
                                <Eye size={18} />
                              </button>
                              <Link href={`/produtos/editar/${product.id}`} className={`${styles.btnIcon} ${styles.btnEdit}`} title="Editar">
                                <Edit size={18} />
                              </Link>
                              {role !== 'atendente' && !loadingRole && (
                                <button 
                                  className={`${styles.btnIcon} ${styles.btnDelete}`} 
                                  title="Excluir"
                                  onClick={() => handleDelete(product.id)}
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View (Desktop) */
              <div className={styles.gridContainer}>
                {paginatedProducts.length === 0 ? (
                  <div className={styles.emptyState}>Nenhum produto encontrado.</div>
                ) : (
                  <div className={styles.productsGrid}>
                    {paginatedProducts.map((product) => (
                      <div key={product.id} className={styles.gridCard}>
                        <div className={styles.gridCardImage}>
                          {product.imagem_produto_url ? (
                            <img src={product.imagem_produto_url} alt={product.nome_produto} />
                          ) : (
                            <div className={styles.placeholderImage}>
                              <PackageIcon size={32} />
                            </div>
                          )}
                          <div className={`${styles.gridStatus} ${styles[product.status_produto]}`}>
                            {product.status_produto.toUpperCase()}
                          </div>
                        </div>
                        <div className={styles.gridCardContent}>
                          <div className={styles.gridCardCategory}>{getCategoryName(product.categoria_id)}</div>
                          <h3 className={styles.gridCardTitle}>{product.nome_produto}</h3>
                          <div className={styles.gridCardPrice}>{formatCurrency(product.valor_base)}</div>
                          <div className={styles.gridCardActions}>
                            <button className={styles.gridBtn} onClick={() => handleView(product)}>
                              <Eye size={16} />
                            </button>
                            <Link href={`/produtos/editar/${product.id}`} className={styles.gridBtn}>
                              <Edit size={16} />
                            </Link>
                            {role !== 'atendente' && !loadingRole && (
                              <button className={`${styles.gridBtn} ${styles.btnDelete}`} onClick={() => handleDelete(product.id)}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mobile List View (Always rendered, hidden by CSS on desktop) */}
            <div className={styles.mobileList}>
              {paginatedProducts.length === 0 ? (
                <div className={styles.emptyState}>
                  Nenhum produto encontrado.
                </div>
              ) : (
                paginatedProducts.map((product) => (
                  <div key={product.id} className={styles.mobileCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardImage}>
                          {product.imagem_produto_url ? (
                            <img src={product.imagem_produto_url} alt={product.nome_produto} />
                          ) : (
                            <div className={styles.placeholderImage}>
                              <PackageIcon />
                            </div>
                          )}
                        </div>
                        <div className={styles.cardText}>
                          <div className={styles.cardTitle}>{product.nome_produto}</div>
                          <div className={styles.cardSubtitle}>{formatCurrency(product.valor_base)} • {getCategoryName(product.categoria_id)}</div>
                        </div>
                      </div>
                      <select
                        value={product.status_produto}
                        onChange={(e) => handleStatusChange(product.id, e.target.value)}
                        className={`${styles.statusSelect} ${styles[product.status_produto] || styles.defaultStatus}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="ativo">ATIVO</option>
                        <option value="inativo">INATIVO</option>
                        <option value="esgotado">ESGOTADO</option>
                      </select>
                    </div>
                    <div className={styles.cardActions}>
                      <button className={`${styles.btnIcon} ${styles.btnView}`} title="Visualizar" onClick={() => handleView(product)}>
                        <Eye size={20} />
                      </button>
                      <Link href={`/produtos/editar/${product.id}`} className={`${styles.btnIcon} ${styles.btnEdit}`} title="Editar">
                        <Edit size={20} />
                      </Link>
                      {role !== 'atendente' && !loadingRole && (
                        <button 
                          className={`${styles.btnIcon} ${styles.btnDelete}`}
                          title="Excluir"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className={styles.footer}>
          <div className={styles.paginationInfo}>
            Mostrando {filteredProducts.length === 0 ? 0 : (page - 1) * pageSize + 1} de {filteredProducts.length} resultados
          </div>
          <div className={styles.pagination}>
            <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={`${styles.pageBtn} ${page === 1 ? styles.disabled : ''}`}
            >
                Anterior
            </button>
            <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={`${styles.pageBtn} ${page >= totalPages ? styles.disabled : ''}`}
            >
                Próxima
            </button>
          </div>
        </div>

        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Produto"
          data={viewData ? {
            nome_produto: viewData.nome_produto,
            descricao: viewData.descricao,
            valor_base: formatCurrency(viewData.valor_base),
            status_produto: viewData.status_produto
          } : null}
          labels={PRODUCT_LABELS}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => !isDeleting && setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
          title="Excluir Produto"
          description={
            <>
              Tem certeza que deseja excluir o produto <strong>{productToDelete?.nome_produto}</strong>? Esta ação não pode ser desfeita.
            </>
          }
        />
        </div>
      </main>
    </div>
  );
}
