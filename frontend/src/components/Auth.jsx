import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

function Auth({ mode, onToggle, onAuthSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const endpoint = mode === 'login' ? 'http://localhost:8000/login' : 'http://localhost:8000/signup';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Authentication failed');
            }

            if (mode === 'login') {
                onAuthSuccess(data.username);
            } else {
                // After signup, switch to login
                onToggle();
                alert('Account created! Please login.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-card">
            <div className="auth-header">
                <h1>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
                <p>{mode === 'login' ? 'Enter your details to continue' : 'Join the MSIS Placement community'}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="input-group">
                    <User size={18} className="input-icon" />
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                <div className="input-group">
                    <Lock size={18} className="input-icon" />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" className="auth-submit" disabled={isLoading}>
                    {isLoading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
                    {!isLoading && <ArrowRight size={18} />}
                </button>
            </form>

            <div className="auth-footer">
                {mode === 'login' ? (
                    <p>Don't have an account? <span onClick={onToggle}>Sign Up</span></p>
                ) : (
                    <p>Already have an account? <span onClick={onToggle}>Login</span></p>
                )}
            </div>
        </div>
    );
}

export default Auth;
