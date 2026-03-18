'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomerSidebar } from '@/components/CustomerSidebar/CustomerSidebar';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Lock, ArrowLeft } from 'lucide-react';
import styles from './senha.module.css';

export default function SenhaPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  useEffect(() => {
    document.title = 'ZapZap Delivery - Minha Conta';
  }, []);

  // Verificar requisitos da senha em tempo real
  useEffect(() => {
    setPasswordRequirements({
      minLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    });
  }, [newPassword]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Digite sua senha atual';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Digite uma nova senha';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'A senha deve ter pelo menos 8 caracteres';
    } else if (!Object.values(passwordRequirements).every(Boolean)) {
      newErrors.newPassword = 'A senha não atende aos requisitos de segurança';
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (newPassword === currentPassword) {
      newErrors.newPassword = 'A nova senha deve ser diferente da senha atual';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Primeiro, verificar se a senha atual está correta
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setErrors({ general: 'Erro ao verificar usuário. Por favor, faça login novamente.' });
        return;
      }

      // Atualizar a senha
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        if (error.message.includes('invalid')) {
          setErrors({ currentPassword: 'Senha atual incorreta' });
        } else {
          setErrors({ general: error.message });
        }
        return;
      }

      // Sucesso - limpar formulário
      setSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Opcional: redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/minhaconta');
      }, 2000);

    } catch (error: any) {
      setErrors({ general: 'Erro ao alterar senha. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getRequirementIcon = (met: boolean) => {
    return met ? (
      <CheckCircle2 size={16} className="text-green-500" />
    ) : (
      <AlertCircle size={16} className="text-gray-400" />
    );
  };

  return (
    <div className={styles.container}>
      <CustomerSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}>
        <MobileHeader 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title="Alterar Senha"
          subtitle="Mantenha sua conta segura"
          showGreeting={false}
        />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/minhaconta" className={styles.backButton} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </Link>

          <div className={styles.header}>
            <h1 className={styles.title}>Alterar Senha</h1>
            <p className={styles.subtitle}>
              Mantenha sua conta segura com uma senha forte
            </p>
          </div>
        </div>

        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
          <Link href="/minhaconta" className={styles.backButton} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '0' }}>
            <ArrowLeft size={18} />
            Voltar
          </Link>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {success && (
            <div className={styles.success}>
              <CheckCircle2 size={20} className="mr-2" />
              {success}
            </div>
          )}

          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {errors.general}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="currentPassword" className={styles.label}>
              Senha Atual
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={20} />
              <input
                id="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${styles.input} ${errors.currentPassword ? styles.error : ''}`}
                placeholder="Digite sua senha atual"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className={styles.eyeIcon}
                tabIndex={-1}
              >
                {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className={styles.error}>{errors.currentPassword}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              Nova Senha
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={20} />
              <input
                id="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${styles.input} ${errors.newPassword ? styles.error : ''}`}
                placeholder="Digite sua nova senha"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className={styles.eyeIcon}
                tabIndex={-1}
              >
                {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className={styles.error}>{errors.newPassword}</p>
            )}
          </div>

          <div className={styles.passwordRequirements}>
            <h4>Requisitos da senha:</h4>
            <div className={`${styles.requirement} ${passwordRequirements.minLength ? styles.met : styles.notMet}`}>
              {getRequirementIcon(passwordRequirements.minLength)}
              <span>Pelo menos 8 caracteres</span>
            </div>
            <div className={`${styles.requirement} ${passwordRequirements.hasUppercase ? styles.met : styles.notMet}`}>
              {getRequirementIcon(passwordRequirements.hasUppercase)}
              <span>Pelo menos uma letra maiúscula</span>
            </div>
            <div className={`${styles.requirement} ${passwordRequirements.hasLowercase ? styles.met : styles.notMet}`}>
              {getRequirementIcon(passwordRequirements.hasLowercase)}
              <span>Pelo menos uma letra minúscula</span>
            </div>
            <div className={`${styles.requirement} ${passwordRequirements.hasNumber ? styles.met : styles.notMet}`}>
              {getRequirementIcon(passwordRequirements.hasNumber)}
              <span>Pelo menos um número</span>
            </div>
            <div className={`${styles.requirement} ${passwordRequirements.hasSpecialChar ? styles.met : styles.notMet}`}>
              {getRequirementIcon(passwordRequirements.hasSpecialChar)}
              <span>Pelo menos um caractere especial</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirmar Nova Senha
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={20} />
              <input
                id="confirmPassword"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
                placeholder="Confirme sua nova senha"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className={styles.eyeIcon}
                tabIndex={-1}
              >
                {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className={styles.error}>{errors.confirmPassword}</p>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => router.back()}
              className={styles.btnCancel}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnSave}
              disabled={loading}
            >
              {loading ? (
                'Alterando...'
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Alterar Senha
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
