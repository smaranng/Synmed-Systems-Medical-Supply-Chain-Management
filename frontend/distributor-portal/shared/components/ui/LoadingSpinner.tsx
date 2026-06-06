import * as React from 'react';
import { cn } from '../../utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-[#4BA3C3] border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export const FullPageLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-[#6B7280]">Loading...</p>
      </div>
    </div>
  );
};
