/**
 * Router-compat shim — bridges @/lib/router-compat v6 call sites to
 * @tanstack/react-router without hand-rewriting every component.
 * This is the same load-bearing pattern used in Klar's dev-copy migration.
 */
import {
  useNavigate as tsNavigate,
  useLocation as tsLocation,
  useParams as tsParams,
  useSearch as tsSearch,
  useRouter,
  Link as TSLink,
  Navigate as TSNavigate,
  Outlet as TSOutlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  forwardRef,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

// ---------- shared URL parsing ----------

function parseTo(to: string): { pathname: string; search?: Record<string, string>; hash?: string } {
  const [beforeHash, hashStr] = (to ?? "").split("#");
  const [pathname, searchStr] = beforeHash.split("?");
  return {
    // react-router keeps the current path for search-only ("?a=1") and
    // hash-only ("#section") targets; TanStack's "." means current route.
    pathname: pathname || ".",
    search: searchStr ? Object.fromEntries(new URLSearchParams(searchStr)) : undefined,
    hash: hashStr || undefined,
  };
}

// ---------- useNavigate ----------

type NavigateOptions = { replace?: boolean; state?: unknown };

type NavigateFn = {
  (to: string | number, options?: NavigateOptions): void;
  (delta: number): void;
};

export function useNavigate(): NavigateFn {
  const tsNav = tsNavigate();
  const router = useRouter();
  return useCallback((to: string | number, options?: NavigateOptions) => {
    if (typeof to === "number") {
      router.history.go(to);
      return;
    }
    const { pathname, search, hash } = parseTo(to);
    tsNav({
      to: pathname,
      search: search as never,
      hash,
      state: options?.state as never,
      replace: options?.replace,
    });
  }, [tsNav, router]) as NavigateFn;
}

// ---------- useLocation ----------

export function useLocation() {
  const loc = tsLocation();
  return useMemo(
    () => ({
      pathname: loc.pathname,
      search: loc.searchStr ? `?${loc.searchStr}` : "",
      hash: loc.hash ?? "",
      state: (loc.state ?? null) as unknown,
      key: loc.pathname + (loc.searchStr ?? ""),
    }),
    [loc.pathname, loc.searchStr, loc.hash, loc.state],
  );
}

// ---------- useParams ----------

const ParamsOverrideContext = createContext<Record<string, string> | null>(null);

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const params = tsParams({ strict: false } as never) as Record<string, string | undefined>;
  const override = useContext(ParamsOverrideContext);
  return (override ? { ...params, ...override } : params) as T;
}

// ---------- useNavigationType ----------

export type NavigationType = "POP" | "PUSH" | "REPLACE";

export function useNavigationType(): NavigationType {
  const router = useRouter();
  const loc = tsLocation();
  const [type, setType] = useState<NavigationType>("POP");
  const typeRef = useRef<NavigationType>("POP");
  useEffect(() => router.history.subscribe(({ action }) => {
    typeRef.current = action.type === "PUSH" ? "PUSH" : action.type === "REPLACE" ? "REPLACE" : "POP";
  }), [router]);
  useEffect(() => { setType(typeRef.current); }, [loc.pathname, loc.searchStr, loc.hash]);
  return type;
}


// ---------- useSearchParams (@/lib/router-compat compat) ----------

export function useSearchParams(): [URLSearchParams, (init: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void] {
  const loc = tsLocation();
  const nav = tsNavigate();
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(loc.searchStr ?? ""), [loc.searchStr]);
  const setParams = useCallback(
    (
      init: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams),
      opts?: { replace?: boolean },
    ) => {
      // Functional updaters read the router's live location, not the render
      // snapshot — react-router passes call-time params, and chained updates
      // within one tick must see each other's writes.
      const live = router.state.location;
      const current = new URLSearchParams(live.searchStr ?? "");
      const next =
        typeof init === "function"
          ? init(current)
          : init instanceof URLSearchParams
            ? init
            : new URLSearchParams(init);
      const searchObj: Record<string, string> = {};
      next.forEach((v, k) => { searchObj[k] = v; });
      nav({ to: live.pathname, search: searchObj as never, replace: opts?.replace });
    },
    [nav, router],
  );
  return [params, setParams];
}

// ---------- Link ----------

type LinkProps = Omit<ComponentProps<typeof TSLink>, "to"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, children, ...rest },
  ref,
) {
  const { pathname, search, hash } = parseTo(to);
  return (
    <TSLink
      ref={ref as never}
      to={pathname as never}
      search={search as never}
      hash={hash}
      replace={replace}
      state={state as never}
      {...((rest ?? {}) as Record<string, unknown>)}
    >
      {children}
    </TSLink>
  );
});


// ---------- Navigate ----------

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const { pathname, search, hash } = parseTo(to);
  return <TSNavigate to={pathname as never} search={search as never} hash={hash} state={state as never} replace={replace} />;
}

// ---------- Outlet ----------

export const Outlet = TSOutlet;

// ---------- NavLink (minimal) ----------

export const NavLink = Link;
export type NavLinkProps = LinkProps;

// ---------- Test-only routers (@/lib/router-compat compatible) ----------

/** Renders children inside a memory-history TanStack router, like react-router's MemoryRouter. */
export function MemoryRouter({ children, initialEntries = ["/"] }: { children?: ReactNode; initialEntries?: string[] }) {
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: () => <>{childrenRef.current}</> });
    const splat = createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => null });
    return createRouter({ routeTree: rootRoute.addChildren([splat]), history: createMemoryHistory({ initialEntries }) });
  });
  return <RouterProvider router={router} />;
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length && a[a.length - 1] !== "*") return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i] ?? "";
    const value = b[i];
    if (seg === "*") return params;
    if (value === undefined) return null;
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(value);
    else if (seg !== value) return null;
  }
  return params;
}

export function Route(_props: { path?: string; element?: ReactNode; index?: boolean; children?: ReactNode }): null {
  return null;
}

/** Minimal react-router `<Routes>`: renders the first matching `<Route>` element. */
export function Routes({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const props = (child as ReactElement<{ path?: string; element?: ReactNode }>).props;
    const params = matchPath(props.path ?? "*", pathname);
    if (params) return <ParamsOverrideContext.Provider value={params}>{props.element}</ParamsOverrideContext.Provider>;
  }
  return null;
}
