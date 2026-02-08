import React, { useState, useEffect, useRef, type DragEvent } from 'react';
import { Search, Plus, X, Tag, Moon, Sun, Filter, Edit2, Trash2, GripVertical } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
interface Label {
  id: string;
  name: string;
  color: string;
}

interface Card {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  createdAt: number;
}

interface Column {
  id: string;
  title: string;
  cardIds: string[];
}

interface BoardState {
  columns: Column[];
  cards: Record<string, Card>;
  labels: Label[];
}

// ============================================================================
// STORAGE SERVICE (Persistence Layer)
// ============================================================================
const isClient = typeof window !== 'undefined';

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'darkMode',
    BOARD_STATE: 'kanbanBoardState',
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
   * Get storage keys
   */
  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ============================================================================
// MODEL (Business Logic & Data)
// ============================================================================
class KanbanModel {
  /**
   * Generate unique ID
   */
  static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create default board state
   */
  static getDefaultBoardState(): BoardState {
    const defaultLabels: Label[] = [
      { id: 'label-1', name: 'Bug', color: '#ef4444' },
      { id: 'label-2', name: 'Feature', color: '#3b82f6' },
      { id: 'label-3', name: 'Enhancement', color: '#8b5cf6' },
      { id: 'label-4', name: 'Documentation', color: '#10b981' },
      { id: 'label-5', name: 'Design', color: '#f59e0b' },
    ];

    const sampleCards: Card[] = [
      {
        id: 'card-1',
        title: 'Setup project structure',
        description: 'Initialize React + TypeScript + Vite',
        labelIds: ['label-2'],
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'card-2',
        title: 'Implement drag and drop',
        description: 'Add DnD functionality for cards',
        labelIds: ['label-2', 'label-3'],
        createdAt: Date.now() - 7200000,
      },
      {
        id: 'card-3',
        title: 'Fix styling issues',
        description: 'Resolve responsive layout problems',
        labelIds: ['label-1'],
        createdAt: Date.now() - 1800000,
      },
    ];

    return {
      columns: [
        { id: 'col-1', title: 'To Do', cardIds: ['card-1'] },
        { id: 'col-2', title: 'In Progress', cardIds: ['card-2'] },
        { id: 'col-3', title: 'Review', cardIds: [] },
        { id: 'col-4', title: 'Done', cardIds: ['card-3'] },
      ],
      cards: sampleCards.reduce((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {} as Record<string, Card>),
      labels: defaultLabels,
    };
  }

  /**
   * Filter cards by search query and selected labels
   */
  static filterCards(
    cards: Card[],
    searchQuery: string,
    selectedLabelIds: string[]
  ): Card[] {
    return cards.filter((card) => {
      const matchesSearch =
        !searchQuery ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLabels =
        selectedLabelIds.length === 0 ||
        selectedLabelIds.some((labelId) => card.labelIds.includes(labelId));

      return matchesSearch && matchesLabels;
    });
  }
}

// ============================================================================
// CONTROLLER (State Management & Business Logic)
// ============================================================================
class KanbanController {
  private setState: React.Dispatch<React.SetStateAction<BoardState>>;

  constructor(setState: React.Dispatch<React.SetStateAction<BoardState>>) {
    this.setState = setState;
  }

  /**
   * Load dark mode from storage
   */
  static loadDarkMode(): boolean {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  }

  /**
   * Save dark mode to storage
   */
  static saveDarkMode(value: boolean): void {
    StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, value);
  }

  /**
   * Load board state from storage
   */
  static loadBoardState(): BoardState {
    return StorageService.loadFromStorage(
      StorageService.getKeys().BOARD_STATE,
      KanbanModel.getDefaultBoardState()
    );
  }

  /**
   * Add new column
   */
  addColumn(title: string): void {
    this.setState((prev) => {
      const newColumn: Column = {
        id: KanbanModel.generateId(),
        title,
        cardIds: [],
      };
      const newState = {
        ...prev,
        columns: [...prev.columns, newColumn],
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Update column title
   */
  updateColumnTitle(columnId: string, newTitle: string): void {
    this.setState((prev) => {
      const newState = {
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, title: newTitle } : col
        ),
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Delete column and its cards
   */
  deleteColumn(columnId: string): void {
    this.setState((prev) => {
      const column = prev.columns.find((c) => c.id === columnId);
      if (!column) return prev;

      const newCards = { ...prev.cards };
      column.cardIds.forEach((cardId) => delete newCards[cardId]);

      const newState = {
        ...prev,
        columns: prev.columns.filter((col) => col.id !== columnId),
        cards: newCards,
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Add new card to column
   */
  addCard(columnId: string, title: string, description: string, labelIds: string[]): void {
    this.setState((prev) => {
      const newCard: Card = {
        id: KanbanModel.generateId(),
        title,
        description,
        labelIds,
        createdAt: Date.now(),
      };

      const newState = {
        ...prev,
        cards: { ...prev.cards, [newCard.id]: newCard },
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, cardIds: [...col.cardIds, newCard.id] } : col
        ),
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Update card
   */
  updateCard(cardId: string, updates: Partial<Card>): void {
    this.setState((prev) => {
      const newState = {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], ...updates },
        },
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Delete card
   */
  deleteCard(cardId: string): void {
    this.setState((prev) => {
      const newCards = { ...prev.cards };
      delete newCards[cardId];

      const newState = {
        ...prev,
        cards: newCards,
        columns: prev.columns.map((col) => ({
          ...col,
          cardIds: col.cardIds.filter((id) => id !== cardId),
        })),
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Move card between columns or reorder within column
   */
  moveCard(cardId: string, sourceColId: string, destColId: string, destIndex: number): void {
    this.setState((prev) => {
      const newColumns = prev.columns.map((col) => {
        if (col.id === sourceColId) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === destColId) {
          const newCardIds = [...col.cardIds];
          newCardIds.splice(destIndex, 0, cardId);
          return { ...col, cardIds: newCardIds };
        }
        return col;
      });

      const newState = { ...prev, columns: newColumns };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }

  /**
   * Add new label
   */
  addLabel(name: string, color: string): void {
    this.setState((prev) => {
      const newLabel: Label = {
        id: KanbanModel.generateId(),
        name,
        color,
      };

      const newState = {
        ...prev,
        labels: [...prev.labels, newLabel],
      };
      StorageService.saveToStorage(StorageService.getKeys().BOARD_STATE, newState);
      return newState;
    });
  }
}

// ============================================================================
// VIEW COMPONENTS (UI Layer)
// ============================================================================
/**
 * Main Kanban Board Component with SSR support
 */
// Substitua o componente principal App() por esta versão corrigida:

export default function App() {
  const [boardState, setBoardState] = useState<BoardState>({
    columns: [],
    cards: {},
    labels: [],
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Criar controller com useMemo para garantir instância estável
  const controller = React.useMemo(() => new KanbanController(setBoardState), []);

  // Hydration effect - load data only on client-side
  useEffect(() => {
    setBoardState(KanbanController.loadBoardState());
    setIsDarkMode(KanbanController.loadDarkMode());
    setIsHydrated(true);
  }, []);

  // Dark mode toggle
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      KanbanController.saveDarkMode(newValue);
      return newValue;
    });
  };

  // Toggle label filter
  const toggleLabelFilter = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  useEffect(() => {
    if (!isClient) return;
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      <style>{APP_STYLES}</style>

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Kanban Board</h1>
            <span className="board-subtitle">Organize your workflow</span>
          </div>
          <div className="header-actions">
            {/* Search */}
            <div className="search-container">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`filter-button ${showFilters ? 'active' : ''}`}
            >
              <Filter size={18} />
            </button>
            {/* Dark Mode Toggle */}
            <button onClick={toggleDarkMode} className="theme-toggle" aria-label="Toggle theme">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        {/* Filter Panel */}
        {showFilters && (
          <div className="filter-panel">
            <h3 className="filter-title">Filter by Labels</h3>
            <div className="label-filters">
              {boardState.labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => toggleLabelFilter(label.id)}
                  className={`label-filter ${selectedLabelIds.includes(label.id) ? 'active' : ''}`}
                  style={{
                    '--label-color': label.color,
                  } as React.CSSProperties}
                >
                  <Tag size={14} />
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Kanban Board */}
      <main className="board-container">
        <div className="columns-wrapper">
          {boardState.columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              cards={column.cardIds.map((id) => boardState.cards[id]).filter(Boolean)}
              labels={boardState.labels}
              controller={controller}
              searchQuery={searchQuery}
              selectedLabelIds={selectedLabelIds}
            />
          ))}
          {/* Add Column Button */}
          <AddColumnButton controller={controller} />
        </div>
      </main>
    </div>
  );
}

/**
 * Column Component
 */
function ColumnView({
  column,
  cards,
  labels,
  controller,
  searchQuery,
  selectedLabelIds,
}: {
  column: Column;
  cards: Card[];
  labels: Label[];
  controller: KanbanController;
  searchQuery: string;
  selectedLabelIds: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [showAddCard, setShowAddCard] = useState(false);
  const [draggedOver, setDraggedOver] = useState(false);

  const filteredCards = KanbanModel.filterCards(cards, searchQuery, selectedLabelIds);

  const handleTitleSubmit = () => {
    if (title.trim()) {
      controller.updateColumnTitle(column.id, title.trim());
    }
    setIsEditing(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDraggedOver(true);
  };

  const handleDragLeave = () => {
    setDraggedOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDraggedOver(false);

    const cardId = e.dataTransfer.getData('cardId');
    const sourceColId = e.dataTransfer.getData('sourceColId');

    if (cardId && sourceColId) {
      controller.moveCard(cardId, sourceColId, column.id, filteredCards.length);
    }
  };

  return (
    <div className="column">
      <div className="column-header">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyPress={(e) => e.key === 'Enter' && handleTitleSubmit()}
            className="column-title-input"
            autoFocus
          />
        ) : (
          <h2 className="column-title" onClick={() => setIsEditing(true)}>
            {column.title}
            <span className="card-count">{filteredCards.length}</span>
          </h2>
        )}
        <button
          onClick={() => controller.deleteColumn(column.id)}
          className="column-delete"
          aria-label="Delete column"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div
        className={`cards-container ${draggedOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {filteredCards.map((card, index) => (
          <CardView
            key={card.id}
            card={card}
            labels={labels}
            controller={controller}
            columnId={column.id}
            index={index}
          />
        ))}
        {filteredCards.length === 0 && (
          <div className="empty-column">
            <p>No cards yet</p>
          </div>
        )}
      </div>
      {showAddCard ? (
        <AddCardForm
          columnId={column.id}
          labels={labels}
          controller={controller}
          onCancel={() => setShowAddCard(false)}
        />
      ) : (
        <button onClick={() => setShowAddCard(true)} className="add-card-button">
          <Plus size={16} />
          Add Card
        </button>
      )}
    </div>
  );
}

/**
 * Card Component with Drag and Drop
 */
function CardView({
  card,
  labels,
  controller,
  columnId,
  index,
}: {
  card: Card;
  labels: Label[];
  controller: KanbanController;
  columnId: string;
  index: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [selectedLabels, setSelectedLabels] = useState(card.labelIds);

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('sourceColId', columnId);
  };

  const handleSave = () => {
    controller.updateCard(card.id, {
      title: title.trim() || 'Untitled',
      description: description.trim(),
      labelIds: selectedLabels,
    });
    setIsEditing(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  if (isEditing) {
    return (
      <div className="card editing">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="card-edit-title"
          placeholder="Card title"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="card-edit-description"
          placeholder="Description"
          rows={3}
        />
        <div className="card-labels-edit">
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => toggleLabel(label.id)}
              className={`label-tag ${selectedLabels.includes(label.id) ? 'selected' : ''}`}
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </button>
          ))}
        </div>
        <div className="card-edit-actions">
          <button onClick={handleSave} className="btn-save">
            Save
          </button>
          <button onClick={() => setIsEditing(false)} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" draggable onDragStart={handleDragStart}>
      <div className="card-header">
        <GripVertical size={14} className="drag-handle" />
        <div className="card-actions">
          <button onClick={() => setIsEditing(true)} className="card-action">
            <Edit2 size={14} />
          </button>
          <button onClick={() => controller.deleteCard(card.id)} className="card-action">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <h3 className="card-title">{card.title}</h3>
      {card.description && <p className="card-description">{card.description}</p>}
      {card.labelIds.length > 0 && (
        <div className="card-labels">
          {card.labelIds.map((labelId) => {
            const label = labels.find((l) => l.id === labelId);
            return label ? (
              <span key={labelId} className="label-tag" style={{ backgroundColor: label.color }}>
                {label.name}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Add Card Form Component
 */
function AddCardForm({
  columnId,
  labels,
  controller,
  onCancel,
}: {
  columnId: string;
  labels: Label[];
  controller: KanbanController;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const handleSubmit = () => {
    if (title.trim()) {
      controller.addCard(columnId, title.trim(), description.trim(), selectedLabels);
      setTitle('');
      setDescription('');
      setSelectedLabels([]);
      onCancel();
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <div className="add-card-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title"
        className="form-input"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="form-textarea"
        rows={2}
      />
      <div className="form-labels">
        {labels.map((label) => (
          <button
            key={label.id}
            onClick={() => toggleLabel(label.id)}
            className={`label-tag ${selectedLabels.includes(label.id) ? 'selected' : ''}`}
            style={{ backgroundColor: label.color }}
          >
            {label.name}
          </button>
        ))}
      </div>
      <div className="form-actions">
        <button onClick={handleSubmit} className="btn-primary">
          Add Card
        </button>
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Add Column Button Component
 */
function AddColumnButton({ controller }: { controller: KanbanController }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    if (title.trim()) {
      controller.addColumn(title.trim());
      setTitle('');
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <div className="add-column-form">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSubmit}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Column name"
          className="column-name-input"
          autoFocus
        />
      </div>
    );
  }

  return (
    <button onClick={() => setIsAdding(true)} className="add-column-button">
      <Plus size={20} />
      Add Column
    </button>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const APP_STYLES = `
  /* Global Styles */
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap');
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :root {
    /* Light Theme */
    --bg-primary: #fafbfc;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f5f6f8;
    --text-primary: #1a1d1f;
    --text-secondary: #6f767e;
    --text-tertiary: #9a9fa5;
    --border-color: #e8eaed;
    --accent-primary: #2563eb;
    --accent-hover: #1d4ed8;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
    --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.12);
    --danger: #ef4444;
    --success: #10b981;
  }
  .dark {
    --bg-primary: #0d0f11;
    --bg-secondary: #17191c;
    --bg-tertiary: #1f2226;
    --text-primary: #f5f6f8;
    --text-secondary: #9a9fa5;
    --text-tertiary: #6f767e;
    --border-color: #2a2d32;
    --accent-primary: #3b82f6;
    --accent-hover: #2563eb;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* Header Styles */
  .app-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
  }
  .header-content {
    max-width: 1600px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .app-title {
    font-family: 'Space Mono', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .board-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .search-container {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 0.875rem;
    color: var(--text-tertiary);
    pointer-events: none;
  }
  .search-input {
    padding: 0.625rem 1rem 0.625rem 2.5rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.75rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 0.9375rem;
    width: 280px;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
  }
  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    background: var(--bg-secondary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  .filter-button {
    padding: 0.625rem 0.875rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.75rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  .filter-button:hover {
    background: var(--bg-secondary);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  .filter-button.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
  }
  .theme-toggle {
    padding: 0.625rem 0.875rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.75rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  .theme-toggle:hover {
    background: var(--bg-secondary);
    transform: rotate(15deg) scale(1.05);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  /* Filter Panel */
  .filter-panel {
    max-width: 1600px;
    margin: 1.5rem auto 0;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  .filter-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .label-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .label-filter {
    padding: 0.5rem 1rem;
    border: 2px solid transparent;
    border-radius: 0.625rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
    overflow: hidden;
  }
  .label-filter::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--label-color);
    transition: width 0.2s ease;
  }
  .label-filter:hover {
    background: var(--bg-secondary);
    transform: translateY(-2px);
  }
  .label-filter.active {
    background: var(--label-color);
    color: white;
    border-color: var(--label-color);
  }
  .label-filter.active::before {
    width: 100%;
  }
  /* Board Container */
  .board-container {
    flex: 1;
    padding: 2rem;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .columns-wrapper {
    display: flex;
    gap: 1.5rem;
    min-height: calc(100vh - 200px);
    max-width: 1600px;
    margin: 0 auto;
  }
  /* Column Styles */
  .column {
    flex: 0 0 320px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 220px);
    box-shadow: var(--shadow-sm);
    transition: all 0.3s ease;
  }
  .column:hover {
    box-shadow: var(--shadow-md);
  }
  .column-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-tertiary);
    border-radius: 1rem 1rem 0 0;
  }
  .column-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Space Mono', monospace;
    letter-spacing: -0.01em;
  }
  .card-count {
    font-size: 0.75rem;
    background: var(--accent-primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-weight: 600;
  }
  .column-title-input {
    flex: 1;
    padding: 0.5rem;
    border: 2px solid var(--accent-primary);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 700;
    font-family: 'Space Mono', monospace;
  }
  .column-delete {
    padding: 0.375rem;
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  .column-delete:hover {
    background: var(--danger);
    color: white;
  }
  .cards-container {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: background 0.2s ease;
  }
  .cards-container.drag-over {
    background: rgba(37, 99, 235, 0.05);
  }
  .empty-column {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 0.875rem;
  }
  /* Card Styles */
  .card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: grab;
    transition: all 0.2s ease;
    position: relative;
  }
  .card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: var(--accent-primary);
  }
  .card:active {
    cursor: grabbing;
  }
  .card.editing {
    cursor: default;
    border-color: var(--accent-primary);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .drag-handle {
    color: var(--text-tertiary);
    cursor: grab;
  }
  .card-actions {
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .card:hover .card-actions {
    opacity: 1;
  }
  .card-action {
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  .card-action:hover {
    background: var(--bg-tertiary);
    color: var(--accent-primary);
  }
  .card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }
  .card-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }
  .card-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.75rem;
  }
  .label-tag {
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  .label-tag:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-sm);
  }
  .label-tag.selected {
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px currentColor;
  }
  /* Card Edit Styles */
  .card-edit-title {
    width: 100%;
    padding: 0.625rem;
    border: 2px solid var(--accent-primary);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    font-family: 'DM Sans', sans-serif;
  }
  .card-edit-description {
    width: 100%;
    padding: 0.625rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    resize: vertical;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.5;
  }
  .card-labels-edit {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }
  .card-edit-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-save {
    flex: 1;
    padding: 0.625rem;
    background: var(--accent-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }
  .btn-save:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  .btn-cancel {
    flex: 1;
    padding: 0.625rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1.5px solid var(--border-color);
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }
  .btn-cancel:hover {
    background: var(--bg-secondary);
    border-color: var(--text-tertiary);
  }
  /* Add Card Form */
  .add-card-form {
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: 0.75rem;
    margin: 0 1rem 1rem;
  }
  .form-input {
    width: 100%;
    padding: 0.625rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9375rem;
    margin-bottom: 0.625rem;
    font-family: 'DM Sans', sans-serif;
  }
  .form-input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  .form-textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1.5px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    margin-bottom: 0.625rem;
    resize: vertical;
    font-family: 'DM Sans', sans-serif;
  }
  .form-textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  .form-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }
  .form-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-primary {
    flex: 1;
    padding: 0.625rem;
    background: var(--accent-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }
  .btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  .btn-secondary {
    flex: 1;
    padding: 0.625rem;
    background: transparent;
    color: var(--text-primary);
    border: 1.5px solid var(--border-color);
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }
  .btn-secondary:hover {
    background: var(--bg-secondary);
  }
  .add-card-button {
    width: calc(100% - 2rem);
    margin: 0 1rem 1rem;
    padding: 0.75rem;
    background: transparent;
    color: var(--text-secondary);
    border: 2px dashed var(--border-color);
    border-radius: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  .add-card-button:hover {
    background: var(--bg-tertiary);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  /* Add Column */
  .add-column-button {
    flex: 0 0 280px;
    background: transparent;
    border: 2px dashed var(--border-color);
    border-radius: 1rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    font-weight: 600;
    font-size: 0.9375rem;
    min-height: 120px;
  }
  .add-column-button:hover {
    background: var(--bg-tertiary);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  .add-column-form {
    flex: 0 0 280px;
    background: var(--bg-secondary);
    border: 2px solid var(--accent-primary);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }
  .column-name-input {
    width: 100%;
    padding: 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 700;
    text-align: center;
    font-family: 'Space Mono', monospace;
  }
  .column-name-input:focus {
    outline: none;
  }
  /* Scrollbar Styles */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
    transition: background 0.2s ease;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
  }
  /* Animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .column, .card {
    animation: slideIn 0.3s ease-out;
  }
  /* Responsive Design */
  @media (max-width: 1024px) {
    .board-container {
      padding: 1rem;
    }
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }
    .search-input {
      width: 100%;
    }
    .columns-wrapper {
      flex-direction: column;
    }
    .column {
      flex: 1 1 auto;
      max-height: none;
    }
    .add-column-button {
      flex: 1 1 auto;
    }
  }
`;
