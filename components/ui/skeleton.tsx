import { cn } from '@/lib/utils'

/**
 * Loading placeholder.
 *
 * Two deliberate departures from the shadcn default:
 *
 *   1. A slow left-to-right SHIMMER rather than `animate-pulse`. A pulse is a
 *      whole block flashing in and out, which reads as something being wrong;
 *      a shimmer reads as something arriving. It is also lower contrast, so a
 *      screen full of them is calm rather than strobing.
 *
 *   2. It respects `prefers-reduced-motion`, falling back to a static tint.
 *
 * Skeletons must occupy the EXACT dimensions of the content they stand in for,
 * otherwise the page jumps when data lands — which is the thing a skeleton is
 * supposed to prevent. Pass explicit sizes; do not let it collapse to zero.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('cv-skeleton rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
