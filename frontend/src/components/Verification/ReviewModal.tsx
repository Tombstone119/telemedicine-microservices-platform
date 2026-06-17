import React, { useMemo, useState } from 'react';
import { ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import Button from '../UI/Button';
import { VerificationDocument, VerificationStatus } from './types';

export interface ReviewDoctor {
  id: number;
  full_name: string;
  email: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number;
  bio?: string;
  approval_status: VerificationStatus;
  verification_notes?: string;
  verification_documents?: VerificationDocument[];
}

function isImage(url: string, mimeType?: string) {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);
}

export default function ReviewModal({
  open,
  doctor,
  loading,
  onClose,
  onApprove,
  onReject,
}: {
  open: boolean;
  doctor: ReviewDoctor | null;
  loading: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const documents = useMemo(() => doctor?.verification_documents || [], [doctor?.verification_documents]);

  if (!open || !doctor) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#107393]">Doctor Verification Review</p>
            <h3 className="text-xl font-bold text-slate-900">{doctor.full_name}</h3>
          </div>
          <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-80px)] gap-0 overflow-auto lg:grid-cols-[1.2fr_1fr]">
          <section className="border-r border-slate-200 p-6">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Documents</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {documents.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No verification documents uploaded.
                </div>
              )}
              {documents.map((doc) => (
                <button
                  key={`${doc.type}-${doc.url}`}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-[#107393]/40"
                  onClick={() => setActiveUrl(doc.url)}
                >
                  <div className="flex h-36 items-center justify-center overflow-hidden bg-slate-100">
                    {isImage(doc.url, doc.mimeType) ? (
                      <img src={doc.url} alt={doc.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <FileText className="h-12 w-12 text-[#107393]" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800">{doc.type.replace('_', ' ')}</p>
                    <p className="truncate text-xs text-slate-500">{doc.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 p-6">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Profile Summary</h4>
            <Info label="Full Name" value={doctor.full_name} />
            <Info label="Email" value={doctor.email} />
            <Info label="Specialty" value={doctor.specialty || 'Not specified'} />
            <Info label="Qualification" value={doctor.qualification || 'Not specified'} />
            <Info
              label="Consultation Fee"
              value={doctor.consultation_fee != null ? `Rs. ${Number(doctor.consultation_fee).toLocaleString()}` : 'Not set'}
            />
            <Info label="Bio" value={doctor.bio || 'No biography provided'} multiline />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Actions</p>
              <div className="mt-3 space-y-2">
                <Button loading={loading} onClick={onApprove} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Approve Doctor
                </Button>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Enter rejection reason (required if rejecting)"
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-300"
                />
                <Button
                  loading={loading}
                  variant="danger"
                  className="w-full"
                  onClick={() => onReject(rejectionReason.trim())}
                >
                  Reject Doctor
                </Button>
              </div>
            </div>

            {doctor.verification_notes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="text-xs font-semibold uppercase tracking-wider">Last verification note</p>
                <p className="mt-1">{doctor.verification_notes}</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {activeUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={() => setActiveUrl(null)}>
          <div className="max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Document Preview</p>
              <a href={activeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#107393]">
                Open
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-100 p-4">
              {isImage(activeUrl) ? (
                <img src={activeUrl} alt="Verification document preview" className="mx-auto max-h-[75vh] rounded-lg object-contain" />
              ) : (
                <iframe title="Document preview" src={activeUrl} className="h-[75vh] w-[80vw] max-w-4xl rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-800 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
    </div>
  );
}
