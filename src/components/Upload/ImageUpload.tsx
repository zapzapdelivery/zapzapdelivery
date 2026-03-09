import React, { useRef, useState } from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './ImageUpload.module.css';

export interface ImageUploadProps {
  bucket: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  showUrlInput?: boolean;
  maxSizeMB?: number;
  className?: string;
  helpText?: string;
  allowAnonymous?: boolean;
  width?: number;
  height?: number;
  rounded?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  bucket,
  value,
  onChange,
  folder,
  label = 'Imagem',
  showUrlInput = true,
  maxSizeMB = 2,
  className,
  helpText,
  allowAnonymous,
  width,
  height,
  rounded
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, deleteFile, uploading, error: uploadError } = useStorage();
  const { success: showSuccess, error: showError } = useToast();
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const containerStyle: React.CSSProperties = {
    width: width ? `${width}px` : undefined,
    height: height ? `${height}px` : undefined,
    borderRadius: rounded ? '50%' : undefined,
  };

  const handleAreaClick = () => {
    if (!uploading && !isDeleting) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
        setInternalError(`O arquivo excede o tamanho máximo de ${maxSizeMB}MB.`);
        return;
    }

    // Validate type (extra check)
    if (!file.type.startsWith('image/')) {
        setInternalError('Apenas arquivos de imagem são permitidos.');
        return;
    }

    const oldUrl = value;
    setInternalError(null);
    
    try {
      const url = await uploadFile(file, { bucket, folder, maxSizeMB, allowAnonymous });
      if (url) {
        if (oldUrl && !oldUrl.startsWith('http')) { // Only delete if it's a storage path, not external URL
          await deleteFile(oldUrl, bucket);
        }
        onChange(url);
        showSuccess('Imagem enviada com sucesso!');
      }
    } catch (err) {
      console.error(err);
      showError('Erro ao enviar imagem.');
    } finally {
      // Reset input value to allow selecting same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value && !isDeleting) {
      setIsDeleting(true);
      try {
        await deleteFile(value, bucket);
        onChange('');
        showSuccess('Imagem excluída com sucesso!');
      } catch (err) {
        console.error('Error deleting file:', err);
        showError('Erro ao excluir imagem.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`} style={containerStyle}>
      <div 
        className={styles.uploadArea}
        onClick={handleAreaClick}
        style={{ borderRadius: rounded ? '50%' : '0.5rem' }}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/png, image/jpeg, image/webp, image/gif, image/avif"
          disabled={uploading || isDeleting}
        />
        {uploading ? (
          <div className={styles.loading}>
            <Loader2 className={styles.spinner} />
            <span>Enviando...</span>
          </div>
        ) : value ? (
          <div className={styles.preview}>
            <img 
              src={value.startsWith('http') ? value : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}`}
              alt="Preview" 
              className={styles.image} 
              style={{ borderRadius: rounded ? '50%' : '0.5rem', objectFit: 'cover', width: '100%', height: '100%' }}
            />
            <button 
              type="button"
              className={styles.deleteButton}
              onClick={handleDeleteClick}
              title="Remover imagem"
              style={{ borderRadius: '50%' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <UploadCloud size={32} />
            <span>{label}</span>
            <span className={styles.subtext}>Clique para selecionar</span>
          </div>
        )}
      </div>

      {(uploadError || internalError) && (
        <div className={styles.error}>
          {uploadError || internalError}
        </div>
      )}

      {showUrlInput && !value && (
        <div className={styles.inputGroup}>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="Ou cole a URL da imagem aqui"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={uploading || isDeleting}
          />
        </div>
      )}
    </div>
  );
};
