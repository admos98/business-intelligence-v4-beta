import React, { useState } from 'react';
import Button from './Button';
import Card from './Card';

interface FilterOption {
  id: string;
  label: string;
  value: string;
}

interface AdvancedFilterProps {
  title?: string;
  filters: Array<{
    id: string;
    label: string;
    type: 'select' | 'multiselect' | 'date' | 'dateRange' | 'number' | 'numberRange';
    options?: FilterOption[];
    value?: string | number | string[] | [Date, Date] | [number, number];
    onChange: (value: string | number | string[] | [Date, Date] | [number, number] | undefined) => void;
  }>;
  onReset?: () => void;
  onApply?: () => void;
  className?: string;
}

const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  title = 'فیلتر پیشرفته',
  filters,
  onReset,
  onApply,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        }
      >
        فیلتر پیشرفته
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <Card className="absolute top-full mt-2 right-0 z-50 w-80 max-h-96 overflow-y-auto shadow-xl animate-fade-in-down">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h3 className="font-bold text-primary">{title}</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-secondary hover:text-primary transition-colors"
                  aria-label="بستن فیلتر"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {filters.map(filter => (
                  <div key={filter.id}>
                    <label className="text-sm font-medium text-primary block mb-1">
                      {filter.label}
                    </label>
                    {filter.type === 'select' && (
                      <select
                        value={typeof filter.value === 'string' ? filter.value : ''}
                        onChange={(e) => filter.onChange(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">همه</option>
                        {filter.options?.map(opt => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {filter.type === 'multiselect' && (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filter.options?.map(opt => (
                          <label key={opt.id} className="flex items-center gap-2 p-2 bg-background rounded hover:bg-surface cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(filter.value) && filter.value.every(v => typeof v === 'string') ? (filter.value as string[]).includes(opt.value) : false}
                              onChange={(e) => {
                                const current = Array.isArray(filter.value) && filter.value.every(v => typeof v === 'string') ? (filter.value as string[]) : [];
                                const updated: string[] = e.target.checked
                                  ? [...current, opt.value]
                                  : current.filter((v: string) => v !== opt.value);
                                filter.onChange(updated);
                              }}
                              className="form-checkbox h-4 w-4 rounded bg-surface border-border text-accent"
                            />
                            <span className="text-sm text-primary">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {filter.type === 'date' && (
                      <input
                        type="date"
                        value={typeof filter.value === 'string' ? filter.value : ''}
                        onChange={(e) => filter.onChange(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    )}
                    {filter.type === 'number' && (
                      <input
                        type="number"
                        value={typeof filter.value === 'number' ? filter.value : ''}
                        onChange={(e) => filter.onChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                {onReset && (
                  <Button variant="ghost" size="sm" onClick={onReset} fullWidth>
                    پاک کردن
                  </Button>
                )}
                {onApply && (
                  <Button variant="primary" size="sm" onClick={onApply} fullWidth>
                    اعمال
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdvancedFilter;
