export interface ApiResponse<T> {
  success?: boolean;
  isSuccess?: boolean;
  data?: T;
  Data?: T;
  message?: string;
  errors?: string[];
}

export const API_BASE_URL = '/api/v1';

function unwrapResponse<T>(json: any): T {
  if (json === null || json === undefined) return json;
  if (json.data !== undefined) return json.data;
  if (json.Data !== undefined) return json.Data;
  return json as T;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    // NOTE: The access token is now delivered via HttpOnly cookie (set by the server on login).
    // The browser sends it automatically with credentials:'include'. We also send X-Tenant-ID
    // and X-User-ID as convenient metadata headers.
    const tenantId = localStorage.getItem('tenant_id') || '1';
    let userId: string | null = null;
    try {
      const raw = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id || parsed?.Id) userId = String(parsed.id || parsed.Id);
      }
    } catch {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (userId) {
      headers['x-user-id'] = userId;
    }
    return headers;
  }

  private async handleResponse(res: Response, endpoint: string, method: string): Promise<any> {
    // On 401 Unauthorized, the session cookie has expired — clear user state and force login
    if (res.status === 401) {
      sessionStorage.removeItem('current_user');
      localStorage.removeItem('current_user');
      // Don't reload immediately — let App.tsx state handle this via user = null
      window.dispatchEvent(new CustomEvent('cms_session_expired'));
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      const errorText = await res.text();
      let cleanMessage = '';

      try {
        const errorJson = JSON.parse(errorText);
        if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
          cleanMessage = errorJson.errors.filter(Boolean).join(', ');
        } else if (errorJson.errors && typeof errorJson.errors === 'object') {
          const allErrs = Object.entries(errorJson.errors).map(([field, msgs]) => 
            `${field}: ${Array.isArray(msgs) ? msgs.join('; ') : msgs}`
          );
          if (allErrs.length > 0) cleanMessage = allErrs.join(', ');
        } else if (errorJson.message) {
          cleanMessage = errorJson.message;
        } else if (errorJson.Message) {
          cleanMessage = errorJson.Message;
        } else if (errorJson.title) {
          cleanMessage = errorJson.title;
        } else if (errorJson.error) {
          cleanMessage = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
        }
      } catch {
        // Not JSON
      }

      if (!cleanMessage) {
        cleanMessage = errorText && errorText.trim().length > 0 && errorText.length < 200
          ? errorText.trim()
          : `Request failed with status ${res.status}`;
      }

      const err: any = new Error(cleanMessage);
      err.status = res.status;
      err.rawResponse = errorText;
      throw err;
    }

    const json = await res.json();
    return unwrapResponse<any>(json);
  }

  private resolveUrl(endpoint: string): string {
    if (endpoint.startsWith(API_BASE_URL)) return endpoint;
    return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = this.resolveUrl(endpoint);
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'   // Send HttpOnly auth cookie automatically
    });

    return this.handleResponse(res, endpoint, 'GET');
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const url = this.resolveUrl(endpoint);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    return this.handleResponse(res, endpoint, 'POST');
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    const url = this.resolveUrl(endpoint);
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    return this.handleResponse(res, endpoint, 'PUT');
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = this.resolveUrl(endpoint);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return this.handleResponse(res, endpoint, 'DELETE');
  }

  async logAudit(entry: {
    tableName: string;
    recordId: string | number;
    operation: string;
    oldValues?: any;
    newValues?: any;
    changedBy?: number;
  }): Promise<void> {
    try {
      let storedUser: any = null;
      try {
        const raw = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
        if (raw) storedUser = JSON.parse(raw);
      } catch {}

      const userId = entry.changedBy || (storedUser?.id ? Number(storedUser.id) : (storedUser?.Id ? Number(storedUser.Id) : 1));

      await this.post('/audit/log', {
        tableName: entry.tableName,
        recordId: String(entry.recordId),
        operation: entry.operation,
        oldValues: entry.oldValues ? (typeof entry.oldValues === 'string' ? entry.oldValues : JSON.stringify(entry.oldValues)) : null,
        newValues: entry.newValues ? (typeof entry.newValues === 'string' ? entry.newValues : JSON.stringify(entry.newValues)) : null,
        changedBy: userId
      });
    } catch (e) {
      // Non-blocking background audit log error suppression
      console.warn('Audit log write skipped:', e);
    }
  }
}

export const api = new ApiClient();

export const logAudit = (entry: {
  tableName: string;
  recordId: string | number;
  operation: string;
  oldValues?: any;
  newValues?: any;
  changedBy?: number;
}) => api.logAudit(entry);
