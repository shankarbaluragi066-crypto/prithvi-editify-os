import {
  ServiceItem,
  PortfolioItem,
  PublicSettings,
  PrivateSettings,
  SiteCustomization,
} from '../types/crm';

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
      <radialGradient id="glow" cx="78%" cy="32%" r="48%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <rect width="800" height="600" fill="url(#glow)"/>
    <g stroke="#ffffff" stroke-opacity="0.06" stroke-width="1">
      <line x1="72" y1="0" x2="72" y2="600"/>
      <line x1="400" y1="0" x2="400" y2="600" stroke-dasharray="4 6"/>
      <line x1="728" y1="0" x2="728" y2="600"/>
      <line x1="0" y1="88" x2="800" y2="88"/>
      <line x1="0" y1="512" x2="800" y2="512"/>
    </g>
    <rect x="72" y="88" width="656" height="424" rx="10" fill="#172333" fill-opacity="0.68" stroke="#ffffff" stroke-opacity="0.14"/>
    <line x1="72" y1="136" x2="728" y2="136" stroke="#ffffff" stroke-opacity="0.09"/>
    <circle cx="100" cy="112" r="4" fill="${accentColor}" fill-opacity="0.85"/>
    <circle cx="116" cy="112" r="4" fill="#ffffff" fill-opacity="0.22"/>
    <circle cx="132" cy="112" r="4" fill="#ffffff" fill-opacity="0.12"/>
    <text x="696" y="116" text-anchor="end" fill="#9BA3B0" font-family="monospace" font-size="11" letter-spacing="1.2">PRITHVI EDITIFY · STUDIO</text>
    <circle cx="624" cy="248" r="88" fill="${accentColor}" fill-opacity="0.12"/>
    <circle cx="624" cy="248" r="52" fill="none" stroke="${accentColor}" stroke-width="1.75" stroke-opacity="0.65"/>
    <circle cx="624" cy="248" r="4" fill="${accentColor}"/>
    <rect x="120" y="176" width="64" height="4" rx="2" fill="${accentColor}"/>
    <text x="120" y="232" fill="#F5F5F1" font-family="Georgia, 'Times New Roman', serif" font-size="33" font-weight="600" letter-spacing="-0.4">${safeTitle}</text>
    <text x="120" y="270" fill="#D0D5DD" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="15" letter-spacing="0.3">${safeSub}</text>
    <g transform="translate(120, 344)">
      <rect x="0" y="0" width="176" height="108" rx="6" fill="#24364A" fill-opacity="0.85" stroke="#ffffff" stroke-opacity="0.12"/>
      <rect x="20" y="22" width="64" height="7" rx="3.5" fill="${accentColor}"/>
      <rect x="20" y="42" width="124" height="6" rx="3" fill="#ffffff" fill-opacity="0.38"/>
      <rect x="20" y="56" width="96" height="6" rx="3" fill="#ffffff" fill-opacity="0.2"/>
      <text x="20" y="86" fill="#9BA3B0" font-family="monospace" font-size="10" letter-spacing="0.8">LAYOUT &amp; GRID</text>
      <rect x="196" y="0" width="360" height="108" rx="6" fill="#24364A" fill-opacity="0.85" stroke="#ffffff" stroke-opacity="0.12"/>
      <line x1="220" y1="38" x2="532" y2="38" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>
      <line x1="220" y1="38" x2="395" y2="38" stroke="${accentColor}" stroke-width="2.5"/>
      <circle cx="395" cy="38" r="6" fill="#F5F5F1" stroke="${accentColor}" stroke-width="2"/>
      <rect x="220" y="56" width="88" height="10" rx="3" fill="#ffffff" fill-opacity="0.18"/>
      <rect x="316" y="56" width="128" height="10" rx="3" fill="${accentColor}" fill-opacity="0.32"/>
      <rect x="452" y="56" width="80" height="10" rx="3" fill="#ffffff" fill-opacity="0.12"/>
      <text x="220" y="88" fill="#9BA3B0" font-family="monospace" font-size="10" letter-spacing="0.8">MASTER TIMELINE · COLOR CALIBRATED</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_SITE_CUSTOMIZATION: SiteCustomization = {
  logoUrl: '',
  primaryColor: '#172333',
  secondaryColor: '#24364A',
  accentColor: '#F18A45',
  backgroundColor: '#F5F5F1',
  announcementEnabled: false,
  announcementText:
    'Now accepting new graphic design, YouTube thumbnail & video editing briefs — fast studio turnaround.',
  announcementCtaLabel: 'Start a Brief →',
  announcementCtaLink: '/contact',

  navHomeLabel: 'Home',
  navServicesLabel: 'Services',
  navPortfolioLabel: 'Portfolio',
  navAboutLabel: 'About',
  navContactLabel: 'Contact',
  navPortalButtonLabel: 'Client Portal',
  showServicesNav: true,
  showPortfolioNav: true,
  showAboutNav: true,
  showContactNav: true,

  heroKicker: 'Prithvi Editify · Independent Design & Video Studio',
  heroHeadline: 'Creative work. Clear process.',
  heroSubheadline:
    'Professional design and video editing for brands, creators, and growing businesses.',
  heroPrimaryCtaLabel: 'Start a Project',
  heroPrimaryCtaLink: '/contact',
  heroSecondaryCtaLabel: 'Explore Portfolio',
  heroSecondaryCtaLink: '/portfolio',
  heroDisciplines: [
    'Graphic Design',
    'YouTube Thumbnails',
    'Social Media Content',
    'Video & Reels Editing',
  ],
  showcaseTitle: 'Studio Production Architecture',
  showcaseSubtitle: 'Brief → Scope & INR Quote → Review Portal → Master Delivery',
  showcaseBadge: 'INR PRICING',
  heroImageUrl: '',
  heroArtworkTitle: 'Prithvi Editify',
  heroArtworkSubtitle: 'Design Grids · Thumbnails · Video Timelines',
  stat1Label: 'Starting Design Rates',
  stat1Value: '₹400 – ₹750',
  stat1Subtext: 'Per graphic / creative',
  stat2Label: 'Client Workspace',
  stat2Value: 'Live Portal',
  stat2Subtext: 'Files, timeline & invoices',

  showServicesSection: true,
  homeServicesKicker: '01. Capabilities & Starting Rates',
  homeServicesHeading: 'Services built for clarity and visual impact',
  homeServicesCtaLabel: 'View Full Rate Card (INR)',
  homePortfolioKicker: '02. Selected Studio Work',
  homePortfolioHeading: 'Design systems, packaging, and editorial cuts',
  homePortfolioCtaLabel: 'Browse Complete Portfolio',
  showProcessSection: true,
  processKicker: '03. Studio Workflow',
  processHeading: 'A structured four-step process from brief to final files',
  processSteps: [
    {
      step: '01. Share your brief',
      desc: 'Submit your project requirements, target platform, references, and preferred deadline through our inquiry form.',
    },
    {
      step: '02. Confirm scope & quote',
      desc: 'Receive a clear written scope, timeline, and transparent INR quote before production begins.',
    },
    {
      step: '03. Create and review',
      desc: 'Track progress inside your private Client Portal, view design previews, and leave structured feedback.',
    },
    {
      step: '04. Approve & receive files',
      desc: 'Approve final deliverables, settle the invoice balance, and download high-resolution master files.',
    },
  ],
  showTrustSection: true,
  trustKicker: '04. Why Work With Prithvi Editify',
  trustHeading: 'Built on clear communication and organised delivery',
  trustSubtitle:
    'Every project is managed through a dedicated client workspace so briefs, revision notes, deliverables, and invoices never get lost in scattered chat threads.',
  trustPillars: [
    {
      title: 'Organised Project Tracking',
      desc: 'Clients log in to see exact project statuses, milestone checklists, and expected delivery dates in real time.',
    },
    {
      title: 'Transparent INR Pricing',
      desc: 'Published starting rates for standard design assets and itemised INR invoices for custom video editing scopes.',
    },
    {
      title: 'Protected Deliverable Access',
      desc: 'Reference files, draft previews, and final master exports are privately scoped to your authenticated client account.',
    },
  ],
  showHomeContactSection: true,
  homeContactKicker: '05. Start a Project',
  homeContactHeading: 'Share your project brief with Shankar Baluragi',
  homeContactDesc:
    'Fill out the project inquiry form with your required deliverables, timeline, and budget range. You can also initiate a direct conversation on WhatsApp.',

  servicesPageKicker: 'Prithvi Editify · Creative Services Marketplace',
  servicesPageTitle: 'Creative Services',
  servicesPageDescription:
    'Professional design, video editing and digital creative solutions for your brand.',
  portfolioPageKicker: 'Prithvi Editify · Curated Project Showcase',
  portfolioPageTitle: 'Creative Portfolio',
  portfolioPageDescription:
    'Explore selected design, branding, thumbnail and video editing projects by Prithvi Editify.',

  aboutKicker: 'About the Studio',
  aboutHeading: 'Independent creative direction by Shankar Baluragi',
  aboutParagraph1:
    'Prithvi Editify helps businesses, creators, brands, and organisations communicate through professional graphic design, social media creatives, YouTube thumbnails, video editing, and promotional content.',
  aboutParagraph2:
    'Instead of treating creative production like an unpredictable freelance exchange, Prithvi Editify combines studio-grade design craft with a dedicated client portal. Every client gets clear scope documentation, milestone tracking, structured revision workflows, and itemised INR billing.',
  aboutPrimaryCtaLabel: 'Start a Project',
  aboutSecondaryCtaLabel: 'View Services & Pricing',
  founderImageUrl: '',
  founderName: 'Shankar Baluragi',
  founderRole: 'Founder · Graphic Design, Video Editing & Social Media Content Systems',
  aboutPillars: [
    {
      title: '01. Design & Editorial Restraint',
      desc: 'Every graphic, thumbnail, and video frame is structured around visual hierarchy, readability, and brand recognition rather than generic templates.',
    },
    {
      title: '02. Dedicated Client Portal',
      desc: 'Review drafts, track project progress percentages, download final files, and access printable INR invoices in one private workspace.',
    },
    {
      title: '03. Direct Studio Accountability',
      desc: 'Work directly with Shankar Baluragi from initial brief to final file delivery with clear turnaround commitments.',
    },
  ],

  contactKicker: 'Project Inquiry & Contact',
  contactHeading: 'Let’s scope your next creative project',
  contactDescription:
    'Complete the project inquiry form to share your deliverables, timeline, and budget range. All inquiries are saved securely to our studio CRM.',
  whatsappCardTitle: 'WhatsApp Direct Chat',
  whatsappCardDesc:
    'Prefer a quick preliminary discussion on WhatsApp? Click below to open WhatsApp with a prefilled project message.',
  whatsappButtonLabel: 'Discuss on WhatsApp',
  workingHours: 'Mon – Sat · 10:00 AM – 7:00 PM IST',
  inquiryBudgetRanges: [
    'Under ₹2,500',
    '₹2,500 – ₹5,000',
    '₹5,000 – ₹15,000',
    '₹15,000 – ₹35,000',
    '₹35,000+ (Monthly Retainer / Campaign)',
  ],

  footerStudioLabel: 'Independent Creative Studio · Led by Shankar Baluragi',
  copyrightText: 'All rights reserved.',
  instagramUrl: '',
  youtubeUrl: '',
  linkedinUrl: '',
  behanceUrl: '',
  twitterUrl: '',
  legalEffectiveDate: 'October 2026',
  privacySections: [
    {
      heading: '1. Information We Collect',
      body: 'When you submit a project inquiry or access the Prithvi Editify Client Portal, we collect your name, email address, phone/WhatsApp number, company or brand name, project brief details, and any reference files you upload.',
    },
    {
      heading: '2. How Your Data Is Used',
      body: 'Your information is used strictly to evaluate project inquiries, prepare scope quotes, deliver creative files, issue invoices, and communicate project updates. We never sell or rent client data to third parties.',
    },
    {
      heading: '3. Data Isolation & Security',
      body: 'All records are stored in Supabase PostgreSQL and Supabase Storage protected by Row Level Security (RLS) policies. Clients can only access their own projects, deliverables, and invoices.',
    },
    {
      heading: '4. Data Retention & Deletion',
      body: 'You may request correction or deletion of your inquiry or client profile data at any time by contacting Shankar Baluragi through the studio contact page.',
    },
  ],
  termsSections: [
    {
      heading: '1. Scope & Starting Prices',
      body: 'Prices displayed on the website (in INR) are starting estimates. Every project is confirmed with a written brief and agreed budget before production begins.',
    },
    {
      heading: '2. Revisions & Approvals',
      body: 'Clients can review drafts and request revisions directly inside the Client Portal. Additional revisions outside the agreed project brief may incur an agreed supplemental fee.',
    },
    {
      heading: '3. Invoicing & Deliverable Usage Rights',
      body: 'Final master deliverables are released for commercial client use upon settlement of the corresponding invoice balance, unless otherwise specified in the written project agreement.',
    },
  ],
  seoTitle: 'Prithvi Editify — Creative Design & Video Editing Studio',
  seoDescription:
    'Professional graphic design, YouTube thumbnails, social media creatives, and video editing studio led by Shankar Baluragi.',
};

export function mergeSiteCustomization(
  raw?: Partial<SiteCustomization> | Record<string, any> | null
): SiteCustomization {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SITE_CUSTOMIZATION };
  }
  const merged: SiteCustomization = {
    ...DEFAULT_SITE_CUSTOMIZATION,
    ...raw,
    servicesPageTitle:
      !raw.servicesPageTitle ||
      raw.servicesPageTitle === 'Transparent starting prices for creative production'
        ? DEFAULT_SITE_CUSTOMIZATION.servicesPageTitle
        : String(raw.servicesPageTitle),
    servicesPageDescription:
      !raw.servicesPageDescription ||
      String(raw.servicesPageDescription).startsWith(
        'All listed rates are starting prices in Indian Rupees'
      )
        ? DEFAULT_SITE_CUSTOMIZATION.servicesPageDescription
        : String(raw.servicesPageDescription),
    portfolioPageDescription:
      !raw.portfolioPageDescription ||
      String(raw.portfolioPageDescription).startsWith(
        'Explore graphic design, social media creatives, YouTube thumbnails'
      )
        ? DEFAULT_SITE_CUSTOMIZATION.portfolioPageDescription
        : String(raw.portfolioPageDescription),
    heroDisciplines:
      Array.isArray(raw.heroDisciplines) && raw.heroDisciplines.length > 0
        ? raw.heroDisciplines.map(String)
        : DEFAULT_SITE_CUSTOMIZATION.heroDisciplines,
    processSteps:
      Array.isArray(raw.processSteps) && raw.processSteps.length > 0
        ? raw.processSteps.map((s: any, idx: number) => ({
            step: String(
              s?.step ??
                DEFAULT_SITE_CUSTOMIZATION.processSteps[idx]?.step ??
                `0${idx + 1}. Step`
            ),
            desc: String(s?.desc ?? DEFAULT_SITE_CUSTOMIZATION.processSteps[idx]?.desc ?? ''),
          }))
        : DEFAULT_SITE_CUSTOMIZATION.processSteps,
    trustPillars:
      Array.isArray(raw.trustPillars) && raw.trustPillars.length > 0
        ? raw.trustPillars.map((p: any, idx: number) => ({
            title: String(
              p?.title ?? DEFAULT_SITE_CUSTOMIZATION.trustPillars[idx]?.title ?? 'Studio Pillar'
            ),
            desc: String(p?.desc ?? DEFAULT_SITE_CUSTOMIZATION.trustPillars[idx]?.desc ?? ''),
          }))
        : DEFAULT_SITE_CUSTOMIZATION.trustPillars,
    aboutPillars:
      Array.isArray(raw.aboutPillars) && raw.aboutPillars.length > 0
        ? raw.aboutPillars.map((p: any, idx: number) => ({
            title: String(
              p?.title ?? DEFAULT_SITE_CUSTOMIZATION.aboutPillars[idx]?.title ?? 'Studio Value'
            ),
            desc: String(p?.desc ?? DEFAULT_SITE_CUSTOMIZATION.aboutPillars[idx]?.desc ?? ''),
          }))
        : DEFAULT_SITE_CUSTOMIZATION.aboutPillars,
    inquiryBudgetRanges:
      Array.isArray(raw.inquiryBudgetRanges) && raw.inquiryBudgetRanges.length > 0
        ? raw.inquiryBudgetRanges.map(String).filter(Boolean)
        : DEFAULT_SITE_CUSTOMIZATION.inquiryBudgetRanges,
    privacySections:
      Array.isArray(raw.privacySections) && raw.privacySections.length > 0
        ? raw.privacySections.map((sec: any, idx: number) => ({
            heading: String(
              sec?.heading ??
                DEFAULT_SITE_CUSTOMIZATION.privacySections[idx]?.heading ??
                'Section'
            ),
            body: String(sec?.body ?? DEFAULT_SITE_CUSTOMIZATION.privacySections[idx]?.body ?? ''),
          }))
        : DEFAULT_SITE_CUSTOMIZATION.privacySections,
    termsSections:
      Array.isArray(raw.termsSections) && raw.termsSections.length > 0
        ? raw.termsSections.map((sec: any, idx: number) => ({
            heading: String(
              sec?.heading ?? DEFAULT_SITE_CUSTOMIZATION.termsSections[idx]?.heading ?? 'Section'
            ),
            body: String(sec?.body ?? DEFAULT_SITE_CUSTOMIZATION.termsSections[idx]?.body ?? ''),
          }))
        : DEFAULT_SITE_CUSTOMIZATION.termsSections,
  };
  return merged;
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
  siteCustomization: DEFAULT_SITE_CUSTOMIZATION,
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
