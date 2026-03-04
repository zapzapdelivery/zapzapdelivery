import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          if (mounted) {
            setRole(null);
            setEstablishmentId(null);
            setEstablishmentName(null);
          }
          return;
        }

        const user = session.user;
        // Super admin check
        if (user?.email === 'everaldozs@gmail.com') {
          if (mounted) {
            setRole('admin');
            setLoading(false);
          }
          return;
        }

        const res = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store'
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setRole(data.role);
            setEstablishmentId(data.establishment_id);
            setEstablishmentName(data.establishment_name);
          }
        } else {
          if (mounted) {
            setRole(null);
            setEstablishmentId(null);
            setEstablishmentName(null);
          }
        }
      } catch (error) {
        console.error('Error fetching role:', error);
        if (mounted) {
          setRole(null);
          setEstablishmentId(null);
          setEstablishmentName(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchRole();

    return () => {
      mounted = false;
    };
  }, []);

  return { role, establishmentId, establishmentName, loading };
}
