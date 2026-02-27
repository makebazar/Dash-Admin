import { useMediaQuery } from "./use-media-query"

export function useIsMobile() {
  const isMobile = useMediaQuery("(max-width: 576px)")
  return isMobile
}

export function useIsTablet() {
  const isTablet = useMediaQuery("(min-width: 577px) and (max-width: 1024px)")
  return isTablet
}

export function useIsDesktop() {
  const isDesktop = useMediaQuery("(min-width: 1025px)")
  return isDesktop
}
