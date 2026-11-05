import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="text-ink-600">The page you are looking for does not exist.</p>
      <Link to="/dashboard" className="btn-primary mt-2">Back to dashboard</Link>
    </div>
  );
}
