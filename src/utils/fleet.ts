import type { Vehicle, VehicleKind } from '@dash4/shared'

/** Icône PrimeIcons d'un type de véhicule. */
export function vehicleIcon(kind: VehicleKind): string {
  return kind === 'scooter' || kind === 'motorcycle' ? 'pi pi-bolt' : kind === 'truck' || kind === 'utility' ? 'pi pi-truck' : 'pi pi-car'
}

/** Pire alerte d'un véhicule pour le tri et la pastille de la liste : 2 = urgent, 1 = à prévoir, 0 = rien. */
export function alertLevel(v: Pick<Vehicle, 'alerts'>): number {
  return Math.max(0, ...(v.alerts ?? []).map((a) => (a.state === 'expired' || a.state === 'late' ? 2 : a.state === 'soon' ? 1 : 0)))
}

/** Nombre entier saisi (champ vide → null). */
export function intOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined || Number.isNaN(value) ? null : Math.round(value)
}
