import React, { useRef, useState } from 'react';
import { FileCheck2, FileText, ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import Button from '../UI/Button';
import { DocumentSlot } from './types';

function isImageFile(mimeType: string, fileName: string) {
  return mimeType.startsWith('image/') || /\.(png|jpe?g)$/i.test(fileName);
}

function isPdfFile(mimeType: string, fileName: string) {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
}

export type DocumentUploaderValue = {
  name: string;
  url: string;
  mimeType: string;
  file?: File;
};

export default function DocumentUploader({
  slot,
  value,
  error,
  disabled,
  onSelect,
  onRemove,
}: {
  slot: DocumentSlot;
  value: DocumentUploaderValue | null;
  error?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onSelect(files[0]);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {slot.label}
            {slot.required && <span className="ml-1 text-red-500">*</span>}
          </h3>
          <p className="text-xs text-slate-500">{slot.description}</p>
        </div>
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            <FileCheck2 className="h-3.5 w-3.5" />
            Uploaded
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Missing</span>
        )}
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-4 transition ${
          dragActive ? 'border-[#107393] bg-[#107393]/5' : 'border-slate-300 bg-slate-50'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (disabled) return;
          handleFiles(event.dataTransfer.files);
        }}
      >
        {value ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-200">
                {isImageFile(value.mimeType, value.name) ? (
                  <img src={value.url} alt={value.name} className="h-full w-full object-cover" />
                ) : isPdfFile(value.mimeType, value.name) ? (
                  <FileText className="h-7 w-7 text-red-600" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-slate-600" />
                )}
              </div>
              <div>
                <p className="max-w-[230px] truncate text-sm font-semibold text-slate-900">{value.name}</p>
                <p className="text-xs text-slate-500">{value.mimeType || 'Unknown file type'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="px-3 py-2 text-xs" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
                Re-upload
              </Button>
              <Button type="button" variant="danger" className="px-3 py-2 text-xs" disabled={disabled} onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <UploadCloud className="h-7 w-7 text-[#107393]" />
            <p className="text-sm font-medium text-slate-700">Drag and drop file here</p>
            <p className="text-xs text-slate-500">PDF, JPG, PNG up to 5MB</p>
            <Button type="button" variant="outline" className="px-3 py-2 text-xs" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
              Choose File
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(event) => handleFiles(event.target.files)}
        disabled={disabled}
      />
    </div>
  );
}
