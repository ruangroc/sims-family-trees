export interface FamilyTreeNode {
  id: string;
}

export interface FamilyMemberDataNode extends FamilyTreeNode {
  name: string;
  parent1Name?: string;
  parent2Name?: string;
  reproducedVia?: string;
  gender: 'Male' | 'Female';
  currentPartner?: string;
  narrativeDescription?: string;
}

export interface ReproductionDataNode extends FamilyTreeNode {
  parent1Name: string;
  parent2Name?: string;
  reproductionMethod: string;
} 

export interface treeNode {
  id: string;
  x: number;
  y: number;
  children?: treeNode[];
}

export interface treeReproductionNode extends treeNode {
  parent1Name: string;
  parent2Name?: string;
  reproductionMethod: string;
  children: treeFamilyMemberNode[];
}

export interface treeFamilyMemberNode extends treeNode {
  name: string;
  parent1Name?: string;
  parent2Name?: string;
  reproducedVia?: string;
  gender: 'Male' | 'Female';
  currentPartner?: string;
  narrativeDescription?: string;
  children: treeReproductionNode[];
}
