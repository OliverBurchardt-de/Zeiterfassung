/** Minimale Typen fuer httpntlm (Paket liefert keine eigenen). Nur was wir nutzen. */
declare module 'httpntlm' {
  interface NtlmOptions {
    url: string;
    username: string;
    password: string;
    domain?: string;
    workstation?: string;
    headers?: Record<string, string>;
    body?: string;
    /** durchgereicht an httpreq: Zertifikatspruefung (nur Dev abschalten). */
    rejectUnauthorized?: boolean;
  }
  interface NtlmResponse {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  type Callback = (err: Error | null, res: NtlmResponse) => void;
  export function get(options: NtlmOptions, callback: Callback): void;
  export function post(options: NtlmOptions, callback: Callback): void;
  export function put(options: NtlmOptions, callback: Callback): void;
}
