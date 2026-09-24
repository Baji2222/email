export type ParsedSupportEmail = {
  ticketNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  macId: string | null;
  referenceNumber: string | null;
  location: string | null;
  office: string | null;
  issueDescription: string | null;
};

function cleanValue(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
}

function extractField(
  body: string,
  labels: string[]
): string | null {
  const labelPattern = labels
    .map((label) =>
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('|');

  const regex = new RegExp(
    `(?:${labelPattern})\\s*:\\s*(.+)`,
    'i'
  );

  const match = body.match(regex);

  if (!match) {
    return null;
  }

  const value = cleanValue(match[1]);

  return value || null;
}

function extractMultilineField(
  body: string,
  labels: string[]
): string | null {
  const labelPattern = labels
    .map((label) =>
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('|');

  const regex = new RegExp(
    `(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Za-z][A-Za-z ]*\\s*:|\\n\\s*Regards\\b|$)`,
    'i'
  );

  const match = body.match(regex);

  if (!match) {
    return null;
  }

  const value = cleanValue(match[1]);

  return value || null;
}

function normalizeMac(mac: string): string {
  return mac
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
}

function extractMacId(body: string): string | null {
  const match = body.match(
    /(?:MAC\s*ID|MAC\s*ADDRESS|MAC)\s*:\s*([0-9A-Fa-f]{2}(?::|-)[0-9A-Fa-f]{2}(?::|-)[0-9A-Fa-f]{2}(?::|-)[0-9A-Fa-f]{2}(?::|-)[0-9A-Fa-f]{2}(?::|-)[0-9A-Fa-f]{2})/i
  );

  if (!match) {
    return null;
  }

  const normalized = normalizeMac(match[1]);

  if (normalized.length !== 12) {
    return null;
  }

  return normalized.match(/.{2}/g)?.join(':') || null;
}

function extractTicketNumber(text: string): string | null {
  const match = text.match(/\bSW-\d{6}\b/i);

  if (!match) {
    return null;
  }

  return match[0].toUpperCase();
}

function extractEmail(body: string): string | null {
  const match = body.match(
    /(?:Customer\s+Email|Email|E-mail)\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  );

  return match
    ? cleanValue(match[1])
    : null;
}

export function parseSupportEmail(
  body: string
): ParsedSupportEmail {
  return {
    ticketNumber: extractTicketNumber(body),

    customerName: extractField(body, [
      'Customer Name',
      'Customer',
    ]),

    customerEmail: extractEmail(body),

    macId: extractMacId(body),

    referenceNumber: extractField(body, [
      'Reference Number',
      'Reference No',
      'Reference',
      'Ref Number',
      'Ref No',
    ]),

    location: extractField(body, [
      'Location',
    ]),

    office: extractField(body, [
      'Office',
    ]),

    issueDescription: extractMultilineField(body, [
      'Issue Description',
      'Issue',
      'Problem',
      'Problem Description',
    ]),
  };
}