import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BookOpen, Clock, ChevronRight, Lock, CheckCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';

interface Exam {
  id: string;
  title: string;
  durationMinutes: number;
  accessCode: string;
}

interface ExamStats {
  bestScore: number;
  totalQuestions: number;
  attempts: number;
}

export const Exams: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examStats, setExamStats] = useState<Record<string, ExamStats>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // 1. Get user profile to check access code
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userAccessCode = userDoc.data()?.accessCode;

        if (!userAccessCode) {
          navigate('/access-code');
          return;
        }

        // 2. Get exams matching the user's access code prefix or specific code
        const examsSnap = await getDocs(collection(db, 'exams'));
        const examsList = examsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Exam));
        
        // 3. Get user exam stats
        const statsQuery = query(
          collection(db, 'user_exam_stats'),
          where('uid', '==', user.uid)
        );
        const statsSnap = await getDocs(statsQuery);
        const stats: Record<string, ExamStats> = {};
        
        statsSnap.docs.forEach(doc => {
          const data = doc.data();
          stats[data.examId] = { 
            bestScore: data.bestScore, 
            totalQuestions: data.totalQuestions, 
            attempts: data.attempts || 0 
          };
        });

        setExams(examsList);
        setExamStats(stats);
      } catch (err) {
        console.error('Error fetching exams:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center">{t('loadingExams')}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{t('availableExams')}</h1>
        <p className="text-slate-500">{t('examsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exams.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('noExamsAvailable')}</p>
          </div>
        ) : (
          exams.map((exam) => {
            const stats = examStats[exam.id];
            const attempts = stats?.attempts || 0;
            const canTake = attempts < 2;
            const bestPercentage = stats ? Math.round((stats.bestScore / stats.totalQuestions) * 100) : null;

            return (
              <Card key={exam.id} className={attempts >= 2 ? "opacity-75" : ""}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">{exam.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {exam.durationMinutes} {t('mins')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Lock className="h-4 w-4" />
                        {exam.accessCode}
                      </div>
                    </div>
                  </div>
                  {attempts > 0 && (
                    <div className={cn(
                      "p-2 rounded-full",
                      attempts >= 2 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {attempts >= 2 ? <Lock className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    {attempts >= 2 
                      ? "You have reached the maximum number of attempts (2/2)."
                      : attempts === 1 
                        ? "You have 1 attempt remaining. Your highest score will be kept."
                        : t('examStartNote')}
                  </p>
                  
                  {bestPercentage !== null && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Best Score</span>
                      <span className="font-black text-slate-900">{bestPercentage}%</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {!canTake ? (
                    <Button variant="outline" className="w-full" disabled>
                      {t('completed')} (2/2)
                    </Button>
                  ) : (
                    <Link to={`/exam/${exam.id}`} className="w-full">
                      <Button variant="primary" className="w-full">
                        {attempts === 1 ? "Retake Exam" : t('startExam')}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
