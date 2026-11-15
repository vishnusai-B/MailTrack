import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-neutral-900 text-white shadow-xs hover:bg-neutral-800 border border-neutral-900 disabled:hover:bg-neutral-900',
  secondary:
    'bg-white text-neutral-700 border border-neutral-200/90 shadow-2xs hover:bg-neutral-50 hover:text-neutral-950 hover:border-neutral-300',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 border border-transparent',
  danger:
    'bg-rose-600 text-white border border-rose-600 shadow-xs hover:bg-rose-700 disabled:hover:bg-rose-600',
  success:
    'bg-emerald-600 text-white border border-emerald-600 shadow-xs hover:bg-emerald-700 disabled:hover:bg-emerald-600',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-xs gap-2 rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
