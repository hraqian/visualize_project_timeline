import type { CSSProperties } from 'react';
import { uiSize } from './uiTokens';

export function toolbarContentStyle(extra?: CSSProperties): CSSProperties {
  return {
    gap: uiSize.toolbarGap,
    paddingLeft: uiSize.toolbarPaddingX,
    paddingRight: uiSize.toolbarPaddingX,
    lineHeight: uiSize.toolbarLineHeight,
    ...extra,
  };
}
