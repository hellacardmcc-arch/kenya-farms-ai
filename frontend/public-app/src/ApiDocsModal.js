import React from 'react';
import './ApiDocsModal.css';

function ApiDocsModal({ onClose }) {
  return (
    <div className="api-docs-overlay" onClick={onClose}>
      <div className="api-docs-modal" onClick={e => e.stopPropagation()}>
        <div className="api-docs-header">
          <h2>API Documentation</h2>
          <button className="api-docs-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="api-docs-content">
          <p className="api-docs-version">Version 2.0.0 | Base URL: <code>http://localhost:5001</code> (or your API Gateway URL)</p>

          <h3>1. Overview</h3>
          <p>All APIs are accessed through the <strong>API Gateway</strong>. Requests are proxied to the appropriate microservice.</p>
          <h4>Authentication</h4>
          <p>Most endpoints require a JWT token:</p>
          <pre><code>Authorization: Bearer &lt;your-jwt-token&gt;</code></pre>
          <p>Obtain a token via <code>POST /api/auth/login</code> or <code>POST /api/auth/request-access</code>.</p>

          <h3>2. Auth API (<code>/api/auth/*</code>)</h3>
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>POST</td><td>/api/auth/request-access</td><td>Request farmer/admin access</td></tr>
              <tr><td>POST</td><td>/api/auth/register</td><td>Direct registration</td></tr>
              <tr><td>POST</td><td>/api/auth/login</td><td>Login</td></tr>
              <tr><td>GET</td><td>/api/auth/me</td><td>Get current user</td></tr>
              <tr><td>PUT</td><td>/api/auth/profile</td><td>Update profile</td></tr>
              <tr><td>PUT</td><td>/api/auth/password</td><td>Change password</td></tr>
              <tr><td>GET</td><td>/api/auth/health</td><td>Health check</td></tr>
            </tbody>
          </table>

          <h3>3. Admin API (<code>/api/admin/*</code>)</h3>
          <p><em>Requires admin role.</em></p>
          <h4>Farmers</h4>
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td>/api/admin/farmers</td><td>List farmers</td></tr>
              <tr><td>GET</td><td>/api/admin/farmers/:id</td><td>Get farmer</td></tr>
              <tr><td>POST</td><td>/api/admin/farmers/register</td><td>Register farmer</td></tr>
              <tr><td>PUT</td><td>/api/admin/farmers/:id</td><td>Update farmer</td></tr>
              <tr><td>DELETE</td><td>/api/admin/farmers/:id</td><td>Soft delete farmer</td></tr>
            </tbody>
          </table>
          <h4>Crops, Access Requests, Sensors & Robots</h4>
          <p>Same pattern: <code>/api/admin/crops</code>, <code>/api/admin/requests</code>, <code>/api/admin/sensors</code>, <code>/api/admin/robots</code>.</p>
          <h4>Settings & Maintenance</h4>
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td>/api/admin/settings/config</td><td>Get config</td></tr>
              <tr><td>POST</td><td>/api/admin/settings/seed-config</td><td>Seed defaults</td></tr>
              <tr><td>GET</td><td>/api/admin/settings/migration-status</td><td>Check migrations</td></tr>
              <tr><td>POST</td><td>/api/admin/settings/run-migrations</td><td>Run migrations</td></tr>
              <tr><td>POST</td><td>/api/admin/settings/reconnect-db</td><td>Force DB reconnect</td></tr>
              <tr><td>GET</td><td>/api/admin/health</td><td>Health check</td></tr>
            </tbody>
          </table>

          <h3>4. System API (<code>/api/system/*</code>)</h3>
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td>/api/system/config</td><td>System config</td></tr>
              <tr><td>GET</td><td>/api/system/status</td><td>System status</td></tr>
              <tr><td>GET</td><td>/api/system/available-sensors</td><td>Sensors to activate</td></tr>
              <tr><td>GET</td><td>/api/system/available-robots</td><td>Robots to activate</td></tr>
              <tr><td>POST</td><td>/api/system/sensors/:id/activate</td><td>Activate sensor</td></tr>
              <tr><td>POST</td><td>/api/system/robots/:id/activate</td><td>Activate robot</td></tr>
              <tr><td>POST</td><td>/api/system/control/irrigation</td><td>Start/stop irrigation</td></tr>
            </tbody>
          </table>

          <h3>5. Farmer API (<code>/api/farmers/*</code>)</h3>
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td>/api/farmers/me</td><td>Current farmer</td></tr>
              <tr><td>GET</td><td>/api/farmers/:id/farms</td><td>Farmer's farms</td></tr>
              <tr><td>GET</td><td>/api/farmers/:id/crops</td><td>Farmer's crops</td></tr>
              <tr><td>GET</td><td>/api/farmers/:id/alerts</td><td>Farmer's alerts</td></tr>
            </tbody>
          </table>

          <h3>6. Devices, Analytics, Notifications</h3>
          <p><code>/api/devices</code>, <code>/api/analytics</code>, <code>/api/notifications</code> — see full docs in <code>docs/API_DOCUMENTATION.md</code>.</p>

          <h3>7. Error Responses</h3>
          <table>
            <thead><tr><th>Status</th><th>Format</th></tr></thead>
            <tbody>
              <tr><td>400</td><td><code>{"{ \"error\": \"Validation message\" }"}</code></td></tr>
              <tr><td>401</td><td><code>{"{ \"error\": \"Unauthorized\" }"}</code></td></tr>
              <tr><td>404</td><td><code>{"{ \"error\": \"Not found\" }"}</code></td></tr>
              <tr><td>500</td><td><code>{"{ \"error\": \"Internal error\" }"}</code></td></tr>
            </tbody>
          </table>

          <h3>8. Rate Limits</h3>
          <ul>
            <li><strong>Global:</strong> 100 requests/minute</li>
            <li><strong>Auth</strong> (login, register, request-access): 5 requests/minute</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ApiDocsModal;
