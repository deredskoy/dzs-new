export interface EmailLabels {
  name: string;
  company: string;
  phone: string;
  subject: string;
}

export function emailDraft(data: FormData, labels: EmailLabels): string {
  const body = [
    labels.name + ' ' + data.get('name'),
    labels.company + ' ' + (data.get('company') || '—'),
    labels.phone + ' ' + (data.get('phone') || '—'),
    'Email: ' + (data.get('email') || '—'),
    '',
    String(data.get('message') || ''),
  ].join('\n');
  return 'mailto:tovdzs@gmail.com?subject=' + encodeURIComponent(labels.subject) + '&body=' + encodeURIComponent(body);
}
