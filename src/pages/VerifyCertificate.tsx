import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CheckCircle2, XCircle, ShieldCheck, Calendar, User, BookOpen, Loader2, Home, Fingerprint, AlertCircle } from 'lucide-react';

// SHA256 Hash Function (same as in ClaimCertificate)
async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const certId = searchParams.get('certId');
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<any>(null);
  const [isHashValid, setIsHashValid] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchCert = async () => {
      if (!certId) {
        setLoading(false);
        return;
      }

      try {
        const certDoc = await getDoc(doc(db, 'certificates', certId));
        if (certDoc.exists()) {
          const data = certDoc.data();
          setCertificate(data);
          
          // Verify Hash
          const calculatedHash = await sha256(`${data.name}${data.score}${data.date}${data.certId}`);
          setIsHashValid(calculatedHash === data.hash);
        }
      } catch (error) {
        console.error('Error fetching certificate:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCert();
  }, [certId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <ShieldCheck className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Certificate Verification</h1>
        <p className="mt-2 text-slate-600">Verify the authenticity of Wanky Academy certificates using blockchain-style hashing.</p>
      </div>

      {!certId ? (
        <Card className="p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">No Certificate ID Provided</h2>
          <p className="mt-2 text-slate-600">Please scan a valid QR code or enter a certificate ID.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </Card>
      ) : !certificate ? (
        <Card className="p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Invalid Certificate</h2>
          <p className="mt-2 text-slate-600">The certificate ID <strong>{certId}</strong> was not found in our records.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden border-emerald-100 bg-white shadow-xl">
          <div className={`${isHashValid ? 'bg-emerald-600' : 'bg-red-600'} px-8 py-6 text-center text-white`}>
            {isHashValid ? <CheckCircle2 className="mx-auto h-12 w-12" /> : <AlertCircle className="mx-auto h-12 w-12" />}
            <h2 className="mt-2 text-2xl font-bold">{isHashValid ? 'Verified Certificate' : 'Verification Failed'}</h2>
            <p className={isHashValid ? 'text-emerald-100' : 'text-red-100'}>
              {isHashValid ? 'This certificate is authentic and valid.' : 'The certificate hash does not match our records.'}
            </p>
          </div>

          <div className="p-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Student Name</p>
                  <p className="text-xl font-bold text-slate-900">{certificate.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Course Completed</p>
                  <p className="text-xl font-bold text-slate-900">{certificate.course}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Issue Date</p>
                    <p className="text-lg font-bold text-slate-900">{new Date(certificate.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Certificate ID</p>
                    <p className="text-lg font-bold text-emerald-700 font-mono">{certificate.certId}</p>
                  </div>
                </div>
              </div>

              {/* Hash Verification Details */}
              <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Fingerprint className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Blockchain Hash Verification</p>
                </div>
                <p className="text-[10px] font-mono text-slate-500 break-all leading-tight mb-2">
                  {certificate.hash}
                </p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isHashValid ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <p className={`text-xs font-bold ${isHashValid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isHashValid ? 'Hash Match Confirmed' : 'Hash Mismatch - Potential Tampering Detected'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-slate-100 pt-8 text-center">
              <p className="text-sm text-slate-500">
                Wanky Academy ensures the quality and integrity of its educational programs using advanced cryptographic verification.
              </p>
              <Link to="/" className="mt-6 inline-block">
                <Button variant="outline">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
