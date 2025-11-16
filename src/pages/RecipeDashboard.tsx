import React, { useState, useMemo } from 'react';
import { Recipe, RecipeIngredient, Unit } from '../../shared/types';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';

import { useToast } from '../components/common/Toast';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';

interface RecipeDashboardProps {
  onLogout: () => void;
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

interface RecipeFormData {
  name: string;
  category: string;
  baseSellPrice: number;
  ingredients: RecipeIngredient[];
  prepNotes: string;
}

const RecipeDashboard: React.FC<RecipeDashboardProps> = ({ onLogout }) => {
  const store = useShoppingStore();
  const { recipes, addRecipe, updateRecipe, deleteRecipe, getKnownItemNames, allCategories } = store;

  const [showNewRecipeForm, setShowNewRecipeForm] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RecipeFormData>({
    name: '',
    category: '',
    baseSellPrice: 0,
    ingredients: [],
    prepNotes: '',
  });
  const { addToast } = useToast();

  const knownItems = useMemo(() => {
    const items = getKnownItemNames();
    return items;
  }, [getKnownItemNames]);

  const handleAddRecipe = () => {
    if (!formData.name || !formData.category || formData.baseSellPrice <= 0 || formData.ingredients.length === 0) {
      addToast('لطفاً تمام فیلدها را پر کنید و حداقل یک ماده افزودن کنید', 'error');
      return;
    }

    if (editingRecipeId) {
      updateRecipe(editingRecipeId, {
        ...formData,
        ingredients: formData.ingredients.map(ing => ({
          ...ing,
          id: ing.id || `ingredient-${Date.now()}`,
        })),
      });
      addToast('دستور پخت به‌روز شد', 'success');
    } else {
      addRecipe({
        ...formData,
        ingredients: formData.ingredients.map(ing => ({
          ...ing,
          id: `ingredient-${Date.now()}-${Math.random()}`,
        })),
      });
      addToast('دستور پخت جدید اضافه شد', 'success');
    }

    setFormData({ name: '', category: '', baseSellPrice: 0, ingredients: [], prepNotes: '' });
    setShowNewRecipeForm(false);
    setEditingRecipeId(null);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setFormData({
      name: recipe.name,
      category: recipe.category,
      baseSellPrice: recipe.baseSellPrice,
      ingredients: recipe.ingredients,
      prepNotes: recipe.prepNotes || '',
    });
    setEditingRecipeId(recipe.id);
    setShowNewRecipeForm(true);
  };

  const handleDeleteRecipe = (recipeId: string) => {
    deleteRecipe(recipeId);
    addToast('دستور پخت حذف شد', 'info');
  };

  const handleAddIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        id: `ingredient-${Date.now()}`,
        itemName: '',
        itemUnit: Unit.Piece,
        requiredQuantity: 1,
      }],
    }));
  };

  const handleUpdateIngredient = (index: number, updates: Partial<RecipeIngredient>) => {
    setFormData(prev => {
      const newIngredients = [...prev.ingredients];
      newIngredients[index] = { ...newIngredients[index], ...updates };
      return { ...prev, ingredients: newIngredients };
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const categories = allCategories();

  const handlePrintRecipes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('دسترسی به چاپ رد شد', 'error');
      return;
    }

    const recipesHtml = recipes.map(recipe => `
      <div style="page-break-inside: avoid; margin-bottom: 2rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px;">
        <h2 style="margin: 0; color: #333;">${recipe.name}</h2>
        <p style="margin: 0.25rem 0; color: #666; font-size: 0.9rem;"><strong>دسته:</strong> ${recipe.category}</p>
        <p style="margin: 0.25rem 0; color: #666; font-size: 0.9rem;"><strong>قیمت فروش:</strong> ${recipe.baseSellPrice.toLocaleString()}</p>
        <h3 style="margin: 1rem 0 0.5rem 0; font-size: 1rem;">مواد:</h3>
        <ul style="margin: 0; padding-right: 1.5rem;">
          ${recipe.ingredients.map(ing => `<li>${ing.itemName} - ${ing.requiredQuantity} ${ing.itemUnit}</li>`).join('')}
        </ul>
        ${recipe.prepNotes ? `<p style="margin-top: 0.5rem; color: #666;"><strong>توضیحات:</strong> ${recipe.prepNotes}</p>` : ''}
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>دستورات پخت</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; margin: 2rem; }
          h1 { text-align: center; color: #333; }
        </style>
      </head>
      <body>
        <h1>دستورات پخت کافه</h1>
        ${recipesHtml}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportRecipesJson = () => {
    const dataString = JSON.stringify(recipes, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('دستورات با موفقیت صادر شدند', 'success');
  };

  const handleExportRecipesCsv = () => {
    if (!recipes || recipes.length === 0) {
      addToast('هیچ دستوری برای صادر کردن وجود ندارد', 'info');
      return;
    }
    const headers = ['id', 'name', 'category', 'baseSellPrice', 'ingredients', 'prepNotes'];
    const rows = recipes.map(r => {
      const ingStr = r.ingredients.map(ing => `${ing.itemName} (${ing.requiredQuantity} ${ing.itemUnit})`).join(' | ');
      const safePrep = (r.prepNotes || '').replace(/\n/g, ' ');
      return [r.id, r.name, r.category, String(r.baseSellPrice), `"${ingStr}"`, `"${safePrep}"`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV دستور پخت صادر شد', 'success');
  };

  return (
    <>
      <Header title="مدیریت دستور پخت‌ها" onLogout={onLogout}>
        <button onClick={handleExportRecipesCsv} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن CSV
        </button>
        <button onClick={handleExportRecipesJson} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن JSON
        </button>
        <button onClick={handlePrintRecipes} className="px-3 py-1.5 text-sm bg-primary text-background font-medium rounded-lg hover:opacity-90 transition-opacity">
          چاپ
        </button>
      </Header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">دستور پخت‌های تعریف شده</h1>
          <button
            onClick={() => {
              setFormData({ name: '', category: '', baseSellPrice: 0, ingredients: [], prepNotes: '' });
              setEditingRecipeId(null);
              setShowNewRecipeForm(!showNewRecipeForm);
            }}
            className="px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <PlusIcon />
            دستور جدید
          </button>
        </div>

        {/* NEW/EDIT RECIPE FORM */}
        {showNewRecipeForm && (
          <Card title={editingRecipeId ? 'ویرایش دستور پخت' : 'افزودن دستور پخت جدید'}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">نام دستور</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثلاً قهوه اسپرسو"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">دسته‌بندی</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">انتخاب دسته‌بندی</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">قیمت فروش (ریال)</label>
                  <input
                    type="number"
                    value={formData.baseSellPrice || ''}
                    onChange={(e) => setFormData({ ...formData, baseSellPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">هزینه تخمینی</label>
                  <div className="px-3 py-2 bg-background border border-border rounded-lg text-secondary">
                    <CurrencyDisplay value={formData.ingredients.reduce((sum, ing) => sum + (ing.costPerUnit || 0) * ing.requiredQuantity, 0)} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-primary block mb-1">توضیحات تهیه</label>
                <textarea
                  value={formData.prepNotes}
                  onChange={(e) => setFormData({ ...formData, prepNotes: e.target.value })}
                  placeholder="توضیحات مراحل تهیه..."
                  rows={3}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* INGREDIENTS */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-primary">مواد اولیه</h3>
                  <button
                    onClick={handleAddIngredient}
                    className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-sm hover:bg-accent/20 transition-colors flex items-center gap-1"
                  >
                    <PlusIcon />
                    افزودن ماده
                  </button>
                </div>

                {formData.ingredients.length === 0 ? (
                  <p className="text-center text-secondary text-sm py-4">هیچ ماده‌ای افزودن نشده است</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {formData.ingredients.map((ing, idx) => (
                      <div key={idx} className="p-3 bg-background border border-border rounded-lg space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs font-medium text-secondary block mb-1">نام ماده</label>
                            <select
                              value={ing.itemName}
                              onChange={(e) => handleUpdateIngredient(idx, { itemName: e.target.value })}
                              className="w-full px-2 py-1 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">انتخاب ماده</option>
                              {knownItems.map(item => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-secondary block mb-1">واحد</label>
                            <select
                              value={ing.itemUnit}
                              onChange={(e) => handleUpdateIngredient(idx, { itemUnit: e.target.value as Unit })}
                              className="w-full px-2 py-1 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              {Object.values(Unit).map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-secondary block mb-1">مقدار مورد نیاز</label>
                            <input
                              type="number"
                              value={ing.requiredQuantity || ''}
                              onChange={(e) => handleUpdateIngredient(idx, { requiredQuantity: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-danger text-sm hover:text-danger/80 transition-colors"
                          >
                            حذف این ماده
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowNewRecipeForm(false);
                    setEditingRecipeId(null);
                  }}
                  className="px-4 py-2 bg-secondary/10 text-secondary font-medium rounded-lg hover:bg-secondary/20 transition-colors"
                >
                  انصراف
                </button>
                <button
                  onClick={handleAddRecipe}
                  className="px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  {editingRecipeId ? 'ذخیره تغییرات' : 'افزودن دستور'}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* RECIPES LIST */}
        {recipes.length === 0 ? (
          <div className="text-center py-12 px-6 bg-surface rounded-xl border border-border shadow-card">
            <p className="text-secondary text-lg">هنوز دستور پخت‌ای تعریف نشده است</p>
            <p className="text-secondary mt-2">برای شروع، یک دستور پخت جدید افزودن کنید</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recipes.map(recipe => {
              const recipeCost = recipe.ingredients.reduce((sum, ing) => sum + (ing.costPerUnit || 0) * ing.requiredQuantity, 0);
              const margin = recipe.baseSellPrice - recipeCost;
              const marginPercent = recipe.baseSellPrice > 0 ? (margin / recipe.baseSellPrice) * 100 : 0;

              return (
                <Card key={recipe.id}>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-lg font-bold text-primary">{recipe.name}</h3>
                        <span className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded">{recipe.category}</span>
                      </div>
                      <p className="text-sm text-secondary">{recipe.ingredients.length} ماده</p>
                    </div>

                    {recipe.prepNotes && (
                      <div className="text-xs text-secondary bg-background p-2 rounded border border-border">
                        <p className="font-medium mb-1">توضیحات:</p>
                        <p>{recipe.prepNotes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-danger/10 p-2 rounded text-center">
                        <p className="text-xs text-secondary">هزینه</p>
                        <CurrencyDisplay value={recipeCost} className="text-danger font-bold" />
                      </div>
                      <div className="bg-accent/10 p-2 rounded text-center">
                        <p className="text-xs text-secondary">فروش</p>
                        <CurrencyDisplay value={recipe.baseSellPrice} className="text-accent font-bold" />
                      </div>
                      <div className={`p-2 rounded text-center ${margin > 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                        <p className="text-xs text-secondary">سود</p>
                        <p className={`font-bold text-sm ${margin > 0 ? 'text-success' : 'text-danger'}`}>
                          {marginPercent.toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-secondary border-t border-border pt-2">
                      <p className="font-medium mb-1">مواد:</p>
                      <ul className="space-y-0.5">
                        {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                          <li key={idx}>{ing.itemName} ({ing.requiredQuantity} {ing.itemUnit})</li>
                        ))}
                        {recipe.ingredients.length > 3 && (
                          <li className="text-secondary/70">و {recipe.ingredients.length - 3} ماده دیگر</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        className="px-2 py-1 text-danger hover:bg-danger/10 rounded transition-colors"
                      >
                        <TrashIcon />
                      </button>
                      <button
                        onClick={() => handleEditRecipe(recipe)}
                        className="px-2 py-1 text-accent hover:bg-accent/10 rounded transition-colors"
                      >
                        <EditIcon />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
};

export default RecipeDashboard;
