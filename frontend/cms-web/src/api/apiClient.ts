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
    const token = localStorage.getItem('auth_token');
    const tenantId = localStorage.getItem('tenant_id') || '1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };

    // Only send Authorization header if there is a well-formed 3-segment JWT token
    if (token && token.split('.').length === 3) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API GET ${endpoint} failed (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return unwrapResponse<T>(json);
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API POST ${endpoint} failed (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return unwrapResponse<T>(json);
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API PUT ${endpoint} failed (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return unwrapResponse<T>(json);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API DELETE ${endpoint} failed (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return unwrapResponse<T>(json);
  }
}

export const api = new ApiClient();
