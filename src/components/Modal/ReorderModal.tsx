
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { X, GripVertical, Save } from 'lucide-react';
import styles from './ReorderModal.module.css';
import { useToast } from '@/components/Toast/ToastProvider';

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface EstablishmentItem {
  id: string;
  name: string;
  ordem?: number;
}

export function ReorderModal({ isOpen, onClose, onSave }: ReorderModalProps) {
  const [items, setItems] = useState<EstablishmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/estabelecimentos?all=true'); // We might need to adjust API to return all
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar estabelecimentos');
      
      // Sort by ordem if available, otherwise by name or id
      const sorted = (data || []).sort((a: any, b: any) => {
        if (a.ordem !== undefined && b.ordem !== undefined) {
          return a.ordem - b.ordem;
        }
        return 0;
      });

      setItems(sorted.map((item: any) => ({
        id: item.id,
        name: item.name || item.nome_estabelecimento || 'Sem nome',
        ordem: item.ordem
      })));
    } catch (err: any) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setItems(newItems);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        items: items.map((item, index) => ({
          id: item.id,
          ordem: index
        }))
      };

      const res = await fetch('/api/estabelecimentos/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar ordem');

      success('Ordem atualizada com sucesso!');
      onSave();
      onClose();
    } catch (err: any) {
      error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Reordenar Estabelecimentos</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Carregando...</div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="establishments">
                {(provided) => (
                  <ul
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={styles.list}
                  >
                    {items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`${styles.listItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                          >
                            <div {...provided.dragHandleProps} className={styles.dragHandle}>
                              <GripVertical size={20} />
                            </div>
                            <span className={styles.itemName}>{item.name}</span>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.saveButton} 
            onClick={handleSave} 
            disabled={saving || loading}
          >
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                Salvar Ordem
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
