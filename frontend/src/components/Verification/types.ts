export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'pending_verification' | 'in_review';

export type VerificationDocumentType =
  | 'medical_license'
  | 'degree_certificate'
  | 'government_id'
  | 'professional_photo';

export interface VerificationDocument {
  type: VerificationDocumentType;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

export interface DocumentSlot {
  type: VerificationDocumentType;
  label: string;
  required: boolean;
  description: string;
}
