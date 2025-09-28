import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginCredentials } from '../types/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading, authError, clearAuthError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginCredentials>();

  // Clear error when user starts typing in either field
  const handleFieldFocus = () => {
    if (authError) {
      clearAuthError();
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginCredentials) => {
    setIsSubmitting(true);

    try {
      await login(data);
      // If login succeeds, this won't be reached due to redirect
    } catch (err: any) {
      // Error is now handled in useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background-primary)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--color-primary-500)]"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: `linear-gradient(135deg,
          var(--color-primary-50) 0%,
          var(--color-background-primary) 25%,
          var(--color-primary-25) 50%,
          var(--color-background-primary) 75%,
          var(--color-primary-50) 100%
        )`
      }}
    >
      <div className="max-w-md w-full">
        <div className="bg-[var(--color-background-secondary)] rounded-[20px] shadow-lg p-8" style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 bg-[var(--color-primary-500)] rounded-2xl flex items-center justify-center mb-6">
              <svg className="h-10 w-10 text-[var(--color-text-inverse)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {/* Church building base */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20h16V10l-8-6-8 6v10z" />
                {/* Church bell tower */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 4V2h4v2" />
                {/* Cross on top */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2V1M11 1.5h2" />
                {/* Church door */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
                {/* Eye in the center - pupil */}
                <circle cx="12" cy="12" r="2.5" strokeWidth={1.5} fill="currentColor" />
                {/* Eye in the center - iris */}
                <circle cx="12" cy="12" r="1.2" strokeWidth={0} fill="var(--color-primary-500)" />
                {/* Eye highlight */}
                <circle cx="12.5" cy="11.5" r="0.3" strokeWidth={0} fill="currentColor" />
                {/* Church windows */}
                {/* <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v-1.5M16 14v-1.5" /> */}
              </svg>
            </div>
            <h1 className="text-[28px] font-bold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              PastorIA
            </h1>
            <p className="mt-3 text-[16px] text-[var(--color-text-secondary)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Acesse sua conta para continuar
            </p>
          </div>
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field with Floating Label */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                type="email"
                autoComplete="email"
                className={`w-full h-14 pl-12 pr-4 pt-6 pb-2 border-2 rounded-xl bg-[var(--color-background-primary)] text-[var(--color-text-primary)] placeholder-transparent focus:outline-none focus:border-[var(--color-primary-500)] transition-all ${errors.email ? 'border-[var(--color-status-error-border)]' : 'border-[var(--color-border)]'}`}
                placeholder="Email"
                onFocus={handleFieldFocus}
                {...register('email', {
                  required: 'Email é obrigatório',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Email inválido',
                  },
                })}
              />
              <label className="absolute left-12 top-2 text-xs text-[var(--color-text-tertiary)] transition-all duration-200 pointer-events-none">
                Email
              </label>
              {errors.email && (
                <p className="mt-1 text-sm text-[var(--color-status-error-text)]">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field with Floating Label */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                className={`w-full h-14 pl-12 pr-4 pt-6 pb-2 border-2 rounded-xl bg-[var(--color-background-primary)] text-[var(--color-text-primary)] placeholder-transparent focus:outline-none focus:border-[var(--color-primary-500)] transition-all ${errors.password ? 'border-[var(--color-status-error-border)]' : 'border-[var(--color-border)]'}`}
                placeholder="Senha"
                onFocus={handleFieldFocus}
                {...register('password', {
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'Senha deve ter pelo menos 6 caracteres',
                  },
                })}
              />
              <label className="absolute left-12 top-2 text-xs text-[var(--color-text-tertiary)] transition-all duration-200 pointer-events-none">
                Senha
              </label>
              {errors.password && (
                <p className="mt-1 text-sm text-[var(--color-status-error-text)]">{errors.password.message}</p>
              )}
            </div>

            {/* Error message display */}
            {authError && (
              <div className="text-sm text-[var(--color-status-error-text)] bg-[var(--color-status-error-bg)] border border-[var(--color-status-error-border)] rounded-xl p-3">
                {authError}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)] text-[var(--color-text-inverse)] font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]">Não tem uma conta?</span>
              </div>
            </div>

            {/* Secondary Action - Create Account */}
            <div className="mt-6">
              <Link
                to="/register"
                className="w-full h-14 flex items-center justify-center border-2 border-[var(--color-primary-500)] rounded-xl text-[var(--color-primary-500)] font-semibold hover:bg-[var(--color-primary-500)] hover:text-[var(--color-text-inverse)] transition-all duration-200"
              >
                Criar uma conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;