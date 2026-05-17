import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import api from '../services/api';

// ── State shape ───────────────────────────────────────────────────────────────
const initialState = {
  user: null,
  token: null,
  isLoading: true,       // true during initial hydration
  isAuthenticated: false,
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function authReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'HYDRATE_DONE':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);

const TOKEN_KEY = 'goalsynce_token';

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── On mount: rehydrate from localStorage ─────────────────────────────────
  useEffect(() => {
    async function rehydrate() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        dispatch({ type: 'HYDRATE_DONE' });
        return;
      }
      try {
        // Verify token is still valid by calling /me
        const res = await api.get('/auth/me');
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: res.data.data, token: storedToken },
        });
      } catch {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        dispatch({ type: 'HYDRATE_DONE' });
      }
    }
    rehydrate();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data.data;
    localStorage.setItem(TOKEN_KEY, token);
    dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    return user; // caller uses role to redirect
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      dispatch({ type: 'UPDATE_USER', payload: res.data.data });
    } catch { /* silent */ }
  }, []);

  const value = {
    ...state,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
