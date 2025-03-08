import { FamilyMemberDataNode, FamilyTreeNode, ReproductionDataNode } from '@/types/family';

// Helper function to check if node is a ReproductionNode
export function isReproductionNode(node: FamilyTreeNode): node is ReproductionDataNode {
  return node !== undefined && 'reproductionMethod' in node && 'parent1Name' in node;
};

// Helper function to check if node is a FamilyMember
export function isFamilyMember(node: FamilyTreeNode): node is FamilyMemberDataNode {
  return node !== undefined && 'name' in node && 'gender' in node && !('reproductionMethod' in node);
};

export function transformDataToHierarchy(data: FamilyTreeNode[]): Map<number, FamilyTreeNode[]> {
  const treeLevels = new Map<number, FamilyTreeNode[]>();

  // Helper function for determining the level of each node
  const getLevel = (node: FamilyTreeNode, level: number = 0): number => {
    // If node is undefined, return level
    if (node === undefined) {
      return level;
    }

    // Case 1: family node without rNode
    if (isFamilyMember(node) && node.reproducedVia === undefined) {
      return level;
    }

    // Case 2: family node with rNode
    if (isFamilyMember(node) && node.reproducedVia !== undefined) {
      const rNode = data.find(elem => isReproductionNode(elem) && elem.reproductionMethod === node.reproducedVia && elem.parent1Name === node.parent1Name)!;
      return 1 + getLevel(rNode, level);
    }

    // If not a FamilyMember node, must be a ReproductionNode
    const rNode = node as ReproductionDataNode;

    // Case 3: rNode with only 1 parent
    if (rNode.parent2Name === undefined) {
      const parent1Node = data.find(member => 'name' in member && member.name === rNode.parent1Name)!;
      const parent1Level =  1 + getLevel(parent1Node, level);
      return parent1Level;
    } 

    // Case 4: rNode with 2 parents
    const parent1Node = data.find(member => 'name' in member && member.name === rNode.parent1Name)!;
    const parent1Level = 1 + getLevel(parent1Node, level);
    const parent2Node = data.find(member => 'name' in member && member.name === rNode.parent2Name)!;
    const parent2Level = 1 + getLevel(parent2Node, level);
    return Math.max(parent1Level, parent2Level);
  }

  // Group nodes by level
  data.forEach(node => {
    const gen = getLevel(node);
    if (!treeLevels.has(gen)) {
      treeLevels.set(gen, []);
    }
    const level = treeLevels.get(gen)!;
    if (level.find(elem => elem.id === node.id) === undefined) level.push(node);
  });

  // For level 0 nodes, if partner node has a level, move to that level instead
  const level0Nodes = treeLevels.get(0)!;
  const nodesToRemove: FamilyTreeNode[] = [];
  level0Nodes.forEach(node => {
    if ('currentPartner' in node && node.currentPartner !== undefined) {
      const partnerNode = data.find(elem => isFamilyMember(elem) && elem.name === node.currentPartner);
      if (partnerNode) {
        const newLevel = getLevel(partnerNode);
        if (newLevel > 0) {
          // Remove node from level 0
          nodesToRemove.push(node);

          // Add node to partner's level
          if (!treeLevels.has(newLevel)) {
            treeLevels.set(newLevel, []);
          }
          treeLevels.get(newLevel)!.push(node);
        }
      }
    }
  });
  const newLevel0Nodes = level0Nodes.filter(node => !nodesToRemove.includes(node));
  treeLevels.set(0, newLevel0Nodes);
  return treeLevels;
}
