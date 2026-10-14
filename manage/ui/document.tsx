import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";
import { scriptEntry, stylesheetHref } from "../assets.ts";
import { themeStyle, type Theme } from "./public/theme.ts";

export function Document(handle: Handle<{ title?: string; theme?: Theme; children?: RemixNode }>) {
  return () => {
    const { title, theme = "system", children } = handle.props;
    const { href, importMap, preloads } = scriptEntry;

    return (
      <html lang="en" style={themeStyle(theme)}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex" />
          <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f7f9" />
          <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e0e12" />
          <title>{title ? `${title} · hack.af` : "hack.af"}</title>
          <link
            rel="icon"
            href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ff8c37'/%3E%3Cstop offset='.7' stop-color='%23ec3750'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='8' fill='url(%23g)'/%3E%3Cg transform='translate(6 6) scale(.833)' fill='none' stroke='%23fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/g%3E%3C/svg%3E"
          />
          <link rel="stylesheet" href={stylesheetHref} />
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>{children}</body>
      </html>
    );
  };
}
