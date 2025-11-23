import React, { useState } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { User } from '../../shared/types';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useToast } from '../components/common/Toast';
// hashPassword is defined in useShoppingStore but not exported, we'll define it locally
const hashPassword = async (password: string, salt: string): Promise<string> => {
  if (!(globalThis.crypto && typeof globalThis.crypto.subtle !== 'undefined')) {
    throw new Error("Secure login is unavailable in this environment.");
  }
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const UserManagementPage: React.FC = () => {
  const { users, currentUser, addUser, updateUser, deleteUser } = useShoppingStore();
  const { addToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    role: 'admin' | 'manager' | 'cashier';
  }>({
    username: '',
    password: '',
    role: 'cashier',
  });

  const handleSave = async () => {
    if (!formData.username.trim()) {
      addToast('لطفاً نام کاربری را وارد کنید', 'error');
      return;
    }

    if (editingId) {
      // Update existing user
      const user = users.find(u => u.id === editingId);
      if (!user) {
        addToast('کاربر یافت نشد', 'error');
        return;
      }

      const updates: Partial<User> = {
        role: formData.role,
      };

      // Only update password if provided
      if (formData.password.trim()) {
        if (!user.salt) {
          addToast('خطا: نمک رمز عبور یافت نشد', 'error');
          return;
        }
        try {
          const passwordHash = await hashPassword(formData.password, user.salt);
          updates.passwordHash = passwordHash;
        } catch (error) {
          addToast('خطا در رمزگذاری رمز عبور', 'error');
          return;
        }
      }

      updateUser(editingId, updates);
      addToast('کاربر با موفقیت به‌روزرسانی شد', 'success');
    } else {
      // Add new user
      if (!formData.password.trim()) {
        addToast('لطفاً رمز عبور را وارد کنید', 'error');
        return;
      }

      try {
        const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        const passwordHash = await hashPassword(formData.password, salt);

        addUser({
          username: formData.username.trim(),
          passwordHash,
          salt,
          role: formData.role,
        });
        addToast('کاربر با موفقیت اضافه شد', 'success');
      } catch (error) {
        addToast('خطا در ایجاد کاربر', 'error');
        return;
      }
    }

    setFormData({ username: '', password: '', role: 'cashier' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (user: User) => {
    setFormData({
      username: user.username,
      password: '', // Don't show password
      role: user.role || 'cashier',
    });
    setEditingId(user.id || null);
    setIsAdding(true);
  };

  const handleDelete = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (currentUser?.id === userId) {
      addToast('نمی‌توانید کاربر فعلی را حذف کنید', 'error');
      return;
    }

    if (confirm(`آیا از حذف کاربر "${user.username}" اطمینان دارید؟`)) {
      try {
        deleteUser(userId);
        addToast('کاربر با موفقیت حذف شد', 'success');
      } catch (error) {
        if (error instanceof Error) {
          addToast(error.message, 'error');
        } else {
          addToast('خطا در حذف کاربر', 'error');
        }
      }
    }
  };

  const getRoleLabel = (role?: string) => {
    const labels: Record<string, string> = {
      admin: 'مدیر',
      manager: 'مدیر فروش',
      cashier: 'صندوقدار',
    };
    return labels[role || 'cashier'] || role || 'نامشخص';
  };

  return (
    <>
      <Header title="مدیریت کاربران" onBack={() => window.history.back()} backText="بازگشت" hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Add/Edit Form */}
        {isAdding && (
          <Card title={editingId ? 'ویرایش کاربر' : 'افزودن کاربر جدید'} className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  نام کاربری
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingId}
                  placeholder="نام کاربری"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  رمز عبور {editingId && '(خالی بگذارید برای عدم تغییر)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="رمز عبور"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  نقش
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'cashier' })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="cashier">صندوقدار</option>
                  <option value="manager">مدیر فروش</option>
                  <option value="admin">مدیر</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} variant="primary">
                  {editingId ? 'ذخیره تغییرات' : 'افزودن کاربر'}
                </Button>
                <Button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({ username: '', password: '', role: 'cashier' });
                  }}
                  variant="ghost"
                >
                  لغو
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Users List */}
        <Card title={`کاربران (${users.length})`}>
          {!isAdding && (
            <div className="mb-4">
              <Button onClick={() => setIsAdding(true)} variant="primary">
                افزودن کاربر جدید
              </Button>
            </div>
          )}
          {users.length === 0 ? (
            <div className="text-center py-8 text-secondary">
              هیچ کاربری یافت نشد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right p-3 font-semibold text-primary">نام کاربری</th>
                    <th className="text-right p-3 font-semibold text-primary">نقش</th>
                    <th className="text-right p-3 font-semibold text-primary">وضعیت</th>
                    <th className="text-right p-3 font-semibold text-primary">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-background transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{user.username}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-accent/10 text-accent rounded-md text-xs font-medium">
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="p-3">
                        {currentUser?.id === user.id ? (
                          <span className="px-2 py-1 bg-accent/20 text-accent rounded-md text-xs font-medium">
                            فعال
                          </span>
                        ) : (
                          <span className="text-secondary text-xs">غیرفعال</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            ویرایش
                          </Button>
                          {currentUser?.id !== user.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id!)}
                              className="text-danger"
                            >
                              حذف
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </>
  );
};
