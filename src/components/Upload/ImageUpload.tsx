import React, { useRef, useState } from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  bucket: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  showUrlInput?: boolean;
  maxSizeMB?: number;
  className?: string;
  helpText?: string;
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
  helpText
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, deleteFile, uploading, error: uploadError } = useStorage();
  const { success, error: toastError } = useToast();
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const url = await uploadFile(file, { bucket, folder, maxSizeMB });
      if (url) {
        if (oldUrl) {
          await deleteFile(oldUrl, bucket);
        }
        onChange(url);
        success('Imagem enviada com sucesso!');
      }
    } catch (err) {
      console.error(err);
      toastError('Erro ao enviar imagem.');
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
        success('Imagem excluída com sucesso!');
      } catch (err) {
        console.error('Error deleting file:', err);
        toastError('Erro ao excluir imagem.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {value ? (
        <div style={{ position: 'relative' }}>
          <img 
            src={value} 
            alt="Preview" 
            className={styles.previewImage} 
            onError={(e) => (e.currentTarget.style.display = 'none')} 
          />
          <button 
            type="button"
            className={styles.removeButton}
            onClick={handleDeleteClick}
            title="Excluir imagem"
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className={styles.animateSpin} size={14} /> : <X size={14} />}
          </button>
        </div>
      ) : (
        <div 
          className={`${styles.uploadArea} ${uploading || isDeleting ? styles.disabled : ''}`}
          onClick={handleAreaClick}
        >
          {(uploading || isDeleting) && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner} />
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept="image/png, image/jpeg, image/webp, image/gif, image/avif"
            disabled={uploading || isDeleting}
          />
          
          <UploadCloud size={32} className={styles.uploadIcon} />
          <div className={styles.uploadText}>
            {uploading ? 'Enviando...' : isDeleting ? 'Excluindo...' : 'Clique para enviar'}
          </div>
          <div className={styles.uploadSubtext}>
            {helpText || `PNG, JPG, WEBP, AVIF até ${maxSizeMB}MB`}
          </div>
        </div>
      )}

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
