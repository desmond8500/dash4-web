import type { Characteristic, Equipment, EquipmentPayload, EquipmentStatus, Reserve } from '@dash4/shared'

/** Couleur de la barre d'avancement. */
export function progressColor(percent: number): string {
  if (percent >= 100) return 'var(--p-green-500)'
  if (percent >= 50) return 'var(--p-primary-color)'
  return 'var(--p-orange-400)'
}

export function equipmentStatusSeverity(status: EquipmentStatus): 'secondary' | 'info' | 'success' | 'danger' | 'contrast' {
  return ({ planned: 'secondary', installed: 'info', commissioned: 'success', faulty: 'danger', removed: 'contrast' } as const)[status]
}

export interface EquipmentForm {
  name: string
  type: string
  model: string
  serial_number: string
  quantity: number
  status: EquipmentStatus
  parent_id: number | null
  article_id: number | null
  room_id: number | null
  level_id: number | null
  description: string
  characteristics: Characteristic[]
}

export function equipmentForm(e?: Equipment | null, parentId: number | null = null): EquipmentForm {
  return {
    name: e?.name ?? '',
    type: e?.type ?? '',
    model: e?.model ?? '',
    serial_number: e?.serial_number ?? '',
    quantity: e?.quantity ?? 1,
    status: e?.status.value ?? 'planned',
    parent_id: e ? e.parent_id : parentId,
    article_id: e?.article_id ?? null,
    room_id: e?.room_id ?? null,
    level_id: e?.level_id ?? null,
    description: e?.description ?? '',
    characteristics: (e?.characteristics ?? []).map((c) => ({ ...c })),
  }
}

/** Champs vides envoyés à null, caractéristiques sans libellé retirées. */
export function equipmentPayload(f: EquipmentForm): EquipmentPayload {
  const text = (v: string) => v.trim() || null
  return {
    name: text(f.name),
    type: text(f.type),
    model: text(f.model),
    serial_number: text(f.serial_number),
    quantity: Math.max(1, Math.round(f.quantity || 1)),
    status: f.status,
    parent_id: f.parent_id,
    article_id: f.article_id,
    room_id: f.room_id,
    level_id: f.room_id ? null : f.level_id,
    description: text(f.description),
    characteristics: f.characteristics.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), value: c.value.trim() })),
  }
}

/** « 2 réserves, 1 levée » */
export function reservesSummary(reserves: Reserve[]): string {
  if (!reserves.length) return 'Aucune réserve'
  const lifted = reserves.filter((r) => r.lifted_at).length
  return `${reserves.length} réserve${reserves.length > 1 ? 's' : ''}${lifted ? `, ${lifted} levée${lifted > 1 ? 's' : ''}` : ''}`
}
