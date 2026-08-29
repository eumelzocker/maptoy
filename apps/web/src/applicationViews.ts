export interface ApplicationView {
  id: string;
  label: string;
  path: string;
  icon: string;
}

export const applicationViews: readonly ApplicationView[] = [
  {
    id: "map",
    label: "Map",
    path: "/",
    icon: "mdi-map-outline",
  },
  {
    id: "map-sets",
    label: "Map Sets",
    path: "/map-sets",
    icon: "mdi-layers-outline",
  },
  {
    id: "cache",
    label: "Cache",
    path: "/cache",
    icon: "mdi-database-outline",
  },
  {
    id: "coverage",
    label: "Coverage",
    path: "/coverage",
    icon: "mdi-grid",
  },
  {
    id: "docs",
    label: "Docs",
    path: "/docs",
    icon: "mdi-book-open-page-variant-outline",
  },
];

export function isApplicationViewActive(
  view: ApplicationView,
  routePath: string,
): boolean {
  return view.path === "/"
    ? routePath === "/"
    : routePath === view.path || routePath.startsWith(`${view.path}/`);
}

export function applicationViewForPath(
  routePath: string,
): ApplicationView | undefined {
  return applicationViews.find((view) =>
    isApplicationViewActive(view, routePath),
  );
}
