import { ChevronDown } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, required, className = "", children }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
          {label}
          {required ? <span className="ml-1 text-primary">*</span> : null}
        </span>
        {hint ? <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

interface CutInputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
}

export function CutInput({ leftIcon, className = "", ...props }: CutInputProps) {
  return (
    <div className="relative">
      {leftIcon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">{leftIcon}</span>
      ) : null}
      <input
        {...props}
        className={`h-11 w-full border border-white/10 bg-[#0c0d12] ${
          leftIcon ? "pl-10" : "pl-3"
        } pr-3 text-sm font-bold text-white outline-none transition-colors placeholder:font-medium placeholder:text-white/25 focus:border-primary/70 ${className}`}
      />
    </div>
  );
}

interface CutSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function CutSelect({ children, className = "", ...props }: CutSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-11 w-full appearance-none border border-white/10 bg-[#0c0d12] pl-3 pr-9 text-sm font-bold text-white outline-none transition-colors focus:border-primary/70 ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
    </div>
  );
}

interface CutTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function CutTextarea({ className = "", ...props }: CutTextareaProps) {
  return (
    <textarea
      {...props}
      className={`block w-full resize-none border border-white/10 bg-[#0c0d12] px-3 py-2.5 text-sm font-medium text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/70 ${className}`}
    />
  );
}
