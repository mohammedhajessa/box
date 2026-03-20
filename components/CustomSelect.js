import { useState, useRef, useEffect } from 'react';

const ChevronDown = () => (
  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function CustomSelect({
  id,
  name,
  value = '',
  onChange,
  options = [],
  placeholder = 'اختر...',
  disabled = false,
  hasError = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const close = () => {
    setOpen(false);
    setFocusedIndex(-1);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) close();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && listRef.current && focusedIndex >= 0) {
      const el = listRef.current.children[focusedIndex];
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [open, focusedIndex]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(value ? options.findIndex((o) => o.value === value) : 0);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setFocusedIndex((i) => Math.max(0, Math.min(options.length - 1, i + step)));
      return;
    }
    if (e.key === 'Enter' && focusedIndex >= 0 && options[focusedIndex]) {
      e.preventDefault();
      onChange(options[focusedIndex].value);
      close();
    }
  };

  const triggerClass = [
    'w-full px-4 py-2.5 rounded-xl border bg-white text-slate-800 transition flex items-center justify-between gap-2 cursor-pointer min-h-[42px]',
    hasError
      ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500'
      : 'border-slate-300 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500',
    !selectedOption && 'text-slate-400',
    disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
    open && 'ring-2 ring-emerald-500/30 border-emerald-500',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={ariaInvalid ?? hasError}
        aria-describedby={ariaDescribedby}
        aria-label={placeholder}
        className={triggerClass}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate text-right w-full">{displayLabel}</span>
        <ChevronDown />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 w-full mt-1 py-1 rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto"
          style={{ top: '100%', right: 0, left: 0 }}
        >
          <li
            role="option"
            aria-selected={!value}
            className={`px-4 py-2.5 cursor-pointer transition text-right ${!value ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-800'}`}
            onClick={() => {
              onChange('');
              close();
            }}
            onMouseEnter={() => setFocusedIndex(-1)}
          >
            {placeholder}
          </li>
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isFocused = i === focusedIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`px-4 py-2.5 cursor-pointer transition text-right ${
                  isSelected ? 'bg-emerald-600 text-white' : isFocused ? 'bg-slate-100' : 'hover:bg-slate-50'
                } text-slate-800`}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                onMouseEnter={() => setFocusedIndex(i)}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
