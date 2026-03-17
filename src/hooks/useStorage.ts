import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  allowAnonymous?: boolean;
}

interface UseStorageReturn {
  uploadFile: (file: File, options: UploadOptions) => Promise<string | null>;
  deleteFile: (url: string, bucket: string) => Promise<boolean>;
  uploading: boolean;
  error: string | null;
}

export const useStorage = (): UseStorageReturn => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File, options: UploadOptions): boolean => {
    const { maxSizeMB = 5, acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] } = options;

    if (!acceptedTypes.includes(file.type)) {
      setError(`Tipo de arquivo inválido. Permitidos: ${acceptedTypes.join(', ')}`);
      return false;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo permitido: ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File, options: UploadOptions): Promise<string | null> => {
    setUploading(true);
    setError(null);

    try {
      if (!validateFile(file, options)) {
        setUploading(false);
        return null;
      }

      // Use backend API to upload (bypasses RLS issues)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', options.bucket);
      if (options.folder) {
        formData.append('folder', options.folder);
      }

      let session: any = null;
      if (!options.allowAnonymous) {
        const { data } = await supabase.auth.getSession();
        session = data?.session ?? null;
        if (!session) {
          throw new Error('Usuário não autenticado');
        }
      }

      const headers: Record<string, string> = {};
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      if (options.allowAnonymous) {
        headers['x-allow-anonymous'] = 'true';
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro no upload via API');
      }

      const { url } = await response.json();
      return url;

      /* Client-side upload (Disabled due to RLS issues)
      const { data, error: uploadError } = await supabase.storage
        .from(options.bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(options.bucket)
        .getPublicUrl(filePath);

      return publicUrl;
      */
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (url: string, bucket: string): Promise<boolean> => {
    try {
      // Get session token for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const response = await fetch('/api/delete-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ url, bucket })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Delete API error:', errorData);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Delete error:', err);
      return false;
    }
  };

  return { uploadFile, deleteFile, uploading, error };
};
