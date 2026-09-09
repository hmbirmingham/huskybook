import { useEffect } from 'react';

// No routing library title management (react-helmet, etc.) for four static
// titles — a plain effect that restores the previous title on unmount is
// enough, and it's one less dependency to keep updated.
export function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · HuskyBook`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
