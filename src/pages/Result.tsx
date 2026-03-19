import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card';
import { Trophy, CheckCircle2, XCircle, Home, RotateCcw, Award } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

interface ResultData {
  examTitle: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  uid: string;
}

export const Result: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchResult = async () => {
      if (!submissionId || !user) return;
      try {
        const docRef = doc(db, 'results', submissionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ResultData;
          setResult(data);
        } else {
          setError(t('resultNotFound'));
        }
      } catch (err: any) {
        console.error('Error fetching result:', err);
        setError(t('errorPermission'));
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [submissionId, user, t]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center">{t('loadingResults')}</div>;
  
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <XCircle className="h-16 w-16 text-red-600 mx-auto" />
        <h1 className="text-2xl font-bold">{t('error')}</h1>
        <p className="text-slate-500">{error}</p>
        <Button onClick={() => navigate('/access-code')}>{t('backToHome')}</Button>
      </div>
    );
  }

  if (!result) return <div className="text-center py-12">{t('resultNotFound')}</div>;

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  const isPassed = percentage >= 60;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-2xl overflow-hidden border-none shadow-2xl">
        <div className={cn(
          "h-3 w-full",
          isPassed ? "bg-emerald-500" : "bg-rose-500"
        )} />
        <CardHeader className="text-center py-10 space-y-6 bg-white">
          <div className="flex justify-center mb-4">
            <img 
              src="https://i.postimg.cc/wTr99qNp/d-modern-logo-icon-for-Wanky-Academy-WA-1.png" 
              alt="Wanky Academy" 
              className="h-16 w-16"
            />
          </div>
          <div className={cn(
            "mx-auto flex h-24 w-24 items-center justify-center rounded-full shadow-inner",
            isPassed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {isPassed ? <Trophy className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {isPassed ? t('congratulations') : t('keepPracticing')}
            </h1>
            <p className="text-lg text-slate-500 font-medium">{result.examTitle}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-10 bg-white px-8 pb-10">
          <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 rounded-3xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Trophy className="h-24 w-24" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('finalScore')}</p>
              <p className="text-5xl font-black text-slate-900">{result.score}<span className="text-2xl text-slate-400">/{result.totalQuestions}</span></p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('percentage')}</p>
              <p className={cn(
                "text-5xl font-black",
                isPassed ? "text-emerald-600" : "text-rose-600"
              )}>{percentage}%</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('performanceDetails')}</h3>
              <span className={cn(
                "px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              )}>
                {isPassed ? t('passedStatus') : t('failedStatus')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="font-semibold text-slate-700">{t('correct')}</span>
                </div>
                <span className="font-black text-slate-900 text-lg">{result.score}</span>
              </div>
              <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-lg">
                    <XCircle className="h-5 w-5 text-rose-500" />
                  </div>
                  <span className="font-semibold text-slate-700">{t('incorrect')}</span>
                </div>
                <span className="font-black text-slate-900 text-lg">{result.totalQuestions - result.score}</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4 p-8 bg-slate-50/50 border-t border-slate-100">
          <Link to="/exams" className="w-full">
            <Button variant="primary" className="w-full h-12 text-base font-bold shadow-lg shadow-blue-200">
              <Home className="h-5 w-5 mr-2" />
              {t('backToExams')}
            </Button>
          </Link>
          {percentage >= 70 && (
            <Link to={`/claim-certificate/${submissionId}`} className="w-full">
              <Button variant="outline" className="w-full h-12 text-base font-bold bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                <Award className="h-5 w-5 mr-2" />
                {t('claimCertificate')}
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
