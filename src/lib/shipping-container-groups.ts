import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import type {
  BarrelShippingIntakeContainerRow,
  BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";

export type LinkedShippingContainerGroup = {
  barrelIds: string[];
  awaiting: BarrelShippingIntakeContainerRow[];
  submitted: BarrelShippingIntakeSubmittedRow[];
  members: Array<
    BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow
  >;
  chargeHost: BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow;
};

export function isShippingIntakeSubmittedRow(
  row: BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow,
): row is BarrelShippingIntakeSubmittedRow {
  return "intakeId" in row && typeof row.intakeId === "string";
}

export function linkedShippingGroupLabel(
  members: readonly { alias: string }[],
): string {
  return members.map((item) => item.alias).join(" + ");
}

function chargeLinkScore(
  charges: readonly BarrelOutboundShippingChargeView[],
): number {
  let score = 0;
  for (const charge of charges) {
    const linked = charge.linkedContainers?.length ?? 0;
    if (linked >= 2) score += linked * 10;
    if (charge.chargeKind === "freight") score += 1;
  }
  return score;
}

function pickChargeHost(
  members: Array<
    BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow
  >,
  preferAwaiting: boolean,
): BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow {
  const ranked = [...members].sort((a, b) => {
    const scoreDelta =
      chargeLinkScore(b.outboundCharges) - chargeLinkScore(a.outboundCharges);
    if (scoreDelta !== 0) return scoreDelta;
    if (preferAwaiting) {
      const aAwaiting = isShippingIntakeSubmittedRow(a) ? 1 : 0;
      const bAwaiting = isShippingIntakeSubmittedRow(b) ? 1 : 0;
      if (aAwaiting !== bAwaiting) return aAwaiting - bAwaiting;
    }
    return a.alias.localeCompare(b.alias);
  });
  return ranked[0] ?? members[0];
}

function linkedIdsFromCharges(
  charges: readonly BarrelOutboundShippingChargeView[],
): string[] {
  const ids = new Set<string>();
  for (const charge of charges) {
    for (const item of charge.linkedContainers ?? []) {
      if (item.barrelId) ids.add(item.barrelId);
    }
  }
  return [...ids];
}

/** Group barrels that share freight, freight+broker, freight+courier, or standalone broker/courier rate links. */
export function groupShippingContainersByRateLinks(
  awaiting: readonly BarrelShippingIntakeContainerRow[],
  submitted: readonly BarrelShippingIntakeSubmittedRow[],
): LinkedShippingContainerGroup[] {
  const byId = new Map<
    string,
    BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow
  >();
  for (const row of awaiting) byId.set(row.barrelId, row);
  for (const row of submitted) byId.set(row.barrelId, row);
  const ids = [...byId.keys()];
  if (ids.length === 0) return [];

  const parent = new Map<string, string>(ids.map((id) => [id, id]));

  function find(id: string): string {
    let current = parent.get(id) ?? id;
    while (parent.get(current) !== current) {
      const next = parent.get(current) ?? current;
      parent.set(current, parent.get(next) ?? next);
      current = next;
    }
    return current;
  }

  function union(a: string, b: string) {
    if (!parent.has(a) || !parent.has(b)) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    parent.set(rootB, rootA);
  }

  for (const row of byId.values()) {
    const linked = linkedIdsFromCharges(row.outboundCharges);
    for (const id of linked) {
      union(row.barrelId, id);
    }
  }

  const buckets = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const list = buckets.get(root) ?? [];
    list.push(id);
    buckets.set(root, list);
  }

  return [...buckets.values()]
    .map((barrelIds) => {
      const members = barrelIds
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => a.alias.localeCompare(b.alias));
      const awaitingMembers = members.filter(
        (row): row is BarrelShippingIntakeContainerRow =>
          !isShippingIntakeSubmittedRow(row),
      );
      const submittedMembers = members.filter(isShippingIntakeSubmittedRow);
      return {
        barrelIds: members.map((row) => row.barrelId),
        awaiting: awaitingMembers,
        submitted: submittedMembers,
        members,
        chargeHost: pickChargeHost(
          members,
          awaitingMembers.length > 0 && submittedMembers.length === 0,
        ),
      };
    })
    .sort((a, b) =>
      linkedShippingGroupLabel(a.members).localeCompare(
        linkedShippingGroupLabel(b.members),
      ),
    );
}
