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

  private async handleResponse(res: Response, endpoint: string, method: string): Promise<any> {
    // On 401 Unauthorized, the token is invalid/expired — clear it and force login
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return unwrapResponse<any>(json);
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

    return this.handleResponse(res, endpoint, 'GET');
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    return this.handleResponse(res, endpoint, 'POST');
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    return this.handleResponse(res, endpoint, 'PUT');
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return this.handleResponse(res, endpoint, 'DELETE');
  }
}

export const api = new ApiClient();
