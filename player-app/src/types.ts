export type DisplayInfo = {
  id: string
  label: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
  primary: boolean
}

export type SignageTransition = "none" | "fade" | "slide" | "zoom"
export type SignageMediaType = "image" | "video"

export type SignageSlide = {
  id: string
  title: string
  imageUrl: string
  mediaType: SignageMediaType
  transition: SignageTransition
  durationSec: number
  order: number
  startHour: number
  endHour: number
  enabled: boolean
}

export type SignageLayout = {
  version: 2
  mode: "slideshow"
  background: string
  transition: SignageTransition
  slides: SignageSlide[]
}

export type BootstrapPayload = {
  deviceId: string
  pairingCode: string
  deviceToken: string | null
  pairedClubId: number | null
  pairedClubName: string | null
  layoutJson: SignageLayout | null
  serverUpdatedAt: string | null
  fullscreen: boolean
  orientation: "landscape" | "portrait"
  selectedDisplayId: string | null
  contentWidth: number
  contentHeight: number
  displays: DisplayInfo[]
  version: string
  platform: string
}

export type RuntimeConfig = {
  appName: string
  serverUrl: string
  isPackaged: boolean
}

export type ElectronSignageApi = {
  getBootstrap: () => Promise<BootstrapPayload>
  getRuntimeConfig: () => Promise<RuntimeConfig>
  selectDisplay: (displayId: string) => Promise<BootstrapPayload>
  setFullscreen: (enabled: boolean) => Promise<BootstrapPayload>
  reloadWindow: () => Promise<boolean>
  syncRemote: () => Promise<BootstrapPayload>
  onBootstrapUpdated: (callback: (payload: BootstrapPayload) => void) => () => void
}

declare global {
  interface Window {
    electronSignage?: ElectronSignageApi
  }
}
