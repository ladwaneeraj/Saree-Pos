/** Prints one DOM node in a hidden iframe that reuses the app's stylesheets, so nothing else on the page leaks into the printout. */
export function printNode(node: HTMLElement, title: string, pageCss = "@page{size:A4;margin:12mm}"): void {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("");
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title>${styles}<style>${pageCss}html,body{margin:0;background:#fff}</style></head><body>${node.outerHTML}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 500);
}
