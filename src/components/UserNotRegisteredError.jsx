import React from 'react';
import { useAuth } from '@/lib/AuthContext';

const UserNotRegisteredError = ({
  title = 'Waiting for approval',
  message = 'Your account has been created, but an administrator still needs to approve it before you can use the dashboard.',
}) => {
  const { logout, user } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{title}</h1>
          <p className="text-slate-600 mb-8">
            {message}
          </p>
          {user?.email && <p className="text-sm text-slate-500 mb-6">Signed in as <b>{user.email}</b></p>}
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>If you believe this is an error, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Ask the restaurant admin to approve your email in Users &amp; Roles</li>
              <li>Make sure you are logged in with the correct account</li>
            </ul>
          </div>
          <button
            onClick={() => logout(false).then(() => { window.location.href = '/login'; })}
            className="mt-6 w-full px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
