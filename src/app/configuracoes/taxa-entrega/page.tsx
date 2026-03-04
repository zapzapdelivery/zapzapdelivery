'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { 
  Truck, 
  MapPin, 
  DollarSign, 
  Save, 
  Plus, 
  Trash2,
  AlertCircle,
  Edit2,
  X,
  Check,
  Search
} from 'lucide-react';
import styles from './page.module.css';
import { DeliveryFeeConfig } from '@/types/delivery';

interface NeighborhoodState {
  id?: string;
  nome_bairro: string;
  valor_taxa: number;
}

interface ExtendedDeliveryConfig extends Omit<DeliveryFeeConfig, 'id' | 'estabelecimento_id' | 'criado_em' | 'atualizado_em'> {
  id?: string;
  neighborhoods?: NeighborhoodState[];
}

export default function TaxaEntregaPage() {
  const { openSidebar } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();
  const [config, setConfig] = useState<ExtendedDeliveryConfig>({
    tipo_taxa: 'fixo',
    valor_base: 0,
    preco_km: 0,
    km_base: 0,
    distancia_maxima: null,
    ativo: true,
    neighborhoods: []
  });

  // Neighborhood form state
  const [newHoodName, setNewHoodName] = useState('');
  const [newHoodPrice, setNewHoodPrice] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [estLocation, setEstLocation] = useState<{ city: string; state: string; cep: string; neighborhood: string } | null>(null);
  const [useAutoSearch, setUseAutoSearch] = useState(true);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ nome: string; valor: string }>({ nome: '', valor: '' });

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [neighborhoodToDelete, setNeighborhoodToDelete] = useState<number | null>(null);

  // Distance Test State
  const [testCep, setTestCep] = useState('');
  const [testDistance, setTestDistance] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [testDistanceError, setTestDistanceError] = useState<string | null>(null);

  const handleTestDistance = useCallback(async () => {
    const cleanCep = testCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setTestDistanceError('CEP inválido');
      return;
    }

    if (!estLocation) {
      setTestDistanceError('Endereço do estabelecimento não encontrado');
      return;
    }

    try {
      setCalculatingDistance(true);
      setTestDistanceError(null);
      setTestDistance(null);

      // Construct origin address from establishment location
      // Using neighborhood + city + state is usually accurate enough
      const origin = `${estLocation.neighborhood}, ${estLocation.city} - ${estLocation.state}, Brasil`;
      
      // Destination is the CEP
      const destination = cleanCep;

      const response = await fetch('/api/utils/distance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ origin, destination })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao calcular distância');
      }

      setTestDistance(data.distance);
    } catch (error: any) {
      console.error('Error calculating distance:', error);
      setTestDistanceError(error.message || 'Erro ao calcular distância');
    } finally {
      setCalculatingDistance(false);
    }
  }, [testCep, estLocation]);

  useEffect(() => {
    const cleanCep = testCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      handleTestDistance();
    } else {
      setTestDistance(null);
      setTestDistanceError(null);
    }
  }, [testCep, handleTestDistance]);

  const calculateTestFee = (distance: number) => {
    if (distance <= config.km_base) {
      return config.valor_base;
    }
    const extraKm = distance - config.km_base;
    return config.valor_base + (extraKm * config.preco_km);
  };

  // Debounce search
  useEffect(() => {
    if (!useAutoSearch) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (newHoodName.length > 2 && showSuggestions) {
        await searchNeighborhoods(newHoodName);
      } else if (newHoodName.length === 0) {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newHoodName, showSuggestions, estLocation, useAutoSearch]);

  useEffect(() => {
    if (estLocation?.city && estLocation?.state) {
      fetchCityNeighborhoods(estLocation.city, estLocation.state);
    }
  }, [estLocation]);

  const fetchCityNeighborhoods = async (city: string, state: string) => {
    try {
      const response = await fetch(`/api/locations/neighborhoods?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
      if (response.ok) {
        const data = await response.json();
        setCitySuggestions(data.neighborhoods || []);
      }
    } catch (error) {
      console.error('Error fetching city neighborhoods:', error);
    }
  };

  const searchNeighborhoods = async (query: string) => {
    try {
      setIsSearching(true);
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) {
        console.warn('Mapbox token not found');
        return;
      }

      let searchQuery = query;
      let proximity = '';

      // Use establishment location to refine search
      if (estLocation?.city) {
        // Build a more specific query: "Neighborhood, City - State"
        searchQuery = `${query}, ${estLocation.city} - ${estLocation.state}`;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&country=br&types=neighborhood,locality&language=pt&limit=5${proximity}`
      );

      if (response.ok) {
        const data = await response.json();
        
        // Filter results to ensure they match the city if we have one
        let features = data.features || [];
        
        if (estLocation?.city) {
          const cityNormalized = estLocation.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          features = features.filter((feature: any) => {
            // Check context for city or state or just assume if it matches well
            // Context in Mapbox usually contains: [{"id":"locality...","text":"City"}, {"id":"region...","text":"State"}]
            const context = feature.context || [];
            
            // Log context to help debug if needed
            // console.log('Feature context:', feature.text, context);

            const hasCity = context.some((c: any) => {
              const name = c.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return name.includes(cityNormalized) || cityNormalized.includes(name);
            });
            
            // Also allow if the feature itself IS the city (though we filter for neighborhood types)
            return hasCity;
          });
        }
        
        setSuggestions(features);
      }
    } catch (error) {
      console.error('Error searching neighborhoods:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectNeighborhood = (feature: any) => {
    setNewHoodName(feature.text);
    setSuggestions([]);
    setShowSuggestions(false);
  };


  useEffect(() => {
    fetchConfig();
    fetchEstablishmentData();
  }, []);

  const fetchEstablishmentData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get user's establishment_id from usuarios table or role metadata
      // Since we don't have easy access to establishment_id here without useUserRole hook logic duplication,
      // let's try to get it from the session user metadata or a quick query
      
      // Best approach: Query usuarios table to get establishment_id
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('estabelecimento_id')
        .eq('id', session.user.id)
        .single();
      
      if (userError || !userData?.estabelecimento_id) return;

      const { data: estData, error: estError } = await supabase
        .from('estabelecimentos')
        .select('cidade, uf, cep, bairro')
        .eq('id', userData.estabelecimento_id)
        .single();

      if (!estError && estData) {
        setEstLocation({
          city: estData.cidade || '',
          state: estData.uf || '',
          cep: estData.cep || '',
          neighborhood: estData.bairro || ''
        });
      }
    } catch (error) {
      console.error('Error fetching establishment location:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/configuracoes/taxa-entrega', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure numeric values are numbers
        setConfig(prev => ({
          ...prev,
          ...data,
          valor_base: Number(data.valor_base) || 0,
          preco_km: Number(data.preco_km) || 0,
          km_base: Number(data.km_base) || 0,
          distancia_maxima: data.distancia_maxima ? Number(data.distancia_maxima) : null,
          neighborhoods: data.neighborhoods || []
        }));
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toastError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configToSave: ExtendedDeliveryConfig) => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toastError('Sessão expirada');
        return;
      }

      const payload = {
        ...configToSave,
        neighborhoods: configToSave.tipo_taxa === 'bairro' ? (configToSave.neighborhoods || []) : []
      };

      console.log('Sending payload to API:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/configuracoes/taxa-entrega', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar');
      }

      const data = await response.json();

      success(`Configurações salvas com sucesso! ${data.neighborhoodsSaved !== undefined ? data.neighborhoodsSaved + ' bairros registrados.' : ''}`);
      
      // Re-fetch to ensure we have the latest server state (IDs, etc)
      await fetchConfig(); 
    } catch (error: any) {
      console.error('Error saving:', error);
      toastError(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    saveConfig(config);
  };

  const addNeighborhood = () => {
    if (!newHoodName.trim() || !newHoodPrice) {
      toastError('Preencha o nome e o valor do bairro');
      return;
    }

    // Check for duplicates
    if (config.neighborhoods?.some(h => h.nome_bairro?.toLowerCase() === newHoodName.trim().toLowerCase())) {
      toastError('Bairro já cadastrado');
      return;
    }

    const priceValue = parseFloat(newHoodPrice.replace(',', '.'));
    if (isNaN(priceValue)) {
      toastError('Valor inválido');
      return;
    }

    const newHood = { nome_bairro: newHoodName, valor_taxa: priceValue };
    console.log('Adding neighborhood:', newHood);

    setConfig(prev => {
      const updated = {
        ...prev,
        neighborhoods: [
          ...(prev.neighborhoods || []),
          newHood
        ]
      };
      console.log('Updated config neighborhoods:', updated.neighborhoods);
      return updated;
    });

    setNewHoodName('');
    setNewHoodPrice('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <main className={styles.mainContent}>
          <div className={styles.loading}>Carregando...</div>
        </main>
      </div>
    );
  }

  const handleEdit = (index: number) => {
    const hood = config.neighborhoods![index];
    setEditingIndex(index);
    setEditValues({ nome: hood.nome_bairro!, valor: hood.valor_taxa!.toString() });
  };

  const handleSaveEdit = (index: number) => {
    if (!config.neighborhoods) return;
    
    const updatedNeighborhoods = [...config.neighborhoods];
    const priceValue = parseFloat(editValues.valor.replace(',', '.'));
    if (isNaN(priceValue)) {
      toastError('Valor inválido');
      return;
    }

    updatedNeighborhoods[index] = {
      ...updatedNeighborhoods[index],
      nome_bairro: editValues.nome,
      valor_taxa: priceValue
    };
    
    setConfig({
      ...config,
      neighborhoods: updatedNeighborhoods
    });
    
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const removeNeighborhood = (index: number) => {
    const updated = config.neighborhoods?.filter((_, i) => i !== index) || [];
    setConfig({ ...config, neighborhoods: updated });
  };

  const handleDeleteClick = (index: number) => {
    setNeighborhoodToDelete(index);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (neighborhoodToDelete !== null) {
      const updatedHoods = config.neighborhoods?.filter((_, i) => i !== neighborhoodToDelete) || [];
      const updatedConfig = { ...config, neighborhoods: updatedHoods };
      
      setConfig(updatedConfig);
      setDeleteModalOpen(false);
      setNeighborhoodToDelete(null);

      // Save immediately to backend
      await saveConfig(updatedConfig);
    }
  };

  return (
    <div className={styles.container}>
      
      <div className={styles.mobileOnly}>
         <MobileHeader 
           onMenuClick={openSidebar} 
           title="Taxa de Entrega"
           showGreeting={false}
         />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <AdminHeader title="Configuração de Entregas" subtitle="Defina como será cobrada a taxa de entrega" />
        </div>

        <div className={styles.contentWrapper}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Tipo de Taxa</h2>
            </div>
            
            <div className={styles.optionsGrid}>
              <label className={`${styles.typeOption} ${config.tipo_taxa === 'fixo' ? styles.selected : ''}`}>
                <input 
                  type="radio" 
                  name="tipo_taxa" 
                  value="fixo" 
                  checked={config.tipo_taxa === 'fixo'}
                  onChange={() => setConfig({ ...config, tipo_taxa: 'fixo' })}
                  className={styles.radioInput}
                />
                <div className={styles.optionContent}>
                  <span className={styles.optionTitle}>Valor Fixo</span>
                  <span className={styles.optionDesc}>Taxa única para qualquer entrega</span>
                </div>
              </label>

              <label className={`${styles.typeOption} ${config.tipo_taxa === 'bairro' ? styles.selected : ''}`}>
                <input 
                  type="radio" 
                  name="tipo_taxa" 
                  value="bairro" 
                  checked={config.tipo_taxa === 'bairro'}
                  onChange={() => setConfig({ ...config, tipo_taxa: 'bairro' })}
                  className={styles.radioInput}
                />
                <div className={styles.optionContent}>
                  <span className={styles.optionTitle}>Por Bairro</span>
                  <span className={styles.optionDesc}>Taxa específica para cada bairro</span>
                </div>
              </label>

              <label className={`${styles.typeOption} ${config.tipo_taxa === 'distancia' ? styles.selected : ''}`}>
                <input 
                  type="radio" 
                  name="tipo_taxa" 
                  value="distancia" 
                  checked={config.tipo_taxa === 'distancia'}
                  onChange={() => setConfig({ ...config, tipo_taxa: 'distancia' })}
                  className={styles.radioInput}
                />
                <div className={styles.optionContent}>
                  <span className={styles.optionTitle}>Por Distância (KM)</span>
                  <span className={styles.optionDesc}>Calculado com base na distância</span>
                </div>
              </label>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.flexBetween}>
                <h2>Restrições de Entrega</h2>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Raio Máximo de Entrega (KM)</label>
              <input 
                type="number" 
                step="0.1" 
                value={config.distancia_maxima || ''}
                onChange={(e) => setConfig({ ...config, distancia_maxima: e.target.value ? Number(e.target.value) : null })}
                className={styles.input}
                placeholder="Sem limite (Deixe em branco para ilimitado)"
                style={{ maxWidth: '300px' }}
              />
              <small>Entregas acima desta distância serão bloqueadas. Deixe em branco para não limitar.</small>
            </div>
          </div>

          {config.tipo_taxa === 'fixo' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Configuração Valor Fixo</h2>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor da Entrega (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={config.valor_base}
                  onChange={(e) => setConfig({ ...config, valor_base: Number(e.target.value) })}
                  className={styles.input}
                  style={{ maxWidth: '200px' }}
                />
              </div>
            </div>
          )}

          {config.tipo_taxa === 'distancia' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <MapPin className={styles.icon} size={24} />
                <h2>Configuração por Distância</h2>
              </div>
              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <label>Valor Base (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={config.valor_base}
                    onChange={(e) => setConfig({ ...config, valor_base: Number(e.target.value) })}
                    className={styles.input}
                  />
                  <small>Valor mínimo cobrado (taxa inicial)</small>
                </div>
                <div className={styles.formGroup}>
                  <label>KM Base (Incluso)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={config.km_base}
                    onChange={(e) => setConfig({ ...config, km_base: Number(e.target.value) })}
                    className={styles.input}
                  />
                  <small>Distância incluída no valor base</small>
                </div>
                <div className={styles.formGroup}>
                  <label>Preço por KM Adicional (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={config.preco_km}
                    onChange={(e) => setConfig({ ...config, preco_km: Number(e.target.value) })}
                    className={styles.input}
                  />
                </div>
              </div>
              
              <div className={styles.simulationSection} style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={20} />
                  Simular Custo de Entrega
                </h3>
                
                <div className={styles.formGroup}>
                  <label>CEP do Cliente</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="00000-000"
                      value={testCep}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 8) val = val.slice(0, 8);
                        if (val.length > 5) val = val.replace(/^(\d{5})(\d)/, '$1-$2');
                        setTestCep(val);
                      }}
                      className={styles.input}
                      style={{ maxWidth: '200px' }}
                    />
                    <button 
                      onClick={handleTestDistance}
                      disabled={calculatingDistance || testCep.replace(/\D/g, '').length !== 8}
                      className={styles.saveButton}
                      style={{ padding: '0 1.5rem', height: '42px', marginTop: 0 }}
                    >
                      {calculatingDistance ? 'Calculando...' : 'Calcular'}
                    </button>
                  </div>
                  {testDistanceError && (
                    <small style={{ color: '#ef4444', display: 'block', marginTop: '0.5rem' }}>
                      {testDistanceError}
                    </small>
                  )}
                  {testDistance !== null && !testDistanceError && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#166534' }}>Distância:</span>
                        <strong style={{ color: '#166534' }}>{testDistance} km</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Valor Total:</span>
                        <strong style={{ color: '#166534' }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTestFee(testDistance))}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {config.tipo_taxa === 'bairro' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.flexBetween}>
                  <h2>Taxas por Bairro</h2>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={useAutoSearch}
                      onChange={(e) => setUseAutoSearch(e.target.checked)}
                    />
                    Busca Automática
                  </label>
                </div>
                {estLocation && (
                  <div className={styles.locationBadge}>
                    <MapPin size={14} />
                    <span>Detectado: {estLocation.city} - {estLocation.state}</span>
                  </div>
                )}
              </div>
              
              <div className={styles.addHoodForm}>
                <div className={styles.inputWrapper} style={{ position: 'relative', flex: 1 }}>
                  <input 
                    type="text" 
                    placeholder={useAutoSearch ? "Nome do Bairro (Digite para buscar)" : "Nome do Bairro (Digite manualmente)"}
                    value={newHoodName}
                    onChange={(e) => {
                      setNewHoodName(e.target.value);
                      if (useAutoSearch) setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (useAutoSearch) setShowSuggestions(true);
                    }}
                    className={styles.input}
                    style={{ width: '100%' }}
                  />
                  {useAutoSearch && showSuggestions && (
                    <div className={styles.suggestionsContainer}>
                      <ul className={styles.suggestionsList}>
                        {citySuggestions
                          .filter(n => !newHoodName.trim() || n.toLowerCase().includes(newHoodName.trim().toLowerCase()))
                          .slice(0, 5)
                          .map((name) => (
                            <li 
                              key={`city-${name}`}
                              onClick={() => selectNeighborhood({ text: name })}
                              className={styles.suggestionItem}
                              style={{ borderLeft: '4px solid #10b981', backgroundColor: '#f0fdf4' }}
                            >
                              <strong>{name}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Bairro Cadastrado na Cidade</div>
                            </li>
                          ))}

                        {suggestions.map((feature) => (
                          <li 
                            key={feature.id} 
                            onClick={() => selectNeighborhood(feature)}
                            className={styles.suggestionItem}
                          >
                            <strong>{feature.text}</strong>
                            <small>{feature.context?.map((c: any) => c.text).join(', ')}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <input 
                  type="number" 
                  placeholder="Valor (R$)" 
                  step="0.01"
                  value={newHoodPrice}
                  onChange={(e) => setNewHoodPrice(e.target.value)}
                  className={styles.input}
                  style={{ width: '120px' }}
                />
                <button onClick={addNeighborhood} className={styles.addButton}>
                  <Plus size={18} /> Adicionar
                </button>
              </div>

              <div className={styles.hoodList}>
                {config.neighborhoods?.length === 0 && (
                  <div className={styles.emptyState}>
                    <AlertCircle size={20} />
                    <span>Nenhum bairro cadastrado</span>
                  </div>
                )}
                {config.neighborhoods?.length! > 0 && (
                  <div className={styles.hoodHeader}>
                    <span>Bairro</span>
                    <span>Taxa (R$)</span>
                    <span>Ações</span>
                  </div>
                )}
                {config.neighborhoods?.map((hood, index) => (
                  <div key={index} className={styles.hoodItem}>
                    {editingIndex === index ? (
                      <>
                        <input
                          type="text"
                          value={editValues.nome}
                          onChange={(e) => setEditValues({ ...editValues, nome: e.target.value })}
                          className={styles.editInput}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.valor}
                          onChange={(e) => setEditValues({ ...editValues, valor: e.target.value })}
                          className={styles.editInput}
                        />
                        <div className={styles.actionButtons}>
                          <button onClick={() => handleSaveEdit(index)} className={styles.saveActionButton}>
                            <Check size={16} />
                          </button>
                          <button onClick={handleCancelEdit} className={styles.cancelActionButton}>
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.hoodName}>{hood.nome_bairro}</span>
                        <span className={styles.hoodPrice}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hood.valor_taxa!)}
                        </span>
                        <div className={styles.actionButtons}>
                          <button onClick={() => handleEdit(index)} className={styles.editButton}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteClick(index)} className={styles.removeButton}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button 
              onClick={handleSave} 
              disabled={saving} 
              className={styles.saveButton}
            >
              {saving ? 'Salvando...' : (
                <>
                  <Save size={20} /> Salvar Configurações
                </>
              )}
            </button>
          </div>
        </div>
      </main>
      
      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Bairro"
        description={
          <>
            Tem certeza que deseja excluir o bairro <strong>{neighborhoodToDelete !== null && config.neighborhoods?.[neighborhoodToDelete]?.nome_bairro}</strong>?
            <br />
            Esta ação removerá a taxa configurada para este local.
          </>
        }
        isDeleting={false}
      />
    </div>
  );
}
