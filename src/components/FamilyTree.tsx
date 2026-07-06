'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FamilyTreeNode } from '@/types/family';
import {
  computeFamilyLayout,
  relatedToNode,
  METHOD_COLORS,
  FamilyLayout,
  LayoutPerson,
  LayoutUnion,
} from '@/utils/familyLayout';

interface FamilyTreeProps {
  data: { [key: string]: FamilyTreeNode[] };
}

const GENDER_COLORS = {
  Male: { fill: '#dbeafe', border: '#2563eb' },
  Female: { fill: '#fce7f3', border: '#db2777' },
  Unknown: { fill: '#f1f5f9', border: '#64748b' },
};

const HIGHLIGHT_COLOR = '#059669';
const EDGE_COLOR = '#94a3b8';
const PERSON_RADIUS = 16;
const UNION_RADIUS = 7;

function genderColor(gender?: string) {
  if (gender === 'Male') return GENDER_COLORS.Male;
  if (gender === 'Female') return GENDER_COLORS.Female;
  return GENDER_COLORS.Unknown;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const my = (sy + ty) / 2;
  return `M ${sx},${sy} C ${sx},${my} ${tx},${my} ${tx},${ty}`;
}

export default function FamilyTree({ data }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<{
    behavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
    initial: d3.ZoomTransform;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const layout = useMemo(() => computeFamilyLayout(data), [data]);

  const legendMethods = useMemo(() => {
    const present = new Set(layout.unions.map(u => u.methodLabel));
    return Object.keys(METHOD_COLORS).filter(label => present.has(label));
  }, [layout]);

  // Build the scene whenever the layout changes
  useEffect(() => {
    const svgEl = svgRef.current;
    const containerEl = containerRef.current;
    if (!svgEl || !containerEl) return;

    setSelectedId(null);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const viewport = svg.append('g').attr('class', 'viewport');
    const edgeGroup = viewport.append('g').attr('class', 'edges');
    const unionGroup = viewport.append('g').attr('class', 'unions');
    const personGroup = viewport.append('g').attr('class', 'persons');

    const showTooltip = (event: MouseEvent, html: string) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const rect = containerEl.getBoundingClientRect();
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      tooltip.style.left = x > rect.width - 280 ? `${x - 270}px` : `${x + 16}px`;
      tooltip.style.top = `${Math.max(8, y - 16)}px`;
    };
    const hideTooltip = () => {
      const tooltip = tooltipRef.current;
      if (tooltip) tooltip.style.display = 'none';
    };

    edgeGroup
      .selectAll('path')
      .data(layout.edges, d => (d as FamilyLayout['edges'][number]).id)
      .join('path')
      .attr('class', 'edge')
      .attr('data-id', d => d.id)
      .attr('d', d => edgePath(d.sx, d.sy, d.tx, d.ty))
      .attr('fill', 'none')
      .attr('stroke', EDGE_COLOR)
      .attr('stroke-width', 1.5);

    const unionNodes = unionGroup
      .selectAll('g')
      .data(layout.unions, d => (d as LayoutUnion).id)
      .join('g')
      .attr('class', 'node union-node')
      .attr('data-id', d => d.id)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    // Invisible enlarged hit area so small nodes stay clickable when zoomed out
    unionNodes
      .append('circle')
      .attr('r', UNION_RADIUS + 8)
      .attr('fill', 'transparent');

    unionNodes
      .append('circle')
      .attr('r', UNION_RADIUS)
      .attr('fill', d => (METHOD_COLORS[d.methodLabel] ?? METHOD_COLORS['Other']).fill)
      .attr('stroke', d => (METHOD_COLORS[d.methodLabel] ?? METHOD_COLORS['Other']).border)
      .attr('stroke-width', 1.5);

    unionNodes
      .on('mouseenter', (event: MouseEvent, d) => {
        showTooltip(event, `<div class="font-semibold">${escapeHtml(d.rawMethod)}</div>`);
      })
      .on('mousemove', (event: MouseEvent, d) => {
        showTooltip(event, `<div class="font-semibold">${escapeHtml(d.rawMethod)}</div>`);
      })
      .on('mouseleave', hideTooltip)
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        setSelectedId(prev => (prev === d.id ? null : d.id));
      });

    const personNodes = personGroup
      .selectAll('g')
      .data(layout.persons, d => (d as LayoutPerson).id)
      .join('g')
      .attr('class', 'node person-node')
      .attr('data-id', d => d.id)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    personNodes
      .append('circle')
      .attr('r', PERSON_RADIUS + 10)
      .attr('fill', 'transparent');

    personNodes
      .append('circle')
      .attr('class', 'person-circle')
      .attr('r', PERSON_RADIUS)
      .attr('fill', d => genderColor(d.gender).fill)
      .attr('stroke', d => genderColor(d.gender).border)
      .attr('stroke-width', 2);

    personNodes
      .append('text')
      .attr('y', PERSON_RADIUS + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#334155')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .text(d => d.name);

    const personTooltip = (d: LayoutPerson) =>
      `<div class="font-semibold mb-1">${escapeHtml(d.name)}</div>` +
      (d.description ? `<div class="text-gray-600">${escapeHtml(d.description)}</div>` : '');

    personNodes
      .on('mouseenter', (event: MouseEvent, d) => showTooltip(event, personTooltip(d)))
      .on('mousemove', (event: MouseEvent, d) => showTooltip(event, personTooltip(d)))
      .on('mouseleave', hideTooltip)
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        setSelectedId(prev => (prev === d.id ? null : d.id));
      });

    // Clicking the background clears the selection
    svg.on('click', () => setSelectedId(null));

    // Zoom / pan, starting fitted to the whole tree
    const width = containerEl.clientWidth || 800;
    const height = containerEl.clientHeight || 600;
    const pad = 70;
    const treeW = layout.maxX - layout.minX + pad * 2;
    const treeH = layout.maxY - layout.minY + pad * 2;
    const k = Math.min(width / treeW, height / treeH, 1);
    const initial = d3.zoomIdentity
      .translate(
        (width - (layout.maxX - layout.minX) * k) / 2 - layout.minX * k,
        (height - (layout.maxY - layout.minY) * k) / 2 - layout.minY * k
      )
      .scale(k);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        viewport.attr('transform', event.transform.toString());
      });

    svg.call(zoom);
    svg.call(zoom.transform, initial);
    zoomRef.current = { behavior: zoom, initial };

    return () => {
      hideTooltip();
      svg.on('.zoom', null);
      svg.on('click', null);
      svg.selectAll('*').remove();
    };
  }, [layout]);

  // Apply highlighting whenever the selection changes
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);

    if (!selectedId) {
      svg.selectAll<SVGGElement, unknown>('.node').attr('opacity', 1);
      svg
        .selectAll<SVGPathElement, unknown>('.edge')
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', 1.5)
        .attr('opacity', 1);
      svg
        .selectAll<SVGCircleElement, LayoutPerson>('.person-circle')
        .attr('stroke', d => genderColor(d.gender).border)
        .attr('stroke-width', 2);
      return;
    }

    const related = relatedToNode(layout, selectedId);

    svg
      .selectAll<SVGGElement, { id: string }>('.node')
      .attr('opacity', d => (related.nodes.has(d.id) ? 1 : 0.15));

    svg
      .selectAll<SVGPathElement, { id: string }>('.edge')
      .attr('stroke', d => (related.edges.has(d.id) ? HIGHLIGHT_COLOR : EDGE_COLOR))
      .attr('stroke-width', d => (related.edges.has(d.id) ? 2.5 : 1.5))
      .attr('opacity', d => (related.edges.has(d.id) ? 1 : 0.12));

    svg
      .selectAll<SVGCircleElement, LayoutPerson>('.person-circle')
      .attr('stroke', d => (d.id === selectedId ? HIGHLIGHT_COLOR : genderColor(d.gender).border))
      .attr('stroke-width', d => (d.id === selectedId ? 4 : 2));
  }, [selectedId, layout]);

  const resetView = () => {
    setSelectedId(null);
    const svgEl = svgRef.current;
    const zoomState = zoomRef.current;
    if (svgEl && zoomState) {
      d3.select(svgEl)
        .transition()
        .duration(400)
        .call(zoomState.behavior.transform, zoomState.initial);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg shadow-lg bg-white relative overflow-hidden"
    >
      <svg ref={svgRef} className="w-full h-full block" />

      <div
        ref={tooltipRef}
        className="absolute hidden bg-white/95 p-3 rounded-lg shadow-xl text-sm z-20 max-w-xs border border-gray-200 pointer-events-none"
        style={{ display: 'none' }}
      />

      <div className="absolute top-3 left-3 z-10 bg-white/90 rounded-md shadow px-3 py-2 text-xs text-gray-600 pointer-events-none">
        Click a sim to highlight their parents, partners &amp; children · scroll to zoom · drag to pan
      </div>

      <button
        onClick={resetView}
        className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white rounded-md shadow px-3 py-2 text-xs font-medium text-gray-700"
      >
        Reset view
      </button>

      <div className="absolute bottom-3 left-3 z-10 bg-white/90 rounded-md shadow px-3 py-2 text-xs text-gray-700">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border-2"
              style={{ backgroundColor: GENDER_COLORS.Male.fill, borderColor: GENDER_COLORS.Male.border }}
            />
            Male
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border-2"
              style={{ backgroundColor: GENDER_COLORS.Female.fill, borderColor: GENDER_COLORS.Female.border }}
            />
            Female
          </span>
          {legendMethods.map(label => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: METHOD_COLORS[label].fill }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
