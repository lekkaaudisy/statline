// Which pages a logged-out user may open. Everything else needs a login.
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";

const PUBLIC_PATHS = [LOGIN_PATH, "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Where to send the user instead, or null to let the request through.
export function authRedirect(
  pathname: string,
  isLoggedIn: boolean,
): string | null {
  if (!isLoggedIn && !isPublicPath(pathname)) return LOGIN_PATH;
  if (isLoggedIn && pathname === LOGIN_PATH) return HOME_PATH;
  return null;
}
