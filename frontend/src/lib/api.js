const TOKEN_KEY = 'cloud_pos_token';
const USER_KEY = 'cloud_pos_user';

export const loadSession = () => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null')
});

export const saveSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const request = async (path, { token, method = 'GET', body } = {}) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
};
