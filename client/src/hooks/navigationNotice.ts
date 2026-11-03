import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Router state that carries a one-off message to the page being navigated to: `navigate(path, { state })`. */
export interface NavigationNoticeState {
  notice: string;
}

function isNavigationNoticeState(state: unknown): state is NavigationNoticeState {
  return typeof state === "object" && state !== null && "notice" in state && typeof state.notice === "string";
}

/**
 * The one-off notice another page passed through router state, if any. It is
 * kept for as long as this page is mounted, but cleared from history right
 * away so reloading the page does not show it again.
 */
export function useNavigationNotice(): string | undefined {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState(() => (isNavigationNoticeState(location.state) ? location.state.notice : undefined));

  useEffect(() => {
    if (isNavigationNoticeState(location.state)) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return notice;
}
