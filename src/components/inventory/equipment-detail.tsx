'use client'

import { useState } from 'react'
import {
  Package,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  ArrowLeft,
  X,
  Tag,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEquipmentDetail } from '@/hooks/use-equipment-detail'
import { formatCurrency } from '@/lib/utils'
import { EquipmentStatusBanners } from './equipment/equipment-status-banners'
import { EquipmentActionButtons } from './equipment/equipment-action-buttons'
import { EquipmentInfoCard } from './equipment/equipment-info-card'
import { EquipmentQRCard } from './equipment/equipment-qr-card'
import { EquipmentAssignmentCard } from './equipment/equipment-assignment-card'
import { EquipmentHistoryCard } from './equipment/equipment-history-card'
import { EquipmentMaintenanceCard } from './equipment/equipment-maintenance-card'
import { EquipmentBatchCard } from './equipment/EquipmentBatchCard'
import { EquipmentAttachments } from './equipment-attachments'
import { DepreciationCard } from './equipment/DepreciationCard'
import { FinancialInfoSection } from './shared/FinancialInfoSection'
import { AcquisitionInvoicesCard } from './shared/AcquisitionInvoicesCard'

import { AssignmentDialog } from './equipment/dialogs/assignment-dialog'
import { ReturnDialog } from './equipment/dialogs/return-dialog'
import { MaintenanceDialog } from './equipment/dialogs/maintenance-dialog'
import { DeleteDialog } from './equipment/dialogs/delete-dialog'
import { PermanentDeleteDialog } from './equipment/dialogs/permanent-delete-dialog'
import { DecommissionDialog } from './equipment/dialogs/decommission-dialog'
import { ConvertToPurchaseDialog } from './equipment/dialogs/convert-to-purchase-dialog'
import { SaleDialog } from './equipment/dialogs/sale-dialog'
import { TransferFamilyDialog } from './transfer-family-dialog'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { LinkedCredentialsCard } from '@/components/credentials/linked-credentials-card'

interface EquipmentDetailProps {
  equipmentId: string
  userRole: string
  userId: string
  isSuperAdmin?: boolean
}

export function EquipmentDetail({
  equipmentId,
  userRole,
  userId,
  isSuperAdmin = false,
}: EquipmentDetailProps) {
  const [showDepreciation, setShowDepreciation] = useState(false)
  const [showSaleDialog, setShowSaleDialog] = useState(false)
  const [showTransferFamilyDialog, setShowTransferFamilyDialog] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const isSuperAdminSession =
    isSuperAdmin || (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true
  const hasCredentials =
    isSuperAdminSession ||
    (session?.user as { credentialsEnabled?: boolean })?.credentialsEnabled === true
  /** Vincular/crear propia: basta módulo ON (gestión completa = jerarquía, no creación). */
  const canManageCredentials = hasCredentials

  const {
    // Data
    equipment,
    batch,
    batchMetrics,
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
    showConvertToPurchaseDialog,
    setShowConvertToPurchaseDialog,

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
    canConvertToPurchase,

    // Actions
    loadEquipmentDetail,
    handleDelete,
    handlePermanentDelete,
    submitAssignment,
    submitReturn,
    submitMaintenance,
    handleReportProblem,
    downloadQR,
  } = useEquipmentDetail({ equipmentId, userRole, userId, isSuperAdmin })

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
      {/* Botón regresar */}
      <button
        type='button'
        onClick={() => router.push('/inventory')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Regresar a Equipos
      </button>

      {/* Header */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-3 min-w-0'>
          <Package className='h-6 w-6 shrink-0 text-muted-foreground' />
          <div className='min-w-0'>
            <h1 className='text-lg font-bold truncate'>
              {equipment.type?.name || 'Sin tipo'} ·{' '}
              {equipment.model?.brand?.name || equipment.brand || ''}{' '}
              {equipment.model?.model || equipment.modelDeprecated || ''}
            </h1>
            <p className='text-xs text-muted-foreground font-mono truncate'>{equipment.code}</p>
            {equipment.status === 'FOR_SALE' && (
              <span className='inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'>
                <Tag className='h-3.5 w-3.5' />
                En venta
                {equipment.saleListingPrice && (
                  <span className='font-semibold ml-1'>
                    · {formatCurrency(equipment.saleListingPrice)}
                  </span>
                )}
              </span>
            )}
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
          canConvertToPurchase={canConvertToPurchase ?? false}
          canSell={
            (userRole === 'ADMIN' || isSuperAdmin) &&
            equipment.status === 'FOR_SALE' &&
            !isAssigned &&
            !(equipment as any).sale
          }
          canTransferFamily={(userRole === 'ADMIN' || isSuperAdmin) && !isAssigned}
          isSuperAdmin={isSuperAdmin}
          isInMaintenance={isInMaintenance}
          onReportProblem={handleReportProblem}
          onRequestMaintenance={() => setShowMaintenanceDialog(true)}
          onEdit={() => router.push(`/inventory/equipment/${equipmentId}/edit`)}
          onAssign={() => setShowAssignDialog(true)}
          onReturn={() => setShowReturnDialog(true)}
          onMaintenance={() => setShowMaintenanceDialog(true)}
          onRetire={() => setShowDecommissionForm(true)}
          onPermanentDelete={() => setShowPermanentDeleteDialog(true)}
          onConvertToPurchase={() => setShowConvertToPurchaseDialog(true)}
          onSell={() => setShowSaleDialog(true)}
          onTransferFamily={() => setShowTransferFamilyDialog(true)}
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

      {/* Main Content — 2 columnas: info principal | lateral */}
      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Columna principal — ocupa 2/3 */}
        <div className='lg:col-span-2 space-y-6'>
          {/* 1. Información principal del activo */}
          <EquipmentInfoCard equipment={equipment} />

          {batch && <EquipmentBatchCard batch={batch} batchMetrics={batchMetrics} />}

          {/* 2. Adjuntos — fotos y documentos (visible de inmediato para ver la imagen) */}
          <EquipmentAttachments
            equipmentId={equipmentId}
            canManage={userRole === 'ADMIN' || userRole === 'TECHNICIAN'}
          />

          {/* 3. Mantenimientos activos o recientes */}
          {maintenanceRecords.length > 0 && (
            <EquipmentMaintenanceCard
              maintenanceRecords={maintenanceRecords}
              equipmentStatus={equipment.status}
            />
          )}

          {/* 4. Historial de eventos */}
          <EquipmentHistoryCard history={history as any} />

          {/* 5. Información financiera — colapsable */}
          {((equipment as any).purchasePrice ||
            (equipment as any).invoiceNumber ||
            (equipment as any).supplierId) && (
            <FinancialInfoSection
              supplierId={(equipment as any).supplierId}
              supplierName={(equipment as any).supplier?.name}
              invoiceNumber={(equipment as any).invoiceNumber}
              purchaseOrderNumber={(equipment as any).purchaseOrderNumber}
              purchasePrice={(equipment as any).purchasePrice}
              purchaseDate={(equipment as any).purchaseDate}
              readOnly
            />
          )}

          {/* 6. Facturas / pagos de adquisición */}
          <AcquisitionInvoicesCard
            assetType='equipment'
            assetId={equipmentId}
            canManage={userRole === 'ADMIN' || isSuperAdminSession}
          />

          {/* 7. Depreciación — colapsable */}
          {(equipment as any).usefulLifeYears && (
            <div className='rounded-md border border-border overflow-hidden'>
              <button
                type='button'
                className='flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors'
                onClick={() => setShowDepreciation(p => !p)}
              >
                <span className='flex items-center gap-2'>
                  <TrendingDown className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                  Depreciación
                </span>
                {showDepreciation ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </button>
              {showDepreciation && (
                <div className='border-t border-border px-4 py-4'>
                  <DepreciationCard
                    purchasePrice={(equipment as any).purchasePrice}
                    purchaseDate={(equipment as any).purchaseDate}
                    usefulLifeYears={(equipment as any).usefulLifeYears}
                    residualValue={(equipment as any).residualValue}
                    depreciation={(equipment as any).depreciation}
                    depreciationMethod={(equipment as any).depreciationMethod}
                    totalUnits={(equipment as any).totalUnits}
                    usedUnits={(equipment as any).usedUnits}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna lateral — QR + asignación */}
        <div className='space-y-6'>
          {hasCredentials && (
            <LinkedCredentialsCard
              entity='equipment'
              entityId={equipmentId}
              familyId={
                (equipment.type as { familyId?: string; family?: { id?: string } } | undefined)
                  ?.familyId ??
                (equipment.type as { family?: { id?: string } } | undefined)?.family?.id
              }
              familyName={
                (equipment.type as { family?: { name?: string } } | undefined)?.family?.name
              }
              canManage={canManageCredentials}
            />
          )}
          <EquipmentQRCard
            qrCode={qrCode}
            equipmentCode={equipment.code}
            equipmentName={
              [
                equipment.model?.brand?.name || equipment.brand,
                equipment.model?.model || equipment.modelDeprecated,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onDownload={downloadQR}
          />
          {currentAssignment && <EquipmentAssignmentCard assignment={currentAssignment} />}
        </div>
      </div>

      {/* Dialogs */}
      <AssignmentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        familyId={(equipment as any).type?.family?.id}
        contractId={(equipment as any).businessContractId ?? null}
        currentUser={
          currentAssignment
            ? {
                id: currentAssignment.receiverId,
                name: currentAssignment.receiver?.name ?? '',
                email: currentAssignment.receiver?.email ?? '',
              }
            : null
        }
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
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
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
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        equipmentType={equipment.type}
        currentAssignment={currentAssignment}
        userRole={userRole}
        familyId={(equipment.type as any)?.family?.id}
        form={maintenanceForm}
        onFormChange={setMaintenanceForm}
        onSubmit={submitMaintenance}
        submitting={submittingMaintenance}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      <PermanentDeleteDialog
        open={showPermanentDeleteDialog}
        onOpenChange={setShowPermanentDeleteDialog}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        equipmentStatus={equipment.status}
        onConfirm={handlePermanentDelete}
        deleting={permanentDeleting}
      />

      <DecommissionDialog
        open={showDecommissionForm}
        onOpenChange={setShowDecommissionForm}
        equipmentId={equipmentId}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        acquisitionMode={
          (equipment as any).acquisitionMode ?? equipment.ownershipType ?? 'FIXED_ASSET'
        }
        onSuccess={loadEquipmentDetail}
      />

      <ConvertToPurchaseDialog
        open={showConvertToPurchaseDialog}
        onOpenChange={setShowConvertToPurchaseDialog}
        equipmentId={equipmentId}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        currentOwnershipType={equipment.ownershipType}
        suggestedBuyoutValue={equipment.rentalBuyoutValue}
        onSuccess={loadEquipmentDetail}
      />

      <SaleDialog
        open={showSaleDialog}
        onOpenChange={setShowSaleDialog}
        equipmentId={equipmentId}
        equipmentCode={equipment.code}
        equipmentTypeName={equipment.type?.name}
        equipmentBrandName={equipment.model?.brand?.name || equipment.brand}
        equipmentModelName={equipment.model?.model || equipment.modelDeprecated}
        defaultAccessories={equipment.accessories ?? []}
        isSuperAdmin={isSuperAdmin}
        onSuccess={loadEquipmentDetail}
      />

      <TransferFamilyDialog
        open={showTransferFamilyDialog}
        onOpenChange={setShowTransferFamilyDialog}
        assetId={equipmentId}
        assetKind='EQUIPMENT'
        assetLabel={`${equipment.model?.brand?.name || equipment.brand} ${equipment.model?.model || equipment.modelDeprecated} (${equipment.code})`}
        currentFamilyId={(equipment.type as any)?.familyId ?? null}
        currentFamilyName={(equipment.type as any)?.family?.name ?? null}
        onSuccess={loadEquipmentDetail}
      />
    </div>
  )
}
