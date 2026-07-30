import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('korintek_training_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('korintek_training_token');
      localStorage.removeItem('korintek_training_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/catalogue') && !window.location.pathname.startsWith('/inscription') && !window.location.pathname.startsWith('/verifier')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;
