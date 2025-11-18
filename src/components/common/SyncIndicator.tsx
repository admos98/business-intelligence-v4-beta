import React from 'react';
import { useShoppingStore } from '../../store/useShoppingStore';

const SyncIndicator: React.FC = () => {
  // This would need to be added to the store
  // For now, we'll use a simple implementation
  const isHydrating = useShoppingStore(state => state.isHydrating);

  if (!isHydrating) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in">
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-secondary">در حال همگام‌سازی...</span>
      </div>
    </div>
  );
};

export default SyncIndicator;
