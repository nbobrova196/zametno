export function LogoMark({ className = 'h-10 w-10 text-forest-600' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M26 5C26 17 19 25 9 25C9 15 17 5 26 5Z" />
      <path d="M9 25C7.7 27.5 5.7 29.2 4.2 29.5" />
      <path d="M10.2 23.8C14.5 18.5 19.5 12 25.8 5.5" strokeWidth={1.4} />
      <path d="M17.5 15C18.4 16.3 19.4 17.5 20.6 18.6" strokeWidth={1.1} />
      <path d="M17.5 15C16.5 13.8 15.3 12.8 14.1 12" strokeWidth={1.1} />
    </svg>
  )
}
