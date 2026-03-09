'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Category } from '../types';

export interface CategoryTreeProps {
  categories: Category[];
  selectedPath: string[];
  onSelect: (categoryId: string, level: number) => void;
  mode?: 'full' | 'compact';
}

interface CategoryTreeNodeData {
  category: Category;
  children: CategoryTreeNodeData[];
  isExpanded: boolean;
  isSelected: boolean;
  isInPath: boolean;
}

/**
 * CategoryTree - Visualización jerárquica de categorías con navegación mejorada
 * 
 * Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.4, 8.5, 8.6, 9.3, 9.4
 * 
 * Optimizaciones de rendimiento:
 * - Memoización de estructura de árbol
 * - Renderizado optimizado de nodos
 * - Scroll virtual con max-height para listas largas
 */
export function CategoryTree({
  categories,
  selectedPath,
  onSelect,
  mode = 'full',
}: CategoryTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(selectedPath)
  );
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Build tree structure - memoized for performance
  const buildTree = useMemo(() => {
    return (cats: Category[]): CategoryTreeNodeData[] => {
      const categoryMap = new Map<string, CategoryTreeNodeData>();
      const rootNodes: CategoryTreeNodeData[] = [];

      // Initialize all nodes
      cats.forEach((cat) => {
        categoryMap.set(cat.id, {
          category: cat,
          children: [],
          isExpanded: expandedNodes.has(cat.id),
          isSelected: selectedPath[selectedPath.length - 1] === cat.id,
          isInPath: selectedPath.includes(cat.id),
        });
      });

      // Build parent-child relationships
      cats.forEach((cat) => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parentId) {
          const parent = categoryMap.get(cat.parentId);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          rootNodes.push(node);
        }
      });

      // Sort children by order
      const sortChildren = (nodes: CategoryTreeNodeData[]) => {
        nodes.sort((a, b) => a.category.order - b.category.order);
        nodes.forEach((node) => sortChildren(node.children));
      };
      sortChildren(rootNodes);

      return rootNodes;
    };
  }, [expandedNodes, selectedPath]);

  const treeData = useMemo(() => buildTree(categories), [categories, buildTree]);

  const toggleExpand = (categoryId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSelect = (node: CategoryTreeNodeData) => {
    onSelect(node.category.id, node.category.level);
    setFocusedNodeId(node.category.id);
    // Auto-expand when selecting
    if (node.children.length > 0) {
      setExpandedNodes((prev) => new Set(prev).add(node.category.id));
    }
  };

  // Keyboard navigation for tree
  const handleKeyDown = (e: React.KeyboardEvent, node: CategoryTreeNodeData) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect(node);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (node.children.length > 0 && !expandedNodes.has(node.category.id)) {
          toggleExpand(node.category.id);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (expandedNodes.has(node.category.id)) {
          toggleExpand(node.category.id);
        }
        break;
    }
  };

  const renderBreadcrumbs = () => {
    if (selectedPath.length === 0) return null;

    const pathCategories = selectedPath
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean) as Category[];

    return (
      <div className="mb-4 p-3 bg-accent rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Ruta seleccionada:</div>
        <div className="flex items-center gap-2 flex-wrap">
          {pathCategories.map((cat, index) => (
            <React.Fragment key={cat.id}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <Badge
                variant={index === pathCategories.length - 1 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {cat.name}
              </Badge>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderNode = (node: CategoryTreeNodeData, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = node.isExpanded;
    const Icon = hasChildren ? (isExpanded ? FolderOpen : Folder) : null;
    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
      <div key={node.category.id} className="select-none">
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-md transition-colors group',
            'hover:bg-accent cursor-pointer',
            'min-h-[44px]', // Touch-friendly minimum height
            node.isSelected && 'bg-primary/10 border-l-4 border-primary',
            node.isInPath && !node.isSelected && 'bg-accent/50'
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          {/* Expand/Collapse button */}
          {hasChildren && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.category.id);
              }}
              aria-label={isExpanded ? 'Contraer' : 'Expandir'}
            >
              <ChevronIcon className="h-4 w-4" />
            </Button>
          )}

          {/* Category content */}
          <button
            type="button"
            onClick={() => handleSelect(node)}
            onKeyDown={(e) => handleKeyDown(e, node)}
            className={cn(
              'flex-1 flex items-center gap-2 text-left min-w-0',
              !hasChildren && 'ml-8'
            )}
            aria-label={`${node.category.name}, nivel ${node.category.level}${
              hasChildren ? `, ${node.children.length} subcategorías` : ''
            }`}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={node.isSelected}
            role="treeitem"
          >
            {/* Color indicator */}
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: node.category.color }}
              aria-hidden="true"
            />

            {/* Icon */}
            {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}

            {/* Name */}
            <span
              className={cn(
                'font-medium truncate',
                node.isSelected && 'text-primary font-semibold'
              )}
            >
              {node.category.name}
            </span>

            {/* Children count badge */}
            {hasChildren && mode === 'full' && (
              <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                {node.children.length}
              </Badge>
            )}

            {/* Level indicator */}
            <span className="text-xs text-muted-foreground flex-shrink-0">
              N{node.category.level}
            </span>

            {/* Info tooltip */}
            {node.category.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">{node.category.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </button>
        </div>
        
        {/* Render children when expanded */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children.map((childNode) => renderNode(childNode, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full" role="tree" aria-label="Árbol de categorías">
      {renderBreadcrumbs()}
      <div className="space-y-1 max-h-[500px] overflow-y-auto border rounded-lg p-2 bg-background">
        {treeData.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
