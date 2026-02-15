import React, { useState, useEffect, useRef, useMemo } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type LabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray';

interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

interface Card {
  id: string;
  title: string;
  description: string;
  columnId: string;
  labels: string[]; // Label IDs
  order: number;
  createdAt: number;
}

interface Column {
  id: string;
  title: string;
  order: number;
  color: string;
}

interface BoardData {
  columns: Column[];
  cards: Card[];
  labels: Label[];
}

interface DragState {
  draggedCard: Card | null;
  sourceColumnId: string | null;
  isDragging: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const isClient = typeof window !== 'undefined';

const DEFAULT_LABELS: Label[] = [
  { id: 'label_1', name: 'Urgente', color: 'red' },
  { id: 'label_2', name: 'Bug', color: 'orange' },
  { id: 'label_3', name: 'Feature', color: 'green' },
  { id: 'label_4', name: 'Design', color: 'purple' },
  { id: 'label_5', name: 'Documentação', color: 'blue' },
  { id: 'label_6', name: 'Teste', color: 'yellow' },
];

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col_1', title: 'Backlog', order: 0, color: '#64748b' },
  { id: 'col_2', title: 'Em Progresso', order: 1, color: '#3b82f6' },
  { id: 'col_3', title: 'Revisão', order: 2, color: '#f59e0b' },
  { id: 'col_4', title: 'Concluído', order: 3, color: '#10b981' },
];

const LABEL_COLORS: Record<LabelColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280',
};

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'kanban_darkMode',
    BOARD_DATA: 'kanban_boardData',
  });

  /**
   * Save data to sessionStorage (client-side only)
   */
  static saveToStorage(key: string, value: any): void {
    if (!isClient) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  }

  /**
   * Load data from sessionStorage with default fallback (client-side only)
   */
  static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!isClient) return defaultValue;
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return defaultValue;
    }
  }

  /**
   * Clear all app data from storage (client-side only)
   */
  static clearStorage(): void {
    if (!isClient) return;
    try {
      sessionStorage.removeItem(this.STORAGE_KEYS.DARK_MODE);
      sessionStorage.removeItem(this.STORAGE_KEYS.BOARD_DATA);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Get storage keys
   */
  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ============================================================================
// MODEL LAYER
// ============================================================================

/**
 * Kanban Board Model - Handles data structure and business logic
 */
class KanbanModel {
  private columns: Column[];
  private cards: Card[];
  private labels: Label[];

  constructor(initialData?: BoardData) {
    this.columns = initialData?.columns || [...DEFAULT_COLUMNS];
    this.cards = initialData?.cards || [];
    this.labels = initialData?.labels || [...DEFAULT_LABELS];
  }

  /**
   * Get all board data
   */
  getAllData(): BoardData {
    return {
      columns: [...this.columns],
      cards: [...this.cards],
      labels: [...this.labels],
    };
  }

  // ==================== COLUMN OPERATIONS ====================

  /**
   * Get all columns sorted by order
   */
  getColumns(): Column[] {
    return [...this.columns].sort((a, b) => a.order - b.order);
  }

  /**
   * Add new column
   */
  addColumn(title: string, color: string): Column {
    const newColumn: Column = {
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      order: this.columns.length,
      color,
    };
    this.columns.push(newColumn);
    return newColumn;
  }

  /**
   * Update column
   */
  updateColumn(id: string, updates: Partial<Column>): Column | null {
    const index = this.columns.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.columns[index] = { ...this.columns[index], ...updates };
    return this.columns[index];
  }

  /**
   * Delete column and its cards
   */
  deleteColumn(id: string): boolean {
    const initialLength = this.columns.length;
    this.columns = this.columns.filter(c => c.id !== id);
    this.cards = this.cards.filter(c => c.columnId !== id);
    return this.columns.length < initialLength;
  }

  /**
   * Reorder columns
   */
  reorderColumns(columnIds: string[]): void {
    columnIds.forEach((id, index) => {
      const column = this.columns.find(c => c.id === id);
      if (column) column.order = index;
    });
  }

  // ==================== CARD OPERATIONS ====================

  /**
   * Get cards by column ID
   */
  getCardsByColumn(columnId: string): Card[] {
    return this.cards
      .filter(c => c.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Add new card
   */
  addCard(card: Omit<Card, 'id' | 'createdAt' | 'order'>): Card {
    const columnCards = this.getCardsByColumn(card.columnId);
    const newCard: Card = {
      ...card,
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order: columnCards.length,
      createdAt: Date.now(),
    };
    this.cards.push(newCard);
    return newCard;
  }

  /**
   * Update card
   */
  updateCard(id: string, updates: Partial<Card>): Card | null {
    const index = this.cards.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.cards[index] = { ...this.cards[index], ...updates };
    return this.cards[index];
  }

  /**
   * Delete card
   */
  deleteCard(id: string): boolean {
    const initialLength = this.cards.length;
    this.cards = this.cards.filter(c => c.id !== id);
    return this.cards.length < initialLength;
  }

  /**
   * Move card to different column
   */
  moveCard(cardId: string, targetColumnId: string, targetOrder: number): Card | null {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return null;

    const sourceColumnId = card.columnId;

    // Remove card from source column and update orders
    if (sourceColumnId !== targetColumnId) {
      const sourceCards = this.getCardsByColumn(sourceColumnId);
      sourceCards
        .filter(c => c.order > card.order)
        .forEach(c => c.order--);
    }

    // Insert card into target column
    const targetCards = this.getCardsByColumn(targetColumnId);
    targetCards
      .filter(c => c.order >= targetOrder)
      .forEach(c => c.order++);

    // Update card
    card.columnId = targetColumnId;
    card.order = targetOrder;

    return card;
  }

  /**
   * Search cards by term
   */
  searchCards(term: string): Card[] {
    const lowerTerm = term.toLowerCase();
    return this.cards.filter(c =>
      c.title.toLowerCase().includes(lowerTerm) ||
      c.description.toLowerCase().includes(lowerTerm)
    );
  }

  /**
   * Filter cards by label IDs
   */
  filterCardsByLabels(labelIds: string[]): Card[] {
    if (labelIds.length === 0) return this.cards;
    return this.cards.filter(card =>
      labelIds.some(labelId => card.labels.includes(labelId))
    );
  }

  // ==================== LABEL OPERATIONS ====================

  /**
   * Get all labels
   */
  getLabels(): Label[] {
    return [...this.labels];
  }

  /**
   * Add new label
   */
  addLabel(name: string, color: LabelColor): Label {
    const newLabel: Label = {
      id: `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
    };
    this.labels.push(newLabel);
    return newLabel;
  }

  /**
   * Update label
   */
  updateLabel(id: string, updates: Partial<Label>): Label | null {
    const index = this.labels.findIndex(l => l.id === id);
    if (index === -1) return null;

    this.labels[index] = { ...this.labels[index], ...updates };
    return this.labels[index];
  }

  /**
   * Delete label
   */
  deleteLabel(id: string): boolean {
    const initialLength = this.labels.length;
    this.labels = this.labels.filter(l => l.id !== id);

    // Remove label from all cards
    this.cards.forEach(card => {
      card.labels = card.labels.filter(labelId => labelId !== id);
    });

    return this.labels.length < initialLength;
  }

  /**
   * Sync to storage
   */
  syncToStorage(): void {
    StorageService.saveToStorage(
      StorageService.getKeys().BOARD_DATA,
      this.getAllData()
    );
  }

  /**
   * Load from storage
   */
  static loadFromStorage(): KanbanModel {
    const data = StorageService.loadFromStorage<BoardData | null>(
      StorageService.getKeys().BOARD_DATA,
      null
    );
    return new KanbanModel(data || undefined);
  }
}

// ============================================================================
// CONTROLLER LAYER
// ============================================================================

/**
 * Kanban Controller - Manages state and coordinates between Model and View
 */
class KanbanController {
  private model: KanbanModel;
  private listeners: Set<() => void>;

  constructor(model: KanbanModel) {
    this.model = model;
    this.listeners = new Set();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
    this.model.syncToStorage();
  }

  // ==================== COLUMN METHODS ====================

  getColumns(): Column[] {
    return this.model.getColumns();
  }

  addColumn(title: string, color: string): void {
    this.model.addColumn(title, color);
    this.notify();
  }

  updateColumn(id: string, updates: Partial<Column>): void {
    this.model.updateColumn(id, updates);
    this.notify();
  }

  deleteColumn(id: string): void {
    this.model.deleteColumn(id);
    this.notify();
  }

  reorderColumns(columnIds: string[]): void {
    this.model.reorderColumns(columnIds);
    this.notify();
  }

  // ==================== CARD METHODS ====================

  getCardsByColumn(columnId: string): Card[] {
    return this.model.getCardsByColumn(columnId);
  }

  addCard(card: Omit<Card, 'id' | 'createdAt' | 'order'>): void {
    this.model.addCard(card);
    this.notify();
  }

  updateCard(id: string, updates: Partial<Card>): void {
    this.model.updateCard(id, updates);
    this.notify();
  }

  deleteCard(id: string): void {
    this.model.deleteCard(id);
    this.notify();
  }

  moveCard(cardId: string, targetColumnId: string, targetOrder: number): void {
    this.model.moveCard(cardId, targetColumnId, targetOrder);
    this.notify();
  }

  searchCards(term: string): Card[] {
    return this.model.searchCards(term);
  }

  filterCardsByLabels(labelIds: string[]): Card[] {
    return this.model.filterCardsByLabels(labelIds);
  }

  // ==================== LABEL METHODS ====================

  getLabels(): Label[] {
    return this.model.getLabels();
  }

  addLabel(name: string, color: LabelColor): void {
    this.model.addLabel(name, color);
    this.notify();
  }

  updateLabel(id: string, updates: Partial<Label>): void {
    this.model.updateLabel(id, updates);
    this.notify();
  }

  deleteLabel(id: string): void {
    this.model.deleteLabel(id);
    this.notify();
  }
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

/**
 * Header Component with theme toggle
 */
const Header: React.FC<{
  darkMode: boolean;
  toggleTheme: () => void;
  onAddColumn: () => void;
}> = ({ darkMode, toggleTheme, onAddColumn }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h1>Kanban Board</h1>
        </div>
        <div className="header-actions">
          <button onClick={onAddColumn} className="btn-add-column">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Coluna
          </button>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {darkMode ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

/**
 * Search and Filter Bar Component
 */
const FilterBar: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedLabels: string[];
  onLabelToggle: (labelId: string) => void;
  labels: Label[];
  onManageLabels: () => void;
}> = ({ searchTerm, onSearchChange, selectedLabels, onLabelToggle, labels, onManageLabels }) => {
  return (
    <div className="filter-bar">
      <div className="search-box">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar cards..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      <div className="label-filters">
        <button onClick={onManageLabels} className="manage-labels-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Gerenciar Labels
        </button>
        {labels.map(label => (
          <button
            key={label.id}
            onClick={() => onLabelToggle(label.id)}
            className={`label-filter ${selectedLabels.includes(label.id) ? 'active' : ''}`}
            style={{
              backgroundColor: selectedLabels.includes(label.id)
                ? LABEL_COLORS[label.color]
                : 'transparent',
              borderColor: LABEL_COLORS[label.color],
              color: selectedLabels.includes(label.id) ? '#fff' : 'currentColor'
            }}
          >
            {label.name}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Card Component with inline editing
 */
const CardComponent: React.FC<{
  card: Card;
  labels: Label[];
  onUpdate: (updates: Partial<Card>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}> = ({ card, labels, onUpdate, onDelete, onDragStart, onDragEnd }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDescription, setEditDescription] = useState(card.description);
  const [showLabels, setShowLabels] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
    }
  }, [isEditingDescription]);

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== card.title) {
      onUpdate({ title: editTitle.trim() });
    } else {
      setEditTitle(card.title);
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (editDescription !== card.description) {
      onUpdate({ description: editDescription });
    }
    setIsEditingDescription(false);
  };

  const toggleLabel = (labelId: string) => {
    const newLabels = card.labels.includes(labelId)
      ? card.labels.filter(id => id !== labelId)
      : [...card.labels, labelId];
    onUpdate({ labels: newLabels });
  };

  const cardLabels = labels.filter(l => card.labels.includes(l.id));

  return (
    <div
      className="card"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="card-header">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setEditTitle(card.title);
                setIsEditingTitle(false);
              }
            }}
            className="card-title-input"
          />
        ) : (
          <h4 onClick={() => setIsEditingTitle(true)} className="card-title">
            {card.title}
          </h4>
        )}
        <button onClick={onDelete} className="card-delete" aria-label="Excluir card">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {cardLabels.length > 0 && (
        <div className="card-labels">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className="card-label"
              style={{ backgroundColor: LABEL_COLORS[label.color] }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {isEditingDescription ? (
        <textarea
          ref={descriptionTextareaRef}
          value={editDescription}
          onChange={e => setEditDescription(e.target.value)}
          onBlur={handleDescriptionSave}
          className="card-description-textarea"
          rows={3}
        />
      ) : (
        <p
          onClick={() => setIsEditingDescription(true)}
          className="card-description"
        >
          {card.description || 'Clique para adicionar descrição...'}
        </p>
      )}

      <div className="card-footer">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="btn-add-label"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Labels
        </button>
      </div>

      {showLabels && (
        <div className="label-selector">
          {labels.map(label => (
            <button
              key={label.id}
              onClick={() => toggleLabel(label.id)}
              className={`label-option ${card.labels.includes(label.id) ? 'selected' : ''}`}
              style={{
                backgroundColor: LABEL_COLORS[label.color],
                opacity: card.labels.includes(label.id) ? 1 : 0.6
              }}
            >
              {label.name}
              {card.labels.includes(label.id) && (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Column Component with drag and drop
 */
const ColumnComponent: React.FC<{
  column: Column;
  cards: Card[];
  labels: Label[];
  onAddCard: () => void;
  onUpdateCard: (cardId: string, updates: Partial<Card>) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateColumn: (updates: Partial<Column>) => void;
  onDeleteColumn: () => void;
  onCardDragStart: (card: Card) => void;
  onCardDragEnd: () => void;
  onCardDrop: (targetOrder: number) => void;
  isDraggingOver: boolean;
}> = ({
  column,
  cards,
  labels,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onUpdateColumn,
  onDeleteColumn,
  onCardDragStart,
  onCardDragEnd,
  onCardDrop,
  isDraggingOver
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(column.title);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditingTitle && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, [isEditingTitle]);

    const handleTitleSave = () => {
      if (editTitle.trim() && editTitle !== column.title) {
        onUpdateColumn({ title: editTitle.trim() });
      } else {
        setEditTitle(column.title);
      }
      setIsEditingTitle(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      onCardDrop(cards.length);
    };

    return (
      <div
        className={`column ${isDraggingOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="column-header" style={{ borderTopColor: column.color }}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setEditTitle(column.title);
                  setIsEditingTitle(false);
                }
              }}
              className="column-title-input"
            />
          ) : (
            <h3 onClick={() => setIsEditingTitle(true)} className="column-title">
              {column.title}
              <span className="card-count">{cards.length}</span>
            </h3>
          )}
          <div className="column-actions">
            <button onClick={onAddCard} className="btn-add-card" aria-label="Adicionar card">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button onClick={onDeleteColumn} className="btn-delete-column" aria-label="Excluir coluna">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="cards-container">
          {cards.map(card => (
            <CardComponent
              key={card.id}
              card={card}
              labels={labels}
              onUpdate={updates => onUpdateCard(card.id, updates)}
              onDelete={() => onDeleteCard(card.id)}
              onDragStart={() => onCardDragStart(card)}
              onDragEnd={onCardDragEnd}
            />
          ))}
          {cards.length === 0 && (
            <div className="empty-column">
              <p>Arraste cards aqui ou clique no + para adicionar</p>
            </div>
          )}
        </div>
      </div>
    );
  };

/**
 * Modal for adding new card
 */
const AddCardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, description: string) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), description.trim());
      setTitle('');
      setDescription('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Novo Card</h2>
          <button onClick={onClose} className="modal-close">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Digite o título do card"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Digite a descrição (opcional)"
              rows={4}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Modal for adding new column
 */
const AddColumnModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, color: string) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#3b82f6');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), color);
      setTitle('');
      setColor('#3b82f6');
      onClose();
    }
  };

  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#10b981', '#14b8a6', '#3b82f6', '#6366f1',
    '#8b5cf6', '#d946ef', '#ec4899', '#64748b'
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nova Coluna</h2>
          <button onClick={onClose} className="modal-close">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Digite o título da coluna"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Cor da Coluna</label>
            <div className="color-picker">
              {colorPresets.map(presetColor => (
                <button
                  key={presetColor}
                  type="button"
                  className={`color-option ${color === presetColor ? 'selected' : ''}`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Modal for managing labels
 */
const ManageLabelsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  onAddLabel: (name: string, color: LabelColor) => void;
  onUpdateLabel: (id: string, name: string) => void;
  onDeleteLabel: (id: string) => void;
}> = ({ isOpen, onClose, labels, onAddLabel, onUpdateLabel, onDeleteLabel }) => {
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('blue');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');

  if (!isOpen) return null;

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLabelName.trim()) {
      onAddLabel(newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setNewLabelColor('blue');
    }
  };

  const handleUpdateLabel = (id: string) => {
    if (editingLabelName.trim()) {
      onUpdateLabel(id, editingLabelName.trim());
      setEditingLabelId(null);
      setEditingLabelName('');
    }
  };

  const startEditing = (label: Label) => {
    setEditingLabelId(label.id);
    setEditingLabelName(label.name);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Gerenciar Labels</h2>
          <button onClick={onClose} className="modal-close">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="labels-list">
          {labels.map(label => (
            <div key={label.id} className="label-item">
              <span
                className="label-color-badge"
                style={{ backgroundColor: LABEL_COLORS[label.color] }}
              />
              {editingLabelId === label.id ? (
                <input
                  type="text"
                  value={editingLabelName}
                  onChange={e => setEditingLabelName(e.target.value)}
                  onBlur={() => handleUpdateLabel(label.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleUpdateLabel(label.id);
                    if (e.key === 'Escape') {
                      setEditingLabelId(null);
                      setEditingLabelName('');
                    }
                  }}
                  className="label-edit-input"
                  autoFocus
                />
              ) : (
                <span className="label-name" onClick={() => startEditing(label)}>
                  {label.name}
                </span>
              )}
              <button
                onClick={() => onDeleteLabel(label.id)}
                className="btn-delete-label"
                aria-label="Excluir label"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddLabel} className="add-label-form">
          <h3>Adicionar Nova Label</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={newLabelName}
                onChange={e => setNewLabelName(e.target.value)}
                placeholder="Nome da label"
                required
              />
            </div>
            <div className="form-group">
              <label>Cor</label>
              <select
                value={newLabelColor}
                onChange={e => setNewLabelColor(e.target.value as LabelColor)}
              >
                {Object.keys(LABEL_COLORS).map(color => (
                  <option key={color} value={color}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  // Initialize dark mode from storage
  const [darkMode, setDarkMode] = useState(() => {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  });

  // Initialize controller with model loaded from storage
  const [controller] = useState(() => {
    const model = KanbanModel.loadFromStorage();
    return new KanbanController(model);
  });

  // State management
  const [, forceUpdate] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    draggedCard: null,
    sourceColumnId: null,
    isDragging: false
  });
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Modal states
  const [addCardModal, setAddCardModal] = useState<{ isOpen: boolean; columnId: string | null }>({
    isOpen: false,
    columnId: null
  });
  const [addColumnModal, setAddColumnModal] = useState(false);
  const [manageLabelsModal, setManageLabelsModal] = useState(false);

  // Subscribe to controller changes
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, [controller]);

  // Update dark mode in DOM and storage
  useEffect(() => {
    if (isClient) {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, darkMode);
    }
  }, [darkMode]);

  // Get data from controller
  const columns = controller.getColumns();
  const labels = controller.getLabels();

  // Compute filtered cards
  const getFilteredCards = (columnId: string): Card[] => {
    let cards = controller.getCardsByColumn(columnId);

    // Apply search filter
    if (searchTerm) {
      const searchResults = controller.searchCards(searchTerm);
      cards = cards.filter(card => searchResults.some(sr => sr.id === card.id));
    }

    // Apply label filter
    if (selectedLabels.length > 0) {
      const labelFiltered = controller.filterCardsByLabels(selectedLabels);
      cards = cards.filter(card => labelFiltered.some(lf => lf.id === card.id));
    }

    return cards;
  };

  // Handlers
  const toggleTheme = () => setDarkMode(!darkMode);

  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleAddColumn = (title: string, color: string) => {
    controller.addColumn(title, color);
  };

  const handleAddCard = (columnId: string, title: string, description: string) => {
    controller.addCard({
      title,
      description,
      columnId,
      labels: []
    });
  };

  const handleCardDragStart = (card: Card) => {
    setDragState({
      draggedCard: card,
      sourceColumnId: card.columnId,
      isDragging: true
    });
  };

  const handleCardDragEnd = () => {
    setDragState({
      draggedCard: null,
      sourceColumnId: null,
      isDragging: false
    });
    setDragOverColumnId(null);
  };

  const handleCardDrop = (targetColumnId: string, targetOrder: number) => {
    if (dragState.draggedCard) {
      controller.moveCard(dragState.draggedCard.id, targetColumnId, targetOrder);
    }
  };

  const handleDeleteColumn = (columnId: string) => {
    if (confirm('Deseja realmente excluir esta coluna e todos os seus cards?')) {
      controller.deleteColumn(columnId);
    }
  };

  return (
    <div className="app">
      <Header
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        onAddColumn={() => setAddColumnModal(true)}
      />

      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLabels={selectedLabels}
        onLabelToggle={handleLabelToggle}
        labels={labels}
        onManageLabels={() => setManageLabelsModal(true)}
      />

      <main className="board-container">
        <div className="board">
          {columns.map(column => (
            <ColumnComponent
              key={column.id}
              column={column}
              cards={getFilteredCards(column.id)}
              labels={labels}
              onAddCard={() => setAddCardModal({ isOpen: true, columnId: column.id })}
              onUpdateCard={(cardId, updates) => controller.updateCard(cardId, updates)}
              onDeleteCard={cardId => {
                if (confirm('Deseja realmente excluir este card?')) {
                  controller.deleteCard(cardId);
                }
              }}
              onUpdateColumn={updates => controller.updateColumn(column.id, updates)}
              onDeleteColumn={() => handleDeleteColumn(column.id)}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardDrop={targetOrder => handleCardDrop(column.id, targetOrder)}
              isDraggingOver={dragState.isDragging && dragOverColumnId === column.id}
            />
          ))}
        </div>
      </main>

      {/* Modals */}
      <AddCardModal
        isOpen={addCardModal.isOpen}
        onClose={() => setAddCardModal({ isOpen: false, columnId: null })}
        onAdd={(title, description) => {
          if (addCardModal.columnId) {
            handleAddCard(addCardModal.columnId, title, description);
          }
        }}
      />

      <AddColumnModal
        isOpen={addColumnModal}
        onClose={() => setAddColumnModal(false)}
        onAdd={handleAddColumn}
      />

      <ManageLabelsModal
        isOpen={manageLabelsModal}
        onClose={() => setManageLabelsModal(false)}
        labels={labels}
        onAddLabel={(name, color) => controller.addLabel(name, color)}
        onUpdateLabel={(id, name) => controller.updateLabel(id, { name })}
        onDeleteLabel={id => {
          if (confirm('Deseja realmente excluir esta label?')) {
            controller.deleteLabel(id);
          }
        }}
      />
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const APP_STYLES = `
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  
  --bg: #f1f5f9;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.1);
  --shadow-lg: rgba(0, 0, 0, 0.15);
  
  --header-bg: #ffffff;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --column-bg: #f8fafc;
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-lg: rgba(0, 0, 0, 0.5);
  
  --header-bg: #1e293b;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --column-bg: #334155;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow-x: hidden;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header Styles */
.header {
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background-color 0.3s ease;
}

.header-content {
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-add-column {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add-column:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-add-column svg {
  width: 20px;
  height: 20px;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.theme-toggle:hover {
  transform: scale(1.05);
  background: var(--primary);
  color: white;
}

.theme-toggle svg {
  width: 20px;
  height: 20px;
}

/* Filter Bar */
.filter-bar {
  background: var(--header-bg);
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.9375rem;
  transition: all 0.2s ease;
}

.search-box input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.label-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.manage-labels-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manage-labels-btn:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.manage-labels-btn svg {
  width: 16px;
  height: 16px;
}

.label-filter {
  padding: 0.5rem 1rem;
  border: 2px solid;
  border-radius: 6px;
  background: transparent;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.label-filter:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px var(--shadow);
}

.label-filter.active {
  font-weight: 600;
}

/* Board Container */
.board-container {
  flex: 1;
  padding: 2rem;
  overflow-x: auto;
  overflow-y: hidden;
}

.board {
  display: flex;
  gap: 1.5rem;
  min-height: calc(100vh - 200px);
  padding-bottom: 2rem;
}

/* Column Styles */
.column {
  flex-shrink: 0;
  width: 320px;
  background: var(--column-bg);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
  transition: all 0.2s ease;
}

.column.drag-over {
  background: rgba(59, 130, 246, 0.1);
  box-shadow: 0 0 0 2px var(--primary);
}

.column-header {
  padding: 1rem 1.25rem;
  border-top: 4px solid;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface);
  gap: 0.5rem;
}

.column-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s ease;
}

.column-title:hover {
  color: var(--primary);
}

.card-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 0.5rem;
  background: var(--bg);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.column-title-input {
  flex: 1;
  padding: 0.5rem;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
}

.column-title-input:focus {
  outline: none;
}

.column-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-add-card,
.btn-delete-column {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-add-card {
  background: var(--primary);
  color: white;
}

.btn-add-card:hover {
  background: var(--primary-dark);
  transform: scale(1.05);
}

.btn-delete-column {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.btn-delete-column:hover {
  background: var(--danger);
  color: white;
  transform: scale(1.05);
}

.btn-add-card svg,
.btn-delete-column svg {
  width: 18px;
  height: 18px;
}

/* Cards Container */
.cards-container {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cards-container::-webkit-scrollbar {
  width: 8px;
}

.cards-container::-webkit-scrollbar-track {
  background: transparent;
}

.cards-container::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.cards-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.empty-column {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
  font-size: 0.875rem;
}

/* Card Styles */
.card {
  background: var(--card-bg);
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 2px 4px var(--shadow);
  cursor: grab;
  transition: all 0.2s ease;
  border: 1px solid var(--border);
}

.card:hover {
  box-shadow: 0 4px 12px var(--shadow-lg);
  transform: translateY(-2px);
}

.card:active {
  cursor: grabbing;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.card-title {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  cursor: text;
  word-break: break-word;
}

.card-title:hover {
  color: var(--primary);
}

.card-title-input {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 2px solid var(--primary);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.9375rem;
  font-weight: 600;
}

.card-title-input:focus {
  outline: none;
}

.card-delete {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.card-delete:hover {
  background: var(--danger);
  color: white;
}

.card-delete svg {
  width: 14px;
  height: 14px;
}

.card-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.card-label {
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.card-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 0.75rem;
  cursor: text;
  min-height: 20px;
  word-break: break-word;
}

.card-description:hover {
  color: var(--text);
}

.card-description-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 0.75rem;
}

.card-description-textarea:focus {
  outline: none;
}

.card-footer {
  display: flex;
  justify-content: flex-start;
}

.btn-add-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add-label:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.btn-add-label svg {
  width: 14px;
  height: 14px;
}

.label-selector {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.label-option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.label-option:hover {
  opacity: 1 !important;
  transform: scale(1.05);
}

.label-option svg {
  width: 14px;
  height: 14px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px var(--shadow-lg);
}

.modal-large {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--danger);
  color: white;
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text);
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 0.9375rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

.color-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}

.color-option {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9375rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

/* Labels Management */
.labels-list {
  padding: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.label-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}

.label-item:hover {
  box-shadow: 0 2px 8px var(--shadow);
}

.label-color-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  flex-shrink: 0;
}

.label-name {
  flex: 1;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
}

.label-name:hover {
  color: var(--primary);
}

.label-edit-input {
  flex: 1;
  padding: 0.375rem 0.75rem;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
}

.label-edit-input:focus {
  outline: none;
}

.btn-delete-label {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-delete-label:hover {
  background: var(--danger);
  color: white;
  transform: scale(1.05);
}

.btn-delete-label svg {
  width: 16px;
  height: 16px;
}

.add-label-form {
  padding: 1.5rem;
  border-top: 1px solid var(--border);
}

.add-label-form h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
  }

  .header h1 {
    font-size: 1.25rem;
  }

  .btn-add-column span {
    display: none;
  }

  .filter-bar {
    padding: 1rem;
  }

  .label-filters {
    width: 100%;
  }

  .board-container {
    padding: 1rem;
  }

  .board {
    gap: 1rem;
  }

  .column {
    width: 280px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card,
.column {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
`;

// ============================================================================
// SSR SETUP & EXPORT
// ============================================================================

// Inject styles into document
if (isClient) {
  const styleId = 'app-styles';
  let styleElement = document.getElementById(styleId);

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = APP_STYLES;
    document.head.appendChild(styleElement);
  }
}

export default App;
