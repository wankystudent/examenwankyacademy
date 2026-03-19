import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { User, Camera, Save, Loader2, CheckCircle2 } from 'lucide-react';

export function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    photoURL: '',
    bio: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData({
            displayName: data.displayName || '',
            photoURL: data.photoURL || '',
            bio: data.bio || ''
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...profileData,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">{t('profile')}</h1>
        <p className="text-slate-500">{t('profileSubtitle')}</p>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8 flex flex-col items-center">
          <div className="relative group">
            <div className="h-32 w-32 rounded-full bg-white border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
              {profileData.photoURL ? (
                <img 
                  src={profileData.photoURL} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="h-16 w-16 text-slate-300" />
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">{profileData.displayName || user?.email}</h2>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Input 
              label={t('displayName')}
              value={profileData.displayName}
              onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="Your full name"
            />
            
            <Input 
              label={t('photoURL')}
              value={profileData.photoURL}
              onChange={(e) => setProfileData(prev => ({ ...prev, photoURL: e.target.value }))}
              placeholder="https://example.com/photo.jpg"
            />

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">{t('bio')}</label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            {success && (
              <div className="flex items-center gap-2 text-emerald-600 font-bold animate-in fade-in slide-in-from-left-4">
                <CheckCircle2 className="h-5 w-5" />
                <span>{t('profileUpdated')}</span>
              </div>
            )}
            <div className="flex-grow" />
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="px-8"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
