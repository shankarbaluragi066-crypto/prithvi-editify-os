import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Archive,
  Trash2,
  X,
  ShieldAlert,
  CheckCircle2,
  Eye,
  Edit3,
  Copy,
  Printer,
  Ban,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export interface SafeDeleteModalConfig {
  isOpen: boolean;
  recordType: 'Client Profile' | 'Project' | 'Invoice' | 'Quotation' | 'Estimate';
  recordTitle: string;
  recordIdentifier?: string;
  clientName?: string;
  monetaryTotal?: number;
  statusLabel?: string;
  canHardDelete: boolean;
  blockingReason?: string;
  dependencyItems?: Array<{ label: string; count: number | string }>;
  requireExplicitCheckbox?: boolean;
  archiveActionLabel?: string;
  requiresReasonForArchive?: boolean;
  defaultArchiveReason?: string;
  onConfirmHardDelete: () => Promise<void>;
  onConfirmArchiveOrVoid?: (reason?: string) => Promise<void>;
  onClose: () => void;
}

export const DependencySafeDeleteModal: React.FC<SafeDeleteModalConfig> = ({
  isOpen,
  recordType,
  recordTitle,
  recordIdentifier,
  clientName,
  monetaryTotal,
  statusLabel,
  canHardDelete,
  blockingReason,
  dependencyItems = [],
  requireExplicitCheckbox = false,
  archiveActionLabel,
  requiresReasonForArchive = false,
  defaultArchiveReason = '',
  onConfirmHardDelete,
  onConfirmArchiveOrVoid,
  onClose,
}) => {
  const [busy, setBusy] = useState<'delete' | 'archive' | null>(null);
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [archiveReason, setArchiveReason] = useState(defaultArchiveReason);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBusy(null);
      setConfirmedCheck(false);
      setArchiveReason(defaultArchiveReason);
      setErrorMsg('');
    }
  }, [isOpen, defaultArchiveReason]);

  if (!isOpen) return null;

  const handleHardDelete = async () => {
    if (requireExplicitCheckbox && !confirmedCheck) {
      setErrorMsg('Please check the confirmation box before permanently deleting this record.');
      return;
    }
    setBusy('delete');
    setErrorMsg('');
    try {
      await onConfirmHardDelete();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleArchiveOrVoid = async () => {
    if (!onConfirmArchiveOrVoid) return;
    setBusy('archive');
    setErrorMsg('');
    try {
      await onConfirmArchiveOrVoid(archiveReason.trim() || undefined);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/70 p-4 no-print overflow-y-auto"
    >
      <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E4DF] pb-4">
          <div className="flex items-start gap-3">
            {canHardDelete ? (
              <AlertTriangle className="w-5 h-5 text-[#B93832] shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#A96518] shrink-0 mt-0.5" />
            )}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E7785]">
                {recordType} Deletion & Safety Check
              </span>
              <h3 className="text-base font-semibold text-[#172333] mt-0.5">
                {canHardDelete
                  ? `Delete ${recordType}: ${recordTitle}`
                  : `Protected ${recordType}: ${recordTitle}`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onClose}
            className="text-[#6E7785] hover:text-[#172333] p-1 rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Record Summary Card */}
        <div className="p-3.5 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#172333]">{recordTitle}</span>
            {recordIdentifier && (
              <span className="font-mono font-semibold text-[#172333]">{recordIdentifier}</span>
            )}
          </div>
          <p className="text-[#6E7785]">
            {clientName ? `Client: ${clientName}` : ''}
            {clientName && statusLabel ? ' · ' : ''}
            {statusLabel ? `Current Status: ${statusLabel}` : ''}
            {monetaryTotal !== undefined ? ` · Total: ${formatINR(monetaryTotal)}` : ''}
          </p>
        </div>

        {/* Dependency Breakdown */}
        {dependencyItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#172333]">
              Linked Database Records & Dependencies:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dependencyItems.map((dep, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-[#F5F5F1]/70 border border-[#E2E4DF] rounded text-xs flex items-center justify-between"
                >
                  <span className="text-[#6E7785]">{dep.label}</span>
                  <span className="font-mono font-semibold text-[#172333]">{dep.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explanation / Consequence Banner */}
        {canHardDelete ? (
          <div className="p-3.5 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg text-xs text-[#172333] leading-relaxed">
            <p className="font-semibold text-[#B93832]">Permanent Database Deletion</p>
            <p className="mt-1 text-[#6E7785]">
              {blockingReason ||
                `This ${recordType.toLowerCase()} has no blocking financial or project dependencies and can be permanently removed from the database.`}
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-[#A96518]/10 border border-[#A96518]/30 rounded-lg text-xs text-[#172333] leading-relaxed">
            <p className="font-semibold text-[#A96518]">
              Permanent Deletion Blocked to Protect Studio History
            </p>
            <p className="mt-1 text-[#6E7785]">{blockingReason}</p>
          </div>
        )}

        {/* Optional Archive / Void Reason Input */}
        {onConfirmArchiveOrVoid && requiresReasonForArchive && (
          <div>
            <label className="block text-xs font-semibold text-[#172333] mb-1">
              Audit Note / Reason for {archiveActionLabel || 'Archiving / Voiding'}
            </label>
            <input
              type="text"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g. Client requested scope revision or billing cancellation..."
              className="w-full px-3 py-2 text-xs bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg"
            />
          </div>
        )}

        {/* Explicit Checkbox for Financial / Project Deletions */}
        {canHardDelete && requireExplicitCheckbox && (
          <label className="flex items-start gap-2.5 p-3 bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[#172333]">
              I confirm that I want to permanently delete{' '}
              <strong>{recordIdentifier || recordTitle}</strong> and understand this action cannot be
              undone.
            </span>
          </label>
        )}

        {errorMsg && (
          <div className="p-3 bg-[#B93832]/10 border border-[#B93832]/30 rounded-lg text-xs text-[#B93832]">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E2E4DF]">
          <button
            type="button"
            disabled={busy !== null}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors"
          >
            Cancel
          </button>

          {onConfirmArchiveOrVoid && archiveActionLabel && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleArchiveOrVoid}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5 text-[#F18A45]" />
              <span>{busy === 'archive' ? 'Updating...' : archiveActionLabel}</span>
            </button>
          )}

          {canHardDelete && (
            <button
              type="button"
              disabled={busy !== null || (requireExplicitCheckbox && !confirmedCheck)}
              onClick={handleHardDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#B93832] hover:bg-[#992B26] rounded-lg transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{busy === 'delete' ? 'Deleting...' : `Confirm Delete ${recordType}`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  recordLabel?: string;
  onSaveAndClose?: () => void | Promise<void>;
  onDiscardChanges: () => void;
  onContinueEditing: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  recordLabel = 'this record',
  onSaveAndClose,
  onDiscardChanges,
  onContinueEditing,
}) => {
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!onSaveAndClose) return;
    setSaving(true);
    try {
      await onSaveAndClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/65 p-4 no-print"
    >
      <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#A96518] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-[#172333]">Unsaved Changes</h3>
            <p className="text-xs text-[#6E7785] mt-1 leading-relaxed">
              You have unsaved edits in {recordLabel}. Would you like to save your changes before
              closing, discard them, or continue editing?
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#E2E4DF]">
          <button
            type="button"
            disabled={saving}
            onClick={onContinueEditing}
            className="px-3.5 py-2 text-xs font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg"
          >
            Continue Editing
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDiscardChanges}
            className="px-3.5 py-2 text-xs font-semibold text-[#B93832] bg-[#B93832]/10 hover:bg-[#B93832]/20 rounded-lg"
          >
            Discard Changes
          </button>
          {onSaveAndClose && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#F18A45]" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface RecordActionBarProps {
  onView?: () => void;
  viewLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
  onDuplicate?: () => void;
  duplicateLabel?: string;
  onPrint?: () => void;
  printLabel?: string;
  onArchiveOrVoid?: () => void;
  archiveLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  extraActions?: React.ReactNode;
}

export const RecordActionBar: React.FC<RecordActionBarProps> = ({
  onView,
  viewLabel = 'View',
  onEdit,
  editLabel = 'Edit',
  onDuplicate,
  duplicateLabel = 'Duplicate',
  onPrint,
  printLabel = 'PDF',
  onArchiveOrVoid,
  archiveLabel = 'Archive',
  onDelete,
  deleteLabel = 'Delete',
  extraActions,
}) => {
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-2 text-xs">
      {extraActions}
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          title="View Record Details"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{viewLabel}</span>
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          title="Edit Record"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{editLabel}</span>
        </button>
      )}
      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1 font-semibold text-[#172333] hover:text-[#F18A45] transition-colors"
          title="Print or Save PDF"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{printLabel}</span>
        </button>
      )}
      {onDuplicate && (
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center gap-1 font-medium text-[#6E7785] hover:text-[#172333] transition-colors"
          title="Duplicate Record"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{duplicateLabel}</span>
        </button>
      )}
      {onArchiveOrVoid && (
        <button
          type="button"
          onClick={onArchiveOrVoid}
          className="inline-flex items-center gap-1 font-medium text-[#A96518] hover:underline transition-colors"
          title={archiveLabel}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>{archiveLabel}</span>
        </button>
      )}
      {onDelete && (
        <>
          <span className="text-[#E2E4DF] select-none">|</span>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 font-semibold text-[#B93832] hover:underline transition-colors"
            title="Delete Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleteLabel}</span>
          </button>
        </>
      )}
    </div>
  );
};
