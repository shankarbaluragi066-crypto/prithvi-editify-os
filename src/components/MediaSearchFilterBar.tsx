import React from 'react';
import {
  Search,
  Filter,
  Image as ImageIcon,
  Film,
  FileText,
  FileArchive,
  Tag,
  FolderKanban,
  HardDrive,
  X,
  RotateCcw,
  LayoutGrid,
  List,
  Layers,
} from 'lucide-react';
import { MediaBucket, MediaCategory, ProjectRecord } from '../types/crm';

export interface MediaSearchFilterState {
  searchQuery: string;
  mimeType: 'all' | MediaCategory | string;
  tag: string;
  projectId: string;
  bucket: 'all' | MediaBucket;
  sortBy: 'newest' | 'oldest' | 'name_asc' | 'size_desc' | 'size_asc';
}

interface MediaSearchFilterBarProps {
  filters: MediaSearchFilterState;
  onChangeFilters: (next: MediaSearchFilterState) => void;
  onResetFilters: () => void;
  availableTags: string[];
  projects: ProjectRecord[];
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  totalMatching: number;
  isFiltering?: boolean;
}

const MIME_TYPE_OPTIONS: {
  id: 'all' | MediaCategory;
  label: string;
  mimeHint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', label: 'All MIME Types', mimeHint: '*/*', icon: Layers },
  { id: 'image', label: 'Images', mimeHint: 'image/*', icon: ImageIcon },
  { id: 'video', label: 'Videos', mimeHint: 'video/*', icon: Film },
  { id: 'pdf', label: 'PDFs', mimeHint: 'application/pdf', icon: FileText },
  { id: 'document', label: 'Project Docs', mimeHint: 'zip / psd / doc', icon: FileArchive },
];

export const MediaSearchFilterBar: React.FC<MediaSearchFilterBarProps> = ({
  filters,
  onChangeFilters,
  onResetFilters,
  availableTags,
  projects,
  viewMode,
  onViewModeChange,
  totalMatching,
  isFiltering = false,
}) => {
  const hasActiveFilters =
    filters.mimeType !== 'all' ||
    Boolean(filters.searchQuery.trim()) ||
    Boolean(filters.tag.trim()) ||
    Boolean(filters.projectId && filters.projectId !== 'all') ||
    filters.bucket !== 'all';

  const updateField = <K extends keyof MediaSearchFilterState>(
    key: K,
    value: MediaSearchFilterState[K]
  ) => {
    onChangeFilters({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="bg-white border border-[#E2E4DF] rounded-lg p-4 space-y-4">
      {/* Row 1: Quick MIME Category Buttons + Exact MIME-Type Dropdown + View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E4DF] pb-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#6E7785] mr-1.5">
            <Filter className="w-3.5 h-3.5 text-[#F18A45]" />
            <span>Category / MIME:</span>
          </span>
          {MIME_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = filters.mimeType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateField('mimeType', opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-[#172333] text-white border-[#172333]'
                    : 'bg-[#F5F5F1] text-[#172333] border-[#E2E4DF] hover:border-[#172333]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#F18A45]' : 'text-[#6E7785]'}`} />
                <span>{opt.label}</span>
                <span
                  className={`hidden sm:inline font-mono text-[10px] ${
                    active ? 'text-white/75' : 'text-[#6E7785]'
                  }`}
                >
                  ({opt.mimeHint})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#6E7785]">
            {isFiltering ? 'Querying Supabase...' : `${totalMatching} matching`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md border ${
                viewMode === 'grid'
                  ? 'bg-[#172333] text-white border-[#172333]'
                  : 'bg-[#F5F5F1] text-[#6E7785] border-[#E2E4DF]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-md border ${
                viewMode === 'table'
                  ? 'bg-[#172333] text-white border-[#172333]'
                  : 'bg-[#F5F5F1] text-[#6E7785] border-[#E2E4DF]'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Search Input (.ilike('title', ...)) + Category/MIME-Type Dropdown (.eq('mime_type', ...)) + Project Tag + Project + Bucket + Sort */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search by File Title (.ilike('title', ...)) or Associated Project Tags */}
        <div className="md:col-span-4 relative">
          <Search className="w-3.5 h-3.5 text-[#6E7785] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => updateField('searchQuery', e.target.value)}
            placeholder="Search by file title (.ilike) or #tag..."
            className="w-full pl-8 pr-8 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => updateField('searchQuery', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E7785] hover:text-[#172333]"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category / Exact MIME-Type Filter Dropdown (.eq('mime_type', ...)) */}
        <div className="md:col-span-2 relative">
          <Filter className="w-3.5 h-3.5 text-[#6E7785] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.mimeType}
            onChange={(e) => updateField('mimeType', e.target.value)}
            className="w-full pl-7 pr-2.5 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-mono"
            title="Filter by Category or Exact MIME Type (.eq('mime_type', ...))"
          >
            <option value="all">All MIME Types</option>
            <optgroup label="Exact MIME Types (.eq('mime_type'))">
              <option value="image/png">image/png</option>
              <option value="image/jpeg">image/jpeg</option>
              <option value="image/webp">image/webp</option>
              <option value="image/svg+xml">image/svg+xml</option>
              <option value="video/mp4">video/mp4</option>
              <option value="video/webm">video/webm</option>
              <option value="application/pdf">application/pdf</option>
            </optgroup>
            <optgroup label="Media Categories">
              <option value="image">All Images (image/*)</option>
              <option value="video">All Videos (video/*)</option>
              <option value="pdf">All PDFs</option>
              <option value="document">Project Archives / Docs</option>
            </optgroup>
          </select>
        </div>

        {/* Specific Project Tag Dropdown */}
        <div className="md:col-span-2 relative">
          <Tag className="w-3.5 h-3.5 text-[#6E7785] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.tag}
            onChange={(e) => updateField('tag', e.target.value)}
            className="w-full pl-7 pr-2.5 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-mono"
            title="Filter by Associated Project Tag"
          >
            <option value="">All Project Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>

        {/* Associated Project Filter */}
        <div className="md:col-span-2 relative">
          <FolderKanban className="w-3.5 h-3.5 text-[#6E7785] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.projectId}
            onChange={(e) => updateField('projectId', e.target.value)}
            className="w-full pl-7 pr-2.5 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            title="Filter by Associated Project"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {/* Storage Bucket Filter */}
        <div className="md:col-span-1 relative">
          <select
            value={filters.bucket}
            onChange={(e) => updateField('bucket', e.target.value as 'all' | MediaBucket)}
            className="w-full px-2 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg font-mono"
            title="Filter by Supabase Storage Bucket"
          >
            <option value="all">Buckets</option>
            <option value="portfolio-media">portfolio-media</option>
            <option value="service-media">service-media</option>
            <option value="private-project-files">private-project-files</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="md:col-span-1">
          <select
            value={filters.sortBy}
            onChange={(e) =>
              updateField(
                'sortBy',
                e.target.value as 'newest' | 'oldest' | 'name_asc' | 'size_desc' | 'size_asc'
              )
            }
            className="w-full px-2 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            title="Sort Order"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Title A–Z</option>
            <option value="size_desc">Largest</option>
            <option value="size_asc">Smallest</option>
          </select>
        </div>
      </div>

      {/* Row 3: Quick Project Tag Chips & Active Supabase Filter Summary */}
      {(availableTags.length > 0 || hasActiveFilters) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E4DF]/70 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#6E7785] mr-1">Project Tags:</span>
            {availableTags.slice(0, 10).map((tag) => {
              const isSelected = filters.tag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => updateField('tag', isSelected ? '' : tag)}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                    isSelected
                      ? 'bg-[#F18A45] text-[#172333] border-[#F18A45] font-semibold'
                      : 'bg-[#F5F5F1] text-[#172333] border-[#E2E4DF] hover:border-[#172333]'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#B93832] bg-[#B93832]/10 hover:bg-[#B93832]/15 rounded-md"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Supabase Filters</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
