import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, Send, ShieldAlert, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

interface ExamData {
  id: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
}

interface ExamProgress {
  answers: Record<string, number>;
  shuffledIndices: number[];
  startTime: string;
  currentQuestionIndex: number;
  isStarted: boolean;
  isCompleted: boolean;
}

export const Exam: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cheatingWarning, setCheatingWarning] = useState<string | null>(null);
  const [cheatingAlerts, setCheatingAlerts] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [isRetaking, setIsRetaking] = useState(false);

  // Helper to shuffle array
  const shuffle = (array: number[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Anti-cheating: Fullscreen check
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.error(err));
    }
  };

  // Anti-cheating: Tab switching, Right click, Copy/Paste
  useEffect(() => {
    if (loading || hasCompleted || !exam) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const msg = 'Tab switching detected! Please stay on the exam page.';
        setCheatingWarning(msg);
        setCheatingAlerts(prev => [...prev, `Tab switch at ${new Date().toLocaleTimeString()}`]);
      }
    };

    const preventDefaults = (e: Event) => {
      e.preventDefault();
      const msg = 'Action disabled for security reasons.';
      setCheatingWarning(msg);
      setCheatingAlerts(prev => [...prev, `${e.type} attempt at ${new Date().toLocaleTimeString()}`]);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', preventDefaults);
    document.addEventListener('copy', preventDefaults);
    document.addEventListener('paste', preventDefaults);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', preventDefaults);
      document.removeEventListener('copy', preventDefaults);
      document.removeEventListener('paste', preventDefaults);
    };
  }, [loading, hasCompleted, exam]);

  // Prevent page refresh warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasCompleted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasCompleted]);

  // Fetch Exam and Progress
  useEffect(() => {
    const initExam = async () => {
      if (!examId || !user) return;

      try {
        // 1. Check if already submitted
        const resultsQuery = query(
          collection(db, 'results'),
          where('examId', '==', examId),
          where('uid', '==', user.uid)
        );
        const resultSnap = await getDocs(resultsQuery);
        const previousAttempts = resultSnap.docs.length;
        setAttemptsCount(previousAttempts);

        if (previousAttempts >= 2) {
          setHasCompleted(true);
          setLoading(false);
          return;
        }

        // 2. Fetch Exam Data
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) {
          setLoading(false);
          return;
        }
        const examData = { ...examDoc.data(), id: examDoc.id } as ExamData;
        setExam(examData);

        // 3. Fetch or Create Progress
        const progressRef = doc(db, 'users', user.uid, 'examProgress', examId);
        const progressSnap = await getDoc(progressRef);

        if (progressSnap.exists()) {
          const progress = progressSnap.data() as ExamProgress;
          if (progress.isCompleted) {
            // If they finished a progress but have < 2 results, it means they finished attempt 1
            // and haven't started attempt 2 retake yet.
            if (previousAttempts < 2) {
              setIsRetaking(false);
            } else {
              setHasCompleted(true);
            }
          } else {
            setAnswers(progress.answers || {});
            setShuffledIndices(progress.shuffledIndices);
            setCurrentQuestionIndex(progress.currentQuestionIndex || 0);
            setIsRetaking(true);
            
            // Calculate time left
            const start = new Date(progress.startTime).getTime();
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - start) / 1000);
            const totalSeconds = examData.durationMinutes * 60;
            const remaining = Math.max(0, totalSeconds - elapsedSeconds);
            setTimeLeft(remaining);
            
            if (remaining <= 0) {
              // Auto-submit if time expired while away
              setHasCompleted(true);
            }
          }
        } else {
          // New Start
          const indices = shuffle(examData.questions.map((_, i) => i));
          const startTime = new Date().toISOString();
          const initialProgress: ExamProgress = {
            answers: {},
            shuffledIndices: indices,
            startTime,
            currentQuestionIndex: 0,
            isStarted: true,
            isCompleted: false
          };
          await setDoc(progressRef, initialProgress);
          setShuffledIndices(indices);
          setAnswers({});
          setTimeLeft(examData.durationMinutes * 60);
        }
      } catch (err) {
        console.error('Error initializing exam:', err);
      } finally {
        setLoading(false);
      }
    };

    initExam();
  }, [examId, user]);

  // Save progress on answer or index change
  const saveProgress = useCallback(async (newAnswers: Record<string, number>, newIndex: number) => {
    if (!user || !examId || hasCompleted || (!isRetaking && attemptsCount === 0)) return;
    const progressRef = doc(db, 'users', user.uid, 'examProgress', examId);
    await updateDoc(progressRef, { 
      answers: newAnswers,
      currentQuestionIndex: newIndex
    });
  }, [user, examId, hasCompleted, isRetaking, attemptsCount]);

  const startExam = async () => {
    if (!exam || !user) return;
    setLoading(true);
    try {
      const indices = shuffle(exam.questions.map((_, i) => i));
      const startTime = new Date().toISOString();
      const initialProgress: ExamProgress = {
        answers: {},
        shuffledIndices: indices,
        startTime,
        currentQuestionIndex: 0,
        isStarted: true,
        isCompleted: false
      };
      const progressRef = doc(db, 'users', user.uid, 'examProgress', exam.id);
      await setDoc(progressRef, initialProgress);
      setShuffledIndices(indices);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setTimeLeft(exam.durationMinutes * 60);
      setIsRetaking(true);
    } catch (err) {
      console.error('Error starting exam:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionIdx: number, optionIdx: number) => {
    const newAnswers = { ...answers, [questionIdx]: optionIdx };
    setAnswers(newAnswers);
    saveProgress(newAnswers, currentQuestionIndex);
  };

  // Save index change
  useEffect(() => {
    if (!loading && !hasCompleted && exam) {
      saveProgress(answers, currentQuestionIndex);
    }
  }, [currentQuestionIndex]);

  // Timer logic
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || hasCompleted) {
      if (timeLeft === 0 && !hasCompleted) handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => (prev ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, hasCompleted]);

  const handleSubmit = async () => {
    if (!exam || !user || submitting || hasCompleted) return;
    setSubmitting(true);
    
    let score = 0;
    exam.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctOptionIndex) score++;
    });

    try {
      const result = {
        examId: exam.id,
        examTitle: exam.title,
        uid: user.uid,
        studentName: user.displayName || user.email,
        answers,
        score,
        totalQuestions: exam.questions.length,
        cheatingAlerts,
        submittedAt: new Date().toISOString()
      };
      
      // 1. Save result
      const docRef = await addDoc(collection(db, 'results'), result);
      
      // 3. Update best score and attempts
      const statsRef = doc(db, 'user_exam_stats', `${user.uid}_${exam.id}`);
      const statsSnap = await getDoc(statsRef);
      const currentBest = statsSnap.exists() ? statsSnap.data().bestScore : 0;
      
      const statsData: any = {
        uid: user.uid,
        examId: exam.id,
        examTitle: exam.title,
        totalQuestions: exam.questions.length,
        attempts: increment(1),
        updatedAt: new Date().toISOString()
      };

      if (score > currentBest || !statsSnap.exists()) {
        statsData.bestScore = score;
      }

      await setDoc(statsRef, statsData, { merge: true });
      
      // 2. Mark progress as completed
      const progressRef = doc(db, 'users', user.uid, 'examProgress', exam.id);
      await updateDoc(progressRef, { isCompleted: true });
      
      setHasCompleted(true);
      navigate(`/result/${docRef.id}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert(t('failedToSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center">{t('loadingExam')}</div>;
  
  if (hasCompleted) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <ShieldAlert className="h-16 w-16 text-rose-600 mx-auto" />
        <h1 className="text-2xl font-bold">Max Attempts Reached</h1>
        <p className="text-slate-500">You have already completed this exam 2 times. No more attempts are allowed.</p>
        <Button onClick={() => navigate('/access-code')}>{t('backToHome')}</Button>
      </div>
    );
  }

  if (!isRetaking && attemptsCount > 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-6">
        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
          <Clock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">Retake Exam?</h1>
          <p className="text-slate-600 mt-2">
            You have already completed this exam once. You have <strong>1 attempt remaining</strong>.
          </p>
          <div className="mt-6 p-4 bg-white rounded-2xl text-sm text-slate-500 text-left">
            <p className="font-bold text-slate-700 mb-1">Note:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your highest score will be kept.</li>
              <li>The timer will start as soon as you begin.</li>
              <li>This is your final attempt.</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={startExam} size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
            Start Final Attempt
          </Button>
          <Button variant="ghost" onClick={() => navigate('/access-code')}>
            {t('backToHome')}
          </Button>
        </div>
      </div>
    );
  }

  if (!exam || (!isRetaking && attemptsCount === 0 && !loading)) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-6">
        <h1 className="text-2xl font-bold">{exam?.title || 'Start Exam'}</h1>
        <p className="text-slate-500">Duration: {exam?.durationMinutes} minutes</p>
        <Button onClick={startExam} size="lg" className="w-full">Start Exam</Button>
      </div>
    );
  }

  if (!exam || shuffledIndices.length === 0) return <div className="text-center py-12">{t('examNotFound')}</div>;

  const actualQuestionIndex = shuffledIndices[currentQuestionIndex];
  const currentQuestion = exam.questions[actualQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none">
      {/* Anti-cheating Warning Overlay */}
      {cheatingWarning && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border-red-200">
            <CardHeader className="text-red-600 flex flex-row items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="font-bold">{t('securityAlert')}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{cheatingWarning}</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => setCheatingWarning(null)}>
                {t('iUnderstand')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Fullscreen Prompt */}
      {!isFullscreen && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-blue-700">
            <Maximize className="h-5 w-5" />
            <p className="text-sm font-medium">{t('fullscreenPrompt')}</p>
          </div>
          <Button size="sm" onClick={enterFullscreen}>{t('enterFullscreen')}</Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-20 z-40">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{exam.title}</h1>
          <p className="text-sm text-slate-500">{t('question')} {currentQuestionIndex + 1} {t('of')} {exam.questions.length}</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold",
          timeLeft && timeLeft < 300 ? "bg-red-50 text-red-600 animate-pulse" : "bg-blue-50 text-blue-600"
        )}>
          <Clock className="h-5 w-5" />
          {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="min-h-[400px] flex flex-col">
            <CardHeader>
              <h2 className="text-lg font-medium text-slate-800">
                {currentQuestion.text}
              </h2>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(actualQuestionIndex, idx)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4",
                    answers[actualQuestionIndex] === idx
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-700"
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                    answers[actualQuestionIndex] === idx ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-400"
                  )}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  {option}
                </button>
              ))}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('previous')}
              </Button>
              
              {currentQuestionIndex === exam.questions.length - 1 ? (
                <Button variant="primary" onClick={handleSubmit} isLoading={submitting} className="bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-2" />
                  {t('submitExam')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(exam.questions.length - 1, prev + 1))}
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="p-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">{t('questionNavigator')}</h3>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-4 gap-2">
              {shuffledIndices.map((actualIdx, displayIdx) => (
                <button
                  key={displayIdx}
                  onClick={() => setCurrentQuestionIndex(displayIdx)}
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                    currentQuestionIndex === displayIdx ? "ring-2 ring-blue-600 ring-offset-2" : "",
                    answers[actualIdx] !== undefined ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {displayIdx + 1}
                </button>
              ))}
            </CardContent>
            <CardFooter className="p-4 text-xs text-slate-500 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('autoSaveNote')}</span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};
