import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, doc, setDoc, writeBatch, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { 
  Plus, Trash2, Save, Ticket, Users, FileText, 
  BarChart3, Search, Download, ShieldAlert, 
  CheckCircle2, XCircle, Clock, Filter
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

interface Exam {
  id: string;
  title: string;
  accessCode: string;
  durationMinutes: number;
  questions: any[];
  createdAt: string;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  accessCode?: string;
  createdAt: string;
}

interface AccessCode {
  code: string;
  used: boolean;
  usedBy?: string;
  usedAt?: any;
}

interface Result {
  id: string;
  examTitle: string;
  studentName: string;
  uid: string;
  score: number;
  totalQuestions: number;
  cheatingAlerts?: string[];
  submittedAt: string;
}

type Tab = 'overview' | 'exams' | 'users' | 'codes' | 'results';

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Data States
  const [exams, setExams] = useState<Exam[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // Exam Creation States
  const [title, setTitle] = useState('');
  const [examAccessCode, setExamAccessCode] = useState('');
  const [duration, setDuration] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  
  // Filter States
  const [userSearch, setUserSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [resultSearch, setResultSearch] = useState('');
  const [examToDelete, setExamToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setDataLoading(true);
    setMessage('');
    
    const fetchExams = async () => {
      try {
        const snap = await getDocs(collection(db, 'exams'));
        setExams(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Exam)));
      } catch (err: any) {
        console.error('Error fetching exams:', err);
      }
    };

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(snap.docs.map(doc => doc.data() as UserProfile));
      } catch (err: any) {
        console.error('Error fetching users:', err);
      }
    };

    const fetchCodes = async () => {
      try {
        const snap = await getDocs(collection(db, 'access_codes'));
        setCodes(snap.docs.map(doc => doc.data() as AccessCode));
      } catch (err: any) {
        console.error('Error fetching codes:', err);
        if (err.message.includes('permission')) {
          setMessage('Admin permissions not fully active yet. Please refresh in a moment.');
        }
      }
    };

    const fetchResults = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'results'), orderBy('submittedAt', 'desc')));
        setResults(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Result)));
      } catch (err: any) {
        console.error('Error fetching results:', err);
      }
    };

    await Promise.all([fetchExams(), fetchUsers(), fetchCodes(), fetchResults()]);
    setDataLoading(false);
  };

  // Stats Calculations
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalResults = results.length;
    const avgScore = totalResults > 0 
      ? Math.round(results.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0) / totalResults * 100)
      : 0;
    const codesUsed = codes.filter(c => c.used).length;
    const totalCheatingAlerts = results.reduce((acc, r) => acc + (r.cheatingAlerts?.length || 0), 0);

    const totalExams = exams.length;
    const avgDuration = totalExams > 0
      ? Math.round(exams.reduce((acc, e) => acc + e.durationMinutes, 0) / totalExams)
      : 0;
    
    const examCounts: Record<string, number> = {};
    results.forEach(r => {
      examCounts[r.examTitle] = (examCounts[r.examTitle] || 0) + 1;
    });
    const mostTakenExam = Object.entries(examCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { totalUsers, totalResults, avgScore, codesUsed, totalCheatingAlerts, totalExams, avgDuration, mostTakenExam };
  }, [users, results, codes, exams]);

  // Filters
  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredCodes = codes.filter(c => {
    if (codeFilter === 'used') return c.used;
    if (codeFilter === 'unused') return !c.used;
    return true;
  });

  const filteredResults = results.filter(r => 
    r.studentName?.toLowerCase().includes(resultSearch.toLowerCase()) || 
    r.examTitle?.toLowerCase().includes(resultSearch.toLowerCase())
  );

  const generateCodes = async () => {
    if (!confirm('This will generate 100 access codes (WA-INF-2025-0001 to 0100). Continue?')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      for (let i = 1; i <= 100; i++) {
        const code = `WA-INF-2025-${i.toString().padStart(4, '0')}`;
        const codeRef = doc(db, 'access_codes', code);
        batch.set(codeRef, {
          code,
          used: false,
          usedBy: null,
          usedAt: null
        });
      }
      await batch.commit();
      setMessage('100 access codes generated successfully!');
      fetchData();
    } catch (err: any) {
      setMessage('Error generating codes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    const headers = ['Student Name', 'Exam Title', 'Score', 'Total', 'Percentage', 'Cheating Alerts', 'Submitted At'];
    const rows = results.map(r => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.examTitle.replace(/"/g, '""')}"`,
      r.score,
      r.totalQuestions,
      `"${Math.round((r.score / r.totalQuestions) * 100)}%"`,
      r.cheatingAlerts?.length || 0,
      `"${new Date(r.submittedAt).toLocaleString()}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Wanky_Academy_Results_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveExam = async () => {
    if (!title || !examAccessCode || questions.length === 0) {
      setMessage('Please fill in all fields and add at least one question.');
      return;
    }
    setLoading(true);
    try {
      const examData = {
        title,
        accessCode: examAccessCode.toUpperCase(),
        durationMinutes: duration,
        questions,
        updatedAt: new Date().toISOString()
      };

      if (editingExamId) {
        await setDoc(doc(db, 'exams', editingExamId), examData, { merge: true });
        setMessage('Exam updated successfully!');
      } else {
        await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: new Date().toISOString()
        });
        setMessage('Exam created successfully!');
      }

      setEditingExamId(null);
      setTitle('');
      setExamAccessCode('');
      setQuestions([]);
      fetchData();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setExamAccessCode(exam.accessCode);
    setDuration(exam.durationMinutes);
    setQuestions(exam.questions);
    setActiveTab('exams');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingExamId(null);
    setTitle('');
    setExamAccessCode('');
    setQuestions([]);
    setDuration(60);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now().toString(),
        text: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0
      }
    ]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'exams', examToDelete));
      setMessage('Exam deleted successfully!');
      setExamToDelete(null);
      fetchData();
    } catch (err: any) {
      setMessage('Error deleting exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseBulkQuestions = () => {
    if (!bulkText.trim()) return;
    
    const blocks = bulkText.split(/\n\s*\n/);
    const newQuestions: Question[] = blocks.map((block, i) => {
      const lines = block.trim().split('\n').map(l => l.trim());
      if (lines.length < 2) return null;
      
      const text = lines[0].replace(/^\d+[\.\)]\s*/, '');
      const options = lines.slice(1, 5).map(l => l.replace(/^[a-d][\.\)]\s*/i, ''));
      
      let correctIndex = 0;
      lines.forEach((l, idx) => {
        if (l.includes('*') || l.toLowerCase().includes('(correct)')) {
          correctIndex = idx - 1;
        }
      });

      return {
        id: (Date.now() + i).toString(),
        text,
        options: options.length === 4 ? options : [...options, '', '', '', ''].slice(0, 4),
        correctOptionIndex: Math.max(0, correctIndex)
      } as Question;
    }).filter((q): q is Question => q !== null && q.text !== '');

    setQuestions([...questions, ...newQuestions]);
    setBulkText('');
    setMessage(`Successfully imported ${newQuestions.length} questions!`);
  };

  const loadInformaticsTemplate = () => {
    const template: Question[] = [
      {
        id: '1',
        text: 'Ki definisyon ki pi konplè pou enfòmatik?',
        options: ['Ekri dokiman', 'Syans tretman enfòmasyon otomatik', 'Itilizasyon entènèt', 'Fè kalkil sèlman'],
        correctOptionIndex: 1
      },
      {
        id: '2',
        text: 'Ki sa “automatique” vle di nan enfòmatik?',
        options: ['Manyèl', 'San elektrisite', 'San entèvansyon moun dirèk', 'Vitès rapid'],
        correctOptionIndex: 2
      },
      {
        id: '3',
        text: 'Poukisa yon òdinatè pa ka panse?',
        options: ['Li pa gen kouran', 'Li pa gen memwa', 'Li suiv pwogram sèlman', 'Li twò piti'],
        correctOptionIndex: 2
      },
      {
        id: '4',
        text: 'Ki sa “multitach” vle di?',
        options: ['Travay dousman', 'Fè yon sèl travay', 'Fè plizyè travay an menm tan', 'Sispann travay'],
        correctOptionIndex: 2
      },
      {
        id: '5',
        text: 'Ki youn nan limit enfòmatik?',
        options: ['Pa ka estoke done', 'Depann de elektrisite', 'Pa ka kalkile', 'Pa ka itilize entènèt'],
        correctOptionIndex: 1
      },
      {
        id: '6',
        text: 'Ki diferans ant done ak enfòmasyon?',
        options: ['Yo menm bagay', 'Done se rezilta', 'Enfòmasyon se done trete', 'Done pa itil'],
        correctOptionIndex: 2
      },
      {
        id: '7',
        text: 'Ki fonksyon “Processing” lan ye?',
        options: ['Antre done', 'Sòti done', 'Trete done', 'Efase done'],
        correctOptionIndex: 2
      },
      {
        id: '8',
        text: 'Ki aparèy ki fè antre done?',
        options: ['Ekran', 'Sourit', 'Enprimant', 'Mofle'],
        correctOptionIndex: 1
      }
    ];
    setQuestions(template);
    setTitle('EGZAMEN ENFÒMATIK');
    setExamAccessCode('INF-2025');
    setDuration(60);
    setMessage('Informatics Exam template loaded!');
  };

  if (dataLoading) return <div className="flex h-[60vh] items-center justify-center">Loading Dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500">Manage exams, users, and monitor results.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            Refresh Data
          </Button>
          <Button onClick={exportResults} size="sm" variant="primary">
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
          message.includes('Error') ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
        )}>
          {message.includes('Error') ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <span className="font-medium">{message}</span>
          <button onClick={() => setMessage('')} className="ml-auto text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Users</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. Score</p>
              <p className="text-2xl font-black text-slate-900">{stats.avgScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Codes Used</p>
              <p className="text-2xl font-black text-slate-900">{stats.codesUsed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cheating Alerts</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalCheatingAlerts}</p>
            </div>
          </CardContent>
        </Card>
        
        {/* New Stats Cards */}
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Exams</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalExams}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. Duration</p>
              <p className="text-2xl font-black text-slate-900">{stats.avgDuration}m</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm lg:col-span-2">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Most Taken Exam</p>
              <p className="text-xl font-black text-slate-900 truncate">{stats.mostTakenExam}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95">
            <CardHeader className="text-center py-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Delete Exam?</h2>
              <p className="text-slate-500 mt-2">This action cannot be undone. All associated data will be lost.</p>
            </CardHeader>
            <CardContent className="flex gap-4 pb-8">
              <Button variant="outline" className="flex-1" onClick={() => setExamToDelete(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1 bg-rose-600 hover:bg-rose-700 border-rose-600" onClick={handleDeleteExam} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete Now'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'exams', label: 'Manage Exams', icon: FileText },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'codes', label: 'Access Codes', icon: Ticket },
          { id: 'results', label: 'Exam Results', icon: CheckCircle2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "border-blue-600 text-blue-600 bg-blue-50/50" 
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {r.studentName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{r.studentName}</p>
                        <p className="text-xs text-slate-500">{r.examTitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{Math.round((r.score / r.totalQuestions) * 100)}%</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{new Date(r.submittedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                {results.length === 0 && <p className="text-center py-8 text-slate-400">No recent activity.</p>}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" className="h-24 flex-col gap-2 rounded-3xl border-dashed" onClick={() => setActiveTab('exams')}>
                  <Plus className="h-6 w-6" />
                  Create New Exam
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2 rounded-3xl border-dashed" onClick={generateCodes} isLoading={loading}>
                  <Ticket className="h-6 w-6" />
                  Generate 100 Codes
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2 rounded-3xl border-dashed" onClick={() => setActiveTab('results')}>
                  <Download className="h-6 w-6" />
                  Export All Data
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2 rounded-3xl border-dashed" onClick={() => setActiveTab('users')}>
                  <Users className="h-6 w-6" />
                  Manage Students
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="space-y-8">
            {/* Existing Exams List */}
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100 p-6">
                <h2 className="text-xl font-black text-slate-900">Existing Exams</h2>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Title</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Access Code</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Questions</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map(exam => (
                        <tr key={exam.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-900">{exam.title}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold font-mono">
                              {exam.accessCode}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-500">{exam.questions?.length || 0} questions</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditExam(exam)}
                                className="text-blue-500 hover:bg-blue-50"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setExamToDelete(exam.id)}
                                className="text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {exams.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 italic">No exams created yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
              <Card className="border-none shadow-sm flex-grow">
                <CardHeader>
                  <h2 className="text-xl font-black text-slate-900">Exam Configuration</h2>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input label="Exam Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Final Mathematics Exam" />
                  <Input label="Access Code" value={examAccessCode} onChange={(e) => setExamAccessCode(e.target.value)} placeholder="MATH-101" />
                  <Input label="Duration (Minutes)" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} />
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-sm w-full md:w-80">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-900">Templates</h2>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full justify-start" onClick={loadInformaticsTemplate}>
                    <FileText className="h-4 w-4 mr-2" />
                    Informatics Exam
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <h2 className="text-xl font-black text-slate-900">Bulk Import Questions</h2>
                <p className="text-sm text-slate-500">Paste questions separated by double newlines. Mark correct answer with an asterisk (*).</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="1. Question text?&#10;a) Option 1&#10;b) Option 2*&#10;c) Option 3&#10;d) Option 4"
                  className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                />
                <Button onClick={parseBulkQuestions} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Parse and Add Questions
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Questions ({questions.length})</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                  {editingExamId && (
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-slate-500">
                      Cancel Edit
                    </Button>
                  )}
                  <Button onClick={handleSaveExam} isLoading={loading} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {editingExamId ? 'Update Exam' : 'Save Exam'}
                  </Button>
                </div>
              </div>

              {questions.map((q, qIndex) => (
                <Card key={q.id} className="border-none shadow-sm overflow-hidden">
                  <div className="h-1 w-full bg-blue-500" />
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-grow">
                        <Input 
                          label={`Question ${qIndex + 1}`} 
                          value={q.text} 
                          onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} 
                          placeholder="Enter question text..."
                          className="font-bold"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)} className="text-rose-500 mt-8 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <input 
                            type="radio" 
                            name={`correct-${q.id}`} 
                            checked={q.correctOptionIndex === oIndex}
                            onChange={() => updateQuestion(qIndex, 'correctOptionIndex', oIndex)}
                            className="h-5 w-5 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <Input 
                            value={option} 
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} 
                            placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                            className="border-none bg-transparent focus:ring-0 p-0 h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {questions.length === 0 && (
                <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">No questions added yet. Click "Add Question" to start.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-900">Student Directory</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search students..." 
                  value={userSearch} 
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Email</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Access Code</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.uid} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                              {u.displayName?.[0] || u.email[0]}
                            </div>
                            <span className="font-bold text-slate-900">{u.displayName || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-500">{u.email}</td>
                        <td className="p-4">
                          {u.accessCode ? (
                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold font-mono">
                              {u.accessCode}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 italic">Not activated</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'codes' && (
          <div className="space-y-6">
            {codes.length === 0 && (
              <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
                <CardContent className="p-12 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <Ticket className="h-8 w-8" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-900">No Access Codes Found</h3>
                    <p className="text-slate-500 mt-2">
                      Generate the first batch of 100 access codes (WA-INF-2025-0001 to 0100) 
                      to allow students to activate their accounts.
                    </p>
                  </div>
                  <Button onClick={generateCodes} isLoading={loading} size="lg" className="px-8">
                    <Plus className="h-5 w-5 mr-2" />
                    Generate 100 Codes Now
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-900">Access Codes</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  {(['all', 'used', 'unused'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setCodeFilter(f)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                        codeFilter === f ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <Button onClick={generateCodes} isLoading={loading} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate 100
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Code</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Used By (UID)</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Used At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodes.map(c => (
                      <tr key={c.code} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900">{c.code}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            c.used ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {c.used ? 'Used' : 'Available'}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 font-mono">{c.usedBy || '-'}</td>
                        <td className="p-4 text-sm text-slate-500">
                          {c.usedAt ? new Date(c.usedAt.toDate()).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'results' && (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-900">Exam Results</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search results..." 
                    value={resultSearch} 
                    onChange={(e) => setResultSearch(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                <Button onClick={exportResults} size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Exam</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Score</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Alerts</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map(r => {
                      const percentage = Math.round((r.score / r.totalQuestions) * 100);
                      const isPassed = percentage >= 60;
                      const alertCount = r.cheatingAlerts?.length || 0;
                      
                      return (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-900">{r.studentName}</td>
                          <td className="p-4 text-sm text-slate-500">{r.examTitle}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className={cn("font-black", isPassed ? "text-emerald-600" : "text-rose-600")}>
                                {percentage}%
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                {r.score}/{r.totalQuestions}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            {alertCount > 0 ? (
                              <div className="flex items-center gap-1 text-rose-600">
                                <ShieldAlert className="h-4 w-4" />
                                <span className="text-xs font-black">{alertCount}</span>
                              </div>
                            ) : (
                              <span className="text-emerald-500">
                                <CheckCircle2 className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-slate-500">{new Date(r.submittedAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
