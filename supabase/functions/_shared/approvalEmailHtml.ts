/** Progressive enhancement after React Email rendering; clients stripping CSS keep the inline CTA. */
export function enhanceApprovalEmailHtml(templateName: string, html: string): string {
  if (templateName !== 'trade-approval' && !templateName.startsWith('trade-approval-copy-')) return html;
  const styles = '<style>@media (hover:hover) and (pointer:fine){a[data-approval-portal]{transition:background-color 220ms ease}a[data-approval-portal]:hover{background-color:#353535!important}}@media (prefers-reduced-motion:reduce){a[data-approval-portal]{transition:none!important}}</style>';
  const marked = html.replace(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi, (anchor, attributes: string, content: string) =>
    content.replace(/<[^>]+>/g, '').trim().toLowerCase() === 'access your trade portal'
      ? `<a data-approval-portal="true"${attributes}>${content}</a>` : anchor);
  return marked.replace('</head>', `${styles}</head>`);
}