import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Trophy, Calendar, ChevronRight, Award } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

interface Result {
  id: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
}

export const MyResults: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'results'),
          where('uid', '==', user.uid),
          orderBy('submittedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const resultsList = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Result));
        setResults(resultsList);
      } catch (err) {
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center">{t('loadingMyResults')}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{t('myExamHistory')}</h1>
        <p className="text-slate-500">{t('examHistorySubtitle')}</p>
      </div>

      {results.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <Award className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t('noExamsTaken')}</p>
          <Link to="/exams" className="mt-4 inline-block">
            <Button variant="primary">{t('browseExams')}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {results.map((result, index) => {
            const percentage = Math.round((result.score / result.totalQuestions) * 100);
            const isPassed = percentage >= 60;
            
            // Check if this is the best score for this exam
            const isBest = !results.some(r => 
              r.examTitle === result.examTitle && 
              (r.score / r.totalQuestions) > (result.score / result.totalQuestions)
            );

            return (
              <Card key={result.id} className={cn(
                "hover:shadow-md transition-shadow relative overflow-hidden",
                isBest && "border-emerald-500/30 bg-emerald-50/10"
              )}>
                {isBest && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                    Best Score
                  </div>
                )}
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
                      isPassed ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900">{result.examTitle}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(result.submittedAt).toLocaleDateString()}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                          isPassed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {isPassed ? t('passedStatus') : t('failedStatus')}
                        </span>
                      </div>
                    </div>
                  </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">{percentage}%</p>
                        <p className="text-xs font-bold text-slate-400 uppercase">{result.score}/{result.totalQuestions}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link to={`/result/${result.id}`}>
                          <Button variant="ghost" size="sm" className="w-full">
                            {t('details')}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                        {percentage >= 70 && (
                          <Link to={`/claim-certificate/${result.id}`}>
                            <Button variant="outline" size="sm" className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                              <Award className="h-4 w-4 mr-1" />
                              {t('certificate')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
