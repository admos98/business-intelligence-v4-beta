import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Unit } from '../../../shared/types';
import { useShoppingStore } from '../../store/useShoppingStore';

interface SmartAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: { name: string; unit: Unit; category: string }) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showSuggestions?: boolean;
  maxSuggestions?: number;
}

const SmartAutocomplete: React.FC<SmartAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'جستجو...',
  className = '',
  autoFocus = false,
  showSuggestions = true,
  maxSuggestions = 8,
}) => {
  const { getSmartItemSuggestions, getItemInfo, getLatestPricePerUnit } = useShoppingStore();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!showSuggestions || !value.trim()) {
      return [];
    }
    return getSmartItemSuggestions(value, maxSuggestions);
  }, [value, getSmartItemSuggestions, maxSuggestions, showSuggestions]);

  useEffect(() => {
    if (value.trim() && suggestions.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [value, suggestions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setHighlightedIndex(-1);
  };

  const handleSelect = (suggestion: typeof suggestions[0]) => {
    onChange(suggestion.name);
    setIsOpen(false);
    if (onSelect) {
      onSelect({
        name: suggestion.name,
        unit: suggestion.unit,
        category: suggestion.category,
      });
    }
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && value.trim()) {
        // Try to find exact match from suggestions
        const exactMatch = suggestions.find((s: { name: string; unit: Unit; category: string }) =>
          s.name.toLowerCase().trim() === value.toLowerCase().trim()
        );
        if (exactMatch && onSelect) {
          onSelect({
            name: exactMatch.name,
            unit: exactMatch.unit,
            category: exactMatch.category,
          });
        } else {
          // Try to get item info for the typed value
          const info = getItemInfo(value.trim());
          if (info && onSelect) {
            onSelect({
              name: value.trim(),
              unit: info.unit,
              category: info.category,
            });
          }
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (suggestions.length > 0) {
          handleSelect(suggestions[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlightedElement = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const latestPrice = useMemo(() => {
    if (!value.trim()) return undefined;
    const info = getItemInfo(value);
    if (info) {
      return getLatestPricePerUnit(value, info.unit);
    }
    return undefined;
  }, [value, getItemInfo, getLatestPricePerUnit]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim() && suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 pr-20 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
        />
        {latestPrice !== undefined && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-secondary bg-surface px-2 py-0.5 rounded z-10">
            {latestPrice.toLocaleString('fa-IR')} ریال
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion: { name: string; unit: Unit; category: string; score: number; reason?: string }, index: number) => {
            const price = getLatestPricePerUnit(suggestion.name, suggestion.unit);
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={`${suggestion.name}-${suggestion.unit}-${index}`}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full text-right px-3 py-2 hover:bg-accent/10 transition-colors border-b border-border last:border-b-0 ${
                  isHighlighted ? 'bg-accent/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-primary text-sm truncate">
                      {suggestion.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-secondary">{suggestion.category}</span>
                      <span className="text-xs text-secondary">•</span>
                      <span className="text-xs text-secondary">{suggestion.unit}</span>
                      {price !== undefined && (
                        <>
                          <span className="text-xs text-secondary">•</span>
                          <span className="text-xs text-accent font-medium">
                            {price.toLocaleString('fa-IR')} ریال
                          </span>
                        </>
                      )}
                    </div>
                    {suggestion.reason && (
                      <div className="text-xs text-secondary/70 mt-0.5 truncate">
                        {suggestion.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`text-xs px-2 py-0.5 rounded ${
                      suggestion.score > 0.8
                        ? 'bg-success/20 text-success'
                        : suggestion.score > 0.6
                          ? 'bg-accent/20 text-accent'
                          : 'bg-secondary/20 text-secondary'
                    }`}>
                      {Math.round(suggestion.score * 100)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmartAutocomplete;
