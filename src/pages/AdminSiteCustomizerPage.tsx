import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette,
  Layout,
  Sparkles,
  Layers,
  UserCheck,
  FileText,
  Scale,
  Save,
  RotateCcw,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Briefcase,
  FolderOpen,
} from 'lucide-react';
import {
  fetchPublicSettings,
  getCachedPublicSettings,
  savePublicSettings,
  uploadMediaAssetAdmin,
  fetchMediaAssetsAdmin,
} from '../services/crmService';
import {
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_SITE_CUSTOMIZATION,
  mergeSiteCustomization,
} from '../utils/seedData';
import { PublicSettings, SiteCustomization, MediaAsset } from '../types/crm';
import { useToast } from '../contexts/ToastContext';

type CustomizerTab =
  | 'identity'
  | 'navigation'
  | 'hero'
  | 'home_sections'
  | 'about'
  | 'pages_contact'
  | 'legal_seo';

const COLOR_PRESETS = [
  {
    name: 'Prithvi Editify Sapphire & Emerald (Default)',
    primaryColor: '#040D1A',
    secondaryColor: '#081629',
    accentColor: '#10B981',
    backgroundColor: '#040D1A',
  },
  {
    name: 'Oceanic Cerulean & Aqua Mint',
    primaryColor: '#061326',
    secondaryColor: '#0C213D',
    accentColor: '#0EA5E9',
    backgroundColor: '#061326',
  },
  {
    name: 'Midnight Obsidian & Cinema Gold',
    primaryColor: '#090D16',
    secondaryColor: '#111827',
    accentColor: '#F59E0B',
    backgroundColor: '#090D16',
  },
  {
    name: 'Deep Slate & Electric Indigo',
    primaryColor: '#070B14',
    secondaryColor: '#0F172A',
    accentColor: '#6366F1',
    backgroundColor: '#070B14',
  },
];

export const AdminSiteCustomizerPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<CustomizerTab>('identity');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [settings, setSettings] = useState<PublicSettings>(
    () => getCachedPublicSettings() || DEFAULT_PUBLIC_SETTINGS
  );
  const [site, setSite] = useState<SiteCustomization>(() =>
    mergeSiteCustomization((getCachedPublicSettings() || DEFAULT_PUBLIC_SETTINGS).siteCustomization)
  );
  const [budgetRangesText, setBudgetRangesText] = useState<string>(() => {
    const initialSite = mergeSiteCustomization(
      (getCachedPublicSettings() || DEFAULT_PUBLIC_SETTINGS).siteCustomization
    );
    return (initialSite.inquiryBudgetRanges || []).join('\n');
  });
  const [disciplinesText, setDisciplinesText] = useState<string>(() => {
    const initialSite = mergeSiteCustomization(
      (getCachedPublicSettings() || DEFAULT_PUBLIC_SETTINGS).siteCustomization
    );
    return (initialSite.heroDisciplines || []).join(', ');
  });

  // Media Library Picker Modal State
  const [mediaModalTarget, setMediaModalTarget] = useState<
    null | 'logo' | 'heroVisual' | 'founderImage'
  >(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const loadSettings = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const pub = await fetchPublicSettings();
      const mergedSite = mergeSiteCustomization(pub.siteCustomization);
      setSettings(pub);
      setSite(mergedSite);
      setBudgetRangesText((mergedSite.inquiryBudgetRanges || []).join('\n'));
      setDisciplinesText((mergedSite.heroDisciplines || []).join(', '));
    } catch (err: any) {
      showToast('error', 'Failed to load website customization settings', err.message || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings(false);
  }, []);

  const openMediaPicker = async (target: 'logo' | 'heroVisual' | 'founderImage') => {
    setMediaModalTarget(target);
    setLoadingMedia(true);
    try {
      const assets = await fetchMediaAssetsAdmin({ mimeType: 'image' });
      setMediaAssets(assets.filter((a) => a.publicUrl));
    } catch {
      setMediaAssets([]);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleSelectMediaAsset = (url: string) => {
    if (mediaModalTarget === 'logo') {
      setSite((prev) => ({ ...prev, logoUrl: url }));
    } else if (mediaModalTarget === 'heroVisual') {
      setSite((prev) => ({ ...prev, heroImageUrl: url }));
    } else if (mediaModalTarget === 'founderImage') {
      setSite((prev) => ({ ...prev, founderImageUrl: url }));
    }
    setMediaModalTarget(null);
    showToast(
      'success',
      'Image selected from Media Library',
      'Click "Save & Publish Website" to make it live.'
    );
  };

  const handleDirectImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'heroVisual' | 'founderImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(target);
    try {
      const uploaded = await uploadMediaAssetAdmin({
        file,
        targetBucket: 'portfolio-media',
        title: `Website ${target} — ${file.name}`,
        tags: ['website-customizer', target.toLowerCase()],
        isPublic: true,
      });
      if (target === 'logo') {
        setSite((prev) => ({ ...prev, logoUrl: uploaded.publicUrl }));
      } else if (target === 'heroVisual') {
        setSite((prev) => ({ ...prev, heroImageUrl: uploaded.publicUrl }));
      } else if (target === 'founderImage') {
        setSite((prev) => ({ ...prev, founderImageUrl: uploaded.publicUrl }));
      }
      showToast(
        'success',
        'Image uploaded to Studio Storage',
        'Click "Save & Publish Website" to apply it live.'
      );
    } catch (err: any) {
      showToast('error', 'Image upload failed', err.message || '');
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const parsedBudgetRanges = budgetRangesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const parsedDisciplines = disciplinesText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const finalSite: SiteCustomization = {
        ...site,
        heroDisciplines:
          parsedDisciplines.length > 0
            ? parsedDisciplines
            : DEFAULT_SITE_CUSTOMIZATION.heroDisciplines,
        inquiryBudgetRanges:
          parsedBudgetRanges.length > 0
            ? parsedBudgetRanges
            : DEFAULT_SITE_CUSTOMIZATION.inquiryBudgetRanges,
      };

      await savePublicSettings({
        ...settings,
        siteCustomization: finalSite,
      });

      setSite(finalSite);
      showToast(
        'success',
        'Website Published Live',
        'All A-to-Z customizations have been saved and updated across the public website.'
      );
    } catch (err: any) {
      showToast('error', 'Failed to save website customizations', err.message || '');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setSite(DEFAULT_SITE_CUSTOMIZATION);
    setBudgetRangesText(DEFAULT_SITE_CUSTOMIZATION.inquiryBudgetRanges.join('\n'));
    setDisciplinesText(DEFAULT_SITE_CUSTOMIZATION.heroDisciplines.join(', '));
    showToast(
      'warning',
      'Reset to Studio Defaults in Editor',
      'Click "Save & Publish Website" to apply the default configuration.'
    );
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-[#94A3B8]">
        Loading A-to-Z Website Customizer Studio...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#0EA5E9] text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Complete A-to-Z Website Customizer
          </div>
          <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC]">
            Customize Every Page, Section, Image & Theme
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl">
            Edit your studio logo, brand color palette, top announcement bar, navigation menus,
            homepage hero & artwork, process steps, About Studio story, Contact & Inquiry Form
            options, social links, and legal pages — with instant live publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview Live Website
          </Link>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#94A3B8] bg-[#0D1F38] border border-[#1E3A5F] hover:text-[#F8FAFC] hover:border-[#10B981] rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Publishing Changes...' : 'Save & Publish Website'}
          </button>
        </div>
      </div>

      {/* Quick Catalog Shortcuts Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/services"
          className="bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-xl p-4 flex items-center justify-between transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#040D1A] text-[#2DD4BF] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors">
                Manage Services & Pricing Cards
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Add, edit, or reorder your service packages & INR rates
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F8FAFC]" />
        </Link>

        <Link
          to="/admin/portfolio"
          className="bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-xl p-4 flex items-center justify-between transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#040D1A] text-[#2DD4BF] flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors">
                Manage Portfolio Showcases
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Upload videos, thumbnails, and case studies
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F8FAFC]" />
        </Link>

        <Link
          to="/admin/media"
          className="bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-xl p-4 flex items-center justify-between transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#040D1A] text-[#2DD4BF] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors">
                Studio Media Asset Library
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Upload high-res photos, reels, and downloadable assets
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F8FAFC]" />
        </Link>
      </div>

      {/* 7-Tab Navigation Bar */}
      <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-2 flex flex-wrap gap-1.5">
        {[
          { id: 'identity', label: '1. Brand, Logo & Colors', icon: Palette },
          { id: 'navigation', label: '2. Header & Footer Menus', icon: Layout },
          { id: 'hero', label: '3. Homepage Hero & Visual', icon: Sparkles },
          { id: 'home_sections', label: '4. Homepage Sections', icon: Layers },
          { id: 'about', label: '5. About Studio & Founder', icon: UserCheck },
          { id: 'pages_contact', label: '6. Services, Portfolio & Contact', icon: FileText },
          { id: 'legal_seo', label: '7. Legal Policies & SEO', icon: Scale },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as CustomizerTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                active
                  ? 'bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#10B981]'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BRAND IDENTITY, LOGO & THEME COLORS */}
      {activeTab === 'identity' && (
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brand Name, Owner & Logo */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Studio Brand Identity & Logo
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Studio / Business Name
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Studio Owner Name
                </label>
                <input
                  type="text"
                  value={settings.ownerName}
                  onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Brand Tagline (Used in Footer & Summaries)
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            {/* Logo Upload & URL */}
            <div className="pt-2 border-t border-[#1E3A5F] space-y-3">
              <label className="block text-xs font-semibold text-[#F8FAFC]">
                Brand Logo Image (Optional — appears beside Studio Name in Header)
              </label>

              {site.logoUrl && (
                <div className="flex items-center gap-3 p-3 bg-[#132A4A] rounded-lg border border-[#1E3A5F]">
                  <img
                    src={site.logoUrl}
                    alt="Studio Logo Preview"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-contain rounded bg-white border border-[#1E3A5F] p-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#F8FAFC] truncate">Active Logo</p>
                    <p className="text-[11px] text-[#94A3B8] truncate">{site.logoUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSite({ ...site, logoUrl: '' })}
                    className="px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#EF4444]/15 rounded"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingField === 'logo' ? 'Uploading...' : 'Upload Logo File'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingField === 'logo'}
                    onChange={(e) => handleDirectImageUpload(e, 'logo')}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openMediaPicker('logo')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Choose from Media Library
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">
                  Or paste direct Logo Image URL:
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={site.logoUrl}
                  onChange={(e) => setSite({ ...site, logoUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            {/* Announcement Bar */}
            <div className="pt-4 border-t border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#F8FAFC]">
                  Top Announcement Banner Bar
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8FAFC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={site.announcementEnabled}
                    onChange={(e) =>
                      setSite({ ...site, announcementEnabled: e.target.checked })
                    }
                    className="rounded border-[#1E3A5F]"
                  />
                  Show Announcement Bar
                </label>
              </div>

              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Announcement Text</label>
                <input
                  type="text"
                  value={site.announcementText}
                  onChange={(e) => setSite({ ...site, announcementText: e.target.value })}
                  placeholder="e.g., Now booking Q4 Brand Campaigns & Commercial Shoots across Karnataka"
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Action Link Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={site.announcementCtaLabel}
                    onChange={(e) => setSite({ ...site, announcementCtaLabel: e.target.value })}
                    placeholder="Reserve Production Slot →"
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Action Link URL</label>
                  <input
                    type="text"
                    value={site.announcementCtaLink}
                    onChange={(e) => setSite({ ...site, announcementCtaLink: e.target.value })}
                    placeholder="/contact"
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Theme Color Palette */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-5">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Website Color Palette & Presets
            </h2>

            <div>
              <p className="text-xs font-semibold text-[#F8FAFC] mb-2">
                One-Click Studio Color Presets
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setSite({
                        ...site,
                        primaryColor: preset.primaryColor,
                        secondaryColor: preset.secondaryColor,
                        accentColor: preset.accentColor,
                        backgroundColor: preset.backgroundColor,
                      })
                    }
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-[#1E3A5F] hover:border-[#10B981] text-left transition-colors"
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.backgroundColor }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#F8FAFC] truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1E3A5F]">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Primary Brand Color (Deep Ink / Headers)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={site.primaryColor}
                    onChange={(e) => setSite({ ...site, primaryColor: e.target.value })}
                    className="w-10 h-9 rounded border border-[#1E3A5F] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={site.primaryColor}
                    onChange={(e) => setSite({ ...site, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Secondary Dark Surface Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={site.secondaryColor}
                    onChange={(e) => setSite({ ...site, secondaryColor: e.target.value })}
                    className="w-10 h-9 rounded border border-[#1E3A5F] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={site.secondaryColor}
                    onChange={(e) => setSite({ ...site, secondaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Accent CTA Color (Buttons & Highlights)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={site.accentColor}
                    onChange={(e) => setSite({ ...site, accentColor: e.target.value })}
                    className="w-10 h-9 rounded border border-[#1E3A5F] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={site.accentColor}
                    onChange={(e) => setSite({ ...site, accentColor: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Page Background Color (Warm Alabaster)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={site.backgroundColor}
                    onChange={(e) => setSite({ ...site, backgroundColor: e.target.value })}
                    className="w-10 h-9 rounded border border-[#1E3A5F] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={site.backgroundColor}
                    onChange={(e) => setSite({ ...site, backgroundColor: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Live Mini Theme Preview Card */}
            <div
              className="p-5 rounded-xl border border-[#1E3A5F] space-y-3"
              style={{ backgroundColor: site.backgroundColor }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Live Theme Swatch Preview
                </span>
                <span
                  className="px-2.5 py-0.5 rounded text-[11px] font-semibold border border-[#1E3A5F]"
                  style={{ backgroundColor: site.primaryColor, color: '#F8FAFC' }}
                >
                  {settings.businessName || 'Prithvi Editify'}
                </span>
              </div>
              <div
                className="p-4 rounded-lg text-white flex items-center justify-between gap-4"
                style={{ backgroundColor: site.primaryColor }}
              >
                <div>
                  <p className="font-editorial text-base font-semibold">
                    Editorial Visual Production
                  </p>
                  <p className="text-xs text-white/75">
                    Preview of your primary surface & accent button
                  </p>
                </div>
                <span
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#F8FAFC] shrink-0"
                  style={{ backgroundColor: site.accentColor }}
                >
                  {site.heroPrimaryCtaLabel || 'Start a Project'}
                </span>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: HEADER & FOOTER NAVIGATION MENUS + SOCIAL LINKS */}
      {activeTab === 'navigation' && (
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Header Menu Items */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Header Navigation Bar Labels & Visibility
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Home Link Label
                </label>
                <input
                  type="text"
                  value={site.navHomeLabel}
                  onChange={(e) => setSite({ ...site, navHomeLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Client Portal Button Label
                </label>
                <input
                  type="text"
                  value={site.navPortalButtonLabel}
                  onChange={(e) => setSite({ ...site, navPortalButtonLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">Services Menu Link</span>
                  <input
                    type="checkbox"
                    checked={site.showServicesNav}
                    onChange={(e) => setSite({ ...site, showServicesNav: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={site.navServicesLabel}
                  onChange={(e) => setSite({ ...site, navServicesLabel: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">Portfolio Menu Link</span>
                  <input
                    type="checkbox"
                    checked={site.showPortfolioNav}
                    onChange={(e) => setSite({ ...site, showPortfolioNav: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={site.navPortfolioLabel}
                  onChange={(e) => setSite({ ...site, navPortfolioLabel: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">About Menu Link</span>
                  <input
                    type="checkbox"
                    checked={site.showAboutNav}
                    onChange={(e) => setSite({ ...site, showAboutNav: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={site.navAboutLabel}
                  onChange={(e) => setSite({ ...site, navAboutLabel: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">Contact Menu Link</span>
                  <input
                    type="checkbox"
                    checked={site.showContactNav}
                    onChange={(e) => setSite({ ...site, showContactNav: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={site.navContactLabel}
                  onChange={(e) => setSite({ ...site, navContactLabel: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>
            </div>
          </div>

          {/* Footer Copy & Social Links */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Footer Copy & Social Media Profiles
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Footer Studio Badge Label
                </label>
                <input
                  type="text"
                  value={site.footerStudioLabel}
                  onChange={(e) => setSite({ ...site, footerStudioLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Copyright Notice Text
                </label>
                <input
                  type="text"
                  value={site.copyrightText}
                  onChange={(e) => setSite({ ...site, copyrightText: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#1E3A5F]">
              <p className="text-xs font-semibold text-[#F8FAFC]">
                Social Media Links (Leave blank to hide icon in footer)
              </p>

              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Instagram URL</label>
                <input
                  type="text"
                  placeholder="https://instagram.com/..."
                  value={site.instagramUrl}
                  onChange={(e) => setSite({ ...site, instagramUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">YouTube URL</label>
                <input
                  type="text"
                  placeholder="https://youtube.com/..."
                  value={site.youtubeUrl}
                  onChange={(e) => setSite({ ...site, youtubeUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">LinkedIn URL</label>
                <input
                  type="text"
                  placeholder="https://linkedin.com/..."
                  value={site.linkedinUrl}
                  onChange={(e) => setSite({ ...site, linkedinUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Behance URL</label>
                  <input
                    type="text"
                    placeholder="https://behance.net/..."
                    value={site.behanceUrl}
                    onChange={(e) => setSite({ ...site, behanceUrl: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">X / Twitter URL</label>
                  <input
                    type="text"
                    placeholder="https://x.com/..."
                    value={site.twitterUrl}
                    onChange={(e) => setSite({ ...site, twitterUrl: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: HOMEPAGE HERO & VISUAL SHOWCASE CARD */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Hero Copy & CTAs */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Homepage Hero Headline & Call-to-Action Buttons
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Top Kicker / Location Tag
              </label>
              <input
                type="text"
                value={site.heroKicker}
                onChange={(e) => setSite({ ...site, heroKicker: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Main Editorial Headline (H1)
              </label>
              <textarea
                rows={2}
                value={site.heroHeadline}
                onChange={(e) => setSite({ ...site, heroHeadline: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Hero Lead Paragraph / Subheadline
              </label>
              <textarea
                rows={3}
                value={site.heroSubheadline}
                onChange={(e) => setSite({ ...site, heroSubheadline: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1E3A5F]">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Primary Button Text
                </label>
                <input
                  type="text"
                  value={site.heroPrimaryCtaLabel}
                  onChange={(e) => setSite({ ...site, heroPrimaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Primary Button Destination
                </label>
                <input
                  type="text"
                  value={site.heroPrimaryCtaLink}
                  onChange={(e) => setSite({ ...site, heroPrimaryCtaLink: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Secondary Button Text
                </label>
                <input
                  type="text"
                  value={site.heroSecondaryCtaLabel}
                  onChange={(e) => setSite({ ...site, heroSecondaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Secondary Button Destination
                </label>
                <input
                  type="text"
                  value={site.heroSecondaryCtaLink}
                  onChange={(e) => setSite({ ...site, heroSecondaryCtaLink: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Core Disciplines Strip (Comma-separated list)
              </label>
              <input
                type="text"
                value={disciplinesText}
                onChange={(e) => setDisciplinesText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>
          </div>

          {/* Right Hero Visual Card & Stats */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Hero Showcase Frame, Image & Metrics
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Card Header Title
                </label>
                <input
                  type="text"
                  value={site.showcaseTitle}
                  onChange={(e) => setSite({ ...site, showcaseTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Card Subtitle
                </label>
                <input
                  type="text"
                  value={site.showcaseSubtitle}
                  onChange={(e) => setSite({ ...site, showcaseSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Status Badge
                </label>
                <input
                  type="text"
                  value={site.showcaseBadge}
                  onChange={(e) => setSite({ ...site, showcaseBadge: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            {/* Hero Artwork Image Upload */}
            <div className="p-4 bg-[#132A4A] rounded-xl border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#F8FAFC]">
                  Hero Showcase Image (Optional — replaces default vector graphic)
                </label>
                {site.heroImageUrl && (
                  <button
                    type="button"
                    onClick={() => setSite({ ...site, heroImageUrl: '' })}
                    className="text-xs font-semibold text-[#DC2626] hover:underline"
                  >
                    Revert to Default Graphic
                  </button>
                )}
              </div>

              {site.heroImageUrl && (
                <img
                  src={site.heroImageUrl}
                  alt="Hero Showcase Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover rounded-lg border border-[#1E3A5F]"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingField === 'heroVisual' ? 'Uploading...' : 'Upload Hero Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingField === 'heroVisual'}
                    onChange={(e) => handleDirectImageUpload(e, 'heroVisual')}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openMediaPicker('heroVisual')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Select from Media Library
                </button>
              </div>

              <input
                type="text"
                placeholder="Or paste Hero Image URL (https://...)"
                value={site.heroImageUrl}
                onChange={(e) => setSite({ ...site, heroImageUrl: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Artwork Overlay Title
                </label>
                <input
                  type="text"
                  value={site.heroArtworkTitle}
                  onChange={(e) => setSite({ ...site, heroArtworkTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Artwork Overlay Subtitle
                </label>
                <input
                  type="text"
                  value={site.heroArtworkSubtitle}
                  onChange={(e) => setSite({ ...site, heroArtworkSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            {/* 2 Metric Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1E3A5F]">
              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <p className="text-xs font-semibold text-[#F8FAFC]">Metric Box 1</p>
                <input
                  type="text"
                  placeholder="Label (e.g. Standard Turnaround)"
                  value={site.stat1Label}
                  onChange={(e) => setSite({ ...site, stat1Label: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. 24–72 Hours)"
                  value={site.stat1Value}
                  onChange={(e) => setSite({ ...site, stat1Value: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  placeholder="Subtext"
                  value={site.stat1Subtext}
                  onChange={(e) => setSite({ ...site, stat1Subtext: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              <div className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                <p className="text-xs font-semibold text-[#F8FAFC]">Metric Box 2</p>
                <input
                  type="text"
                  placeholder="Label (e.g. Client Portal)"
                  value={site.stat2Label}
                  onChange={(e) => setSite({ ...site, stat2Label: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. Live Tracking)"
                  value={site.stat2Value}
                  onChange={(e) => setSite({ ...site, stat2Value: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  placeholder="Subtext"
                  value={site.stat2Subtext}
                  onChange={(e) => setSite({ ...site, stat2Subtext: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: HOMEPAGE SECTIONS, WORKFLOW STEPS & TRUST PILLARS */}
      {activeTab === 'home_sections' && (
        <form onSubmit={handleSaveAll} className="space-y-6">
          {/* Section Visibility Toggles & Headings */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Homepage Sections Visibility & Headings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Services Section */}
              <div className="p-4 bg-[#132A4A] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    Services Preview Section
                  </span>
                  <input
                    type="checkbox"
                    checked={site.showServicesSection}
                    onChange={(e) => setSite({ ...site, showServicesSection: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={site.homeServicesKicker}
                  onChange={(e) => setSite({ ...site, homeServicesKicker: e.target.value })}
                  placeholder="Kicker"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homeServicesHeading}
                  onChange={(e) => setSite({ ...site, homeServicesHeading: e.target.value })}
                  placeholder="Heading"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homeServicesCtaLabel}
                  onChange={(e) => setSite({ ...site, homeServicesCtaLabel: e.target.value })}
                  placeholder="Link Label"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              {/* Portfolio Section */}
              <div className="p-4 bg-[#132A4A] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    Portfolio Preview Section
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.portfolioVisible}
                    onChange={(e) =>
                      setSettings({ ...settings, portfolioVisible: e.target.checked })
                    }
                  />
                </div>
                <input
                  type="text"
                  value={site.homePortfolioKicker}
                  onChange={(e) => setSite({ ...site, homePortfolioKicker: e.target.value })}
                  placeholder="Kicker"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homePortfolioHeading}
                  onChange={(e) => setSite({ ...site, homePortfolioHeading: e.target.value })}
                  placeholder="Heading"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homePortfolioCtaLabel}
                  onChange={(e) => setSite({ ...site, homePortfolioCtaLabel: e.target.value })}
                  placeholder="Link Label"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>

              {/* Bottom Inquiry Section */}
              <div className="p-4 bg-[#132A4A] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    Homepage Inquiry Form Section
                  </span>
                  <input
                    type="checkbox"
                    checked={site.showHomeContactSection}
                    onChange={(e) =>
                      setSite({ ...site, showHomeContactSection: e.target.checked })
                    }
                  />
                </div>
                <input
                  type="text"
                  value={site.homeContactKicker}
                  onChange={(e) => setSite({ ...site, homeContactKicker: e.target.value })}
                  placeholder="Kicker"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homeContactHeading}
                  onChange={(e) => setSite({ ...site, homeContactHeading: e.target.value })}
                  placeholder="Heading"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
                <input
                  type="text"
                  value={site.homeContactDesc}
                  onChange={(e) => setSite({ ...site, homeContactDesc: e.target.value })}
                  placeholder="Description"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                />
              </div>
            </div>
          </div>

          {/* Workflow Process Steps & Trust Pillars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Process Steps */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
                <div>
                  <h3 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                    How We Work (Process Steps)
                  </h3>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={site.showProcessSection}
                    onChange={(e) => setSite({ ...site, showProcessSection: e.target.checked })}
                  />
                  Visible
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Kicker</label>
                  <input
                    type="text"
                    value={site.processKicker}
                    onChange={(e) => setSite({ ...site, processKicker: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Heading</label>
                  <input
                    type="text"
                    value={site.processHeading}
                    onChange={(e) => setSite({ ...site, processHeading: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {site.processSteps.map((stepObj, idx) => (
                  <div key={idx} className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#10B981]">
                        STEP 0{idx + 1}
                      </span>
                      {site.processSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSite({
                              ...site,
                              processSteps: site.processSteps.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-[#DC2626] hover:bg-[#EF4444]/15 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={stepObj.step}
                      onChange={(e) => {
                        const next = [...site.processSteps];
                        next[idx] = { ...next[idx], step: e.target.value };
                        setSite({ ...site, processSteps: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                    <textarea
                      rows={2}
                      value={stepObj.desc}
                      onChange={(e) => {
                        const next = [...site.processSteps];
                        next[idx] = { ...next[idx], desc: e.target.value };
                        setSite({ ...site, processSteps: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSite({
                      ...site,
                      processSteps: [
                        ...site.processSteps,
                        { step: 'New Step', desc: 'Describe this workflow stage...' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Workflow Step
                </button>
              </div>
            </div>

            {/* Why Brands Choose Us (Trust Section) */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
                <h3 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                  Why Brands Choose Us (Trust Pillars)
                </h3>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={site.showTrustSection}
                    onChange={(e) => setSite({ ...site, showTrustSection: e.target.checked })}
                  />
                  Visible
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Kicker</label>
                  <input
                    type="text"
                    value={site.trustKicker}
                    onChange={(e) => setSite({ ...site, trustKicker: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Heading</label>
                  <input
                    type="text"
                    value={site.trustHeading}
                    onChange={(e) => setSite({ ...site, trustHeading: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Subtitle</label>
                <textarea
                  rows={2}
                  value={site.trustSubtitle}
                  onChange={(e) => setSite({ ...site, trustSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>

              <div className="space-y-3">
                {site.trustPillars.map((pillar, idx) => (
                  <div key={idx} className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#F8FAFC]">
                        PILLAR 0{idx + 1}
                      </span>
                      {site.trustPillars.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSite({
                              ...site,
                              trustPillars: site.trustPillars.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-[#DC2626] hover:bg-[#EF4444]/15 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={pillar.title}
                      onChange={(e) => {
                        const next = [...site.trustPillars];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setSite({ ...site, trustPillars: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                    <textarea
                      rows={2}
                      value={pillar.desc}
                      onChange={(e) => {
                        const next = [...site.trustPillars];
                        next[idx] = { ...next[idx], desc: e.target.value };
                        setSite({ ...site, trustPillars: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSite({
                      ...site,
                      trustPillars: [
                        ...site.trustPillars,
                        { title: 'New Studio Pillar', desc: 'Describe this advantage...' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Trust Pillar
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: ABOUT STUDIO PAGE & FOUNDER PORTRAIT */}
      {activeTab === 'about' && (
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              About Studio Story & Biography
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                About Page Kicker
              </label>
              <input
                type="text"
                value={site.aboutKicker}
                onChange={(e) => setSite({ ...site, aboutKicker: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                About Page Main Heading
              </label>
              <textarea
                rows={2}
                value={site.aboutHeading}
                onChange={(e) => setSite({ ...site, aboutHeading: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Story Paragraph 1
              </label>
              <textarea
                rows={4}
                value={site.aboutParagraph1}
                onChange={(e) => setSite({ ...site, aboutParagraph1: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Story Paragraph 2
              </label>
              <textarea
                rows={4}
                value={site.aboutParagraph2}
                onChange={(e) => setSite({ ...site, aboutParagraph2: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Primary Button Label
                </label>
                <input
                  type="text"
                  value={site.aboutPrimaryCtaLabel}
                  onChange={(e) => setSite({ ...site, aboutPrimaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Secondary Button Label
                </label>
                <input
                  type="text"
                  value={site.aboutSecondaryCtaLabel}
                  onChange={(e) => setSite({ ...site, aboutSecondaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Founder Portrait Image & Studio Values
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Founder Display Name
                </label>
                <input
                  type="text"
                  value={site.founderName}
                  onChange={(e) => setSite({ ...site, founderName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Founder Role / Title
                </label>
                <input
                  type="text"
                  value={site.founderRole}
                  onChange={(e) => setSite({ ...site, founderRole: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            {/* Founder Portrait Upload */}
            <div className="p-4 bg-[#132A4A] rounded-xl border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#F8FAFC]">
                  Founder / Studio Portrait Photo
                </label>
                {site.founderImageUrl && (
                  <button
                    type="button"
                    onClick={() => setSite({ ...site, founderImageUrl: '' })}
                    className="text-xs font-semibold text-[#DC2626] hover:underline"
                  >
                    Revert to Default Monogram
                  </button>
                )}
              </div>

              {site.founderImageUrl && (
                <img
                  src={site.founderImageUrl}
                  alt="Founder Portrait"
                  referrerPolicy="no-referrer"
                  className="w-32 h-36 object-cover rounded-lg border border-[#1E3A5F]"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingField === 'founderImage' ? 'Uploading...' : 'Upload Portrait Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingField === 'founderImage'}
                    onChange={(e) => handleDirectImageUpload(e, 'founderImage')}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openMediaPicker('founderImage')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Select from Media Library
                </button>
              </div>

              <input
                type="text"
                placeholder="Or paste Portrait Image URL (https://...)"
                value={site.founderImageUrl}
                onChange={(e) => setSite({ ...site, founderImageUrl: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg"
              />
            </div>

            {/* About Pillars */}
            <div className="space-y-3 pt-2 border-t border-[#1E3A5F]">
              <p className="text-xs font-semibold text-[#F8FAFC]">
                About Page Value Cards (3 Core Pillars)
              </p>
              {site.aboutPillars.map((pillar, idx) => (
                <div key={idx} className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                  <input
                    type="text"
                    value={pillar.title}
                    onChange={(e) => {
                      const next = [...site.aboutPillars];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setSite({ ...site, aboutPillars: next });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-[#0D1F38] border border-[#1E3A5F] rounded"
                  />
                  <textarea
                    rows={2}
                    value={pillar.desc}
                    onChange={(e) => {
                      const next = [...site.aboutPillars];
                      next[idx] = { ...next[idx], desc: e.target.value };
                      setSite({ ...site, aboutPillars: next });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                  />
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* TAB 6: SERVICES, PORTFOLIO & CONTACT PAGE + INQUIRY OPTIONS */}
      {activeTab === 'pages_contact' && (
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Services Page Header Copy */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2">
                <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                  Services Page Header Copy
                </h2>
                <Link
                  to="/admin/services"
                  className="text-xs font-semibold text-[#10B981] hover:underline"
                >
                  Edit Service Packages →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Kicker</label>
                  <input
                    type="text"
                    value={site.servicesPageKicker}
                    onChange={(e) => setSite({ ...site, servicesPageKicker: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Heading</label>
                  <input
                    type="text"
                    value={site.servicesPageTitle}
                    onChange={(e) => setSite({ ...site, servicesPageTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Services Page Description
                </label>
                <textarea
                  rows={2}
                  value={site.servicesPageDescription}
                  onChange={(e) => setSite({ ...site, servicesPageDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            {/* Portfolio Page Header Copy */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2">
                <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                  Portfolio Page Header Copy
                </h2>
                <Link
                  to="/admin/portfolio"
                  className="text-xs font-semibold text-[#10B981] hover:underline"
                >
                  Edit Portfolio Projects →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Kicker</label>
                  <input
                    type="text"
                    value={site.portfolioPageKicker}
                    onChange={(e) => setSite({ ...site, portfolioPageKicker: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">Heading</label>
                  <input
                    type="text"
                    value={site.portfolioPageTitle}
                    onChange={(e) => setSite({ ...site, portfolioPageTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Portfolio Page Description
                </label>
                <textarea
                  rows={2}
                  value={site.portfolioPageDescription}
                  onChange={(e) => setSite({ ...site, portfolioPageDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Contact Details, WhatsApp & Budget Ranges */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Contact Page, Direct Channels & Inquiry Form Options
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Contact Page Heading
                </label>
                <input
                  type="text"
                  value={site.contactHeading}
                  onChange={(e) => setSite({ ...site, contactHeading: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Working Hours Text
                </label>
                <input
                  type="text"
                  value={site.workingHours}
                  onChange={(e) => setSite({ ...site, workingHours: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Contact Page Description
              </label>
              <textarea
                rows={2}
                value={site.contactDescription}
                onChange={(e) => setSite({ ...site, contactDescription: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1E3A5F]">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Public Studio Email
                </label>
                <input
                  type="email"
                  value={settings.businessEmail}
                  onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Studio Address / Location Line
              </label>
              <input
                type="text"
                value={settings.businessAddress}
                onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Default Pre-Filled WhatsApp Greeting Message
              </label>
              <input
                type="text"
                value={settings.whatsappDefaultMessage}
                onChange={(e) =>
                  setSettings({ ...settings, whatsappDefaultMessage: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>

            <div className="pt-2 border-t border-[#1E3A5F]">
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Inquiry Form Budget Range Options (One option per line)
              </label>
              <textarea
                rows={5}
                value={budgetRangesText}
                onChange={(e) => setBudgetRangesText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-[#1E3A5F] rounded-lg"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 7: LEGAL POLICIES & SEO METADATA */}
      {activeTab === 'legal_seo' && (
        <form onSubmit={handleSaveAll} className="space-y-6">
          {/* SEO Metadata */}
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
            <h2 className="font-editorial text-lg font-semibold text-[#F8FAFC] border-b border-[#1E3A5F] pb-3">
              Search Engine Optimization (SEO) & Browser Tab Title
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Browser Page Title (&lt;title&gt;)
                </label>
                <input
                  type="text"
                  value={site.seoTitle}
                  onChange={(e) => setSite({ ...site, seoTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                  Legal Pages Effective Date
                </label>
                <input
                  type="text"
                  value={site.legalEffectiveDate}
                  onChange={(e) => setSite({ ...site, legalEffectiveDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                Meta Description (For Google Search & Social Previews)
              </label>
              <textarea
                rows={2}
                value={site.seoDescription}
                onChange={(e) => setSite({ ...site, seoDescription: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#1E3A5F] rounded-lg"
              />
            </div>
          </div>

          {/* Privacy Policy & Terms Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Privacy Policy */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
                <h3 className="font-editorial text-base font-semibold text-[#F8FAFC]">
                  Privacy Policy Sections
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setSite({
                      ...site,
                      privacySections: [
                        ...site.privacySections,
                        { heading: 'New Policy Section', body: 'Enter policy details...' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>
              <div className="space-y-3">
                {site.privacySections.map((sec, idx) => (
                  <div key={idx} className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sec.heading}
                        onChange={(e) => {
                          const updated = [...site.privacySections];
                          updated[idx] = { ...updated[idx], heading: e.target.value };
                          setSite({ ...site, privacySections: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold bg-[#0D1F38] border border-[#1E3A5F] rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = site.privacySections.filter((_, i) => i !== idx);
                          setSite({ ...site, privacySections: updated });
                        }}
                        className="p-1.5 text-[#DC2626] hover:bg-[#EF4444]/15 rounded"
                        title="Remove section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={sec.body}
                      onChange={(e) => {
                        const updated = [...site.privacySections];
                        updated[idx] = { ...updated[idx], body: e.target.value };
                        setSite({ ...site, privacySections: updated });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
                <h3 className="font-editorial text-base font-semibold text-[#F8FAFC]">
                  Terms & Conditions Sections
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setSite({
                      ...site,
                      termsSections: [
                        ...site.termsSections,
                        { heading: 'New Terms Section', body: 'Enter terms details...' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E3A5F] rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>
              <div className="space-y-3">
                {site.termsSections.map((sec, idx) => (
                  <div key={idx} className="p-3 bg-[#132A4A] rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sec.heading}
                        onChange={(e) => {
                          const updated = [...site.termsSections];
                          updated[idx] = { ...updated[idx], heading: e.target.value };
                          setSite({ ...site, termsSections: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold bg-[#0D1F38] border border-[#1E3A5F] rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = site.termsSections.filter((_, i) => i !== idx);
                          setSite({ ...site, termsSections: updated });
                        }}
                        className="p-1.5 text-[#DC2626] hover:bg-[#EF4444]/15 rounded"
                        title="Remove section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={sec.body}
                      onChange={(e) => {
                        const updated = [...site.termsSections];
                        updated[idx] = { ...updated[idx], body: e.target.value };
                        setSite({ ...site, termsSections: updated });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Bottom Sticky Save Bar */}
      <div className="bg-[#081629] text-[#F8FAFC] border border-[#1E3A5F] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>
            Changes are applied across the entire public website immediately when you save.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-lg transition-colors"
          >
            Open Live Website
          </Link>
          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving & Publishing...' : 'Save & Publish All Changes'}
          </button>
        </div>
      </div>

      {/* Media Library Picker Modal */}
      {mediaModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#1E3A5F] flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-lg font-semibold text-[#F8FAFC]">
                  Select Image from Studio Media Library
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Choose an uploaded image asset or upload a new file directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMediaModalTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E3A5F] rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingMedia ? (
                <p className="text-xs text-[#94A3B8] text-center py-12">
                  Loading studio media assets...
                </p>
              ) : mediaAssets.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-sm font-medium text-[#F8FAFC]">
                    No public image assets found in your Media Library yet.
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    Use the &ldquo;Upload&rdquo; button directly in the form or upload files in the
                    Media Library.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleSelectMediaAsset(asset.publicUrl)}
                      className="group text-left border border-[#1E3A5F] hover:border-[#10B981] rounded-lg overflow-hidden bg-[#132A4A] transition-all"
                    >
                      <div className="aspect-video bg-[#040D1A] overflow-hidden">
                        <img
                          src={asset.publicUrl}
                          alt={asset.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                          {asset.title}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] truncate">
                          {asset.storageBucket}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
