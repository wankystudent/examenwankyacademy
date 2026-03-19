import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { AccessCode } from './pages/AccessCode';
import { Exams } from './pages/Exams';
import { Exam } from './pages/Exam';
import { Result } from './pages/Result';
import { MyResults } from './pages/MyResults';
import { ClaimCertificate } from './pages/ClaimCertificate';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();
  const [hasAccessCode, setHasAccessCode] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        setHasAccessCode(!!userDoc.data()?.accessCode);
      } else {
        setHasAccessCode(null);
      }
    };
    checkAccess();
  }, [user]);

  if (loading || (user && hasAccessCode === null)) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={hasAccessCode ? "/exams" : "/access-code"} /> : <Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Navigate to={hasAccessCode ? "/exams" : "/access-code"} />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/access-code" element={
        <ProtectedRoute>
          <Layout>
            {hasAccessCode ? <Navigate to="/exams" /> : <AccessCode />}
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/exams" element={
        <ProtectedRoute>
          <Layout>
            <Exams />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/exam/:examId" element={
        <ProtectedRoute>
          <Layout>
            <Exam />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/result/:submissionId" element={
        <ProtectedRoute>
          <Layout>
            <Result />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/my-results" element={
        <ProtectedRoute>
          <Layout>
            <MyResults />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/claim-certificate/:resultId" element={
        <ProtectedRoute>
          <Layout>
            <ClaimCertificate />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <Profile />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/verify" element={
        <Layout>
          <VerifyCertificate />
        </Layout>
      } />

      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <Admin />
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
