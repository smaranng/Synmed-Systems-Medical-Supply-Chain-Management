import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#0A1D37] text-white hover:bg-[#0A1D37]/80',
        secondary: 'border-transparent bg-[#4BA3C3] text-white hover:bg-[#4BA3C3]/80',
        success: 'border-transparent bg-[#3BB273] text-white hover:bg-[#3BB273]/80',
        destructive: 'border-transparent bg-[#E63946] text-white hover:bg-[#E63946]/80',
        outline: 'text-foreground border-gray-300',
        warning: 'border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
