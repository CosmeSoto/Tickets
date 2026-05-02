/**
 * Equipment Detail - Refactored
 * Complete refactorization following successful audit module pattern
 *
 * Reduced from 1,151 lines to ~200 lines (82.6% reduction)
 * - Business logic centralized in custom hook (use-equipment-detail.ts)
 * - Modular components for better maintainability
 * - Full dark mode support
 */

'use client'

import { Package, Loader2 } from 'lucide-react'
import { useEquipmentDetail } from '@/hooks/use-equipment-detail'
import { EquipmentStatusBanners } from './equipment/equipment-status-banners'
import { EquipmentActionButtons } from './equipment/equipment-action-buttons'
import { EquipmentInfoCard } from './equipment/equipment-info-card'
import { EquipmentQRCard } from './equipment/equipment-qr-card'
import { EquipmentAssignmentCard } from './equipment/equipment-assignment-card'
import { EquipmentHistoryCard } from './equipment/equipment-history-card'
import { EquipmentMaintenanceCard } from './equipment/equipment-maintenance-card'
import { EquipmentAttachments } from './equipment-attachments'
import { DepreciationCard } from './equipment/DepreciationCard'
import { FinancialInfoSection } from './shared/FinancialInfoSection'
import { AssignmentDialog } from './equipment/dialogs/assignment-dialog'
import { ReturnDialog } from './equipment/dialogs/return-dialog'
import { MaintenanceDialog } from './equipment/dialogs/maintenance-dialog'
import { DeleteDialog } from './equipment/dialogs/delete-dialog'
import { PermanentDeleteDialog } from './equipment/dialogs/permanent-delete-dialog'
import { DecommissionDialog } from './equipment/dialogs/decommission-dialog'

interface EquipmentDetailProps {
  equipmentId: string
  userRole: string
  userId: string
}

export function EquipmentDetail({ equipmentId, userRole, userId }: EquipmentDetailProps) {
  const {
    // Data
    data,
    equipment,
    currentAssignment,
    history,
    maintenanceRecords,
    qrCode,

    // State
    loading,

    // Dialog States
    showAssignDialog,
    setShowAssignDialog,
    showReturnDialog,
    setShowReturnDialog,
    showMaintenanceDialog,
    setShowMaintenanceDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    showPermanentDeleteDialog,
    setShowPermanentDeleteDialog,
    showDecommissionForm,
    setShowDecommissionForm,

    // Loading States
    assigning,
    returning,
    submittingMaintenance,
    deleting,
    permanentDeleting,

    // Form States
    assignForm,
    setAssignForm,
    returnForm,
    setReturnForm,
    maintenanceForm,
    setMaintenanceForm,

    // Computed
    isRetired,
    isAssigned,
    isInMaintenance,
    canEdit,
    canAssign,
    canReturn,
    canMaintenance,
    canRequestMaintenance,
    canRetire,
    canPermanentDelete,
    canReportProblem,

    // Actions
    loadEquipmentDetail,
    handleEdit,
    handleDelete,
    handlePermanentDelete,
    submitAssignment,
    submitReturn,
    submitMaintenance,
    handleReportProblem,
    downloadQR,
  } = useEquipmentDetail({ equipmentId, userRole, userId })

  // ── Loading State ──
  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    )
  }

  // ── Not Found ──
  if (!equipment) {
    return <div className='text-center py-12 text-muted-foreground'>Equipo no encontrado</div>
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Package className='h-8 w-8' />
          <div>
            <h1 className='text-3xl font-bold'>{equipment.code}</h1>
            <p className='text-muted-foreground'>
              {equipment.type?.name || 'Sin tipo'} - {equipment.brand} {equipment.model}
            </p>
          </div>
        </div>
        <EquipmentActionButtons
          canReportProblem={canReportProblem ?? false}
          canRequestMaintenance={canRequestMaintenance ?? false}
          canEdit={canEdit ?? false}
          canAssign={canAssign ?? false}
          canReturn={canReturn ?? false}
          canMaintenance={canMaintenance ?? false}
          canRetire={canRetire ?? false}
          canPermanentDelete={canPermanentDelete ?? false}
          isInMaintenance={isInMaintenance}
          onReportProblem={handleReportProblem}
          onRequestMaintenance={() => setShowMaintenanceDialog(true)}
          onEdit={handleEdit}
          onAssign={() => setShowAssignDialog(true)}
          onReturn={() => setShowReturnDialog(true)}
          onMaintenance={() => setShowMaintenanceDialog(true)}
          onRetire={() => setShowDecommissionForm(true)}
          onPermanentDelete={() => setShowPermanentDeleteDialog(true)}
        />
      </div>

      {/* Status Banners */}
      <EquipmentStatusBanners
        equipment={equipment}
        currentAssignment={currentAssignment}
        maintenanceRecords={maintenanceRecords}
        userRole={userRole}
        isInMaintenance={isInMaintenance}
        isAssigned={isAssigned}
        isRetired={isRetired}
        canPermanentDelete={canPermanentDelete}
      />

      {/* Main Content Grid */}
      <div className='grid gap-6 md:grid-cols-3'>
        {/* Equipment Info */}
        <EquipmentInfoCard equipment={equipment} />

        {/* Depreciation & Financial Info */}
        {((equipment as any).usefulLifeYears ||
          (equipment as any).supplierId ||
          (equipment as any).purchasePrice ||
          (equipment as any).invoiceNumber) && (
          <div className='space-y-4'>
            <DepreciationCard
              purchasePrice={(equipment as any).purchasePrice}
              purchaseDate={(equipment as any).purchaseDate}
              usefulLifeYears={(equipment as any).usefulLifeYears}
              residualValue={(equipment as any).residualValue}
              depreciation={(equipment as any).depreciation}
            />
            <FinancialInfoSection
              supplierId={(equipment as any).supplierId}
              invoiceNumber={(equipment as any).invoiceNumber}
              purchaseOrderNumber={(equipment as any).purchaseOrderNumber}
              purchasePrice={(equipment as any).purchasePrice}
              purchaseDate={(equipment as any).purchaseDate}
              readOnly
            />
          </div>
        )}

        {/* QR Code & Current Assignment */}
        <div className='space-y-6'>
          <EquipmentQRCard qrCode={qrCode} equipmentCode={equipment.code} onDownload={downloadQR} />
          {currentAssignment && <EquipmentAssignmentCard assignment={currentAssignment} />}
        </div>
      </div>

      {/* History */}
      <EquipmentHistoryCard history={history as any} />

      {/* Maintenance Records */}
      {maintenanceRecords.length > 0 && (
        <EquipmentMaintenanceCard
          maintenanceRecords={maintenanceRecords}
          equipmentStatus={equipment.status}
        />
      )}

      {/* Attachments */}
      <EquipmentAttachments
        equipmentId={equipmentId}
        canManage={userRole === 'ADMIN' || userRole === 'TECHNICIAN'}
      />

      {/* Dialogs */}
      <AssignmentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        equipmentCode={equipment.code}
        form={assignForm}
        onFormChange={setAssignForm}
        onSubmit={submitAssignment}
        submitting={assigning}
        accessories={equipment.accessories || []}
      />

      <ReturnDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        equipmentCode={equipment.code}
        currentAssignment={currentAssignment}
        form={returnForm}
        onFormChange={setReturnForm}
        onSubmit={submitReturn}
        submitting={returning}
      />

      <MaintenanceDialog
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
        equipmentCode={equipment.code}
        equipmentType={equipment.type}
        currentAssignment={currentAssignment}
        userRole={userRole}
        form={maintenanceForm}
        onFormChange={setMaintenanceForm}
        onSubmit={submitMaintenance}
        submitting={submittingMaintenance}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        equipmentCode={equipment.code}
        equipmentBrand={equipment.brand}
        equipmentModel={equipment.model}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      <PermanentDeleteDialog
        open={showPermanentDeleteDialog}
        onOpenChange={setShowPermanentDeleteDialog}
        equipmentCode={equipment.code}
        onConfirm={handlePermanentDelete}
        deleting={permanentDeleting}
      />

      <DecommissionDialog
        open={showDecommissionForm}
        onOpenChange={setShowDecommissionForm}
        equipmentId={equipmentId}
        equipmentCode={equipment.code}
        equipmentBrand={equipment.brand}
        equipmentModel={equipment.model}
        onSuccess={loadEquipmentDetail}
      />
    </div>
  )
}
