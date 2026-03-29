export const uiColor = {
  border: '#c8d3df',
  borderSoft: '#d9e3ef',
  borderStrong: '#c7d8f8',
  surfaceTop: '#ffffff',
  surfaceBottom: '#f8fafc',
  surfaceRaisedBottom: '#fcfdff',
  surfaceDisabledTop: '#f8fafc',
  surfaceDisabledBottom: '#f1f5f9',
  hoverSoft: '#f7fafc',
  activeTop: '#eff5ff',
  activeBottom: '#e6efff',
  text: '#334155',
  textMuted: '#607086',
  textDisabled: '#94a3b8',
  accent: '#4b83e6',
} as const;

export const uiShadow = {
  insetSoft: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  panel: '0 14px 34px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
} as const;

export const uiRadius = {
  control: 8,
  panel: 12,
} as const;

export const uiSize = {
  toolbarHeight: 34,
  toolbarIcon: 14,
  toolbarFontSize: 13,
  toolbarLineHeight: 1,
  toolbarGap: 6,
  toolbarPaddingX: 12,
  controlHeight: 32,
  controlFontSize: 13,
} as const;

export function surfaceGradient(bottom: string = uiColor.surfaceBottom) {
  return `linear-gradient(180deg, ${uiColor.surfaceTop} 0%, ${bottom} 100%)`;
}

export function activeGradient() {
  return `linear-gradient(180deg, ${uiColor.activeTop} 0%, ${uiColor.activeBottom} 100%)`;
}

export function disabledGradient() {
  return `linear-gradient(180deg, ${uiColor.surfaceDisabledTop} 0%, ${uiColor.surfaceDisabledBottom} 100%)`;
}

export const uiControlStyles = {
  toolbarButton: {
    height: uiSize.toolbarHeight,
    borderColor: uiColor.border,
    background: surfaceGradient(),
    boxShadow: uiShadow.insetSoft,
    borderRadius: uiRadius.control,
    fontSize: uiSize.toolbarFontSize,
  },
  toolbarButtonDisabled: {
    height: uiSize.toolbarHeight,
    borderColor: uiColor.borderSoft,
    background: disabledGradient(),
    boxShadow: 'none',
    borderRadius: uiRadius.control,
    fontSize: uiSize.toolbarFontSize,
  },
  panel: {
    background: surfaceGradient(uiColor.surfaceRaisedBottom),
    border: `1px solid ${uiColor.borderSoft}`,
    borderRadius: uiRadius.panel,
    boxShadow: uiShadow.panel,
  },
} as const;
