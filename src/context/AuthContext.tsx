import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const defaultAdminEmail = "tabletwanky@gmail.com";
        const isDefaultAdmin = user.email === defaultAdminEmail;

        if (!userDoc.exists()) {
          // Create user profile if it doesn't exist
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: isDefaultAdmin ? 'admin' : 'student',
            createdAt: new Date().toISOString()
          });
          setIsAdmin(isDefaultAdmin);
        } else {
          // Check if user is admin either by role or by default email
          const userData = userDoc.data();
          const hasAdminRole = userData.role === 'admin';
          
          // Auto-upgrade to admin role if they are the default admin but don't have the role yet
          if (isDefaultAdmin && !hasAdminRole) {
            await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
            setIsAdmin(true);
          } else {
            setIsAdmin(hasAdminRole || isDefaultAdmin);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
