import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageActionsContextType {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
}

const PageActionsContext = createContext<PageActionsContextType | undefined>(undefined);

export const PageActionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [actions, setActions] = useState<ReactNode | null>(null);

  return (
    <PageActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </PageActionsContext.Provider>
  );
};

export const usePageActions = () => {
  const context = useContext(PageActionsContext);
  if (!context) {
    throw new Error('usePageActions must be used within PageActionsProvider');
  }
  return context;
};
