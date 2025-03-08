export interface FamilyTreeNode {
  id: string;
  x: number;
  y: number;
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

export interface d3Node {
  id: string;
  x: number;
  y: number;
  children?: d3Node[];
}

export interface d3ReproductionNode extends d3Node {
  parent1Name: string;
  parent2Name?: string;
  reproductionMethod: string;
  children: d3FamilyMemberNode[];
}

export interface d3FamilyMemberNode extends d3Node {
  name: string;
  parent1Name?: string;
  parent2Name?: string;
  reproducedVia?: string;
  gender: 'Male' | 'Female';
  currentPartner?: string;
  narrativeDescription?: string;
  children: d3ReproductionNode[];
}
