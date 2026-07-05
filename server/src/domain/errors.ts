/**
 * Fachlicher Fehler mit maschinenlesbarem Code. Die Domaenen-Aktionen werfen diesen Typ;
 * die API-Schicht uebersetzt den Code in einen HTTP-Status (httpStatusFor) und gibt
 * ansonsten KEINE Interna nach aussen (ADR-11).
 */
export type DomainErrorCode = 'not_found' | 'forbidden' | 'invalid' | 'conflict';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

const STATUS: Record<DomainErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  conflict: 409,
};

export function httpStatusFor(code: DomainErrorCode): number {
  return STATUS[code];
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
