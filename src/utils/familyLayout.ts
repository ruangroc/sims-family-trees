import { FamilyMemberDataNode, FamilyTreeNode } from '@/types/family';
import { isReproductionNode } from './transformData';

// Unlike isFamilyMember, tolerates rows without a gender yet (unborn babies)
function isMemberNode(node: FamilyTreeNode): node is FamilyMemberDataNode {
  return node !== undefined && 'name' in node && !('reproductionMethod' in node);
}

// Horizontal center-to-center distance between partners in a couple row
const COUPLE_SPACING = 130;
// Gap between adjacent sibling subtrees
const SIBLING_GAP = 40;
// Gap between unrelated root subtrees
const ROOT_GAP = 90;
// Vertical distance between generations
const ROW_HEIGHT = 170;

export interface LayoutPerson {
  kind: 'person';
  id: string;
  name: string;
  gender?: 'Male' | 'Female';
  description?: string;
  x: number;
  y: number;
}

export interface LayoutUnion {
  kind: 'union';
  id: string;
  /** Canonical bucket used for color + legend */
  methodLabel: string;
  /** Raw method string from the sheet, shown in tooltips */
  rawMethod: string;
  parentIds: string[];
  childIds: string[];
  x: number;
  y: number;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface FamilyLayout {
  persons: LayoutPerson[];
  unions: LayoutUnion[];
  edges: LayoutEdge[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const METHOD_COLORS: { [label: string]: { fill: string; border: string } } = {
  'Marriage': { fill: '#7e22ce', border: '#581c87' },
  'Dating / Hookup': { fill: '#a855f7', border: '#7e22ce' },
  'Adoption': { fill: '#ea580c', border: '#9a3412' },
  'Clone': { fill: '#0891b2', border: '#155e75' },
  'Plant sim': { fill: '#16a34a', border: '#14532d' },
  'Time machine': { fill: '#1d4ed8', border: '#1e3a8a' },
  'Other': { fill: '#94a3b8', border: '#475569' },
};

export function canonicalMethod(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith('marr')) return 'Marriage'; // also catches the "Marraige" typo
  if (s === 'dating' || s === 'hookup' || s === 'dating or married') return 'Dating / Hookup';
  if (s === 'adoption' || s === 'adopted') return 'Adoption';
  if (s === 'clone') return 'Clone';
  if (s === 'plant sim' || s === 'plantsim') return 'Plant sim';
  if (s === 'time machine') return 'Time machine';
  return 'Other';
}

type Member = FamilyMemberDataNode;

interface Union {
  id: string;
  rawMethod: string;
  /** Parent names as listed in the sheet, primary (first-listed) parent first */
  parentNames: string[];
  children: Member[];
  synthetic: boolean;
}

interface Block {
  owner: Member;
  spouses: Member[];
  unions: Union[];
}

/**
 * Computes a genealogy-aware layout from the generation-keyed data the API
 * returns. Couples sit side by side on generation rows, a small union node
 * hangs between each couple and their children, and children are centered
 * beneath their parents. People who married into the family are attached
 * next to their partner; relationships that cannot fit the tree structure
 * (e.g. marriages between two blood relatives) are still drawn as edges to
 * the shared union node.
 */
export function computeFamilyLayout(data: { [key: string]: FamilyTreeNode[] }): FamilyLayout {
  const members: Member[] = [];
  const reproNodes: { parent1Name: string; parent2Name?: string; reproductionMethod: string }[] = [];

  Object.values(data).forEach(nodes => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach(node => {
      if (isMemberNode(node)) members.push(node);
      else if (isReproductionNode(node)) reproNodes.push(node);
    });
  });

  // Name lookup; on duplicate names the first occurrence wins (the sheet
  // format identifies people by name, so duplicates are inherently ambiguous)
  const byName = new Map<string, Member>();
  members.forEach(m => {
    if (m.name && !byName.has(m.name)) byName.set(m.name, m);
  });

  const unionKey = (names: string[], method: string) => `${[...names].sort().join('|')}|${method}`;
  const unions = new Map<string, Union>();

  const addUnion = (names: string[], method: string, synthetic: boolean): Union => {
    const key = unionKey(names, method);
    let u = unions.get(key);
    if (!u) {
      u = {
        id: `union-${key}`,
        rawMethod: method,
        parentNames: names,
        children: [],
        synthetic,
      };
      unions.set(key, u);
    }
    return u;
  };

  reproNodes.forEach(r => {
    const names = [r.parent1Name, r.parent2Name].filter((n): n is string => !!n);
    if (names.length === 0) return; // malformed row with no parents
    addUnion(names, r.reproductionMethod, false);
  });

  // Attach children to their birth union (creating it if the sheet had a
  // child row but no matching reproduction row)
  const birthUnionOf = new Map<string, Union>(); // member id -> union
  members.forEach(m => {
    const names = [m.parent1Name, m.parent2Name].filter((n): n is string => !!n);
    if (names.length === 0) return;
    const u = addUnion(names, m.reproducedVia ?? 'Unknown', false);
    u.children.push(m);
    birthUnionOf.set(m.id, u);
  });

  // Current partners without a shared union still get a relationship node
  members.forEach(m => {
    if (!m.currentPartner) return;
    const partner = byName.get(m.currentPartner);
    if (!partner || partner === m) return;
    const already = Array.from(unions.values()).some(
      u => u.parentNames.includes(m.name) && u.parentNames.includes(partner.name)
    );
    if (!already) addUnion([m.name, partner.name], 'Dating or Married', true);
  });

  const resolvedParents = (u: Union): Member[] =>
    u.parentNames.map(n => byName.get(n)).filter((m): m is Member => !!m);

  const hasKnownParents = (m: Member): boolean => {
    const u = birthUnionOf.get(m.id);
    return !!u && resolvedParents(u).length > 0;
  };

  const unionsOf = (m: Member): Union[] =>
    Array.from(unions.values()).filter(u => u.parentNames.includes(m.name));

  // Role assignment: everyone is either a blood child (placed beneath their
  // parents), a spouse (placed beside their partner), or a root
  const attachTo = new Map<string, string>(); // spouse name -> partner name
  members.forEach(m => {
    if (hasKnownParents(m)) return;
    const owned = unionsOf(m);
    // Prefer attaching to a partner who is a blood descendant
    for (const u of owned) {
      const partner = resolvedParents(u).find(p => p !== m && hasKnownParents(p));
      if (partner) {
        attachTo.set(m.name, partner.name);
        return;
      }
    }
    // Both partners are parentless (e.g. founder couples): the first-listed
    // parent anchors the couple and the other becomes the attached spouse
    for (const u of owned) {
      const partner = resolvedParents(u).find(p => p !== m);
      if (partner && u.parentNames[0] !== m.name && !attachTo.has(partner.name)) {
        attachTo.set(m.name, partner.name);
        return;
      }
    }
  });

  const role = (m: Member): 'child' | 'spouse' | 'root' => {
    if (hasKnownParents(m)) return 'child';
    if (attachTo.has(m.name)) return 'spouse';
    return 'root';
  };

  const ownerOf = (m: Member): Member => {
    const seen = new Set<string>([m.name]);
    let cur = m;
    while (role(cur) === 'spouse') {
      const next = byName.get(attachTo.get(cur.name)!);
      if (!next || seen.has(next.name)) break;
      seen.add(next.name);
      cur = next;
    }
    return cur;
  };

  // Render row (generation) for every member
  const rowMemo = new Map<string, number>();
  const rowOf = (m: Member, inProgress = new Set<string>()): number => {
    const cached = rowMemo.get(m.id);
    if (cached !== undefined) return cached;
    if (inProgress.has(m.id)) return 0; // corrupt-data cycle guard
    inProgress.add(m.id);
    let row = 0;
    const r = role(m);
    if (r === 'child') {
      const parents = resolvedParents(birthUnionOf.get(m.id)!);
      row = 1 + Math.max(...parents.map(p => rowOf(p, inProgress)));
    } else if (r === 'spouse') {
      const owner = ownerOf(m);
      row = owner === m ? 0 : rowOf(owner, inProgress);
    }
    rowMemo.set(m.id, row);
    return row;
  };

  // The union's host decides which subtree its children hang beneath: the
  // deepest known parent, ties broken by sheet order
  const hostOf = (u: Union): Member | undefined => {
    const parents = resolvedParents(u);
    if (parents.length === 0) return undefined;
    return parents.reduce((best, p) => (rowOf(p) > rowOf(best) ? p : best), parents[0]);
  };

  // Build blocks: an owner plus everyone attached beside them
  const blocks = new Map<string, Block>(); // owner name -> block
  members.forEach(m => {
    const owner = ownerOf(m);
    if (!blocks.has(owner.name)) blocks.set(owner.name, { owner, spouses: [], unions: [] });
    if (owner !== m) blocks.get(owner.name)!.spouses.push(m);
  });

  const orderedUnions = Array.from(unions.values());
  const unionIndex = new Map(orderedUnions.map((u, i) => [u.id, i]));

  orderedUnions.forEach(u => {
    const host = hostOf(u);
    if (!host) return; // floating union, positioned from its children below
    const block = blocks.get(ownerOf(host).name);
    if (block) block.unions.push(u);
  });

  blocks.forEach(block => {
    // Order spouses (and each spouse's children group) by when their
    // relationship appears in the sheet so couples and kids line up
    const firstUnionIdx = (m: Member) => {
      const own = unionsOf(m).map(u => unionIndex.get(u.id) ?? 0);
      return own.length ? Math.min(...own) : 0;
    };
    block.spouses.sort((a, b) => firstUnionIdx(a) - firstUnionIdx(b));

    const memberOrder = new Map<string, number>();
    [block.owner, ...block.spouses].forEach((m, i) => memberOrder.set(m.name, i));
    block.unions.sort((a, b) => {
      const spouseIdx = (u: Union) => {
        const others = resolvedParents(u).filter(p => memberOrder.has(p.name) && p !== block.owner);
        return others.length ? Math.min(...others.map(p => memberOrder.get(p.name)!)) : 0;
      };
      const diff = spouseIdx(a) - spouseIdx(b);
      return diff !== 0 ? diff : (unionIndex.get(a.id)! - unionIndex.get(b.id)!);
    });
  });

  const blockOfMember = (m: Member): Block => blocks.get(ownerOf(m).name)!;

  const childBlocksOf = (block: Block): Block[] => {
    const seen = new Set<Block>();
    const result: Block[] = [];
    block.unions.forEach(u => {
      u.children.forEach(c => {
        const cb = blockOfMember(c);
        if (cb !== block && !seen.has(cb)) {
          seen.add(cb);
          result.push(cb);
        }
      });
    });
    return result;
  };

  const widthMemo = new Map<Block, number>();
  const blockWidth = (block: Block, inProgress = new Set<Block>()): number => {
    const cached = widthMemo.get(block);
    if (cached !== undefined) return cached;
    if (inProgress.has(block)) return COUPLE_SPACING;
    inProgress.add(block);
    const coupleW = (1 + block.spouses.length) * COUPLE_SPACING;
    const kids = childBlocksOf(block);
    const childW = kids.reduce((sum, kb) => sum + blockWidth(kb, inProgress), 0)
      + Math.max(0, kids.length - 1) * SIBLING_GAP;
    const w = Math.max(coupleW, childW);
    widthMemo.set(block, w);
    return w;
  };

  const personX = new Map<string, number>(); // member id -> x
  const placeBlock = (block: Block, x0: number, placed: Set<Block>): void => {
    if (placed.has(block)) return;
    placed.add(block);
    const w = blockWidth(block);

    const kids = childBlocksOf(block);
    const childW = kids.reduce((sum, kb) => sum + blockWidth(kb), 0)
      + Math.max(0, kids.length - 1) * SIBLING_GAP;
    let cx = x0 + (w - childW) / 2;
    kids.forEach(kb => {
      placeBlock(kb, cx, placed);
      cx += blockWidth(kb) + SIBLING_GAP;
    });

    const coupleW = (1 + block.spouses.length) * COUPLE_SPACING;
    const px = x0 + (w - coupleW) / 2 + COUPLE_SPACING / 2;
    personX.set(block.owner.id, px);
    block.spouses.forEach((s, i) => personX.set(s.id, px + (i + 1) * COUPLE_SPACING));
  };

  // Roots: blocks whose owner is not a blood child of anyone
  const placed = new Set<Block>();
  let cursor = 0;
  members.forEach(m => {
    const block = blocks.get(m.name);
    if (!block || role(m) === 'child' || placed.has(block)) return;
    placeBlock(block, cursor, placed);
    cursor += blockWidth(block) + ROOT_GAP;
  });
  // Safety net for anything unreachable (e.g. corrupt-data cycles)
  blocks.forEach(block => {
    if (!placed.has(block)) {
      placeBlock(block, cursor, placed);
      cursor += blockWidth(block) + ROOT_GAP;
    }
  });

  const persons: LayoutPerson[] = members.map(m => ({
    kind: 'person',
    id: m.id,
    name: m.name,
    gender: m.gender,
    description: m.narrativeDescription,
    x: personX.get(m.id) ?? 0,
    y: rowOf(m) * ROW_HEIGHT,
  }));
  const personById = new Map(persons.map(p => [p.id, p]));

  const layoutUnions: LayoutUnion[] = [];
  orderedUnions.forEach(u => {
    const parents = resolvedParents(u);
    if (parents.length === 0 && u.children.length === 0) return;
    const parentPts = parents.map(p => personById.get(p.id)!);
    const childPts = u.children.map(c => personById.get(c.id)!);

    let x: number;
    let y: number;
    if (childPts.length > 0) {
      x = childPts.reduce((s, p) => s + p.x, 0) / childPts.length;
      const childY = Math.max(...childPts.map(p => p.y));
      const parentY = parentPts.length ? Math.max(...parentPts.map(p => p.y)) : childY - ROW_HEIGHT;
      y = (parentY + childY) / 2;
    } else {
      x = parentPts.reduce((s, p) => s + p.x, 0) / parentPts.length;
      y = Math.max(...parentPts.map(p => p.y)) + ROW_HEIGHT * 0.4;
    }

    layoutUnions.push({
      kind: 'union',
      id: u.id,
      methodLabel: canonicalMethod(u.rawMethod),
      rawMethod: u.rawMethod,
      parentIds: parents.map(p => p.id),
      childIds: u.children.map(c => c.id),
      x,
      y,
    });
  });

  const edges: LayoutEdge[] = [];
  layoutUnions.forEach(u => {
    u.parentIds.forEach(pid => {
      const p = personById.get(pid)!;
      edges.push({ id: `${pid}->${u.id}`, sourceId: pid, targetId: u.id, sx: p.x, sy: p.y, tx: u.x, ty: u.y });
    });
    u.childIds.forEach(cid => {
      const c = personById.get(cid)!;
      edges.push({ id: `${u.id}->${cid}`, sourceId: u.id, targetId: cid, sx: u.x, sy: u.y, tx: c.x, ty: c.y });
    });
  });

  const xs = [...persons.map(p => p.x), ...layoutUnions.map(u => u.x)];
  const ys = [...persons.map(p => p.y), ...layoutUnions.map(u => u.y)];
  return {
    persons,
    unions: layoutUnions,
    edges,
    minX: xs.length ? Math.min(...xs) : 0,
    maxX: xs.length ? Math.max(...xs) : 0,
    minY: ys.length ? Math.min(...ys) : 0,
    maxY: ys.length ? Math.max(...ys) : 0,
  };
}

/**
 * Nodes and edges to highlight when a node is selected: the sim, their
 * parents, their partners, and their children (or, for a union node, the
 * couple and their children).
 */
export function relatedToNode(layout: FamilyLayout, nodeId: string): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>([nodeId]);
  const edges = new Set<string>();

  const includeUnion = (u: LayoutUnion, withChildren: boolean) => {
    nodes.add(u.id);
    u.parentIds.forEach(pid => {
      nodes.add(pid);
      edges.add(`${pid}->${u.id}`);
    });
    if (withChildren) {
      u.childIds.forEach(cid => {
        nodes.add(cid);
        edges.add(`${u.id}->${cid}`);
      });
    }
  };

  const selectedUnion = layout.unions.find(u => u.id === nodeId);
  if (selectedUnion) {
    includeUnion(selectedUnion, true);
    return { nodes, edges };
  }

  layout.unions.forEach(u => {
    if (u.childIds.includes(nodeId)) {
      // Birth union: highlight the path up to the parents
      nodes.add(u.id);
      edges.add(`${u.id}->${nodeId}`);
      u.parentIds.forEach(pid => {
        nodes.add(pid);
        edges.add(`${pid}->${u.id}`);
      });
    }
    if (u.parentIds.includes(nodeId)) {
      // Own relationships: highlight partner and children
      includeUnion(u, true);
    }
  });
  return { nodes, edges };
}
