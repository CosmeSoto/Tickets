/**
 * Migra vínculos de contrato en equipos del modelo legado al módulo `contracts`.
 *
 * Casos que corrige:
 *  1. contract_id contiene un ID de `contracts` (bug histórico del ContractPicker)
 *  2. contract_id legado en software_licenses pero rentalContractNumber apunta a contracts
 *  3. Ya existe contract_lines pero contract_id legado sigue poblado (limpieza)
 *  4. contract_id huérfano (no existe en software_licenses ni contracts)
 *
 * Ejecutar:
 *   npx tsx scripts/migrate-equipment-contract-links.ts --dry-run
 *   npx tsx scripts/migrate-equipment-contract-links.ts --apply
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const dryRun = !apply || process.argv.includes('--dry-run')

interface MigrationAction {
  equipmentId: string
  equipmentCode: string
  action: string
  contractId?: string
  contractNumber?: string
}

const actions: MigrationAction[] = []
const skipped: MigrationAction[] = []

function equipmentLabel(eq: {
  code: string
  brand: string
  model?: { model: string | null } | null
  modelDeprecated?: string | null
}) {
  return `${eq.code} — ${eq.brand} ${eq.model?.model ?? eq.modelDeprecated ?? ''}`.trim()
}

async function linkToBusinessContract(
  equipmentId: string,
  businessContractId: string,
  label: string
) {
  if (dryRun) return

  const businessContract = await prisma.contracts.findUnique({
    where: { id: businessContractId },
    select: {
      id: true,
      contractNumber: true,
      startDate: true,
      endDate: true,
      monthlyCost: true,
      status: true,
    },
  })
  if (!businessContract) return

  await prisma.contract_lines.deleteMany({ where: { equipmentId } })
  const lineCount = await prisma.contract_lines.count({
    where: { contractId: businessContract.id },
  })
  await prisma.contract_lines.create({
    data: {
      id: randomUUID(),
      contractId: businessContract.id,
      type: 'EQUIPMENT',
      description: label,
      quantity: 1,
      equipmentId,
      order: lineCount,
    },
  })

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      contractId: null,
      rentalContractNumber: businessContract.contractNumber,
      rentalStartDate: businessContract.startDate,
      rentalEndDate: businessContract.endDate,
      rentalMonthlyCost: businessContract.monthlyCost,
      contractStartDate: businessContract.startDate,
      contractEndDate: businessContract.endDate,
      contractRenewalCost: businessContract.monthlyCost,
    },
  })

  if (businessContract.status === 'DRAFT') {
    await prisma.contracts.update({
      where: { id: businessContract.id },
      data: { status: 'ACTIVE' },
    })
  }
}

async function clearLegacyContractId(equipmentId: string) {
  if (dryRun) return
  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { contractId: null },
  })
}

async function migrate() {
  console.log(`\n🔧 Migración de contratos en equipos (${dryRun ? 'DRY-RUN' : 'APLICAR'})\n`)

  const equipmentList = await prisma.equipment.findMany({
    where: {
      OR: [{ contractId: { not: null } }, { rentalContractNumber: { not: null } }],
    },
    select: {
      id: true,
      code: true,
      brand: true,
      modelDeprecated: true,
      contractId: true,
      rentalContractNumber: true,
      model: { select: { model: true } },
    },
  })

  for (const eq of equipmentList) {
    const label = equipmentLabel(eq)
    const existingLine = await prisma.contract_lines.findFirst({
      where: { equipmentId: eq.id },
      select: { contractId: true, contract: { select: { contractNumber: true, name: true } } },
    })

    // Ya migrado: limpiar contract_id legado si quedó
    if (existingLine) {
      if (eq.contractId) {
        actions.push({
          equipmentId: eq.id,
          equipmentCode: eq.code,
          action: 'clear_legacy_contract_id',
          contractId: existingLine.contractId,
          contractNumber:
            existingLine.contract?.contractNumber ?? existingLine.contract?.name ?? undefined,
        })
        await clearLegacyContractId(eq.id)
      }
      continue
    }

    // Caso 1: contract_id es en realidad un ID de contracts (bug del picker)
    if (eq.contractId) {
      const misplacedBusiness = await prisma.contracts.findUnique({
        where: { id: eq.contractId },
        select: { id: true, contractNumber: true, name: true },
      })
      if (misplacedBusiness) {
        actions.push({
          equipmentId: eq.id,
          equipmentCode: eq.code,
          action: 'link_misplaced_business_id',
          contractId: misplacedBusiness.id,
          contractNumber: misplacedBusiness.contractNumber ?? misplacedBusiness.name,
        })
        await linkToBusinessContract(eq.id, misplacedBusiness.id, label)
        continue
      }
    }

    // Caso 2: rentalContractNumber coincide con un contrato de negocio
    if (eq.rentalContractNumber) {
      const byNumber = await prisma.contracts.findFirst({
        where: { contractNumber: eq.rentalContractNumber },
        select: { id: true, contractNumber: true, name: true },
      })
      if (byNumber) {
        actions.push({
          equipmentId: eq.id,
          equipmentCode: eq.code,
          action: 'link_by_contract_number',
          contractId: byNumber.id,
          contractNumber: byNumber.contractNumber ?? byNumber.name,
        })
        await linkToBusinessContract(eq.id, byNumber.id, label)
        continue
      }
    }

    // Caso 3: contract_id legado válido en software_licenses — mantener, solo reportar
    if (eq.contractId) {
      const legacy = await prisma.software_licenses.findUnique({
        where: { id: eq.contractId },
        select: { id: true, name: true },
      })
      if (legacy) {
        skipped.push({
          equipmentId: eq.id,
          equipmentCode: eq.code,
          action: 'legacy_license_kept',
          contractId: legacy.id,
          contractNumber: legacy.name,
        })
        continue
      }

      // Caso 4: huérfano
      actions.push({
        equipmentId: eq.id,
        equipmentCode: eq.code,
        action: 'clear_orphan_contract_id',
        contractId: eq.contractId,
      })
      await clearLegacyContractId(eq.id)
      continue
    }

    // rentalContractNumber sin contrato coincidente
    if (eq.rentalContractNumber) {
      skipped.push({
        equipmentId: eq.id,
        equipmentCode: eq.code,
        action: 'rental_number_no_match',
        contractNumber: eq.rentalContractNumber,
      })
    }
  }

  console.log(`✅ Acciones ${dryRun ? 'simuladas' : 'aplicadas'}: ${actions.length}`)
  for (const a of actions) {
    console.log(
      `   • [${a.action}] ${a.equipmentCode} → ${a.contractNumber ?? a.contractId ?? '—'}`
    )
  }

  if (skipped.length > 0) {
    console.log(`\n⚠️  Revisión manual (${skipped.length}):`)
    for (const s of skipped) {
      console.log(
        `   • [${s.action}] ${s.equipmentCode} → ${s.contractNumber ?? s.contractId ?? '—'}`
      )
    }
  }

  if (dryRun) {
    console.log('\n💡 Ejecuta con --apply para persistir los cambios.')
  }
}

migrate()
  .catch(err => {
    console.error('❌ Error en migración:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
