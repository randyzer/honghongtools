export const DEFAULT_TARGET_CURSOR_SELECTOR =
  'a[href], button, [role="button"], .cursor-pointer, .cursor-target';

interface TargetCursorEnvironment {
  hasTouchScreen: boolean;
  innerWidth: number;
  userAgent: string;
}

export function shouldDisableTargetCursor(environment: TargetCursorEnvironment): boolean {
  const isSmallScreen = environment.innerWidth <= 768;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  const isMobileUserAgent = mobileRegex.test(environment.userAgent.toLowerCase());

  return (environment.hasTouchScreen && isSmallScreen) || isMobileUserAgent;
}
