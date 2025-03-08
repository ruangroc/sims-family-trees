'use client'

import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { FamilyMemberDataNode, FamilyTreeNode, ReproductionDataNode } from '@/types/family';
import { isFamilyMember, isReproductionNode } from '@/utils/transformData';

// Register the dagre layout
cytoscape.use(dagre);

interface FamilyTreeProps {
  data: { [key: string]: FamilyTreeNode[] };
}

// Define layout options type
type DagreLayoutOptions = {
  name: 'dagre';
  rankDir: 'TB' | 'BT' | 'LR' | 'RL';
  align?: 'UL' | 'UR' | 'DL' | 'DR';
  spacingFactor: number;
  nodeDimensionsIncludeLabels: boolean;
  rankSep?: number;
  nodeSep?: number;
  edgeSep?: number;
  animate: boolean;
  animationDuration: number;
};

// Define style types
type NodeStyle = Partial<cytoscape.Css.Node>;
type EdgeStyle = Partial<cytoscape.Css.Edge>;
type StylesheetStyle = { selector: string; style: NodeStyle | EdgeStyle };

export default function FamilyTree({ data }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    try {
      // Convert object to Map
      const genMap = new Map<number, FamilyTreeNode[]>();
      Object.entries(data).forEach(([genStr, nodes]) => {
        const gen = parseInt(genStr, 10);
        if (!isNaN(gen) && Array.isArray(nodes)) {
          genMap.set(gen, nodes);
        }
      });

      // Create maps for quick lookups
      const nodesById = new Map<string, FamilyTreeNode>();
      const nodesByName = new Map<string, FamilyMemberDataNode>();
      const reproNodesByParents = new Map<string, ReproductionDataNode>();

      // First pass: create nodes
      genMap.forEach((nodes) => {
        nodes.forEach(node => {
          nodesById.set(node.id, node);
          if (isFamilyMember(node)) {
            nodesByName.set(node.name, node);
          } else if (isReproductionNode(node)) {
            // Include reproduction method in the key to ensure uniqueness
            const key = `${node.parent1Name}-${node.parent2Name || ''}-${node.reproductionMethod}`;
            reproNodesByParents.set(key, node);
          }
        });
      });

      // Create Cytoscape elements
      const elements: cytoscape.ElementDefinition[] = [];

      // Add family member nodes
      Array.from(nodesByName.values()).forEach(member => {
        elements.push({
          data: {
            id: member.id,
            label: member.name,
            type: 'family',
            gender: member.gender,
            description: member.narrativeDescription
          }
        });
      });

      // Add reproduction nodes and edges
      Array.from(reproNodesByParents.values()).forEach(reproNode => {
        const reproId = reproNode.id;
        elements.push({
          data: {
            id: reproId,
            label: reproNode.reproductionMethod,
            type: 'reproduction'
          }
        });

        // Add edges from parents to reproduction node
        if (reproNode.parent1Name) {
          const parent1 = Array.from(nodesByName.values())
            .find(n => n.name === reproNode.parent1Name);
          if (parent1) {
            elements.push({
              data: {
                id: `${parent1.id}-${reproId}`,
                source: parent1.id,
                target: reproId,
                type: 'parent'
              }
            });
          }
        }

        if (reproNode.parent2Name) {
          const parent2 = Array.from(nodesByName.values())
            .find(n => n.name === reproNode.parent2Name);
          if (parent2) {
            elements.push({
              data: {
                id: `${parent2.id}-${reproId}`,
                source: parent2.id,
                target: reproId,
                type: 'parent'
              }
            });
          }
        }

        // Add edges from reproduction node to children
        Array.from(nodesByName.values())
          .filter(n => 
            // Match parent names AND reproduction method
            ((n.parent1Name === reproNode.parent1Name && n.parent2Name === reproNode.parent2Name) ||
            (n.parent1Name === reproNode.parent2Name && n.parent2Name === reproNode.parent1Name)) &&
            n.reproducedVia === reproNode.reproductionMethod
          )
          .forEach(child => {
            elements.push({
              data: {
                id: `${reproId}-${child.id}`,
                source: reproId,
                target: child.id,
                type: 'child'
              }
            });
          });
      });

      // Add reproduction nodes for current partners without children
      const processedPartnerships = new Set<string>();
      
      Array.from(nodesByName.values()).forEach(member => {
        if (member.currentPartner) {
          const partner = Array.from(nodesByName.values())
            .find(n => n.name === member.currentPartner);
          
          if (partner) {
            // Create a unique key for this partnership (always in alphabetical order)
            const [firstPartner, secondPartner] = [member.name, partner.name].sort();
            const partnershipKey = `${firstPartner}-${secondPartner}`;

            // Only process if we haven't seen this partnership before
            if (!processedPartnerships.has(partnershipKey)) {
              processedPartnerships.add(partnershipKey);

              // Check if they already have a reproduction node together
              const hasChildren = Array.from(reproNodesByParents.values())
                .some(rNode => 
                  (rNode.parent1Name === member.name && rNode.parent2Name === partner.name) ||
                  (rNode.parent1Name === partner.name && rNode.parent2Name === member.name)
                );

              // Only add if they don't have children together
              if (!hasChildren) {
                // Create unique ID for this relationship
                const relationshipId = `relationship-${partnershipKey}`;
                
                // Add the reproduction node
                elements.push({
                  data: {
                    id: relationshipId,
                    label: 'Dating or Married',
                    type: 'reproduction'
                  }
                });

                // Add edges from both partners to the reproduction node
                elements.push({
                  data: {
                    id: `${member.id}-${relationshipId}`,
                    source: member.id,
                    target: relationshipId,
                    type: 'parent'
                  }
                });

                elements.push({
                  data: {
                    id: `${partner.id}-${relationshipId}`,
                    source: partner.id,
                    target: relationshipId,
                    type: 'parent'
                  }
                });
              }
            }
          }
        }
      });

      // Initialize Cytoscape
      const styles: StylesheetStyle[] = [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'right',
            'text-margin-x': 10,
            'font-size': 12,
            'text-wrap': 'wrap',
            'text-max-width': 100,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px'
          } as unknown as NodeStyle
        },
        {
          selector: 'node[type = "family"]',
          style: {
            'width': 30,
            'height': 30,
            'background-color': (ele: cytoscape.NodeSingular) => 
              ele.data('gender') === 'Male' ? '#dbeafe' : '#fce7f3',
            'border-color': (ele: cytoscape.NodeSingular) => 
              ele.data('gender') === 'Male' ? '#2563eb' : '#db2777',
            'border-width': 2
          } as NodeStyle
        },
        {
          selector: 'node[type = "reproduction"]',
          style: {
            'width': 20,
            'height': 20,
            'background-color': (ele: cytoscape.NodeSingular) => {
              switch (ele.data('label')) {
                case 'Marriage':
                  return '#7e22ce'; // dark purple
                case 'Dating':
                case 'Hookup':
                  return '#e9d5ff'; // light purple
                case 'Plant sim':
                  return '#22c55e'; // green
                case 'Clone':
                  return '#fbbf24'; // warm yellow
                case 'Adoption':
                  return '#f97316'; // sunset orange
                case 'Dating or Married':
                  return '#c084fc'; // medium purple
                default:
                  return '#f3e8ff'; // default light purple
              }
            },
            'border-color': (ele: cytoscape.NodeSingular) => {
              switch (ele.data('label')) {
                case 'Marriage':
                  return '#581c87'; // darker purple
                case 'Dating':
                case 'Hookup':
                  return '#a855f7'; // medium purple
                case 'Plant sim':
                  return '#15803d'; // darker green
                case 'Clone':
                  return '#b45309'; // darker yellow/amber
                case 'Adoption':
                  return '#c2410c'; // darker orange
                case 'Dating or Married':
                  return '#9333ea'; // darker medium purple
                default:
                  return '#6b21a8'; // default border color
              }
            },
            'border-width': 2,
            'font-size': 10
          } as NodeStyle
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'straight',
            'target-arrow-shape': 'triangle',
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'width': 2
          } as EdgeStyle
        }
      ];

      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: styles,
        layout: {
          name: 'dagre',
          spacingFactor: 2,
          nodeDimensionsIncludeLabels: true,
          rankDir: 'TB',
          rankSep: 120,
          nodeSep: 80,
          edgeSep: 50,
          animate: true,
          animationDuration: 500
        } as DagreLayoutOptions,
        wheelSensitivity: 0.2,
      });

      // Wait for layout to complete before fitting
      const layout = cyRef.current.layout({
        name: 'dagre',
        spacingFactor: 1.8,
        nodeDimensionsIncludeLabels: true,
        rankDir: 'TB',
        rankSep: 120,
        nodeSep: 80,
        edgeSep: 50,
        animate: true,
        animationDuration: 500,
        fit: true,
        stop: () => {
          // After layout completes, ensure everything is visible
          if (cyRef.current) {
            // Fit with padding
            const padding = 50;
            const bb = cyRef.current.elements().boundingBox();
            const zoom = Math.min(
              containerRef.current!.clientWidth / (bb.w + 2 * padding),
              containerRef.current!.clientHeight / (bb.h + 2 * padding)
            );
            
            // Apply zoom and center
            cyRef.current.zoom({
              level: zoom,
              renderedPosition: { 
                x: containerRef.current!.clientWidth / 2, 
                y: containerRef.current!.clientHeight / 2 
              }
            });
            cyRef.current.center();
          }
        }
      } as DagreLayoutOptions);

      layout.run();

      // Add tooltips
      cyRef.current.on('mouseover', 'node', (event) => {
        const node = event.target;
        const description = node.data('description');
        if (description) {
          const tooltip = document.createElement('div');
          tooltip.className = 'fixed bg-white/95 p-3 rounded-lg shadow-xl text-sm z-50 max-w-xs border border-gray-200';
          tooltip.style.left = `${event.renderedPosition.x + 20}px`;
          tooltip.style.top = `${event.renderedPosition.y - 20}px`;
          tooltip.innerHTML = `
            <div class="font-semibold mb-1">${node.data('label')}</div>
            <div class="text-gray-600">${description}</div>
          `;
          // Add a subtle animation
          tooltip.style.opacity = '0';
          tooltip.style.transform = 'translateY(5px)';
          tooltip.style.transition = 'all 0.2s ease-in-out';
          
          containerRef.current?.appendChild(tooltip);
          node.data('tooltip', tooltip);
          
          // Trigger animation
          requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
          });
        }
      });

      cyRef.current.on('mouseout', 'node', (event) => {
        const node = event.target;
        const tooltip = node.data('tooltip');
        if (tooltip) {
          // Add fade-out animation
          tooltip.style.opacity = '0';
          tooltip.style.transform = 'translateY(5px)';
          setTimeout(() => tooltip.remove(), 200);
          node.removeData('tooltip');
        }
      });

      // Update font sizes on zoom
      cyRef.current.on('zoom', () => {
        const zoom = cyRef.current?.zoom() || 1;
        cyRef.current?.style()
          .selector('node')
          .style({
            'font-size': Math.floor(12 / zoom),
            'text-margin-x': Math.floor(10 / zoom)
          } as NodeStyle)
          .update();
      });

    } catch (error) {
      console.error('Error processing data:', error);
    }

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-[800px] rounded-lg shadow-lg bg-white relative" />
  );
} 