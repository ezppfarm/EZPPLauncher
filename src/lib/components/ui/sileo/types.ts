import type { ReactNode } from 'react';
import type { SileoOptions, SileoPosition } from 'sileo';

type SileoOffsetValue = number | string;
type SileoOffsetConfig = Partial<Record<'top' | 'right' | 'bottom' | 'left', SileoOffsetValue>>;

export interface SileoToasterProps {
  children?: ReactNode;
  position?: SileoPosition;
  offset?: SileoOffsetValue | SileoOffsetConfig;
  options?: Partial<SileoOptions>;
  theme?: 'light' | 'dark' | 'system';
}
