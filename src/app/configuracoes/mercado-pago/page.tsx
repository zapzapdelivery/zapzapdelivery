'use client';

import React, { useState, useEffect } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { CreditCard, Save, Lock, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function MercadoPagoPage() {
  const { openSidebar } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();
  
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const [formData, setFormData] = useState({
    publicKeyTeste: '',
    accessTokenTeste: '',
    publicKeyProducao: '',
    accessTokenProducao: '',
    ambiente: 'teste', // 'teste' or 'producao'
    isActive: true
  });

  const [showPublicKeyTeste, setShowPublicKeyTeste] = useState(false);
  const [showAccessTokenTeste, setShowAccessTokenTeste] = useState(false);
  const [showPublicKeyProducao, setShowPublicKeyProducao] = useState(false);
  const [showAccessTokenProducao, setShowAccessTokenProducao] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/configuracoes/mercado-pago', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Generate Webhook URL if establishment_id is available
        if (data.estabelecimento_id) {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          setWebhookUrl(`${origin}/api/pagamentos/mercado-pago/webhook?estabelecimento_id=${data.estabelecimento_id}`);
        }

        // If config exists, populate form
        if (data && !data.error) {
          setFormData({
            publicKeyTeste: data.public_key_teste || data.public_key || '',
            accessTokenTeste: data.access_token_teste || data.access_token || '',
            publicKeyProducao: data.public_key_producao || '',
            accessTokenProducao: data.access_token_producao || '',
            ambiente: data.ambiente || 'teste',
            isActive: data.ativo ?? true
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Mercado Pago config:', error);
      toastError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/configuracoes/mercado-pago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          public_key_teste: formData.publicKeyTeste,
          access_token_teste: formData.accessTokenTeste,
          public_key_producao: formData.publicKeyProducao,
          access_token_producao: formData.accessTokenProducao,
          ambiente: formData.ambiente,
          ativo: formData.isActive
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar configurações');
      }

      success('Configurações do Mercado Pago salvas com sucesso!');
    } catch (err: any) {
      console.error('Error saving Mercado Pago config:', err);
      toastError(err.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.desktopOnly}>
        <AdminHeader title="Mercado Pago" onMenuClick={openSidebar} />
      </div>
      <div className={styles.mobileOnly}>
        <MobileHeader title="Mercado Pago" onMenuClick={openSidebar} />
      </div>
      
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <CreditCard className="w-6 h-6 text-green-600" />
              <h2 className={styles.cardTitle}>Credenciais do Mercado Pago</h2>
            </div>

            {/* Webhook Section */}
            <div className={styles.webhookSection}>
              <h3 className={styles.sectionTitle}>Webhook de Notificações</h3>
              <p className={styles.sectionDescription}>
                Copie este endereço e configure no painel do Mercado Pago (campo "URL para teste" e/ou "Modo de produção") para receber atualizações automáticas de status.
              </p>
              <div className={styles.webhookInputWrapper}>
                <input
                  readOnly
                  type="text"
                  value={webhookUrl || 'Carregando URL...'}
                  className={styles.inputReadOnly}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className={styles.copyButton}
                  title="Copiar URL"
                >
                  {copySuccess ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className={styles.webhookNote}>
                <strong>Nota:</strong> O Mercado Pago exige que este endereço seja <strong>HTTPS</strong> e acessível publicamente.
                <br />
                Em ambiente local (localhost), utilize o <strong>ngrok</strong>.
              </p>
            </div>

            <form onSubmit={handleSave}>
              <div className={styles.environmentSection}>
                 <h3 className={styles.sectionTitle}>Ambiente Ativo</h3>
                 <div className={styles.radioGroup}>
                    <label className={`${styles.radioCard} ${formData.ambiente === 'teste' ? styles.radioCardSelected : ''}`}>
                      <input 
                        type="radio" 
                        name="ambiente" 
                        value="teste"
                        checked={formData.ambiente === 'teste'}
                        onChange={(e) => setFormData(prev => ({ ...prev, ambiente: 'teste' }))}
                        className={styles.radioInput}
                      />
                      <div className={styles.radioContent}>
                        <span className={styles.radioTitle}>Teste (Sandbox)</span>
                        <span className={styles.radioDescription}>Para desenvolvimento e testes</span>
                      </div>
                    </label>

                    <label className={`${styles.radioCard} ${formData.ambiente === 'producao' ? styles.radioCardSelectedProd : ''}`}>
                      <input 
                        type="radio" 
                        name="ambiente" 
                        value="producao"
                        checked={formData.ambiente === 'producao'}
                        onChange={(e) => setFormData(prev => ({ ...prev, ambiente: 'producao' }))}
                        className={styles.radioInput}
                      />
                      <div className={styles.radioContent}>
                        <span className={styles.radioTitle}>Produção</span>
                        <span className={styles.radioDescription}>Para receber pagamentos reais</span>
                      </div>
                    </label>
                 </div>
              </div>

              <div className="grid grid-cols-1 mb-8">
                {/* Test Credentials */}
                <div className={`${styles.credentialsSection} ${formData.ambiente !== 'teste' ? styles.credentialsSectionHidden : ''}`}>
                  <div className={styles.credentialsHeader}>
                    <div className={`${styles.credentialsIcon} bg-blue-100 text-blue-600`}>T</div>
                    <h3 className={styles.credentialsTitle}>Credenciais de Teste</h3>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="publicKeyTeste">
                      Public Key
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="publicKeyTeste"
                        type={showPublicKeyTeste ? 'text' : 'password'}
                        className={styles.input}
                        value={formData.publicKeyTeste}
                        onChange={(e) => setFormData(prev => ({ ...prev, publicKeyTeste: e.target.value }))}
                        placeholder="TEST-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowPublicKeyTeste(!showPublicKeyTeste)}
                        className={styles.inputIcon}
                      >
                        {showPublicKeyTeste ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="accessTokenTeste">
                      Access Token
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="accessTokenTeste"
                        type={showAccessTokenTeste ? 'text' : 'password'}
                        className={styles.input}
                        value={formData.accessTokenTeste}
                        onChange={(e) => setFormData(prev => ({ ...prev, accessTokenTeste: e.target.value }))}
                        placeholder="TEST-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessTokenTeste(!showAccessTokenTeste)}
                        className={styles.inputIcon}
                      >
                        {showAccessTokenTeste ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Production Credentials */}
                <div className={`${styles.credentialsSection} ${formData.ambiente !== 'producao' ? styles.credentialsSectionHidden : ''}`}>
                  <div className={styles.credentialsHeader}>
                    <div className={`${styles.credentialsIcon} bg-green-100 text-green-600`}>P</div>
                    <h3 className={styles.credentialsTitle}>Credenciais de Produção</h3>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="publicKeyProducao">
                      Public Key
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="publicKeyProducao"
                        type={showPublicKeyProducao ? 'text' : 'password'}
                        className={styles.input}
                        value={formData.publicKeyProducao}
                        onChange={(e) => setFormData(prev => ({ ...prev, publicKeyProducao: e.target.value }))}
                        placeholder="APP_USR-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowPublicKeyProducao(!showPublicKeyProducao)}
                        className={styles.inputIcon}
                      >
                        {showPublicKeyProducao ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="accessTokenProducao">
                      Access Token
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="accessTokenProducao"
                        type={showAccessTokenProducao ? 'text' : 'password'}
                        className={styles.input}
                        value={formData.accessTokenProducao}
                        onChange={(e) => setFormData(prev => ({ ...prev, accessTokenProducao: e.target.value }))}
                        placeholder="APP_USR-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessTokenProducao(!showAccessTokenProducao)}
                        className={styles.inputIcon}
                      >
                        {showAccessTokenProducao ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.statusSection}>
                <h3 className={styles.sectionTitle}>Status do Módulo</h3>
                <div className={styles.statusOptions}>
                  <label className={styles.statusOption}>
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === true}
                      onChange={() => setFormData(prev => ({ ...prev, isActive: true }))}
                      className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer"
                    />
                    <span className={styles.statusLabel}>Ativo</span>
                  </label>
                  
                  <label className={styles.statusOption}>
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === false}
                      onChange={() => setFormData(prev => ({ ...prev, isActive: false }))}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer"
                    />
                    <span className={styles.statusLabel}>Inativo</span>
                  </label>
                </div>
              </div>

              <div className={styles.buttonContainer}>
                <button 
                  type="submit" 
                  className={styles.saveButton}
                  disabled={saving || loading}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
