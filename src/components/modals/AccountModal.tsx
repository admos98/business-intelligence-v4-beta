import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../../shared/types';
import { useShoppingStore } from '../../store/useShoppingStore';
import { useToast } from '../common/Toast';
import { t } from '../../../shared/translations';
import Card from '../common/Card';
import Button from '../common/Button';

interface AccountModalProps {
  onClose: () => void;
  accountToEdit?: Account;
}

const AccountModal: React.FC<AccountModalProps> = ({ onClose, accountToEdit }) => {
  const { addAccount, updateAccount, accounts } = useShoppingStore();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState(accountToEdit?.code || '');
  const [name, setName] = useState(accountToEdit?.name || '');
  const [nameEn, setNameEn] = useState(accountToEdit?.nameEn || '');
  const [type, setType] = useState<AccountType>(accountToEdit?.type || AccountType.Asset);
  const [description, setDescription] = useState(accountToEdit?.description || '');
  const [balance, setBalance] = useState(accountToEdit?.balance?.toString() || '0');

  const isEditing = !!accountToEdit;

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      addToast('لطفاً کد و نام حساب را وارد کنید', 'error');
      return;
    }

    // Check if code already exists (for new accounts)
    if (!isEditing) {
      const existingAccount = accounts.find(acc => acc.code === code.trim());
      if (existingAccount) {
        addToast('این کد حساب قبلاً استفاده شده است', 'error');
        return;
      }
    }

    const accountData: Omit<Account, 'id' | 'createdAt'> = {
      code: code.trim(),
      name: name.trim(),
      nameEn: nameEn.trim() || undefined,
      type,
      description: description.trim() || undefined,
      balance: parseFloat(balance) || 0,
      isActive: true,
    };

    if (isEditing) {
      updateAccount(accountToEdit.id, accountData);
      addToast('حساب به‌روزرسانی شد', 'success');
    } else {
      addAccount(accountData);
      addToast('حساب جدید اضافه شد', 'success');
    }
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Card
          className={`bg-surface w-full max-w-md transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}
        >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-primary">
            {isEditing ? 'ویرایش حساب' : 'افزودن حساب جدید'}
          </h2>
          <button
            onClick={handleClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              کد حساب <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: 1-101"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              autoFocus
              disabled={isEditing}
            />
            <p className="text-xs text-secondary mt-1">کد حساب باید یکتا باشد</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              نام حساب <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام فارسی حساب"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              نام انگلیسی (اختیاری)
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="English name (optional)"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              نوع حساب <span className="text-danger">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              disabled={isEditing}
            >
              {Object.values(AccountType).map(accountType => (
                <option key={accountType} value={accountType}>{accountType}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              مانده اولیه
            </label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              توضیحات (اختیاری)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="توضیحات درباره حساب..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleClose}>
              {t.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {isEditing ? t.save : t.create}
            </Button>
          </div>
        </form>
        </Card>
      </div>
    </div>
  );
};

export default AccountModal;
