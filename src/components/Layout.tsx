import React from 'react';
import { LogOut, User as UserIcon, Settings, Home } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/Button';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();

  const handleLogout = () => auth.signOut();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/access-code" className="flex items-center gap-2">
              <img 
                src="https://i.postimg.cc/wTr99qNp/d-modern-logo-icon-for-Wanky-Academy-WA-1.png" 
                alt="Wanky Academy Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold tracking-tight text-blue-900 hidden sm:inline">Wanky Academy</span>
            </Link>
            
            {user && (
              <nav className="hidden md:flex items-center gap-4">
                <Link to="/access-code" className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors">
                  <Home className="h-4 w-4" />
                  {t('home')}
                </Link>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            
            {user && (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm" className="text-slate-600">
                      <Settings className="h-4 w-4 mr-2" />
                      {t('admin')}
                    </Button>
                  </Link>
                )}
                <Link to="/profile" className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="h-8 w-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  )}
                  <span className="max-w-[100px] truncate">{user.displayName || user.email}</span>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
