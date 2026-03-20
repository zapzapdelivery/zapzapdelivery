import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useEstablishment() {
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchEstablishment() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || null;
        const user = session?.user || null;

        if (!mounted) return;

        if (!token || !user) {
          setLoading(false);
          return;
        }

        const email = String(user.email || '').toLowerCase();
        const isSuper = email === 'everaldozs@gmail.com';
        setIsSuperAdmin(isSuper);

        const roleRes = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const roleData = await roleRes.json().catch(() => ({}));

        if (!mounted) return;

        const estabId = (roleData?.establishment_id as string | null) ?? null;
        const estabName = String(roleData?.establishment_name || '').trim();

        if (!estabId) {
          if (String(roleData?.role || '').toLowerCase() === 'admin' || isSuper) {
            setEstablishmentId(null);
            setEstablishmentName(estabName || 'Visão Super Admin');
            setError(null);
            return;
          }

          setError('Usuário sem estabelecimento vinculado');
          setEstablishmentId(null);
          setEstablishmentName('');
          return;
        }

        setEstablishmentId(estabId);
        setEstablishmentName(estabName);
        setError(null);

      } catch (err: any) {
        if (mounted) {
          console.error('Erro inesperado em useEstablishment:', err);
          setError(err.message || 'Erro inesperado');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchEstablishment();

    return () => {
      mounted = false;
    };
  }, []);

  return { establishmentId, establishmentName, loading, error, isSuperAdmin };
}
