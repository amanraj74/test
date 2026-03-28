import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="page">
      <h2>Page not found</h2>
      <p className="helper">The requested page does not exist.</p>
      <Link to="/" className="primary">Go to dashboard</Link>
    </div>
  );
}

export default NotFound;
