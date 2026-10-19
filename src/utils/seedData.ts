import { ServiceItem, PortfolioItem, PublicSettings, PrivateSettings } from '../types/crm';

/**
 * Generates clean, self-contained SVG data-URI studio artwork so portfolio
 * and service previews never suffer from broken external URLs.
 */
export function createStudioArtworkDataUri(
  title: string,
  subtitle: string,
  accentColor: string = '#F18A45',
  bgPrimary: string = '#172333',
  bgSecondary: string = '#24364A'
): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgPrimary}"/>
        <stop offset="100%" stop-color="${bgSecondary}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1">
      <line x1="80" y1="0" x2="80" y2="600"/>
      <line x1="400" y1="0" x2="400" y2="600"/>
      <line x1="720" y1="0" x2="720" y2="600"/>
      <line x1="0" y1="100" x2="800" y2="100"/>
      <line x1="0" y1="500" x2="800" y2="500"/>
    </g>
    <rect x="80" y="100" width="640" height="400" rx="8" fill="#172333" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.14"/>
    <circle cx="620" cy="220" r="95" fill="${accentColor}" fill-opacity="0.18"/>
    <circle cx="620" cy="220" r="48" fill="none" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.7"/>
    <rect x="128" y="152" width="84" height="6" rx="3" fill="${accentColor}"/>
    <text x="128" y="210" fill="#F5F5F1" font-family="Georgia, serif" font-size="34" font-weight="600">${safeTitle}</text>
    <text x="128" y="252" fill="#9BA3B0" font-family="sans-serif" font-size="16" letter-spacing="0.5">${safeSub}</text>
    <g transform="translate(128, 340)">
      <rect x="0" y="0" width="160" height="84" rx="4" fill="#24364A" stroke="#ffffff" stroke-opacity="0.12"/>
      <rect x="18" y="22" width="70" height="8" rx="4" fill="${accentColor}"/>
      <rect x="18" y="40" width="115" height="6" rx="3" fill="#ffffff" fill-opacity="0.35"/>
      <rect x="18" y="54" width="90" height="6" rx="3" fill="#ffffff" fill-opacity="0.2"/>
      <rect x="180" y="0" width="220" height="84" rx="4" fill="#24364A" stroke="#ffffff" stroke-opacity="0.12"/>
      <line x1="200" y1="42" x2="380" y2="42" stroke="${accentColor}" stroke-width="2"/>
      <circle cx="265" cy="42" r="6" fill="#F5F5F1"/>
      <text x="200" y="68" fill="#9BA3B0" font-family="monospace" font-size="11">PRITHVI EDITIFY STUDIO</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  businessName: 'Prithvi Editify',
  ownerName: 'Shankar Baluragi',
  tagline: 'Professional design and video editing for brands, creators, and growing businesses.',
  businessEmail: 'shankarbaluragi066@gmail.com',
  whatsappNumber: '',
  whatsappDefaultMessage:
    'Hello Prithvi Editify, I would like to discuss a design or video editing project.',
  websiteUrl: '',
  businessAddress: '',
  defaultCurrency: 'INR',
  portfolioVisible: true,
};

export const DEFAULT_PRIVATE_SETTINGS: PrivateSettings = {
  invoicePrefix: 'PE-INV',
  defaultPaymentTerms: '50% advance to initiate project scope; 50% upon final review approval prior to master file handoff.',
  defaultPaymentInstructions:
    'Pay via UPI or Bank Transfer (NEFT/IMPS). Share the UTR/Transaction Reference ID in your client portal or with Shankar Baluragi for verification.',
  defaultTaxRate: 0,
  enableEmailNotifications: true,
};

/**
 * Exact 10 starting-price services specified in Section 7 of the Master Prompt.
 */
export const SEED_SERVICES: Omit<ServiceItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Social Media Post Design',
    slug: 'social-media-post-design',
    category: 'Social Media',
    description:
      'High-impact single-frame or carousel social media posts crafted for brand consistency, legibility, and audience engagement across Instagram, LinkedIn, and X.',
    startingPrice: 500,
    priceDisplay: '₹500/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'Print-ready & web-optimized PNG/JPG, platform aspect ratios, 2 revision rounds.',
    turnaroundTime: '24–48 hours',
    imageUrl: createStudioArtworkDataUri('Social Media Post', 'Brand Grid & Carousel Systems', '#F18A45'),
    published: true,
    sortOrder: 1,
  },
  {
    title: 'Promotional Ad Creative',
    slug: 'promotional-ad-creative',
    category: 'Promotional Ads',
    description:
      'Conversion-oriented static ad creatives structured with clear visual hierarchy, strong focal anchors, and compliant ad copy placement for Meta and Google campaigns.',
    startingPrice: 650,
    priceDisplay: '₹650/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: '1:1, 4:5, and 9:16 ad placements with high-contrast focal typography.',
    turnaroundTime: '48 hours',
    imageUrl: createStudioArtworkDataUri('Promotional Ad Creative', 'Performance Campaign Layout', '#E07A35'),
    published: true,
    sortOrder: 2,
  },
  {
    title: 'Banner / Digital Flyer',
    slug: 'banner-digital-flyer',
    category: 'Graphic Design',
    description:
      'Editorial event flyers, website hero banners, channel headers, and digital announcements tailored to your brand palette and typographic voice.',
    startingPrice: 500,
    priceDisplay: '₹500/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'High-resolution web & print-ready exports in custom dimensions.',
    turnaroundTime: '24–48 hours',
    imageUrl: createStudioArtworkDataUri('Banner & Digital Flyer', 'Display & Event Key Visuals', '#F18A45'),
    published: true,
    sortOrder: 3,
  },
  {
    title: 'Marketing Graphic',
    slug: 'marketing-graphic',
    category: 'Graphic Design',
    description:
      'Clean infographics, product feature callouts, comparison charts, and presentation visuals that clarify complex offerings.',
    startingPrice: 400,
    priceDisplay: '₹400/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'Crisp vector-backed PNG/PDF exports ready for web and pitch decks.',
    turnaroundTime: '24–48 hours',
    imageUrl: createStudioArtworkDataUri('Marketing Graphic', 'Product & Feature Visuals', '#3B82F6'),
    published: true,
    sortOrder: 4,
  },
  {
    title: 'Campaign Creative',
    slug: 'campaign-creative',
    category: 'Promotional Ads',
    description:
      'Cohesive multi-asset visual concepts for product launches, seasonal sales, and creator announcements.',
    startingPrice: 450,
    priceDisplay: '₹450/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'Unified visual motif adapted for feed, story, and banner placements.',
    turnaroundTime: '2–3 business days',
    imageUrl: createStudioArtworkDataUri('Campaign Creative', 'Launch & Seasonal Systems', '#F18A45'),
    published: true,
    sortOrder: 5,
  },
  {
    title: 'Brand-Focused Digital Content',
    slug: 'brand-focused-digital-content',
    category: 'Branding',
    description:
      'Bespoke brand visual assets, typography templates, and editorial content blocks that elevate long-term brand recognition.',
    startingPrice: 750,
    priceDisplay: '₹750/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: 'Master brand graphics, color-calibrated exports, and layout documentation.',
    turnaroundTime: '2–4 business days',
    imageUrl: createStudioArtworkDataUri('Brand Digital Content', 'Visual Identity & Editorial Systems', '#10B981'),
    published: true,
    sortOrder: 6,
  },
  {
    title: 'YouTube Thumbnail',
    slug: 'youtube-thumbnail',
    category: 'YouTube Thumbnails',
    description:
      'Click-worthy, high-contrast YouTube thumbnails engineered for mobile and desktop legibility without cheap clickbait clutter.',
    startingPrice: 450,
    priceDisplay: '₹450–₹700/design',
    pricingUnit: 'design',
    isCustomQuote: false,
    deliverablesSummary: '1920x1080px master PNG, subject cutouts, color grading, and A/B title variant.',
    turnaroundTime: '24 hours',
    imageUrl: createStudioArtworkDataUri('YouTube Thumbnail', 'High-Contrast Creator Packaging', '#F18A45'),
    published: true,
    sortOrder: 7,
  },
  {
    title: 'YouTube Video Editing',
    slug: 'youtube-video-editing',
    category: 'Video Editing',
    description:
      'Long-form documentary, educational, and creator video editing with structured pacing, clean motion callouts, audio leveling, and color grading.',
    startingPrice: 0,
    priceDisplay: 'Custom quote',
    pricingUnit: 'video',
    isCustomQuote: true,
    deliverablesSummary: '4K/1080p H.264 master render, clean audio mix, lower thirds, and revision review link.',
    turnaroundTime: '3–7 business days',
    imageUrl: createStudioArtworkDataUri('YouTube Video Editing', 'Long-Form Narrative & Pacing', '#F18A45', '#101926', '#1E2F42'),
    published: true,
    sortOrder: 8,
  },
  {
    title: 'Instagram Reels Editing',
    slug: 'instagram-reels-editing',
    category: 'Instagram Reels',
    description:
      'Dynamic 9:16 vertical short-form edits with rhythmic cuts, kinetic typography captions, sound design, and retention-focused hooks.',
    startingPrice: 0,
    priceDisplay: 'Custom quote',
    pricingUnit: 'reel',
    isCustomQuote: true,
    deliverablesSummary: '1080x1920px 60fps vertical master + cover frame selection.',
    turnaroundTime: '24–72 hours',
    imageUrl: createStudioArtworkDataUri('Instagram Reels Editing', '9:16 Vertical Motion & Captions', '#F18A45', '#172333', '#2B3E55'),
    published: true,
    sortOrder: 9,
  },
  {
    title: 'Other Creative Services',
    slug: 'other-creative-services',
    category: 'Other',
    description:
      'Custom retainer packages, pitch deck design, channel art kits, or multi-deliverable creative production tailored to your brief.',
    startingPrice: 0,
    priceDisplay: 'Custom quote',
    pricingUnit: 'project',
    isCustomQuote: true,
    deliverablesSummary: 'Scoped specifically to your project brief and timeline.',
    turnaroundTime: 'Custom schedule',
    imageUrl: createStudioArtworkDataUri('Bespoke Creative Scope', 'Custom Studio Retainers & Packages', '#F18A45'),
    published: true,
    sortOrder: 10,
  },
];

/**
 * Sample Portfolio Items — Explicitly marked as Demonstration Content
 * per Section 8 ("Do not invent actual client projects. Clearly label sample records as demonstration content until replaced.")
 */
export const SEED_PORTFOLIO: Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Editorial Product Launch Carousel System (Demonstration Sample)',
    slug: 'editorial-product-launch-carousel-sample',
    category: 'Social Media',
    description:
      'Demonstration portfolio entry showcasing a 6-slide modular Instagram & LinkedIn carousel architecture with typographic hierarchy and warm studio contrast. Replace with live work in Admin > Portfolio.',
    coverImage: createStudioArtworkDataUri('Modular Carousel System', 'Demonstration Sample · Social Media', '#F18A45'),
    projectUrl: '',
    featured: true,
    published: true,
    isSampleContent: true,
    sortOrder: 1,
    metricsSummary: 'Demonstration Layout · 6-Slide Modular Grid · 1080x1350px',
  },
  {
    title: 'Creator Documentary YouTube Thumbnail Study (Demonstration Sample)',
    slug: 'creator-documentary-thumbnail-study-sample',
    category: 'YouTube Thumbnails',
    description:
      'Demonstration portfolio entry illustrating focal subject separation, three-element visual restraint, and color-contrasted title framing for long-form video essays.',
    coverImage: createStudioArtworkDataUri('Documentary Thumbnail Study', 'Demonstration Sample · YouTube Packaging', '#E07A35', '#111B27', '#24364A'),
    projectUrl: '',
    featured: true,
    published: true,
    isSampleContent: true,
    sortOrder: 2,
    metricsSummary: 'Demonstration Layout · A/B Title Variants · 1920x1080px',
  },
  {
    title: 'Long-Form Tech Review & Motion Callouts (Demonstration Sample)',
    slug: 'long-form-tech-review-video-edit-sample',
    category: 'Video Editing',
    description:
      'Demonstration portfolio entry highlighting multi-track timeline organization, clean lower-third spec callouts, J/L audio cuts, and neutral studio color balance.',
    coverImage: createStudioArtworkDataUri('Multi-Track Timeline Edit', 'Demonstration Sample · Video Editing', '#38BDF8', '#0F1824', '#1E2E42'),
    projectUrl: '',
    featured: true,
    published: true,
    isSampleContent: true,
    sortOrder: 3,
    metricsSummary: 'Demonstration Edit · 4K 60fps Timeline · Custom Motion Graphics',
  },
  {
    title: 'Kinetic Typography Reels Template Pack (Demonstration Sample)',
    slug: 'kinetic-typography-reels-sample',
    category: 'Instagram Reels',
    description:
      'Demonstration portfolio entry for 9:16 vertical short-form edits featuring safe-zone caption placement, rhythmic beat markers, and clean visual hooks.',
    coverImage: createStudioArtworkDataUri('9:16 Kinetic Reels', 'Demonstration Sample · Instagram Reels', '#F18A45', '#172333', '#2B3E55'),
    projectUrl: '',
    featured: false,
    published: true,
    isSampleContent: true,
    sortOrder: 4,
    metricsSummary: 'Demonstration Edit · 9:16 Safe-Zone Grid · 60fps Vertical',
  },
  {
    title: 'Direct-to-Consumer Campaign Ad Suite (Demonstration Sample)',
    slug: 'd2c-campaign-ad-suite-sample',
    category: 'Promotional Ads',
    description:
      'Demonstration portfolio entry showing static conversion ad variations across 1:1 square and 4:5 portrait formats with clear value propositions.',
    coverImage: createStudioArtworkDataUri('Conversion Ad Suite', 'Demonstration Sample · Promotional Ads', '#10B981', '#152232', '#223549'),
    projectUrl: '',
    featured: false,
    published: true,
    isSampleContent: true,
    sortOrder: 5,
    metricsSummary: 'Demonstration Layout · Multi-Ratio Ad Set · Static Display',
  },
  {
    title: 'Minimalist Studio Brand Guidelines & Identity (Demonstration Sample)',
    slug: 'minimalist-studio-brand-identity-sample',
    category: 'Branding',
    description:
      'Demonstration portfolio entry presenting typographic pairing rules, color swatch systems, and digital stationery templates.',
    coverImage: createStudioArtworkDataUri('Brand Identity System', 'Demonstration Sample · Branding', '#F18A45', '#172333', '#1F2E40'),
    projectUrl: '',
    featured: false,
    published: true,
    isSampleContent: true,
    sortOrder: 6,
    metricsSummary: 'Demonstration System · Color & Typography Spec · Digital Kit',
  },
];
