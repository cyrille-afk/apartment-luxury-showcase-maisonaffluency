export type RequestKind = 'sample' | 'custom';

/** Only stored request data can become an owner notice. Never caller-written email content. */
export function tradeRequestNotification(kind: RequestKind, request: Record<string, any>, profile: Record<string, any> | null) {
  const message = kind === 'sample'
    ? [
        `Client: ${request.client_name || '—'}`, `Project: ${request.project_name || '—'}`,
        `Ship to: ${[request.shipping_address, request.shipping_city, request.shipping_country].filter(Boolean).join(', ')}`,
        request.return_by ? `Return by: ${request.return_by}` : '', request.notes || '',
      ]
    : [
        `Quantity: ${request.quantity || 1}`,
        request.dimension_changes ? `Dimensions: ${request.dimension_changes}` : '',
        request.finish_notes ? `Finish / material: ${request.finish_notes}` : '',
        request.com_col_fabric ? `COM / COL: ${request.com_col_fabric}` : '',
        request.com_yardage_meters != null ? `Yardage: ${request.com_yardage_meters} m` : '',
        request.target_lead_weeks != null ? `Target lead: ${request.target_lead_weeks} weeks` : '',
        request.budget_notes ? `Budget: ${request.budget_notes}` : '', request.notes || '',
      ];
  const link = `https://www.maisonaffluency.com/trade/${kind === 'sample' ? 'samples' : 'custom-requests'}?focus=${request.id}`;
  return {
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Trade member',
    company: profile?.company || '', email: profile?.email || '',
    productName: request.product_name, designerName: request.brand_name,
    selectedFinish: request.finish_notes || undefined,
    subject: `${kind === 'sample' ? 'Sample' : 'Custom quote'} request — ${request.product_name}`,
    message: [...message.filter(Boolean), '', `Review request: ${link}`].join('\n'),
  };
}