export function isExternalDocumentationLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function decorateExternalDocumentationLinks(root: ParentNode): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = link.getAttribute("href");
    if (href !== null && isExternalDocumentationLink(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  }
}
