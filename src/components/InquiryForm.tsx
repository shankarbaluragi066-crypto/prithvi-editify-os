import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send, Paperclip } from 'lucide-react';
import { inquirySchema, InquiryFormValues } from '../schemas/validation';
import { submitInquiryRecord, uploadInquiryReferenceFile } from '../services/crmService';
import { useToast } from '../contexts/ToastContext';
import { Link } from 'react-router-dom';

const SERVICE_OPTIONS = [
  'Social Media Post Design (Starting ₹500/design)',
  'Promotional Ad Creative (Starting ₹650/design)',
  'Banner / Digital Flyer (Starting ₹500/design)',
  'Marketing Graphic (Starting ₹400/design)',
  'Campaign Creative (Starting ₹450/design)',
  'Brand-Focused Digital Content (Starting ₹750/design)',
  'YouTube Thumbnail (₹450–₹700/design)',
  'YouTube Video Editing (Custom quote)',
  'Instagram Reels Editing (Custom quote)',
  'Other Creative Services (Custom quote)',
];

const BUDGET_RANGES = [
  'Under ₹2,500',
  '₹2,500 – ₹5,000',
  '₹5,000 – ₹15,000',
  '₹15,000 – ₹35,000',
  '₹35,000+ (Monthly Retainer / Campaign)',
];

export const InquiryForm: React.FC<{ defaultService?: string }> = ({ defaultService }) => {
  const { showToast } = useToast();
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [lastFingerprint, setLastFingerprint] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      serviceRequired: defaultService || SERVICE_OPTIONS[0],
      budgetRange: BUDGET_RANGES[1],
      preferredDeadline: '',
      description: '',
      privacyConsent: false,
    },
  });

  const onSubmit = async (values: InquiryFormValues) => {
    const fingerprint = `${values.email.toLowerCase()}_${values.serviceRequired}_${values.description.slice(0, 30)}`;
    if (fingerprint === lastFingerprint) {
      showToast('warning', 'Duplicate Inquiry Prevented', 'We have already received this exact project brief.');
      return;
    }

    try {
      let referenceFileUrl = '';
      if (referenceFile) {
        if (referenceFile.size > 15 * 1024 * 1024) {
          showToast('error', 'File Too Large', 'Reference file must be under 15 MB.');
          return;
        }
        try {
          referenceFileUrl = await uploadInquiryReferenceFile(referenceFile);
        } catch {
          // If Storage bucket is not yet created, record file name in reference field
          referenceFileUrl = `Reference file attached: ${referenceFile.name}`;
        }
      }

      const id = await submitInquiryRecord({
        ...values,
        referenceFileUrl,
      });

      setLastFingerprint(fingerprint);
      setSubmittedId(id);
      setReferenceFile(null);
      reset();
      showToast('success', 'Project Inquiry Received', 'Shankar Baluragi will review your brief and respond shortly.');
    } catch (err) {
      showToast(
        'error',
        'Submission Failed',
        err instanceof Error ? err.message : 'Unable to submit inquiry right now.'
      );
    }
  };

  if (submittedId) {
    return (
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8">
        <div className="flex items-center gap-3 text-[#26734D]">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <h3 className="text-xl font-semibold text-[#172333]">Brief Received by Prithvi Editify</h3>
        </div>
        <p className="text-sm text-[#6E7785] mt-3 leading-relaxed">
          Thank you for sharing your project brief. Your inquiry has been logged in our studio CRM with status{' '}
          <span className="font-medium text-[#172333]">New</span> (Reference ID:{' '}
          <span className="font-mono text-xs text-[#172333]">{submittedId}</span>). Shankar Baluragi will review your
          requirements and respond with scope and pricing details.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setSubmittedId(null)}
            className="px-4 py-2 text-sm font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Submit Another Brief
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-white border border-[#E2E4DF] rounded-lg p-6 sm:p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="inq-fullName" className="block text-xs font-medium text-[#172333] mb-1.5">
            Full Name *
          </label>
          <input
            id="inq-fullName"
            type="text"
            placeholder="Aarav Sharma"
            {...register('fullName')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          />
          {errors.fullName && <p className="text-xs text-[#B93832] mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-email" className="block text-xs font-medium text-[#172333] mb-1.5">
            Email Address *
          </label>
          <input
            id="inq-email"
            type="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          />
          {errors.email && <p className="text-xs text-[#B93832] mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-phone" className="block text-xs font-medium text-[#172333] mb-1.5">
            WhatsApp or Phone Number *
          </label>
          <input
            id="inq-phone"
            type="tel"
            placeholder="+91 98765 43210"
            {...register('phone')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          />
          {errors.phone && <p className="text-xs text-[#B93832] mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-company" className="block text-xs font-medium text-[#172333] mb-1.5">
            Company or Brand Name
          </label>
          <input
            id="inq-company"
            type="text"
            placeholder="Your Brand or Channel"
            {...register('companyName')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          />
          {errors.companyName && <p className="text-xs text-[#B93832] mt-1">{errors.companyName.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-service" className="block text-xs font-medium text-[#172333] mb-1.5">
            Required Service *
          </label>
          <select
            id="inq-service"
            {...register('serviceRequired')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          >
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errors.serviceRequired && <p className="text-xs text-[#B93832] mt-1">{errors.serviceRequired.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-budget" className="block text-xs font-medium text-[#172333] mb-1.5">
            Estimated Budget Range (INR) *
          </label>
          <select
            id="inq-budget"
            {...register('budgetRange')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          >
            {BUDGET_RANGES.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
          {errors.budgetRange && <p className="text-xs text-[#B93832] mt-1">{errors.budgetRange.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-deadline" className="block text-xs font-medium text-[#172333] mb-1.5">
            Preferred Deadline
          </label>
          <input
            id="inq-deadline"
            type="date"
            {...register('preferredDeadline')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label htmlFor="inq-file" className="block text-xs font-medium text-[#172333] mb-1.5">
            Optional Reference File (Max 15 MB)
          </label>
          <label
            htmlFor="inq-file"
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#6E7785] bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg cursor-pointer hover:border-[#172333] transition-colors truncate"
          >
            <Paperclip className="w-4 h-4 shrink-0 text-[#172333]" />
            <span className="truncate">{referenceFile ? referenceFile.name : 'Attach brief PDF, image, or reference'}</span>
            <input
              id="inq-file"
              type="file"
              accept="image/*,.pdf,.zip"
              onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="inq-description" className="block text-xs font-medium text-[#172333] mb-1.5">
          Project Description & Deliverables Needed *
        </label>
        <textarea
          id="inq-description"
          rows={4}
          placeholder="Describe your brand, target platform (YouTube, Instagram, Ad Campaign), number of deliverables, and style references..."
          {...register('description')}
          className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333] focus:bg-white transition-colors"
        />
        {errors.description && <p className="text-xs text-[#B93832] mt-1">{errors.description.message}</p>}
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id="inq-consent"
          type="checkbox"
          {...register('privacyConsent')}
          className="mt-1 h-4 w-4 rounded border-[#E2E4DF] text-[#172333] focus:ring-[#172333]"
        />
        <label htmlFor="inq-consent" className="text-xs text-[#6E7785] leading-relaxed">
          I consent to Prithvi Editify storing my contact and brief details to evaluate and respond to this project inquiry in accordance with the{' '}
          <Link to="/privacy" className="underline text-[#172333] hover:text-[#F18A45]">
            Privacy Policy
          </Link>
          . *
        </label>
      </div>
      {errors.privacyConsent && <p className="text-xs text-[#B93832]">{errors.privacyConsent.message}</p>}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Submitting Brief...' : 'Submit Project Inquiry'}
        </button>
      </div>
    </form>
  );
};
