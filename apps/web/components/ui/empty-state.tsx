import * as React from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

/**
 * Shared empty-state shape for dashboard widgets and the course catalog —
 * icon + title + optional description + optional action, nothing heavier.
 * Evolved from the five ad hoc empty states already in the codebase rather
 * than introducing a new visual pattern.
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 flex items-center justify-center rounded-full bg-surface-muted p-3 text-text-secondary">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-text-secondary max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
