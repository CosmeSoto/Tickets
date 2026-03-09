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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

/**
 * ConfirmationPanel - Panel de confirmación con información contextual
 * 
 * Requisitos: 6.1, 6.2, 6.4, 6.5, 6.9, 6.11, 8.2, 8.3
 */
export function ConfirmationPanel({
  category,
  path,
  metadata,
  onEdit,
  onConfirm,
}: ConfirmationPanelProps) {
  const renderPath = () => {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {path.map((cat, index) => (
          <React.Fragment key={cat.id}>
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <Badge
              variant={index === path.length - 1 ? 'default' : 'secondary'}
              className="text-xs"
            >
              {cat.name}
            </Badge>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const formatResponseTime = (hours: number | null): string => {
    if (hours === null) return 'No disponible';
    if (hours < 1) return 'Menos de 1 hora';
    if (hours === 1) return '1 hora';
    if (hours < 24) return `${Math.round(hours)} horas`;
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'día' : 'días'}`;
  };

  return (
    <Card 
      className="w-full border-2 border-green-500/20 bg-green-50/50 dark:bg-green-950/20"
      role="region"
      aria-label="Resumen de categoría seleccionada"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          Categoría Seleccionada
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category name and color */}
        <div className="flex items-start gap-3">
          <span
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: category.color }}
            aria-hidden="true"
          />
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-2">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-muted-foreground">
                {category.description}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Path */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-semibold">
            Ruta completa:
          </p>
          {renderPath()}
        </div>

        <Separator />

        {/* Department info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold mb-1">
                Departamento
              </p>
              <p className="text-sm font-medium">{metadata.departmentName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold mb-1">
                Técnicos Asignados
              </p>
              <p className="text-sm font-medium">
                {metadata.assignedTechniciansCount}{' '}
                {metadata.assignedTechniciansCount === 1 ? 'técnico' : 'técnicos'}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Statistics */}
        <div>
          <p className="text-xs text-muted-foreground font-semibold mb-3">
            Estadísticas de la categoría:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Tiempo de respuesta promedio
                </p>
                <p className="text-sm font-semibold">
                  {formatResponseTime(metadata.averageResponseTimeHours)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Tickets recientes (30 días)
                </p>
                <p className="text-sm font-semibold">
                  {metadata.recentTicketsCount}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Popularidad
                </p>
                <p className="text-sm font-semibold">
                  {metadata.popularityScore}/100
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            className="flex-1 gap-2"
            aria-label="Cambiar la categoría seleccionada"
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
            Cambiar Categoría
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            aria-label="Confirmar la categoría seleccionada y continuar"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Confirmar
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground text-center">
          Revisa que la categoría seleccionada sea la correcta para tu problema.
          Tu ticket será atendido por el departamento de {metadata.departmentName}.
        </p>
      </CardContent>
    </Card>
  );
}
