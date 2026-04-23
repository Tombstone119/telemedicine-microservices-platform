import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Clock3, RefreshCcw } from 'lucide-react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DocumentUploader, { DocumentUploaderValue } from '../../components/Verification/DocumentUploader';
import StatusTimeline from '../../components/Verification/StatusTimeline';
import { DocumentSlot, VerificationDocument, VerificationStatus } from '../../components/Verification/types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

const documentSlots: DocumentSlot[] = [
  {
    type: 'medical_license',
    label: 'Medical License',
    required: true,
    description: 'Valid medical council license copy (PDF/JPG/PNG)',
  },
  {
    type: 'degree_certificate',
    label: 'Degree Certificate',
    required: true,
    description: 'MBBS/MD or equivalent degree certificate',
  },
  {
    type: 'government_id',
    label: 'Government ID',
    required: true,
    description: 'National ID card or passport (clear photo)',
  },
  {
    type: 'professional_photo',
    label: 'Professional Photo',
    required: false,
    description: 'Optional profile photo for doctor card',
  },
];

type DoctorVerificationProfile = {
  id?: number;
  approval_status?: VerificationStatus;
  verification_notes?: string | null;
  verification_documents?: VerificationDocument[];
};

function isAcceptedType(file: File) {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return /\.(pdf|png|jpe?g)$/i.test(file.name);
}

function asDocumentArray(payload: unknown): VerificationDocument[] {
  if (!Array.isArray(payload)) return [];

  const result: VerificationDocument[] = [];
  payload.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Record<string, unknown>;
    const type = candidate.type;
    const name = candidate.name;
    const url = candidate.url;

    if (
      (type === 'medical_license' ||
        type === 'degree_certificate' ||
        type === 'government_id' ||
        type === 'professional_photo') &&
      typeof name === 'string' &&
      typeof url === 'string'
    ) {
      result.push({
        type,
        name,
        url,
        mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : undefined,
        size: typeof candidate.size === 'number' ? candidate.size : undefined,
        uploadedAt: typeof candidate.uploadedAt === 'string' ? candidate.uploadedAt : undefined,
      });
    }
  });

  return result;
}

function extractUploadedDocuments(payload: unknown): VerificationDocument[] {
  if (!payload || typeof payload !== 'object') return [];
  const source = payload as Record<string, unknown>;

  const direct = asDocumentArray(source.documents);
  if (direct.length > 0) return direct;

  const urls = source.urls;
  if (Array.isArray(urls)) {
    return urls
      .map((url, index) => {
        if (typeof url !== 'string') return null;
        const fallbackType = documentSlots[Math.min(index, documentSlots.length - 1)]?.type || 'medical_license';
        return {
          type: fallbackType,
          name: `${fallbackType}.${url.includes('.pdf') ? 'pdf' : 'file'}`,
          url,
        } as VerificationDocument;
      })
      .filter((item): item is VerificationDocument => Boolean(item));
  }

  return [];
}

function mergeDocumentLists(current: VerificationDocument[], uploaded: VerificationDocument[]) {
  const byType = new Map<string, VerificationDocument>();
  current.forEach((item) => byType.set(item.type, item));
  uploaded.forEach((item) => byType.set(item.type, item));
  return Array.from(byType.values());
}

function getStatusText(status: VerificationStatus, notes: string) {
  if (status === 'rejected') {
    return {
      tone: 'rejected' as const,
      title: 'Verification Rejected',
      body: notes || 'Your previous submission needs corrections. Update files and resubmit.',
    };
  }

  if (status === 'approved') {
    return {
      tone: 'approved' as const,
      title: 'Verification Approved',
      body: 'You are fully verified and can now access your doctor workspace.',
    };
  }

  return {
    tone: 'pending' as const,
    title: 'Under Review',
    body: 'Typical wait time is 2-4 hours. We will notify you via email/SMS once verified.',
  };
}

export default function Verification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<Record<string, DocumentUploaderValue | null>>({});
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [notes, setNotes] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});

  const requiredTypes = useMemo(() => documentSlots.filter((slot) => slot.required).map((slot) => slot.type), []);

  const uploadedDocumentList = useMemo<VerificationDocument[]>(() => {
    return Object.entries(documents)
      .filter((entry): entry is [string, DocumentUploaderValue] => Boolean(entry[1]))
      .map(([type, value]) => ({
        type: type as VerificationDocument['type'],
        name: value.name,
        url: value.url,
        mimeType: value.mimeType,
        size: value.file?.size,
        uploadedAt: new Date().toISOString(),
      }));
  }, [documents]);

  const allRequiredUploaded = requiredTypes.every((type) => Boolean(documents[type]));

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/doctors/profile');
      const payload = (data?.data || data || {}) as DoctorVerificationProfile;

      const backendStatus = payload.approval_status || 'pending';
      const backendNotes = payload.verification_notes || '';
      const backendDocs = asDocumentArray(payload.verification_documents);

      const nextDocs: Record<string, DocumentUploaderValue | null> = {};
      documentSlots.forEach((slot) => {
        const doc = backendDocs.find((item) => item.type === slot.type);
        nextDocs[slot.type] =
          doc && doc.url
            ? {
                name: doc.name,
                url: doc.url,
                mimeType: doc.mimeType || '',
              }
            : null;
      });

      setDocuments(nextDocs);
      setStatus(backendStatus);
      setNotes(backendNotes);

      if (backendStatus === 'approved') {
        setCelebrating(true);
      }
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : undefined;
      toast.error(message || 'Unable to load verification details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'doctor') {
      navigate('/login', { replace: true });
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => navigate('/doctor', { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [celebrating, navigate]);

  const handleSelectFile = (slot: DocumentSlot, file: File) => {
    const nextErrors = { ...inputErrors };

    if (!isAcceptedType(file)) {
      nextErrors[slot.type] = 'Unsupported file type. Use PDF, JPG, or PNG.';
      setInputErrors(nextErrors);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      nextErrors[slot.type] = 'File is too large. Maximum size is 5MB.';
      setInputErrors(nextErrors);
      return;
    }

    delete nextErrors[slot.type];
    setInputErrors(nextErrors);

    const previewUrl = URL.createObjectURL(file);
    setDocuments((current) => ({
      ...current,
      [slot.type]: {
        name: file.name,
        url: previewUrl,
        mimeType: file.type,
        file,
      },
    }));
  };

  const handleRemoveFile = (slotType: string) => {
    setDocuments((current) => {
      const existing = current[slotType];
      if (existing?.file) {
        URL.revokeObjectURL(existing.url);
      }
      return { ...current, [slotType]: null };
    });
  };

  const submitForReview = async () => {
    if (!allRequiredUploaded) {
      toast.error('Please upload all required documents before submitting.');
      return;
    }

    const missingFileObjects = documentSlots
      .filter((slot) => slot.required)
      .some((slot) => !documents[slot.type]?.file && !(documents[slot.type]?.url || '').startsWith('http'));

    if (missingFileObjects) {
      toast.error('Please re-upload required files before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      documentSlots.forEach((slot) => {
        const doc = documents[slot.type];
        if (!doc) return;

        if (doc.file) {
          formData.append('files', doc.file, doc.name);
          formData.append(`document_${slot.type}`, doc.file, doc.name);
        }
      });

      formData.append(
        'meta',
        JSON.stringify(
          documentSlots
            .map((slot) => {
              const doc = documents[slot.type];
              if (!doc) return null;
              return {
                type: slot.type,
                name: doc.name,
                mimeType: doc.mimeType,
              };
            })
            .filter(Boolean)
        )
      );

      let uploadedDocuments = uploadedDocumentList;

      try {
        const uploadResponse = await api.post('/doctors/verification/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const uploaded = extractUploadedDocuments(uploadResponse.data);
        if (uploaded.length > 0) {
          uploadedDocuments = mergeDocumentLists(uploadedDocumentList, uploaded);
        }
      } catch {
        // Keep local document list if upload endpoint returns unsupported payload.
      }

      try {
        await api.put('/doctors/profile', {
          approval_status: 'pending',
          verification_documents: uploadedDocuments,
          verification_notes: null,
        });
      } catch {
        await api.post('/doctors/verification/submit', {
          approval_status: 'pending',
          verification_documents: uploadedDocuments,
          verification_notes: null,
        });
      }

      setStatus('pending');
      setNotes('');
      toast.success('Your application is under review. You will be notified via email/SMS.');
      await loadProfile();
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : undefined;
      toast.error(message || 'Unable to submit verification application');
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = getStatusText(status, notes);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#107393] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {celebrating && <ConfettiOverlay />}

      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#0e657f] via-[#107393] to-[#2fa4c8] p-6 text-white shadow-2xl shadow-[#107393]/20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Doctor Verification</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Complete Identity Verification</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90">
          Upload your professional credentials to unlock full doctor capabilities on SUWAPIYASA.LK.
        </p>
      </Card>

      <StatusTimeline documents={uploadedDocumentList} status={status} />

      <Card className="border border-slate-200/80 bg-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Document Upload Hub</h2>
            <p className="text-sm text-slate-600">Required: Medical license, Degree certificate, Government ID.</p>
          </div>
          <Button type="button" variant="outline" onClick={loadProfile}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {documentSlots.map((slot) => (
            <DocumentUploader
              key={slot.type}
              slot={slot}
              value={documents[slot.type] || null}
              error={inputErrors[slot.type]}
              disabled={submitting}
              onSelect={(file) => handleSelectFile(slot, file)}
              onRemove={() => handleRemoveFile(slot.type)}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {allRequiredUploaded ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Required documents complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                <Clock3 className="h-4 w-4" />
                Upload all required documents to continue
              </span>
            )}
          </div>

          <Button onClick={submitForReview} loading={submitting} disabled={!allRequiredUploaded}>
            {status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
          </Button>
        </div>
      </Card>

      <Card className="border border-slate-200/80 bg-white">
        <h2 className="text-lg font-bold text-slate-900">Status Card</h2>
        <div
          className={`mt-3 rounded-xl border p-4 ${
            statusMeta.tone === 'approved'
              ? 'border-emerald-200 bg-emerald-50'
              : statusMeta.tone === 'rejected'
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p className="text-sm font-bold text-slate-900">{statusMeta.title}</p>
          <p className="mt-1 text-sm text-slate-700">{statusMeta.body}</p>
        </div>

        {status === 'rejected' && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>Update documents based on the rejection reason and click Resubmit.</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.9}s`,
        duration: `${2 + Math.random() * 1.6}s`,
        color: ['#107393', '#22c55e', '#f59e0b', '#ef4444'][index % 4],
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-[-10%] h-3 w-2 rounded-sm opacity-90"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animation: `verification-confetti ${piece.duration} linear ${piece.delay} forwards`,
          }}
        />
      ))}

      <style>
        {`@keyframes verification-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }`}
      </style>
    </div>
  );
}
