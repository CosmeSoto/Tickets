'use client';

import React from 'react';
import {
  CheckCircle2,
  Edit,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  Building2,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Category, CategoryMetadata } from '../types';

export interface ConfirmationPanelProps {
  category: Category;
  path: Category[];
  metadata: CategoryMetadata;
  onEdit: () => void;
  onConfirm: () => void;
}

export function ConfirmationPanel({
  category,
  path,
  metadata,
  onEdit,
  onConfirm,
}: ConfirmationPanelProps) {
  const formatResponseTime = (hours: number | null): string => {
    if (hours === null) return 'No disponible';
    if (hours < 1) return '< 1 hora';
    if (hours === 1) return '1 hora';
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  return (
    <Card
      className="w-full border-2 border-green-500/20 bg-green-50/50 dark:bg-green-950/20"
      role="region"
      aria-label="Resumen de categoría seleccionada"
    >
      <CardContent className="px-4 py-3 space-y-3">
        {/* Header: title + category name */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
            Categoría Seleccionada
          </span>
        </div>

        {/* Category name + description */}
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-semibold text-base leading-tight">{category.name}</p>
            {category.description && (
              <p className="text-xs text-muted-foreground truncate">{category.description}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Path */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">Ruta completa:</p>
          <div className="flex items-center gap-1 flex-wrap">
            {path.map((cat, index) => (
              <React.Fragment key={cat.id}>
                {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <Badge
                  variant={index === path.length - 1 ? 'default' : 'secondary'}
                  className="text-xs px-1.5 py-0"
                >
                  {cat.name}
                </Badge>
              </React.Fragment>
            ))}
          </div>
        </div>

        <Separator />

        {/* Department + Technicians + Stats — all in one row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground leading-none mb-0.5">Departamento</p>
              <p className="font-medium truncate">{metadata.departmentName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Técnicos</p>
              <p className="font-medium">{metadata.assignedTechniciansCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Respuesta</p>
              <p className="font-medium">{formatResponseTime(metadata.averageResponseTimeHours)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Popularidad</p>
              <p className="font-medium">{metadata.popularityScore}/100</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 gap-1.5 h-8 text-xs"
            aria-label="Cambiar la categoría seleccionada"
          >
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            Cambiar Categoría
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            className="flex-1 gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700"
            aria-label="Confirmar la categoría seleccionada y continuar"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Confirmar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center leading-tight">
          Tu ticket será atendido por el departamento de{' '}
          <span className="font-medium">{metadata.departmentName}</span>.
        </p>
      </CardContent>
    </Card>
  );
}
