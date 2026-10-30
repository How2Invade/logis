export type AffectedNode = {
  nodeId: string
  nodeType: 'productionLine' | 'warehouse' | 'shipment' | 'delivered'
  palletIds: string[]
  units: number
  confidence: 'confirmed' | 'probable' | 'unknown'
  dispatchedAt?: string
}

export type CUSResult = {
  score: number
  escapedUnits: number
  interceptableUnits: number
}

export function computeCUS(nodes: AffectedNode[]): CUSResult {
  const seenPallets = new Set<string>()
  const confidenceWeights: Record<'confirmed' | 'probable' | 'unknown', number> = {
    confirmed: 1,
    probable: 0.6,
    unknown: 0.2
  }

  let escapedUnits = 0
  let interceptableUnits = 0
  let totalUrgency = 0
  let totalDenominator = 0

  const now = Date.now()

  for (const node of nodes) {
    // If a palletId was already seen in an earlier node, skip that node
    const hasDuplicatePallet = node.palletIds.some((id) => seenPallets.has(id))
    if (hasDuplicatePallet) {
      continue
    }

    // Register all pallets for this node
    for (const id of node.palletIds) {
      seenPallets.add(id)
    }

    const weight = confidenceWeights[node.confidence] ?? 0.2

    if (node.nodeType === 'delivered') {
      escapedUnits += node.units
    } else {
      let hours = 4
      if (node.nodeType === 'productionLine') {
        hours = 0.5
      } else if (node.nodeType === 'warehouse') {
        hours = 4
      } else if (node.nodeType === 'shipment') {
        let hoursSinceDispatched = 0
        if (node.dispatchedAt) {
          const dispatchTime = new Date(node.dispatchedAt).getTime()
          if (!isNaN(dispatchTime)) {
            hoursSinceDispatched = Math.max(0, (now - dispatchTime) / (1000 * 60 * 60))
          }
        }
        hours = Math.max(0.25, 24 - hoursSinceDispatched)
      }

      const urgency = (node.units * weight) / hours
      totalUrgency += urgency
      interceptableUnits += node.units * weight
      totalDenominator += node.units * 4
    }
  }

  const score = totalDenominator === 0 ? 0 : Math.min(100, Math.round((totalUrgency / totalDenominator) * 100))

  return {
    score,
    escapedUnits,
    interceptableUnits
  }
}

