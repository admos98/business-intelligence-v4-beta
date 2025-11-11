import React, { useState, useMemo, useEffect, useRef } from 'react';
import { t } from '../translations.ts';
import { useShoppingStore } from '../store/useShoppingStore.ts';
import Header from '../components/common/Header.tsx';
import { MasterItem } from '../types.ts';
import EditItemMasterModal from '../components/modals/EditItemMasterModal.tsx';
import { useToast } from '../components/common/Toast.tsx';
import CurrencyDisplay from '../components/common/CurrencyDisplay.tsx';
import { toJalaliDateString } from '../lib/jalali.ts';
import Card from '../components/common/Card.tsx';
import SkeletonLoader from '../components/common/SkeletonLoader.tsx';
import { Chart } from 'chart.js/auto';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;

  const width = 100;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 2) + 1; // Add padding
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const ItemTrendModal: React.FC<{ item: MasterItem, onClose: () => void }> = ({ item, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { getItemPriceHistory } = useShoppingStore();
  const [history, setHistory] = useState<{ date: string, pricePerUnit: number }[]>([]);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(true);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any | null>(null);

  useEffect(() => { setIsOpen(true); }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  // --- THIS IS THE CORRECTED SECTION ---
  useEffect(() => {
    const priceHistory = getItemPriceHistory(item.name, item.unit);
    setHistory(priceHistory);

    if (priceHistory.length > 1) {
        setIsAiLoading(true);

        const fetchAiInsight = async () => {
          try {
            const response = await fetch('/api/gemini', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                task: 'analyzePriceTrend', // Specify the task for your API router
                payload: {
                  itemName: item.name,
                  priceHistory: priceHistory,
                }
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.details || `Server error: ${response.statusText}`);
            }

            const result = await response.json();
            // Your API returns the result in the 'data' property
            setAiInsight(result.data);

          } catch (error) {
            console.error("Failed to fetch AI insight:", error);
            setAiInsight(t.aiError);
          } finally {
            setIsAiLoading(false);
          }
        };

        fetchAiInsight();

    } else {
        setAiInsight(t.notEnoughDataForTrend);
        setIsAiLoading(false);
    }
  }, [item, getItemPriceHistory]);
  // --- END OF CORRECTED SECTION ---

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();
    if (chartRef.current && history.length > 0) {
      const styles = getComputedStyle(document.documentElement);
      const accentColor = styles.getPropertyValue('--color-accent').trim();
      const accentSoftColor = styles.getPropertyValue('--color-accent-soft').trim();

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: history.map(p => toJalaliDateString(p.date)),
              datasets: [{
                  label: t.pricePerUnitLabel,
                  data: history.map(p => p.pricePerUnit),
                  borderColor: accentColor,
                  backgroundColor: accentSoftColor,
                  fill: true,
                  tension: 0.2,
                  pointBackgroundColor: accentColor,
                  pointRadius: history.length < 20 ? 4 : 0,
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: { x: { ticks: { font: { family: "'Vazirmatn', sans-serif" }}}, y: { ticks: { font: { family: "'Vazirmatn', sans-serif" }}} },
              plugins: { legend: { display: false } }
            }
        });
      }
    }
  }, [history]);

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-surface p-6 rounded-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        <h2 className="text-xl font-bold text-primary mb-4 flex-shrink-0">{t.priceTrendFor(item.name)}</h2>
        <div className="flex-grow min-h-0 space-y-4 overflow-y-auto">
          <div className="h-[250px] bg-background p-2 rounded-lg">
            <canvas ref={chartRef}></canvas>
          </div>
          <Card title={t.aiAnalystInsight}>
            {isAiLoading ? <SkeletonLoader lines={3} /> : <p className="text-primary whitespace-pre-wrap leading-relaxed">{aiInsight}</p>}
          </Card>
        </div>
         <div className="mt-6 flex justify-end flex-shrink-0">
            <button onClick={handleClose} className="px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity">
              {t.close}
            </button>
          </div>
      </div>
    </div>
  );
};


interface ItemsDashboardProps {
  onBack: () => void;
  onLogout: () => void;
}

const ItemsDashboard: React.FC<ItemsDashboardProps> = ({ onBack, onLogout,}) => {
  const { getAllKnownItems, getItemPriceHistory } = useShoppingStore();
  const [modalState, setModalState] = useState<{ open: boolean; item?: MasterItem }>({ open: false });
  const [analyzedItem, setAnalyzedItem] = useState<MasterItem | null>(null);
  const { addToast } = useToast();

  const allItems = useMemo(() => getAllKnownItems(), [getAllKnownItems]);

  const handleExportJson = () => {
    if (allItems.length === 0) return;

    const dataString = JSON.stringify(allItems, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mehrnoosh_cafe_items_master_list.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t.exportJsonSuccess, 'success');
  };

  return (
    <>
      <Header title={t.itemsDashboardTitle} onBack={onBack} backText={t.backToDashboard} onLogout={onLogout}>
        <button
          onClick={handleExportJson}
          disabled={allItems.length === 0}
          className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed mr-2"
        >
          {t.exportJson}
        </button>
      </Header>
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {allItems.length === 0 ? (
          <div className="text-center py-16 px-6 bg-surface rounded-xl border border-border shadow-card">
            <p className="text-secondary text-lg">{t.noItemsYet}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allItems.map(item => {
                const priceHistory = getItemPriceHistory(item.name, item.unit);
                return (
                  <div key={`${item.name}-${item.unit}`} className="bg-surface rounded-xl border border-border shadow-card flex flex-col">
                    <div className="p-5 flex-grow">
                      <h2 className="text-lg font-bold text-primary mb-1">{item.name}</h2>
                      <p className="text-sm text-secondary mb-3">{item.category} / {item.unit}</p>

                       <div className="space-y-3 border-t border-border pt-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-secondary">{t.lastPrice}:</span>
                                <CurrencyDisplay value={item.lastPricePerUnit} className="font-semibold text-primary" />
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-secondary">{t.totalQuantity}:</span>
                                <span className="font-semibold text-primary">{item.totalQuantity.toLocaleString('fa-IR')} {item.unit}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-secondary">{t.totalSpend}:</span>
                                 <CurrencyDisplay value={item.totalSpend} className="font-semibold text-accent" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-secondary">{t.totalPurchases}:</span>
                                <span className="font-semibold text-primary">{item.purchaseCount.toLocaleString('fa-IR')}</span>
                            </div>
                       </div>

                        <div className="mt-4 pt-4 border-t border-border">
                          <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">{t.priceTrend}</h4>
                          <div className="h-8">
                            {priceHistory.length > 1 ? (
                              <Sparkline data={priceHistory.map(p => p.pricePerUnit)} />
                            ) : (
                              <div className="h-full flex items-center justify-center bg-background rounded-md">
                                <p className="text-xs text-secondary">{t.notEnoughDataForTrend}</p>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                    <div className="p-2 border-t border-border flex justify-end gap-2 items-center">
                        {priceHistory.length > 1 && (
                            <button onClick={() => setAnalyzedItem(item)} className="px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded-md font-medium">{t.analyzeTrend}</button>
                        )}
                        <button onClick={() => setModalState({ open: true, item })} className="p-1.5 text-secondary hover:text-primary"><EditIcon/></button>
                    </div>
                  </div>
                )
            })}
          </div>
        )}
      </main>
      {modalState.open && (
        <EditItemMasterModal
          itemToEdit={modalState.item!}
          onClose={() => setModalState({ open: false })}
        />
      )}
      {analyzedItem && (
        <ItemTrendModal
            item={analyzedItem}
            onClose={() => setAnalyzedItem(null)}
        />
      )}
    </>
  );
};

export default ItemsDashboard;
