import React, { useState } from 'react';
import { t } from '../../shared/translations';
import { logoSvg } from '../assets/logo';
import Card from '../components/common/Card';
import { SafeSVG } from '../components/common/SafeSVG';
import { sanitizeString, validateString } from '../utils/validation';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validate and sanitize inputs
    const usernameValidation = validateString(username, 1, 50);
    const passwordValidation = validateString(password, 1, 100);

    if (!usernameValidation.isValid) {
      setError(usernameValidation.error || t.loginError);
      setIsSubmitting(false);
      return;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.error || t.loginError);
      setIsSubmitting(false);
      return;
    }

    const sanitizedUsername = sanitizeString(username);
    const sanitizedPassword = sanitizeString(password);

    try {
      const success = await onLogin(sanitizedUsername, sanitizedPassword);
      if (!success) {
        setError(t.loginError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-success/5 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <div className="p-4 bg-surface rounded-2xl shadow-elevated mb-4 animate-scale-in">
            <SafeSVG svgContent={logoSvg} className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">{t.appTitle}</h1>
          <p className="text-sm text-secondary text-center">سیستم مدیریت هوشمند کسب و کار</p>
        </div>

        <Card className="shadow-elevated animate-fade-in-up">
          <h2 className="text-xl font-bold text-primary text-center mb-2">{t.loginTitle}</h2>
          <p className="text-sm text-secondary text-center mb-6">لطفاً وارد حساب کاربری خود شوید</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">{t.username}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-primary placeholder-secondary"
                placeholder="نام کاربری"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">{t.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-primary placeholder-secondary"
                placeholder="کلمه عبور"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg animate-fade-in">
                <p className="text-sm text-danger text-center font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-accent text-accent-text font-bold rounded-lg hover:bg-accent-hover hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-wait active:scale-[0.98] shadow-sm"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  در حال ورود...
                </span>
              ) : (
                t.loginButton
              )}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
