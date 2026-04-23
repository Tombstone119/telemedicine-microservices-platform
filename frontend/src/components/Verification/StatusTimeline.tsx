import React from 'react';
import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { VerificationDocument, VerificationStatus } from './types';

type TimelineStepState = 'done' | 'active' | 'upcoming' | 'warning';

function stepStyles(state: TimelineStepState) {
  if (state === 'done') {
    return {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      ring: 'border-emerald-200 bg-emerald-50',
      title: 'text-emerald-700',
      body: 'text-emerald-700/80',
      dot: 'bg-emerald-500',
    };
  }

  if (state === 'warning') {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      ring: 'border-red-200 bg-red-50',
      title: 'text-red-700',
      body: 'text-red-700/80',
      dot: 'bg-red-500',
    };
  }

  if (state === 'active') {
    return {
      icon: <Clock3 className="h-5 w-5 text-[#107393]" />,
      ring: 'border-[#107393]/30 bg-[#107393]/10',
      title: 'text-[#0b5f79]',
      body: 'text-[#0b5f79]/80',
      dot: 'bg-[#107393]',
    };
  }

  return {
    icon: <Clock3 className="h-5 w-5 text-slate-400" />,
    ring: 'border-slate-200 bg-slate-50',
    title: 'text-slate-600',
    body: 'text-slate-500',
    dot: 'bg-slate-300',
  };
}

export default function StatusTimeline({
  documents,
  status,
}: {
  documents: VerificationDocument[];
  status: VerificationStatus;
}) {
  const documentUploaded = documents.length > 0;

  const isUnderReview = status === 'pending' || status === 'in_review' || status === 'pending_verification';

  const finalStepState: TimelineStepState =
    status === 'approved' ? 'done' : status === 'rejected' ? 'warning' : 'upcoming';

  const steps: Array<{ title: string; description: string; state: TimelineStepState }> = [
    {
      title: 'Account Created',
      description: 'Your doctor account exists and basic profile details are available.',
      state: 'done',
    },
    {
      title: 'Upload Documents',
      description: 'Provide required files: medical license, degree certificate, and government ID.',
      state: documentUploaded ? 'done' : 'active',
    },
    {
      title: 'Under Review',
      description: 'Our admin team validates your credentials and professional details.',
      state: isUnderReview ? 'active' : documentUploaded ? 'upcoming' : 'upcoming',
    },
    {
      title: status === 'rejected' ? 'Rejected' : 'Approved',
      description:
        status === 'approved'
          ? 'Verification completed successfully. You can now access all doctor features.'
          : status === 'rejected'
            ? 'Your submission was reviewed and requires updates before approval.'
            : 'Final decision will appear here once review is completed.',
      state: finalStepState,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Verification Timeline</h2>
        <span className="rounded-full bg-[#107393]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#107393]">
          Status: {status.replace('_', ' ')}
        </span>
      </div>

      <ol className="space-y-4">
        {steps.map((step, index) => {
          const styles = stepStyles(step.state);
          return (
            <li key={step.title} className="relative pl-10">
              {index < steps.length - 1 && <span className={`absolute left-[14px] top-8 h-[calc(100%-8px)] w-px ${styles.dot}`} />}
              <span className={`absolute left-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-full border ${styles.ring}`}>
                {styles.icon}
              </span>
              <p className={`text-sm font-semibold ${styles.title}`}>{step.title}</p>
              <p className={`text-sm ${styles.body}`}>{step.description}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
