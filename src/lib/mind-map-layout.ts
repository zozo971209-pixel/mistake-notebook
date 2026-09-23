export type MindMapLayoutSide = "left" | "right" | "top" | "bottom";

export type MindMapLayoutNode = {
  id: string;
  parent_id?: string | null;
  layout_side?: MindMapLayoutSide;
  position_x: number;
  position_y: number;
};

export type MindMapLayoutPosition = {
  id: string;
  position_x: number;
  position_y: number;
};

export type MindMapLayoutGeometry = {
  root: LayoutRect;
  nodeWidth: number;
  nodeHeight: number;
  horizontalBranchGap: number;
  verticalBranchGap: number;
  horizontalSiblingGap: number;
  verticalSiblingGap: number;
  directionalGroupGap: number;
  positionLimit: number;
};

type LayoutPoint = { x: number; y: number };
type LayoutRect = LayoutPoint & { width: number; height: number };

export function arrangeMindMapNodes<T extends MindMapLayoutNode>(
  nodes: T[],
  currentPosition: (node: T) => LayoutPoint,
  geometry: MindMapLayoutGeometry,
): MindMapLayoutPosition[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, T[]>();
  for (const node of nodes) {
    const parentId = node.parent_id && nodeById.has(node.parent_id) ? node.parent_id : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), node]);
  }

  const placed = new Map<string, LayoutPoint>();
  const visited = new Set<string>();
  const subtreeIdsMemo = new Map<string, string[]>();
  const subtreeIds = (nodeId: string, trail = new Set<string>()): string[] => {
    if (subtreeIdsMemo.has(nodeId)) return subtreeIdsMemo.get(nodeId)!;
    if (trail.has(nodeId)) return [nodeId];
    const nextTrail = new Set(trail).add(nodeId);
    const ids = [nodeId, ...(childrenByParent.get(nodeId) ?? []).flatMap((child) => subtreeIds(child.id, nextTrail))];
    const unique = [...new Set(ids)];
    subtreeIdsMemo.set(nodeId, unique);
    return unique;
  };
  const branchUnitsMemo = new Map<string, number>();
  const branchUnits = (nodeId: string, trail = new Set<string>()): number => {
    if (branchUnitsMemo.has(nodeId)) return branchUnitsMemo.get(nodeId)!;
    if (trail.has(nodeId)) return 1;
    const children = childrenByParent.get(nodeId) ?? [];
    if (!children.length) return 1;
    const nextTrail = new Set(trail).add(nodeId);
    const units = Math.max(1, children.reduce((sum, child) => sum + branchUnits(child.id, nextTrail), 0));
    branchUnitsMemo.set(nodeId, units);
    return units;
  };
  const nodeRect = (nodeId: string): LayoutRect => {
    const node = nodeById.get(nodeId)!;
    const point = placed.get(nodeId) ?? currentPosition(node);
    return { ...point, width: geometry.nodeWidth, height: geometry.nodeHeight };
  };
  const boundsForIds = (ids: string[]): LayoutRect => {
    const rects = ids.filter((id) => nodeById.has(id)).map(nodeRect);
    if (!rects.length) return { ...geometry.root };
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  };
  const shiftIds = (ids: string[], dx: number, dy: number) => {
    if (!dx && !dy) return;
    for (const id of ids) {
      const node = nodeById.get(id);
      if (!node) continue;
      const point = placed.get(id) ?? currentPosition(node);
      placed.set(id, { x: point.x + dx, y: point.y + dy });
    }
  };
  const idsForRoots = (roots: T[]) => [...new Set(roots.flatMap((root) => subtreeIds(root.id)))];

  const layoutChildren = (parentId: string | null, parentRect: LayoutRect, trail = new Set<string>()) => {
    if (parentId && trail.has(parentId)) return;
    const nextTrail = parentId ? new Set(trail).add(parentId) : trail;
    const groups = new Map<MindMapLayoutSide, T[]>();
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      const current = currentPosition(child);
      const side = child.layout_side ?? connectorDirection(parentRect, { ...current, width: geometry.nodeWidth, height: geometry.nodeHeight });
      groups.set(side, [...(groups.get(side) ?? []), child]);
    }

    for (const side of ["left", "right", "top", "bottom"] as const) {
      const children = groups.get(side);
      if (!children?.length) continue;
      const vertical = side === "left" || side === "right";
      const unitSize = vertical
        ? geometry.nodeHeight + geometry.verticalSiblingGap
        : geometry.nodeWidth + geometry.horizontalSiblingGap;
      const ordered = [...children].sort((left, right) => {
        const leftPosition = currentPosition(left);
        const rightPosition = currentPosition(right);
        return vertical ? leftPosition.y - rightPosition.y : leftPosition.x - rightPosition.x;
      });
      const spans = ordered.map((child) => Math.max(unitSize, branchUnits(child.id) * unitSize));
      const parentCenter = rectCenter(parentRect);
      let cursor = (vertical ? parentCenter.y : parentCenter.x) - spans.reduce((sum, span) => sum + span, 0) / 2;
      ordered.forEach((child, index) => {
        const crossCenter = cursor + spans[index] / 2;
        cursor += spans[index];
        const rect = childRectFromParent(parentRect, side, crossCenter, geometry);
        placed.set(child.id, { x: rect.x, y: rect.y });
        visited.add(child.id);
        layoutChildren(child.id, rect, nextTrail);
      });

      const subtreeGap = vertical ? geometry.verticalSiblingGap : geometry.horizontalSiblingGap;
      const subtreeBounds = ordered.map((child) => boundsForIds(subtreeIds(child.id)));
      const totalCrossSpan = subtreeBounds.reduce((sum, bounds) => sum + (vertical ? bounds.height : bounds.width), 0)
        + Math.max(0, ordered.length - 1) * subtreeGap;
      let packCursor = (vertical ? parentCenter.y : parentCenter.x) - totalCrossSpan / 2;
      ordered.forEach((child) => {
        const bounds = boundsForIds(subtreeIds(child.id));
        const crossStart = vertical ? bounds.y : bounds.x;
        const delta = packCursor - crossStart;
        shiftIds(subtreeIds(child.id), vertical ? 0 : delta, vertical ? delta : 0);
        packCursor += (vertical ? bounds.height : bounds.width) + subtreeGap;
      });

      const groupIds = idsForRoots(ordered);
      const groupBounds = boundsForIds(groupIds);
      const mainGap = vertical ? geometry.horizontalBranchGap : geometry.verticalBranchGap;
      let dx = 0;
      let dy = 0;
      if (side === "left") dx = parentRect.x - mainGap - (groupBounds.x + groupBounds.width);
      else if (side === "right") dx = parentRect.x + parentRect.width + mainGap - groupBounds.x;
      else if (side === "top") dy = parentRect.y - mainGap - (groupBounds.y + groupBounds.height);
      else dy = parentRect.y + parentRect.height + mainGap - groupBounds.y;
      shiftIds(groupIds, dx, dy);
    }

    const horizontalRoots = [...(groups.get("left") ?? []), ...(groups.get("right") ?? [])];
    const horizontalIds = idsForRoots(horizontalRoots);
    const horizontalBounds = horizontalIds.length ? boundsForIds(horizontalIds) : parentRect;
    const upperRoots = groups.get("top") ?? [];
    const lowerRoots = groups.get("bottom") ?? [];
    if (upperRoots.length) {
      const ids = idsForRoots(upperRoots);
      const bounds = boundsForIds(ids);
      const requiredBottom = Math.min(parentRect.y, horizontalBounds.y) - geometry.directionalGroupGap;
      shiftIds(ids, 0, requiredBottom - (bounds.y + bounds.height));
    }
    if (lowerRoots.length) {
      const ids = idsForRoots(lowerRoots);
      const bounds = boundsForIds(ids);
      const requiredTop = Math.max(parentRect.y + parentRect.height, horizontalBounds.y + horizontalBounds.height) + geometry.directionalGroupGap;
      shiftIds(ids, 0, requiredTop - bounds.y);
    }
  };

  layoutChildren(null, geometry.root);
  return nodes.map((node) => {
    const position = placed.get(node.id) ?? currentPosition(node);
    return {
      id: node.id,
      position_x: Math.round(clamp(position.x, -geometry.positionLimit, geometry.positionLimit)),
      position_y: Math.round(clamp(position.y, -geometry.positionLimit, geometry.positionLimit)),
    };
  });
}

function childRectFromParent(parent: LayoutRect, side: MindMapLayoutSide, crossCenter: number, geometry: MindMapLayoutGeometry): LayoutRect {
  const mainGap = side === "left" || side === "right" ? geometry.horizontalBranchGap : geometry.verticalBranchGap;
  if (side === "right") return { x: parent.x + parent.width + mainGap, y: crossCenter - geometry.nodeHeight / 2, width: geometry.nodeWidth, height: geometry.nodeHeight };
  if (side === "left") return { x: parent.x - geometry.nodeWidth - mainGap, y: crossCenter - geometry.nodeHeight / 2, width: geometry.nodeWidth, height: geometry.nodeHeight };
  if (side === "bottom") return { x: crossCenter - geometry.nodeWidth / 2, y: parent.y + parent.height + mainGap, width: geometry.nodeWidth, height: geometry.nodeHeight };
  return { x: crossCenter - geometry.nodeWidth / 2, y: parent.y - geometry.nodeHeight - mainGap, width: geometry.nodeWidth, height: geometry.nodeHeight };
}

function connectorDirection(source: LayoutRect, target: LayoutRect): MindMapLayoutSide {
  const sourceCenter = rectCenter(source);
  const targetCenter = rectCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const horizontalDistance = Math.abs(dx) / Math.max(1, source.width / 2);
  const verticalDistance = Math.abs(dy) / Math.max(1, source.height / 2);
  if (horizontalDistance >= verticalDistance) return dx < 0 ? "left" : "right";
  return dy < 0 ? "top" : "bottom";
}

function rectCenter(rect: LayoutRect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
