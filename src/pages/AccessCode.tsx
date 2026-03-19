import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { doc, runTransaction, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { KeyRound, ShieldCheck } from 'lucide-react';

export const AccessCode: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUserCode = async () => {
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().accessCode) {
        setIsActivated(true);
      } else {
        setIsActivated(false);
      }
    };
    checkUserCode();
  }, [user]);

  if (isActivated === true) {
    return <Navigate to="/exams" />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    let formattedCode = code.trim().toUpperCase();
    if (!formattedCode) return;

    // Auto-prefix if user only entered the number part
    if (/^\d{4}$/.test(formattedCode)) {
      formattedCode = `WA-INF-2025-${formattedCode}`;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Check if it's an exam access code (common mistake)
      const examsQuery = query(collection(db, 'exams'), where('accessCode', '==', formattedCode));
      const examsSnap = await getDocs(examsQuery);
      if (!examsSnap.empty) {
        throw new Error('This is an exam access code. You must first activate your account with a platform access code (WA-INF-2025-XXXX).');
      }

      await runTransaction(db, async (transaction) => {
        const codeRef = doc(db, 'access_codes', formattedCode);
        const codeDoc = await transaction.get(codeRef);

        if (!codeDoc.exists()) {
          throw new Error('This access code does not exist. Please check the spelling or contact support.');
        }

        const codeData = codeDoc.data();
        if (codeData.used) {
          throw new Error('This access code has already been used.');
        }

        // Update the code as used
        transaction.update(codeRef, {
          used: true,
          usedBy: user.uid,
          usedAt: serverTimestamp()
        });

        // Link the code to the user profile
        const userRef = doc(db, 'users', user.uid);
        transaction.update(userRef, {
          accessCode: formattedCode
        });
      });

      // Success! Redirect to exam list
      alert('Access granted! You can now take your exams.');
      window.location.href = '/exams'; // Force reload to update App state
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('enterCode')}</h1>
          <p className="text-sm text-slate-500">
            {t('enterCodeSubtitle')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              placeholder={t('accessCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg font-mono tracking-widest uppercase"
              required
            />
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" isLoading={loading}>
              {t('validateCode')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
