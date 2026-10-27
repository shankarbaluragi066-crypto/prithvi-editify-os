import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Send,
  Paperclip,
  Sparkles,
  Link2,
  IndianRupee,
  Layers,
  X,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { inquirySchema, InquiryFormValues } from '../schemas/validation';
import {
  submitInquiryRecord,
  uploadInquiryReferenceFile,
  fetchPublishedServices,
} from '../services/crmService';
import { ServiceItem } from '../types/crm';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';

const SERVICE_OPTIONS = [
  'Graphic Design',
  'YouTube Thumbnail Design',
  'Social Media Design',
  'Logo and Brand Design',
  'Banner and Flyer Design',
  'Promotional Ad Creatives',
  'YouTube Video Editing',
  'Instagram Reels Editing',
  'Social Media Content',
  'Photo Editing',
  'Custom Creative Project',
];

const BUDGET_RANGES = [
  'Under ₹1,000',
  '₹1,000 – ₹2,500',
  '₹2,500 – ₹5,000',
  '₹5,000 – ₹15,000',
  '₹15,000 – ₹35,000',
  '₹35,000+ (Monthly Retainer / Campaign)',
];

const PLATFORM_FORMAT_OPTIONS = [
  'YouTube Thumbnail / Video (16:9)',
  'Instagram Reels / YouTube Shorts (9:16)',
  'Instagram / LinkedIn Post (1:1 or 4:5)',
  'Logo & Brand Identity Package',
  'Promotional Banner / Poster / Flyer',
  'Photo Retouching & Color Grading',
  'Custom / Multiple Platforms',
];

export interface InquiryFormProps {
  defaultService?: string;
  defaultCustomPrice?: string;
  defaultReferenceLink?: string;
  customBudgetRanges?: string[];
  selectedServiceItem?: ServiceItem | null;
  onSuccessClose?: () => void;
}

interface SubmittedOrderConfirmation {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName?: string;
  serviceRequired: string;
  budgetRange: string;
  preferredDeadline?: string;
  referenceFileUrl?: string;
  description: string;
}

export const InquiryForm: React.FC<InquiryFormProps> = ({
  defaultService,
  defaultCustomPrice,
  defaultReferenceLink,
  customBudgetRanges,
  selectedServiceItem,
  onSuccessClose,
}) => {
  const { showToast } = useToast();
  const { user, profile, isClient } = useAuth();
  const [searchParams] = useSearchParams();
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceLink, setReferenceLink] = useState<string>(defaultReferenceLink || '');
  const [customPriceInput, setCustomPriceInput] = useState<string>(defaultCustomPrice || '');
  const [deliverableQty, setDeliverableQty] = useState<string>('1');
  const [platformFormat, setPlatformFormat] = useState<string>(PLATFORM_FORMAT_OPTIONS[0]);
  const [serviceSpecificNotes, setServiceSpecificNotes] = useState<string>('');
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrderConfirmation | null>(null);
  const [lastFingerprint, setLastFingerprint] = useState<string>('');
  const [serviceOptions, setServiceOptions] = useState<string[]>(SERVICE_OPTIONS);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);

  const activeBudgetRanges =
    customBudgetRanges && customBudgetRanges.length > 0 ? customBudgetRanges : BUDGET_RANGES;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      fullName: isClient ? profile?.displayName || user?.displayName || '' : '',
      email: isClient ? profile?.email || user?.email || '' : '',
      phone: isClient ? profile?.phone || '' : '',
      companyName: isClient ? profile?.companyName || '' : '',
      serviceRequired: defaultService || SERVICE_OPTIONS[0],
      budgetRange: defaultCustomPrice || activeBudgetRanges[1] || activeBudgetRanges[0],
      preferredDeadline: '',
      description: '',
      privacyConsent: false,
    },
  });

  const currentBudgetRange = watch('budgetRange');

  useEffect(() => {
    if (isClient && (profile || user)) {
      if (profile?.displayName || user?.displayName) {
        setValue('fullName', profile?.displayName || user?.displayName || '');
      }
      if (profile?.email || user?.email) {
        setValue('email', profile?.email || user?.email || '');
      }
      if (profile?.phone) {
        setValue('phone', profile.phone);
      }
      if (profile?.companyName) {
        setValue('companyName', profile.companyName);
      }
    }
  }, [isClient, profile, user, setValue]);

  useEffect(() => {
    if (defaultCustomPrice !== undefined) {
      setCustomPriceInput(defaultCustomPrice);
      if (defaultCustomPrice.trim()) {
        setValue('budgetRange', defaultCustomPrice.trim(), { shouldValidate: true });
      }
    }
  }, [defaultCustomPrice, setValue]);

  useEffect(() => {
    if (defaultReferenceLink !== undefined) {
      setReferenceLink(defaultReferenceLink);
    }
  }, [defaultReferenceLink]);

  useEffect(() => {
    fetchPublishedServices()
      .then((list) => {
        if (list.length > 0) {
          const mapped = Array.from(
            new Set([
              ...list.map(
                (s) => `${s.title} (${s.isCustomQuote ? 'Custom quote' : s.priceDisplay})`
              ),
              'Custom Creative Project',
            ])
          );
          setServiceOptions(() => {
            const combined = [...mapped];
            if (defaultService && !combined.includes(defaultService)) {
              combined.unshift(defaultService);
            }
            return Array.from(new Set(combined));
          });
          if (!defaultService && !searchParams.get('service')) {
            setValue('serviceRequired', mapped[0]);
          }
        }
      })
      .catch(() => {});
  }, [defaultService, searchParams, setValue]);

  useEffect(() => {
    const queryService = searchParams.get('service');
    const queryBudget = searchParams.get('budget');
    const queryScope = searchParams.get('scope');
    const queryLink = searchParams.get('link');
    const targetService = queryService || defaultService;

    if (targetService) {
      const cleanTarget = targetService.trim().toLowerCase();
      const matched = serviceOptions.find(
        (opt) =>
          opt.toLowerCase() === cleanTarget ||
          opt.toLowerCase().startsWith(cleanTarget) ||
          opt.toLowerCase().includes(cleanTarget)
      );
      if (matched) {
        setValue('serviceRequired', matched);
      } else {
        setServiceOptions((prev) =>
          Array.from(new Set(prev.includes(targetService) ? prev : [targetService, ...prev]))
        );
        setValue('serviceRequired', targetService);
      }
    }

    if (queryBudget) {
      setCustomPriceInput(queryBudget);
      setValue('budgetRange', queryBudget);
    }

    if (queryLink) {
      setReferenceLink(queryLink);
    }

    if (queryScope) {
      setValue('description', queryScope, { shouldValidate: true });
      setPrefillNotice(
        'Service scope & custom price range prefilled below — enter your service details and submit your booking!'
      );
    }
  }, [defaultService, searchParams, serviceOptions, setValue]);

  useEffect(() => {
    const handleCustomPrefill = (event: Event) => {
      const customEvent = event as CustomEvent<{
        serviceRequired?: string;
        budgetRange?: string;
        description?: string;
        referenceLink?: string;
      }>;
      if (!customEvent.detail) return;
      const { serviceRequired, budgetRange, description, referenceLink: evLink } = customEvent.detail;
      if (serviceRequired) {
        setServiceOptions((prev) =>
          Array.from(new Set(prev.includes(serviceRequired) ? prev : [serviceRequired, ...prev]))
        );
        setValue('serviceRequired', serviceRequired);
      }
      if (budgetRange) {
        setCustomPriceInput(budgetRange);
        setValue('budgetRange', budgetRange);
      }
      if (evLink) {
        setReferenceLink(evLink);
      }
      if (description) {
        setValue('description', description, { shouldValidate: true });
      }
      setPrefillNotice(
        'Service scope & estimated INR range prefilled below — add your contact details and submit!'
      );
    };

    window.addEventListener('pe-prefill-inquiry', handleCustomPrefill);
    return () => window.removeEventListener('pe-prefill-inquiry', handleCustomPrefill);
  }, [setValue]);

  const onSubmit = async (values: InquiryFormValues) => {
    const finalBudget = customPriceInput.trim() || values.budgetRange;
    const structuredServiceMeta = [
      `[Service Booking Details]`,
      `• Quantity / Deliverables: ${deliverableQty || '1'}`,
      `• Target Platform / Format: ${platformFormat}`,
      `• Custom Price / Budget: ${finalBudget}`,
      serviceSpecificNotes.trim()
        ? `• Headline / Style / Creative Details: ${serviceSpecificNotes.trim()}`
        : '',
      referenceLink.trim() ? `• Reference / Asset Link: ${referenceLink.trim()}` : '',
      ``,
      `[Client Brief & Notes]`,
      values.description.trim(),
    ]
      .filter(Boolean)
      .join('\n');

    const fingerprint = `${values.email.toLowerCase()}_${values.serviceRequired}_${structuredServiceMeta.slice(0, 40)}`;
    if (fingerprint === lastFingerprint) {
      showToast(
        'warning',
        'Duplicate Booking Prevented',
        'We have already received this exact service booking.'
      );
      return;
    }

    try {
      let referenceFileUrl = referenceLink.trim();
      if (referenceFile) {
        if (referenceFile.size > 15 * 1024 * 1024) {
          showToast('error', 'File Too Large', 'Reference file must be under 15 MB.');
          return;
        }
        try {
          const uploadedUrl = await uploadInquiryReferenceFile(referenceFile);
          referenceFileUrl = referenceLink.trim()
            ? `${referenceLink.trim()} | File: ${uploadedUrl}`
            : uploadedUrl;
        } catch {
          referenceFileUrl = referenceLink.trim()
            ? `${referenceLink.trim()} (Attached file: ${referenceFile.name})`
            : `Reference file attached: ${referenceFile.name}`;
        }
      }

      const id = await submitInquiryRecord({
        ...values,
        budgetRange: finalBudget.slice(0, 100),
        description: structuredServiceMeta.slice(0, 3000),
        referenceFileUrl,
      });

      const confirmationPayload: SubmittedOrderConfirmation = {
        id,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        companyName: values.companyName,
        serviceRequired: values.serviceRequired,
        budgetRange: finalBudget.slice(0, 100),
        preferredDeadline: values.preferredDeadline,
        referenceFileUrl,
        description: structuredServiceMeta.slice(0, 3000),
      };

      setLastFingerprint(fingerprint);
      setSubmittedOrder(confirmationPayload);
      setReferenceFile(null);
      reset();
      showToast(
        'success',
        'Service Booking Confirmed',
        'Thank you! Your project booking has been received by Prithvi Editify.'
      );
    } catch (err) {
      showToast(
        'error',
        'Submission Failed',
        err instanceof Error ? err.message : 'Unable to submit booking right now.'
      );
    }
  };

  if (submittedOrder) {
    const shortId = submittedOrder.id.slice(0, 8).toUpperCase();
    return (
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 space-y-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3 text-[#10B981]">
          <CheckCircle2 className="w-7 h-7 shrink-0 mt-0.5" />
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2DD4BF] block">
              Order Reference #{shortId}
            </span>
            <h3 className="text-xl font-semibold text-[#F8FAFC] mt-0.5">
              Service Booking Confirmed
            </h3>
          </div>
        </div>

        <p className="text-sm text-[#94A3B8] leading-relaxed">
          Thank you, <span className="font-semibold text-[#F8FAFC]">{submittedOrder.fullName}</span>! Your booking for{' '}
          <span className="font-semibold text-[#F8FAFC]">{submittedOrder.serviceRequired}</span> has been received by Prithvi Editify. We will review your project brief and reach out shortly with your confirmed timeline.
        </p>

        {/* Booked Order Summary Receipt */}
        <div className="p-4 bg-[#132A4A]/50 border border-[#1E3A5F] rounded-xl space-y-2 text-xs">
          <p className="font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-2">
            Booked Order Summary
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <p className="text-[#94A3B8]">
              <span className="text-[#F8FAFC] font-medium">Service:</span>{' '}
              {submittedOrder.serviceRequired}
            </p>
            <p className="text-[#94A3B8]">
              <span className="text-[#F8FAFC] font-medium">Custom Price Range:</span>{' '}
              <span className="font-mono text-[#2DD4BF] font-semibold">
                {submittedOrder.budgetRange}
              </span>
            </p>
            <p className="text-[#94A3B8]">
              <span className="text-[#F8FAFC] font-medium">Customer:</span>{' '}
              {submittedOrder.fullName} ({submittedOrder.phone})
            </p>
            <p className="text-[#94A3B8]">
              <span className="text-[#F8FAFC] font-medium">Customer Email:</span>{' '}
              {submittedOrder.email}
            </p>
            {submittedOrder.referenceFileUrl && (
              <p className="text-[#94A3B8] sm:col-span-2 truncate">
                <span className="text-[#F8FAFC] font-medium">Reference Link:</span>{' '}
                {submittedOrder.referenceFileUrl}
              </p>
            )}
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSubmittedOrder(null)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Book Another Service
          </button>

          <Link
            to="/services"
            className="px-4 py-2.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#081629] border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Back to Services
          </Link>

          {onSuccessClose && (
            <button
              type="button"
              onClick={onSuccessClose}
              className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] rounded-lg transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-6 sm:p-8 space-y-5 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
    >
      {prefillNotice && (
        <div className="p-3.5 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg text-xs text-[#2DD4BF] font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>{prefillNotice}</span>
        </div>
      )}

      {/* Selected Service Banner when triggered from Book Now */}
      {selectedServiceItem && (
        <div className="p-4 bg-[#132A4A]/80 border border-[#10B981]/40 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981]">
              Selected Service · Single Rate
            </span>
            <h4 className="text-sm font-semibold text-[#F8FAFC]">{selectedServiceItem.title}</h4>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#94A3B8]">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#10B981]" />
                {selectedServiceItem.turnaroundTime || '24–48 hours'}
              </span>
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-[#10B981]" />
                {selectedServiceItem.revisions || '2 Revisions'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">
              Standard Rate
            </span>
            <span className="font-mono text-lg font-bold text-[#2DD4BF]">
              {selectedServiceItem.priceDisplay}
            </span>
          </div>
        </div>
      )}

      {/* 1. Service Selection, Custom Price Range & Reference Link */}
      <div className="p-4 bg-[#081629]/90 border border-[#1E3A5F] rounded-xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2DD4BF]">
          <Layers className="w-4 h-4 text-[#10B981]" />
          <span>Step 1: Service, Custom Price Range & Reference Link</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="inq-service" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Selected Service *
            </label>
            <select
              id="inq-service"
              {...register('serviceRequired')}
              className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC] transition-colors"
            >
              {serviceOptions.map((opt, idx) => (
                <option key={`${opt}_${idx}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {errors.serviceRequired && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.serviceRequired.message}</p>
            )}
          </div>

          {/* Custom Price Range Input */}
          <div>
            <label
              htmlFor="inq-custom-price"
              className="block text-xs font-medium text-[#F8FAFC] mb-1.5"
            >
              Your Custom Price Range / Budget (INR) *
            </label>
            <div className="relative">
              <IndianRupee className="w-3.5 h-3.5 text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="inq-custom-price"
                type="text"
                value={customPriceInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomPriceInput(val);
                  setValue('budgetRange', val.trim() || activeBudgetRanges[0], {
                    shouldValidate: true,
                  });
                }}
                placeholder="e.g. ₹500 – ₹1,200 or ₹2,500"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC] placeholder-[#64748B] transition-colors"
              />
            </div>
            {/* Quick Preset Range Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeBudgetRanges.slice(0, 4).map((range, idx) => (
                <button
                  key={`${range}_${idx}`}
                  type="button"
                  onClick={() => {
                    setCustomPriceInput(range);
                    setValue('budgetRange', range, { shouldValidate: true });
                  }}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                    (customPriceInput || currentBudgetRange) === range
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#2DD4BF]'
                      : 'bg-[#132A4A]/50 border-[#1E3A5F] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            {errors.budgetRange && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.budgetRange.message}</p>
            )}
          </div>

          {/* Reference / Project Link Input */}
          <div>
            <label htmlFor="inq-ref-link" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Reference / Footage / Brand Link (URL)
            </label>
            <div className="relative">
              <Link2 className="w-3.5 h-3.5 text-[#0EA5E9] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="inq-ref-link"
                type="url"
                value={referenceLink}
                onChange={(e) => setReferenceLink(e.target.value)}
                placeholder="https://drive.google.com/... or YouTube link"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC] placeholder-[#64748B] transition-colors"
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1.5">
              Paste Google Drive, YouTube, Instagram, or reference sample link for this service.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Service-Related Details Section */}
      <div className="p-4 bg-[#081629]/90 border border-[#1E3A5F] rounded-xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2DD4BF]">
          <Sparkles className="w-4 h-4 text-[#10B981]" />
          <span>Step 2: Service-Related Project Details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="inq-qty" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Number of Deliverables / Qty
            </label>
            <input
              id="inq-qty"
              type="text"
              value={deliverableQty}
              onChange={(e) => setDeliverableQty(e.target.value)}
              placeholder="e.g. 1 Design, 5 Thumbnails, 3 Reels"
              className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC]"
            />
          </div>

          <div>
            <label htmlFor="inq-platform" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Target Platform & Aspect Ratio
            </label>
            <select
              id="inq-platform"
              value={platformFormat}
              onChange={(e) => setPlatformFormat(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC]"
            >
              {PLATFORM_FORMAT_OPTIONS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inq-deadline" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Preferred Delivery Date
            </label>
            <input
              id="inq-deadline"
              type="date"
              {...register('preferredDeadline')}
              className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="inq-headline-style"
              className="block text-xs font-medium text-[#F8FAFC] mb-1.5"
            >
              Headline Text / Color Theme / Editing Style
            </label>
            <input
              id="inq-headline-style"
              type="text"
              value={serviceSpecificNotes}
              onChange={(e) => setServiceSpecificNotes(e.target.value)}
              placeholder="e.g. Exact text on thumbnail/poster, preferred brand colors, fast-paced cuts, subtitles..."
              className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC]"
            />
          </div>

          <div>
            <label htmlFor="inq-file" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
              Attach Reference File (Optional)
            </label>
            <label
              htmlFor="inq-file"
              className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-[#94A3B8] bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg cursor-pointer hover:border-[#10B981] transition-colors truncate"
            >
              <Paperclip className="w-4 h-4 shrink-0 text-[#F8FAFC]" />
              <span className="truncate">
                {referenceFile ? referenceFile.name : 'Upload image, PDF, or asset'}
              </span>
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
          <label
            htmlFor="inq-description"
            className="block text-xs font-medium text-[#F8FAFC] mb-1.5"
          >
            Detailed Service Requirements & Project Brief *
          </label>
          <textarea
            id="inq-description"
            rows={3}
            placeholder="Describe what you need created or edited, specific instructions, target audience, and any special requirements..."
            {...register('description')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/70 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] text-[#F8FAFC] transition-colors"
          />
          {errors.description && (
            <p className="text-xs text-[#DC2626] mt-1">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* 3. Customer Contact Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="inq-fullName" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
            Your Full Name *
          </label>
          <input
            id="inq-fullName"
            type="text"
            placeholder="Aarav Sharma"
            {...register('fullName')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] focus:bg-[#132A4A] transition-colors"
          />
          {errors.fullName && (
            <p className="text-xs text-[#DC2626] mt-1">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="inq-email" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
            Email Address *
          </label>
          <input
            id="inq-email"
            type="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] focus:bg-[#132A4A] transition-colors"
          />
          {errors.email && <p className="text-xs text-[#DC2626] mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-phone" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
            WhatsApp or Phone Number *
          </label>
          <input
            id="inq-phone"
            type="tel"
            placeholder="+91 98765 43210"
            {...register('phone')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] focus:bg-[#132A4A] transition-colors"
          />
          {errors.phone && <p className="text-xs text-[#DC2626] mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="inq-company" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
            Company, Channel, or Brand Name
          </label>
          <input
            id="inq-company"
            type="text"
            placeholder="Your Brand or YouTube Channel"
            {...register('companyName')}
            className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981] focus:bg-[#132A4A] transition-colors"
          />
          {errors.companyName && (
            <p className="text-xs text-[#DC2626] mt-1">{errors.companyName.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id="inq-consent"
          type="checkbox"
          {...register('privacyConsent')}
          className="mt-1 h-4 w-4 rounded border-[#1E3A5F] text-[#F8FAFC] focus:ring-[#10B981]"
        />
        <label htmlFor="inq-consent" className="text-xs text-[#94A3B8] leading-relaxed">
          I consent to Prithvi Editify storing my contact, custom price range, reference link, and brief details to process this service booking in accordance with the{' '}
          <Link to="/privacy" className="underline text-[#F8FAFC] hover:text-[#10B981]">
            Privacy Policy
          </Link>
          . *
        </label>
      </div>
      {errors.privacyConsent && (
        <p className="text-xs text-[#DC2626]">{errors.privacyConsent.message}</p>
      )}

      <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
        {onSuccessClose && (
          <button
            type="button"
            onClick={onSuccessClose}
            className="px-4 py-2.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#132A4A] rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Submitting Booking...' : 'Confirm & Submit Service Booking'}
        </button>
      </div>
    </form>
  );
};

// ============================================================================
// SERVICE BOOKING MODAL — Opens when customer clicks "Book Now" on any service
// ============================================================================
export interface ServiceBookingModalPayload {
  service: ServiceItem;
  customPriceRange?: string;
  referenceLink?: string;
}

export const ServiceBookingModal: React.FC<{
  booking: ServiceBookingModalPayload | null;
  customBudgetRanges?: string[];
  onClose: () => void;
}> = ({ booking, customBudgetRanges, onClose }) => {
  if (!booking) return null;

  const { service, customPriceRange, referenceLink } = booking;
  const serviceLabel = `${service.title} (${
    service.isCustomQuote ? 'Custom quote' : service.priceDisplay
  })`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040D1A]/80 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#081629] border border-[#1E3A5F] rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-[#081629]/95 backdrop-blur-md border-b border-[#1E3A5F] flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] block">
              Book Creative Service
            </span>
            <h2 id="booking-modal-title" className="text-lg font-semibold text-[#F8FAFC]">
              {service.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-lg transition-colors"
            aria-label="Close booking form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6">
          <InquiryForm
            key={`${service.id}_${customPriceRange || ''}_${referenceLink || ''}`}
            defaultService={serviceLabel}
            defaultCustomPrice={customPriceRange || service.priceDisplay}
            defaultReferenceLink={referenceLink || ''}
            customBudgetRanges={customBudgetRanges}
            selectedServiceItem={service}
            onSuccessClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

