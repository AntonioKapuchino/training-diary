import { Search, X } from 'lucide-react'
import { useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

/** Поле поиска iOS 26: капсула с лупой и крестиком. */
export function SearchField({ value, onChange, placeholder = 'Поиск', autoFocus }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className="flex h-11 items-center gap-2 rounded-full bg-fill-3 px-3.5 text-label-2">
      <Search className="size-[1.125rem] shrink-0" strokeWidth={2.4} aria-hidden />
      <input
        ref={input}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="min-w-0 flex-1 bg-transparent text-body text-label outline-none placeholder:text-label-2 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Очистить"
          className="flex size-5 items-center justify-center rounded-full bg-label-3 text-surface"
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
        >
          <X className="size-3.5" strokeWidth={3} />
        </button>
      )}
    </label>
  )
}
