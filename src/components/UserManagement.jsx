import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Pencil, Plus, Save, Trash2, UsersRound } from 'lucide-react';
import {
  createManagedUser,
  deactivateManagedUser,
  listManagedUsers,
  updateManagedUser,
} from '../api/client.js';

const blankForm = { name: '', username: '', password: '', isActive: true };

export default function UserManagement() {
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem('stockfinder_admin_key') || '');
  const [keyAccepted, setKeyAccepted] = useState(Boolean(sessionStorage.getItem('stockfinder_admin_key')));
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const activeUsers = useMemo(() => users.filter((user) => user.isActive !== false).length, [users]);

  async function loadUsers(key = adminKey) {
    setLoading(true);
    setError('');
    try {
      const response = await listManagedUsers(key);
      setUsers(response.users || []);
      setKeyAccepted(true);
      sessionStorage.setItem('stockfinder_admin_key', key);
    } catch (err) {
      setError('Invalid admin key or backend connection failed.');
      setKeyAccepted(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (keyAccepted && adminKey) loadUsers(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(blankForm);
    setEditingId('');
    setShowPassword(false);
  }

  function editUser(user) {
    setEditingId(user.id);
    setForm({ name: user.name, username: user.username, password: '', isActive: user.isActive !== false });
    setMessage('');
    setError('');
  }

  async function submitUser(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await updateManagedUser(adminKey, editingId, payload);
        setMessage('User updated successfully.');
      } else {
        await createManagedUser(adminKey, form);
        setMessage('User created successfully.');
      }
      resetForm();
      await loadUsers(adminKey);
    } catch (err) {
      setError('User save failed. Please check name, username, password or duplicate username.');
    } finally {
      setLoading(false);
    }
  }

  async function deactivateUser(userId) {
    if (!confirm('Deactivate this user?')) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      await deactivateManagedUser(adminKey, userId);
      setMessage('User deactivated.');
      await loadUsers(adminKey);
    } catch (err) {
      setError('User deactivate failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!keyAccepted) {
    return (
      <main className="user-management-page">
        <section className="management-card admin-key-card">
          <a className="back-link" href="/">
            <ArrowLeft size={16} /> Back to website
          </a>
          <div className="management-heading">
            <UsersRound size={26} />
            <div>
              <h1>User Management</h1>
              <p>Enter admin key to create and manage client logins.</p>
            </div>
          </div>
          <form
            className="admin-key-form"
            onSubmit={(event) => {
              event.preventDefault();
              loadUsers(adminKey);
            }}
          >
            <input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Enter admin key"
            />
            <button type="submit" disabled={loading || !adminKey}>
              {loading ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
              Continue
            </button>
          </form>
          {error && <div className="login-error">{error}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="user-management-page">
      <section className="management-card">
        <div className="management-topbar">
          <a className="back-link" href="/">
            <ArrowLeft size={16} /> Back to website
          </a>
          <button
            className="ghost-management-btn"
            onClick={() => {
              sessionStorage.removeItem('stockfinder_admin_key');
              setKeyAccepted(false);
            }}
          >
            Change Admin Key
          </button>
        </div>

        <div className="management-heading">
          <UsersRound size={28} />
          <div>
            <h1>User Management</h1>
            <p>{users.length} users • {activeUsers} active</p>
          </div>
        </div>

        <div className="management-grid">
          <form className="user-form" onSubmit={submitUser}>
            <h2>{editingId ? 'Edit User' : 'Create New User'}</h2>
            <label>
              <span>Client Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="M M DECORE"
              />
            </label>
            <label>
              <span>Username</span>
              <input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="mm_decore"
              />
            </label>
            <label>
              <span>{editingId ? 'New Password (optional)' : 'Password'}</span>
              <div className="password-edit-row">
                <input
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="MMd@123"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <label className="status-toggle">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active user
            </label>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? <Loader2 className="spin" size={17} /> : editingId ? <Save size={17} /> : <Plus size={17} />}
                {editingId ? 'Save Changes' : 'Create User'}
              </button>
              {editingId && <button type="button" className="ghost-management-btn" onClick={resetForm}>Cancel</button>}
            </div>
            {message && <div className="management-success">{message}</div>}
            {error && <div className="login-error">{error}</div>}
          </form>

          <div className="users-table-wrap">
            <div className="table-title">Created Users</div>
            <div className="users-table">
              <div className="users-table-head">
                <span>Name</span>
                <span>Username</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {users.map((user) => (
                <div className="users-table-row" key={user.id}>
                  <span>{user.name}</span>
                  <span>{user.username}</span>
                  <span className={user.isActive ? 'status-active' : 'status-inactive'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="user-actions">
                    <button type="button" onClick={() => editUser(user)}>
                      <Pencil size={15} /> Edit
                    </button>
                    <button type="button" className="danger-small" onClick={() => deactivateUser(user.id)}>
                      <Trash2 size={15} /> Disable
                    </button>
                  </span>
                </div>
              ))}
              {!users.length && <div className="empty-users">No users created yet.</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
