import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export const usePrompt = (isDirty: boolean) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();

  // Handle browser back/forward and link clicks
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Standard way to show browser's own confirmation
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Intercept Next.js navigation
  // Note: Next.js 13+ App Router doesn't have a built-in 'beforePopState' or similar 
  // that easily blocks all link clicks without monkey-patching or complex wrappers.
  // For a robust implementation in App Router, we usually intercept the clicks globally
  // or use a custom Link component. 
  
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href && anchor.host === window.location.host) {
        const fullHref = anchor.href;
        const url = new URL(fullHref);
        const path = url.pathname + url.search + url.hash;

        if (path !== window.location.pathname + window.location.search + window.location.hash) {
          e.preventDefault();
          e.stopPropagation();
          setNextPath(path);
          setShowPrompt(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    setShowPrompt(false);
    if (nextPath) {
      router.push(nextPath);
    }
  }, [nextPath, router]);

  const cancelNavigation = useCallback(() => {
    setShowPrompt(false);
    setNextPath(null);
  }, []);

  return {
    showPrompt,
    confirmNavigation,
    cancelNavigation,
  };
};
