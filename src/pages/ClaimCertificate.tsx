import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Award, Download, CheckCircle, Loader2, Globe, Trophy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translations, Language as LangType } from '../i18n/translations';

interface CertificateData {
  certId: string;
  userId: string;
  name: string;
  email: string;
  score: number;
  date: string;
  language: LangType;
  course: string;
  hash: string;
  qrUrl: string;
}

// SHA256 Hash Function
async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ClaimCertificate() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const { t, language: currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LangType>(currentLanguage);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [certificateName, setCertificateName] = useState(auth.currentUser?.displayName || '');
  const certificateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!resultId || !auth.currentUser) return;

      try {
        // Check if certificate already exists
        const certsQuery = query(
          collection(db, 'certificates'),
          where('userId', '==', auth.currentUser.uid)
        );
        const certsSnap = await getDocs(certsQuery);
        if (!certsSnap.empty) {
          setCertificate(certsSnap.docs[0].data() as CertificateData);
        }

        const resultDoc = await getDoc(doc(db, 'results', resultId));
        if (resultDoc.exists()) {
          const data = resultDoc.data();
          setResult(data);
          
          const percentage = (data.score / data.totalQuestions) * 100;
          if (percentage < 70) {
            navigate(`/result/${resultId}`);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resultId, navigate]);

  const handleGenerate = async () => {
    if (!result || !auth.currentUser) return;
    setGenerating(true);

    try {
      // Generate unique ID format: WA-2025-XXXXX
      const randomNum = Math.floor(Math.random() * 99999) + 1;
      const certId = `WA-2025-${randomNum.toString().padStart(5, '0')}`;
      const date = new Date().toISOString();
      const name = certificateName || auth.currentUser?.displayName || 'Student';
      const email = auth.currentUser.email || '';
      const score = result.score;
      
      // Generate SHA256 Hash
      const hash = await sha256(`${name}${score}${date}${certId}`);
      
      const verificationUrl = `${window.location.origin}/verify?certId=${certId}`;

      const certData: CertificateData = {
        certId,
        userId: auth.currentUser.uid,
        name,
        email,
        score,
        date,
        language: selectedLanguage,
        course: translations[selectedLanguage].courseName,
        hash,
        qrUrl: verificationUrl
      };

      await setDoc(doc(db, 'certificates', certId), certData);
      setCertificate(certData);

      // MOCK EMAIL SENDING
      console.log(`Sending email to ${email} with certificate ID ${certId}`);
      
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!certificateRef.current) return;

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Wanky_Academy_Certificate_${certificate?.certId}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!result) return <div>{t('resultNotFound')}</div>;

  const verificationUrl = `${window.location.origin}/verify?certId=${certificate?.certId}`;

  // Helper to get translation for a specific language (for the certificate itself)
  const getCertText = (key: keyof typeof translations.ht, lang?: LangType) => {
    const targetLang = lang || (certificate?.language) || selectedLanguage;
    return translations[targetLang][key];
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <Award className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{t('claimYourCertificate')}</h1>
        <p className="mt-2 text-slate-600">{t('claimSubtitle')}</p>
      </div>

      {!certificate ? (
        <Card className="mx-auto max-w-md p-8">
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('fullNameOnCertificate')}
              </label>
              <input
                type="text"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                placeholder={t('enterFullName')}
                className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                {t('nameModificationWarning')}
              </p>
            </div>

            <div className="flex justify-center gap-4">
              {(['ht', 'fr', 'es'] as LangType[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all ${
                    selectedLanguage === lang ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Globe className="h-5 w-5" />
                  <span className="text-xs font-medium uppercase">{lang === 'ht' ? 'Kreyòl' : lang === 'fr' ? 'Français' : 'Español'}</span>
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !certificateName.trim()}
            className="w-full"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            {t('generateCertificate')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-center gap-4">
            <Button onClick={downloadPDF} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t('downloadPDF')}
            </Button>
          </div>

          {/* Certificate Preview */}
          <div className="overflow-x-auto pb-8">
            <div
              ref={certificateRef}
              className="relative mx-auto h-[210mm] w-[297mm] bg-white p-[15mm] shadow-2xl"
              style={{ minWidth: '297mm' }}
            >
              {/* Border */}
              <div className="h-full w-full border-[8px] border-double border-emerald-800 p-8">
                <div className="h-full w-full border-2 border-emerald-600 p-12 text-center">
                  {/* Logo */}
                  <img
                    src="https://i.postimg.cc/wTr99qNp/d-modern-logo-icon-for-Wanky-Academy-WA-1.png"
                    alt="Wanky Academy Logo"
                    className="mx-auto mb-8 h-32 w-32 object-contain"
                    referrerPolicy="no-referrer"
                  />

                  <h1 className="font-serif text-6xl font-bold tracking-widest text-emerald-900">
                    WANKY ACADEMY
                  </h1>
                  
                  <div className="my-8 flex items-center justify-center gap-4">
                    <div className="h-px w-24 bg-emerald-600"></div>
                    <h2 className="font-serif text-2xl font-medium tracking-widest text-emerald-700">
                      {getCertText('certificateTitle')}
                    </h2>
                    <div className="h-px w-24 bg-emerald-600"></div>
                  </div>

                  <p className="mt-12 text-xl italic text-slate-600">
                    {getCertText('certifyThat')}
                  </p>
                  
                  <h3 className="mt-4 text-5xl font-bold text-slate-900 underline decoration-emerald-600 decoration-2 underline-offset-8">
                    {certificate.name}
                  </h3>

                  <p className="mt-12 text-xl italic text-slate-600">
                    {getCertText('completedCourse')}
                  </p>

                  <h4 className="mt-4 text-3xl font-bold text-emerald-800">
                    {getCertText('courseName')}
                  </h4>

                  {/* Excellence Badge */}
                  {((certificate.score / (result?.totalQuestions || 50)) * 100) >= 90 && (
                    <div className="mt-8 flex flex-col items-center">
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400 shadow-lg ring-4 ring-yellow-200">
                        <Trophy className="h-12 w-12 text-yellow-900" />
                        <div className="absolute -bottom-2 whitespace-nowrap rounded-full bg-yellow-900 px-3 py-1 text-[10px] font-bold uppercase text-yellow-400">
                          {getCertText('excellence')}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-16 grid grid-cols-2 items-end gap-16">
                    {/* QR Code & Seal */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-emerald-600 bg-emerald-50 shadow-inner">
                        <QRCodeSVG value={verificationUrl} size={100} />
                      </div>
                      <p className="text-xs font-mono text-slate-400">ID: {certificate.certId}</p>
                    </div>

                    {/* Signature - Instructor */}
                    <div className="text-center">
                      <div className="mb-2 flex justify-center h-20 items-end">
                        <img 
                          src="https://i.postimg.cc/4NC3JYZC/firma.png" 
                          alt="Instructor Signature" 
                          className="h-24 w-auto object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="mb-2 h-px w-full bg-slate-400"></div>
                      <p className="font-serif text-lg font-bold text-slate-800 uppercase tracking-wide">WANKY MASSENAT</p>
                      <p className="text-sm font-medium text-emerald-700 uppercase tracking-widest">{getCertText('instructor')}</p>
                    </div>
                  </div>

                  <div className="mt-12 flex flex-col items-center gap-4">
                    <div className="flex justify-center gap-12 text-sm text-slate-500">
                      <p>
                        <span className="font-bold">{getCertText('dateIssued')}</span>{' '}
                        {new Date(certificate.date).toLocaleDateString()}
                      </p>
                      <p>
                        <span className="font-bold">{getCertText('duration')}</span>{' '}
                        {getCertText('courseDuration')}
                      </p>
                    </div>
                    
                    {/* Blockchain Hash */}
                    <div className="max-w-md text-center">
                      <p className="text-[10px] font-mono text-slate-400 break-all leading-tight">
                        Verification Hash: {certificate.hash}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
